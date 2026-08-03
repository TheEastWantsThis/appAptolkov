"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProjectFinanceAction } from "@/modules/finance/application/actions";
import { calculateProjectFinance } from "@/modules/finance/domain/calculator";

export interface FinanceFormValue {
  version: number;
  contractAmount: number;
  discountAmount: number;
  prepayment: number;
  additionalPayments: number;
  paymentMethod: "CASH" | "CARD" | "BANK_TRANSFER" | "INSTALLMENTS" | "OTHER";
  materialCost: number;
  installerWages: number;
  transportCost: number;
  additionalExpenses: number;
  paymentDueAt: string;
  paid: boolean;
}

const MONEY_FIELDS = [
  ["contractAmount", "Стоимость договора"],
  ["discountAmount", "Скидка"],
  ["prepayment", "Предоплата"],
  ["additionalPayments", "Доплаты"],
  ["materialCost", "Материалы"],
  ["installerWages", "Зарплата монтажников"],
  ["transportCost", "Транспорт"],
  ["additionalExpenses", "Дополнительные расходы"],
] as const;

export function ProjectFinanceForm({
  projectId,
  initial,
  canManage,
}: {
  projectId: string;
  initial: FinanceFormValue;
  canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const totals = calculateProjectFinance({
    ...value,
    contractAmount: Math.max(0, value.contractAmount),
    discountAmount: Math.min(
      Math.max(0, value.discountAmount),
      Math.max(0, value.contractAmount),
    ),
    prepayment: Math.max(0, value.prepayment),
    additionalPayments: Math.max(0, value.additionalPayments),
    materialCost: Math.max(0, value.materialCost),
    installerWages: Math.max(0, value.installerWages),
    transportCost: Math.max(0, value.transportCost),
    additionalExpenses: Math.max(0, value.additionalExpenses),
  });
  const submit = async () => {
    setPending(true);
    const result = await updateProjectFinanceAction({ projectId, ...value });
    setPending(false);
    if (!result.ok) return toast.error(result.error.message);
    setValue({ ...value, version: result.data.version });
    toast.success("Финансы сохранены");
    router.refresh();
  };
  return (
    <div className="space-y-5">
      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
        {MONEY_FIELDS.map(([field, label]) => (
          <label key={field} className="space-y-1">
            <span className="text-sm font-semibold">{label}, ₽</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              disabled={!canManage}
              value={value[field]}
              onChange={(event) =>
                setValue({ ...value, [field]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <label className="space-y-1">
          <span className="text-sm font-semibold">Способ оплаты</span>
          <select
            disabled={!canManage}
            value={value.paymentMethod}
            onChange={(event) =>
              setValue({
                ...value,
                paymentMethod: event.target
                  .value as FinanceFormValue["paymentMethod"],
              })
            }
            className="border-input h-10 w-full rounded-md border px-3"
          >
            <option value="CASH">Наличные</option>
            <option value="CARD">Карта</option>
            <option value="BANK_TRANSFER">Банковский перевод</option>
            <option value="INSTALLMENTS">Рассрочка</option>
            <option value="OTHER">Другое</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Срок оплаты</span>
          <Input
            type="date"
            disabled={!canManage}
            value={value.paymentDueAt}
            onChange={(event) =>
              setValue({ ...value, paymentDueAt: event.target.value })
            }
          />
        </label>
        <label className="flex items-center gap-3 pt-7 text-sm font-semibold">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={value.paid}
            onChange={(event) =>
              setValue({ ...value, paid: event.target.checked })
            }
          />
          Оплачено полностью
        </label>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Выручка", totals.revenue],
          ["Остаток", totals.balanceDue],
          ["Себестоимость", totals.totalCost],
          ["Валовая прибыль", totals.grossProfit],
          ["Маржинальность", totals.marginPercent, "%"],
        ].map(([label, amount, suffix]) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-4">
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="mt-1 text-xl font-bold">
              {Number(amount).toLocaleString("ru-RU")} {suffix ?? "₽"}
            </div>
          </div>
        ))}
      </section>
      {canManage ? (
        <Button
          onClick={() => void submit()}
          disabled={pending}
          size="lg"
          className="w-full"
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Сохранить финансовые данные
        </Button>
      ) : null}
    </div>
  );
}
