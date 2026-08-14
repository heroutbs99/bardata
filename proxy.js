import { NextResponse } from "next/server";
import {
  isAnalyticsAuthorized,
  isAnalyticsDashboardRequest,
} from "./lib/analytics-auth";

function authenticationRequired() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "private, no-store",
      "WWW-Authenticate": 'Basic realm="BarData Analytics", charset="UTF-8"',
    },
  });
}

export function proxy(request) {
  if (!isAnalyticsDashboardRequest(request)) {
    return NextResponse.next();
  }

  if (!process.env.ANALYTICS_PASSWORD) {
    return new NextResponse("The analytics dashboard is not configured yet.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!isAnalyticsAuthorized(request.headers.get("authorization"))) {
    return authenticationRequired();
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
