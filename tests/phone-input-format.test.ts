import { describe, expect, it } from "vitest";

import { formatRussianPhoneInput } from "@/shared/domain/phone";

describe("маска российского телефона", () => {
  it("оставляет код страны в пустом поле", () => {
    expect(formatRussianPhoneInput("")).toBe("+7");
  });

  it("расставляет скобки, пробелы и тире", () => {
    expect(formatRussianPhoneInput("9991234567")).toBe("+7 (999) 123-45-67");
  });

  it("принимает вставку номера с 7 или 8", () => {
    expect(formatRussianPhoneInput("+7 999 123-45-67")).toBe(
      "+7 (999) 123-45-67",
    );
    expect(formatRussianPhoneInput("8 (999) 123-45-67")).toBe(
      "+7 (999) 123-45-67",
    );
  });

  it("не позволяет ввести больше десяти цифр после кода страны", () => {
    expect(formatRussianPhoneInput("79991234567890")).toBe(
      "+7 (999) 123-45-67",
    );
  });
});
