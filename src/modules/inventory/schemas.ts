import { z } from "zod";

export const createInventoryItemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(255),
  unit: z.string().trim().min(1).max(32),
  quantity: z.coerce.number().min(0).max(999_999_999),
  minimumQuantity: z.coerce.number().min(0).max(999_999_999),
});

export const adjustInventorySchema = z
  .object({
    itemId: z.string().uuid(),
    version: z.coerce.number().int().positive(),
    type: z.enum([
      "RECEIPT",
      "CONSUMPTION",
      "RESERVATION",
      "RELEASE",
      "ADJUSTMENT",
    ]),
    quantityDelta: z.coerce.number().min(-999_999_999).max(999_999_999),
    reservedDelta: z.coerce.number().min(-999_999_999).max(999_999_999),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((data, context) => {
    if (data.quantityDelta === 0 && data.reservedDelta === 0) {
      context.addIssue({
        code: "custom",
        message: "Укажите изменение остатка или резерва",
      });
    }
    const invalid =
      (data.type === "RECEIPT" &&
        (data.quantityDelta <= 0 || data.reservedDelta !== 0)) ||
      (data.type === "CONSUMPTION" &&
        (data.quantityDelta >= 0 || data.reservedDelta !== 0)) ||
      (data.type === "RESERVATION" &&
        (data.reservedDelta <= 0 || data.quantityDelta !== 0)) ||
      (data.type === "RELEASE" &&
        (data.reservedDelta >= 0 || data.quantityDelta !== 0));
    if (invalid) {
      context.addIssue({
        code: "custom",
        message:
          "Знак и поле изменения не соответствуют выбранному типу движения",
      });
    }
  });
