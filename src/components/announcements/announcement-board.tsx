"use client";

import { Megaphone, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  updateAnnouncementAction,
} from "@/modules/announcements/application/actions";

type Announcement = {
  id: string;
  title: string;
  content: string;
  author: { name: string };
};

export function AnnouncementBoard({
  announcements,
  canManage,
}: {
  announcements: readonly Announcement[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function submitCreate(formData: FormData) {
    setPendingId("create");
    const result = await createAnnouncementAction({
      title: formData.get("title"),
      content: formData.get("content"),
    });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setIsCreating(false);
    toast.success("Объявление опубликовано");
    router.refresh();
  }

  async function submitUpdate(id: string, formData: FormData) {
    setPendingId(id);
    const result = await updateAnnouncementAction({
      id,
      title: formData.get("title"),
      content: formData.get("content"),
    });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setEditingId(null);
    toast.success("Объявление обновлено");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить это объявление?")) return;
    setPendingId(id);
    const result = await deleteAnnouncementAction({ id });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Объявление удалено");
    router.refresh();
  }

  return (
    <section aria-labelledby="announcements-title" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="announcements-title" className="text-lg font-bold">
          Важная информация
        </h2>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreating((value) => !value)}
          >
            <Plus />
            Добавить
          </Button>
        ) : null}
      </div>

      {isCreating ? (
        <AnnouncementForm
          pending={pendingId === "create"}
          submitLabel="Опубликовать"
          onSubmit={submitCreate}
          onCancel={() => setIsCreating(false)}
        />
      ) : null}

      {announcements.length > 0 ? (
        announcements.map((announcement) =>
          editingId === announcement.id ? (
            <AnnouncementForm
              key={announcement.id}
              title={announcement.title}
              content={announcement.content}
              pending={pendingId === announcement.id}
              submitLabel="Сохранить"
              onSubmit={(formData) => submitUpdate(announcement.id, formData)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Card
              key={announcement.id}
              className="border-amber-200/80 bg-amber-50/70 shadow-none"
            >
              <CardContent className="flex gap-4 py-5 sm:py-6">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Megaphone className="size-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="font-bold">{announcement.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                    {announcement.content}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {announcement.author.name}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Редактировать объявление"
                      onClick={() => setEditingId(announcement.id)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Удалить объявление"
                      disabled={pendingId === announcement.id}
                      onClick={() => remove(announcement.id)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ),
        )
      ) : (
        <Card className="border-dashed shadow-none">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Важных объявлений пока нет.
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function AnnouncementForm({
  title = "",
  content = "",
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title?: string;
  content?: string;
  pending: boolean;
  submitLabel: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="pt-5 sm:pt-6">
        <form action={onSubmit} className="space-y-3">
          <Input
            name="title"
            defaultValue={title}
            maxLength={160}
            placeholder="Заголовок объявления"
            aria-label="Заголовок объявления"
            required
          />
          <textarea
            name="content"
            defaultValue={content}
            maxLength={2000}
            placeholder="Текст объявления"
            aria-label="Текст объявления"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              <Save />
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
