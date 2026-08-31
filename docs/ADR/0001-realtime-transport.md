# ADR-0001: Socket.IO и один авторитетный realtime-процесс в MVP

- Статус: принято
- Дата: 2026-08-29

## Контекст

Комнаты требуют двунаправленных low-latency команд, presence, acknowledgements, повторного подключения, room broadcast и восстановления полного snapshot. Мобильные Telegram WebView могут менять сеть, сворачиваться и разрывать соединения. Redis запрещён в MVP, но архитектура не должна блокировать горизонтальный рост.

## Решение

Использовать Socket.IO 4.8.3 поверх HTTP server Fastify. Клиент предпочитает WebSocket, сохраняя штатный HTTP long-polling fallback. Один API-процесс является realtime coordinator; PostgreSQL хранит долговечный playback snapshot, in-memory структуры — presence и краткую дедупликацию.

Команды server-authoritative: роль и capability проверяются на сервере, accepted event получает монотонную версию и server timestamp. После любого reconnect клиент получает полный snapshot.

Код вводит интерфейсы `RealtimeBus`, `PresenceStore`, `CommandDeduplicator`, `RoomSequenceCoordinator`. Второй production instance запрещён до реализации распределённых вариантов. Socket.IO официально использует WebSocket и может fallback на polling/reconnect: [Socket.IO overview](https://socket.io/).

## Почему не raw WebSocket

Raw WebSocket уменьшает protocol overhead, но заставляет самостоятельно реализовать reconnect policy, ack/timeouts, rooms, event envelopes и fallback. Для MVP эта сложность и риск выше небольшой экономии.

## Почему не SSE

SSE односторонний; команды потребуют отдельного HTTP-пути, а presence/ack/reconnect protocol всё равно придётся проектировать. Он не даёт преимущества для интенсивной двусторонней комнаты.

## Почему не managed realtime/Redis сейчас

Managed pub/sub снижает часть operational burden, но добавляет vendor cost и новый trust/dependency surface до проверки продукта. Redis adapter не нужен одному процессу. Масштабирование является явным gate, а не скрытой неполной функцией.

## Последствия

Положительные:

- быстрый MVP с reconnect/ack/rooms;
- единый typed event protocol;
- проверяемое восстановление из PostgreSQL;
- понятный путь к Socket.IO Redis adapter.

Отрицательные:

- один процесс ограничивает capacity и создаёт короткий realtime outage при deploy;
- presence кратковременно обнуляется после restart;
- polling при будущем multi-instance потребует sticky sessions;
- Socket.IO — отдельный protocol, не совместимый с raw WebSocket clients.

## Gate горизонтального масштабирования

До второго instance обязательны Redis-compatible bus/adapter, distributed presence/dedupe/sequence, reconnect/load tests и решение sticky sessions либо обоснованный WebSocket-only transport. Render распределяет новые connections по инстансам без гарантии возврата на прежний; reconnect всегда должен быть stateless относительно процесса. [Render WebSockets](https://render.com/docs/websocket).
