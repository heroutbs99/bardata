import { createHmac, timingSafeEqual } from "node:crypto";

export const ANALYTICS_SESSION_COOKIE = "bardata_analytics_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export function safelyEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAnalyticsAuthSecret() {
  return process.env.ANALYTICS_AUTH_SECRET || process.env.ANALYTICS_PASSWORD || "";
}

function signSessionPayload(payload) {
  const secret = getAnalyticsAuthSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAnalyticsSession({ username, version }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      username,
      version,
      issuedAt: now,
      expiresAt: now + SESSION_DURATION_SECONDS,
    })
  ).toString("base64url");
  const signature = signSessionPayload(payload);

  return signature ? `${payload}.${signature}` : "";
}

export function readAnalyticsSession(value) {
  if (!value || !getAnalyticsAuthSecret()) {
    return null;
  }

  try {
    const [payload, signature, extra] = value.split(".");

    if (!payload || !signature || extra || !safelyEqual(signature, signSessionPayload(payload))) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (
      typeof parsed.username !== "string" ||
      typeof parsed.version !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function analyticsSessionCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.ANALYTICS_ALLOW_INSECURE_COOKIE !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function isAnalyticsDashboardRequest(request) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  const pathname = request.nextUrl.pathname;

  return (
    host === "analytics.bardata.app" ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/")
  );
}

export function isAnalyticsLoginRequest(request) {
  return request.nextUrl.pathname === "/analytics/login";
}
