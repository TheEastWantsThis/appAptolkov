export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (
    digits.length === 11 &&
    (digits.startsWith("8") || digits.startsWith("7"))
  ) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `7${digits}`;
  }
  return digits;
}

export function isValidNormalizedPhone(value: string): boolean {
  return value.length >= 10 && value.length <= 15;
}
