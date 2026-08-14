import { timingSafeEqual } from "node:crypto";

const DEFAULT_USERNAME = "admin";

function safelyEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
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

export function isAnalyticsAuthorized(authorizationHeader) {
  const expectedPassword = process.env.ANALYTICS_PASSWORD;
  const expectedUsername =
    process.env.ANALYTICS_USERNAME || DEFAULT_USERNAME;

  if (!expectedPassword || !authorizationHeader?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = Buffer.from(
      authorizationHeader.slice("Basic ".length),
      "base64"
    ).toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return false;
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    return (
      safelyEqual(username, expectedUsername) &&
      safelyEqual(password, expectedPassword)
    );
  } catch {
    return false;
  }
}
