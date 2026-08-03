import { ArrowLeft, Download, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { getEstimate } from "@/modules/estimates/application/queries";

const units: Record<string, string> = {
  M2: "м²",
  M: "м",
  PCS: "шт.",
  FIXED: "усл.",
  ZONE: "зона",
  COEFFICIENT: "коэф.",
};
const rub = (v: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(
    v,
  );
export default async function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimate = await getEstimate(id);
  if (!estimate) notFound();
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/projects/${estimate.project.id}`}>
          <ArrowLeft />К проекту
        </Link>
      </Button>
      <PageHeader
        title={`Смета ${estimate.project.number} · версия ${estimate.version}`}
        description={`${estimate.author.name} · ${formatDateTime(estimate.createdAt)}`}
        action={<Badge variant="success">{estimate.status}</Badge>}
      />
      <div className="flex flex-wrap gap-2">
        {estimate.canClient ? (
          <Button asChild>
            <a href={`/api/estimates/${estimate.id}/pdf?mode=client`}>
              <Download />
              Клиентский PDF
            </a>
          </Button>
        ) : null}
        {estimate.canInternal ? (
          <Button asChild variant="secondary">
            <a href={`/api/estimates/${estimate.id}/pdf?mode=internal`}>
              <LockKeyhole />
              Внутренний PDF
            </a>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardContent className="pt-5">
          <div className="mb-4">
            <b>{estimate.project.customer.name}</b>
            <div className="text-muted-foreground text-sm">
              {estimate.project.address}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Работа / материал</th>
                  <th className="p-2">Кол-во</th>
                  {estimate.canClient ? (
                    <>
                      <th className="p-2">Цена</th>
                      <th className="p-2">Сумма</th>
                    </>
                  ) : null}
                  {estimate.canInternal ? (
                    <>
                      <th className="p-2">Себестоимость</th>
                      <th className="p-2">Итого внутр.</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {estimate.lines.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="p-2">{l.description}</td>
                    <td className="p-2">
                      {l.quantity} {units[l.unit]}
                    </td>
                    {estimate.canClient ? (
                      <>
                        <td className="p-2">{rub(l.clientUnitPrice ?? 0)}</td>
                        <td className="p-2 font-semibold">
                          {rub(l.clientAmount ?? 0)}
                        </td>
                      </>
                    ) : null}
                    {estimate.canInternal ? (
                      <>
                        <td className="p-2">{rub(l.internalUnitPrice ?? 0)}</td>
                        <td className="p-2">{rub(l.internalAmount ?? 0)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 ml-auto max-w-sm space-y-2">
            {estimate.canClient ? (
              <>
                <Total label="Подытог" value={estimate.subtotalClient} />
                <Total
                  label={`Скидка ${estimate.discountPercent}%`}
                  value={-(estimate.discountAmount ?? 0)}
                />
                <Total
                  label="Итого клиенту"
                  value={estimate.totalClient}
                  strong
                />
              </>
            ) : null}
            {estimate.canInternal ? (
              <Total
                label="Внутренняя себестоимость"
                value={estimate.totalInternal}
                strong
              />
            ) : null}
            {!estimate.canClient && !estimate.canInternal ? (
              <p className="text-muted-foreground flex gap-2 text-sm">
                <LockKeyhole className="size-4" />
                Цены скрыты вашими серверными разрешениями
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "border-t pt-2 text-lg font-bold" : "text-sm"}`}
    >
      <span>{label}</span>
      <span>{rub(value ?? 0)}</span>
    </div>
  );
}
