# ADR-0004: Render Web Services и один always-on API для MVP

- Статус: принято для референсного production MVP
- Дата: 2026-08-29

## Контекст

Realtime backend должен держать долгие WebSocket connections. Function runtime с конечной максимальной длительностью не подходит как единственный coordinator. Нужен недорогой, понятный monorepo deploy с PostgreSQL и возможностью позже сменить провайдера.

## Решение

Развернуть `apps/web` и `apps/api` как отдельные Render Web Services, PostgreSQL — managed instance в том же регионе. API: ровно один paid always-on instance в MVP. Web может использовать минимальный paid/free tier по эксплуатационным требованиям; backend free tier допускается только для прототипа.

Render официально принимает inbound WebSockets и не задаёт фиксированный maximum duration; connection живёт до shutdown instance. Deploy/maintenance/replacement всё равно разрывают его, поэтому graceful close и client reconnect обязательны. Free services засыпают при неактивности и имеют cold start. Источники: [Render WebSockets](https://render.com/docs/websocket), [Render FAQ](https://render.com/docs/faq), [Web Services](https://render.com/docs/web-services).

API и web получают стабильные custom hostnames до Twitch beta. `parent` задаётся статической allowlist. Preview hostname без allowlist не показывает Twitch embed.

## Альтернативы

### Vercel Functions для API

Отклонено как coordinator MVP: актуальные Vercel Functions поддерживают WebSocket, но established connection привязан к maximum function duration, а следующие connections не гарантированно попадают в тот же function. Это требует внешнего durable coordination уже в MVP. [Vercel WebSockets](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

Vercel остаётся допустимым хостингом только для `apps/web`, если API живёт отдельно.

### Fly.io

Допустимо технически, но отклонено как reference из-за большего operational setup. При выборе Fly API должен иметь `auto_stop_machines = "off"` или минимум один running Machine: long-lived coordinator нельзя неожиданно останавливать. [Fly long-running tasks](https://fly.io/docs/blueprints/long-running-tasks/).

### Kubernetes

Отклонён как преждевременный по стоимости и сложности.

## Последствия

- оплачивается минимум один постоянный API instance;
- deploy вызывает reconnect, но состояние восстанавливается из PostgreSQL;
- файловая система считается ephemeral;
- horizontal scale запрещён до ADR-0001 gate;
- Render не зашивается в domain model: только deployment manifests/env, поэтому миграция возможна.
