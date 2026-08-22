const DASHBOARD_TIME_ZONE = "America/Toronto";
const TRACKED_HOSTS = ["bardata.app", "www.bardata.app"];

const REQUIRED_SERVER_ENV = [
  "POSTHOG_PERSONAL_API_KEY",
  "POSTHOG_PROJECT_ID",
];

function getPrivateApiHost() {
  if (process.env.POSTHOG_API_HOST) {
    return process.env.POSTHOG_API_HOST.replace(/\/$/, "");
  }

  const ingestionHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "";

  return ingestionHost
    .replace("https://us.i.posthog.com", "https://us.posthog.com")
    .replace("https://eu.i.posthog.com", "https://eu.posthog.com")
    .replace(/\/$/, "");
}

function getMissingEnvironmentVariables() {
  const required = [
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
    "NEXT_PUBLIC_POSTHOG_HOST",
    ...REQUIRED_SERVER_ENV,
  ];

  return required.filter((name) => !process.env[name]);
}

function trackedHostFilter() {
  return TRACKED_HOSTS.map((host) => `'${host}'`).join(", ");
}

async function runHogQl(query, name) {
  const apiHost = getPrivateApiHost();
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;

  const response = await fetch(
    `${apiHost}/api/projects/${encodeURIComponent(projectId)}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query,
        },
        name,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`PostHog query failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function dateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNinetyDayKeys() {
  const keys = [];
  const now = new Date();

  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    keys.push(dateKey(day));
  }

  return keys;
}

function normalizeDailyRows(rows) {
  const byDate = new Map(
    rows.map(([date, pageviews, visitors]) => [
      String(date),
      {
        date: String(date),
        pageviews: Number(pageviews) || 0,
        visitors: Number(visitors) || 0,
      },
    ])
  );

  return getNinetyDayKeys().map(
    (date) => byDate.get(date) || { date, pageviews: 0, visitors: 0 }
  );
}

export async function getAnalyticsData() {
  const missing = getMissingEnvironmentVariables();

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
    };
  }

  const hosts = trackedHostFilter();

  const dailyQuery = `
    SELECT
      toString(toDate(toTimeZone(timestamp, '${DASHBOARD_TIME_ZONE}'))) AS day,
      count() AS pageviews,
      uniqExact(distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 90 DAY
      AND properties.$host IN (${hosts})
    GROUP BY day
    ORDER BY day ASC
  `;

  const hourlyQuery = `
    SELECT
      toString(toDate(toTimeZone(timestamp, '${DASHBOARD_TIME_ZONE}'))) AS day,
      toHour(toTimeZone(timestamp, '${DASHBOARD_TIME_ZONE}')) AS hour,
      count() AS pageviews,
      uniqExact(distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 90 DAY
      AND properties.$host IN (${hosts})
    GROUP BY day, hour
    ORDER BY day ASC, hour ASC
  `;

  const pageQuery = `
    SELECT
      toString(toDate(toTimeZone(timestamp, '${DASHBOARD_TIME_ZONE}'))) AS day,
      if(empty(toString(properties.$pathname)), '/', toString(properties.$pathname)) AS pathname,
      count() AS pageviews,
      uniqExact(distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 90 DAY
      AND properties.$host IN (${hosts})
    GROUP BY day, pathname
    ORDER BY day DESC, pageviews DESC
    LIMIT 1000
  `;

  const recentQuery = `
    SELECT
      formatDateTime(timestamp, '%Y-%m-%dT%H:%i:%S%z', '${DASHBOARD_TIME_ZONE}') AS visited_at,
      toString(toDate(toTimeZone(timestamp, '${DASHBOARD_TIME_ZONE}'))) AS day,
      if(empty(toString(properties.$pathname)), '/', toString(properties.$pathname)) AS pathname,
      if(
        empty(toString(properties.$referring_domain))
          OR toString(properties.$referring_domain) IN (
            '$direct',
            'analytics.bardata.app',
            'bardata.app',
            'www.bardata.app'
          ),
        'Direct',
        toString(properties.$referring_domain)
      ) AS referrer,
      if(empty(toString(properties.$browser)), 'Unknown', toString(properties.$browser)) AS browser,
      if(empty(toString(properties.$device_type)), 'Desktop', toString(properties.$device_type)) AS device,
      if(empty(toString(properties.$os)), 'Unknown OS', toString(properties.$os)) AS operating_system,
      if(
        empty(toString(properties.$geoip_city_name)),
        if(empty(toString(properties.$geoip_country_name)), 'Unknown location', toString(properties.$geoip_country_name)),
        concat(toString(properties.$geoip_city_name), ', ', toString(properties.$geoip_country_name))
      ) AS location
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 90 DAY
      AND properties.$host IN (${hosts})
    ORDER BY timestamp DESC
    LIMIT 300
  `;

  try {
    const [dailyRows, hourlyRows, pageRows, recentRows] = await Promise.all([
      runHogQl(dailyQuery, "BarData 90-day visitors"),
      runHogQl(hourlyQuery, "BarData hourly traffic"),
      runHogQl(pageQuery, "BarData page performance by day"),
      runHogQl(recentQuery, "BarData enriched recent page visits"),
    ]);

    const daily = normalizeDailyRows(dailyRows);

    return {
      configured: true,
      daily,
      hourly: hourlyRows.map(([date, hour, pageviews, visitors]) => ({
        date: String(date),
        hour: Number(hour) || 0,
        pageviews: Number(pageviews) || 0,
        visitors: Number(visitors) || 0,
      })),
      pages: pageRows.map(([date, pathname, pageviews, visitors]) => ({
        date: String(date),
        pathname: String(pathname),
        pageviews: Number(pageviews) || 0,
        visitors: Number(visitors) || 0,
      })),
      recent: recentRows.map(
        ([visitedAt, date, pathname, referrer, browser, device, operatingSystem, location]) => ({
          visitedAt: String(visitedAt),
          date: String(date),
          pathname: String(pathname),
          referrer: String(referrer),
          browser: String(browser),
          device: String(device),
          operatingSystem: String(operatingSystem),
          location: String(location),
        })
      ),
      updatedAt: new Date().toISOString(),
      timeZone: DASHBOARD_TIME_ZONE,
    };
  } catch (error) {
    return {
      configured: true,
      error:
        error instanceof Error
          ? error.message
          : "The analytics data could not be loaded.",
    };
  }
}
