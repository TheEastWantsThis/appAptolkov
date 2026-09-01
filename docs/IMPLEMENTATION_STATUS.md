# WatchRoom — статус реализации

Обновлено 1 сентября 2026 года по коду, deployment status и фактическим smoke-командам.

## Этапы 1–10 и финальный аудит

| Этап                                    | Статус            | Подтверждение / остаток                                                                                                                                                     |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Исследование и проект                | Завершён          | PRODUCT/ARCHITECTURE/PLATFORM_LIMITS/SECURITY, ADR и план основаны на официальных источниках.                                                                               |
| 2. Monorepo и локальная среда           | Завершён          | strict TypeScript, pnpm lockfile, web/api/shared, PostgreSQL Compose, health, Dockerfiles, CI.                                                                              |
| 3. Telegram auth, users, channels       | Завершён          | HMAC/freshness/replay/session/CSRF; Channel CRUD и owner/moderator/member API/UI/tests.                                                                                     |
| 4. Rooms, access, roles, invites        | Завершён          | PUBLIC/PRIVATE, Argon2id/grants/rate limit, lifecycle, capability matrix, preview/catalog/deep links.                                                                       |
| 5. YouTube/Twitch adapters              | Завершён в коде   | Official SDK, parser/allowlist, metadata cache, autoplay/error/capability UX. Реальные provider smoke остаются release gate.                                                |
| 6. Realtime/presence/chat core          | Завершён          | Authoritative Socket.IO state, CAS/drift/dedupe, heartbeat/grace, transactional 40/24h chat и 100-connection smoke.                                                         |
| 7. Room UI/player                       | Завершён в коде   | Mobile room states, roles/reactions/chat/owner controls, stable player, sticky rules, PiP detection, accessibility. Device QA остаётся release gate.                        |
| 8. Ограниченный чат/Telegram discussion | Завершён в коде   | Moderation/audit, requestChat binding, reactions/system events, shareMessage/switchInlineQuery/fallbacks. Native client smoke остаётся.                                     |
| 9. Hardening                            | Завершён локально | Authorization/origin/CSRF/rate limits/CSP/headers/privacy/metrics/abuse queue/retention/audit; Critical/High не открыты.                                                    |
| 10. Deploy closed MVP                   | Выполняется       | Web опубликован на Vercel, API/WSS и PostgreSQL 17 работают на Render Free; migrations и network smoke прошли. Остались BotFather/webhook и Telegram/provider device smoke. |
| Финальный аудит                         | Завершён          | Актуальный вывод и P0/P1/P2 находятся в `FINAL_AUDIT.md`.                                                                                                                   |

## Последние закрытые дефекты

- Комната упрощена под мобильный сценарий: отдельные start/play/pause/seek controls удалены, разрешённые play/pause теперь отправляются из событий официального плеера; close у mini-player удалён, режимы переключаются компактными icon-кнопками.
- Чат перенесён сразу под видео, получил Telegram-подобные bubbles, собственные сообщения справа, автопрокрутку, компактный composer и удаление только через меню сообщения.
- Deep link routing теперь учитывает signed `start_param`, query/hash launch parameters и `initDataUnsafe.start_param` только как недоверенную навигационную подсказку; доступ к комнате по-прежнему проверяет сервер.
- Добавлен отдельный каталог публичных каналов; закрытые каналы в него не попадают, а индекс `Channel(visibility, updatedAt)` обеспечивает ограниченную выдачу последних 50 записей.
- Исправлена production-сессия для временной cross-site топологии Vercel/Render: `SameSite=Lax` не передавался из Telegram WebView к API; теперь используется `Secure; HttpOnly; SameSite=None; Partitioned` с прежними exact Origin и CSRF проверками.
- Добавлены роли внутреннего канала и owner-only управление участниками через безопасный Telegram username.
- Введён отдельный `RoomPreviewDto`; pre-join больше не выдаёт full Room DTO, а preview показывает максимум три active display names.
- Lifecycle стал однонаправленным, playback/source/chat после `ENDED` запрещены; Twitch Live применяет versioned reload-to-edge через официальный adapter.
- Добавлены `lastSeenAt`, pagination и очистка inactive viewer membership, sessions, replay, grants и restrictions.
- Avatar URL ограничен теми же YouTube/Twitch/Telegram host allowlists, которые разрешены CSP.
- Telegram fallback использует `switchInlineQuery`; webhook безопасно отвечает `answerInlineQuery` приглашением без пароля.
- Abuse reports получили защищённую operations queue и состояния OPEN/RESOLVED/DISMISSED.
- Mock identity вынесена в dev-only module, который удаляется production API build; production config также fail-closed.
- Удалён UI-ввод raw UUID для модератора комнаты; действия доступны непосредственно у participant row.

## Проверки этой ревизии

| Команда                         | Результат                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm lint`                     | PASS                                                                                              |
| `pnpm typecheck`                | PASS                                                                                              |
| `pnpm test`                     | PASS: shared 41, API 39, web 20 = 100; PostgreSQL-gated файл skip без URL                         |
| `pnpm test:e2e`                 | PASS: 2 Chromium mobile сценария, два isolated browser contexts                                   |
| `pnpm build`                    | PASS: shared/API/Next.js production                                                               |
| `pnpm audit --audit-level high` | PASS: `No known vulnerabilities found`                                                            |
| `docker compose config --quiet` | PASS                                                                                              |
| `pnpm db:generate`              | PASS, Prisma schema/client согласованы                                                            |
| Production artifact scan        | PASS: dev identity implementation и client/server secrets отсутствуют; test/example DSN допустимы |

## Фактический закрытый test deployment

- Web: `https://watchroom-miniapp.vercel.app` — Vercel production `Ready`.
- API/WSS: `https://watchroom-api-e5sf.onrender.com` — Render Free `Live`.
- PostgreSQL 17: `watchroom-db` — Render Free `Available`; все 8 миграций применены.
- `pnpm release:smoke`: PASS для web health, API liveness/readiness с database check, CSP и unauthenticated WSS boundary.
- Production browser без Telegram initData корректно получает отказ. Bot identity зафиксирован как `@WatchRoomTogether_bot` с Mini App short name `watchroom`; реальный Telegram launch ещё не подтверждён.

Ранее на изолированной PostgreSQL 17 успешно применены миграции 1–7 и прошёл реальный `test:postgres`: две Telegram identity, public/private room, Socket.IO deny/sync и 45 конкурентных сообщений с фактическим остатком 40. Тест расширен проверкой operations abuse workflow. Локальный повтор для миграции 8 не состоялся: Docker Desktop 4.88.1 падает до запуска engine на недоступном stale `sailor-ingest.sock`. CI workflow поднимает чистую PostgreSQL 17, выполняет все migrations и этот gate; до зелёного CI релиз запрещён.

## Архитектурные ограничения MVP

- Только один API/Socket.IO instance; Redis adapter нужен до горизонтального масштабирования.
- Telegram-чат не читается. Внутренний чат — plain text, максимум 40 сообщений и 24 часа. Это всё равно пользовательский контент/персональные данные: нужны privacy notice, abuse contact и локальная юридическая проверка.
- Live sync best-effort; Twitch Live seek невозможен. Autoplay/PiP/embed availability не гарантируются платформами.
- `shareMessage`, `requestChat`, compact/fullscreen, clipboard/Web Share зависят от клиента и user action, поэтому fallbacks обязательны.
- CSP script `'unsafe-inline'` остаётся Medium risk до nonce/hash rollout; provider/frame origins при этом ограничены.

## Что нужно от владельца для этапа 10

1. Настроить Main Mini App/menu button с short name `watchroom` и webhook для `@WatchRoomTogether_bot`.
2. Bot token продолжает храниться только в Render secret storage.
3. Выполнить Telegram Android/iOS/Desktop и реальные YouTube/Twitch embed smoke.
4. До реального хранения пользовательских данных перейти с истекающей Free DB либо явно принять её ограничения.

После этого выполняются migrations, deploy, Telegram setup, URL/API/WSS/embed smoke, device matrix и restore rehearsal по `RELEASE_CHECKLIST.md`.

## Текущее решение

**NOT READY для приглашённых пользователей.** Сетевая инфраструктура работает; блокеры — фактический Telegram launch/webhook, bot identity в invite links и provider/device smoke.
