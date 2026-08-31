import { z } from "zod";

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z0-9_]+$/),
    message: z.string().min(1),
    requestId: z.string().min(1).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
