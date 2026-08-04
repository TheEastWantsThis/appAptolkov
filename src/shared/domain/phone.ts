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

export function formatRussianPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  const subscriber = (
    digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits
  ).slice(0, 10);

  if (subscriber.length === 0) return "+7";

  let formatted = "+7 (" + subscriber.slice(0, 3);
  if (subscriber.length >= 3) formatted += ")";
  if (subscriber.length > 3) formatted += " " + subscriber.slice(3, 6);
  if (subscriber.length > 6) formatted += "-" + subscriber.slice(6, 8);
  if (subscriber.length > 8) formatted += "-" + subscriber.slice(8, 10);
  return formatted;
}
