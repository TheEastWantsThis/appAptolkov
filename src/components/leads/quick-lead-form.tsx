"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeadAction } from "@/modules/leads/application/actions";
import { createLeadSchema } from "@/modules/leads/application/schemas";

type Values = z.input<typeof createLeadSchema>;

export function QuickLeadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { phone: "", contactConsent: false },
  });
  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = await createLeadAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Заявка зарегистрирована");
    router.push("/leads");
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Имя клиента"
          error={form.formState.errors.clientName?.message}
        >
          <Input
            autoComplete="name"
            placeholder="Необязательно"
            {...form.register("clientName")}
          />
        </Field>
        <Field label="Телефон *" error={form.formState.errors.phone?.message}>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 999 000-00-00"
            className="h-12 text-base"
            {...form.register("phone")}
          />
        </Field>
        <Field
          label="Район или адрес"
          error={form.formState.errors.districtOrAddress?.message}
        >
          <Input
            placeholder="Например, Центральный район"
            {...form.register("districtOrAddress")}
          />
        </Field>
        <Field
          label="Тип жилья"
          error={form.formState.errors.housingType?.message}
        >
          <select
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            {...form.register("housingType")}
          >
            <option value="">Не указан</option>
            <option value="APARTMENT">Квартира</option>
            <option value="HOUSE">Дом</option>
            <option value="NEW_BUILD">Новостройка</option>
            <option value="COMMERCIAL">Коммерческое</option>
            <option value="OTHER">Другое</option>
          </select>
        </Field>
        <Field
          label="Количество комнат"
          error={form.formState.errors.roomsApprox?.message}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            {...form.register("roomsApprox")}
          />
        </Field>
        <Field
          label="Срок ремонта"
          error={form.formState.errors.repairTimeline?.message}
        >
          <Input
            placeholder="В течение месяца"
            {...form.register("repairTimeline")}
          />
        </Field>
        <Field
          label="Удобное время звонка"
          error={form.formState.errors.preferredCallTime?.message}
        >
          <Input
            placeholder="Будни после 18:00"
            {...form.register("preferredCallTime")}
          />
        </Field>
        <Field
          label="Рекламная точка"
          error={form.formState.errors.adPoint?.message}
        >
          <Input
            placeholder="Адрес стойки или код"
            {...form.register("adPoint")}
          />
        </Field>
      </div>
      <Field label="Комментарий" error={form.formState.errors.comment?.message}>
        <textarea
          className="border-input bg-background min-h-24 w-full rounded-md border p-3 text-sm"
          placeholder="Что важно знать оператору"
          {...form.register("comment")}
        />
      </Field>
      <label className="bg-muted/60 flex min-h-14 items-start gap-3 rounded-xl p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-5"
          {...form.register("contactConsent")}
        />
        <span>Клиент согласен на обработку заявки и обратный звонок.</span>
      </label>
      {form.formState.errors.contactConsent ? (
        <p className="text-destructive text-sm">
          {form.formState.errors.contactConsent.message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="h-13 w-full text-base"
        disabled={pending}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
        Зарегистрировать заявку
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
