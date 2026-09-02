# ADR 0005: Telegram initData и серверные сессии

- Статус: принято
- Дата: 2026-08-29
- Изменено: 2026-09-02

## Решение

API принимает только исходную строку `Telegram.WebApp.initData`. Сервер строго разбирает query string без повторяющихся ключей, проверяет HMAC-SHA-256 по официальной схеме Telegram, `auth_date` (не старше 5 минут и не более чем на 30 секунд в будущем) и обязательный объект `user`. `initDataUnsafe` не участвует в авторизации.

После проверки API атомарно обновляет кеш User, записывает SHA-256 digest использованного `initData` для защиты от replay и создаёт непрозрачную случайную сессию на 12 часов. В PostgreSQL хранится только SHA-256 токена. На одном site предпочтителен `HttpOnly; Secure; SameSite=Lax` cookie. Для временной cross-site топологии Vercel/Render API дополнительно возвращает тот же непрозрачный токен клиенту: Mini App хранит его только в `sessionStorage`, передаёт в `Authorization: Bearer` и в Socket.IO `auth`, никогда не помещает в URL. Это устраняет зависимость мобильного Telegram WebView от third-party cookies. Exact Origin обязателен для всех мутаций; CSRF header дополнительно обязателен для cookie-аутентификации.

## Локальная разработка

`MOCK_TELEGRAM_AUTH=true` разрешает пустой `initData` только вне production. Конфигурация с mock в production отклоняется при старте. Настоящие `initData`, bot token, session/cookie и CSRF не журналируются.

## Последствия

- повторное использование одной строки `initData` без уже действующей сессии отклоняется; нужно полностью переоткрыть Mini App;
- bearer-вариант повышает последствия XSS, поэтому токен ограничен вкладкой (`sessionStorage`), имеет TTL/revocation, защищён CSP и никогда не журналируется;
- web и API работают только по HTTPS/WSS; единый site с HttpOnly cookie остаётся целевой топологией;
- горизонтальное масштабирование потребует общего rate-limit/replay/session adapter; PostgreSQL остаётся источником истины, Redis не нужен в MVP.
