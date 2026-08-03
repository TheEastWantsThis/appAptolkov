"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createRepeatInstallationAction,
  updateInstallationProgressAction,
} from "@/modules/installations/application/actions";
import {
  INSTALLATION_STATUSES,
  INSTALLATION_STATUS_LABELS,
  type InstallationStatusValue,
} from "@/modules/installations/domain/state-machine";

type Material = { name: string; quantity: number; unit: string };

export function InstallationProgressForm({
  installationId,
  initialStatus,
  initial,
}: {
  installationId: string;
  initialStatus: InstallationStatusValue;
  initial: {
    actualStartedAt: string;
    actualEndedAt: string;
    beforePhotos: string[];
    processPhotos: string[];
    afterPhotos: string[];
    usedMaterials: Material[];
    workComment: string;
    issues: string;
    responsibleSignature: string;
    accepted: boolean;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [materials, setMaterials] = useState<Material[]>(initial.usedMaterials);
  const run = async (formData: FormData) => {
    setPending(true);
    const toList = (name: string) =>
      String(formData.get(name) ?? "")
        .split(String.fromCharCode(10))
        .map((item) => item.trim())
        .filter(Boolean);
    const result = await updateInstallationProgressAction({
      installationId,
      status: formData.get("status"),
      actualStartedAt: formData.get("actualStartedAt"),
      actualEndedAt: formData.get("actualEndedAt"),
      beforePhotos: toList("beforePhotos"),
      processPhotos: toList("processPhotos"),
      afterPhotos: toList("afterPhotos"),
      usedMaterials: materials,
      workComment: formData.get("workComment"),
      issues: formData.get("issues"),
      responsibleSignature: formData.get("responsibleSignature"),
      accepted: formData.get("accepted") === "on",
    });
    setPending(false);
    if (!result.ok) return toast.error(result.error.message);
    toast.success("Ход монтажа сохранён");
    router.refresh();
  };

  return (
    <form action={(data) => void run(data)} className="space-y-5">
      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-3">
        <label className="space-y-1 sm:col-span-3">
          <span className="text-sm font-semibold">Статус</span>
          <select
            name="status"
            defaultValue={initialStatus}
            className="border-input h-11 w-full rounded-md border px-3"
          >
            {INSTALLATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INSTALLATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Фактическое начало</span>
          <Input
            name="actualStartedAt"
            type="datetime-local"
            defaultValue={initial.actualStartedAt}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Фактическое окончание</span>
          <Input
            name="actualEndedAt"
            type="datetime-local"
            defaultValue={initial.actualEndedAt}
          />
        </label>
        <label className="flex items-center gap-3 pt-6 text-sm font-semibold">
          <input
            name="accepted"
            type="checkbox"
            defaultChecked={initial.accepted}
          />
          Работа принята
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border p-4 lg:grid-cols-3">
        {[
          ["beforePhotos", "Фото до", initial.beforePhotos],
          ["processPhotos", "Фото процесса", initial.processPhotos],
          ["afterPhotos", "Фото после", initial.afterPhotos],
        ].map(([name, label, values]) => (
          <label key={String(name)} className="space-y-1">
            <span className="text-sm font-semibold">{String(label)}</span>
            <textarea
              name={String(name)}
              defaultValue={(values as string[]).join("\n")}
              placeholder="Ссылки, по одной в строке"
              className="border-input min-h-28 w-full rounded-md border p-3 text-sm"
            />
          </label>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Фактически использованные материалы</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setMaterials([
                ...materials,
                { name: "", quantity: 1, unit: "шт." },
              ])
            }
          >
            <Plus />
            Добавить
          </Button>
        </div>
        {materials.map((material, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_90px_90px_40px] gap-2"
          >
            <Input
              value={material.name}
              placeholder="Материал"
              onChange={(event) =>
                setMaterials(
                  materials.map((item, i) =>
                    i === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <Input
              value={material.quantity}
              type="number"
              min="0.001"
              step="0.001"
              onChange={(event) =>
                setMaterials(
                  materials.map((item, i) =>
                    i === index
                      ? { ...item, quantity: Number(event.target.value) }
                      : item,
                  ),
                )
              }
            />
            <Input
              value={material.unit}
              onChange={(event) =>
                setMaterials(
                  materials.map((item, i) =>
                    i === index ? { ...item, unit: event.target.value } : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setMaterials(materials.filter((_, i) => i !== index))
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </section>

      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <textarea
          name="workComment"
          defaultValue={initial.workComment}
          placeholder="Комментарий о выполненных работах"
          className="border-input min-h-28 rounded-md border p-3 text-sm"
        />
        <textarea
          name="issues"
          defaultValue={initial.issues}
          placeholder="Найденные проблемы"
          className="border-input min-h-28 rounded-md border p-3 text-sm"
        />
        <Input
          name="responsibleSignature"
          defaultValue={initial.responsibleSignature}
          placeholder="Подпись ответственного сотрудника"
          className="sm:col-span-2"
        />
      </section>
      <Button disabled={pending} size="lg" className="w-full">
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Сохранить ход монтажа
      </Button>
    </form>
  );
}

export function RepeatInstallationForm({
  installationId,
}: {
  installationId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const submit = async (data: FormData) => {
    setPending(true);
    const result = await createRepeatInstallationAction({
      installationId,
      startsAt: data.get("startsAt"),
      durationMinutes: data.get("durationMinutes"),
      allowConflicts: data.get("allowConflicts") === "on",
    });
    setPending(false);
    if (!result.ok)
      return toast.error(result.error.message, { duration: 7000 });
    toast.success("Повторный выезд создан");
    router.push("/installations/" + result.data.id);
  };
  return (
    <form
      action={(data) => void submit(data)}
      className="space-y-3 rounded-2xl border border-amber-300 p-4"
    >
      <h2 className="font-bold">Создать повторный выезд</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="startsAt" type="datetime-local" required />
        <Input
          name="durationMinutes"
          type="number"
          min="30"
          step="30"
          defaultValue="240"
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="allowConflicts" type="checkbox" />
        Подтвердить возможное пересечение календаря
      </label>
      <Button disabled={pending} variant="outline" className="w-full">
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Создать повторный выезд
      </Button>
    </form>
  );
}
