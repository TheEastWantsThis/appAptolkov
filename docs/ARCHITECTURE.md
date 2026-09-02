# WatchRoom: техническая архитектура

Статус: утверждённый проект MVP от 29 августа 2026 года. Реализованы каркас, identity, внутренние каналы, комнаты, room access, presence и ограниченный чат.

## Реализованный room slice

`Room` хранит случайный 128-bit `publicId`, источник и playback snapshot/version. PRIVATE-комната имеет только Argon2id hash; успешный unlock выдаёт случайный room grant, в БД хранится только SHA-256 digest и `passwordRevision`. Пять неверных попыток дают пятиминутную блокировку bucket `IP + user + room`, до неё применяется нарастающая задержка. Ошибка едина для неверного пароля и отсутствующей комнаты.

API вычисляет роль и capabilities на сервере. `EVERYONE` расширяет только `play/pause/seek`; `change_source`, завершение, роли и чат-модерация не становятся общедоступными. Для LIVE seek не выдаётся. Присутствие считается как уникальные users среди Socket.IO connections одного процесса; catalog и room preview получают текущее число.

Room chat использует HTTP-команды с Socket.IO broadcast. Это отдельный plain-text поток: до 500 символов, последние 40, TTL 24 часа, без смешивания с system events. Prisma-модели `RoomMessage` и `RoomChatRestriction` физически разделены; owner/moderator могут удалить сообщение и временно mute участника.

Invite строится как `startapp=room_<publicId>` и отдельный `mode=compact`. Нативный Telegram flow использует backend `savePreparedInlineMessage` и клиентский `shareMessage`; Web Share и clipboard остаются fallback. Пароль не входит ни в один link или prepared message.

## Реализованный identity/channel slice

`apps/web` передаёт raw `Telegram.WebApp.initData` в `POST /v1/auth/telegram`. API валидирует Telegram HMAC и свежесть, атомарно upsert-ит User, регистрирует replay digest и выдаёт opaque server session. Same-site production использует HttpOnly cookie; временный cross-site Vercel/Render deploy использует тот же opaque token как Bearer из `sessionStorage`, потому что мобильные Telegram WebView не гарантируют third-party cookie. Все channel-мутации проходят session, exact-Origin и owner authorization; cookie-режим дополнительно требует CSRF. Prisma 7.10 работает через обязательный `@prisma/adapter-pg`; схема и миграции находятся в `prisma/`.

Публичный Channel доступен на чтение без членства; PRIVATE возвращается только участнику. Channel — внутренняя сущность WatchRoom и не создаёт Telegram-канал. API зависит от `WatchRoomStore`, поэтому тесты используют in-memory реализацию, а production — PostgreSQL/Prisma.

## Контекст и принципы

WatchRoom синхронизирует команды и состояние официальных iframe-плееров. Медиаданные идут напрямую от YouTube/Twitch к клиенту. Сервер является источником истины для прав, присутствия, версии источника и логического playback snapshot, но не для медиапотока.

Принципы: mobile-first, server-authoritative, deny by default, один realtime-инстанс до появления распределённого координатора, progressive enhancement для нестабильных Web API, явное отображение ограничений live.

## Компоненты monorepo

```text
apps/web
  Next.js Mini App UI, Telegram bridge, provider adapters, Socket.IO client
apps/api
  Fastify HTTP API, Telegram auth, Bot API integration, metadata adapters,
  Socket.IO server, room coordinator, persistence
packages/shared
  Zod schemas, event envelopes, capability matrix, IDs and pure utilities
prisma
  schema and migrations (на этапе реализации)
docs
  product, limits, security, ADR and plans
```

`apps/web` и `apps/api` не импортируют внутренности друг друга. Общий контракт находится только в `packages/shared`; сгенерированный Prisma Client остаётся деталью API.

## Окончательный стек и фиксация версий

Версии проверены 29 августа 2026 года по официальным registry/документациям. В будущих `package.json` используются точные версии без `^`/`~`, lockfile обязателен.

| Слой                     |                                                                                     Выбор для реализации | Причина                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                  |                                                                                    Node.js `24.20.0` LTS | Активная LTS-линия; Node 26 ещё Current, Node 20 уже EOL. [Node release table](https://nodejs.org/en/about/previous-releases)                                                                             |
| Package manager          |                                                                                           pnpm `11.19.0` | проверенная workspace-версия, точно зафиксированная в `packageManager` и lockfile. [npm](https://www.npmjs.com/package/pnpm?activeTab=versions)                                                           |
| Language                 |                                                                                       TypeScript `6.0.3` | стабильный широко используемый патч; не берём только что вышедший major 7.0.2 до проверки экосистемы. [npm](https://www.npmjs.com/package/typescript?activeTab=versions)                                  |
| Web                      |                                                               Next.js `16.3.3`, React/React DOM `19.2.8` | текущие стабильные теги, без canary/preview. [Next](https://www.npmjs.com/package/next?activeTab=versions), [React](https://www.npmjs.com/package/react?activeTab=versions)                               |
| UI                       |                                                                                     Tailwind CSS `4.3.3` | стабильный релиз, нулевая runtime-зависимость. [npm](https://www.npmjs.com/package/tailwindcss)                                                                                                           |
| HTTP API                 |                                                                                         Fastify `5.12.1` | текущая поддерживаемая major-линия, встроенная schema-oriented модель. [npm](https://www.npmjs.com/package/fastify?activeTab=versions)                                                                    |
| Realtime                 |                                                                          Socket.IO server/client `4.8.3` | WebSocket-first, reconnect, ack, rooms и polling fallback; будущие adapters. [npm](https://www.npmjs.com/package/socket.io?activeTab=versions), [официальный обзор](https://socket.io/)                   |
| Contracts                |                                                                                              Zod `4.4.3` | стабильная major-линия, общая runtime-валидация клиента/API/events. [npm](https://www.npmjs.com/package/zod?activeTab=versions)                                                                           |
| ORM и драйвер PostgreSQL |                                 Prisma ORM/Client `7.10.0`, `@prisma/adapter-pg` `7.10.0`, `pg` `8.23.0` | поддерживаемая стабильная линия; Prisma 8 в доступном обновлении ещё RC, поэтому experimental major не используется. [Client versions](https://www.npmjs.com/package/%40prisma/client?activeTab=versions) |
| Хеширование паролей      |                                                                                        `argon2` `0.44.0` | Зафиксированный стабильный релиз; Argon2id с индивидуальной солью, 64 MiB, 3 iterations, parallelism 1                                                                                                    |
| Database                 |                                                       PostgreSQL `17.11`, Docker `postgres:17.11-alpine` | поддержка до 2029, текущий security patch; консервативнее нового major 18. [versioning](https://www.postgresql.org/support/versioning/)                                                                   |
| Local infra              |                                                                                        Docker Compose v2 | один Postgres-контейнер, web/api запускаются контейнерами или локально; Redis отсутствует.                                                                                                                |
| Tests                    | Vitest (актуальный стабильный при bootstrap), Playwright (stable), Testcontainers либо отдельная test DB | unit/contract, browser integration и database integration; точные версии фиксируются в bootstrap PR после совместимости с выбранным Node.                                                                 |

Версии тестовых инструментов намеренно не выдумываются в проектном документе: перед первой установкой bootstrap-этап повторно читает stable dist-tags и создаёт lockfile. Продуктовые зависимости выше являются архитектурной фиксацией; их обновление требует отдельного reviewed dependency PR.

## Логическая схема данных

### Долговечные сущности

- `User`: внутренний UUID, уникальный Telegram user ID как `bigint`, безопасные display-поля, timestamps. Username и фото не считаются стабильными идентификаторами.
- `Session`: хеш непрозрачного session token, user ID, expiry, last seen, revoked at, Telegram auth date. Сырой `initData` не сохраняется.
- `AuthorChannel`: UUID, owner ID, slug/title/description, timestamps.
- `ChannelMembership`: channel ID, user ID, `OWNER | MODERATOR | MEMBER`; уникальная пара.
- `Room`: UUID, случайный `publicId`, channel/owner ID, `PUBLIC | PRIVATE`, nullable password hash, `passwordRevision`, control policy, lifecycle, provider/source metadata и playback version/snapshot.
- `RoomAccessGrant`: room/user/password revision, expiry/revocation. Для открытой комнаты отдельный grant не нужен.
- На текущем срезе source metadata и playback snapshot хранятся непосредственно в `Room`; нормализация в отдельные revision/history сущности остаётся этапом player/realtime hardening.
- Provider metadata загружается сервером только с `youtube.googleapis.com`/Twitch Helix, кешируется в памяти на ограниченный TTL и сохраняет безопасный snapshot в Room. HTML scraping и пользовательские upstream URL отсутствуют.
- Web выбирает только `YouTubePlayerAdapter` или `TwitchPlayerAdapter` по валидированному discriminated union. Twitch `parent` берётся из статической build-time allowlist, а не из `Host` или пользовательского ввода.
- `ChatMessage`: room ID, author ID, plain-text body до 500 символов, created at. В комнате хранится не более 40 последних сообщений и не дольше 24 часов.
- `ChatRestriction`: room/user, `mutedUntil`, actor/reason/timestamps. Причина показывается ограниченному пользователю, текст сообщения сюда не копируется.
- `RoomModerationAudit`: room/actor/target/action/time, без удалённого текста, TTL 30 дней.
- `TelegramChatBindingRequest`: одноразовый request ID, room/requester/Telegram user, prepared button ID, status и expiry; после проверки Room получает Telegram chat ID, username и серверно построенный URL.
- `SystemEvent` и `Reaction` не сохраняются в БД: только realtime delivery, UI TTL соответственно 10 минут и 10 секунд.

### Эфемерное состояние одного API-процесса

- socket ID → user/session/room;
- room → уникальные users и число соединений на пользователя;
- disconnect grace и heartbeat;
- краткая дедупликация `commandId`;
- provider readiness/telemetry, если она нужна только для диагностики.

Рестарт процесса восстанавливает playback snapshot из PostgreSQL; presence строится заново по переподключившимся сокетам. Число зрителей в короткий переходный момент может уменьшиться — это приемлемо для MVP.

Realtime-команда содержит `commandId` и `expectedVersion`. API заново проверяет session, room grant и capability, затем атомарно обновляет Room только при совпавшей version. Position для play/pause выводится из предыдущего server snapshot; клиентская position используется только для разрешённого seek. Один Telegram-пользователь считается один раз при любом числе socket connections; heartbeat относится к соединению, reconnect grace — к пользователю в комнате.

## HTTP-потоки

### Telegram auth

1. Клиент отправляет исходную строку `Telegram.WebApp.initData` по HTTPS на `POST /v1/auth/telegram`.
2. API разбирает query string без изменения закодированных значений, отделяет `hash`, сортирует остальные `key=value` и проверяет HMAC-SHA-256 по алгоритму Telegram.
3. API constant-time сравнивает hash, проверяет `auth_date` (целевой максимум 5 минут, конфигурируемый), наличие `user`, формат JSON и Telegram user ID.
4. После upsert пользователя API выпускает случайную серверную сессию. Предпочтение — `Secure; HttpOnly; SameSite=Lax` cookie на общем site (`app.example.com`/`api.example.com`). В cross-site closed-test deploy токен возвращается как Bearer и живёт только в `sessionStorage`; raw `initData` больше не используется как session token.
5. Socket.IO handshake использует ту же server-side session через cookie либо `auth.accessToken` и всегда проверенный `Origin`. Token в query string запрещён.

### Создание/изменение источника

1. API принимает URL или ID и парсит его локально по allowlist; произвольный URL не запрашивается.
2. YouTube ID проверяется через `videos.list` (`snippet,status,contentDetails,liveStreamingDetails`) и `status.embeddable`; Twitch channel/VOD — через Helix с app access token.
3. Секреты YouTube/Twitch находятся только в API. Ответ нормализуется в `ProviderSource` из shared package.
4. Смена выполняется транзакцией: новая `RoomSource`, увеличение source/state version, новый snapshot, audit event.

### Закрытая комната

`POST /v1/rooms/:publicId/unlock` принимает пароль только в body по HTTPS. API применяет rate limit по account+room+IP bucket, сверяет Argon2id, создаёт grant на текущий `passwordRevision` и очищает password reference. Смена пароля повышает revision и инвалидирует старые grants. Preview никогда не сообщает, какая часть пароля неверна.

## Realtime-протокол

Все payload проходят Zod-валидацию. Envelope содержит `protocolVersion`, `roomId/publicId`, `sourceRevision`, `stateVersion`, `eventId|commandId`, `serverTimeMs`.

### Основные события

| Направление | Событие                            | Назначение                                            |
| ----------- | ---------------------------------- | ----------------------------------------------------- |
| C→S         | `room:join`                        | проверка session, room access, присоединение          |
| S→C         | `room:snapshot`                    | source, playback, capabilities, roles, presence       |
| C→S         | `playback:command`                 | `PLAY`, `PAUSE`, `SEEK`, `GO_LIVE`, `CHANGE_SOURCE`   |
| S→C         | `playback:state`                   | принятая сервером версия состояния                    |
| S→C         | `presence:state`                   | уникальные пользователи и роли                        |
| C→S         | `reaction:add`                     | enum-реакция с rate limit                             |
| C→S         | `chat:send`                        | короткий plain-text после проверки доступа/rate limit |
| S→C         | `chat:message`                     | принятое сообщение с автором и серверным временем     |
| C→S         | `chat:delete`, `chat:mute`         | действия владельца/модератора                         |
| S→C         | `chat:deleted`, `chat:restriction` | синхронизация удаления/ограничения                    |
| S→C         | `system:event`                     | join/leave/source/policy события                      |
| C↔S         | Socket.IO ping/ack                 | liveness, задержка, command acknowledgement           |

### Приём команды

API атомарно проверяет membership и `controlPolicy`, capability текущего provider/source, expected source revision, rate limit и уникальность `commandId`. Затем назначает следующую `stateVersion` в транзакции, сохраняет snapshot и только после commit рассылает событие. Конфликтующий клиент получает актуальный snapshot.

### Внутренний чат

Чат использует авторизованные HTTP-команды и тот же Socket.IO room для broadcast, отдельные Zod-схемы и rate limit. Сервер принимает только Unicode plain text длиной 1–500 символов после trim/NFC, запрещает control characters и не интерпретирует HTML/Markdown. На insert в одной транзакции удаляются expired и сообщения сверх 40; expired также фильтруются/удаляются при чтении и фоновой задачей. Удаление комнаты каскадно удаляет чат. Автор может удалить своё сообщение, owner/moderator — любое; owner/moderator может временно mute участника, но moderator не может mute owner. Audit не содержит удалённого текста и живёт до 30 дней. После reconnect клиент получает последние 40 сообщений и свой активный restriction.

Это собственные данные WatchRoom, а не сообщения Telegram. Для MVP нет файлов, preview внешних URL, личных сообщений, редактирования, поиска и push-уведомлений.

### Синхронизация VOD

Для `PLAYING` snapshot хранит `positionSeconds` на `anchorServerTimeMs`. Клиент оценивает server clock offset по нескольким ping/ack и вычисляет целевую позицию как `anchorPosition + elapsed`. После `READY`:

- drift до 0,75 с игнорируется;
- drift 0,75–2 с повторно измеряется, чтобы не реагировать на buffering;
- устойчивый drift более 2 с исправляется `seekTo/seek`;
- paused всегда приводится к точной сохранённой позиции;
- периодический snapshot (примерно каждые 10 с) лечит пропущенные события.

Playback rate не является базовым механизмом: Twitch API не предоставляет симметричной команды, а качество/буферизация остаются у провайдера. Порог уточняется прототипом.

### Live

- YouTube Live: source adapter показывает `LIVE`; play/pause доступны. DVR/seek включаются только после фактической capability-проверки конкретного broadcast/player; без неё UI предлагает «к эфиру» и best-effort перезагрузку.
- Twitch Live: timestamp и duration недоступны, `seek()` не работает. Сервер синхронизирует только намерение play/pause/source; «к эфиру» пересоздаёт/переназначает channel. `hlsLatencyBroadcaster` можно показывать в диагностике, но не обещать как точный общий таймкод.
- В обоих случаях задержка провайдера, реклама, autoplay и buffering делают покадровое равенство недостижимым.

### Feedback-loop и локальные controls

При применении удалённой команды adapter устанавливает краткоживущую suppression marker с ожидаемым provider event. Событие, совпавшее с marker, не отправляется назад. Несовпавшие пользовательские события становятся общими командами только при наличии роли; иначе остаются локальными, а следующий авторитетный snapshot может вернуть плеер к общему состоянию.

## Provider adapters

Общий интерфейс содержит `loadSource`, `play`, `pause`, `seek`, `getCurrentTime`, `getDuration`, `getState`, `setMuted`, `destroy`, события и runtime `capabilities`. Недоступная операция не вызывается UI и защищена `UnsupportedPlayerOperationError`; для Twitch Live time/duration возвращают `null`, seek запрещён. Компонент макета не знает о YouTube/Twitch API.

Embed не размонтируется при переходе между большим, sticky и corner layout: меняется контейнер/стиль, иначе источник перезагрузится и потеряет позицию. Corner-режим для Twitch обязан оставаться не меньше 400×300; на узких экранах он заменяется sticky-режимом. Для YouTube минимум 200×200, но целевой 16:9 размер не меньше 480×270 там, где помещается.

## Telegram integration

- `startapp=room_<publicId>` — только маршрутизация, не авторизация.
- `mode=compact` — отдельная ссылка/предпочтение высоты; приложение всё равно адаптируется к `viewportChanged`, safe area и fullscreen.
- Telegram JS API вызывается через feature detection и `isVersionAtLeast`.
- `shareMessage` требует предварительного `savePreparedInlineMessage` backend-вызова и пользовательского диалога.
- `requestChat` требует `savePreparedKeyboardButton`, Bot API 9.6+ и пользовательского выбора/создания.
- JS callback `requestChat` не завершает привязку: backend ждёт подписанный secret-token webhook с `chat_shared`, сопоставляет одноразовый `request_id` и Telegram user, затем повторно проверяет chat/admin/bot membership через Bot API.
- MVP принимает только public group/supergroup с проверенным username; сервер сам строит `https://t.me/<username>`. Это позволяет не выдавать боту admin/invite-link rights.
- `openTelegramLink` применяется только к проверенной `https://t.me/...` ссылке.
- Mini App не считает `chat_type/chat_instance` правом доступа и не читает сообщения чата.

## Share fallback

```text
явное нажатие
  → Telegram shareMessage (если поддержан и prepared ID не истёк)
  → navigator.share (если функция существует и canShare разрешает payload)
  → navigator.clipboard.writeText
  → select/copy поле + openTelegramLink или switchInlineQuery
```

Каждый шаг вызывается непосредственно в user-activation handler и не передаёт закрытый пароль. `AbortError`/явная отмена прекращает цепочку; unsupported или технический `NotAllowedError` переводит к следующему доступному fallback, если transient activation ещё не потреблена. Prepared message содержит только canonical invite URL и безопасный текст. Поскольку share API может потребить activation даже при ошибке, UI всегда сохраняет отдельную кнопку ручного копирования, а не пытается открыть несколько dialog подряд.

## Масштабирование без Redis в MVP

API запускается в одном экземпляре. Код зависит от интерфейсов `RealtimeBus`, `PresenceStore`, `CommandDeduplicator` и `RoomSequenceCoordinator`, чьи MVP-реализации in-memory/PostgreSQL. Запуск второго инстанса запрещён deployment guard'ом.

Перед горизонтальным масштабированием требуются Redis-compatible managed service, Socket.IO adapter, распределённая presence/dedupe, атомарная последовательность команд и тест reconnect. Если остаётся HTTP long-polling fallback, балансировщик должен поддержать sticky sessions; WebSocket-only режим можно рассмотреть лишь после теста Telegram-клиентов.

## Наблюдаемость и отказоустойчивость

- структурные логи с request/event ID и redaction секретов;
- метрики active sockets, unique presence, reconnect, command latency/reject, provider error/autoplay blocked, drift correction;
- `/health/live` без внешних зависимостей и `/health/ready` с PostgreSQL;
- graceful shutdown: перестать принимать joins, сообщить reconnect hint, закрыть sockets, дождаться транзакций;
- reconnect с jittered exponential backoff, затем обязательный полный snapshot;
- daily backups и проверяемое восстановление PostgreSQL перед production.

## Деплой MVP

Референсный вариант — два Render Web Services из monorepo (`web`, `api`) и managed PostgreSQL в том же регионе. API — один always-on paid instance; Render официально не задаёт фиксированный timeout WebSocket, но deploy/maintenance закрывают соединения, поэтому reconnect обязателен. Free backend допустим только для краткого прототипа: он засыпает при неактивности и даёт cold start. См. [Render WebSockets](https://render.com/docs/websocket) и [service behavior](https://render.com/docs/faq).

Web может быть вынесен на другую платформу, но API обязан оставаться на long-lived WebSocket runtime. Домены фиксируются до Twitch-пилота, потому что `parent` должен перечислять production/preview hostname. Preview deployments без заранее разрешённого hostname используют Twitch-disabled заглушку, а не wildcard.

## Открытые вопросы только для прототипа

1. Реальное поведение YouTube Live с DVR в Telegram iOS/Android/Desktop и доступность reliable go-live.
2. Autoplay/user gesture после удалённого `PLAY`, особенно когда локальный пользователь ещё не нажимал player.
3. Twitch embed 400×300 в compact Mini App на малых экранах и поведение при Telegram viewport changes.
4. Стабильность Twitch `parent`/Referer и YouTube error 153 внутри разных Telegram WebView.
5. Доступность `shareMessage`, `requestChat`, Web Share, clipboard и системного PiP по матрице клиентов.
6. Практический drift threshold при buffering, ads и разной latency.
