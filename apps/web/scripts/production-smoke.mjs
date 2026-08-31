import { io } from "socket.io-client";

const appUrl = requiredHttps("PUBLIC_APP_URL");
const apiUrl = requiredHttps("API_URL");
const wsUrl = requiredWss("WS_URL");
const sessionCookie = process.env.SMOKE_SESSION_COOKIE;
const roomPublicId = process.env.SMOKE_ROOM_PUBLIC_ID;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredHttps(name) {
  const parsed = new URL(required(name));
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return parsed;
}

function requiredWss(name) {
  const parsed = new URL(required(name));
  if (parsed.protocol !== "wss:") throw new Error(`${name} must use WSS`);
  return parsed;
}

async function checkedFetch(label, url, assertion) {
  const startedAt = performance.now();
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  await assertion(response);
  console.log(`PASS ${label}: HTTP ${response.status}, ${elapsedMs} ms`);
}

await checkedFetch("web health", new URL("/health", appUrl), async (response) => {
  const body = await response.json();
  if (body.status !== "ok") throw new Error("web health body is not ok");
});

await checkedFetch("API liveness", new URL("/health/live", apiUrl), async (response) => {
  const body = await response.json();
  if (body.status !== "ok") throw new Error("API liveness body is not ok");
});

await checkedFetch("API readiness", new URL("/health/ready", apiUrl), async (response) => {
  const body = await response.json();
  if (body.status !== "ok" || !body.checks?.some((check) => check.name === "database"))
    throw new Error("API readiness does not confirm database");
});

await checkedFetch("web CSP", appUrl, async (response) => {
  const csp = response.headers.get("content-security-policy") ?? "";
  if (!csp.includes("frame-src") || !csp.includes("player.twitch.tv"))
    throw new Error("web CSP is missing provider frame allowlist");
});

if (roomPublicId) {
  await checkedFetch(
    "room preview",
    new URL(`/v1/rooms/${encodeURIComponent(roomPublicId)}`, apiUrl),
    async () => undefined,
  );
}

await new Promise((resolve, reject) => {
  let transportOpened = false;
  const socket = io(wsUrl.origin, {
    transports: ["websocket"],
    timeout: 10_000,
    reconnection: false,
    extraHeaders: {
      Origin: appUrl.origin,
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
  });
  const timer = setTimeout(() => {
    socket.close();
    reject(new Error("WebSocket smoke timed out"));
  }, 12_000);
  socket.io.on("open", () => {
    transportOpened = true;
  });
  socket.on("connect", () => {
    clearTimeout(timer);
    socket.close();
    console.log("PASS authenticated WSS/Socket.IO connection");
    resolve();
  });
  socket.on("connect_error", (error) => {
    clearTimeout(timer);
    socket.close();
    if (!sessionCookie && transportOpened) {
      console.log("PASS WSS transport reached authenticated Socket.IO boundary");
      resolve();
      return;
    }
    reject(new Error(`WebSocket connection failed: ${error.message}`));
  });
});

console.log(
  "Production network smoke completed. Telegram launch and provider playback remain manual device checks.",
);
