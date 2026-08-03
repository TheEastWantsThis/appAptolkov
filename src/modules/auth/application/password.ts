import { hash, verify, type Options } from "@node-rs/argon2";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .length(6, "Пароль должен состоять ровно из 6 символов");

const HASH_OPTIONS: Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(password: string) {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}
