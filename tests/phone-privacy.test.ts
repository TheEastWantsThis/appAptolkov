import { describe, expect, it } from "vitest";

import {
  maskPhone,
  normalizePhone,
  presentPhone,
} from "@/modules/leads/domain/phone";

describe("защита телефона клиента", () => {
  it("нормализует российские номера", () => {
    expect(normalizePhone("8 (999) 111-22-33")).toBe("79991112233");
    expect(normalizePhone("+7 999 111 22 33")).toBe("79991112233");
  });
  it("по умолчанию возвращает только маску", () => {
    expect(presentPhone("+7 999 111-22-33", false)).toBe("+7 (***) ***-22-33");
  });
  it("полный номер возвращается только при отдельном разрешении", () => {
    expect(presentPhone("+7 999 111-22-33", true)).toBe("+7 999 111-22-33");
  });
  it("не раскрывает короткое некорректное значение", () => {
    expect(maskPhone("123")).toBe("***");
  });
});
