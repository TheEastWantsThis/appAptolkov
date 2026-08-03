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

export function maskPhone(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length < 7) return "***";
  return `+${digits[0]} (***) ***-${digits.slice(-4, -2)}-${digits.slice(-2)}`;
}

export function presentPhone(value: string, canReadFullPhone: boolean): string {
  return canReadFullPhone ? value : maskPhone(value);
}
