export function calculateStockBalance(input: {
  quantity: number;
  reserved: number;
  quantityDelta: number;
  reservedDelta: number;
  allowNegative?: boolean;
}) {
  const quantity = Number((input.quantity + input.quantityDelta).toFixed(3));
  const reserved = Number((input.reserved + input.reservedDelta).toFixed(3));
  const available = Number((quantity - reserved).toFixed(3));
  if (![quantity, reserved, available].every(Number.isFinite))
    throw new Error("Некорректное складское значение");
  if (reserved < 0) throw new Error("Резерв не может быть отрицательным");
  if (!input.allowNegative && quantity < 0)
    throw new Error("Недостаточно материала на складе");
  if (!input.allowNegative && available < 0)
    throw new Error("Резерв превышает доступный остаток");
  return { quantity, reserved, available };
}

export function requirementStatus(input: {
  required: number;
  reserved: number;
  issued: number;
  consumed: number;
  returned: number;
  writtenOff: number;
}) {
  if (
    input.writtenOff > 0 &&
    input.consumed + input.writtenOff >= input.required
  )
    return "WRITTEN_OFF" as const;
  if (input.consumed >= input.required) return "USED" as const;
  if (input.returned > 0 && input.issued <= 0) return "RETURNED" as const;
  if (input.returned > 0) return "PARTIALLY_RETURNED" as const;
  if (input.issued > 0 && input.reserved > 0)
    return "PARTIALLY_ISSUED" as const;
  if (input.issued > 0) return "ISSUED" as const;
  if (input.reserved >= input.required) return "PREPARED" as const;
  return "PLANNED" as const;
}

export function shortage(
  required: number,
  reserved: number,
  available: number,
  expected: number,
) {
  const missing = Math.max(
    0,
    Number((required - reserved - available).toFixed(3)),
  );
  return {
    missing,
    toOrder: Math.max(0, Number((missing - expected).toFixed(3))),
  };
}
