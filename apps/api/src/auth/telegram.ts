import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { AppError } from "../errors.js";

const TelegramUserSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  first_name: z.string().trim().min(1).max(64),
  last_name: z.string().trim().max(64).optional(),
  username: z.string().trim().max(32).optional(),
  photo_url: z.string().url().startsWith("https://").max(2048).optional(),
});

export interface ValidatedTelegramIdentity {
  telegramId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  authDate: Date;
  replayDigest: string;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    throw new AppError(400, "INVALID_INIT_DATA", "Некорректный формат Telegram initData.");
  }
}

function parseStrictQuery(raw: string): Map<string, string> {
  if (!raw || raw.length > 16_384) {
    throw new AppError(400, "INVALID_INIT_DATA", "Некорректный Telegram initData.");
  }

  const values = new Map<string, string>();
  for (const part of raw.split("&")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      throw new AppError(400, "INVALID_INIT_DATA", "Некорректный формат Telegram initData.");
    }
    const key = decode(part.slice(0, separator));
    if (values.has(key)) {
      throw new AppError(
        400,
        "DUPLICATE_INIT_DATA_FIELD",
        "Telegram initData содержит повторяющееся поле.",
      );
    }
    values.set(key, decode(part.slice(separator + 1)));
  }
  return values;
}

export function validateTelegramInitData(
  raw: string,
  botToken: string,
  options: { now?: Date; maxAgeSeconds: number; futureSkewSeconds: number },
): ValidatedTelegramIdentity {
  const values = parseStrictQuery(raw);
  const receivedHash = values.get("hash");
  if (!receivedHash || !/^[0-9a-f]{64}$/i.test(receivedHash)) {
    throw new AppError(401, "INVALID_TELEGRAM_SIGNATURE", "Подпись Telegram недействительна.");
  }

  const dataCheckString = [...values.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actualHash = Buffer.from(receivedHash, "hex");
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
    throw new AppError(401, "INVALID_TELEGRAM_SIGNATURE", "Подпись Telegram недействительна.");
  }

  const authDateRaw = values.get("auth_date");
  if (!authDateRaw || !/^\d{1,12}$/.test(authDateRaw)) {
    throw new AppError(401, "INVALID_AUTH_DATE", "Telegram auth_date отсутствует или некорректен.");
  }
  const authDateSeconds = Number(authDateRaw);
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1_000);
  if (authDateSeconds < nowSeconds - options.maxAgeSeconds) {
    throw new AppError(401, "EXPIRED_INIT_DATA", "Срок действия Telegram initData истёк.");
  }
  if (authDateSeconds > nowSeconds + options.futureSkewSeconds) {
    throw new AppError(401, "FUTURE_AUTH_DATE", "Telegram auth_date находится в будущем.");
  }

  const userRaw = values.get("user");
  if (!userRaw) {
    throw new AppError(401, "MISSING_TELEGRAM_USER", "Telegram не передал данные пользователя.");
  }
  let userValue: unknown;
  try {
    userValue = JSON.parse(userRaw);
  } catch {
    throw new AppError(400, "INVALID_TELEGRAM_USER", "Данные пользователя Telegram повреждены.");
  }
  const parsedUser = TelegramUserSchema.safeParse(userValue);
  if (!parsedUser.success) {
    throw new AppError(400, "INVALID_TELEGRAM_USER", "Данные пользователя Telegram некорректны.");
  }

  return {
    telegramId: BigInt(parsedUser.data.id),
    firstName: parsedUser.data.first_name,
    lastName: parsedUser.data.last_name ?? null,
    username: parsedUser.data.username ?? null,
    photoUrl: parsedUser.data.photo_url ?? null,
    authDate: new Date(authDateSeconds * 1_000),
    replayDigest: createHash("sha256").update(raw).digest("hex"),
  };
}
