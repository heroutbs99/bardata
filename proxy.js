import { NextResponse } from "next/server";
import {
  ANALYTICS_SESSION_COOKIE,
  isAnalyticsDashboardRequest,
  isAnalyticsLoginRequest,
  readAnalyticsSession,
} from "./lib/analytics-auth";

function loginRedirect(request) {
  const url = new URL("/analytics/login", request.url);
  return NextResponse.redirect(url, request.method === "GET" ? 307 : 303);
}

export function proxy(request) {
  if (!isAnalyticsDashboardRequest(request)) {
    return NextResponse.next();
  }

  const session = readAnalyticsSession(
    request.cookies.get(ANALYTICS_SESSION_COOKIE)?.value
  );

  if (isAnalyticsLoginRequest(request)) {
    if (session && request.method === "GET") {
      return NextResponse.redirect(new URL("/analytics", request.url));
    }

    return NextResponse.next();
  }

  if (!session) {
    return loginRedirect(request);
  }

  const host = request.headers.get("host")?.split(":")[0].toLowerCase();

  if (host === "analytics.bardata.app" && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|og-image.png).*)"],
};
