"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ANALYTICS_SESSION_COOKIE,
  analyticsSessionCookieOptions,
  createAnalyticsSession,
  readAnalyticsSession,
} from "@/lib/analytics-auth";
import {
  saveAnalyticsCredentials,
  verifyAnalyticsCredentials,
} from "@/lib/analytics-credentials";

async function setSession(credential) {
  const cookieStore = await cookies();
  cookieStore.set(
    ANALYTICS_SESSION_COOKIE,
    createAnalyticsSession(credential),
    analyticsSessionCookieOptions()
  );
}

async function currentSession() {
  const cookieStore = await cookies();
  return readAnalyticsSession(cookieStore.get(ANALYTICS_SESSION_COOKIE)?.value);
}

export async function loginAction(formData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const credential = await verifyAnalyticsCredentials(username, password);

  if (!credential) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    redirect("/analytics/login?error=invalid");
  }

  await setSession(credential);
  redirect("/analytics");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.set(ANALYTICS_SESSION_COOKIE, "", {
    ...analyticsSessionCookieOptions(),
    maxAge: 0,
  });
  redirect("/analytics/login?signedOut=1");
}

export async function changeCredentialsAction(formData) {
  const session = await currentSession();

  if (!session) {
    redirect("/analytics/login");
  }

  const currentPassword = String(formData.get("currentPassword") || "");
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("newPassword") || "");
  const confirmation = String(formData.get("confirmPassword") || "");

  if (!/^[A-Za-z0-9._@-]{3,64}$/.test(username)) {
    redirect("/analytics?security=invalid-username#security");
  }

  if (password.length < 12 || password.length > 128) {
    redirect("/analytics?security=invalid-password#security");
  }

  if (password !== confirmation) {
    redirect("/analytics?security=password-mismatch#security");
  }

  const currentCredential = await verifyAnalyticsCredentials(
    session.username,
    currentPassword
  );

  if (!currentCredential) {
    redirect("/analytics?security=current-password#security");
  }

  let credential;

  try {
    credential = await saveAnalyticsCredentials({ username, password });
  } catch (error) {
    console.error("Analytics credential update failed.", error);
    redirect("/analytics?security=storage-error#security");
  }

  await setSession(credential);
  redirect("/analytics?security=saved#security");
}
