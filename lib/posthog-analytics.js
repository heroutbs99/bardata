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

function getThirtyDayKeys() {
  const keys = [];
  const now = new Date();

  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
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

  return getThirtyDayKeys().map(
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
      AND timestamp >= now() - INTERVAL 30 DAY
      AND properties.$host IN (${hosts})
    GROUP BY day
    ORDER BY day ASC
  `;

  const pageQuery = `
    SELECT
      if(empty(toString(properties.$pathname)), '/', toString(properties.$pathname)) AS pathname,
      count() AS pageviews,
      uniqExact(distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 30 DAY
      AND properties.$host IN (${hosts})
    GROUP BY pathname
    ORDER BY pageviews DESC
    LIMIT 10
  `;

  const recentQuery = `
    SELECT
      formatDateTime(timestamp, '%Y-%m-%dT%H:%i:%S%z', '${DASHBOARD_TIME_ZONE}') AS visited_at,
      if(empty(toString(properties.$pathname)), '/', toString(properties.$pathname)) AS pathname,
      if(empty(toString(properties.$referring_domain)), 'Direct', toString(properties.$referring_domain)) AS referrer,
      if(empty(toString(properties.$browser)), 'Unknown', toString(properties.$browser)) AS browser,
      if(empty(toString(properties.$device_type)), 'Desktop', toString(properties.$device_type)) AS device
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 30 DAY
      AND properties.$host IN (${hosts})
    ORDER BY timestamp DESC
    LIMIT 40
  `;

  try {
    const [dailyRows, pageRows, recentRows] = await Promise.all([
      runHogQl(dailyQuery, "BarData daily visitors"),
      runHogQl(pageQuery, "BarData top pages"),
      runHogQl(recentQuery, "BarData recent page visits"),
    ]);

    const daily = normalizeDailyRows(dailyRows);
    const today = daily.at(-1) || { pageviews: 0, visitors: 0 };
    const lastSevenDays = daily.slice(-7);

    return {
      configured: true,
      daily,
      summary: {
        visitorsToday: today.visitors,
        pageviewsToday: today.pageviews,
        pageviewsSevenDays: lastSevenDays.reduce(
          (total, day) => total + day.pageviews,
          0
        ),
        pageviewsThirtyDays: daily.reduce(
          (total, day) => total + day.pageviews,
          0
        ),
      },
      pages: pageRows.map(([pathname, pageviews, visitors]) => ({
        pathname: String(pathname),
        pageviews: Number(pageviews) || 0,
        visitors: Number(visitors) || 0,
      })),
      recent: recentRows.map(
        ([visitedAt, pathname, referrer, browser, device]) => ({
          visitedAt: String(visitedAt),
          pathname: String(pathname),
          referrer: String(referrer),
          browser: String(browser),
          device: String(device),
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
