import { describe, expect, it } from "vitest";

import {
  canTransitionInstallation,
  validateInstallationCompletion,
} from "../src/modules/installations/domain/state-machine";

describe("state machine монтажа", () => {
  it("разрешает штатную последовательность", () => {
    expect(canTransitionInstallation("SCHEDULED", "CONFIRMED")).toBe(true);
    expect(canTransitionInstallation("CONFIRMED", "MATERIALS_RECEIVED")).toBe(
      true,
    );
    expect(canTransitionInstallation("EN_ROUTE", "STARTED")).toBe(true);
    expect(canTransitionInstallation("STARTED", "COMPLETED")).toBe(true);
  });

  it("запрещает перескакивать из назначенного сразу в завершённый", () => {
    expect(canTransitionInstallation("SCHEDULED", "COMPLETED")).toBe(false);
  });

  it("разрешает продолжить приостановленный монтаж", () => {
    expect(canTransitionInstallation("PAUSED", "STARTED")).toBe(true);
  });

  it("требует подтверждения завершения", () => {
    expect(
      validateInstallationCompletion({
        actualStartedAt: null,
        afterPhotos: [],
        responsibleSignature: null,
        accepted: false,
      }),
    ).toEqual([
      "время начала",
      "фотография после",
      "подпись ответственного",
      "отметка о приёмке",
    ]);
  });

  it("принимает полный комплект данных завершения", () => {
    expect(
      validateInstallationCompletion({
        actualStartedAt: new Date(),
        afterPhotos: ["https://example.test/after.jpg"],
        responsibleSignature: "Иван Монтажник",
        accepted: true,
      }),
    ).toEqual([]);
  });
});
