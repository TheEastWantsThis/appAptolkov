"use client";

import {
  ArrowDown,
  ArrowUp,
  CloudOff,
  Copy,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMeasurementAction } from "@/modules/measurements/application/actions";
import { createEstimateAction } from "@/modules/estimates/application/actions";

export interface RoomDraft {
  localId: string;
  name: string;
  areaMode: "AUTO" | "MANUAL";
  length: number;
  width: number;
  area: number;
  perimeter: number;
  height: number;
  corners: number;
  canvasType: string;
  manufacturer: string;
  color: string;
  texture: string;
  profileType: string;
  profileLength: number;
  insertLength: number;
  pipes: number;
  lights: number;
  chandeliers: number;
  tracks: number;
  cornices: number;
  niches: number;
  ventilation: number;
  sensors: number;
  cabinetBypass: number;
  additionalWorks: string;
  additionalWorkUnits: number;
  complexityCoefficient: number;
  comment: string;
  photos: string[];
  drawing: string;
}

const blankRoom = (index: number): RoomDraft => ({
  localId: crypto.randomUUID(),
  name: `Помещение ${index + 1}`,
  areaMode: "AUTO",
  length: 0,
  width: 0,
  area: 0,
  perimeter: 0,
  height: 0,
  corners: 4,
  canvasType: "BASE",
  manufacturer: "",
  color: "Белый",
  texture: "Матовая",
  profileType: "BASE",
  profileLength: 0,
  insertLength: 0,
  pipes: 0,
  lights: 0,
  chandeliers: 0,
  tracks: 0,
  cornices: 0,
  niches: 0,
  ventilation: 0,
  sensors: 0,
  cabinetBypass: 0,
  additionalWorks: "",
  additionalWorkUnits: 0,
  complexityCoefficient: 1,
  comment: "",
  photos: [],
  drawing: "",
});
const numberFields = new Set<keyof RoomDraft>([
  "length",
  "width",
  "area",
  "perimeter",
  "height",
  "corners",
  "profileLength",
  "insertLength",
  "pipes",
  "lights",
  "chandeliers",
  "tracks",
  "cornices",
  "niches",
  "ventilation",
  "sensors",
  "cabinetBypass",
  "additionalWorkUnits",
  "complexityCoefficient",
]);

export function MeasurementForm({
  measurementId,
  initialRooms,
  canEdit,
  canCreateEstimate,
  completed,
}: {
  measurementId: string;
  initialRooms: RoomDraft[];
  canEdit: boolean;
  canCreateEstimate: boolean;
  completed: boolean;
}) {
  const router = useRouter();
  const storageKey = `measurement-draft:${measurementId}`;
  const [rooms, setRooms] = useState<RoomDraft[]>(
    initialRooms.length ? initialRooms : [blankRoom(0)],
  );
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed: unknown = JSON.parse(cached);
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            confirm("Найден локальный черновик. Восстановить его?")
          ) {
            setRooms(parsed as RoomDraft[]);
            setDirty(true);
          }
        } catch {
          localStorage.removeItem(storageKey);
        }
      }
      setHydrated(true);
    }, 0);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [storageKey]);

  useEffect(() => {
    if (hydrated && dirty)
      localStorage.setItem(storageKey, JSON.stringify(rooms));
  }, [rooms, dirty, hydrated, storageKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (
    index: number,
    field: keyof RoomDraft,
    value: string | number | string[],
  ) => {
    setRooms((current) =>
      current.map((room, i) => {
        if (i !== index) return room;
        const next = {
          ...room,
          [field]: numberFields.has(field) ? Number(value) || 0 : value,
        } as RoomDraft;
        if (
          next.areaMode === "AUTO" &&
          (field === "length" || field === "width" || field === "areaMode")
        ) {
          next.area = Math.round(next.length * next.width * 1000) / 1000;
          next.perimeter =
            Math.round(2 * (next.length + next.width) * 1000) / 1000;
        }
        return next;
      }),
    );
    setDirty(true);
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rooms.length) return;
    setRooms((current) => {
      const next = [...current];
      const sourceRoom = next[index];
      const targetRoom = next[target];
      if (!sourceRoom || !targetRoom) return current;
      next[index] = targetRoom;
      next[target] = sourceRoom;
      return next;
    });
    setDirty(true);
  };
  const totalArea = useMemo(
    () => rooms.reduce((sum, room) => sum + room.area, 0),
    [rooms],
  );
  const save = async (status: "DRAFT" | "IN_PROGRESS" | "COMPLETED") => {
    localStorage.setItem(storageKey, JSON.stringify(rooms));
    if (!online) {
      toast.info(
        "Черновик сохранён на устройстве и будет доступен после восстановления связи",
      );
      return;
    }
    setPending(true);
    const result = await saveMeasurementAction({
      measurementId,
      status,
      rooms,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    localStorage.removeItem(storageKey);
    setDirty(false);
    toast.success(
      status === "COMPLETED" ? "Замер завершён" : "Черновик сохранён",
    );
    router.refresh();
  };
  const createEstimate = async () => {
    setPending(true);
    const result = await createEstimateAction({
      measurementId,
      discountPercent: 0,
    });
    setPending(false);
    if (!result.ok) toast.error(result.error.message);
    else router.push(`/estimates/${result.data.id}`);
  };

  return (
    <div className="space-y-5">
      <div
        className={`flex items-center gap-2 rounded-xl p-3 text-sm ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
      >
        {online ? <Wifi className="size-4" /> : <CloudOff className="size-4" />}
        {online
          ? "Соединение доступно"
          : "Нет сети — изменения сохраняются локально"}
        {dirty ? (
          <span className="ml-auto font-bold">
            Есть несохранённые изменения
          </span>
        ) : null}
      </div>
      {rooms.map((room, index) => (
        <section
          key={room.localId}
          className="rounded-2xl border bg-white p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <Input
              value={room.name}
              onChange={(e) => update(index, "name", e.target.value)}
              disabled={!canEdit}
              className="font-bold"
            />
            {canEdit ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setRooms((r) => [
                      ...r.slice(0, index + 1),
                      {
                        ...room,
                        localId: crypto.randomUUID(),
                        name: `${room.name} копия`,
                      },
                      ...r.slice(index + 1),
                    ]);
                    setDirty(true);
                  }}
                  aria-label="Дублировать"
                >
                  <Copy />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => move(index, -1)}
                  aria-label="Выше"
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  aria-label="Ниже"
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={rooms.length === 1}
                  onClick={() => {
                    setRooms((r) => r.filter((_, i) => i !== index));
                    setDirty(true);
                  }}
                  aria-label="Удалить"
                >
                  <Trash2 />
                </Button>
              </>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Расчёт площади"
              value={room.areaMode}
              onChange={(v) => update(index, "areaMode", v)}
              disabled={!canEdit}
              options={[
                ["AUTO", "Автоматически"],
                ["MANUAL", "Вручную"],
              ]}
            />
            <Num
              label="Длина, м"
              value={room.length}
              set={(v) => update(index, "length", v)}
              disabled={!canEdit}
            />
            <Num
              label="Ширина, м"
              value={room.width}
              set={(v) => update(index, "width", v)}
              disabled={!canEdit}
            />
            <Num
              label="Площадь, м²"
              value={room.area}
              set={(v) => update(index, "area", v)}
              disabled={!canEdit || room.areaMode === "AUTO"}
            />
            <Num
              label="Периметр, м"
              value={room.perimeter}
              set={(v) => update(index, "perimeter", v)}
              disabled={!canEdit || room.areaMode === "AUTO"}
            />
            <Num
              label="Высота, м"
              value={room.height}
              set={(v) => update(index, "height", v)}
              disabled={!canEdit}
            />
            <Num
              label="Количество углов"
              value={room.corners}
              set={(v) => update(index, "corners", v)}
              disabled={!canEdit}
              step="1"
            />
            <Select
              label="Тип полотна"
              value={room.canvasType}
              onChange={(v) => update(index, "canvasType", v)}
              disabled={!canEdit}
              options={[
                ["BASE", "Базовое"],
                ["PREMIUM", "Премиум"],
              ]}
            />
            <Text
              label="Производитель"
              value={room.manufacturer}
              set={(v) => update(index, "manufacturer", v)}
              disabled={!canEdit}
            />
            <Text
              label="Цвет"
              value={room.color}
              set={(v) => update(index, "color", v)}
              disabled={!canEdit}
            />
            <Text
              label="Фактура"
              value={room.texture}
              set={(v) => update(index, "texture", v)}
              disabled={!canEdit}
            />
            <Select
              label="Тип профиля"
              value={room.profileType}
              onChange={(v) => update(index, "profileType", v)}
              disabled={!canEdit}
              options={[
                ["BASE", "Базовый"],
                ["SHADOW", "Теневой"],
              ]}
            />
            <Num
              label="Длина профиля, м"
              value={room.profileLength}
              set={(v) => update(index, "profileLength", v)}
              disabled={!canEdit}
            />
            <Num
              label="Вставка, м"
              value={room.insertLength}
              set={(v) => update(index, "insertLength", v)}
              disabled={!canEdit}
            />
            <Num
              label="Трубы, шт."
              value={room.pipes}
              set={(v) => update(index, "pipes", v)}
              disabled={!canEdit}
              step="1"
            />
            <Num
              label="Светильники, шт."
              value={room.lights}
              set={(v) => update(index, "lights", v)}
              disabled={!canEdit}
              step="1"
            />
            <Num
              label="Люстры, шт."
              value={room.chandeliers}
              set={(v) => update(index, "chandeliers", v)}
              disabled={!canEdit}
              step="1"
            />
            <Num
              label="Треки, м"
              value={room.tracks}
              set={(v) => update(index, "tracks", v)}
              disabled={!canEdit}
            />
            <Num
              label="Карнизы, м"
              value={room.cornices}
              set={(v) => update(index, "cornices", v)}
              disabled={!canEdit}
            />
            <Num
              label="Ниши, м"
              value={room.niches}
              set={(v) => update(index, "niches", v)}
              disabled={!canEdit}
            />
            <Num
              label="Вентиляция, шт."
              value={room.ventilation}
              set={(v) => update(index, "ventilation", v)}
              disabled={!canEdit}
              step="1"
            />
            <Num
              label="Датчики, шт."
              value={room.sensors}
              set={(v) => update(index, "sensors", v)}
              disabled={!canEdit}
              step="1"
            />
            <Num
              label="Обход шкафов, м"
              value={room.cabinetBypass}
              set={(v) => update(index, "cabinetBypass", v)}
              disabled={!canEdit}
            />
            <Select
              label="Сложность"
              value={String(room.complexityCoefficient)}
              onChange={(v) => update(index, "complexityCoefficient", v)}
              disabled={!canEdit}
              options={[
                ["1", "1.0"],
                ["1.2", "1.2"],
                ["1.5", "1.5"],
                ["2", "2.0"],
              ]}
            />
            <Num
              label="Единиц доп. работ"
              value={room.additionalWorkUnits}
              set={(v) => update(index, "additionalWorkUnits", v)}
              disabled={!canEdit}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextArea
              label="Дополнительные работы"
              value={room.additionalWorks}
              set={(v) => update(index, "additionalWorks", v)}
              disabled={!canEdit}
            />
            <TextArea
              label="Комментарий"
              value={room.comment}
              set={(v) => update(index, "comment", v)}
              disabled={!canEdit}
            />
            <TextArea
              label="Фотографии (ссылки, по одной в строке)"
              value={room.photos.join("\n")}
              set={(v) =>
                update(
                  index,
                  "photos",
                  v
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              disabled={!canEdit}
            />
            <Text
              label="Чертёж (ссылка)"
              value={room.drawing}
              set={(v) => update(index, "drawing", v)}
              disabled={!canEdit}
            />
          </div>
        </section>
      ))}
      <div className="rounded-2xl bg-slate-900 p-4 text-white">
        <div className="text-sm text-slate-300">
          Итого помещений: {rooms.length}
        </div>
        <div className="text-2xl font-bold">{totalArea.toFixed(2)} м²</div>
      </div>
      {canEdit ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={() => {
              setRooms((r) => [...r, blankRoom(r.length)]);
              setDirty(true);
            }}
          >
            <Plus />
            Помещение
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void save("DRAFT")}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
            Сохранить черновик
          </Button>
          <Button
            disabled={pending || !online}
            onClick={() => void save("COMPLETED")}
          >
            Завершить замер
          </Button>
        </div>
      ) : null}
      {completed && canCreateEstimate ? (
        <Button
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => void createEstimate()}
        >
          Рассчитать и создать смету
        </Button>
      ) : null}
    </div>
  );
}

function Num({
  label,
  value,
  set,
  disabled,
  step = "0.01",
}: {
  label: string;
  value: number;
  set: (v: string) => void;
  disabled: boolean;
  step?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold">
      {label}
      <Input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => set(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
function Text({
  label,
  value,
  set,
  disabled,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold">
      {label}
      <Input
        value={value}
        onChange={(e) => set(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  set,
  disabled,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold">
      {label}
      <textarea
        className="border-input min-h-20 w-full rounded-md border p-2 text-sm font-normal"
        value={value}
        onChange={(e) => set(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  disabled,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="space-y-1 text-xs font-semibold">
      {label}
      <select
        className="border-input h-10 w-full rounded-md border px-2 text-sm font-normal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
