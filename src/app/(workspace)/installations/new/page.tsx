import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { InstallationScheduleForm } from "@/components/installations/installation-schedule-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { listInstallationSchedulingOptions } from "@/modules/installations/application/queries";

export default async function NewInstallationPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const [{ projectId }, options] = await Promise.all([
    searchParams,
    listInstallationSchedulingOptions(),
  ]);
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/installations">
          <ArrowLeft />К календарю
        </Link>
      </Button>
      <PageHeader
        title="Назначить монтаж"
        description="Система проверит пересечения календаря у всех участников бригады."
      />
      <InstallationScheduleForm {...options} initialProjectId={projectId} />
    </div>
  );
}
