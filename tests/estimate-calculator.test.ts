import { describe, expect, it } from "vitest";

import {
  CalculatorError,
  calculateEstimate,
  calculateRectangle,
  type CalculatorRoom,
  type CalculatorTariff,
} from "@/modules/estimates/domain/calculator";

const tariffs: CalculatorTariff[] = [
  {
    code: "CANVAS_BASE",
    name: "Полотно",
    unit: "M2",
    internalPrice: 300,
    clientPrice: 700,
  },
  {
    code: "PROFILE_BASE",
    name: "Профиль",
    unit: "M",
    internalPrice: 100,
    clientPrice: 250,
  },
  {
    code: "CORNER",
    name: "Угол",
    unit: "PCS",
    internalPrice: 20,
    clientPrice: 50,
  },
  {
    code: "COMPLEXITY_1_2",
    name: "Сложность",
    unit: "COEFFICIENT",
    internalPrice: 1.2,
    clientPrice: 1.2,
  },
  {
    code: "TRANSPORT_ZONE_1",
    name: "Транспорт",
    unit: "ZONE",
    internalPrice: 500,
    clientPrice: 1000,
  },
  {
    code: "MINIMUM",
    name: "Минимум",
    unit: "FIXED",
    internalPrice: 0,
    clientPrice: 15000,
  },
];
const room = (overrides: Partial<CalculatorRoom> = {}): CalculatorRoom => ({
  id: "room-1",
  name: "Комната",
  area: 12,
  perimeter: 14,
  corners: 4,
  canvasType: "BASE",
  profileType: "BASE",
  profileLength: null,
  insertLength: null,
  pipes: 0,
  lights: 0,
  chandeliers: 0,
  tracks: 0,
  cornices: 0,
  niches: 0,
  ventilation: 0,
  sensors: 0,
  cabinetBypass: 0,
  additionalWorkUnits: 0,
  complexityCoefficient: 1,
  ...overrides,
});

describe("калькулятор сметы", () => {
  it("точно рассчитывает прямоугольник", () => {
    expect(calculateRectangle(3.2, 4.5)).toEqual({
      area: 14.4,
      perimeter: 15.4,
    });
  });
  it("отклоняет отрицательные размеры", () => {
    expect(() => calculateRectangle(-1, 4)).toThrow(CalculatorError);
  });
  it("не создаёт смету без помещений", () => {
    expect(() => calculateEstimate({ rooms: [], tariffs })).toThrow(
      "Добавьте хотя бы одно помещение",
    );
  });
  it("применяет минимальную стоимость прозрачной строкой", () => {
    const result = calculateEstimate({
      rooms: [room({ area: 1, perimeter: 1, corners: 0 })],
      tariffs,
    });
    expect(result.subtotalClient).toBe(15000);
    expect(result.lines.at(-1)?.code).toBe("MINIMUM_SURCHARGE");
  });
  it("применяет коэффициент к строкам конкретного помещения", () => {
    const base = calculateEstimate({
      rooms: [room()],
      tariffs: tariffs.filter((t) => t.code !== "MINIMUM"),
    });
    const complex = calculateEstimate({
      rooms: [room({ complexityCoefficient: 1.2 })],
      tariffs: tariffs.filter((t) => t.code !== "MINIMUM"),
    });
    expect(complex.totalClient).toBeCloseTo(base.totalClient * 1.2, 2);
    expect(complex.lines.some((line) => line.code === "COMPLEXITY_1_2")).toBe(
      true,
    );
  });
  it("учитывает транспорт и скидку 100 процентов", () => {
    const result = calculateEstimate({
      rooms: [room()],
      tariffs: tariffs.filter((t) => t.code !== "MINIMUM"),
      transportZoneCode: "TRANSPORT_ZONE_1",
      discountPercent: 100,
    });
    expect(result.lines.some((line) => line.code === "TRANSPORT_ZONE_1")).toBe(
      true,
    );
    expect(result.totalClient).toBe(0);
    expect(result.totalInternal).toBeGreaterThan(0);
  });
  it("отклоняет скидку больше 100 процентов", () => {
    expect(() =>
      calculateEstimate({ rooms: [room()], tariffs, discountPercent: 100.01 }),
    ).toThrow("Скидка должна быть от 0 до 100%");
  });
  it("не считает при отсутствующем обязательном тарифе", () => {
    expect(() =>
      calculateEstimate({
        rooms: [room()],
        tariffs: tariffs.filter((t) => t.code !== "CANVAS_BASE"),
      }),
    ).toThrow("Не найден активный тариф CANVAS_BASE");
  });
  it("округляет денежные строки до копеек", () => {
    const fractional = tariffs.map((t) =>
      t.code === "CANVAS_BASE" ? { ...t, clientPrice: 1.005 } : t,
    );
    const result = calculateEstimate({
      rooms: [room({ area: 1, perimeter: 0, corners: 0 })],
      tariffs: fractional.filter((t) => t.code !== "MINIMUM"),
    });
    expect(result.lines[0]?.clientAmount).toBe(1.01);
  });
});
