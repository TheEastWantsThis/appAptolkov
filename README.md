# WatchRoom

Telegram Mini App для совместного просмотра YouTube и Twitch. Реализованы безопасный Telegram-вход, внутренние каналы, открытые/закрытые комнаты, роли, приглашения, authoritative realtime playback, heartbeat/presence, временный чат и официальные YouTube/Twitch embed-плееры. Production release package подготовлен; фактический внешний deploy и device QA отмечаются только после реальных smoke-тестов.

## Требования

- Node.js 24.x;
- Corepack и pnpm 11.19.0;
- Docker с Compose.

## Быстрый запуск для разработки

PowerShell:

```powershell
corepack enable
corepack install --global pnpm@11.19.0
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev
```

После запуска:

- web: <http://localhost:3000>;
- web health: <http://localhost:3000/health>;
- API liveness: <http://localhost:4000/health/live>;
- API и PostgreSQL readiness: <http://localhost:4000/health/ready>.

Остановить PostgreSQL: `pnpm dev:down`.

## Запуск полностью в Docker

```powershell
docker compose up --build
```

Compose поднимает `postgres`, затем готовый API и web. Локальные значения БД предназначены только для разработки и не используются как production-секреты.

## Проверки из корня

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm lint` также проверяет форматирование. CI выполняет те же команды с frozen lockfile.

## Структура

```text
apps/web         Next.js UI: auth, каналы, каталог/комнаты, share, presence и чат
apps/api         Fastify API, provider metadata, Argon2id, Socket.IO и graceful shutdown
packages/shared  Zod-схемы, source URL parsers, capability matrix, права и deep links
prisma           PostgreSQL schema, миграции и development seed
docs             утверждённые продуктовые и архитектурные решения
```

Для запуска в обычном браузере явно установите `MOCK_TELEGRAM_AUTH=true`; production-конфигурация с mock не запустится. Для реального Mini App укажите серверные `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_APP_SHORT_NAME` и оставьте mock выключенным. Без реального bot token Telegram prepared share недоступен, но copy/Web Share fallback продолжает работать.

Для нативной привязки обсуждения также создайте случайный `TELEGRAM_WEBHOOK_SECRET` длиной не менее 32 символов и настройте Bot API webhook на публичный HTTPS URL `https://<api-domain>/v1/telegram/webhook`, передав то же значение как `secret_token`. Не помещайте token/secret в команду, историю shell или репозиторий — задавайте их через secret manager платформы. WatchRoom принимает только `chat_shared`, сопоставленный с pending request, и затем повторно проверяет публичную группу, администратора и членство бота через Bot API.

Для metadata задайте серверный `YOUTUBE_API_KEY` и парные `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET`. Без них официальный embed продолжает работать по source ID, а title/creator/thumbnail заменяются сохранённым `nowWatchingText`. Для Twitch перечислите разрешённые hostname без схемы и порта в `NEXT_PUBLIC_TWITCH_PARENT_DOMAINS`; wildcard запрещён. Development-only стенд плееров: `/dev/player`.

## Production release

Референсный deploy описан в [`render.yaml`](./render.yaml): два paid Render Web Service, ровно один API instance и PostgreSQL 17 в одном регионе. Миграции выполняются отдельным `preDeployCommand`; production topology требует HTTPS/WSS и проходит startup/build-time validation.

Порядок и обязательные ручные проверки приведены в [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) и [`docs/MVP_TEST_PLAN.md`](./docs/MVP_TEST_PLAN.md). После создания реальных URL:

```powershell
pnpm release:telegram
pnpm release:smoke
```

Обе команды читают значения только из окружения. Telegram-команда изменяет menu button/webhook и запускается только оператором с production secrets; Main Mini App настраивается отдельно через `@BotFather`. Smoke-команда не подтверждает Telegram WebView или provider playback — эти проверки выполняются на реальных Android/iOS/Desktop.

## Конфигурация и безопасность

Скопируйте `.env.example` в `.env`; настоящий `.env` игнорируется Git. Не добавляйте bot token, пароли комнат, Telegram `initData` или provider secrets в клиентские переменные и логи. API журналирует структурированные события, удаляет query string из request log и редактирует чувствительные поля.
