export const PROJECT_STATUSES = [
  "QUALIFIED",
  "MEASUREMENT_SCHEDULED",
  "MEASURED",
  "ESTIMATE_PREPARATION",
  "CONTRACT_PENDING",
  "CONTRACT_SIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ProjectStatusCode = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatusCode, string> = {
  QUALIFIED: "Квалифицирован",
  MEASUREMENT_SCHEDULED: "Замер назначен",
  MEASURED: "Замер выполнен",
  ESTIMATE_PREPARATION: "Подготовка сметы",
  CONTRACT_PENDING: "Ожидает договора",
  CONTRACT_SIGNED: "Договор подписан",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

const TRANSITIONS: Record<ProjectStatusCode, readonly ProjectStatusCode[]> = {
  QUALIFIED: ["MEASUREMENT_SCHEDULED", "CANCELLED"],
  MEASUREMENT_SCHEDULED: ["MEASURED", "QUALIFIED", "CANCELLED"],
  MEASURED: ["ESTIMATE_PREPARATION", "CANCELLED"],
  ESTIMATE_PREPARATION: ["CONTRACT_PENDING", "MEASURED", "CANCELLED"],
  CONTRACT_PENDING: ["CONTRACT_SIGNED", "ESTIMATE_PREPARATION", "CANCELLED"],
  CONTRACT_SIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["QUALIFIED"],
};

export function canTransitionProject(
  from: ProjectStatusCode,
  to: ProjectStatusCode,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface ProjectTransitionFacts {
  hasAddress: boolean;
  hasMeasurementEvent: boolean;
  hasResponsible: boolean;
  roomCount: number;
  openTaskCount: number;
  hasFinancialSettlement: boolean;
  incompleteInstallationCount: number;
}

export function validateProjectTransition(
  from: ProjectStatusCode,
  to: ProjectStatusCode,
  facts: ProjectTransitionFacts,
): string | null {
  if (!canTransitionProject(from, to)) return "Недопустимый переход статуса";
  if (to === "MEASUREMENT_SCHEDULED" && !facts.hasMeasurementEvent)
    return "Сначала назначьте дату замера";
  if (to === "MEASURED" && facts.roomCount === 0)
    return "Добавьте хотя бы одно помещение и данные замера";
  if (to === "CONTRACT_SIGNED" && !facts.hasAddress)
    return "Для договора обязателен адрес проекта";
  if (to === "IN_PROGRESS" && !facts.hasResponsible)
    return "Назначьте ответственного за проект";
  if (to === "COMPLETED" && facts.openTaskCount > 0)
    return "Завершите открытые задачи проекта";
  if (to === "COMPLETED" && facts.incompleteInstallationCount > 0)
    return "Завершите все монтажи проекта";
  if (to === "COMPLETED" && !facts.hasFinancialSettlement)
    return "Закройте оплату и финансовые условия проекта";
  return null;
}
