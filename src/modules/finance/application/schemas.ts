import { z } from "zod";

const money = z.coerce.number().finite().min(0).max(999_999_999);

export const updateProjectFinanceSchema = z
  .object({
    projectId: z.string().uuid(),
    version: z.coerce.number().int().min(0),
    contractAmount: money,
    discountAmount: money,
    prepayment: money,
    additionalPayments: money,
    paymentMethod: z.enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "INSTALLMENTS",
      "OTHER",
    ]),
    materialCost: money,
    installerWages: money,
    transportCost: money,
    additionalExpenses: money,
    paymentDueAt: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.date().optional(),
    ),
    paid: z.boolean(),
  })
  .refine((data) => data.discountAmount <= data.contractAmount, {
    path: ["discountAmount"],
    message: "Скидка не может превышать стоимость договора",
  });
