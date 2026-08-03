"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTariffAction } from "@/modules/estimates/application/actions";

export function TariffEditor({
  tariffs,
}: {
  tariffs: readonly {
    id: string;
    code: string;
    name: string;
    category: string;
    unit: string;
    internalPrice: number;
    clientPrice: number;
    isActive: boolean;
  }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      {Object.entries(Object.groupBy(tariffs, (t) => t.category)).map(
        ([category, items]) => (
          <section key={category}>
            <h2 className="mb-3 text-lg font-bold">{category}</h2>
            <div className="space-y-2">
              {items?.map((t) => (
                <form
                  key={t.id}
                  className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_140px_140px_90px_auto]"
                  action={async (d) => {
                    setPending(t.id);
                    const result = await updateTariffAction({
                      id: t.id,
                      internalPrice: d.get("internalPrice"),
                      clientPrice: d.get("clientPrice"),
                      isActive: d.get("isActive") === "on",
                    });
                    setPending(null);
                    if (!result.ok) toast.error(result.error.message);
                    else {
                      toast.success("Тариф обновлён");
                      router.refresh();
                    }
                  }}
                >
                  <div>
                    <b className="text-sm">{t.name}</b>
                    <div className="text-muted-foreground text-xs">
                      {t.code} · {t.unit}
                    </div>
                  </div>
                  <label className="text-xs">
                    Себестоимость
                    <Input
                      name="internalPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={t.internalPrice}
                    />
                  </label>
                  <label className="text-xs">
                    Цена клиенту
                    <Input
                      name="clientPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={t.clientPrice}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={t.isActive}
                    />
                    Активен
                  </label>
                  <Button disabled={pending === t.id} size="sm">
                    {pending === t.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    <span className="sm:hidden">Сохранить</span>
                  </Button>
                </form>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
