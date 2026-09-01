import { describe, expect, it } from "vitest";

import { roomPublicIdFromTelegramStart } from "./telegram-start";

const publicId = "AbCdEf0123456789_-xyZA";

describe("roomPublicIdFromTelegramStart", () => {
  it("resolves signed and Telegram launch parameters", () => {
    expect(
      roomPublicIdFromTelegramStart({
        initData: `auth_date=1&start_param=room_${publicId}&hash=safe`,
        locationSearch: "",
        locationHash: "",
      }),
    ).toBe(publicId);
    expect(
      roomPublicIdFromTelegramStart({
        initData: "",
        locationSearch: "",
        locationHash: `#tgWebAppStartParam=room_${publicId}`,
      }),
    ).toBe(publicId);
  });

  it("uses initDataUnsafe only as a navigation hint and rejects malformed values", () => {
    expect(
      roomPublicIdFromTelegramStart({
        initData: "",
        locationSearch: "",
        locationHash: "",
        unsafeStartParam: `room_${publicId}`,
      }),
    ).toBe(publicId);
    expect(
      roomPublicIdFromTelegramStart({
        initData: "",
        locationSearch: "?startapp=room_../admin",
        locationHash: "",
      }),
    ).toBeNull();
  });
});
