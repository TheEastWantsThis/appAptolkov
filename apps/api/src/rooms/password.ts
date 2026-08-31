import { argon2id, hash, needsRehash, verify } from "argon2";

const maxPasswordBytes = 128;

function assertPasswordSize(password: string): void {
  if (Buffer.byteLength(password, "utf8") > maxPasswordBytes) {
    throw new Error("PASSWORD_TOO_LONG");
  }
}

export async function hashRoomPassword(password: string): Promise<string> {
  assertPasswordSize(password);
  return hash(password, {
    type: argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });
}

export async function verifyRoomPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    assertPasswordSize(password);
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

export function roomPasswordNeedsRehash(hashValue: string): boolean {
  try {
    return needsRehash(hashValue, {
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  } catch {
    return false;
  }
}
