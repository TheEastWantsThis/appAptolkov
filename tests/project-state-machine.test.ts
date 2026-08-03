import { describe, expect, it } from "vitest";

import {
  canTransitionProject,
  validateProjectTransition,
} from "@/modules/projects/domain/state-machine";

const facts = {
  hasAddress: true,
  hasMeasurementEvent: true,
  hasResponsible: true,
  roomCount: 1,
  openTaskCount: 0,
};

describe("state machine проекта", () => {
  it("разрешает только объявленные переходы", () => {
    expect(canTransitionProject("QUALIFIED", "MEASUREMENT_SCHEDULED")).toBe(
      true,
    );
    expect(canTransitionProject("QUALIFIED", "COMPLETED")).toBe(false);
  });
  it("требует событие замера", () => {
    expect(
      validateProjectTransition("QUALIFIED", "MEASUREMENT_SCHEDULED", {
        ...facts,
        hasMeasurementEvent: false,
      }),
    ).toBe("Сначала назначьте дату замера");
  });
  it("требует помещения после замера", () => {
    expect(
      validateProjectTransition("MEASUREMENT_SCHEDULED", "MEASURED", {
        ...facts,
        roomCount: 0,
      }),
    ).toBe("Добавьте хотя бы одно помещение и данные замера");
  });
  it("не завершает проект с открытыми задачами", () => {
    expect(
      validateProjectTransition("IN_PROGRESS", "COMPLETED", {
        ...facts,
        openTaskCount: 1,
      }),
    ).toBe("Завершите открытые задачи проекта");
  });
  it("при выполненных условиях возвращает null", () => {
    expect(
      validateProjectTransition("IN_PROGRESS", "COMPLETED", facts),
    ).toBeNull();
  });
});
