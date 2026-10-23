#!/usr/bin/env node
/**
 * Test script to send high-priority FCM HTTP v1 push notification to KhanaGharTak Partner App
 * Usage: node scripts/test-partner-fcm.js <fcm_token> [role] [order_id]
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const token = process.argv[2];
const role = process.argv[3] || "restaurant";
const orderId = process.argv[4] || "test-order-" + Date.now().toString(36).toUpperCase();

if (!token) {
  console.log(`
Usage: node scripts/test-partner-fcm.js <FCM_TOKEN> [role] [order_id]

Example:
  node scripts/test-partner-fcm.js "eXYZ...123" restaurant "ord-12345"
  node scripts/test-partner-fcm.js "eXYZ...123" rider "ord-12345"
  node scripts/test-partner-fcm.js "eXYZ...123" zone_manager "ord-12345"
`);
  process.exit(1);
}

// 1. Locate Service Account
let sa = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch {}
}

if (!sa) {
  const localPath = "/Users/suryapratapsingh/Downloads/khanaghartak-cf859-firebase-adminsdk-fbsvc-ae5d92b2bb.json";
  if (fs.existsSync(localPath)) {
    sa = JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
}

if (!sa) {
  console.error("ERROR: Could not locate Firebase service account credentials.");
  process.exit(1);
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signatureInput);
  const signature = signer
    .sign(sa.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;
  const postData = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body).access_token);
          } else {
            reject(new Error(`OAuth error ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function sendTestNotification() {
  console.log(`Authenticating with Google OAuth 2.0 (Service Account: ${sa.client_email})...`);
  const accessToken = await getAccessToken();
  console.log("OAuth token obtained. Sending FCM HTTP v1 push notification...");

  const shortId = orderId.slice(0, 8).toUpperCase();
  let title = "🚨 NEW ORDER RECEIVED!";
  let body = `Order #${shortId} · ₹350 · Tap to accept!`;
  let notificationType = "NEW_ORDER";

  if (role === "rider") {
    title = "🛵 NEW DELIVERY OFFER!";
    body = `Order #${shortId} · ₹65 earning · Tap to accept delivery!`;
    notificationType = "DELIVERY_AVAILABLE";
  } else if (role === "zone_manager") {
    title = "📋 NEW ORDER IN ZONE";
    body = `Order #${shortId} requires monitoring.`;
    notificationType = "NEW_ORDER";
  }

  const payload = {
    message: {
      token,
      android: {
        priority: "HIGH",
        notification: {
          title,
          body,
          icon: "ic_notification",
          color: "#F45D2C",
          channel_id: "orders_channel_v2",
          sound: "order_siren",
          default_vibrate_timings: false,
          vibrate_timings: ["0s", "1s", "0.5s", "1s"],
          notification_priority: "PRIORITY_MAX",
        },
      },
      data: {
        order_id: String(orderId),
        role: String(role),
        notification_type: notificationType,
        sound: "order_siren",
        android_channel_id: "orders_channel_v2",
        title,
        body,
      },
    },
  };

  const bodyData = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyData),
        },
      },
      (res) => {
        let resBody = "";
        res.on("data", (chunk) => (resBody += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log("\n=======================================================");
            console.log("✅ SUCCESS! FCM HTTP v1 push delivered to Partner device!");
            console.log("FCM Message ID:", JSON.parse(resBody).name);
            console.log("Payload sent with:");
            console.log("  - Channel: orders_channel_v2");
            console.log("  - Sound: order_siren");
            console.log("  - Priority: HIGH / PRIORITY_MAX");
            console.log("  - Role:", role);
            console.log("  - Order ID:", orderId);
            console.log("=======================================================\n");
            resolve();
          } else {
            console.error("\n❌ FAILED to send FCM message!");
            console.error(`HTTP Status: ${res.statusCode}`);
            console.error(`Response: ${resBody}`);
            reject(new Error(`FCM error: ${resBody}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyData);
    req.end();
  });
}

sendTestNotification().catch((err) => {
  console.error(err);
  process.exit(1);
});
