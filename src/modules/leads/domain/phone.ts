import { normalizePhone } from "@/shared/domain/phone";

export { normalizePhone } from "@/shared/domain/phone";

export function maskPhone(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length < 7) return "***";
  return `+${digits[0]} (***) ***-${digits.slice(-4, -2)}-${digits.slice(-2)}`;
}

export function presentPhone(value: string, canReadFullPhone: boolean): string {
  return canReadFullPhone ? value : maskPhone(value);
}
