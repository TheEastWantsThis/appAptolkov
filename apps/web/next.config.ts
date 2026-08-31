import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const websocketUrl = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl.replace(/^http/, "ws");
const twitchParentDomains = (process.env.NEXT_PUBLIC_TWITCH_PARENT_DOMAINS ?? "localhost")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const apiOrigin = new URL(apiUrl).origin;
const websocketOrigin = new URL(websocketUrl).origin;
if (process.env.WATCHROOM_DEPLOYMENT === "production") {
  const app = new URL(publicAppUrl);
  const api = new URL(apiUrl);
  const socket = new URL(websocketUrl);
  if (app.protocol !== "https:" || api.protocol !== "https:" || socket.protocol !== "wss:")
    throw new Error("Production WatchRoom requires HTTPS app/API and WSS realtime URLs");
  if (api.hostname !== socket.hostname)
    throw new Error("NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL must use the same hostname");
  if (!twitchParentDomains.includes(app.hostname))
    throw new Error("NEXT_PUBLIC_TWITCH_PARENT_DOMAINS must include the public app hostname");
  if (
    twitchParentDomains.some(
      (domain) =>
        !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
          domain,
        ),
    )
  )
    throw new Error("Twitch parent entries must be hostnames without scheme, port or wildcard");
}
const developmentScriptPolicy = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const upgradePolicy = process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";
const contentSecurityPolicy =
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${developmentScriptPolicy} https://telegram.org https://www.youtube.com https://s.ytimg.com https://player.twitch.tv`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com https://static-cdn.jtvnw.net https://*.twitch.tv https://*.telegram.org",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${websocketOrigin}`,
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.twitch.tv",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
  ].join("; ") + upgradePolicy;

const standaloneOutput =
  process.env.VERCEL === "1"
    ? {}
    : {
        output: "standalone" as const,
        outputFileTracingRoot: path.join(currentDirectory, "../.."),
      };

const nextConfig: NextConfig = {
  ...standaloneOutput,
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@watchroom/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Permissions-Policy",
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), web-share=(self), clipboard-write=(self), autoplay=(self "https://www.youtube.com" "https://player.twitch.tv"), fullscreen=(self "https://www.youtube.com" "https://player.twitch.tv"), picture-in-picture=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
