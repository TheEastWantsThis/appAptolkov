# WatchRoom — статус реализации

Обновлено 2 сентября 2026 года по коду, deployment status и фактическим smoke-командам.

## Этапы 1–10 и финальный аудит

| Этап                                    | Статус            | Подтверждение / остаток                                                                                                                                                                                                   |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Исследование и проект                | Завершён          | PRODUCT/ARCHITECTURE/PLATFORM_LIMITS/SECURITY, ADR и план основаны на официальных источниках.                                                                                                                             |
| 2. Monorepo и локальная среда           | Завершён          | strict TypeScript, pnpm lockfile, web/api/shared, PostgreSQL Compose, health, Dockerfiles, CI.                                                                                                                            |
| 3. Telegram auth, users, channels       | Завершён          | HMAC/freshness/replay/session/CSRF; Channel CRUD и owner/moderator/member API/UI/tests.                                                                                                                                   |
| 4. Rooms, access, roles, invites        | Завершён          | PUBLIC/PRIVATE, Argon2id/grants/rate limit, lifecycle, capability matrix, preview/catalog/deep links.                                                                                                                     |
| 5. YouTube/Twitch adapters              | Завершён в коде   | Official SDK, parser/allowlist, metadata cache, autoplay/error/capability UX. Реальные provider smoke остаются release gate.                                                                                              |
| 6. Realtime/presence/chat core          | Завершён          | Authoritative Socket.IO state, CAS/drift/dedupe, heartbeat/grace, transactional 40/24h chat и 100-connection smoke.                                                                                                       |
| 7. Room UI/player                       | Завершён в коде   | Mobile room states, roles/reactions/chat/owner controls, stable player, sticky rules, PiP detection, accessibility. Device QA остаётся release gate.                                                                      |
| 8. Ограниченный чат/Telegram discussion | Завершён в коде   | Moderation/audit, requestChat binding, reactions/system events, shareMessage/switchInlineQuery/fallbacks. Native client smoke остаётся.                                                                                   |
| 9. Hardening                            | Завершён локально | Authorization/origin/CSRF/rate limits/CSP/headers/privacy/metrics/abuse queue/retention/audit; Critical/High не открыты.                                                                                                  |
| 10. Deploy closed MVP                   | Выполняется       | Web опубликован на Vercel, API/WSS и PostgreSQL 17 работают на Render Free; migrations и network smoke прошли. Main Mini App доходит до web; остаются повторный mobile auth, webhook/requestChat и provider/device smoke. |
| Финальный аудит                         | Завершён          | Актуальный вывод и P0/P1/P2 находятся в `FINAL_AUDIT.md`.                                                                                                                                                                 |

## Последние закрытые дефекты

- Исправлен бесконечный загрузчик прямой ссылки на комнату: ошибка Telegram-аутентификации теперь показывается сразу с кнопкой повторного входа. REST-запросы имеют конечный timeout; при холодном запуске Render интерфейс объясняет задержку вместо молчаливого зависания.
- Экран комнаты переработан в компактную мобильную ленту: повторяющиеся заголовки и постоянные playback/status-баннеры удалены, плеер идёт первым, а единый Telegram-подобный чат с онлайном и реакциями расположен непосредственно под ним. Ошибка запрещённого embed больше не оставляет пустую чёрную область.
- Мобильная Telegram-аутентификация больше не зависит от cross-site cookie Vercel→Render: opaque session token хранится только в `sessionStorage`, передаётся как Bearer для REST и Socket.IO auth, остаётся hashed/revocable на сервере; cookie/CSRF сохранены как fallback. `Authorization` включён в точный CORS allowlist. Клиент до 1,5 секунды ожидает позднюю инициализацию Telegram `initData` и показывает конкретную ошибку при его отсутствии.
- Закрыт новый High dependency advisory: транзитивный Prisma `mysql2` закреплён на исправленной `3.22.0`; повторный `pnpm audit --audit-level high` сообщает `No known vulnerabilities found`.
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
| `pnpm test`                     | PASS: shared 41, API 40, web 20 = 101; PostgreSQL-gated файл skip без URL                         |
| `pnpm test:e2e`                 | PASS: 2 Chromium mobile сценария, два isolated browser contexts                                   |
| `pnpm build`                    | PASS: shared/API/Next.js production                                                               |
| `pnpm audit --audit-level high` | PASS: `No known vulnerabilities found`                                                            |
| `docker compose config --quiet` | PASS                                                                                              |
| `pnpm db:generate`              | PASS, Prisma schema/client согласованы                                                            |
| Production artifact scan        | PASS: dev identity implementation и client/server secrets отсутствуют; test/example DSN допустимы |

## Фактический закрытый test deployment

- Web: `https://watchroom-miniapp.vercel.app` — Vercel production `Ready`.
- API/WSS: `https://watchroom-api-e5sf.onrender.com` — Render Free `Live`.
- PostgreSQL 17: `watchroom-db` — Render Free `Available`; все 9 миграций применены.
- `pnpm release:smoke`: PASS для web health, API liveness/readiness с database check, CSP и unauthenticated WSS boundary.
- Production browser без Telegram initData корректно получает отказ. Bot identity зафиксирован как `@WatchRoomTogether_bot` с Mini App short name `watchroom`; реальный Telegram launch доходит до web, но вход на мобильной Bearer/CORS ревизии должен повторно подтвердить владелец.

GitHub CI на текущей production-линии успешно поднял чистую PostgreSQL 17, применил все 9 миграций и выполнил `test:postgres`: две Telegram identity, public/private room, Socket.IO deny/sync, abuse workflow и 45 конкурентных сообщений с фактическим остатком 40. Локальный Docker Desktop на этой машине по-прежнему недоступен, поэтому источником доказательства пустой БД служит зелёный CI gate.

## Архитектурные ограничения MVP

- Только один API/Socket.IO instance; Redis adapter нужен до горизонтального масштабирования.
- Telegram-чат не читается. Внутренний чат — plain text, максимум 40 сообщений и 24 часа. Это всё равно пользовательский контент/персональные данные: нужны privacy notice, abuse contact и локальная юридическая проверка.
- Live sync best-effort; Twitch Live seek невозможен. Autoplay/PiP/embed availability не гарантируются платформами.
- `shareMessage`, `requestChat`, compact/fullscreen, clipboard/Web Share зависят от клиента и user action, поэтому fallbacks обязательны.
- CSP script `'unsafe-inline'` остаётся Medium risk до nonce/hash rollout; provider/frame origins при этом ограничены.

## Что нужно от владельца для этапа 10

1. Повторно проверить мобильный вход через уже настроенный Main Mini App/menu button с short name `watchroom` и настроить/подтвердить webhook для `@WatchRoomTogether_bot`.
2. Bot token продолжает храниться только в Render secret storage.
3. Выполнить Telegram Android/iOS/Desktop и реальные YouTube/Twitch embed smoke.
4. До реального хранения пользовательских данных перейти с истекающей Free DB либо явно принять её ограничения.

После этого выполняются migrations, deploy, Telegram setup, URL/API/WSS/embed smoke, device matrix и restore rehearsal по `RELEASE_CHECKLIST.md`.

## Текущее решение

**NOT READY для приглашённых пользователей; READY для проверки владельцем.** Сетевая инфраструктура, bot identity и invite-link код работают; блокеры — повторное подтверждение mobile auth, webhook/requestChat, provider/device smoke и restore rehearsal.
