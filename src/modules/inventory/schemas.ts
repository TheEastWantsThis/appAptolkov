import { z } from "zod";

const code = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((value) => value.toUpperCase());
const id = z.string().uuid();
const amount = z.coerce.number().positive().max(999_999_999);
const optionalId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  id.optional(),
);

export const createCategorySchema = z.object({
  code,
  name: z.string().trim().min(2).max(200),
  parentId: optionalId,
});
export const createUnitSchema = z.object({
  code,
  name: z.string().trim().min(2).max(100),
  symbol: z.string().trim().min(1).max(32),
  precision: z.coerce.number().int().min(0).max(3),
});
export const createLocationSchema = z.object({
  code,
  name: z.string().trim().min(2).max(200),
  address: z.string().trim().max(500).optional(),
});
export const createSupplierSchema = z.object({
  code,
  name: z.string().trim().min(2).max(255),
  contactPerson: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().email().max(254).optional(),
  ),
  comment: z.string().trim().max(1000).optional(),
});
export const createSupplierPriceSchema = z.object({
  supplierId: id,
  itemId: id,
  price: z.coerce.number().nonnegative().max(999_999_999),
  currency: z.string().trim().length(3).default("RUB"),
});
export const createInventoryItemSchema = z.object({
  code,
  name: z.string().trim().min(2).max(255),
  unitId: id,
  categoryId: optionalId,
  defaultLocationId: id,
  minimumQuantity: z.coerce.number().nonnegative().max(999_999_999),
  purchasePrice: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative().optional(),
  ),
});
export const archiveInventoryItemSchema = z.object({
  itemId: id,
  archived: z.boolean(),
});

export const stockMovementSchema = z
  .object({
    itemId: id,
    locationId: id,
    toLocationId: optionalId,
    type: z.enum(["RECEIPT", "WRITE_OFF", "ADJUSTMENT", "TRANSFER"]),
    quantity: amount,
    adjustmentDirection: z.enum(["INCREASE", "DECREASE"]).optional(),
    projectId: optionalId,
    documentRef: z.string().trim().max(255).optional(),
    comment: z.string().trim().min(3).max(500),
    allowNegative: z.coerce.boolean().default(false),
  })
  .superRefine((data, context) => {
    if (
      data.type === "TRANSFER" &&
      (!data.toLocationId || data.toLocationId === data.locationId)
    )
      context.addIssue({
        code: "custom",
        message: "Выберите другую локацию назначения",
      });
    if (data.type === "ADJUSTMENT" && !data.adjustmentDirection)
      context.addIssue({
        code: "custom",
        message: "Укажите направление корректировки",
      });
  });

export const createRequirementSchema = z.object({
  projectId: id,
  roomId: optionalId,
  estimateId: optionalId,
  installationId: optionalId,
  itemId: id,
  required: amount,
});
export const generateRequirementsSchema = z.object({
  projectId: id,
  estimateId: id,
  installationId: optionalId,
});
export const reserveRequirementSchema = z.object({
  requirementId: id,
  locationId: id,
  quantity: amount,
});
export const requirementOperationSchema = z.object({
  requirementId: id,
  reservationId: optionalId,
  quantity: amount,
  comment: z.string().trim().min(3).max(500),
  documentRef: z.string().trim().max(255).optional(),
  operation: z.enum(["RELEASE", "ISSUE", "RETURN", "CONSUMPTION", "WRITE_OFF"]),
});
export const createPurchaseOrderSchema = z.object({
  number: z.string().trim().min(2).max(64),
  supplierId: id,
  itemId: id,
  ordered: amount,
  unitPrice: z.coerce.number().nonnegative(),
  expectedAt: z.coerce.date(),
  documentRef: z.string().trim().max(255).optional(),
  comment: z.string().trim().max(1000).optional(),
});

// Совместимое имя для старых импортов тестов.
export const adjustInventorySchema = stockMovementSchema;
