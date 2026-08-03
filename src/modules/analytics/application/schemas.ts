import { z } from "zod";

export const analyticsFiltersSchema = z.object({
  from: z.preprocess(
    (value) => (value ? value : undefined),
    z.coerce.date().optional(),
  ),
  to: z.preprocess(
    (value) => (value ? value : undefined),
    z.coerce.date().optional(),
  ),
  source: z
    .enum(["PROMOTER", "WEBSITE", "PHONE", "REFERRAL", "OTHER"])
    .optional(),
  employeeId: z.string().uuid().optional(),
  status: z
    .enum([
      "QUALIFIED",
      "MEASUREMENT_SCHEDULED",
      "MEASURED",
      "ESTIMATE_PREPARATION",
      "CONTRACT_PENDING",
      "CONTRACT_SIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
});
