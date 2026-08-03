"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addProjectCommentAction,
  addProjectEventAction,
  addProjectRoomAction,
  addProjectTaskAction,
  assignProjectUserAction,
  registerProjectFileAction,
  changeProjectStatusAction,
} from "@/modules/projects/application/actions";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
} from "@/modules/projects/domain/state-machine";

type UserOption = { id: string; name: string };

export function ProjectControls({
  projectId,
  status,
  users,
}: {
  projectId: string;
  status: keyof typeof PROJECT_STATUS_LABELS;
  users: readonly UserOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const run = async (
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) => {
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.ok)
      toast.error(result.error?.message ?? "Не удалось сохранить");
    else {
      toast.success("Изменения сохранены");
      router.refresh();
    }
  };
  const busy = pending ? <LoaderCircle className="animate-spin" /> : null;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            changeProjectStatusAction({
              projectId,
              status: d.get("status"),
              comment: d.get("comment"),
            }),
          )
        }
      >
        <h3 className="font-bold">Изменить статус</h3>
        <select
          name="status"
          defaultValue={status}
          className="border-input h-10 w-full rounded-md border px-3"
        >
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Input name="comment" placeholder="Комментарий к переходу" />
        <Button disabled={pending} className="w-full">
          {busy}Сменить статус
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            addProjectCommentAction({ projectId, body: d.get("body") }),
          )
        }
      >
        <h3 className="font-bold">Внутренний комментарий</h3>
        <textarea
          name="body"
          className="border-input min-h-20 w-full rounded-md border p-3 text-sm"
          required
        />
        <Button disabled={pending} variant="secondary" className="w-full">
          Добавить
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            addProjectTaskAction({
              projectId,
              title: d.get("title"),
              description: d.get("description"),
              assigneeId: d.get("assigneeId") || undefined,
              dueAt: d.get("dueAt") || undefined,
            }),
          )
        }
      >
        <h3 className="font-bold">Новая задача</h3>
        <Input name="title" placeholder="Название задачи" required />
        <select
          name="assigneeId"
          className="border-input h-10 w-full rounded-md border px-3"
        >
          <option value="">Без исполнителя</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Input name="dueAt" type="datetime-local" />
        <Input name="description" placeholder="Описание" />
        <Button disabled={pending} variant="secondary" className="w-full">
          Создать задачу
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            addProjectEventAction({
              projectId,
              type: d.get("type"),
              title: d.get("title"),
              startsAt: d.get("startsAt"),
              assigneeId: d.get("assigneeId") || undefined,
              note: d.get("note"),
            }),
          )
        }
      >
        <h3 className="font-bold">Календарное событие</h3>
        <select
          name="type"
          className="border-input h-10 w-full rounded-md border px-3"
        >
          <option value="MEASUREMENT">Замер</option>
          <option value="CALL">Звонок</option>
          <option value="MEETING">Встреча</option>
          <option value="INSTALLATION">Монтаж</option>
          <option value="DEADLINE">Срок</option>
          <option value="OTHER">Другое</option>
        </select>
        <Input name="title" placeholder="Название события" required />
        <Input name="startsAt" type="datetime-local" required />
        <select
          name="assigneeId"
          className="border-input h-10 w-full rounded-md border px-3"
        >
          <option value="">Без ответственного</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Input name="note" placeholder="Комментарий" />
        <Button disabled={pending} variant="secondary" className="w-full">
          Добавить событие
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            addProjectRoomAction({
              projectId,
              name: d.get("name"),
              area: d.get("area") || undefined,
              description: d.get("description"),
            }),
          )
        }
      >
        <h3 className="font-bold">Добавить помещение</h3>
        <Input name="name" placeholder="Например, гостиная" required />
        <Input
          name="area"
          type="number"
          step="0.01"
          placeholder="Площадь, м²"
        />
        <Input name="description" placeholder="Описание" />
        <Button disabled={pending} variant="secondary" className="w-full">
          Добавить помещение
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            assignProjectUserAction({
              projectId,
              userId: d.get("userId"),
              roleLabel: d.get("roleLabel"),
            }),
          )
        }
      >
        <h3 className="font-bold">Назначить ответственного</h3>
        <select
          name="userId"
          className="border-input h-10 w-full rounded-md border px-3"
          required
        >
          <option value="">Выберите сотрудника</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Input name="roleLabel" placeholder="Роль в проекте" required />
        <Button disabled={pending} variant="secondary" className="w-full">
          Назначить
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(d) =>
          void run(() =>
            registerProjectFileAction({
              projectId,
              name: d.get("name"),
              storageKey: d.get("storageKey"),
              mimeType: "application/octet-stream",
            }),
          )
        }
      >
        <h3 className="font-bold">Прикрепить файл</h3>
        <Input name="name" placeholder="Название документа" required />
        <Input
          name="storageKey"
          type="url"
          placeholder="https://… ссылка на файл"
          required
        />
        <p className="text-muted-foreground text-xs">
          Ссылка сохраняется как метаданные. Доступ к карточке проверяется
          сервером.
        </p>
        <Button disabled={pending} variant="secondary" className="w-full">
          Прикрепить
        </Button>
      </form>{" "}
    </div>
  );
}
