import { ArrowLeft, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  type FinanceFormValue,
  ProjectFinanceForm,
} from "@/components/finance/project-finance-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { getProjectFinance } from "@/modules/finance/application/queries";

function dateInput(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export default async function ProjectFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.FINANCE_READ);
  const { project, finance, canManage } = await getProjectFinance(id);
  if (!project) notFound();
  const initial: FinanceFormValue = {
    version: finance?.version ?? 0,
    contractAmount: Number(finance?.contractAmount ?? 0),
    discountAmount: Number(finance?.discountAmount ?? 0),
    prepayment: Number(finance?.prepayment ?? 0),
    additionalPayments: Number(finance?.additionalPayments ?? 0),
    paymentMethod: finance?.paymentMethod ?? "BANK_TRANSFER",
    materialCost: Number(finance?.materialCost ?? 0),
    installerWages: Number(finance?.installerWages ?? 0),
    transportCost: Number(finance?.transportCost ?? 0),
    additionalExpenses: Number(finance?.additionalExpenses ?? 0),
    paymentDueAt: dateInput(finance?.paymentDueAt),
    paid: Boolean(finance?.paidAt),
  };
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={"/projects/" + id}>
          <ArrowLeft />К проекту
        </Link>
      </Button>
      <PageHeader
        title={"Финансы · " + project.number}
        description={project.address}
        action={<WalletCards className="text-primary size-7" />}
      />
      <ProjectFinanceForm
        projectId={id}
        initial={initial}
        canManage={canManage}
      />
      {finance ? (
        <p className="text-muted-foreground text-xs">
          Версия {finance.version} · обновил {finance.updatedBy.name}
        </p>
      ) : null}
    </div>
  );
}
