import {
  ArrowRight,
  BarChart3,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { loginAction } from "../actions";
import styles from "../analytics.module.css";

export const metadata = {
  title: "Sign in | BarData Analytics",
  description: "Private sign-in for BarData Analytics.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AnalyticsLoginPage({ searchParams }) {
  const params = await searchParams;
  const invalid = params?.error === "invalid";
  const signedOut = params?.signedOut === "1";

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginShell}>
        <section className={styles.loginStory}>
          <div className={styles.loginBrand}>
            <span className={styles.brandMark} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>BarData</strong>
              <span>Private analytics</span>
            </div>
          </div>

          <div className={styles.loginMessage}>
            <p className={styles.eyebrow}>Your traffic, clearly</p>
            <h1>A quiet place to see what&apos;s working.</h1>
            <p>
              Daily visitors, page views, and recent activity—without invasive
              tracking or session recordings.
            </p>
          </div>

          <div className={styles.loginBenefits}>
            <span><BarChart3 size={17} /> Simple daily reporting</span>
            <span><EyeOff size={17} /> Anonymous analytics only</span>
            <span><ShieldCheck size={17} /> Private and password protected</span>
          </div>
        </section>

        <section className={styles.loginCard}>
          <div className={styles.loginCardIcon}>
            <LockKeyhole aria-hidden="true" size={22} />
          </div>
          <p className={styles.eyebrow}>Secure access</p>
          <h2>Welcome back</h2>
          <p className={styles.loginSubtitle}>
            Sign in to your BarData analytics dashboard.
          </p>

          {invalid ? (
            <div className={styles.formError} role="alert">
              That username or password is not correct.
            </div>
          ) : null}
          {signedOut ? (
            <div className={styles.formSuccess} role="status">
              You have been securely signed out.
            </div>
          ) : null}

          <form action={loginAction} className={styles.loginForm}>
            <label>
              <span>Username</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                required
                autoFocus
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit">
              Open analytics
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>

          <p className={styles.loginFootnote}>
            Protected with an encrypted, HTTP-only session.
          </p>
        </section>
      </div>
    </main>
  );
}
