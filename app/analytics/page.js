import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Eye,
  Globe2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  ANALYTICS_SESSION_COOKIE,
  readAnalyticsSession,
} from "@/lib/analytics-auth";
import { getAnalyticsData } from "@/lib/posthog-analytics";
import { changeCredentialsAction, logoutAction } from "./actions";
import styles from "./analytics.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BarData Analytics",
  description: "Private visitor analytics for BarData.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const numberFormatter = new Intl.NumberFormat("en-CA");

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function formatDay(date, options = {}) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatVisitTime(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ");
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function EmptyState({ children }) {
  return <div className={styles.emptyState}>{children}</div>;
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
      <strong>{formatNumber(value)}</strong>
      <small>{note}</small>
    </article>
  );
}

const securityMessages = {
  saved: {
    tone: "success",
    text: "Your analytics username and password have been updated.",
  },
  "invalid-username": {
    tone: "error",
    text: "Use 3–64 letters, numbers, dots, dashes, underscores, or @ characters.",
  },
  "invalid-password": {
    tone: "error",
    text: "Your new password must be between 12 and 128 characters.",
  },
  "password-mismatch": {
    tone: "error",
    text: "The two new-password fields do not match.",
  },
  "current-password": {
    tone: "error",
    text: "Your current password is not correct.",
  },
  "storage-error": {
    tone: "error",
    text: "The credential change could not be saved. Please try again.",
  },
};

function ConfigurationNotice({ missing }) {
  return (
    <main className={styles.centeredPage}>
      <section className={styles.noticeCard}>
        <span className={styles.noticeIcon}>
          <LockKeyhole aria-hidden="true" size={23} />
        </span>
        <p className={styles.eyebrow}>Connection required</p>
        <h1>Finish connecting PostHog</h1>
        <p>
          The dashboard is ready. Add the following environment variables to
          Vercel to start showing live visitor data.
        </p>
        <code>{missing.join(" · ")}</code>
      </section>
    </main>
  );
}

export default async function AnalyticsPage({ searchParams }) {
  const cookieStore = await cookies();
  const session = readAnalyticsSession(
    cookieStore.get(ANALYTICS_SESSION_COOKIE)?.value
  );

  if (!session) {
    redirect("/analytics/login");
  }

  const params = await searchParams;
  const securityMessage = securityMessages[params?.security];

  const data = await getAnalyticsData();

  if (!data.configured) {
    return <ConfigurationNotice missing={data.missing} />;
  }

  const daily = data.daily || [];
  const maximumPageviews = Math.max(
    1,
    ...daily.map((entry) => entry.pageviews)
  );

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div>
            <p>BarData</p>
            <span>Private analytics</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.siteLink} href="https://www.bardata.app">
            Open website
            <ArrowUpRight aria-hidden="true" size={16} />
          </a>
          <a className={styles.iconLink} href="#security" aria-label="Account settings">
            <Settings aria-hidden="true" size={17} />
          </a>
          <form action={logoutAction}>
            <button className={styles.iconButton} type="submit" aria-label="Sign out">
              <LogOut aria-hidden="true" size={17} />
            </button>
          </form>
        </div>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.liveDot} /> Live overview
          </p>
          <h1>Visitor analytics</h1>
          <p>
            A simple view of BarData traffic. Dates use Toronto time and the
            dashboard itself is excluded from tracking.
          </p>
        </div>
        {data.updatedAt ? (
          <p className={styles.updatedAt}>
            Updated {formatVisitTime(data.updatedAt)}
          </p>
        ) : null}
      </section>

      {data.error ? (
        <section className={styles.errorCard}>
          <strong>Analytics is connected, but data could not be loaded.</strong>
          <span>{data.error}</span>
        </section>
      ) : (
        <>
          <section className={styles.metrics} aria-label="Traffic summary">
            <MetricCard
              icon={Users}
              label="Visitors today"
              value={data.summary.visitorsToday}
              note="Anonymous unique browsers"
            />
            <MetricCard
              icon={Eye}
              label="Page views today"
              value={data.summary.pageviewsToday}
              note="All tracked page loads"
            />
            <MetricCard
              icon={Activity}
              label="Last 7 days"
              value={data.summary.pageviewsSevenDays}
              note="Page views"
            />
            <MetricCard
              icon={CalendarDays}
              label="Last 30 days"
              value={data.summary.pageviewsThirtyDays}
              note="Page views"
            />
          </section>

          <section className={styles.primaryGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>30-day trend</p>
                  <h2>Daily traffic</h2>
                </div>
                <div className={styles.legend}>
                  <span><i className={styles.viewsKey} /> Page views</span>
                  <span><i className={styles.visitorsKey} /> Visitors</span>
                </div>
              </div>

              <div className={styles.chart} aria-label="Daily traffic chart">
                {daily.map((entry, index) => (
                  <div
                    className={styles.chartDay}
                    key={entry.date}
                    title={`${formatDay(entry.date)}: ${entry.pageviews} page views, ${entry.visitors} visitors`}
                  >
                    <div className={styles.barTrack}>
                      <i
                        className={styles.visitorsBar}
                        style={{
                          height: `${Math.max(
                            entry.visitors > 0 ? 4 : 0,
                            (entry.visitors / maximumPageviews) * 100
                          )}%`,
                        }}
                      />
                      <i
                        className={styles.viewsBar}
                        style={{
                          height: `${Math.max(
                            entry.pageviews > 0 ? 6 : 0,
                            (entry.pageviews / maximumPageviews) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span>
                      {index === 0 || index === daily.length - 1 || index % 7 === 0
                        ? formatDay(entry.date, { month: undefined })
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>Last 30 days</p>
                  <h2>Top pages</h2>
                </div>
                <Globe2 aria-hidden="true" size={20} />
              </div>
              {data.pages.length === 0 ? (
                <EmptyState>No page views recorded yet.</EmptyState>
              ) : (
                <div className={styles.pageList}>
                  {data.pages.map((page) => (
                    <div className={styles.pageRow} key={page.pathname}>
                      <span>{page.pathname}</span>
                      <div>
                        <strong>{formatNumber(page.pageviews)}</strong>
                        <small>{formatNumber(page.visitors)} visitors</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className={styles.secondaryGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>Daily breakdown</p>
                  <h2>Visitors by day</h2>
                </div>
                <BarChart3 aria-hidden="true" size={20} />
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Visitors</th>
                      <th>Page views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...daily].reverse().map((day) => (
                      <tr key={day.date}>
                        <td>{formatDay(day.date, { year: "numeric" })}</td>
                        <td>{formatNumber(day.visitors)}</td>
                        <td>{formatNumber(day.pageviews)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>Latest activity</p>
                  <h2>Recent page visits</h2>
                </div>
                <Activity aria-hidden="true" size={20} />
              </div>
              {data.recent.length === 0 ? (
                <EmptyState>New visits will appear here.</EmptyState>
              ) : (
                <div className={styles.visitList}>
                  {data.recent.map((visit, index) => (
                    <div
                      className={styles.visitRow}
                      key={`${visit.visitedAt}-${visit.pathname}-${index}`}
                    >
                      <span className={styles.visitPulse} />
                      <div>
                        <strong>{visit.pathname}</strong>
                        <small>
                          {visit.browser} · {visit.device} · {visit.referrer}
                        </small>
                      </div>
                      <time>{formatVisitTime(visit.visitedAt)}</time>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}

      <section className={styles.securityPanel} id="security">
        <div className={styles.securityIntro}>
          <span className={styles.securityIcon}>
            <ShieldCheck aria-hidden="true" size={23} />
          </span>
          <p className={styles.eyebrow}>Account security</p>
          <h2>Change dashboard login</h2>
          <p>
            Update the username and password used to open this private
            dashboard. Your new password is securely hashed before storage.
          </p>
          <div className={styles.signedInAs}>
            <KeyRound aria-hidden="true" size={15} />
            Signed in as <strong>{session.username}</strong>
          </div>
        </div>

        <div className={styles.securityFormWrap}>
          {securityMessage ? (
            <div
              className={
                securityMessage.tone === "success"
                  ? styles.formSuccess
                  : styles.formError
              }
              role={securityMessage.tone === "success" ? "status" : "alert"}
            >
              {securityMessage.text}
            </div>
          ) : null}
          <form action={changeCredentialsAction} className={styles.securityForm}>
            <label className={styles.fullField}>
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className={styles.fullField}>
              <span>New username</span>
              <input
                name="username"
                type="text"
                defaultValue={session.username}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                minLength={3}
                maxLength={64}
                required
              />
            </label>
            <label>
              <span>New password</span>
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button type="submit" className={styles.saveButton}>
              Save new login
            </button>
          </form>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Anonymous page-view analytics only</span>
        <span>Powered by PostHog · BarData by tcfella.com</span>
      </footer>
    </main>
  );
}
