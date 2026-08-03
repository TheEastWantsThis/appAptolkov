import { describe, expect, it } from "vitest";

import {
  LOGIN_LOCK_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
  nextLoginUnlockTime,
  shouldLockLogin,
} from "@/modules/auth/application/login-protection";

describe("защита входа от перебора", () => {
  it("блокирует вход после установленного количества ошибок", () => {
    expect(shouldLockLogin(MAX_FAILED_LOGIN_ATTEMPTS - 1)).toBe(false);
    expect(shouldLockLogin(MAX_FAILED_LOGIN_ATTEMPTS)).toBe(true);
  });

  it("назначает блокировку на пятнадцать минут", () => {
    const now = new Date("2026-08-03T14:00:00.000Z");
    expect(nextLoginUnlockTime(now).getTime() - now.getTime()).toBe(
      LOGIN_LOCK_MINUTES * 60 * 1000,
    );
  });
});
