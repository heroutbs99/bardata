import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
import { getAnalyticsAuthSecret, safelyEqual } from "./analytics-auth";

const CREDENTIAL_EVENT = "bardata_analytics_credentials_changed";
const CREDENTIAL_DISTINCT_ID = "bardata-analytics-auth";
const DEFAULT_USERNAME = "admin";
const scrypt = promisify(scryptCallback);

function privateApiHost() {
  return (
    process.env.POSTHOG_API_HOST ||
    (process.env.NEXT_PUBLIC_POSTHOG_HOST || "")
      .replace("https://us.i.posthog.com", "https://us.posthog.com")
      .replace("https://eu.i.posthog.com", "https://eu.posthog.com")
  ).replace(/\/$/, "");
}

function credentialPayload({ username, passwordHash, version }) {
  return JSON.stringify([username, passwordHash, version]);
}

function signCredential(credential) {
  const secret = getAnalyticsAuthSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret)
    .update(credentialPayload(credential))
    .digest("base64url");
}

function isSignedCredential(credential) {
  return (
    credential.username &&
    credential.passwordHash &&
    credential.version &&
    credential.signature &&
    safelyEqual(credential.signature, signCredential(credential))
  );
}

async function queryStoredCredentials() {
  const apiHost = privateApiHost();
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;

  if (!apiHost || !projectId || !personalApiKey || !getAnalyticsAuthSecret()) {
    return [];
  }

  const response = await fetch(
    `${apiHost}/api/projects/${encodeURIComponent(projectId)}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT
              toString(properties.username),
              toString(properties.password_hash),
              toString(properties.version),
              toString(properties.credential_signature)
            FROM events
            WHERE event = '${CREDENTIAL_EVENT}'
            ORDER BY timestamp DESC
            LIMIT 50
            -- bypass credential cache ${Date.now()}
          `,
        },
        name: "BarData analytics credential lookup",
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Credential lookup failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function environmentCredential() {
  const password = process.env.ANALYTICS_PASSWORD;

  if (!password) {
    return null;
  }

  return {
    username: process.env.ANALYTICS_USERNAME || DEFAULT_USERNAME,
    password,
    version: "environment-v1",
    source: "environment",
  };
}

export async function getCurrentAnalyticsCredential() {
  try {
    const rows = await queryStoredCredentials();

    for (const [username, passwordHash, version, signature] of rows) {
      const credential = {
        username: String(username),
        passwordHash: String(passwordHash),
        version: String(version),
        signature: String(signature),
        source: "stored",
      };

      if (isSignedCredential(credential)) {
        return credential;
      }
    }
  } catch (error) {
    console.error("Analytics credential lookup failed.", error);
  }

  return environmentCredential();
}

async function verifyScryptPassword(password, storedHash) {
  const [, salt, expectedHash] = storedHash.split("$");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = await scrypt(password, Buffer.from(salt, "base64url"), 64);
  return safelyEqual(actualHash.toString("base64url"), expectedHash);
}

export async function verifyAnalyticsCredentials(username, password) {
  const credential = await getCurrentAnalyticsCredential();

  if (!credential || !safelyEqual(username, credential.username)) {
    return null;
  }

  const passwordMatches =
    credential.source === "stored"
      ? await verifyScryptPassword(password, credential.passwordHash)
      : safelyEqual(password, credential.password);

  return passwordMatches ? credential : null;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);

  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function saveAnalyticsCredentials({ username, password }) {
  const ingestionHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "").replace(
    /\/$/,
    ""
  );
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!ingestionHost || !projectToken || !getAnalyticsAuthSecret()) {
    throw new Error("Analytics credential storage is not configured.");
  }

  const credential = {
    username,
    passwordHash: await hashPassword(password),
    version: `${Date.now()}-${randomBytes(8).toString("hex")}`,
  };
  const signature = signCredential(credential);
  const response = await fetch(`${ingestionHost}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: projectToken,
      event: CREDENTIAL_EVENT,
      properties: {
        distinct_id: CREDENTIAL_DISTINCT_ID,
        username: credential.username,
        password_hash: credential.passwordHash,
        version: credential.version,
        credential_signature: signature,
        $process_person_profile: false,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Credential update failed with status ${response.status}.`);
  }

  return credential;
}
