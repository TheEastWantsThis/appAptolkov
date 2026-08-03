export type TariffUnitCode =
  "M2" | "M" | "PCS" | "FIXED" | "ZONE" | "COEFFICIENT";

export interface CalculatorTariff {
  code: string;
  name: string;
  unit: TariffUnitCode;
  internalPrice: number;
  clientPrice: number;
}

export interface CalculatorRoom {
  id: string;
  name: string;
  area: number;
  perimeter: number;
  corners: number;
  canvasType?: string | null;
  profileType?: string | null;
  profileLength?: number | null;
  insertLength?: number | null;
  pipes: number;
  lights: number;
  chandeliers: number;
  tracks: number;
  cornices: number;
  niches: number;
  ventilation: number;
  sensors: number;
  cabinetBypass: number;
  additionalWorkUnits: number;
  complexityCoefficient: number;
}

export interface EstimateCalculationInput {
  rooms: readonly CalculatorRoom[];
  tariffs: readonly CalculatorTariff[];
  discountPercent?: number;
  transportZoneCode?: string;
}

export interface CalculatedLine {
  roomId: string | null;
  roomName: string | null;
  code: string;
  description: string;
  quantity: number;
  unit: TariffUnitCode;
  internalUnitPrice: number;
  clientUnitPrice: number;
  internalAmount: number;
  clientAmount: number;
}

export interface EstimateCalculation {
  lines: CalculatedLine[];
  subtotalInternal: number;
  subtotalClient: number;
  discountPercent: number;
  discountAmount: number;
  totalInternal: number;
  totalClient: number;
}

export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculatorError";
  }
}

const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const quantity = (value: number) =>
  Math.round((value + Number.EPSILON) * 1000) / 1000;

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new CalculatorError(`${label}: недопустимое значение`);
}

export function calculateRectangle(length: number, width: number) {
  assertFiniteNonNegative(length, "Длина");
  assertFiniteNonNegative(width, "Ширина");
  return {
    area: quantity(length * width),
    perimeter: quantity(2 * (length + width)),
  };
}

export function calculateEstimate(
  input: EstimateCalculationInput,
): EstimateCalculation {
  if (input.rooms.length === 0)
    throw new CalculatorError("Добавьте хотя бы одно помещение");
  const tariffMap = new Map(
    input.tariffs
      .filter((rate) => {
        assertFiniteNonNegative(
          rate.internalPrice,
          `Себестоимость ${rate.code}`,
        );
        assertFiniteNonNegative(rate.clientPrice, `Цена ${rate.code}`);
        return true;
      })
      .map((rate) => [rate.code, rate]),
  );
  const lines: CalculatedLine[] = [];

  const add = (
    room: CalculatorRoom | null,
    code: string,
    qty: number,
    fallbackCode?: string,
  ) => {
    assertFiniteNonNegative(qty, code);
    if (qty === 0) return;
    const tariff =
      tariffMap.get(code) ??
      (fallbackCode ? tariffMap.get(fallbackCode) : undefined);
    if (!tariff) throw new CalculatorError(`Не найден активный тариф ${code}`);
    lines.push({
      roomId: room?.id ?? null,
      roomName: room?.name ?? null,
      code: tariff.code,
      description: tariff.name,
      quantity: quantity(qty),
      unit: tariff.unit,
      internalUnitPrice: tariff.internalPrice,
      clientUnitPrice: tariff.clientPrice,
      internalAmount: money(qty * tariff.internalPrice),
      clientAmount: money(qty * tariff.clientPrice),
    });
  };

  for (const room of input.rooms) {
    [
      room.area,
      room.perimeter,
      room.corners,
      room.pipes,
      room.lights,
      room.chandeliers,
      room.tracks,
      room.cornices,
      room.niches,
      room.ventilation,
      room.sensors,
      room.cabinetBypass,
      room.additionalWorkUnits,
    ].forEach((value) => assertFiniteNonNegative(value, room.name));
    if (
      !Number.isFinite(room.complexityCoefficient) ||
      room.complexityCoefficient < 1
    )
      throw new CalculatorError("Коэффициент сложности не может быть меньше 1");
    const start = lines.length;
    add(room, `CANVAS_${room.canvasType || "BASE"}`, room.area, "CANVAS_BASE");
    add(
      room,
      `PROFILE_${room.profileType || "BASE"}`,
      room.profileLength ?? room.perimeter,
      "PROFILE_BASE",
    );
    add(room, "INSERT", room.insertLength ?? 0);
    add(room, "CORNER", room.corners);
    add(room, "PIPE", room.pipes);
    add(room, "LIGHT", room.lights);
    add(room, "CHANDELIER", room.chandeliers);
    add(room, "TRACK", room.tracks);
    add(room, "CORNICE", room.cornices);
    add(room, "NICHE", room.niches);
    add(room, "VENTILATION", room.ventilation);
    add(room, "SENSOR", room.sensors);
    add(room, "CABINET_BYPASS", room.cabinetBypass);
    add(room, "ADDITIONAL_WORK", room.additionalWorkUnits);

    if (room.complexityCoefficient > 1) {
      const code = `COMPLEXITY_${room.complexityCoefficient.toString().replace(".", "_")}`;
      const rate = tariffMap.get(code);
      if (!rate)
        throw new CalculatorError(
          `Не найден коэффициент сложности ${room.complexityCoefficient}`,
        );
      const roomLines = lines.slice(start);
      const baseInternal = roomLines.reduce(
        (sum, line) => sum + line.internalAmount,
        0,
      );
      const baseClient = roomLines.reduce(
        (sum, line) => sum + line.clientAmount,
        0,
      );
      lines.push({
        roomId: room.id,
        roomName: room.name,
        code: rate.code,
        description: rate.name,
        quantity: 1,
        unit: "COEFFICIENT",
        internalUnitPrice: rate.internalPrice,
        clientUnitPrice: rate.clientPrice,
        internalAmount: money(baseInternal * (rate.internalPrice - 1)),
        clientAmount: money(baseClient * (rate.clientPrice - 1)),
      });
    }
  }

  if (input.transportZoneCode) add(null, input.transportZoneCode, 1);
  let subtotalInternal = money(
    lines.reduce((sum, line) => sum + line.internalAmount, 0),
  );
  let subtotalClient = money(
    lines.reduce((sum, line) => sum + line.clientAmount, 0),
  );
  const minimum = tariffMap.get("MINIMUM");
  if (minimum && subtotalClient < minimum.clientPrice) {
    const difference = money(minimum.clientPrice - subtotalClient);
    lines.push({
      roomId: null,
      roomName: null,
      code: "MINIMUM_SURCHARGE",
      description: "Доплата до минимальной стоимости",
      quantity: 1,
      unit: "FIXED",
      internalUnitPrice: 0,
      clientUnitPrice: difference,
      internalAmount: 0,
      clientAmount: difference,
    });
    subtotalClient = minimum.clientPrice;
  }
  subtotalInternal = money(subtotalInternal);
  const discountPercent = input.discountPercent ?? 0;
  if (
    !Number.isFinite(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  )
    throw new CalculatorError("Скидка должна быть от 0 до 100%");
  const discountAmount = money((subtotalClient * discountPercent) / 100);
  return {
    lines,
    subtotalInternal,
    subtotalClient: money(subtotalClient),
    discountPercent,
    discountAmount,
    totalInternal: subtotalInternal,
    totalClient: money(subtotalClient - discountAmount),
  };
}
