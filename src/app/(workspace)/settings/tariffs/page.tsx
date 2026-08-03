import { PageHeader } from "@/components/layout/page-header";
import { TariffEditor } from "@/components/tariffs/tariff-editor";
import { listTariffs } from "@/modules/estimates/application/queries";

export default async function TariffsPage() {
  const tariffs = await listTariffs();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Тарифы калькулятора"
        description="Изменения применяются только к новым версиям смет. Ранее созданные сметы сохраняют snapshot цен."
      />
      <TariffEditor
        tariffs={tariffs.map((t) => ({
          ...t,
          internalPrice: Number(t.internalPrice),
          clientPrice: Number(t.clientPrice),
        }))}
      />
    </div>
  );
}
