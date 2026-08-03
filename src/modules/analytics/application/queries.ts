import "server-only";

import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  requireAuthContext,
} from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { analyticsFiltersSchema } from "@/modules/analytics/application/schemas";

function average(values: readonly number[]) {
  return values.length
    ? Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
      ) / 10
    : 0;
}

function rate(part: number, total: number) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function hours(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

export async function listAnalyticsEmployees() {
  const context = await requireAuthContext();
  if (
    !hasPermission(context.permissions, PERMISSIONS.ANALYTICS_READ) &&
    !hasPermission(context.permissions, PERMISSIONS.ANALYTICS_SELF_READ)
  )
    throw new AuthorizationError();
  if (!hasPermission(context.permissions, PERMISSIONS.ANALYTICS_READ))
    return [{ id: context.userId, name: context.name }];
  return prisma.user.findMany({
    where: { isActive: true, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getAnalytics(input: unknown) {
  const parsed = analyticsFiltersSchema.safeParse(input);
  const filter = parsed.success ? parsed.data : {};
  const context = await requireAuthContext();
  const canReadAll = hasPermission(
    context.permissions,
    PERMISSIONS.ANALYTICS_READ,
  );
  const canReadSelf = hasPermission(
    context.permissions,
    PERMISSIONS.ANALYTICS_SELF_READ,
  );
  if (!canReadAll && !canReadSelf) throw new AuthorizationError();

  const now = new Date();
  const from =
    filter.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = filter.to
    ? new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1)
    : now;
  const employeeId = canReadAll ? filter.employeeId : context.userId;
  const personal = !canReadAll;
  const canReadFinance =
    canReadAll && hasPermission(context.permissions, PERMISSIONS.FINANCE_READ);

  const leadWhere = {
    createdAt: { gte: from, lte: to },
    ...(filter.source ? { source: filter.source } : {}),
    ...(personal
      ? { authorId: context.userId }
      : employeeId
        ? {
            OR: [
              { authorId: employeeId },
              { operatorId: employeeId },
              { measurerId: employeeId },
            ],
          }
        : {}),
  };

  const leads = await prisma.lead.findMany({
    where: leadWhere,
    take: 5000,
    select: {
      id: true,
      status: true,
      declineReason: true,
      createdAt: true,
      qualifiedAt: true,
      author: { select: { id: true, name: true } },
      operator: { select: { id: true, name: true } },
      measurer: { select: { id: true, name: true } },
    },
  });

  const qualifiedLeads = leads.filter((lead) =>
    ["QUALIFIED", "CONVERTED"].includes(lead.status),
  );
  const leadQualificationHours = qualifiedLeads
    .filter(
      (lead): lead is typeof lead & { qualifiedAt: Date } =>
        lead.qualifiedAt !== null,
    )
    .map((lead) => hours(lead.createdAt, lead.qualifiedAt));

  if (personal) {
    return {
      personal: true as const,
      period: { from, to },
      metrics: {
        leads: leads.length,
        qualifiedLeads: qualifiedLeads.length,
        leadConversion: rate(qualifiedLeads.length, leads.length),
        averageQualificationHours: average(leadQualificationHours),
      },
      refusals: Object.entries(
        leads
          .filter((lead) => lead.declineReason)
          .reduce<Record<string, number>>((acc, lead) => {
            const reason = lead.declineReason ?? "Не указана";
            acc[reason] = (acc[reason] ?? 0) + 1;
            return acc;
          }, {}),
      ).map(([reason, count]) => ({ reason, count })),
      efficiencies: {
        promoters: [
          {
            id: context.userId,
            name: context.name,
            total: leads.length,
            successful: qualifiedLeads.length,
            conversion: rate(qualifiedLeads.length, leads.length),
          },
        ],
        operators: [],
        measurers: [],
        installers: [],
      },
      financial: null,
      operations: null,
    };
  }

  const projectWhere = {
    createdAt: { lte: to },
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(employeeId
      ? {
          OR: [
            { createdById: employeeId },
            { responsibles: { some: { userId: employeeId } } },
            { lead: { authorId: employeeId } },
            { lead: { operatorId: employeeId } },
            { measurements: { some: { measurerId: employeeId } } },
            {
              installations: {
                some: { participants: { some: { userId: employeeId } } },
              },
            },
          ],
        }
      : {}),
  };
  const projects = await prisma.project.findMany({
    where: projectWhere,
    take: 5000,
    select: {
      id: true,
      status: true,
      createdAt: true,
      statusHistory: {
        orderBy: { changedAt: "asc" },
        select: { toStatus: true, changedAt: true },
      },
    },
  });
  const projectIds = projects.map(({ id }) => id);

  const [measurements, installations, finances, inventory, calendarEvents] =
    await Promise.all([
      prisma.measurement.findMany({
        where: {
          projectId: { in: projectIds },
          scheduledAt: { gte: from, lte: to },
          ...(employeeId ? { measurerId: employeeId } : {}),
        },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          measurer: { select: { id: true, name: true } },
        },
      }),
      prisma.installation.findMany({
        where: {
          projectId: { in: projectIds },
          startsAt: { gte: from, lte: to },
          ...(employeeId
            ? { participants: { some: { userId: employeeId } } }
            : {}),
        },
        select: {
          id: true,
          status: true,
          startsAt: true,
          actualEndedAt: true,
          participants: {
            select: { user: { select: { id: true, name: true } } },
          },
          usedMaterials: {
            select: { name: true, quantity: true, unit: true },
          },
        },
      }),
      canReadFinance
        ? prisma.projectFinance.findMany({
            where: { projectId: { in: projectIds } },
            select: {
              contractAmount: true,
              discountAmount: true,
              totalCost: true,
              grossProfit: true,
            },
          })
        : Promise.resolve([]),
      prisma.inventoryItem.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          unit: true,
          quantity: true,
          reserved: true,
          minimumQuantity: true,
        },
      }),
      prisma.calendarEvent.findMany({
        where: {
          projectId: { in: projectIds },
          startsAt: { gte: from, lte: to },
          endsAt: { not: null },
          ...(employeeId ? { assigneeId: employeeId } : {}),
        },
        select: {
          startsAt: true,
          endsAt: true,
          assignee: { select: { id: true, name: true } },
        },
      }),
    ]);

  const contracts = projects.filter((project) =>
    project.statusHistory.some(
      (entry) =>
        entry.toStatus === "CONTRACT_SIGNED" &&
        entry.changedAt >= from &&
        entry.changedAt <= to,
    ),
  ).length;
  const closedProjects = projects.filter((project) =>
    project.statusHistory.some(
      (entry) =>
        entry.toStatus === "COMPLETED" &&
        entry.changedAt >= from &&
        entry.changedAt <= to,
    ),
  ).length;

  const revenue = finances.reduce(
    (sum, item) =>
      sum + Number(item.contractAmount) - Number(item.discountAmount),
    0,
  );
  const totalCost = finances.reduce(
    (sum, item) => sum + Number(item.totalCost),
    0,
  );
  const profit = finances.reduce(
    (sum, item) => sum + Number(item.grossProfit),
    0,
  );

  const groupEfficiency = (
    rows: readonly {
      id: string;
      name: string;
      successful: boolean;
    }[],
  ) =>
    Object.values(
      rows.reduce<
        Record<
          string,
          {
            id: string;
            name: string;
            total: number;
            successful: number;
            conversion: number;
          }
        >
      >((acc, row) => {
        const current = acc[row.id] ?? {
          id: row.id,
          name: row.name,
          total: 0,
          successful: 0,
          conversion: 0,
        };
        current.total += 1;
        if (row.successful) current.successful += 1;
        current.conversion = rate(current.successful, current.total);
        acc[row.id] = current;
        return acc;
      }, {}),
    ).sort((a, b) => b.conversion - a.conversion);

  const materialUsage = Object.values(
    installations
      .flatMap((installation) => installation.usedMaterials)
      .reduce<Record<string, { name: string; unit: string; quantity: number }>>(
        (acc, material) => {
          const key = material.name + ":" + material.unit;
          const current = acc[key] ?? {
            name: material.name,
            unit: material.unit,
            quantity: 0,
          };
          current.quantity += Number(material.quantity);
          acc[key] = current;
          return acc;
        },
        {},
      ),
  );

  const calendarLoad = Object.values(
    calendarEvents.reduce<
      Record<string, { id: string; name: string; hours: number }>
    >((acc, event) => {
      if (!event.assignee || !event.endsAt) return acc;
      const current = acc[event.assignee.id] ?? {
        id: event.assignee.id,
        name: event.assignee.name,
        hours: 0,
      };
      current.hours += hours(event.startsAt, event.endsAt);
      acc[event.assignee.id] = current;
      return acc;
    }, {}),
  ).map((item) => ({ ...item, hours: Math.round(item.hours * 10) / 10 }));

  const stageTimes = {
    leadToQualificationHours: average(leadQualificationHours),
    projectToMeasurementHours: average(
      projects.flatMap((project) => {
        const entry = project.statusHistory.find(
          (item) => item.toStatus === "MEASURED",
        );
        return entry ? [hours(project.createdAt, entry.changedAt)] : [];
      }),
    ),
    projectToContractHours: average(
      projects.flatMap((project) => {
        const entry = project.statusHistory.find(
          (item) => item.toStatus === "CONTRACT_SIGNED",
        );
        return entry ? [hours(project.createdAt, entry.changedAt)] : [];
      }),
    ),
    contractToCompletionHours: average(
      projects.flatMap((project) => {
        const contract = project.statusHistory.find(
          (item) => item.toStatus === "CONTRACT_SIGNED",
        );
        const completed = project.statusHistory.find(
          (item) => item.toStatus === "COMPLETED",
        );
        return contract && completed
          ? [hours(contract.changedAt, completed.changedAt)]
          : [];
      }),
    ),
  };

  return {
    personal: false as const,
    period: { from, to },
    metrics: {
      leads: leads.length,
      qualifiedLeads: qualifiedLeads.length,
      measurements: measurements.length,
      contracts,
      installations: installations.length,
      closedProjects,
      leadConversion: rate(qualifiedLeads.length, leads.length),
      measurementConversion: rate(measurements.length, qualifiedLeads.length),
      contractConversion: rate(contracts, measurements.length),
      closeConversion: rate(closedProjects, contracts),
      averageCheck: finances.length ? Math.round(revenue / finances.length) : 0,
    },
    financial: canReadFinance
      ? {
          revenue,
          totalCost,
          profit,
          marginPercent: revenue
            ? Math.round((profit / revenue) * 1000) / 10
            : 0,
        }
      : null,
    refusals: Object.entries(
      leads
        .filter((lead) => lead.declineReason)
        .reduce<Record<string, number>>((acc, lead) => {
          const reason = lead.declineReason ?? "Не указана";
          acc[reason] = (acc[reason] ?? 0) + 1;
          return acc;
        }, {}),
    ).map(([reason, count]) => ({ reason, count })),
    efficiencies: {
      promoters: groupEfficiency(
        leads.map((lead) => ({
          id: lead.author.id,
          name: lead.author.name,
          successful: ["QUALIFIED", "CONVERTED"].includes(lead.status),
        })),
      ),
      operators: groupEfficiency(
        leads.flatMap((lead) =>
          lead.operator
            ? [
                {
                  id: lead.operator.id,
                  name: lead.operator.name,
                  successful: ["QUALIFIED", "CONVERTED"].includes(lead.status),
                },
              ]
            : [],
        ),
      ),
      measurers: groupEfficiency(
        measurements.map((measurement) => ({
          id: measurement.measurer.id,
          name: measurement.measurer.name,
          successful: measurement.status === "COMPLETED",
        })),
      ),
      installers: groupEfficiency(
        installations.flatMap((installation) =>
          installation.participants.map(({ user }) => ({
            id: user.id,
            name: user.name,
            successful: installation.status === "COMPLETED",
          })),
        ),
      ),
    },
    operations: {
      stageTimes,
      materialUsage,
      stockDeficit: inventory
        .map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          available: Number(item.quantity) - Number(item.reserved),
          minimum: Number(item.minimumQuantity),
        }))
        .filter((item) => item.available < item.minimum),
      calendarLoad,
    },
  };
}
