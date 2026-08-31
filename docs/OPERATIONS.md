# WatchRoom — эксплуатация MVP

## Топология и ответственность

MVP запускается как один Next.js web, один постоянный Node.js API/Socket.IO instance и PostgreSQL. API должен работать на платформе с долгими WebSocket-соединениями. Горизонтальный запуск нескольких API instance запрещён до общего presence/rate-limit/command-dedupe adapter.

Секреты (`TELEGRAM_BOT_TOKEN`, metrics/operations credentials, Twitch/YouTube credentials, database URL) задаются secret manager платформы. Они не попадают в `NEXT_PUBLIC_*`, логи, issue tracker или browser bundle.

## Health и наблюдаемость

- `GET /health/live` проверяет процесс; оркестратор может перезапустить instance при ошибке.
- `GET /health/ready` проверяет PostgreSQL; instance без readiness не получает новый трафик.
- `GET /metrics` включается только при `METRICS_BEARER_TOKEN` и принимает `Authorization: Bearer …`.
- Метрики содержат только агрегаты: активные комнаты/socket, ошибки, player errors, reconnect и autoplay blocked.
- `x-request-id` генерируется сервером и возвращается клиенту; искать инцидент следует по нему, не по Telegram ID или тексту сообщения.

Минимальные alerts для закрытого теста: readiness 0, рост 5xx, reconnect burst, соединения у лимита instance, backup failure. Privacy-safe telemetry не содержит URL комнаты, `publicId`, user ID, chat text, initData или токены.

## Deploy и rollback

1. Создать зашифрованную резервную копию БД.
2. Запустить `pnpm install --frozen-lockfile`, `pnpm build` и автоматические проверки на exact lockfile.
3. Выполнить `pnpm db:deploy` отдельной release job.
4. Развернуть API, дождаться readiness, затем web.
5. Проверить auth, PRIVATE room, Socket.IO и provider embed с production origin.
6. При ошибке откатить приложение на совместимую версию. Миграции считаются forward-only; destructive schema rollback выполняется только из проверенной backup-копии.

API при остановке прекращает принимать соединения, закрывает Socket.IO/HTTP и PostgreSQL в пределах `SHUTDOWN_TIMEOUT_MS`. Владелец комнаты при временном disconnect не теряет роль: это persisted ownership, presence получает grace period. Автоматической передачи ownership нет. При `OWNER_ONLY` управление ждёт возвращения владельца; при `MODERATORS` продолжают назначенные модераторы.

## PostgreSQL backup

Пример создаёт custom-format backup; значения подключения берутся из secret manager, а не вставляются в shell history:

```powershell
pg_dump --dbname "$env:WATCHROOM_DATABASE_URL" --format=custom --no-owner --file "watchroom-YYYYMMDD-HHMM.dump"
```

Копия шифруется и переносится в отдельное хранилище с контролем доступа. Для закрытого MVP: ежедневная полная копия, хранение 7 ежедневных и 4 недельных копий. Это даёт проектный RPO до 24 часов; фактический RTO определяется rehearsal и записывается в журнал.

## Restore rehearsal

Restore всегда сначала выполняется в новой изолированной БД. Не использовать production URL как тренировочную цель.

```powershell
createdb watchroom_restore_check
pg_restore --dbname "postgresql://<restore-user>@<restore-host>/watchroom_restore_check" --no-owner --exit-on-error "watchroom-YYYYMMDD-HHMM.dump"
pnpm db:deploy
```

После восстановления проверить `/health/ready`, количество users/channels/rooms, отсутствие plaintext password/session tokens и чтение актуальных комнат. Только после письменного подтверждения инцидент-менеджера допускается restore в production. Перед ним создаётся последняя копия повреждённого состояния.

## Инциденты и abuse

- Немедленно отозвать скомпрометированный bot/provider/metrics secret и перезапустить instance.
- Logout отзывает одну сессию; глобальная блокировка пользователя учитывается при каждом session lookup.
- Владелец может блокировать участника комнаты; жалоба хранит категорию/описание, но не копирует chat text, и истекает через 90 дней.
- Очередь доступна только operations-роли: `GET /internal/abuse-reports?status=OPEN&limit=50` с `Authorization: Bearer <OPERATIONS_BEARER_TOKEN>`; обработка выполняется `PATCH /internal/abuse-reports/<uuid>` с `{ "status": "RESOLVED" | "DISMISSED", "resolution": "..." }`. Token отдельный от metrics, минимум 32 символа, обязателен в production.
- Дежурный фиксирует решение без копирования удалённого сообщения. Повторная обработка уже закрытой жалобы отклоняется; автоматической блокировки по одной жалобе нет.
- Удаление/модерация пишутся в audit без удалённого текста. Abuse/privacy контакт обрабатывает жалобы и запросы удаления по `requestId`/internal IDs.
- После инцидента удалить лишние диагностические выгрузки и задокументировать срок их хранения.
