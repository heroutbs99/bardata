import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  KeyRound,
  LockKeyhole,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import {
  ANALYTICS_SESSION_COOKIE,
  readAnalyticsSession,
} from "@/lib/analytics-auth";
import { getAnalyticsData } from "@/lib/posthog-analytics";
import { changeCredentialsAction, logoutAction } from "./actions";
import AnalyticsExplorer from "./AnalyticsExplorer";
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

      <AnalyticsExplorer data={data} />

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
