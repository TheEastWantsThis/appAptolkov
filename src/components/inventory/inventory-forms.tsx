"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveInventoryItemAction,
  createCategoryAction,
  createInventoryItemAction,
  createLocationAction,
  createPurchaseOrderAction,
  createRequirementAction,
  createSupplierAction,
  createSupplierPriceAction,
  createUnitAction,
  generateRequirementsAction,
  recordStockMovementAction,
  requirementOperationAction,
  reserveRequirementAction,
} from "@/modules/inventory/application/actions";

type Option = { id: string; name: string };
type ItemOption = Option & { unit: string };
function useSubmit() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return {
    pending,
    run: async (
      action: () => Promise<{ ok: boolean; error?: { message: string } }>,
      message: string,
    ) => {
      setPending(true);
      const result = await action();
      setPending(false);
      if (!result.ok) {
        toast.error(result.error?.message ?? "Ошибка");
        return;
      }
      toast.success(message);
      router.refresh();
    },
  };
}
const Select = ({
  name,
  children,
  required = true,
}: {
  name: string;
  children: React.ReactNode;
  required?: boolean;
}) => (
  <select
    name={name}
    required={required}
    className="border-input h-10 w-full rounded-md border bg-transparent px-3 text-sm"
  >
    {children}
  </select>
);

export function CatalogForms({ categories }: { categories: Option[] }) {
  const s = useSubmit();
  return (
    <details className="rounded-2xl border p-4">
      <summary className="cursor-pointer font-semibold">
        Справочники склада
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <form
          className="grid gap-2"
          action={(d) =>
            s.run(
              () =>
                createCategoryAction({
                  code: d.get("code"),
                  name: d.get("name"),
                  parentId: d.get("parentId"),
                }),
              "Категория создана",
            )
          }
        >
          <b>Категория</b>
          <Input name="code" placeholder="Код" required />
          <Input name="name" placeholder="Название" required />
          <Select name="parentId" required={false}>
            <option value="">Без родителя</option>
            {categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <Button disabled={s.pending}>Добавить</Button>
        </form>
        <form
          className="grid gap-2"
          action={(d) =>
            s.run(
              () =>
                createUnitAction({
                  code: d.get("code"),
                  name: d.get("name"),
                  symbol: d.get("symbol"),
                  precision: d.get("precision"),
                }),
              "Единица создана",
            )
          }
        >
          <b>Единица измерения</b>
          <Input name="code" placeholder="Код: M2" required />
          <Input name="name" placeholder="Название" required />
          <Input name="symbol" placeholder="м²" required />
          <Input
            name="precision"
            type="number"
            min="0"
            max="3"
            defaultValue="3"
          />
          <Button disabled={s.pending}>Добавить</Button>
        </form>
        <form
          className="grid gap-2"
          action={(d) =>
            s.run(
              () =>
                createLocationAction({
                  code: d.get("code"),
                  name: d.get("name"),
                  address: d.get("address"),
                }),
              "Локация создана",
            )
          }
        >
          <b>Складская локация</b>
          <Input name="code" placeholder="Код" required />
          <Input name="name" placeholder="Название" required />
          <Input name="address" placeholder="Адрес" />
          <Button disabled={s.pending}>Добавить</Button>
        </form>
        <form
          className="grid gap-2"
          action={(d) =>
            s.run(
              () =>
                createSupplierAction({
                  code: d.get("code"),
                  name: d.get("name"),
                  contactPerson: d.get("contactPerson"),
                  phone: d.get("phone"),
                  email: d.get("email"),
                  comment: d.get("comment"),
                }),
              "Поставщик создан",
            )
          }
        >
          <b>Поставщик</b>
          <Input name="code" placeholder="Код" required />
          <Input name="name" placeholder="Название" required />
          <Input name="contactPerson" placeholder="Контактное лицо" />
          <Input name="phone" placeholder="Телефон" />
          <Input name="email" type="email" placeholder="Email" />
          <Input name="comment" placeholder="Комментарий" />
          <Button disabled={s.pending}>Добавить</Button>
        </form>
      </div>
    </details>
  );
}

export function CreateInventoryItemForm({
  categories,
  units,
  locations,
}: {
  categories: Option[];
  units: Option[];
  locations: Option[];
}) {
  const s = useSubmit();
  return (
    <form
      className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-4"
      action={(d) =>
        s.run(
          () =>
            createInventoryItemAction({
              code: d.get("code"),
              name: d.get("name"),
              categoryId: d.get("categoryId"),
              unitId: d.get("unitId"),
              defaultLocationId: d.get("defaultLocationId"),
              minimumQuantity: d.get("minimumQuantity"),
              purchasePrice: d.get("purchasePrice"),
            }),
          "Материал создан с нулевым остатком",
        )
      }
    >
      <b className="sm:col-span-2 lg:col-span-4">Новый материал</b>
      <Input name="code" placeholder="Артикул" required />
      <Input name="name" placeholder="Название" required />
      <Select name="categoryId" required={false}>
        <option value="">Без категории</option>
        {categories.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="unitId">
        <option value="">Единица</option>
        {units.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="defaultLocationId">
        <option value="">Основная локация</option>
        {locations.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Input
        name="minimumQuantity"
        type="number"
        min="0"
        step="0.001"
        placeholder="Минимальный остаток"
        required
      />
      <Input
        name="purchasePrice"
        type="number"
        min="0"
        step="0.01"
        placeholder="Закупочная цена"
      />
      <Button disabled={s.pending}>Создать</Button>
    </form>
  );
}

export function InventoryMovementForm({
  itemId,
  locations,
  projects,
  canNegative,
}: {
  itemId: string;
  locations: Option[];
  projects: { id: string; number: string }[];
  canNegative: boolean;
}) {
  const s = useSubmit();
  return (
    <form
      className="grid gap-2 border-t pt-3 sm:grid-cols-3"
      action={(d) =>
        s.run(
          () =>
            recordStockMovementAction({
              itemId,
              locationId: d.get("locationId"),
              toLocationId: d.get("toLocationId"),
              type: d.get("type"),
              quantity: d.get("quantity"),
              adjustmentDirection: d.get("adjustmentDirection"),
              projectId: d.get("projectId"),
              documentRef: d.get("documentRef"),
              comment: d.get("comment"),
              allowNegative: d.get("allowNegative") === "on",
            }),
          "Движение проведено",
        )
      }
    >
      <Select name="type">
        <option value="RECEIPT">Приход</option>
        <option value="WRITE_OFF">Списание со склада</option>
        <option value="TRANSFER">Перемещение</option>
        <option value="ADJUSTMENT">Корректировка</option>
      </Select>
      <Select name="locationId">
        <option value="">Локация</option>
        {locations.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="toLocationId" required={false}>
        <option value="">Куда (для перемещения)</option>
        {locations.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Input
        name="quantity"
        type="number"
        min="0.001"
        step="0.001"
        placeholder="Количество"
        required
      />
      <Select name="adjustmentDirection" required={false}>
        <option value="">Направление корректировки</option>
        <option value="INCREASE">Увеличить</option>
        <option value="DECREASE">Уменьшить</option>
      </Select>
      <Select name="projectId" required={false}>
        <option value="">Без проекта</option>
        {projects.map((x) => (
          <option key={x.id} value={x.id}>
            {x.number}
          </option>
        ))}
      </Select>
      <Input name="documentRef" placeholder="Документ-основание" />
      <Input name="comment" placeholder="Комментарий" required />
      {canNegative ? (
        <label className="flex items-center gap-2 text-sm">
          <input name="allowNegative" type="checkbox" />
          Разрешить отрицательный остаток
        </label>
      ) : null}
      <Button variant="outline" disabled={s.pending}>
        Провести
      </Button>
    </form>
  );
}

export function ArchiveItemButton({
  itemId,
  archived,
}: {
  itemId: string;
  archived: boolean;
}) {
  const s = useSubmit();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() =>
        s.run(
          () => archiveInventoryItemAction({ itemId, archived: !archived }),
          archived ? "Позиция восстановлена" : "Позиция архивирована",
        )
      }
    >
      {archived ? "Восстановить" : "В архив"}
    </Button>
  );
}

export function SupplierPriceForm({
  items,
  suppliers,
}: {
  items: ItemOption[];
  suppliers: Option[];
}) {
  const s = useSubmit();
  return (
    <form
      className="grid gap-2 rounded-2xl border p-4 sm:grid-cols-4"
      action={(d) =>
        s.run(
          () =>
            createSupplierPriceAction({
              itemId: d.get("itemId"),
              supplierId: d.get("supplierId"),
              price: d.get("price"),
              currency: "RUB",
            }),
          "Закупочная цена сохранена",
        )
      }
    >
      <b className="sm:col-span-4">Закупочная цена поставщика</b>
      <Select name="itemId">
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="supplierId">
        {suppliers.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Input
        name="price"
        type="number"
        min="0"
        step="0.01"
        placeholder="Цена"
        required
      />
      <Button disabled={s.pending}>Сохранить</Button>
    </form>
  );
}

export function RequirementCreateForm({
  projects,
  items,
  estimates,
  installations,
}: {
  projects: { id: string; number: string }[];
  items: ItemOption[];
  estimates: { id: string; projectId: string; version: number }[];
  installations: { id: string; projectId: string; startsAt: Date }[];
}) {
  const s = useSubmit();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="grid gap-2 rounded-2xl border p-4"
        action={(d) =>
          s.run(
            () =>
              createRequirementAction({
                projectId: d.get("projectId"),
                itemId: d.get("itemId"),
                required: d.get("required"),
                installationId: d.get("installationId"),
              }),
            "Потребность создана",
          )
        }
      >
        <b>Добавить потребность вручную</b>
        <Select name="projectId">
          {projects.map((x) => (
            <option key={x.id} value={x.id}>
              {x.number}
            </option>
          ))}
        </Select>
        <Select name="itemId">
          {items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
        <Input
          name="required"
          type="number"
          min="0.001"
          step="0.001"
          placeholder="Требуется"
          required
        />
        <Select name="installationId" required={false}>
          <option value="">Без монтажа</option>
          {installations.map((x) => (
            <option key={x.id} value={x.id}>
              {new Date(x.startsAt).toLocaleDateString("ru-RU")}
            </option>
          ))}
        </Select>
        <Button disabled={s.pending}>Добавить</Button>
      </form>
      <form
        className="grid gap-2 rounded-2xl border p-4"
        action={(d) =>
          s.run(
            () =>
              generateRequirementsAction({
                projectId: d.get("projectId"),
                estimateId: d.get("estimateId"),
                installationId: d.get("installationId"),
              }),
            "Потребности созданы по строкам сметы",
          )
        }
      >
        <b>Создать по смете</b>
        <Select name="projectId">
          {projects.map((x) => (
            <option key={x.id} value={x.id}>
              {x.number}
            </option>
          ))}
        </Select>
        <Select name="estimateId">
          {estimates.map((x) => (
            <option key={x.id} value={x.id}>
              Смета v{x.version}
            </option>
          ))}
        </Select>
        <Select name="installationId" required={false}>
          <option value="">Без монтажа</option>
          {installations.map((x) => (
            <option key={x.id} value={x.id}>
              {new Date(x.startsAt).toLocaleDateString("ru-RU")}
            </option>
          ))}
        </Select>
        <Button disabled={s.pending}>Сформировать</Button>
      </form>
    </div>
  );
}

export function RequirementActions({
  requirementId,
  locations,
  reservations,
  maxReturn,
}: {
  requirementId: string;
  locations: Option[];
  reservations: { id: string; label: string }[];
  maxReturn: number;
}) {
  const s = useSubmit();
  return (
    <div className="grid gap-3 border-t pt-3">
      <form
        className="grid gap-2 sm:grid-cols-3"
        action={(d) =>
          s.run(
            () =>
              reserveRequirementAction({
                requirementId,
                locationId: d.get("locationId"),
                quantity: d.get("quantity"),
              }),
            "Материал зарезервирован",
          )
        }
      >
        <Select name="locationId">
          {locations.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
        <Input
          name="quantity"
          type="number"
          min="0.001"
          step="0.001"
          placeholder="Количество"
          required
        />
        <Button disabled={s.pending}>Резервировать</Button>
      </form>
      <form
        className="grid gap-2 sm:grid-cols-3"
        action={(d) =>
          s.run(
            () =>
              requirementOperationAction({
                requirementId,
                reservationId: d.get("reservationId"),
                operation: d.get("operation"),
                quantity: d.get("quantity"),
                comment: d.get("comment"),
                documentRef: d.get("documentRef"),
              }),
            "Операция проведена",
          )
        }
      >
        <Select name="operation">
          <option value="ISSUE">Выдать монтажнику</option>
          <option value="RELEASE">Снять резерв</option>
          <option value="RETURN">Вернуть</option>
          <option value="CONSUMPTION">Использовано</option>
          <option value="WRITE_OFF">Списано</option>
        </Select>
        <Select name="reservationId" required={false}>
          <option value="">Без резерва (возврат/расход)</option>
          {reservations.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </Select>
        <Input
          name="quantity"
          type="number"
          min="0.001"
          max={maxReturn || undefined}
          step="0.001"
          placeholder="Количество"
          required
        />
        <Input name="documentRef" placeholder="Документ" />
        <Input name="comment" placeholder="Комментарий" required />
        <Button disabled={s.pending}>Провести</Button>
      </form>
    </div>
  );
}

export function PurchaseOrderForm({
  suppliers,
  items,
}: {
  suppliers: Option[];
  items: ItemOption[];
}) {
  const s = useSubmit();
  return (
    <form
      className="grid gap-2 rounded-2xl border p-4 sm:grid-cols-3"
      action={(d) =>
        s.run(
          () =>
            createPurchaseOrderAction({
              number: d.get("number"),
              supplierId: d.get("supplierId"),
              itemId: d.get("itemId"),
              ordered: d.get("ordered"),
              unitPrice: d.get("unitPrice"),
              expectedAt: d.get("expectedAt"),
              documentRef: d.get("documentRef"),
              comment: d.get("comment"),
            }),
          "Заказ поставщику создан",
        )
      }
    >
      <b className="sm:col-span-3">Ожидаемая поставка</b>
      <Input name="number" placeholder="Номер заказа" required />
      <Select name="supplierId">
        {suppliers.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="itemId">
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Input
        name="ordered"
        type="number"
        min="0.001"
        step="0.001"
        placeholder="Количество"
        required
      />
      <Input
        name="unitPrice"
        type="number"
        min="0"
        step="0.01"
        placeholder="Цена"
        required
      />
      <Input name="expectedAt" type="datetime-local" required />
      <Input name="documentRef" placeholder="Документ" />
      <Input name="comment" placeholder="Комментарий" />
      <Button disabled={s.pending}>Создать заказ</Button>
    </form>
  );
}
