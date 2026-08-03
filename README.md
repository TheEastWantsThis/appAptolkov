# Aпотолков CRM/ERP — рабочий каркас

Адаптивный каркас внутренней CRM/ERP на Next.js App Router. Реализованы авторизация, серверный RBAC, лиды, операторская очередь, клиентские проекты, задачи, история статусов, календарные события, профиль и AuditLog.

## Стек

- Next.js 16, React 19, TypeScript strict;
- Tailwind CSS 4 и локальные компоненты shadcn/ui;
- PostgreSQL 17, Prisma 7 и драйвер `pg`;
- Auth.js 5 Credentials provider;
- Argon2id (`@node-rs/argon2`), Zod, React Hook Form;
- Vitest для тестов прав доступа.

## Требования

- Node.js 20.19+ (рекомендуется актуальный LTS);
- npm;
- Docker Desktop или локальная PostgreSQL 17.

## Локальный запуск

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Перед первым запуском замените `AUTH_SECRET` в `.env`:

```powershell
npx auth secret
```

Если PostgreSQL работает не в Docker, измените `DATABASE_URL`.

## Проверки

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Дополнительные команды:

```powershell
npm run db:studio
npm run db:deploy
npm run format:check
```

## Тестовые учётные записи

Seed использует пароли из `SEED_ADMIN_PASSWORD` и `SEED_DEMO_PASSWORD`. Значения `.env.example` предназначены только для локальной разработки.

| Роль              | Логин       | Email                     | Пароль по умолчанию |
| ----------------- | ----------- | ------------------------- | ------------------- |
| ADMIN             | `admin`     | `admin@example.local`     | `Admin123!`         |
| PROMOTER          | `promoter`  | `promoter@example.local`  | `Demo123!`          |
| AD_OPERATOR       | `operator`  | `operator@example.local`  | `Demo123!`          |
| MEASURER          | `measurer`  | `measurer@example.local`  | `Demo123!`          |
| INSTALLER         | `installer` | `installer@example.local` | `Demo123!`          |
| WAREHOUSE_MANAGER | `warehouse` | `warehouse@example.local` | `Demo123!`          |
| FINANCE_MANAGER   | `finance`   | `finance@example.local`   | `Demo123!`          |
| MANAGER           | `manager`   | `manager@example.local`   | `Demo123!`          |

Не используйте демонстрационные пароли в production.

## Лиды и проекты

- Промоутер создаёт заявку по кнопке «Новая заявка» и видит только свои лиды с маскированным телефоном.
- Оператор обрабатывает очередь, фиксирует звонки, следующие контакты, причины отказа, задачи и замеры.
- Полный телефон возвращается сервером только при разрешении customer.phone.read.
- После квалификации лид конвертируется в проект с внутренним номером.
- Проекты доступны в канбане и таблице; карточка содержит клиента, помещения, задачи, ответственных, события, файлы и единую ленту.
- Переходы статусов проверяются state machine и сохраняются в ProjectStatusHistory.
- Файлы на этом этапе прикрепляются защищёнными ссылками; бинарное хранилище подключается отдельно для выбранной production-инфраструктуры.

## RBAC и безопасность

- Навигация скрывает недоступные разделы, но это только UX. Страницы, queries и Server Actions независимо вызывают серверную проверку permissions.
- Permissions нескольких ролей объединяются. Действующий пользовательский `DENY` имеет приоритет над ролевым или пользовательским `ALLOW`.
- Блокировка, смена ролей и смена/сброс пароля увеличивают `sessionVersion`; старый JWT перестаёт проходить серверную проверку состояния пользователя.
- Credentials provider Auth.js использует JWT-сессию, поскольку Credentials не создаёт database session. JWT не считается источником permissions: на каждом защищённом серверном запросе пользователь, роли, блокировка и overrides заново читаются из PostgreSQL.
- Пароли хэшируются Argon2id. Пароли и их хэши не попадают в AuditLog.
- ADMIN role защищена от удаления базовых permissions через UI, а последнего активного администратора нельзя заблокировать или лишить ADMIN.
- Все формы валидируются Zod на клиенте для UX и повторно на сервере перед изменением БД.

## Структура

```text
src/app/                 маршруты App Router и защищённый layout
src/components/          layout, формы и локальные shadcn/ui-компоненты
src/modules/auth/        Auth.js, RBAC, password policy и page guards
src/modules/users/       queries и Server Actions пользователей
src/modules/roles/       роли, каталог permissions и управление ими
src/modules/profile/     профиль и смена пароля
src/modules/audit/       запись и чтение AuditLog
src/shared/              безопасный формат результатов Server Actions
prisma/                  схема, миграции и seed
tests/                   unit-тесты RBAC
docs/                    согласованное архитектурное ТЗ
```

## Замеры и сметы

- /measurements — календарь назначенных выездов. Замерщик видит только свои замеры без телефона и финансов.
- Форма замера поддерживает несколько помещений, автоматическую/ручную геометрию, дублирование, сортировку, фотографии и чертёж по ссылкам.
- Несохранённые изменения защищены предупреждением, а локальный черновик в localStorage позволяет продолжить работу при нестабильной сети.
- /settings/tariffs — управление тарифами для пользователей с разрешением tariff.manage.
- Калькулятор выполняется только на сервере; каждая версия сметы сохраняет snapshot тарифов и рассчитанные строки.
- Клиентские цены, управление скидкой и внутренняя себестоимость защищены отдельными permissions.
- Клиентский PDF физически не содержит внутренних цен; внутренний PDF доступен только с estimate.internal-price.read.

## Монтажи

- /installations — календарь монтажей и безопасный кабинет назначенного монтажника.
- Назначение поддерживает несколько монтажников, отдельного бригадира, транспорт, материалы, инструменты и техническое задание.
- Сервер предупреждает о пересечении интервалов у каждого участника бригады и требует явного подтверждения конфликта.
- Карточка монтажника намеренно не выбирает из базы телефон, рекламный источник, сметы, прибыль и управленческие комментарии.
- Ход работ включает статусы, фактическое время, фотографии до/в процессе/после, материалы, проблемы, подпись и приёмку.
- Повторный выезд создаётся отдельным связанным монтажом. Завершение монтажа не закрывает проект автоматически.

## Production

Для production используйте отдельные секреты и БД, выполните `npm run db:deploy`, затем `npm run build` и `npm start`. Настройте HTTPS, резервное копирование PostgreSQL и централизованный сбор логов. Значения seed-паролей и локальный Docker Compose не являются production-конфигурацией.
