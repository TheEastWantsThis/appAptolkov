import { describe, expect, it, vi } from "vitest";

import { loadApiConfig } from "../config.js";
import { ProviderMetadataService } from "./metadata.js";

const source = {
  provider: "YOUTUBE",
  kind: "VIDEO",
  sourceId: "dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
} as const;
const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  MOCK_TELEGRAM_AUTH: "true",
};

describe("ProviderMetadataService", () => {
  it("degrades without credentials and does not fetch", async () => {
    const fetcher = vi.fn();
    const result = await new ProviderMetadataService(loadApiConfig(base), fetcher).get(source);
    expect(result.unavailableReason).toBe("CREDENTIALS_MISSING");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses only the official endpoint and caches the response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                title: "Video",
                channelTitle: "Creator",
                thumbnails: { high: { url: "https://i.ytimg.com/x.jpg" } },
              },
              status: { embeddable: true },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new ProviderMetadataService(
      loadApiConfig({ ...base, YOUTUBE_API_KEY: "test-key-12345" }),
      fetcher,
    );
    await service.get(source);
    await service.get(source);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      "https://www.googleapis.com/youtube/v3/videos",
    );
  });
});
