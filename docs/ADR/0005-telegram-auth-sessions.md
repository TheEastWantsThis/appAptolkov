# ADR 0005: Telegram initData и серверные сессии

- Статус: принято
- Дата: 2026-08-29

## Решение

API принимает только исходную строку `Telegram.WebApp.initData`. Сервер строго разбирает query string без повторяющихся ключей, проверяет HMAC-SHA-256 по официальной схеме Telegram, `auth_date` (не старше 5 минут и не более чем на 30 секунд в будущем) и обязательный объект `user`. `initDataUnsafe` не участвует в авторизации.

После проверки API атомарно обновляет кеш User, записывает SHA-256 digest использованного `initData` для защиты от replay и создаёт непрозрачную случайную сессию на 12 часов. В PostgreSQL хранится только SHA-256 токена; сам токен передаётся в `HttpOnly`, `Secure` в production, `SameSite=Lax` cookie. Отдельный CSRF token возвращается в auth response и хранится только в `sessionStorage` текущего Mini App. Мутации требуют точный Origin и CSRF header. Socket.IO использует ту же сессию.

## Локальная разработка

`MOCK_TELEGRAM_AUTH=true` разрешает пустой `initData` только вне production. Конфигурация с mock в production отклоняется при старте. Настоящие `initData`, bot token, session/cookie и CSRF не журналируются.

## Последствия

- повторное использование одной строки `initData` без уже действующей cookie отклоняется; нужно переоткрыть Mini App;
- web и API в production должны находиться на HTTPS и совместимых site/domain для cookie;
- горизонтальное масштабирование потребует общего rate-limit/replay/session adapter; PostgreSQL остаётся источником истины, Redis не нужен в MVP.
