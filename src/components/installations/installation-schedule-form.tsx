"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scheduleInstallationAction } from "@/modules/installations/application/actions";

type Option = { id: string; name: string };
type ProjectOption = { id: string; number: string; address: string };

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(String.fromCharCode(10))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function InstallationScheduleForm({
  projects,
  installers,
  initialProjectId,
}: {
  projects: readonly ProjectOption[];
  installers: readonly Option[];
  initialProjectId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [foremanId, setForemanId] = useState("");
  const submit = async (formData: FormData) => {
    setPending(true);
    const result = await scheduleInstallationAction({
      projectId: formData.get("projectId"),
      startsAt: formData.get("startsAt"),
      durationMinutes: formData.get("durationMinutes"),
      installerIds: selected,
      foremanId,
      vehicle: formData.get("vehicle"),
      schedulerComment: formData.get("schedulerComment"),
      plannedMaterials: lines(formData.get("plannedMaterials")),
      plannedTools: lines(formData.get("plannedTools")),
      technicalBrief: formData.get("technicalBrief"),
      specialConditions: formData.get("specialConditions"),
      crewComment: formData.get("crewComment"),
      allowConflicts: formData.get("allowConflicts") === "on",
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message, { duration: 7000 });
      return;
    }
    toast.success("Монтаж назначен");
    router.push("/installations/" + result.data.id);
    router.refresh();
  };

  return (
    <form action={(data) => void submit(data)} className="space-y-5">
      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-semibold">Проект</span>
          <select
            name="projectId"
            defaultValue={initialProjectId ?? ""}
            required
            className="border-input h-11 w-full rounded-md border px-3"
          >
            <option value="">Выберите проект</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.number} · {project.address}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Дата и время</span>
          <Input name="startsAt" type="datetime-local" required />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Продолжительность, мин.</span>
          <Input
            name="durationMinutes"
            type="number"
            min="30"
            max="1440"
            step="30"
            defaultValue="240"
            required
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border p-4">
        <h2 className="font-bold">Монтажная бригада</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {installers.map((installer) => (
            <label
              key={installer.id}
              className="flex min-h-11 items-center gap-3 rounded-xl border px-3"
            >
              <input
                type="checkbox"
                checked={selected.includes(installer.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, installer.id]
                    : selected.filter((id) => id !== installer.id);
                  setSelected(next);
                  if (!next.includes(foremanId)) setForemanId(next[0] ?? "");
                }}
              />
              <span className="text-sm font-medium">{installer.name}</span>
            </label>
          ))}
        </div>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Ответственный бригадир</span>
          <select
            value={foremanId}
            onChange={(event) => setForemanId(event.target.value)}
            className="border-input h-11 w-full rounded-md border px-3"
            required
          >
            <option value="">Выберите бригадира</option>
            {installers
              .filter((installer) => selected.includes(installer.id))
              .map((installer) => (
                <option key={installer.id} value={installer.id}>
                  {installer.name}
                </option>
              ))}
          </select>
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <Input name="vehicle" placeholder="Транспорт" />
        <Input name="schedulerComment" placeholder="Комментарий диспетчера" />
        <label className="space-y-1">
          <span className="text-sm font-semibold">
            Материалы, по одному в строке
          </span>
          <textarea
            name="plannedMaterials"
            className="border-input min-h-28 w-full rounded-md border p-3 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">
            Инструменты, по одному в строке
          </span>
          <textarea
            name="plannedTools"
            className="border-input min-h-28 w-full rounded-md border p-3 text-sm"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-semibold">Техническое задание</span>
          <textarea
            name="technicalBrief"
            required
            className="border-input min-h-32 w-full rounded-md border p-3 text-sm"
          />
        </label>
        <Input name="specialConditions" placeholder="Особые условия" />
        <Input
          name="crewComment"
          placeholder="Внутренний комментарий бригаде"
        />
      </section>

      <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <input name="allowConflicts" type="checkbox" className="mt-1" />
        Назначить несмотря на найденное пересечение календаря. Используйте
        только после проверки предупреждения.
      </label>
      <Button
        disabled={pending || selected.length === 0 || !foremanId}
        size="lg"
        className="w-full"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Назначить монтаж
      </Button>
    </form>
  );
}
