# Финальный независимый аудит WatchRoom

Дата: 2 сентября 2026 года.

Итог: **NOT READY** для приглашения внешних пользователей, но готово для проверки владельцем. Production Vercel/Render/PostgreSQL развёрнут, девять миграций и full-stack PostgreSQL/Socket.IO gate прошли в CI, network smoke зелёный. Остаются внешние release gates: повторный реальный мобильный Telegram login после Bearer/CORS fix, Android/iOS/Desktop, официальные provider embeds, Telegram webhook/requestChat и restore rehearsal.

## Метод

Проверены исходники, Prisma schema/SQL, REST и Socket.IO authorization, официальный player integration, production artifacts, тесты и документация. Платформенные выводы сверены по первичным источникам: [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [Telegram Bot API](https://core.telegram.org/bots/api), [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality), [Twitch Video Embed](https://dev.twitch.tv/docs/embed/video-and-clips/) и [Twitch Embedding Requirements](https://dev.twitch.tv/docs/embed/).

## 1. Полностью реализовано

- Официальная server-side проверка raw Telegram `initData`, TTL `auth_date`, replay protection, opaque hashed/revocable session, HttpOnly cookie fallback, mobile Bearer/CORS path, CSRF для cookie, logout/revocation и production-запрет mock auth.
- User и внутренние Channel: owner/moderator/member, CRUD, добавление по ранее подтверждённому Telegram username, immutable owner и server-side authorization.
- PUBLIC/PRIVATE Room, случайный `publicId`, Argon2id, password revision, room grant, throttling, lifecycle `DRAFT → WAITING → LIVE → ENDED` без resurrection.
- Ограниченный pre-join preview DTO: безопасные metadata, live viewer count и не более трёх display names; полный DTO доступен только после join/grant.
- Роли Room и capability matrix; `EVERYONE` получает только playback, административные/чат-модерационные права остаются owner/moderator.
- Официальные YouTube/Twitch embeds через общий adapter, строгие URL parsers/allowlists, Twitch `parent`, provider minimum sizes, autoplay-blocked UX и понятная embedding error.
- Authoritative realtime: CAS/version, server time, command dedupe, VOD drift correction, reconnect/presence/heartbeat и Twitch Live reload-to-edge без seek.
- Plain-text chat: 500 символов, 40 сообщений, TTL 24 часа, транзакционный PostgreSQL room lock, чтение без expired, минутная очистка, mute/delete и audit без удалённого текста. После `ENDED` чат read-only.
- Telegram discussion binding: явный `savePreparedKeyboardButton → requestChat → chat_shared`, повторная проверка прав пользователя/бота и безопасный fallback.
- Sharing: deep links/startapp/compact, `shareMessage`, `switchInlineQuery → answerInlineQuery`, `openTelegramLink`, Web Share и clipboard; пароль в ссылку не попадает.
- Abuse report и owner block; bearer-защищённая operations queue OPEN/RESOLVED/DISMISSED.
- Retention для sessions/replays/grants/restrictions/inactive viewers, member pagination, privacy-safe metrics, request ID, liveness/readiness, non-root images и CI PostgreSQL release gate.

## 2. Частично реализовано

| Требование              | Фактическое состояние                                                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Полный browser e2e      | Playwright проверяет два isolated contexts и критические UI-состояния с mocked transport. Отдельный реальный PostgreSQL/API/Socket.IO gate проверяет две identity, public/private access, permission deny, sync, concurrent chat и abuse workflow. Это сильнее unit-теста, но ещё не один сквозной browser+backend процесс. |
| Provider metadata/embed | Официальные adapters и API clients готовы; YouTube quota, Twitch credentials, региональные/cookie/owner restrictions подтверждаются только на production domain.                                                                                                                                                            |
| Telegram UX             | Методы и fallbacks реализованы, но `shareMessage`, `requestChat`, compact/fullscreen, viewport и возврат после `openTelegramLink` не проверены на трёх реальных клиентах.                                                                                                                                                   |
| PiP                     | Feature detection корректен; cross-origin YouTube/Twitch обычно не дают доступ к underlying video, поэтому это лишь progressive enhancement.                                                                                                                                                                                |
| Deployment              | Vercel web, Render API/WSS и PostgreSQL 17 работают; health/CSP/WSS/CORS smoke пройден. Render Free может просыпаться до 50 секунд. Backup/restore runbook есть, но restore rehearsal ещё не выполнен.                                                                                                                      |

## 3. Отсутствует

- Подтверждение мобильного входа владельцем на уже опубликованной Bearer/CORS ревизии.
- Подтверждённый Telegram webhook для `requestChat`/inline fallback; Main Mini App уже открывает опубликованный web.
- Device matrix Android/iOS/Desktop и четыре реальных provider smoke на production domain.
- Backup/restore rehearsal и записанные фактические RPO/RTO.
- Redis/distributed coordination — намеренно вне single-instance MVP.

## 4. Что платформа не гарантирует

- Mobile autoplay без пользовательского жеста.
- Одинаковую live latency и покадровую синхронизацию; Twitch Live seek отсутствует.
- Системный PiP для cross-origin iframe.
- Доступность embed при запрете владельца, регионе, возрасте, cookies или provider outage.
- Поддержку `shareMessage`, `requestChat`, Web Share, clipboard, compact/fullscreen каждым клиентом.
- Сохранение WebView при переходе в Telegram-чат; приложение сохраняет route/state и переподключается best-effort.
- Скрытое создание Telegram-канала или чтение истории Telegram-чата.

## 5. Безопасность

Открытых Critical/High дефектов в проверенном коде не найдено. Повторный dependency audit обнаружил High advisory в транзитивном `mysql2@3.15.3` из Prisma; workspace override зафиксировал `mysql2@3.22.0`, после чего audit: `No known vulnerabilities found`. WatchRoom использует PostgreSQL, но уязвимая необязательная зависимость всё равно не оставлена.

Остаточные Medium:

- production CSP содержит `'unsafe-inline'` для Next/Telegram совместимости; источники ограничены allowlist, nonce/hash rollout назначен до public beta;
- in-memory limiter/presence/dedupe безопасны только при одном API instance;
- self-service удаления аккаунта нет, до закрытого теста необходима ручная privacy-процедура;
- Bearer token временного cross-site deployment доступен JavaScript в `sessionStorage`; CSP, TTL, server revocation и отсутствие token в URL/логах уменьшают риск, но целевой same-site HttpOnly cookie безопаснее;
- реальная provider/device поверхность не прошла security smoke.

Production server build удаляет модуль dev-auth; browser bundle и production API artifact не содержат `watchroom_dev`/`mock:` implementation. Конфигурация дополнительно отклоняет `MOCK_TELEGRAM_AUTH=true` в production.

## 6. Масштабирование

- Несколько API replicas пока недопустимы: presence, room locks, dedupe и rate buckets локальны процессу.
- Metadata cache локален и после restart повторяет официальные API requests.
- Нагрузочный smoke — 100 WebSocket connections без видео; он не моделирует долгий soak, reconnect storm и несколько тысяч комнат.
- PostgreSQL serialized chat writes корректны для лимита 40, но требуют наблюдения за contention в реальной нагрузке.

## 7. Telegram/YouTube/Twitch

Подтверждённых нарушений официальных требований в коде не найдено. Raw initData проверяется официальной HMAC-схемой; direct Mini App не заявляет доступ к чату; пользователь явно выбирает share/chat. YouTube/Twitch потоки не скачиваются и не проксируются. Twitch получает `parent`, Live не получает seek, а слишком маленький Twitch player заменяется sticky layout. YouTube branding/controls не перекрываются.

## 8. Ненужная сложность

Микросервисов, Redis, queue или Kubernetes нет. Допустимая цена сложности — два store implementation (Prisma/Memory) и provider adapters: они ускоряют unit/in-process tests. Наиболее спорный участок — объём room page; после MVP его стоит разделить на hooks/panels без изменения поведения.

## 9. Недостаточно проверено

- единый browser → real API → PostgreSQL → Socket.IO e2e;
- длительный authenticated mobile session после suspend/activate на реальном Telegram WebView;
- reconnect/rolling deploy и длительный soak;
- production CSP console на Telegram clients;
- provider autoplay/error/cookie/region matrix;
- backup restore и operator abuse SLA.

## Фактические команды

| Проверка                        | Результат                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                     | PASS                                                                                                     |
| `pnpm typecheck`                | PASS, strict shared/api/web                                                                              |
| `pnpm test`                     | PASS: shared 41, API 40, web 20 = 101; 1 PostgreSQL-gated файл локально пропущен без `TEST_DATABASE_URL` |
| `pnpm test:e2e`                 | PASS: 2 Chromium mobile сценария                                                                         |
| `pnpm build`                    | PASS: shared, API, Next.js production                                                                    |
| `pnpm audit --audit-level high` | PASS: no known vulnerabilities                                                                           |
| `docker compose config --quiet` | PASS                                                                                                     |
| PostgreSQL release gate         | PASS в GitHub CI: все 9 миграций на пустой PostgreSQL 17 и PostgreSQL + Socket.IO full-stack test        |
| Secret/artifact scan            | PASS для реальных secret patterns; найденные DSN — только test/example credentials                       |

## Приоритеты до смены решения

| Приоритет | Размер | Критерий приёмки                                                                                                                                |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | S      | Владелец повторно открывает Mini App с телефона и подтверждает login, создание публичного канала, комнаты и вход по `startapp=room_<publicId>`. |
| P0        | M      | Подтверждены Telegram webhook/requestChat и минимум по одному реальному YouTube/Twitch embed на production domain.                              |
| P0        | M      | Android/iOS/Desktop проходят startapp/compact/share/requestChat/autoplay/return-state checklist; результаты записаны без секретов.              |
| P0        | S      | Backup восстановлен в отдельную БД; зафиксированы RPO/RTO и rollback rehearsal.                                                                 |
| P1        | M      | Добавлен единый non-mocked browser full-stack e2e либо текущие два gates формально приняты release owner как эквивалент.                        |
| P1        | M      | CSP nonce/hash prototype устраняет script `'unsafe-inline'` без поломки Telegram/players.                                                       |
| P2        | M      | Room page разделена и добавлены soak/reconnect-storm tests.                                                                                     |

## Решение

**NOT READY** для 10–20 приглашённых пользователей — продуктовый код и production network готовы, но реальный mobile/provider/restore evidence ещё не закрыт. После P0 device/provider и restore gates решение меняется на `READY WITH LISTED LIMITATIONS`.
