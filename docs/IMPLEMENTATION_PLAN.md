# План реализации WatchRoom

Проектирование, этапы 0, 1, основная часть этапа 2, provider adapters, realtime core и product UI завершены. Реальная Telegram device/provider matrix, audit, backup/restore и production hardening остаются впереди. Каждая фаза заканчивается demonstrable acceptance gate; переход без него запрещён.

## Этап 0. Bootstrap monorepo

Работы: pnpm workspace, `apps/web`, `apps/api`, `packages/shared`, strict TypeScript, lint/format/test, Dockerfiles, Compose с PostgreSQL 17.11, env schema, CI, exact dependencies и lockfile.

Критерии:

- clean clone поднимается одной документированной командой;
- build/typecheck/unit проходят в CI на Node 24.20.0;
- package versions точные, canary/experimental отсутствуют;
- secrets отсутствуют в repo/client bundle;
- только PostgreSQL, Redis не запускается.

## Этап 1. Telegram auth и security foundation

Работы: raw initData validator, test vectors, session store/cookie, Origin/CORS/CSRF, rate limits, redacted logging, error envelope, health endpoints.

Критерии:

- valid official-format initData создаёт session; altered, malformed, duplicate, stale отклоняются;
- `initDataUnsafe` нигде не авторизует;
- raw initData/bot token/cookie не попадают в logs;
- HTTP и Socket.IO используют одну revoked-aware session;
- negative origin/CSRF tests проходят.

## Этап 2. Domain model: каналы, роли и комнаты

Статус: channel/room CRUD, роли, Argon2id, grants, presence, invite links и ограниченный chat реализованы. Audit и реальный PostgreSQL backup/restore gate остаются незавершёнными, поэтому весь этап 2 ещё не закрыт.

Работы: Prisma schema/migrations, channel/membership/room CRUD, cryptographic publicId, Argon2id password, password revisions/grants, audit.

Критерии:

- owner/moderator/member authorization покрыта integration tests;
- plaintext password отсутствует в DB/log/events;
- brute-force limit действует; rotation инвалидирует grants и sockets;
- publicId не заменяет authentication/authorization;
- backup/restore test migration выполнен.

## Этап 3. Provider metadata и player prototype gate

Работы: allowlisted URL parsers, YouTube Data API/Twitch Helix adapters, official iframe prototypes на Telegram iOS/Android/Desktop, capability telemetry, layout size tests.

Критерии:

- четыре source types нормализуются; arbitrary URL/SSRF corpus отклоняется;
- YouTube non-embeddable и provider errors корректно показаны;
- Twitch `parent` работает на production-like hostname;
- mobile autoplay blocked имеет tap recovery;
- YouTube Live DVR/go-live, Twitch Live reload, compact 400×300 и Referer/error 153 задокументированы реальными результатами;
- решение об YouTube Live seek обновляет capability matrix/ADR.

## Этап 4. Realtime room core

Работы: Socket.IO protocol, join/snapshot, authoritative command authorization/versioning, VOD anchor sync, reconnect, dedupe, presence, простой чат и graceful shutdown.

Критерии:

- два и более clients сходятся после play/pause/seek/source в установленном прототипом допуске;
- stale source/version command не применяется;
- forbidden role не меняет shared state;
- reconnect/restart восстанавливает PostgreSQL snapshot;
- multi-tab viewer считается один раз;
- chat принимает только plain text до 500 символов; в БД нельзя получить больше 40 сообщений комнаты или сообщения старше 24 часов;
- owner/mod delete и temporary mute проходят authorization tests, а reconnect возвращает согласованный chat snapshot;
- reconnect storm/load test не даёт unbounded memory.

## Этап 5. Product UI и share flows

Статус: интерфейс, внутренний sticky/mini-player, Telegram lifecycle hooks, accessibility, component tests и двухконтекстный browser e2e реализованы. Реальная Telegram iOS/Android/Desktop matrix остаётся частью prototype gate этапа 3 и production pilot.

Работы: Telegram theme/safe area/viewport, preview, password flow, participant roles, policies, full/sticky/corner layout, простой chat UI, reactions/system events, canonical/compact links, Telegram/Web Share/clipboard/manual fallbacks.

Критерии:

- preview содержит требуемые поля и не раскрывает password/access;
- Twitch никогда визуально не меньше 400×300, YouTube — 200×200;
- share/copy работают либо дают ручной fallback на каждом target client;
- user cancellation обрабатывается спокойно;
- internal mini-player полностью работает без system PiP;
- чат показывает только 40 последних сообщений, не рендерит HTML/Markdown и предоставляет moderation controls владельцу/модератору;
- accessibility keyboard/focus/labels и reduced motion проверены.

## Этап 6. Telegram chat binding

Работы: Bot API prepared keyboard button endpoint, `requestChat` feature detection, service message/update processing, binding/unbinding UI, manual fallback для старых clients.

Критерии:

- flow запускается только user click;
- пользователь может отменить без изменения state;
- бот не создаёт чат скрытно и не просит лишние admin rights;
- сохраняется только минимальная metadata;
- UI не обещает чтение/встроенную переписку.

## Этап 7. Hardening и production pilot

Работы: CSP report-only→enforce, security/privacy/legal review чата, metrics/alerts, backups/restore, incident/rotation/moderation runbooks, Render manifests, soak/load/provider matrix, terms/privacy copy.

Критерии:

- все security gates из `SECURITY.md` зелёные;
- 24-часовой soak и controlled deploy показывают reconnect/recovery;
- paid always-on single API и DB находятся в одном регионе;
- dashboards видят provider errors, autoplay block, reconnect и command latency;
- runbook восстанавливает DB и rotates каждый secret;
- pilot не запускается, пока platform prototype risks не имеют явного owner/decision.

## После MVP

Только после подтверждённой нагрузки: Redis-compatible adapter, несколько API instances, distributed presence/sequence, sticky/polling решение и новая нагрузочная приёмка. Полноценный чат (файлы, история, поиск, личные сообщения), anonymous web и multi-source требуют отдельных product/security ADR.
