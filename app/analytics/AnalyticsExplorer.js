"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CalendarRange,
  Clock3,
  CornerUpRight,
  Eye,
  Gauge,
  Globe2,
  MapPin,
  Monitor,
  MousePointer2,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react";
import styles from "./analytics.module.css";

const numberFormatter = new Intl.NumberFormat("en-CA");

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function parseDate(date) {
  return new Date(`${date}T12:00:00Z`);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return dateKey(next);
}

function formatDay(date, options = {}) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...options,
  }).format(parseDate(date));
}

function formatVisitTime(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ");
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatHour(hour) {
  const start = new Date(Date.UTC(2020, 0, 1, hour));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    hour: "numeric",
  }).format(start);
}

function rangeLabel(from, to) {
  if (from === to) {
    return formatDay(from, { year: "numeric" });
  }

  return `${formatDay(from)} – ${formatDay(to, { year: "numeric" })}`;
}

function rangeFor(days, latestDate) {
  return {
    from: addDays(latestDate, -(days - 1)),
    to: latestDate,
    preset: days,
  };
}

function DeviceIcon({ device }) {
  const normalized = device.toLowerCase();

  if (normalized.includes("mobile")) {
    return <Smartphone aria-hidden="true" size={14} />;
  }

  if (normalized.includes("tablet")) {
    return <Tablet aria-hidden="true" size={14} />;
  }

  return <Monitor aria-hidden="true" size={14} />;
}

function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTopline}>
        <span>{label}</span>
        <span className={styles.metricIcon}>
          <Icon aria-hidden="true" size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function EmptyState({ children }) {
  return <div className={styles.emptyState}>{children}</div>;
}

export default function AnalyticsExplorer({ data }) {
  const daily = useMemo(() => data.daily || [], [data.daily]);
  const latestDate = daily.at(-1)?.date || dateKey(new Date());
  const [range, setRange] = useState(() => rangeFor(30, latestDate));
  const [hoveredDay, setHoveredDay] = useState(latestDate);
  const [hoveredHour, setHoveredHour] = useState(null);

  const filteredDaily = useMemo(
    () => daily.filter((day) => day.date >= range.from && day.date <= range.to),
    [daily, range]
  );
  const selectedDay = filteredDaily.some((day) => day.date === hoveredDay)
    ? hoveredDay
    : filteredDaily.at(-1)?.date || latestDate;

  const hourlyForDay = useMemo(() => {
    const byHour = new Map(
      (data.hourly || [])
        .filter((entry) => entry.date === selectedDay)
        .map((entry) => [entry.hour, entry])
    );

    return Array.from({ length: 24 }, (_, hour) =>
      byHour.get(hour) || {
        date: selectedDay,
        hour,
        pageviews: 0,
        visitors: 0,
      }
    );
  }, [data.hourly, selectedDay]);

  const pageRows = useMemo(() => {
    const pages = new Map();

    for (const page of data.pages || []) {
      if (page.date < range.from || page.date > range.to) continue;
      const current = pages.get(page.pathname) || {
        pathname: page.pathname,
        pageviews: 0,
        visitors: 0,
      };
      current.pageviews += page.pageviews;
      current.visitors += page.visitors;
      pages.set(page.pathname, current);
    }

    return [...pages.values()]
      .sort((left, right) => right.pageviews - left.pageviews)
      .slice(0, 8);
  }, [data.pages, range]);

  const recentVisits = useMemo(
    () =>
      (data.recent || []).filter(
        (visit) => visit.date >= range.from && visit.date <= range.to
      ),
    [data.recent, range]
  );

  const totals = useMemo(() => {
    const pageviews = filteredDaily.reduce(
      (sum, day) => sum + day.pageviews,
      0
    );
    const visitors = filteredDaily.reduce(
      (sum, day) => sum + day.visitors,
      0
    );
    const busiestDay = filteredDaily.reduce(
      (busiest, day) =>
        !busiest || day.pageviews > busiest.pageviews ? day : busiest,
      null
    );
    const peakHour = hourlyForDay.reduce(
      (peak, hour) => (hour.pageviews > peak.pageviews ? hour : peak),
      hourlyForDay[0]
    );

    return {
      pageviews,
      visitors,
      viewsPerVisitor: visitors ? pageviews / visitors : 0,
      busiestDay,
      peakHour,
    };
  }, [filteredDaily, hourlyForDay]);

  const maximumDailyViews = Math.max(
    1,
    ...filteredDaily.map((day) => day.pageviews)
  );
  const maximumHourlyViews = Math.max(
    1,
    ...hourlyForDay.map((hour) => hour.pageviews)
  );
  const selectedDailyIndex = filteredDaily.findIndex(
    (day) => day.date === selectedDay
  );
  const selectedDaily = filteredDaily[selectedDailyIndex] || {
    date: selectedDay,
    pageviews: 0,
    visitors: 0,
  };
  const previousDaily = filteredDaily[selectedDailyIndex - 1];
  const dailyChange = previousDaily?.pageviews
    ? ((selectedDaily.pageviews - previousDaily.pageviews) /
        previousDaily.pageviews) *
      100
    : null;
  const peakHourIndex = totals.peakHour?.hour || 0;
  const selectedHour =
    hourlyForDay[hoveredHour ?? peakHourIndex] || hourlyForDay[0];
  const calendarMaximum = Math.max(1, ...daily.map((day) => day.pageviews));
  const calendarPadding = Array(parseDate(daily[0]?.date || latestDate).getUTCDay())
    .fill(null);
  const calendarDays = [...calendarPadding, ...daily];
  const maxPageViews = Math.max(1, ...pageRows.map((page) => page.pageviews));
  const referralCount = recentVisits.filter(
    (visit) => visit.referrer !== "Direct"
  ).length;

  function choosePreset(days) {
    setRange(rangeFor(days, latestDate));
    setHoveredDay(latestDate);
    setHoveredHour(null);
  }

  function chooseDay(date) {
    setRange({ from: date, to: date, preset: "custom" });
    setHoveredDay(date);
    setHoveredHour(null);
  }

  function changeBoundary(boundary, value) {
    if (!value) return;
    const next = { ...range, [boundary]: value, preset: "custom" };

    if (next.from > next.to) {
      if (boundary === "from") next.to = value;
      else next.from = value;
    }

    setRange(next);
    setHoveredDay(next.to);
    setHoveredHour(null);
  }

  if (data.error) {
    return (
      <section className={styles.errorCard}>
        <strong>Analytics is connected, but data could not be loaded.</strong>
        <span>{data.error}</span>
      </section>
    );
  }

  return (
    <>
      <section className={styles.rangeToolbar} aria-label="Analytics date range">
        <div className={styles.rangePresets}>
          {[
            [1, "Today"],
            [7, "7 days"],
            [30, "30 days"],
            [90, "90 days"],
          ].map(([days, label]) => (
            <button
              className={range.preset === days ? styles.activePreset : ""}
              key={days}
              onClick={() => choosePreset(days)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.customRange}>
          <CalendarRange aria-hidden="true" size={16} />
          <label>
            <span>From</span>
            <input
              max={latestDate}
              min={daily[0]?.date}
              onChange={(event) => changeBoundary("from", event.target.value)}
              type="date"
              value={range.from}
            />
          </label>
          <i>to</i>
          <label>
            <span>To</span>
            <input
              max={latestDate}
              min={daily[0]?.date}
              onChange={(event) => changeBoundary("to", event.target.value)}
              type="date"
              value={range.to}
            />
          </label>
        </div>
        <strong className={styles.rangeSummary}>{rangeLabel(range.from, range.to)}</strong>
      </section>

      <section className={styles.metrics} aria-label="Traffic summary">
        <MetricCard
          icon={Users}
          label="Daily visitors"
          value={formatNumber(totals.visitors)}
          note="Sum of unique browsers per day"
        />
        <MetricCard
          icon={Eye}
          label="Page views"
          value={formatNumber(totals.pageviews)}
          note={`${filteredDaily.length} day${filteredDaily.length === 1 ? "" : "s"} selected`}
        />
        <MetricCard
          icon={Gauge}
          label="Views per visitor"
          value={totals.viewsPerVisitor.toFixed(1)}
          note="Engagement within this range"
        />
        <MetricCard
          icon={Clock3}
          label="Peak time"
          value={formatHour(peakHourIndex)}
          note={`On ${formatDay(selectedDay)}`}
        />
      </section>

      <section className={styles.explorerGrid}>
        <article className={`${styles.panel} ${styles.trendPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Interactive trend</p>
              <h2>Daily traffic</h2>
            </div>
            <div className={styles.legend}>
              <span><i className={styles.viewsKey} /> Page views</span>
              <span><i className={styles.visitorsKey} /> Visitors</span>
            </div>
          </div>

          <div className={styles.trendDetail} aria-live="polite">
            <div>
              <span>{formatDay(selectedDaily.date, { weekday: "long", year: "numeric" })}</span>
              <strong>{formatNumber(selectedDaily.pageviews)} page views</strong>
            </div>
            <dl>
              <div><dt>Visitors</dt><dd>{formatNumber(selectedDaily.visitors)}</dd></div>
              <div>
                <dt>Views / visitor</dt>
                <dd>{selectedDaily.visitors ? (selectedDaily.pageviews / selectedDaily.visitors).toFixed(1) : "0.0"}</dd>
              </div>
              <div>
                <dt>Vs previous day</dt>
                <dd className={dailyChange > 0 ? styles.positive : dailyChange < 0 ? styles.negative : ""}>
                  {dailyChange === null ? "—" : `${dailyChange > 0 ? "+" : ""}${dailyChange.toFixed(0)}%`}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.interactiveTrend} aria-label="Interactive daily traffic chart">
            {filteredDaily.map((day, index) => (
              <button
                aria-label={`${formatDay(day.date)}: ${day.pageviews} page views and ${day.visitors} visitors`}
                className={`${styles.trendColumn} ${day.date === selectedDay ? styles.activeTrendColumn : ""}`}
                key={day.date}
                onClick={() => setHoveredDay(day.date)}
                onFocus={() => setHoveredDay(day.date)}
                onMouseEnter={() => setHoveredDay(day.date)}
                style={{ minWidth: filteredDaily.length > 45 ? 8 : filteredDaily.length > 20 ? 15 : 26 }}
                type="button"
              >
                <span className={styles.trendBars}>
                  <i
                    className={styles.trendVisitorBar}
                    style={{ height: `${Math.max(day.visitors ? 4 : 0, (day.visitors / maximumDailyViews) * 100)}%` }}
                  />
                  <i
                    className={styles.trendViewBar}
                    style={{ height: `${Math.max(day.pageviews ? 6 : 0, (day.pageviews / maximumDailyViews) * 100)}%` }}
                  />
                </span>
                <span className={styles.trendLabel}>
                  {index === 0 || index === filteredDaily.length - 1 || index % Math.max(1, Math.ceil(filteredDaily.length / 6)) === 0
                    ? formatDay(day.date, { month: filteredDaily.length > 14 ? undefined : "short" })
                    : ""}
                </span>
              </button>
            ))}
          </div>
          <p className={styles.interactionHint}>
            <MousePointer2 aria-hidden="true" size={13} /> Hover or focus a day to inspect it and update the hourly view.
          </p>
        </article>

        <article className={`${styles.panel} ${styles.hourlyPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>{formatDay(selectedDay)}</p>
              <h2>Time of day</h2>
            </div>
            <Clock3 aria-hidden="true" size={20} />
          </div>
          <div className={styles.hourDetail} aria-live="polite">
            <strong>{formatHour(selectedHour.hour)} – {formatHour((selectedHour.hour + 1) % 24)}</strong>
            <span>{formatNumber(selectedHour.pageviews)} views · {formatNumber(selectedHour.visitors)} visitors</span>
          </div>
          <div className={styles.hourlyChart} aria-label={`Hourly traffic for ${formatDay(selectedDay)}`}>
            {hourlyForDay.map((hour) => (
              <button
                aria-label={`${formatHour(hour.hour)}: ${hour.pageviews} page views`}
                className={`${styles.hourColumn} ${hour.hour === selectedHour.hour ? styles.activeHour : ""}`}
                key={hour.hour}
                onFocus={() => setHoveredHour(hour.hour)}
                onMouseEnter={() => setHoveredHour(hour.hour)}
                type="button"
              >
                <i style={{ height: `${Math.max(hour.pageviews ? 6 : 0, (hour.pageviews / maximumHourlyViews) * 100)}%` }} />
                <span>{hour.hour % 6 === 0 ? formatHour(hour.hour) : ""}</span>
              </button>
            ))}
          </div>
          <div className={styles.dayPartLegend}>
            <span>Night</span><span>Morning</span><span>Afternoon</span><span>Evening</span>
          </div>
        </article>
      </section>

      <section className={styles.insightGrid}>
        <article className={`${styles.panel} ${styles.calendarPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Last 90 days</p>
              <h2>Visit calendar</h2>
            </div>
            <CalendarDays aria-hidden="true" size={20} />
          </div>
          <div className={styles.calendarCaption}>
            <span>{formatDay(daily[0]?.date || latestDate, { month: "long", year: "numeric" })}</span>
            <span>{formatDay(latestDate, { month: "long", year: "numeric" })}</span>
          </div>
          <div className={styles.heatmapWrap}>
            <div className={styles.weekdayLabels} aria-hidden="true">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>
            <div className={styles.heatmap}>
              {calendarDays.map((day, index) => {
                if (!day) return <span className={styles.heatmapSpacer} key={`spacer-${index}`} />;
                const ratio = day.pageviews / calendarMaximum;
                const level = day.pageviews === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
                return (
                  <button
                    aria-label={`${formatDay(day.date, { year: "numeric" })}: ${day.pageviews} page views, ${day.visitors} visitors`}
                    className={`${styles.heatCell} ${day.date >= range.from && day.date <= range.to ? styles.selectedHeatCell : ""}`}
                    data-level={level}
                    key={day.date}
                    onClick={() => chooseDay(day.date)}
                    title={`${formatDay(day.date)} · ${day.pageviews} views · ${day.visitors} visitors`}
                    type="button"
                  />
                );
              })}
            </div>
          </div>
          <div className={styles.heatLegend}>
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => <i data-level={level} key={level} />)}
            <span>More</span>
          </div>
          <p className={styles.interactionHint}>Select any square to focus the full dashboard on that day.</p>
        </article>

        <article className={`${styles.panel} ${styles.pagesPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Selected range</p>
              <h2>Top pages</h2>
            </div>
            <Globe2 aria-hidden="true" size={20} />
          </div>
          {pageRows.length === 0 ? (
            <EmptyState>No page views in this range.</EmptyState>
          ) : (
            <div className={styles.rankedPages}>
              {pageRows.map((page, index) => (
                <div className={styles.rankedPage} key={page.pathname}>
                  <span className={styles.pageRank}>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{page.pathname}</strong>
                    <i><b style={{ width: `${(page.pageviews / maxPageViews) * 100}%` }} /></i>
                  </div>
                  <span><strong>{formatNumber(page.pageviews)}</strong><small>{formatNumber(page.visitors)} visitors</small></span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <article className={`${styles.panel} ${styles.activityPanel}`}>
        <div className={styles.activityHeading}>
          <div>
            <p className={styles.eyebrow}>Meaningful activity</p>
            <h2>Recent visits</h2>
            <p>See where each visit came from, what they viewed, and the device context behind it.</p>
          </div>
          <div className={styles.activitySummary}>
            <span><Activity size={15} /> {formatNumber(recentVisits.length)} recorded</span>
            <span><CornerUpRight size={15} /> {formatNumber(referralCount)} referrals</span>
          </div>
        </div>
        {recentVisits.length === 0 ? (
          <EmptyState>No recorded visits in this range.</EmptyState>
        ) : (
          <div className={styles.activityFeed}>
            {recentVisits.slice(0, 100).map((visit, index) => {
              const showDate = index === 0 || recentVisits[index - 1].date !== visit.date;
              return (
                <div key={`${visit.visitedAt}-${visit.pathname}-${index}`}>
                  {showDate ? (
                    <div className={styles.activityDate}>
                      <CalendarDays aria-hidden="true" size={14} />
                      {formatDay(visit.date, { weekday: "long", year: "numeric" })}
                    </div>
                  ) : null}
                  <section className={styles.activityItem}>
                    <time>{formatVisitTime(visit.visitedAt)}</time>
                    <span className={styles.activityPulse} />
                    <div className={styles.activityPath}>
                      <strong>{visit.pathname}</strong>
                      <span className={visit.referrer === "Direct" ? styles.directBadge : styles.referralBadge}>
                        {visit.referrer === "Direct" ? "Direct visit" : `From ${visit.referrer}`}
                      </span>
                    </div>
                    <div className={styles.activityMeta}>
                      <span><DeviceIcon device={visit.device} /> {visit.browser} on {visit.operatingSystem}</span>
                      <span><MapPin aria-hidden="true" size={14} /> {visit.location}</span>
                    </div>
                  </section>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </>
  );
}
