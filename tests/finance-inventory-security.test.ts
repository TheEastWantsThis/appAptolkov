import { describe, expect, it } from "vitest";

import { calculateProjectFinance } from "@/modules/finance/domain/calculator";
import { calculateStockBalance } from "@/modules/inventory/domain";
import { stockMovementSchema } from "@/modules/inventory/schemas";
import { httpsUrlSchema } from "@/shared/validation/https-url";

describe("финансы проекта", () => {
  it("считает остаток, себестоимость, прибыль и маржу", () => {
    expect(
      calculateProjectFinance({
        contractAmount: 100000,
        discountAmount: 5000,
        prepayment: 30000,
        additionalPayments: 20000,
        materialCost: 25000,
        installerWages: 15000,
        transportCost: 3000,
        additionalExpenses: 2000,
      }),
    ).toEqual({
      revenue: 95000,
      paid: 50000,
      balanceDue: 45000,
      overpayment: 0,
      totalCost: 45000,
      grossProfit: 50000,
      marginPercent: 52.63,
    });
  });
  it("не допускает скидку выше договора", () => {
    expect(() =>
      calculateProjectFinance({
        contractAmount: 100,
        discountAmount: 101,
        prepayment: 0,
        additionalPayments: 0,
        materialCost: 0,
        installerWages: 0,
        transportCost: 0,
        additionalExpenses: 0,
      }),
    ).toThrow("Скидка");
  });
});

describe("складские инварианты", () => {
  it("не допускает отрицательный остаток", () => {
    expect(() =>
      calculateStockBalance({
        quantity: 2,
        reserved: 0,
        quantityDelta: -3,
        reservedDelta: 0,
      }),
    ).toThrow("Недостаточно");
  });
  it("не допускает резерв выше остатка", () => {
    expect(() =>
      calculateStockBalance({
        quantity: 2,
        reserved: 0,
        quantityDelta: 0,
        reservedDelta: 3,
      }),
    ).toThrow("Резерв");
  });
});

describe("семантика движений склада", () => {
  const base = {
    itemId: "11111111-1111-4111-8111-111111111111",
    locationId: "22222222-2222-4222-8222-222222222222",
    quantity: 5,
    projectId: "",
    documentRef: "Накладная 1",
    comment: "Проверочная операция",
    allowNegative: false,
  };
  it("требует направление для корректировки", () => {
    expect(
      stockMovementSchema.safeParse({ ...base, type: "ADJUSTMENT" }).success,
    ).toBe(false);
  });
  it("запрещает перемещение в ту же локацию", () => {
    expect(
      stockMovementSchema.safeParse({
        ...base,
        type: "TRANSFER",
        toLocationId: base.locationId,
      }).success,
    ).toBe(false);
  });
  it("принимает приход с документом-основанием", () => {
    expect(
      stockMovementSchema.safeParse({ ...base, type: "RECEIPT" }).success,
    ).toBe(true);
  });
});
describe("безопасные файловые ссылки", () => {
  it("разрешает HTTPS", () => {
    expect(
      httpsUrlSchema.safeParse("https://storage.example/file.jpg").success,
    ).toBe(true);
  });
  it("отклоняет javascript и file URL", () => {
    expect(httpsUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpsUrlSchema.safeParse("file:///etc/passwd").success).toBe(false);
  });
});
