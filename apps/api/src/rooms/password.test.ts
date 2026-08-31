import { argon2id, hash } from "argon2";
import { describe, expect, it } from "vitest";

import { hashRoomPassword, roomPasswordNeedsRehash, verifyRoomPassword } from "./password.js";

describe("private room passwords", () => {
  it("uses Argon2id and never stores plaintext", async () => {
    const password = "очень-секретный-пароль";
    const passwordHash = await hashRoomPassword(password);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
    await expect(verifyRoomPassword(passwordHash, password)).resolves.toBe(true);
    await expect(verifyRoomPassword(passwordHash, "wrong-password")).resolves.toBe(false);
    expect(roomPasswordNeedsRehash(passwordHash)).toBe(false);
  });

  it("rejects oversized UTF-8 passwords before hashing", async () => {
    await expect(hashRoomPassword("я".repeat(65))).rejects.toThrow("PASSWORD_TOO_LONG");
  });

  it("detects a legacy hash that needs safe upgrade after successful verification", async () => {
    const legacy = await hash("legacy-password", {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    await expect(verifyRoomPassword(legacy, "legacy-password")).resolves.toBe(true);
    expect(roomPasswordNeedsRehash(legacy)).toBe(true);
  });
});
