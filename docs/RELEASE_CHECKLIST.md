# WatchRoom — checklist развёртывания закрытого MVP

Статус на 31 августа 2026 года: **начат внешний деплой закрытого теста**. Репозиторий связан с Vercel; web-проект переименован в `watchroom-miniapp`, Root Directory установлен в `apps/web`, а старая команда Prisma-миграций удалена из Vercel. API/PostgreSQL ещё не созданы в Render, production URL и smoke-результатов пока нет.

## 1. Release gate

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` прошли на этапе hardening.
- [x] Dependency audit не содержит известных high/critical уязвимостей.
- [x] API и web Dockerfile запускаются под non-root `node`; файлы runtime принадлежат этому пользователю.
- [x] Production env topology валидирует HTTPS app/API, WSS и Twitch parent hostname.
- [x] Тестовый Render Blueprint фиксирует один API instance и health checks; на Free миграции выполняются идемпотентно перед стартом API. Graceful shutdown реализован приложением, но управляемая Render shutdown delay недоступна на Free.
- [ ] Выполнить `render blueprints validate render.yaml --workspace <id>` в целевом workspace. Официальный CLI v2.25.0 скачан с проверкой release SHA-256, но локально запросил workspace, которого в окружении нет.
- [ ] Собрать оба Docker image реальным Docker engine и проверить `docker inspect` (`Config.User=node`).
- [ ] Создать release commit/tag в удалённом Git-репозитории с зелёным CI.

## 2. Render и домены

Render Web Service выбран потому, что официально принимает inbound WebSocket и не задаёт фиксированную максимальную длительность соединения. Инстанс всё равно заменяется при deploy/maintenance, поэтому reconnect обязателен. Для первого закрытого теста Blueprint использует один Free API instance и Free PostgreSQL; web размещается на Vercel. Free API засыпает после периода бездействия, а Free PostgreSQL истекает через 30 дней и не имеет backup/PITR. Это временный тестовый режим, не production SLA. [Render WebSockets](https://render.com/docs/websocket), [Free instances](https://render.com/docs/free), [Render Web Services](https://render.com/docs/web-services).

- [ ] В Render связать репозиторий и применить `render.yaml`; выбрать Free ресурсы без платной подписки.
- [ ] Создать `watchroom-db` PostgreSQL 17 в Frankfurt; убедиться, что public DB allowlist пуст.
- [ ] Назначить два домена одного registrable site, например `app.example.com` и `api.example.com`.
- [ ] Дождаться TLS; HTTP должен перенаправляться на HTTPS. Render выпускает и обновляет сертификаты автоматически. [Custom domains](https://render.com/docs/custom-domains), [TLS](https://render.com/docs/tls).
- [ ] Не включать второй API instance: in-memory presence/rate/dedupe ещё не распределены.

## 3. Переменные окружения

Публичные значения задаются согласованно:

```text
PUBLIC_APP_URL=https://app.example.com
WEB_ORIGIN=https://app.example.com
API_URL=https://api.example.com
WS_URL=wss://api.example.com
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com
NEXT_PUBLIC_TWITCH_PARENT_DOMAINS=app.example.com
```

Секретное хранилище Render, никогда не Blueprint literal/build ARG/log:

- [ ] `DATABASE_URL` — только `fromDatabase.connectionString`;
- [ ] `TELEGRAM_BOT_TOKEN`;
- [ ] `TELEGRAM_WEBHOOK_SECRET` — минимум 32 случайных символа;
- [ ] `TWITCH_CLIENT_ID` и `TWITCH_CLIENT_SECRET`;
- [ ] `YOUTUBE_API_KEY`;
- [ ] `METRICS_BEARER_TOKEN` — генерируется Render.
- [ ] `OPERATIONS_BEARER_TOKEN` — отдельный случайный secret минимум 32 символа; не совпадает с metrics token.

Отдельного session signing secret нет: WatchRoom использует 256-bit opaque session tokens, а PostgreSQL хранит только SHA-256 digest. Cookie содержит токен только как `Secure; HttpOnly; SameSite=Lax`.

`NEXT_PUBLIC_*` являются публичной build-time конфигурацией и не должны содержать секреты. Render переводит service env в Docker build args; Dockerfile объявляет только безопасные публичные ARG. [Render Docker environment variables](https://render.com/docs/docker), [Docker secrets](https://render.com/docs/docker-secrets).

## 4. Миграции и deploy

- [ ] Перед deploy создать backup/PITR checkpoint.
- [ ] На Free API startup command выполняет `prisma migrate deploy` до запуска процесса; команда идемпотентна, instance только один, seed запрещён.
- [ ] Проверить event log: migration exit code 0, затем `/health/ready` 200.
- [ ] Проверить, что Render переключил трафик только после health success. [Health checks](https://render.com/docs/health-checks).
- [ ] Проверить graceful deploy: соединённый клиент получает disconnect, переподключается и получает свежий room snapshot.

## 5. Telegram

- [ ] В `@BotFather` установить Main Mini App URL равным `PUBLIC_APP_URL`; загрузить только утверждённые preview media.
- [ ] Из защищённого operator shell выполнить `pnpm release:telegram`; скрипт вызывает официальные `getMe`, `setChatMenuButton` и `setWebhook`, не печатая token.
- [ ] Проверить webhook secret header и получение `chat_shared`.
- [ ] Проверить direct link `https://t.me/<bot>/<app>?startapp=room_<publicId>`.
- [ ] Проверить compact link с `&mode=compact`.
- [ ] Android/iOS/Desktop: `start_param`, BackButton, theme/safe area, reconnect после `openTelegramLink`.
- [ ] Включить inline mode бота в BotFather и проверить `switchInlineQuery` → `answerInlineQuery` приглашение.
- [ ] `shareMessage` и `requestChat` проверить только в поддерживаемых клиентах; на старых подтвердить `switchInlineQuery`, copy/Web Share/manual instruction fallback.

Main Mini App настраивается через `@BotFather`; Bot API официально позволяет настроить menu button методом `setChatMenuButton`. [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [Bot API](https://core.telegram.org/bots/api#setchatmenubutton).

## 6. Production smoke

- [ ] Запустить `pnpm release:smoke` с `PUBLIC_APP_URL`, `API_URL`, `WS_URL` и без session cookie: WSS должен достичь authenticated boundary.
- [ ] Повторить с временным `SMOKE_SESSION_COOKIE` из отдельного тестового аккаунта: Socket.IO connection должен установиться. Не сохранять cookie в shell history/log.
- [ ] Проверить web `/health`, API `/health/live`, `/health/ready`, CSP, HTTPS redirect и WSS.
- [ ] Создать тестовую комнату и передать `SMOKE_ROOM_PUBLIC_ID`; проверить preview без утечки PRIVATE metadata.
- [ ] Запустить официальный YouTube VOD embed на production domain.
- [ ] Проверить YouTube Live, Twitch channel live, Twitch VOD и корректный Twitch `parent=app.example.com` вручную.
- [ ] Для запрещённого embedding подтвердить понятную ошибку и ссылку на оригинал, не обходить запрет.

## 7. Backup и rollback

- [ ] До приглашения пользователей либо перейти на paid Render Postgres с PITR, либо явно принять 30-дневный срок и отсутствие backup у Free DB; пользовательские данные Free DB нельзя считать долговечными. [Render Postgres backups](https://render.com/docs/postgresql-backups).
- [ ] Зафиксировать фактические RPO/RTO и ответственного.
- [ ] Для application rollback: остановить autodeploy, выбрать последний успешный build artifact на Render Events → Rollback, затем повторить smoke. Rollback не откатывает БД. [Render rollbacks](https://render.com/docs/rollbacks).
- [ ] При несовместимой миграции не выполнять ручной down в основной БД: восстановить новую БД через PITR/export, проверить её и только затем переключить `DATABASE_URL`.

## Итоговый release decision

До выполнения всех пунктов разделов 2–7 решение — **NO-GO для приглашённых пользователей**. Зеленый CI или успешное создание Render services сами по себе не являются доказательством успешного релиза.
