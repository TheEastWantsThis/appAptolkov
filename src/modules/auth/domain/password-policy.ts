import { z } from "zod";

export const clientPasswordSchema = z
  .string()
  .length(6, "Пароль должен состоять ровно из 6 символов");
