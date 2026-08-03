import { Boxes, TriangleAlert } from "lucide-react";

import {
  CreateInventoryItemForm,
  InventoryAdjustmentForm,
} from "@/components/inventory/inventory-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { listInventory } from "@/modules/inventory/application/queries";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export default async function InventoryPage() {
  await requirePagePermission(PERMISSIONS.INVENTORY_READ);
  const { items, canManage } = await listInventory();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Склад"
        description="Остатки, резервы и журнал движений"
        action={<Boxes className="text-primary size-7" />}
      />
      {canManage ? <CreateInventoryItemForm /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const available = Number(item.quantity) - Number(item.reserved);
          const shortage = available < Number(item.minimumQuantity);
          return (
            <Card key={item.id} className={shortage ? "border-amber-400" : ""}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <b>{item.name}</b>
                    <div className="text-muted-foreground text-xs">
                      {item.code}
                    </div>
                  </div>
                  {shortage ? (
                    <Badge variant="destructive">
                      <TriangleAlert />
                      Дефицит
                    </Badge>
                  ) : (
                    <Badge variant="success">В наличии</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Остаток</span>
                    <br />
                    <b>
                      {Number(item.quantity)} {item.unit}
                    </b>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Резерв</span>
                    <br />
                    <b>
                      {Number(item.reserved)} {item.unit}
                    </b>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Доступно</span>
                    <br />
                    <b>
                      {available} {item.unit}
                    </b>
                  </div>
                </div>
                <div className="space-y-1">
                  {item.movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="text-muted-foreground text-xs"
                    >
                      {formatDateTime(movement.createdAt)} ·{" "}
                      {movement.actor.name} · {Number(movement.quantityDelta)} /
                      резерв {Number(movement.reservedDelta)}
                    </div>
                  ))}
                </div>
                {canManage ? (
                  <InventoryAdjustmentForm
                    itemId={item.id}
                    version={item.version}
                  />
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
