import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

const isAnalyticsDashboard =
  window.location.hostname === "analytics.bardata.app" ||
  window.location.pathname.startsWith("/analytics");

if (projectToken && apiHost && !isAnalyticsDashboard) {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: "history_change",
    capture_pageleave: false,
    disable_session_recording: true,
    person_profiles: "never",
    persistence: "localStorage+cookie",
    secure_cookie: window.location.protocol === "https:",
  });
}
