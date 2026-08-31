import { createHash, randomUUID } from "node:crypto";

import type { ValidatedTelegramIdentity } from "./auth/telegram.js";
import type { ApiConfig } from "./config.js";

/** Development-only auth bypass. Production builds remove this module after compilation. */
export function createMockTelegramIdentity(
  config: ApiConfig,
  current: Date,
): ValidatedTelegramIdentity {
  return {
    telegramId: BigInt(config.MOCK_TELEGRAM_ID),
    firstName: config.MOCK_TELEGRAM_FIRST_NAME,
    lastName: null,
    username: "watchroom_dev",
    photoUrl: null,
    authDate: current,
    replayDigest: createHash("sha256")
      .update(`mock:${config.MOCK_TELEGRAM_ID}:${current.toISOString()}:${randomUUID()}`)
      .digest("hex"),
  };
}
