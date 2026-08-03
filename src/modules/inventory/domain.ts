export function calculateStockBalance(input: {
  quantity: number;
  reserved: number;
  quantityDelta: number;
  reservedDelta: number;
}) {
  const quantity = input.quantity + input.quantityDelta;
  const reserved = input.reserved + input.reservedDelta;
  if (![quantity, reserved].every(Number.isFinite))
    throw new Error("Некорректное складское значение");
  if (quantity < 0) throw new Error("Недостаточно материала на складе");
  if (reserved < 0) throw new Error("Резерв не может быть отрицательным");
  if (reserved > quantity)
    throw new Error("Резерв не может превышать фактический остаток");
  return {
    quantity: Math.round(quantity * 1000) / 1000,
    reserved: Math.round(reserved * 1000) / 1000,
    available: Math.round((quantity - reserved) * 1000) / 1000,
  };
}
