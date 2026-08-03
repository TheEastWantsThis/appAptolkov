"use client";

import { LoaderCircle, PhoneCall, Ruler, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createLeadTaskAction,
  createProjectFromLeadAction,
  logCallAction,
  scheduleMeasurementAction,
} from "@/modules/leads/application/actions";

export function LeadOperatorActions({
  leadId,
  phone,
  canCall,
  measurers,
  canCreateProject,
  defaultName,
  defaultAddress,
}: {
  leadId: string;
  phone: string;
  canCall: boolean;
  measurers: readonly { id: string; name: string }[];
  canCreateProject: boolean;
  defaultName: string;
  defaultAddress: string;
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
      toast.error(result.error?.message ?? "Не удалось выполнить действие");
    else {
      toast.success("Сохранено");
      router.refresh();
    }
  };
  return (
    <div className="space-y-5">
      {canCall ? (
        <Button asChild size="lg" className="h-12 w-full">
          <a href={`tel:${phone}`}>
            <PhoneCall /> Позвонить
          </a>
        </Button>
      ) : null}
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(data) =>
          void run(() =>
            logCallAction({
              leadId,
              result: data.get("result"),
              note: data.get("note"),
              nextContactAt: data.get("nextContactAt") || undefined,
              declineReason: data.get("declineReason") || undefined,
            }),
          )
        }
      >
        <h3 className="font-bold">Результат звонка</h3>
        <select
          name="result"
          className="border-input h-10 w-full rounded-md border px-3"
          required
        >
          <option value="NO_ANSWER">Не ответил</option>
          <option value="CALLBACK">Перезвонить</option>
          <option value="INTERESTED">Заинтересован</option>
          <option value="MEASUREMENT">Согласован замер</option>
          <option value="DECLINED">Отказ</option>
          <option value="WRONG_NUMBER">Неверный номер</option>
        </select>
        <Input
          name="nextContactAt"
          type="datetime-local"
          aria-label="Следующий контакт"
        />
        <Input name="declineReason" placeholder="Причина отказа, если есть" />
        <textarea
          name="note"
          className="border-input min-h-20 w-full rounded-md border p-3 text-sm"
          placeholder="Внутренний комментарий"
        />
        <Button disabled={pending} className="w-full">
          {pending ? <LoaderCircle className="animate-spin" /> : null}Сохранить
          звонок
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(data) =>
          void run(() =>
            scheduleMeasurementAction({
              leadId,
              measurerId: data.get("measurerId"),
              measurementAt: data.get("measurementAt"),
              note: data.get("note"),
            }),
          )
        }
      >
        <h3 className="flex items-center gap-2 font-bold">
          <Ruler className="size-4" /> Назначить замер
        </h3>
        <select
          name="measurerId"
          className="border-input h-10 w-full rounded-md border px-3"
          required
        >
          <option value="">Выберите замерщика</option>
          {measurers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Input name="measurementAt" type="datetime-local" required />
        <Input name="note" placeholder="Комментарий замерщику" />
        <Button disabled={pending} variant="secondary" className="w-full">
          Назначить
        </Button>
      </form>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action={(data) =>
          void run(() =>
            createLeadTaskAction({
              leadId,
              title: data.get("title"),
              dueAt: data.get("dueAt") || undefined,
              description: data.get("description"),
            }),
          )
        }
      >
        <h3 className="font-bold">Создать задачу</h3>
        <Input name="title" placeholder="Что нужно сделать" required />
        <Input name="dueAt" type="datetime-local" />
        <Input name="description" placeholder="Описание задачи" />
        <Button disabled={pending} variant="secondary" className="w-full">
          Создать задачу себе
        </Button>
      </form>{" "}
      {canCreateProject ? (
        <form
          className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
          action={(data) =>
            void run(async () => {
              const result = await createProjectFromLeadAction({
                leadId,
                customerName: data.get("customerName"),
                address: data.get("address"),
                description: data.get("description"),
              });
              if (result.ok) router.push(`/projects/${result.data.id}`);
              return result;
            })
          }
        >
          <h3 className="flex items-center gap-2 font-bold">
            <Rocket className="size-4" /> Создать проект
          </h3>
          <Input
            name="customerName"
            defaultValue={defaultName}
            placeholder="Имя клиента"
            required
          />
          <Input
            name="address"
            defaultValue={defaultAddress}
            placeholder="Адрес проекта"
            required
          />
          <Input name="description" placeholder="Описание проекта" />
          <Button
            disabled={pending}
            className="w-full bg-emerald-700 hover:bg-emerald-800"
          >
            Создать проект
          </Button>
        </form>
      ) : null}
    </div>
  );
}
