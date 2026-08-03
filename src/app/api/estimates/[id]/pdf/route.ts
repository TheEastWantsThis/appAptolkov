import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import {
  generateEstimatePdf,
  type PdfMode,
} from "@/modules/estimates/infrastructure/pdf";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mode: PdfMode =
    new URL(request.url).searchParams.get("mode") === "internal"
      ? "internal"
      : "client";
  const context = await requirePermission(PERMISSIONS.ESTIMATE_READ);
  const allowed =
    mode === "internal"
      ? hasPermission(
          context.permissions,
          PERMISSIONS.ESTIMATE_INTERNAL_PRICE_READ,
        )
      : hasPermission(
          context.permissions,
          PERMISSIONS.ESTIMATE_CLIENT_PRICE_READ,
        );
  if (!allowed)
    return new Response("Недостаточно прав для экспорта", { status: 403 });

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      author: { select: { name: true } },
      project: {
        select: {
          number: true,
          address: true,
          customer: { select: { name: true } },
        },
      },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!estimate) return new Response("Смета не найдена", { status: 404 });
  const pdf = await generateEstimatePdf(
    {
      number: estimate.project.number,
      version: estimate.version,
      customerName: estimate.project.customer.name,
      address: estimate.project.address,
      authorName: estimate.author.name,
      createdAt: estimate.createdAt,
      discountPercent: Number(estimate.discountPercent),
      subtotalClient: Number(estimate.subtotalClient),
      discountAmount: Number(estimate.discountAmount),
      totalClient: Number(estimate.totalClient),
      totalInternal: Number(estimate.totalInternal),
      lines: estimate.lines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unit: line.unit,
        clientUnitPrice: Number(line.clientUnitPrice),
        clientAmount: Number(line.clientAmount),
        internalUnitPrice: Number(line.internalUnitPrice),
        internalAmount: Number(line.internalAmount),
      })),
    },
    mode,
  );
  const filename = `estimate-${estimate.project.number}-v${estimate.version}-${mode}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
