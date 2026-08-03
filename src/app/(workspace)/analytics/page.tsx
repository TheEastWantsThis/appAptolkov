import { BarChart3, Filter, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { requirePageAuth } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAnalytics,
  listAnalyticsEmployees,
} from "@/modules/analytics/application/queries";

const SOURCES = [
  ["PROMOTER", "Промоутер"],
  ["WEBSITE", "Сайт"],
  ["PHONE", "Телефон"],
  ["REFERRAL", "Рекомендация"],
  ["OTHER", "Другое"],
] as const;
const STATUSES = [
  ["QUALIFIED", "Квалифицирован"],
  ["MEASUREMENT_SCHEDULED", "Замер назначен"],
  ["MEASURED", "Замерен"],
  ["ESTIMATE_PREPARATION", "Подготовка сметы"],
  ["CONTRACT_PENDING", "Ожидает договор"],
  ["CONTRACT_SIGNED", "Договор подписан"],
  ["IN_PROGRESS", "В работе"],
  ["COMPLETED", "Завершён"],
  ["CANCELLED", "Отменён"],
] as const;

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="mt-1 text-2xl font-bold">
          {value.toLocaleString("ru-RU")} {suffix}
        </div>
      </CardContent>
    </Card>
  );
}

function EfficiencyTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly {
    id: string;
    name: string;
    total: number;
    successful: number;
    conversion: number;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_auto_auto] gap-3 border-b py-2 text-sm"
          >
            <span>{row.name}</span>
            <span>
              {row.successful}/{row.total}
            </span>
            <Badge variant="outline">{row.conversion}%</Badge>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Нет данных</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requirePageAuth();
  if (
    !context.permissions.has(PERMISSIONS.ANALYTICS_READ) &&
    !context.permissions.has(PERMISSIONS.ANALYTICS_SELF_READ)
  )
    redirect("/403");
  const params = await searchParams;
  const [data, employees] = await Promise.all([
    getAnalytics(params),
    listAnalyticsEmployees(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.personal ? "Мои показатели" : "Управленческая аналитика"}
        description={
          data.personal
            ? "Только личная безопасная статистика без телефонов и финансов клиентов"
            : "Воронка, финансы, эффективность, склад и загрузка"
        }
        action={<BarChart3 className="text-primary size-7" />}
      />
      <form className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 xl:grid-cols-6">
        <input
          name="from"
          type="date"
          defaultValue={params.from}
          className="border-input h-10 rounded-md border px-3"
        />
        <input
          name="to"
          type="date"
          defaultValue={params.to}
          className="border-input h-10 rounded-md border px-3"
        />
        <select
          name="source"
          defaultValue={params.source ?? ""}
          className="border-input h-10 rounded-md border px-3"
        >
          <option value="">Все источники</option>
          {SOURCES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {!data.personal ? (
          <>
            <select
              name="employeeId"
              defaultValue={params.employeeId ?? ""}
              className="border-input h-10 rounded-md border px-3"
            >
              <option value="">Все сотрудники</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="border-input h-10 rounded-md border px-3"
            >
              <option value="">Все статусы</option>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Button>
          <Filter />
          Применить
        </Button>
      </form>

      {data.personal ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Мои лиды" value={data.metrics.leads} />
            <Metric
              label="Квалифицировано"
              value={data.metrics.qualifiedLeads}
            />
            <Metric
              label="Конверсия"
              value={data.metrics.leadConversion}
              suffix="%"
            />
            <Metric
              label="Среднее время квалификации"
              value={data.metrics.averageQualificationHours}
              suffix="ч"
            />
          </section>
          <EfficiencyTable
            title="Личная эффективность"
            rows={data.efficiencies.promoters}
          />
        </>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Metric label="Лиды" value={data.metrics.leads} />
            <Metric
              label="Квалифицировано"
              value={data.metrics.qualifiedLeads}
            />
            <Metric label="Замеры" value={data.metrics.measurements} />
            <Metric label="Договоры" value={data.metrics.contracts} />
            <Metric label="Монтажи" value={data.metrics.installations} />
            <Metric
              label="Закрытые проекты"
              value={data.metrics.closedProjects}
            />
          </section>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Лид → квалификация"
              value={data.metrics.leadConversion}
              suffix="%"
            />
            <Metric
              label="Квалификация → замер"
              value={data.metrics.measurementConversion}
              suffix="%"
            />
            <Metric
              label="Замер → договор"
              value={data.metrics.contractConversion}
              suffix="%"
            />
            <Metric
              label="Договор → закрытие"
              value={data.metrics.closeConversion}
              suffix="%"
            />
          </section>
          {data.financial ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric
                label="Средний чек"
                value={data.metrics.averageCheck}
                suffix="₽"
              />
              <Metric
                label="Выручка"
                value={data.financial.revenue}
                suffix="₽"
              />
              <Metric
                label="Себестоимость"
                value={data.financial.totalCost}
                suffix="₽"
              />
              <Metric
                label="Прибыль"
                value={data.financial.profit}
                suffix="₽"
              />
              <Metric
                label="Маржинальность"
                value={data.financial.marginPercent}
                suffix="%"
              />
            </section>
          ) : (
            <p className="text-muted-foreground rounded-xl border p-4 text-sm">
              Финансовые показатели скрыты: требуется разрешение finance.read.
            </p>
          )}
          <section className="grid gap-4 xl:grid-cols-2">
            <EfficiencyTable
              title="Промоутеры"
              rows={data.efficiencies.promoters}
            />
            <EfficiencyTable
              title="Операторы"
              rows={data.efficiencies.operators}
            />
            <EfficiencyTable
              title="Замерщики"
              rows={data.efficiencies.measurers}
            />
            <EfficiencyTable
              title="Монтажники"
              rows={data.efficiencies.installers}
            />
          </section>
          {data.operations ? (
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Время между этапами</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    Лид → квалификация:{" "}
                    <b>
                      {data.operations.stageTimes.leadToQualificationHours} ч
                    </b>
                  </div>
                  <div>
                    Проект → замер:{" "}
                    <b>
                      {data.operations.stageTimes.projectToMeasurementHours} ч
                    </b>
                  </div>
                  <div>
                    Проект → договор:{" "}
                    <b>{data.operations.stageTimes.projectToContractHours} ч</b>
                  </div>
                  <div>
                    Договор → завершение:{" "}
                    <b>
                      {data.operations.stageTimes.contractToCompletionHours} ч
                    </b>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Причины отказа</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.refusals.map((row) => (
                    <div
                      key={row.reason}
                      className="flex justify-between border-b py-2 text-sm"
                    >
                      <span>{row.reason}</span>
                      <b>{row.count}</b>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Расход материалов</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.operations.materialUsage.map((row) => (
                    <div
                      key={row.name + row.unit}
                      className="flex justify-between border-b py-2 text-sm"
                    >
                      <span>{row.name}</span>
                      <b>
                        {row.quantity} {row.unit}
                      </b>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Дефицит склада</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.operations.stockDeficit.map((row) => (
                    <div
                      key={row.id}
                      className="flex justify-between border-b py-2 text-sm"
                    >
                      <span>{row.name}</span>
                      <b className="text-red-600">
                        {row.available}/{row.minimum} {row.unit}
                      </b>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex gap-2">
                    <TrendingUp />
                    Загрузка календаря
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.operations.calendarLoad.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-xl bg-slate-50 p-3 text-sm"
                    >
                      <b>{row.name}</b>
                      <div>{row.hours} ч</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
