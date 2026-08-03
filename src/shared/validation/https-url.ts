import { z } from "zod";

export const httpsUrlSchema = z
  .string()
  .trim()
  .url("Укажите корректную HTTPS-ссылку")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Разрешены только HTTPS-ссылки");
