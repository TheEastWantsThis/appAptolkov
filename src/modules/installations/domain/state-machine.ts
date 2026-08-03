export const INSTALLATION_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "MATERIALS_RECEIVED",
  "EN_ROUTE",
  "STARTED",
  "PAUSED",
  "COMPLETED",
  "REPEAT_REQUIRED",
] as const;

export type InstallationStatusValue = (typeof INSTALLATION_STATUSES)[number];

export const INSTALLATION_STATUS_LABELS: Record<
  InstallationStatusValue,
  string
> = {
  SCHEDULED: "Назначен",
  CONFIRMED: "Подтверждён",
  MATERIALS_RECEIVED: "Материалы получены",
  EN_ROUTE: "В пути",
  STARTED: "Начат",
  PAUSED: "Приостановлен",
  COMPLETED: "Завершён",
  REPEAT_REQUIRED: "Требуется повторный выезд",
};

const TRANSITIONS: Record<
  InstallationStatusValue,
  readonly InstallationStatusValue[]
> = {
  SCHEDULED: ["CONFIRMED", "REPEAT_REQUIRED"],
  CONFIRMED: ["MATERIALS_RECEIVED", "EN_ROUTE", "REPEAT_REQUIRED"],
  MATERIALS_RECEIVED: ["EN_ROUTE", "REPEAT_REQUIRED"],
  EN_ROUTE: ["STARTED", "REPEAT_REQUIRED"],
  STARTED: ["PAUSED", "COMPLETED", "REPEAT_REQUIRED"],
  PAUSED: ["STARTED", "REPEAT_REQUIRED"],
  COMPLETED: ["REPEAT_REQUIRED"],
  REPEAT_REQUIRED: [],
};

export function canTransitionInstallation(
  from: InstallationStatusValue,
  to: InstallationStatusValue,
) {
  return from === to || TRANSITIONS[from].includes(to);
}

export function validateInstallationCompletion(input: {
  actualStartedAt: Date | null;
  afterPhotos: readonly string[];
  responsibleSignature: string | null;
  accepted: boolean;
}) {
  const missing: string[] = [];
  if (!input.actualStartedAt) missing.push("время начала");
  if (input.afterPhotos.length === 0) missing.push("фотография после");
  if (!input.responsibleSignature?.trim())
    missing.push("подпись ответственного");
  if (!input.accepted) missing.push("отметка о приёмке");
  return missing;
}
