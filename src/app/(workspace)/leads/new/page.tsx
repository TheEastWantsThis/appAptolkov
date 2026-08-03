import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { QuickLeadForm } from "@/components/leads/quick-lead-form";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export const metadata: Metadata = { title: "Новая заявка" };
export default async function NewLeadPage() {
  await requirePagePermission(PERMISSIONS.LEAD_CREATE);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Новая заявка"
        description="Быстрая регистрация лида — телефон обязателен, остальные сведения можно заполнить со слов клиента."
      />
      <Card>
        <CardContent className="pt-6">
          <QuickLeadForm />
        </CardContent>
      </Card>
    </div>
  );
}
