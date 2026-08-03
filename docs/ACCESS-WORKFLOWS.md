# Доступ, процессы и эксплуатационная архитектура

Этот документ является второй частью [ARCHITECTURE.md](./ARCHITECTURE.md) и имеет тот же статус архитектурного технического задания.

## 6. Модель прав доступа

### 6.1. Алгоритм авторизации

Для каждого запроса сервер выполняет один и тот же порядок:

1. Проверяет действующую database session, `User.isActive`, `blockedAt`, срок роли и `sessionVersion`.
2. Определяет permission: сначала действующий пользовательский `DENY`, затем пользовательский `ALLOW`, затем объединение разрешений всех действующих ролей. `DENY` всегда побеждает; роль `ADMIN` не обходит явный запрет автоматически.
3. Применяет policy области данных (`ALL`, `OWN_CREATED`, `ASSIGNED`, `MANAGED_TEAM`, `NONE`) непосредственно в запросе репозитория.
4. Строит безопасный DTO по чувствительности полей. Prisma-модель целиком никогда не передаётся в Client Component.
5. Для мутации повторно загружает целевую запись с policy-фильтром, валидирует Zod-команду, проверяет бизнес-инварианты, выполняет транзакцию и пишет аудит.

Проверка в middleware не считается авторизацией: middleware только отправляет анонимного пользователя на login. Проверки permissions, scope и владения выполняются в application service на сервере для Server Actions и Route Handlers одинаково.

### 6.2. Условные обозначения матрицы

- `●` — разрешено ролью по умолчанию.
- `◐` — ограничено областью данных или требует отдельного permission/условия; пояснение указано в строке.
- `—` — запрещено; поле отсутствует в API/DTO, а не только скрыто в UI.

| Возможность                          | ADMIN |                PROMOTER                 |              AD_OPERATOR              |             MEASURER              |             INSTALLER             |    WAREHOUSE_MANAGER    |              FINANCE_MANAGER               |           MANAGER            |
| ------------------------------------ | :---: | :-------------------------------------: | :-----------------------------------: | :-------------------------------: | :-------------------------------: | :---------------------: | :----------------------------------------: | :--------------------------: |
| Создать быстрый лид                  |   ●   |                    ●                    |                   ●                   |                 —                 |                 —                 |            —            |                     —                      |              ◐               |
| Видеть все лиды/проекты              |   ●   |                    —                    |                   ●                   |                 —                 |                 —                 |    ◐ складской scope    |                     ●                      |              ●               |
| Видеть свои созданные лиды           |   ●   |     ◐ только свои, ограниченный DTO     |                   ●                   |                 —                 |                 —                 |            —            |                     —                      |              ●               |
| Редактировать лид после сохранения   |   ●   |                    —                    |        ● до договорного этапа         |                 —                 |                 —                 |            —            |                     —                      |              ◐               |
| Видеть полный телефон клиента        |   ●   |                    —                    |                   ●                   |                 —                 |                 —                 |            —            |      ◐ только с `customer.phone.read`      |              —               |
| Видеть маскированный телефон         |   ●   |                 ● своих                 |                   ●                   | ◐ при необходимости идентификации | ◐ при необходимости идентификации |            —            |                     ●                      |              ◐               |
| Звонки и call log                    |   ●   |                    —                    |                   ●                   |                 —                 |                 —                 |            —            |           ◐ read при фин. сверке           |            ◐ read            |
| Создавать/назначать задачи           |   ●   |                    —                    |                   ●                   |              ◐ свои               |              ◐ свои               |         ◐ свои          |                   ◐ свои                   |              ●               |
| Назначать оператора                  |   ●   |                    —                    |    ◐ при `project.assign.operator`    |                 —                 |                 —                 |            —            |                     —                      |              ●               |
| Назначать/переносить замер           |   ●   |                    —                    |                   ●                   |        ◐ подтверждать свой        |                 —                 |            —            |                     —                      |              ●               |
| Видеть/заполнять замер               |   ●   |                    —                    |                ◐ read                 |       ● только назначенные        |                 —                 |            —            |        ◐ read без тех. избыточности        |            ◐ read            |
| Редактировать помещения/техданные    |   ●   |                    —                    |        ◐ до завершения замера         |        ● назначенный замер        |                 —                 |            —            |                     —                      |              ◐               |
| Создавать/выпускать смету            |   ●   |                    —                    |     ◐ подготовка без cost/profit      |    ◐ ввод количества, без цен     |                 —                 |            —            |                     ●                      | ◐ read/approve по permission |
| Видеть цену договора                 |   ●   |                    —                    |  ◐ договорная цена, без cost/profit   |                 —                 |                 —                 |            —            |                     ●                      | ◐ `finance.read` только read |
| Видеть себестоимость/прибыль         |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |                     ●                      | ◐ `finance.read` только read |
| Регистрировать платеж/возврат        |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |                     ●                      |              —               |
| Утверждать финоперации               |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            | ◐ `finance.approve` и separation of duties |              —               |
| Видеть рекламный источник/промоутера |   ●   |          ◐ только в своём лиде          |                   ●                   |                 —                 |                 —                 |            —            |         ◐ аналитика по permission          |              ●               |
| Видеть внутренние комментарии        |   ●   |                    —                    | ◐ `GENERAL`/`INTERNAL`, не management |         ◐ тех. `GENERAL`          |                 —                 |       ◐ складские       |                ◐ финансовые                |              ●               |
| Видеть management notes              |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |   ◐ если `project.management_notes.read`   |              ●               |
| Планировать монтаж/бригаду           |   ●   |                    —                    |                   ◐                   |                 —                 |        ◐ подтверждать свой        | ◐ готовность материалов |                     —                      |              ●               |
| Видеть техзадание монтажа            |   ●   |                    —                    |                   ◐                   |       ◐ назначенные проекты       |       ● только назначенные        |    ◐ комплектование     |                     —                      |              ●               |
| Завершать монтаж                     |   ●   |                    —                    |                   —                   |                 —                 |           ● назначенный           |            —            |                     —                      |          ◐ контроль          |
| Складские остатки без закупочных цен |   ●   |                    —                    |       ◐ доступность по проекту        |                 —                 |        ◐ выданное бригаде         |            ●            |                     ●                      |              ●               |
| Закупочные цены                      |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |                     ●                      |       ◐ `finance.read`       |
| Движения/резервы склада              |   ●   |                    —                    |                   —                   |                 —                 |   ◐ подтвердить выдачу/возврат    |            ●            |                   ◐ read                   |            ◐ read            |
| Заказы поставщикам                   |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |  ◐ количества, без цен  |             ● финансовая часть             |        ◐ approve/read        |
| Общий календарь                      |   ●   | ◐ только свои follow-up статусы без PII |                   ●                   |       ◐ только свои замеры        |       ◐ только свои монтажи       |    ◐ доставки/склад     |           ◐ разрешённые события            |              ●               |
| Аналитика                            |   ●   |  ◐ только счётчики/статусы своих лидов  |      ◐ операционная без финансов      |                 —                 |                 —                 |       ◐ складская       |                ● финансовая                |      ◐ по `analytics.*`      |
| Пользователи/роли/permissions        |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |                     —                      |              —               |
| Блокировка/сброс пароля              |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |                     —                      |              —               |
| AuditLog/SecurityEvent               |   ●   |                    —                    |                   —                   |                 —                 |                 —                 |            —            |      ◐ финансовый аудит своего домена      |        ◐ `audit.read`        |

PROMOTER видит полный номер только в полях формы до отправки, потому что сам его вводит. Успешный ответ `createLead` возвращает `leadId`, номер заявки и маску; последующие query не возвращают ciphertext или полный номер. MEASURER и INSTALLER не получают полный номер даже при ручном вызове endpoint. Для связи используется оператор или, если бизнес выберет такую функцию, серверная «слепая связь» через телефонию без раскрытия номера.

### 6.3. Базовый каталог permissions

```text
user.read, user.create, user.update, user.block, user.password.reset
role.read, role.manage, permission.manage
lead.create, lead.read.all, lead.read.own, lead.update, lead.accept
customer.read, customer.update, customer.phone.read, customer.pii.export
project.read.all, project.read.assigned, project.read.own_created
project.update.sales, project.update.technical, project.transition
project.assign.operator, project.assign.measurer, project.assign.installer
project.source.read, project.internal_notes.read, project.management_notes.read
measurement.read.all, measurement.read.assigned, measurement.update.assigned, measurement.complete
estimate.read.sale, estimate.read.cost, estimate.create, estimate.prepare, estimate.accept
installation.read.all, installation.read.assigned, installation.schedule, installation.complete
inventory.read, inventory.price.purchase.read, inventory.item.manage
inventory.reserve, inventory.issue, inventory.return, inventory.consume
inventory.adjust, inventory.transfer, procurement.manage, procurement.price.manage
finance.read, finance.payment.post, finance.expense.post, finance.approve
calendar.read.all, calendar.read.assigned, calendar.manage, schedule.override_conflict
file.upload, file.read.project, file.read.management, file.read.finance
analytics.operational, analytics.financial, analytics.staff
audit.read, security_event.read, setting.manage
```

Высокочувствительные permissions (`customer.phone.read`, `customer.pii.export`, `finance.*`, `inventory.adjust`, `audit.read`, `permission.manage`) требуют причины назначения и попадают в аудит. Желательно ограничивать их сроком. Экспорт PII и массовый финансовый экспорт требуют повторной аутентификации.

### 6.4. Политики строк

| Роль/контекст     | Фильтр репозитория                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PROMOTER          | `Lead.promoterId = session.userId`; возвращаются только номер, createdAt и разрешённый публичный status bucket                                                           |
| MEASURER          | существует активный `ProjectAssignment(type=MEASURER, userId)` или `Measurement.measurerId = userId`                                                                     |
| INSTALLER         | существует активный `ProjectAssignment(type=INSTALLER, userId, installationId)`; доступ начинается после назначения и заканчивается после retention, заданного политикой |
| WAREHOUSE_MANAGER | проекты только через незакрытые `ProjectMaterial`, `StockReservation`, delivery/warehouse tasks; DTO без клиентского телефона и финансов                                 |
| AD_OPERATOR       | все активные лиды/проекты продаж; архив и management-only заметки отдельно запрещены                                                                                     |
| FINANCE_MANAGER   | проекты, у которых есть договор/финансовая операция; технические поля минимизированы                                                                                     |
| MANAGER           | все управляемые проекты; телефон всё равно исключён, финансовые поля только с `finance.read`                                                                             |
| ADMIN             | все строки, кроме явно запрещённого персонального override или особо защищённого break-glass режима                                                                      |

Статусы PROMOTER сворачиваются в безопасные группы: `RECEIVED`, `IN_WORK`, `MEASUREMENT`, `WON`, `LOST`; внутренние подробности, причины, расписание и ответственные не выдаются.

## 7. Автомат статусов проекта

Единственная операция смены статуса — `transitionProject(command)`. Прямое обновление `Project.status` запрещено repository API. Операция блокирует строку проекта, проверяет текущую версию, permission, допустимое ребро и guards, обновляет status, добавляет `ProjectStatusHistory` и `OutboxEvent` в одной транзакции.

### 7.1. Допустимые переходы

| Из                         | В                                            | Кто/permission                                   | Обязательные условия                                                                                                                                 |
| -------------------------- | -------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEW_LEAD`                 | `CALL_REQUIRED`                              | AD_OPERATOR/MANAGER/ADMIN                        | назначен активный оператор; лид принят оператором                                                                                                    |
| `NEW_LEAD`                 | `REJECTED`                                   | AD_OPERATOR/MANAGER/ADMIN                        | причина отказа и комментарий, если требует справочник                                                                                                |
| `NEW_LEAD`                 | `CANCELLED`                                  | MANAGER/ADMIN                                    | причина отмены                                                                                                                                       |
| `CALL_REQUIRED`            | `NO_ANSWER`                                  | AD_OPERATOR                                      | создан `CallLog(NO_ANSWER)`; увеличен счётчик попыток                                                                                                |
| `CALL_REQUIRED`            | `CALLBACK_SCHEDULED`                         | AD_OPERATOR                                      | `nextCallAt` в будущем, задача/CalendarEvent и ответственный                                                                                         |
| `CALL_REQUIRED`            | `MEASUREMENT_SCHEDULED`                      | AD_OPERATOR/MANAGER                              | дата начала/окончания, адрес, замерщик, отсутствие неразрешённого конфликта                                                                          |
| `CALL_REQUIRED`            | `REJECTED`/`CANCELLED`                       | AD_OPERATOR для reject; MANAGER/ADMIN для cancel | причина                                                                                                                                              |
| `NO_ANSWER`                | `CALL_REQUIRED`                              | AD_OPERATOR/system                               | новая попытка звонка                                                                                                                                 |
| `NO_ANSWER`                | `CALLBACK_SCHEDULED`                         | AD_OPERATOR                                      | дата/задача/ответственный                                                                                                                            |
| `NO_ANSWER`                | `REJECTED`                                   | AD_OPERATOR/MANAGER                              | достигнут настраиваемый лимит попыток либо причина override                                                                                          |
| `CALLBACK_SCHEDULED`       | `CALL_REQUIRED`                              | AD_OPERATOR/system                               | наступило время звонка                                                                                                                               |
| `CALLBACK_SCHEDULED`       | `NO_ANSWER`                                  | AD_OPERATOR                                      | call log                                                                                                                                             |
| `CALLBACK_SCHEDULED`       | `MEASUREMENT_SCHEDULED`                      | AD_OPERATOR/MANAGER                              | дата, интервал, адрес, замерщик, конфликт проверен                                                                                                   |
| `CALLBACK_SCHEDULED`       | `REJECTED`/`CANCELLED`                       | по политике выше                                 | причина                                                                                                                                              |
| `MEASUREMENT_SCHEDULED`    | `MEASUREMENT_COMPLETED`                      | назначенный MEASURER/MANAGER/ADMIN               | завершённый Measurement; минимум одна активная комната; валидные площадь/периметр; обязательный техкомментарий/фото по checklist                     |
| `MEASUREMENT_SCHEDULED`    | `CALL_REQUIRED`                              | AD_OPERATOR/MANAGER                              | клиент отменил/не явился; закрыто или перенесено событие, причина                                                                                    |
| `MEASUREMENT_SCHEDULED`    | `REJECTED`/`CANCELLED`                       | AD_OPERATOR или MANAGER/ADMIN                    | причина; календарное событие отменено                                                                                                                |
| `MEASUREMENT_COMPLETED`    | `ESTIMATE_PREPARED`                          | AD_OPERATOR/FINANCE/MANAGER/ADMIN по permissions | существует выпущенная смета `PREPARED`, прошедшая серверный расчёт                                                                                   |
| `MEASUREMENT_COMPLETED`    | `MEASUREMENT_SCHEDULED`                      | MANAGER/ADMIN                                    | оформлен повторный замер и причина                                                                                                                   |
| `MEASUREMENT_COMPLETED`    | `REJECTED`                                   | AD_OPERATOR/MANAGER                              | причина                                                                                                                                              |
| `ESTIMATE_PREPARED`        | `WAITING_FOR_CUSTOMER`                       | AD_OPERATOR/MANAGER                              | смета отмечена отправленной/озвученной, создан follow-up                                                                                             |
| `ESTIMATE_PREPARED`        | `CONTRACT_SIGNED`                            | AD_OPERATOR/MANAGER/ADMIN                        | принята актуальная смета; `contractPrice > 0`; валюта; дата и подтверждение договора/вложение по политике                                            |
| `ESTIMATE_PREPARED`        | `MEASUREMENT_SCHEDULED`                      | MANAGER/ADMIN                                    | нужен повторный замер, причина                                                                                                                       |
| `ESTIMATE_PREPARED`        | `REJECTED`                                   | AD_OPERATOR/MANAGER                              | причина                                                                                                                                              |
| `WAITING_FOR_CUSTOMER`     | `ESTIMATE_PREPARED`                          | AD_OPERATOR/estimate permission                  | выпущена новая версия сметы                                                                                                                          |
| `WAITING_FOR_CUSTOMER`     | `CONTRACT_SIGNED`                            | AD_OPERATOR/MANAGER/ADMIN                        | те же contract guards                                                                                                                                |
| `WAITING_FOR_CUSTOMER`     | `CALLBACK_SCHEDULED`                         | AD_OPERATOR                                      | согласован новый контакт                                                                                                                             |
| `WAITING_FOR_CUSTOMER`     | `REJECTED`/`CANCELLED`                       | по политике                                      | причина                                                                                                                                              |
| `CONTRACT_SIGNED`          | `PRODUCTION_PREPARATION`                     | AD_OPERATOR/MANAGER/ADMIN                        | договор действителен; требуемая предоплата получена либо оформлен разрешённый override                                                               |
| `CONTRACT_SIGNED`          | `CANCELLED`                                  | MANAGER/ADMIN                                    | причина, освобождение резервов, финансовый план возврата/неустойки                                                                                   |
| `PRODUCTION_PREPARATION`   | `MATERIALS_RESERVED`                         | WAREHOUSE_MANAGER/MANAGER/ADMIN                  | все обязательные `ProjectMaterial` полностью зарезервированы активными резервами в одной транзакции                                                  |
| `PRODUCTION_PREPARATION`   | `ESTIMATE_PREPARED`                          | MANAGER/ADMIN                                    | договор изменяется: новая версия сметы/допсоглашение; причина                                                                                        |
| `PRODUCTION_PREPARATION`   | `CANCELLED`                                  | MANAGER/ADMIN                                    | причина и финансово-складская компенсация                                                                                                            |
| `MATERIALS_RESERVED`       | `READY_FOR_INSTALLATION`                     | WAREHOUSE_MANAGER/MANAGER/ADMIN                  | техзадание комплектно; материалы/производство готовы; нет дефицита                                                                                   |
| `MATERIALS_RESERVED`       | `PRODUCTION_PREPARATION`                     | WAREHOUSE_MANAGER/MANAGER                        | резервы освобождены/изменены, причина                                                                                                                |
| `MATERIALS_RESERVED`       | `CANCELLED`                                  | MANAGER/ADMIN                                    | все резервы освобождены, причина                                                                                                                     |
| `READY_FOR_INSTALLATION`   | `INSTALLATION_SCHEDULED`                     | AD_OPERATOR/MANAGER/ADMIN                        | дата/интервал, хотя бы один монтажник, подтверждённое техзадание, конфликт проверен                                                                  |
| `READY_FOR_INSTALLATION`   | `PRODUCTION_PREPARATION`                     | MANAGER/ADMIN                                    | изменение комплектации, причина                                                                                                                      |
| `INSTALLATION_SCHEDULED`   | `INSTALLATION_IN_PROGRESS`                   | назначенный INSTALLER/MANAGER/ADMIN              | наступило допустимое время; Installation начат; материалы выданы либо override                                                                       |
| `INSTALLATION_SCHEDULED`   | `READY_FOR_INSTALLATION`                     | AD_OPERATOR/MANAGER                              | перенос: старое событие отменено, причина                                                                                                            |
| `INSTALLATION_SCHEDULED`   | `CANCELLED`                                  | MANAGER/ADMIN                                    | причина, закрыты выдачи/резервы/финансы                                                                                                              |
| `INSTALLATION_IN_PROGRESS` | `INSTALLATION_COMPLETED`                     | назначенный INSTALLER/MANAGER/ADMIN              | checklist, фактическое время, расход/возврат материалов, акт/фото по политике                                                                        |
| `INSTALLATION_IN_PROGRESS` | `REWORK_REQUIRED`                            | INSTALLER сообщает; MANAGER/ADMIN подтверждает   | причина переделки, scope работ, создана новая Installation типа REWORK                                                                               |
| `INSTALLATION_COMPLETED`   | `CLOSED`                                     | FINANCE_MANAGER/MANAGER/ADMIN                    | Installation completed; обязательные документы; `balanceDue = 0` либо утверждён финансовый override; нет активных задач/резервов/выданных материалов |
| `INSTALLATION_COMPLETED`   | `REWORK_REQUIRED`                            | MANAGER/ADMIN                                    | подтверждён дефект/рекламация и создан rework                                                                                                        |
| `REWORK_REQUIRED`          | `INSTALLATION_SCHEDULED`                     | MANAGER/ADMIN                                    | rework-техзадание, дата, бригада, материалы, конфликт проверен                                                                                       |
| `REWORK_REQUIRED`          | `INSTALLATION_IN_PROGRESS`                   | назначенный INSTALLER                            | только для уже запланированного rework Installation                                                                                                  |
| `CLOSED`                   | `REWORK_REQUIRED`                            | MANAGER/ADMIN с `project.reopen`                 | рекламация, причина, аудит; финальные KPI пересчитываются                                                                                            |
| `REJECTED`                 | `CALL_REQUIRED`                              | MANAGER/ADMIN с `project.reopen`                 | причина возобновления, новый оператор; rejection остаётся в истории                                                                                  |
| `CANCELLED`                | `CALL_REQUIRED` или `PRODUCTION_PREPARATION` | ADMIN с `project.reopen`                         | явная причина; целевой этап определяется наличием действующего договора; проверка финансов/склада                                                    |

Перенос времени при том же бизнес-статусе — отдельная команда `rescheduleMeasurement`/`rescheduleInstallation`, а не self-transition. Любой административный override содержит permission, текстовую причину и запись аудита.

### 7.2. Инварианты статусов

- `rejectionReasonId` обязателен только для текущего `REJECTED`, но история причин сохраняется всегда.
- После `CONTRACT_SIGNED` изменение договорной суммы возможно только новой принятой сметой/допсоглашением, а не редактированием числа.
- `MATERIALS_RESERVED` означает полное покрытие обязательных материалов, а не наличие хотя бы одного резерва.
- `INSTALLATION_SCHEDULED` требует активные назначения монтажников на конкретную `Installation`.
- `CLOSED` не является физической блокировкой истории: разрешены платежный возврат, рекламация и корректирующие финансовые записи, после которых статус/финансовый status пересматриваются по регламенту.
- `REJECTED` — отказ до производственных обязательств; `CANCELLED` — отмена пользователем/компанией, особенно после договора. Причины не смешиваются в аналитике.

## 8. Архитектура склада

### 8.1. Семантика агрегатов

`onHandQty` — всё количество под материальной ответственностью компании: физически на складе плюс выданное бригаде, но ещё не потреблённое. `issuedQty` — часть `onHandQty`, находящаяся у бригад/в транзите. Поэтому требуемая формула не вычитает выдачу дважды:

```text
availableQty = onHandQty - reservedQty - issuedQty
warehousePhysicalQty = onHandQty - issuedQty
```

`expectedQty` — открытый остаток утверждённых PurchaseOrder (`orderedQty - receivedQty`), он не участвует в доступном остатке. `InventoryBalance` хранит те же показатели по локации, `InventoryItem` — транзакционно обновляемую глобальную сумму.

### 8.2. Влияние движений

| Движение              | Агрегаты                                                                       | Обязательные ссылки                                                    |
| --------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `RECEIPT`             | `onHand += q`, `expected -= min(q, openPOQty)`                                 | toLocation; PO item для закупки или reason для иного прихода           |
| `RESERVATION`         | `reserved += q`, `available -= q`                                              | project, ProjectMaterial, reservation, location                        |
| `RESERVATION_RELEASE` | `reserved -= q`, `available += q`                                              | reservation, причина                                                   |
| `ISSUE`               | `reserved -= q`, `issued += q`; onHand не меняется                             | active reservation, project, from warehouse, to crew/transit           |
| `RETURN`              | `issued -= q`; onHand не меняется; available растёт                            | исходная выдача/project, from crew, to warehouse                       |
| `CONSUMPTION`         | `issued -= q`, `onHand -= q`; available не меняется                            | project/material, ранее выданное количество                            |
| `WRITE_OFF`           | `onHand -= q`, следовательно available уменьшается                             | warehouse location, reason, повышенное permission                      |
| `ADJUSTMENT`          | `onHand += q` или `-= q` по `adjustmentDirection`                              | инвентаризация, reason, approval; не используется вместо обычных типов |
| `TRANSFER`            | глобальные агрегаты не меняются; баланс у from уменьшается, у to увеличивается | разные from/to locations                                               |

Для `ADJUSTMENT` модель `StockMovement` дополняется `adjustmentDirection INCREASE|DECREASE`. Для полноценного multi-location учёта рядом с `InventoryItem` обязательна поддерживающая сущность `InventoryBalance(inventoryItemId, locationId, onHandQty, reservedQty, issuedQty, availableQty, version)` с составным PK; агрегаты `InventoryItem` являются суммой balances.

### 8.3. Транзакционный резерв

Команда `reserveProjectMaterials(projectId, lines, idempotencyKey)`:

1. Проверяет `inventory.reserve`, доступ к проекту, статус `PRODUCTION_PREPARATION`/разрешённый подготовительный режим и Zod-схему.
2. Начинает транзакцию PostgreSQL. Все пары item/location сортируются по UUID, чтобы одинаковый порядок блокировок снижал deadlock.
3. Проверяет `idempotencyKey`; повтор возвращает исходный результат, а не создаёт второй резерв.
4. Выполняет `SELECT ... FOR UPDATE` нужных `InventoryBalance`, затем `InventoryItem` и `ProjectMaterial`.
5. Заново считает `available = onHand - reserved - issued`. Если хотя бы одной обязательной позиции недостаточно и не разрешён частичный режим, вся транзакция откатывается с перечнем дефицита.
6. Создаёт `StockReservation` и `StockMovement(RESERVATION)` для каждой строки; обновляет balance/item/project material и их `version`.
7. Если покрыты все обязательные `ProjectMaterial`, той же транзакцией разрешается переход в `MATERIALS_RESERVED`; частичный резерв оставляет `PRODUCTION_PREPARATION`.
8. Создаёт audit/outbox и фиксирует транзакцию. При serialization/deadlock conflict сервис делает ограниченный retry с jitter.

Запрос чтения перед транзакцией не является гарантией наличия. Гарантия появляется только после блокировки и повторной проверки внутри транзакции.

### 8.4. Остальные операции

- Выдача может ссылаться только на активный резерв и не превышать его остаток; создаётся `ISSUE` и custody-локация бригады.
- Потребление и возврат не могут суммарно превысить выдачу по проекту/позиции.
- Освобождение возможно только для невыданной части. Отмена проекта запускает обязательную компенсацию резервов; выданное сначала возвращается/списывается.
- Transfer блокирует обе локации в детерминированном порядке.
- Корректировка требует `inventory.adjust`, причины, фактического пересчёта и, выше настраиваемого порога, второго утверждающего. Автор не утверждает собственную крупную корректировку.
- Отрицательные остатки по умолчанию запрещены CHECK и application guard. Если бизнес разрешит аварийный минус, это отдельная настройка и отчёт исключений, а не неявное поведение.
- Фоновая сверка пересчитывает balances по журналу и сравнивает кэш; она сообщает расхождение, но не «чинит» его молча.
- Низкий остаток: `availableQty < minimumQty`; дефицит проекта: `required - reserved > available` с учётом приоритетов и ожидаемых поставок только как прогноза.

## 9. Настраиваемый калькулятор

### 9.1. Конфигурация

Тарифы группируются в immutable `PriceBook`. Администратор клонирует активную версию в `DRAFT`, редактирует и проходит валидацию полноты/пересечений conditions, затем атомарно активирует с `validFrom`. Старый прайс получает `validTo` и остаётся доступен старым сметам.

Каждый `Tariff` содержит продажную и себестоимостную ставки, единицу и условия выбора. Conditions валидируются дискриминированной Zod-схемой, а не произвольным JSON: например `canvasType/manufacturer/texture`, `profileType`, диапазон расстояния, `chargeCornersAbove`, или код дополнительной работы. Приоритеты/диапазоны не должны неоднозначно совпадать; тест активации строит диагностический отчёт.

### 9.2. Расчёт

Для каждой активной комнаты движок создаёт отдельные строки:

```text
canvas       = area × canvasAreaRate(attributes)
perimeter    = perimeter × perimeterRate
profile      = profileLength × profileRate(profileType)
corners      = max(0, cornerCount - includedCorners) × cornerRate
pipes        = pipeCount × pipeRate
lights       = lightCount × lightRate
chandeliers  = chandelierCount × chandelierRate
cornices     = corniceCount/length × matchingTariff
niches       = nicheCount/length × matchingTariff
tracks       = trackSystemCount/length × matchingTariff
extras       = Σ(additionalWork.quantity × tariff(code))
roomSubtotal = complexityPolicy(applicable lines, complexityCoefficient)
```

В первой версии коэффициент сложности умножает только строки с `conditions.complexityApplicable = true`; тарифы и допработы могут исключаться. Это лучше, чем безусловно умножать весь заказ, но правило нужно подтвердить до реализации.

Расстояние вычисляется сервером от базовой точки организации до координат проекта или вводится с разрешённым подтверждением:

```text
outsideKm    = max(0, routeKm - baseZoneRadiusKm)
travelAmount = tariffByDistanceBand(outsideKm)
itemsSubtotal = Σ(room line saleAmount)
eligibleDiscount = apply(discount, discountEligible lines)
discountedItems = itemsSubtotal - eligibleDiscount
minimumAdjustment = max(0, minimumOrderAmount - discountedItems)
total = discountedItems + minimumAdjustment + travelAmount
```

Принятое предварительное правило: выезд не участвует в скидке и не засчитывается в минимальный заказ. Скидка ограничивается permission и максимальным процентом в настройках. Округление выполняется до копеек по каждой итоговой строке `HALF_UP`, затем суммы складываются; правило фиксируется в `algorithmVersion`.

Себестоимость рассчитывается параллельно по `costRate`; `estimatedProfit = total - estimatedCost`. AD_OPERATOR получает только sale-часть DTO. После фактических расходов и складского потребления проект использует фактическую, а не оценочную прибыль.

### 9.3. Снимок и воспроизводимость

При `prepareEstimate` сохраняются:

- нормализованный `inputSnapshot` всех комнат, расстояния, скидки и применимых настроек;
- `tariffSnapshot` только использованных тарифов с IDs, codes, rates, conditions и version PriceBook;
- полные `EstimateItem`, результаты промежуточных формул и округлений;
- `algorithmVersion`, timezone, currency, автор и время;
- checksum снимка для обнаружения случайной порчи.

`previewEstimate` ничего не фиксирует и помечает результат как preview. `prepareEstimate` повторно считает всё на сервере; суммы от клиента игнорируются. Изменение комнаты после выпуска показывает, что смета устарела, но не меняет её. Новая версия ссылается на `supersedesEstimateId`.

## 10. Календарь и конфликты

Календарь — read model над `CalendarEvent`, но источниками остаются Measurement, Installation, Task, CallLog follow-up и PurchaseOrder delivery. Создание/перенос источника и события выполняется одной транзакцией; ручные события имеют `sourceEntityType=MANUAL`.

Серверный query всегда применяет scope участников и затем field redaction. Назначенный сотрудник видит только необходимый заголовок, интервал, адрес/технические данные согласно роли; агрегированный календарь не должен стать обходом RBAC карточки проекта.

Проверка конфликтов использует полуоткрытые интервалы `[start, end)`, поэтому событие в 12:00 может следовать за событием, окончившимся в 12:00. Учитываются cancelled events, timezone/DST, required participants и настраиваемые buffer до/после выезда. Ответ конфликта содержит только безопасные сведения о занятом интервале, не данные чужого клиента.

## 11. Application API и Server Actions

### 11.1. Общие правила контрактов

- Server Action — тонкий адаптер: `auth → parse Zod → application service → safe result`.
- Запросы Server Components вызывают query services напрямую, не делают HTTP к собственному приложению.
- Команды принимают только явные поля; `...input` в Prisma `data` запрещён.
- Результат имеет union `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors?, requestId } }`.
- Внешние ошибки не содержат stack, SQL, ciphertext, существование недоступной записи. Для IDOR возвращается единообразный `NOT_FOUND`.
- Мутации платежей, склада, импорта и webhooks требуют idempotency key.
- List query использует cursor pagination, ограниченный `take`, allow-list сортировок и фильтров.

### 11.2. Команды и запросы по модулям

| Модуль       | Основные операции                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth/Users   | `signIn`, `signOut`, `createUser`, `updateUser`, `blockUser`, `unblockUser`, `resetPassword`, `revokeSessions`, `assignRoles`, `setUserPermission`, `listSecurityEvents`                                                                              |
| CRM          | `createLead`, `acceptLead`, `listLeads`, `getLeadSafe`, `logCall`, `scheduleCallback`, `rejectProject`, `reopenRejectedProject`                                                                                                                       |
| Projects     | `getProject`, `listProjects`, `updateProjectContact`, `updateProjectAddress`, `transitionProject`, `assignOperator`, `assignMeasurer`, `assignInstallers`, `addComment`, `getStatusHistory`, `getAssignmentHistory`                                   |
| Measurement  | `scheduleMeasurement`, `rescheduleMeasurement`, `startMeasurement`, `upsertRoom`, `archiveRoom`, `completeMeasurement`, `getAssignedMeasurements`                                                                                                     |
| Estimates    | `previewEstimate`, `saveEstimateDraft`, `prepareEstimate`, `sendEstimate`, `acceptEstimate`, `clonePriceBook`, `updateDraftTariff`, `activatePriceBook`                                                                                               |
| Installation | `scheduleInstallation`, `rescheduleInstallation`, `startInstallation`, `completeInstallation`, `requireRework`, `getAssignedInstallations`                                                                                                            |
| Inventory    | `listInventory`, `createInventoryItem`, `planProjectMaterials`, `reserveProjectMaterials`, `releaseReservation`, `issueMaterials`, `returnMaterials`, `consumeMaterials`, `writeOff`, `adjustStock`, `transferStock`, `inventoryReconciliationReport` |
| Procurement  | `createPurchaseOrder`, `approvePurchaseOrder`, `markOrdered`, `receivePurchaseOrder`, `cancelPurchaseOrder`                                                                                                                                           |
| Finance      | `postPayment`, `refundPayment`, `createExpense`, `approveExpense`, `postExpense`, `reverseExpense`, `getProjectFinance`, `reconcileProjectFinance`                                                                                                    |
| Calendar     | `listCalendarEvents`, `checkConflicts`, `createManualEvent`, `rescheduleEvent`, `cancelEvent`                                                                                                                                                         |
| Files        | `initiateUpload`, `completeUpload`, `getDownloadUrl`, `archiveFile`, `listProjectFiles`                                                                                                                                                               |
| Analytics    | `getSalesFunnel`, `getLeadBreakdown`, `getFinancialKpis`, `getInventoryKpis`, `getStaffUtilization`; только агрегаты с permission/минимальным размером группы                                                                                         |
| Audit        | `listAuditLogs`, `getEntityAuditTrail`, `exportAudit` с отдельным permission                                                                                                                                                                          |

### 11.3. Route Handlers

```text
/api/auth/[...nextauth]         Auth.js
/api/files/upload-url           короткоживущий presigned PUT после permission/MIME/size check
/api/files/{id}/download-url    signed GET только после object-level policy
/api/files/{id}/complete        проверка объекта, enqueue scan
/api/webhooks/telephony         подпись, replay protection, idempotency
/api/webhooks/payments          только при будущей интеграции; подпись и raw body
/api/exports/{jobId}            авторизованная выдача готового экспорта
/api/health/live                процесс жив; без секретов
/api/health/ready               DB/S3 readiness, защищён подробный вывод
```

Внешний REST/GraphQL API не нужен в v1. Если появится мобильный клиент или партнёр, публикуется версионированный `/api/v1` поверх тех же use cases, а не прямой Prisma CRUD.

## 12. Схема безопасности

### 12.1. Аутентификация и сессии

- Auth.js с database sessions; Credentials provider только поверх собственного безопасного password service.
- Пароли хэшируются Argon2id с параметрами, подобранными нагрузочным тестом; pepper хранится в secret manager. Старый hash перехэшируется после успешного входа при смене параметров.
- Требования длины, проверка распространённых/скомпрометированных паролей без хранения исходного значения; безопасный одноразовый reset token хранится только как hash, короткий TTL, все сессии после reset отзываются.
- Rate limit одновременно по HMAC(email), IP/subnet и глобальной аномалии; одинаковое сообщение для неизвестного пользователя/неверного пароля; экспоненциальная задержка и временная блокировка без возможности массового DoS постоянной блокировкой.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax/Strict` по сценарию; session rotation после входа/смены ролей; `sessionVersion` немедленно инвалидирует старые сессии.
- MFA обязательно рекомендуется для ADMIN и FINANCE_MANAGER; точный фактор фиксируется до реализации.

### 12.2. Авторизация, PII и IDOR

- Все queries получают `AuthContext`; repository methods требуют policy predicate, а не возвращают unrestricted query builder UI-слою.
- Телефоны нормализуются к E.164, шифруются envelope encryption (AES-256-GCM с уникальным nonce и key version), blind index — HMAC-SHA-256 отдельным ключом. Ключи не находятся в БД.
- Маска строится после расшифрования в доверенном server-only модуле либо хранится отдельным несекретным snapshot; ciphertext никогда не сериализуется.
- Логи, error reporting, analytics events, notification payload и audit очищаются централизованным redactor.
- Для каждого `/{id}` сначала выполняется scoped lookup. Недоступная и несуществующая запись внешне одинаковы. Signed URL выдаётся только после такой же проверки и живёт минуты.
- Data export, изменение permissions, просмотр полного PII и крупные финансовые/складские корректировки являются отдельными auditable действиями; массовые выгрузки не разрешаются обычным `read`.

### 12.3. CSRF, XSS и транспорт

- Auth.js механизмы CSRF используются для auth routes. Server Actions дополнительно полагаются на same-site cookies, проверку `Origin/Host` и разрешённые origins; state-changing GET запрещены.
- CSP с nonce, запрет inline script без nonce, `frame-ancestors 'none'`, `object-src 'none'`; `X-Content-Type-Options: nosniff`, Referrer Policy, HSTS на production.
- Пользовательские комментарии отображаются как текст. Если понадобится rich text, используется строгий sanitizer и allow-list; HTML не хранится/не рендерится напрямую.
- Только HTTPS, доверенные proxy headers задаются явным allow-list; CORS закрыт для внутренних endpoints.

### 12.4. Файлы

1. `initiateUpload` проверяет permission, parent object scope, allow-list расширений/MIME и лимит размера; создаёт `PENDING` metadata и presigned key в private quarantine prefix.
2. Клиент грузит объект напрямую в S3. Нельзя выбирать storage key или public ACL.
3. `completeUpload` сверяет размер/checksum, magic bytes (не только заголовок), фактический MIME, декодирование изображения/PDF и запускает malware scan.
4. До `READY` скачивание запрещено. Для изображений сервер может пересобрать безопасную копию и удалить metadata; потенциально активные SVG/HTML запрещены или отдаются только attachment.
5. `getDownloadUrl` повторно проверяет пользователя, родителя и `visibility`, создаёт короткий signed URL с безопасным `Content-Disposition`.
6. Bucket запрещает list/public access, имеет encryption at rest, versioning/lifecycle и отдельные credentials с минимальными правами.

### 12.5. Транзакции, ошибки и аудит

- Финансовые posting/reversal, склад, смена статуса с побочными данными, приёмка PO и создание Lead+Customer+Project выполняются транзакционно.
- Денежная и складская команда имеет unique idempotency key. На уникальном конфликте возвращается результат исходной команды.
- `AppError` содержит стабильный code (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_STOCK`, `STATE_GUARD_FAILED`, `RATE_LIMITED`, `INTERNAL`) и безопасный message. Неожиданная ошибка получает requestId и уходит в structured logging.
- Audit пишется в той же транзакции для критической мутации. Для неуспешных попыток security audit пишется отдельно. Сбой обязательного аудита откатывает критическую операцию.
- База работает отдельным application role без DDL и без DELETE/UPDATE прав на append-only таблицы. Миграции запускаются отдельной ролью.

### 12.6. PWA и браузерное хранение

- Service worker cache-first только для хэшированных JS/CSS/icons/offline shell; navigation — network-first с offline fallback.
- `/api`, Server Action responses, страницы PII/finance/files: `no-store`, не попадают в Cache Storage. Service worker явно исключает их по маршрутам и content type.
- Токены не хранятся в localStorage. IndexedDB не содержит PII в v1. Push payload не содержит клиента, адреса, телефона или суммы — только notification id.
- При logout/block/session invalidation локальные UI caches очищаются; PWA update имеет контролируемый lifecycle.

### 12.7. Эксплуатация

- Секреты: environment/secret manager, ротация ключей с `keyVersion`; `.env` не коммитится.
- PostgreSQL: зашифрованные резервные копии, PITR, регулярная проверка восстановления, отдельные production/staging базы.
- Наблюдаемость: JSON logs с requestId/userId (без PII), метрики latency/error/queue lag/deadlock, traces application services, алерты по auth anomalies и финансово-складским расхождениям.
- Retention для PII, call recordings, файлов, audit и backups задаётся документированной политикой. «Право на удаление» реализуется анонимизацией там, где закон допускает, при сохранении финансовых/аудиторских обязательств.
- Dependency/container scanning, locked dependencies, protected migrations и журнал deploy. Production object storage/database не доступны напрямую из публичной сети без необходимости.

## 13. Аналитика

Источник funnel — `ProjectStatusHistory`, а не текущий status, поэтому переходы и длительность воспроизводимы. Основные факты:

- lead fact: createdAt, source, promoter, location, operator;
- transition fact: from/to/occurredAt, длительность с предыдущего этапа;
- measurement/installation fact: scheduled/actual, employee, результат, rework;
- financial fact: договор, posted payments/refunds, posted expenses, фактическое consumption cost;
- inventory daily snapshot: onHand/reserved/issued/available/expected/minimum;
- assignment intervals для загрузки и атрибуции результата.

Метрики: число лидов; распределение по источникам/промоутерам; конверсии lead→call, call→measurement, measurement→contract, contract→installation; средний чек; выручка/себестоимость/прибыль; причины отказа; time-in-stage; rework count/rate; остатки/дефицит; загрузка сотрудников; результативность промоутеров, операторов, замерщиков и бригад.

Правила атрибуции фиксируются версией отчёта. Пример: договор относится к первичному promoter/source, оператор — к активному назначению на момент `CONTRACT_SIGNED`, бригада — к primary Installation; rework учитывается отдельно и не затирает исходный монтаж. Конверсия использует cohort по дате лида и окно созревания, иначе свежие лиды искусственно снижают показатель.

В v1 допустимы SQL views/materialized views с refresh job. При росте — read replica/warehouse, но политики доступа и определения метрик сохраняются. Analytics service выдаёт только разрешённые поля; для чувствительной групповой статистики применяется минимальный размер группы, чтобы не восстановить PII.

## 14. Проверка качества

### 14.1. Unit (Vitest)

- полный граф переходов и каждый guard, включая отрицательные сценарии;
- разрешения, DENY precedence, scopes и field redaction для всех восьми ролей;
- маскирование/нормализация телефона без логирования исходника;
- калькулятор: каждый тип тарифа, сложность, скидка, минимум, выезд, rounding, snapshot reproducibility;
- влияние всех StockMovement и запрет отрицательных/превышающих операций;
- финансовые агрегаты, refunds/reversals, currency invariants;
- Zod schemas и error mapping.

### 14.2. Integration с реальным PostgreSQL/S3 emulator

- конкурентный резерв одного остатка двумя транзакциями — выигрывает не более одной;
- idempotent retry склада/платежа/webhook;
- status transition атомарен с history/audit/outbox;
- partial indexes/CHECK/FK/append-only DB permissions;
- календарные конфликты и timezone;
- file quarantine/authorization/signed URL;
- blocked user и изменение roles немедленно отзывают sessions.

SQLite/mocked Prisma не заменяет эти тесты, потому что не проверяет PostgreSQL locks, Decimal, partial indexes и constraints.

### 14.3. Playwright E2E

1. PROMOTER создаёт лид, после сохранения видит только маску/ограниченный status и не может открыть чужой лид.
2. AD_OPERATOR видит телефон, логирует звонок, назначает непротиворечивый замер и не видит cost/profit.
3. MEASURER видит только свой замер, не получает телефон через UI/network, заполняет комнату manual/rectangle и завершает замер.
4. Смета сохраняет снимок; смена прайса не меняет старую версию.
5. Два warehouse-сеанса конкурируют за остаток; двойного резерва нет.
6. INSTALLER видит техзадание только своего монтажа и не видит запрещённые поля в HTML/RSC/action response.
7. FINANCE_MANAGER без отдельного permission не видит телефон, с permission — видит; posting payment меняет balance.
8. CLOSED блокируется при незавершённом монтаже/долге/активном резерве и проходит после устранения guards.
9. IDOR: подмена каждого типа id и file id даёт безопасный NOT_FOUND без утечки.
10. ADMIN создаёт/блокирует/сбрасывает пользователя, назначает несколько ролей, меняет permission и видит аудит.

## 15. Последовательный план реализации

### Этап 0. Уточнение и фиксация ADR

Согласовать открытые решения из раздела 17, нарисовать UX-потоки для каждой роли, утвердить определения финансов/склада/аналитики, модель угроз и retention. Результат: подписанное ТЗ и ADR, тестовые acceptance scenarios.

### Этап 1. Каркас и инфраструктура

Next.js App Router/strict TypeScript, Tailwind/shadcn, lint/format, Vitest/Playwright, Docker Compose PostgreSQL, environment validation, Prisma migrations, CI, logging/error envelope, health checks. Результат: разворачиваемый shell и миграционный pipeline.

### Этап 2. Auth, пользователи и RBAC

Auth.js database sessions, Argon2id, login rate limit, User/Role/Permission, multi-role, overrides, блокировка/reset/revoke, policy test harness, SecurityEvent/AuditLog. Результат: ADMIN управляет доступом; матрица доказана policy-тестами.

### Этап 3. CRM и базовый Project workflow

Customer/Lead/Project, быстрый lead flow, шифрование/маска телефона, sources/locations/rejection reasons, списки с scopes, call logs/tasks/comments, первые переходы до Measurement. Результат: promoter→operator сценарий без утечки PII.

### Этап 4. Календарь и замеры

CalendarEvent/participants, conflict service, назначения, Measurement, ProjectRoom, manual/complex dimensions, mobile-first формы, технические фото через временный file flow. Результат: оператор планирует, замерщик завершает назначенный замер.

### Этап 5. Файловый контур

Private S3, presigned upload/download, quarantine, MIME sniffing, checksum, scan job, visibility policies, lifecycle. Результат: безопасные фото, схемы и документы с IDOR tests.

### Этап 6. PriceBook и сметы

Draft/activate тарифы, pure calculation engine, snapshots, versions, sale/cost DTO separation, договорные guards. Результат: воспроизводимая смета и переход до CONTRACT_SIGNED.

### Этап 7. Склад

Каталоги, location balances, movement ledger, reservations, issue/return/consume/adjust/transfer, concurrency/idempotency, low-stock/debt reports, project material plan. Результат: доказанный concurrent reservation и переход MATERIALS_RESERVED.

### Этап 8. Закупки

Suppliers, PurchaseOrder approval/receipt, expected balance, частичная приёмка, связка с расходами. Результат: ожидаемые поставки и оприходование без ручной правки остатка.

### Этап 9. Монтаж

Installation/rework, бригады, техзадание/checklists, scheduling conflicts, расход/возврат, акты и guards. Результат: маршрут до INSTALLATION_COMPLETED/REWORK_REQUIRED.

### Этап 10. Финансы и закрытие

Payments/refunds, expenses/reversals, approvals, reconciliation, actual cost/profit, CLOSED guards, финансовые DTO и аудит. Результат: проект закрывается только при согласованной установке и финансовом состоянии.

### Этап 11. Уведомления и аналитика

Transactional outbox/job runner, in-app notification, funnel/KPI/materialized views, role-safe dashboards, exports с повторной аутентификацией. Результат: перечисленные метрики с зафиксированными формулами.

### Этап 12. PWA, hardening и эксплуатационная готовность

Manifest/service worker/offline shell, no-store verification, CSP/headers, dependency/file/security tests, backup restore drill, load/concurrency tests, accessibility, mobile/tablet/desktop QA, observability/runbooks. Результат: release candidate.

### Этап 13. Пилот и ввод

Миграция исходных данных с quarantine/report, обучение по ролям, ограниченный пилот, сверка склада/финансов, исправления, staged rollout и rollback plan. Результат: контролируемый production запуск.

Каждый этап завершается миграцией, rollback/forward-fix планом, unit/integration/e2e acceptance, проверкой permissions и обновлением документации. Склад и финансы нельзя принимать только по «счастливому пути».

## 16. Риски и спорные места

| Риск                                                       | Последствие                                    | Мера                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Неоднозначные складские термины `onHand/issued`            | двойное вычитание или ложный доступный остаток | утвердить семантику раздела 8; журнал + balances + reconciliation tests                       |
| Конкурентные резервы/приёмки                               | отрицательный склад, двойная выдача            | row locks, детерминированный порядок, constraints, idempotency, реальные integration tests    |
| Смешивание Lead и Project                                  | расходящиеся статусы/ответственные             | единый Project workflow; Lead только происхождение и immutable capture                        |
| Утечка телефона через RSC, календарь, export, audit, cache | нарушение ПДн                                  | server DTO/redaction, no-store, policy/e2e network assertions, export permission              |
| Много ролей у пользователя                                 | неожиданное расширение доступа                 | permissions additive, явный DENY, scope не расширяется без теста; экран effective permissions |
| JSON в тарифах/допработах                                  | невалидные/неоднозначные формулы               | versioned discriminated Zod schemas, activation validator, snapshot                           |
| Изменение измерений после сметы/договора                   | несогласованные суммы и ТЗ                     | immutable issued estimate, stale marker, новая версия/допсоглашение                           |
| Ручные финансовые/складские правки                         | потеря аудита                                  | posting/reversal и adjustment workflow, separation of duties                                  |
| Конфликты календаря                                        | двойное назначение                             | server range check в транзакции, override permission/reason, optional exclusion constraint    |
| Soft delete без retention                                  | бесконечный рост/юридический риск              | классификация данных, сроки хранения, анонимизация и S3 lifecycle                             |
| PWA offline cache                                          | сохранение PII на общем телефоне               | shell-only offline v1, no-store, очистка cache при logout                                     |
| Рост Audit/StatusHistory                                   | медленная БД                                   | индексы, partitioning/archival, отделение аналитических read models                           |
| Серверless DB connection/long jobs                         | исчерпание пула, timeout                       | pooled connection, отдельный worker process, bounded jobs/outbox                              |
| Геокодирование/расстояние                                  | неверная цена выезда                           | хранить координаты, источник/время расчёта и подтверждённое расстояние в snapshot             |
| Атрибуция KPI стимулирует неверное поведение               | спорные премии/отчёты                          | формулы и cohort windows согласовать, version report definitions, аудит назначений            |
| Импорт старых данных                                       | дубли клиентов и неверные остатки              | staging/quarantine import, phone blind-index dedupe, opening balance adjustment с актом       |

## 17. Решения, которые необходимо зафиксировать до реализации

1. Юридическое лицо/несколько филиалов: нужна ли сразу сущность `Organization/Branch` и tenant isolation либо система строго для одной организации.
2. Кто и как создаёт первичный пароль, требуется ли email/SMS invitation и обязательна ли MFA для ADMIN/FINANCE_MANAGER.
3. Политика телефона: должна ли быть masked версия у MEASURER/INSTALLER вообще; нужна ли «слепая» кнопка звонка через телефонию; разрешена ли выгрузка контактов.
4. Сроки хранения PII, call recordings, договоров, чеков, фото, AuditLog и backups; процедура анонимизации и legal hold.
5. Полный перечень видимости комментариев и файлов (`GENERAL/INTERNAL/MANAGEMENT/FINANCE`) для каждой роли.
6. Точная семантика `onHand`, `issued` и локации материальной ответственности; разрешены ли отрицательные остатки; нужны ли партии, серийные номера, рулоны полотна, размеры/цвета и методы оценки себестоимости (moving average/FIFO/specific identification).
7. Срок жизни резерва, приоритет проектов, частичный резерв и может ли резерв создаваться до подписания договора/предоплаты.
8. Пороги и второй утверждающий для write-off, adjustment, скидки, расходов и refunds; separation-of-duties правила.
9. Набор единиц измерения и правила конвертации; точность количества для метров/м²/штук.
10. Формулы калькулятора: включённые углы, к чему применяется коэффициент сложности, скидка до/после минимального заказа, участие выезда в скидке/минимуме, округление, НДС, региональные зоны.
11. Являются ли справочники полотна/профиля складскими SKU или отдельным каталогом, как связать варианты производителя/цвета/фактуры с тарифом и остатком.
12. Что считается подписанным договором: обязательный файл/ЭП/бумажная отметка; обязательный размер предоплаты и кто может сделать override.
13. Условия `CLOSED`: строго нулевой долг или допускается списание/рассрочка; какие документы и незавершённые задачи блокируют закрытие.
14. Правила rework: гарантийный/платный, кто утверждает, как влияет на прибыль, KPI бригады и статус уже закрытого проекта.
15. Нормы времени и buffer для календаря; конфликт является предупреждением или жёстким запретом; кто может override.
16. Точные формулы KPI, cohort windows, временная атрибуция ответственных, доступ MANAGER к финансовой/персональной эффективности.
17. Каналы уведомлений, поставщики телефонии/SMS/email/push, шаблоны и допустимое содержание без PII.
18. S3-провайдер, допустимые MIME/размеры, antivirus, регион хранения и требования к шифрованию/резервированию.
19. Требуемые карты/геокодер и способ расчёта маршрута за основной зоной.
20. Ожидаемые объёмы пользователей/лидов/файлов/складских движений, SLA, RPO/RTO и модель развёртывания (Node server/container/serverless).
21. Источник и качество исходных данных для миграции, правила дедупликации клиентов и акт начальных складских/финансовых остатков.
22. Нужны ли печатные формы договора, сметы, акта, накладной и кассовые/бухгалтерские интеграции; требования к нумерации документов.
23. Разрешается ли ADMIN всегда обходить пользовательский `DENY` или нужен отдельный, журналируемый break-glass аккаунт. Рекомендуется второй вариант.
24. Нужны ли филиальные ограничения сотрудников/складов/прайсов; это решение меняет почти все уникальные индексы и должно приниматься до первой миграции.

## 18. Критерий готовности архитектурного этапа

Этап можно считать завершённым, когда владелец продукта письменно утвердил раздел 17, матрицу ролей и формулы склада/калькулятора; для каждого перехода есть acceptance scenario; модель угроз согласована; ER-модель преобразована в Prisma schema и проверена пробной миграцией PostgreSQL; спорные решения оформлены ADR. До этого допустим только технический spike, но не массовая реализация UI и CRUD.
