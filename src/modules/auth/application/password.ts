import { hash, verify, type Options } from "@node-rs/argon2";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Пароль должен содержать не менее 10 символов")
  .max(128, "Пароль не должен превышать 128 символов")
  .regex(/[a-zа-яё]/u, "Добавьте строчную букву")
  .regex(/[A-ZА-ЯЁ]/u, "Добавьте заглавную букву")
  .regex(/\d/u, "Добавьте цифру")
  .regex(/[^\p{L}\p{N}]/u, "Добавьте специальный символ");

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
