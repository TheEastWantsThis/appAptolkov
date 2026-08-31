import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { validateTelegramInitData } from "./telegram.js";

const botToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG";
const now = new Date("2026-08-29T10:00:00.000Z");

function signedInitData(authDate: number): string {
  const fields = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAExampleQuery",
    user: JSON.stringify({ id: 123456789, first_name: "Анна", username: "anna" }),
  });
  const dataCheckString = [...fields.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  fields.set("hash", createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  return fields.toString();
}

describe("validateTelegramInitData", () => {
  it("accepts a fresh official HMAC signature", () => {
    const identity = validateTelegramInitData(
      signedInitData(Math.floor(now.getTime() / 1_000)),
      botToken,
      { now, maxAgeSeconds: 300, futureSkewSeconds: 30 },
    );
    expect(identity.telegramId).toBe(123456789n);
    expect(identity.firstName).toBe("Анна");
  });

  it("rejects a forged signature", () => {
    const forged = signedInitData(Math.floor(now.getTime() / 1_000)).replace(
      "first_name%22%3A%22%D0%90%D0%BD%D0%BD%D0%B0",
      "first_name%22%3A%22%D0%95%D0%B2%D0%B0",
    );
    expect(() =>
      validateTelegramInitData(forged, botToken, {
        now,
        maxAgeSeconds: 300,
        futureSkewSeconds: 30,
      }),
    ).toThrow("Подпись Telegram недействительна");
  });

  it("rejects stale auth_date", () => {
    const stale = signedInitData(Math.floor(now.getTime() / 1_000) - 301);
    expect(() =>
      validateTelegramInitData(stale, botToken, { now, maxAgeSeconds: 300, futureSkewSeconds: 30 }),
    ).toThrow("Срок действия");
  });

  it("rejects duplicate query fields", () => {
    const duplicated = `${signedInitData(Math.floor(now.getTime() / 1_000))}&auth_date=1`;
    expect(() =>
      validateTelegramInitData(duplicated, botToken, {
        now,
        maxAgeSeconds: 300,
        futureSkewSeconds: 30,
      }),
    ).toThrow("повторяющееся поле");
  });
});
