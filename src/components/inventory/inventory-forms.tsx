"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adjustInventoryAction,
  createInventoryItemAction,
} from "@/modules/inventory/application/actions";

export function CreateInventoryItemForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-5"
      action={async (data) => {
        setPending(true);
        const result = await createInventoryItemAction({
          code: data.get("code"),
          name: data.get("name"),
          unit: data.get("unit"),
          quantity: data.get("quantity"),
          minimumQuantity: data.get("minimumQuantity"),
        });
        setPending(false);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Материал добавлен");
        router.refresh();
      }}
    >
      <Input name="code" placeholder="Код" required />
      <Input name="name" placeholder="Материал" required />
      <Input name="unit" placeholder="Единица" required />
      <Input
        name="quantity"
        type="number"
        min="0"
        step="0.001"
        placeholder="Остаток"
        required
      />
      <Input
        name="minimumQuantity"
        type="number"
        min="0"
        step="0.001"
        placeholder="Минимум"
        required
      />
      <Button disabled={pending} className="sm:col-span-5">
        {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
        Добавить материал
      </Button>
    </form>
  );
}

export function InventoryAdjustmentForm({
  itemId,
  version,
}: {
  itemId: string;
  version: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-4"
      action={async (data) => {
        setPending(true);
        const result = await adjustInventoryAction({
          itemId,
          version,
          type: data.get("type"),
          quantityDelta: data.get("quantityDelta"),
          reservedDelta: data.get("reservedDelta"),
          reason: data.get("reason"),
        });
        setPending(false);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Остаток обновлён");
        router.refresh();
      }}
    >
      <select name="type" className="border-input h-10 rounded-md border px-2">
        <option value="RECEIPT">Поступление</option>
        <option value="CONSUMPTION">Расход</option>
        <option value="RESERVATION">Резерв</option>
        <option value="RELEASE">Снятие резерва</option>
        <option value="ADJUSTMENT">Корректировка</option>
      </select>
      <Input
        name="quantityDelta"
        type="number"
        step="0.001"
        defaultValue="0"
        placeholder="+10 или -5"
        aria-label="Изменение остатка"
      />
      <Input
        name="reservedDelta"
        type="number"
        step="0.001"
        defaultValue="0"
        placeholder="+10 или -5"
        aria-label="Изменение резерва"
      />
      <Input name="reason" placeholder="Причина" required />
      <Button disabled={pending} variant="outline" className="sm:col-span-4">
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Провести движение
      </Button>
    </form>
  );
}
