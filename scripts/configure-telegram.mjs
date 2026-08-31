const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.PUBLIC_APP_URL;
const apiUrl = process.env.API_URL;
const menuText = process.env.TELEGRAM_MENU_TEXT ?? "Открыть WatchRoom";
const appShortName = process.env.TELEGRAM_APP_SHORT_NAME;
const smokeRoomPublicId = process.env.SMOKE_ROOM_PUBLIC_ID;

function required(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function httpsUrl(name, value) {
  const parsed = new URL(required(name, value));
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return parsed;
}

const parsedAppUrl = httpsUrl("PUBLIC_APP_URL", appUrl);
const parsedApiUrl = httpsUrl("API_URL", apiUrl);
required("TELEGRAM_BOT_TOKEN", token);
required("TELEGRAM_WEBHOOK_SECRET", webhookSecret);
if (webhookSecret.length < 32) throw new Error("TELEGRAM_WEBHOOK_SECRET must be at least 32 chars");

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true)
    throw new Error(`Telegram ${method} failed: ${payload.description ?? response.status}`);
  return payload.result;
}

const bot = await telegram("getMe");
if (!bot.username) throw new Error("Telegram bot has no username");

await telegram("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: menuText.slice(0, 64),
    web_app: { url: parsedAppUrl.href.replace(/\/$/, "") },
  },
});

await telegram("setWebhook", {
  url: new URL("/v1/telegram/webhook", parsedApiUrl).href,
  secret_token: webhookSecret,
  allowed_updates: ["message"],
});

const base = appShortName
  ? `https://t.me/${bot.username}/${appShortName}`
  : `https://t.me/${bot.username}`;
const start = smokeRoomPublicId ? `room_${smokeRoomPublicId}` : "room_<publicId>";
console.log("Telegram menu button and webhook configured without exposing credentials.");
console.log(
  "Main Mini App still requires an explicit @BotFather configuration to:",
  parsedAppUrl.href,
);
console.log("Direct link:", `${base}?startapp=${start}`);
console.log("Compact link:", `${base}?startapp=${start}&mode=compact`);
