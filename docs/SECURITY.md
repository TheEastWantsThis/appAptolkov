# WatchRoom: модель угроз и меры защиты

Статус: hardening закрытого MVP, обновлён 31 августа 2026 года. Владелец риска — команда WatchRoom; платформы видео и Telegram остаются отдельными trust domains.

Реализовано в room slice: Argon2id 64 MiB/3/1, 128-byte входной предел, digest-only room grants на 4 часа, password revision, единая unlock-ошибка, нарастающая задержка и пятиминутный lock после пяти ошибок. Rate/lock state пока in-memory одного API instance. `RoomMessage` и `RoomChatRestriction` отделены от system events; приложение удерживает 40 сообщений и TTL 24 часа.

## Реализованные меры identity/channel slice

- строгий разбор raw initData с запретом duplicate keys, constant-time HMAC compare и окном `auth_date` 5 минут;
- одноразовый SHA-256 replay digest, unique `telegramId` и обновляемый кеш Telegram-профиля;
- 256-bit opaque session и CSRF tokens; в БД только SHA-256 digests, TTL сессии 12 часов;
- `HttpOnly`, `SameSite=Lax`, production `Secure` session cookie, exact Origin + CSRF для мутаций;
- один session lookup для HTTP и Socket.IO, блокировка User status учитывается при lookup;
- локальный auth rate limit 10 попыток/минуту на IP; перед горизонтальным масштабированием его нужно заменить общим адаптером;
- owner-only update/delete и уникальный нормализованный slug; приватный канал не раскрывается постороннему;
- redaction cookie, authorization, initData, tokens и bot token в structured logs.

Остаточный риск: CSRF token доступен JavaScript в `sessionStorage` по назначению, поэтому XSS остаётся значимой угрозой. CSP/secure headers включены, plain-text вывод не использует HTML, но production CSP ещё требует проверки на реальных Telegram-клиентах.

## Активы

- Telegram bot token и Telegram user identity mapping;
- серверные сессии и room access grants;
- Twitch client secret/app token и YouTube API key;
- пароли закрытых комнат;
- роли, control policy и авторитетное playback state;
- participant presence, сообщения внутреннего чата и привязка Telegram-чата;
- PostgreSQL и audit trail;
- доверие пользователей к invite/share links.

Медиапоток не является активом сервера: он не проходит через WatchRoom.

## Границы доверия

1. Telegram client → web: `initDataUnsafe`, URL, platform/version и JS bridge считаются недоверенными до server validation/feature detection.
2. Web → API/Socket.IO: любой payload и player event враждебен; UI role checks не являются авторизацией.
3. API → Telegram/YouTube/Twitch: ответы внешних API валидируются, timeouts/circuit breakers обязательны.
4. API → PostgreSQL: только параметризованный Prisma access; migrations и production credentials отделены.
5. Provider iframe: cross-origin код, которому выделяется минимально необходимая Permissions Policy/CSP поверхность.
6. Deploy/log/analytics: секреты и персональные данные должны быть redacted; сторонняя аналитика не получает `initData`, session или password.

## Главные угрозы

| Угроза                             | Пример                                                    | Контроль MVP                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Подделка Telegram identity         | клиент меняет `user.id` в `initDataUnsafe`                | принимать только raw `initData`, HMAC validation, constant-time compare, TTL `auth_date`, затем server session                            |
| Replay initData                    | украденная валидная строка используется позже             | 5-минутное окно, rate limit, session rotation, не логировать raw data; при необходимости one-time digest cache                            |
| Session theft/fixation             | token в URL/LocalStorage утекает                          | случайная opaque session, только hashed at rest, Secure HttpOnly cookie, rotation после auth, no query tokens, revoke/expiry              |
| CSRF/cross-origin socket           | чужой сайт вызывает API с cookie                          | exact Origin allowlist, SameSite cookie, CSRF token для mutating HTTP, Socket.IO origin check, CORS deny default                          |
| Broken access control              | участник шлёт owner command                               | роль/policy проверяется сервером на каждой команде и транзакции; client flags не доверяются                                               |
| IDOR preview/room                  | перебор `publicId` раскрывает закрытые комнаты            | 128+ бит random publicId, auth required, rate limit, минимальный preview, uniform 404/denied                                              |
| Password disclosure                | plaintext в DB/log/share                                  | Argon2id hash+unique salt, request/body redaction, никогда не включать в link/event/analytics, input cleared                              |
| Password brute force               | массовые unlock attempts                                  | rate limit account+room+IP, exponential delay, generic response, audit/alert, optional temporary room lock                                |
| Stale access after password change | старый grant продолжает работать                          | `passwordRevision` во всех grants и socket authorization; revision bump invalidates and disconnects                                       |
| Realtime spoof/replay/race         | старый seek перетирает новый source                       | Zod, message size limit, `commandId`, source/state versions, monotonic server sequence, transaction, dedupe                               |
| Feedback storm                     | provider event повторяет remote command                   | suppression markers, debounce, per-user/room rate limits, authoritative periodic snapshot                                                 |
| Presence inflation                 | много вкладок/сокетов                                     | dedupe по Telegram user ID, socket/user caps, heartbeat, disconnect grace                                                                 |
| SSRF                               | source URL ведёт во внутреннюю сеть                       | URL только парсится; network calls идут к hardcoded official API hosts по extracted ID; redirects/host input не используются              |
| Stored/reflected XSS               | chat/room/provider metadata содержит HTML                 | short plain text, length/schema validation, React escaping, no `dangerouslySetInnerHTML`, без HTML/Markdown/link preview, restrictive CSP |
| Chat spam/abuse                    | flood, оскорбления, незаконный или чувствительный контент | отдельный rate limit, 500 символов, self/owner/mod delete и temporary mute, abuse contact/report path, 40-message/24-hour retention       |
| Chat privacy leakage               | пользователь публикует телефон или иной секрет            | предупреждение в UI, минимальная аудитория комнаты, нет поиска/экспорта/аналитики текста, быстрое удаление и documented deletion request  |
| Malicious invite/open redirect     | подменённый bot/app/host                                  | canonical link собирается из server config; `publicId` encoded; `openTelegramLink` только exact `https://t.me/<bot>/<app>`                |
| Подмена Telegram discussion        | клиент присылает чужой `chat_id` или вредоносную ссылку   | webhook secret, pending `request_id`+Telegram user binding, Bot API re-check admin/member, URL только из проверенного публичного username |
| Secret leakage to client           | YouTube/Twitch credentials в Next public env              | secrets только apps/api secret store; `NEXT_PUBLIC_*` review; bundle scan in CI                                                           |
| Provider policy violation          | overlay, too-small embed, re-stream                       | no proxy/download; size constraints in layout tests; provider controls not obscured; canonical embed only                                 |
| DoS/resource exhaustion            | socket flood, huge events, metadata spam                  | connection/IP/account rate limits, body/message limits, max sockets/user/room, timeouts, bounded maps, backpressure                       |
| Dependency/supply chain            | malicious/transitive update                               | exact versions, pnpm lock, integrity, minimal packages, CI audit/SBOM, reviewed automated updates                                         |
| Sensitive participant exposure     | preview leaks who watches                                 | authenticated preview, at most three display names, user-level opt-out before public launch, count minimization, retention limits         |

## Telegram initData validation requirements

- Использовать raw bytes/string query value semantics Telegram; не пересериализовывать JSON перед signature check.
- Отклонять duplicate critical keys (`hash`, `auth_date`, `user`) и malformed percent encoding.
- Исключить только `hash` для bot-token HMAC flow; следовать актуальной official algorithm при появлении новых полей.
- Constant-time сравнивать 32-byte computed/received hash после строгого hex decode.
- Проверять целое `auth_date`, допустимый clock skew и max age.
- Проверять `user.id` как положительный 64-bit-safe decimal; хранить в PostgreSQL `bigint`, в JSON/shared type передавать строкой, чтобы избежать потери точности.
- Не считать `username`, `photo_url`, `chat_type`, `chat_instance` правами доступа.
- Не передавать bot token клиенту и не использовать third-party verifier с token.

Официальный алгоритм: [Telegram validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

## Пароли закрытых комнат

### Хранение

- Argon2id с уникальной криптографической солью; параметры выбираются нагрузочным тестом на production instance и сохраняются в encoded hash для будущего rehash.
- Стартовая цель: 64 MiB memory, 3 iterations, parallelism 1; это проектная отправная точка, а не вечная константа.
- Опциональный server-side pepper из secret manager добавляется только если есть безопасный rotation procedure; DB сама по себе никогда не содержит plaintext или reversible ciphertext.
- Максимальная длина входа ограничена по UTF-8 bytes до KDF; политика допускает password manager/passphrase и не делает опасных composition rules.

### Проверка и lifecycle

- Unlock endpoint не различает неверный пароль, отсутствующую комнату и устаревший grant в деталях для клиента.
- Успех создаёт отдельный room grant с expiry и `passwordRevision`; пароль не используется в socket handshake.
- Смена/удаление пароля увеличивает revision, инвалидирует grants и при необходимости разрывает socket membership.
- Hash никогда не входит в generic ORM serializer, logs, backups вне стандартной защиты или analytics.

## Сессии и cookies

- 256-bit random opaque token; в DB только SHA-256 token digest (токен уже высокоэнтропийный, password KDF не нужен).
- Cookie: `Secure`, `HttpOnly`, `SameSite=Lax`, narrow Domain/Path, bounded Max-Age. Web и API размещаются на одном registrable domain.
- Access session короткая (например 12 часов) с idle timeout; повторный Telegram auth бесшовно обновляет её при свежем initData.
- Logout/revoke немедленно инвалидирует DB record и активные sockets.
- Все HTTP mutating routes требуют CSRF token/origin; socket command auth берётся из server-side session, не из переданного user ID.

## Валидация источников

Разрешены только известные URL-формы и identifiers:

- YouTube: `youtube.com/watch?v=`, `youtu.be/`, допустимые live URL, строгий video ID;
- Twitch: channel login и `twitch.tv/videos/<id>`, строгие provider IDs.

Сервер не делает fetch пользовательского URL, не следует его redirects и не принимает custom embed HTML. Metadata calls используют hardcoded `www.googleapis.com`, `api.twitch.tv` и `id.twitch.tv`, TLS, timeout, response size/schema limits. Canonical URLs генерирует сервер.

Перед публикацией YouTube проверяется `status.embeddable`; runtime provider error всё равно возможен из-за region/age/client context и обрабатывается без fallback к пиратскому источнику.

## Web security headers

Реализованная CSP формируется allowlist'ом в Next.js и уточняется прототипом:

- `default-src 'self'`;
- `script-src 'self' https://telegram.org https://www.youtube.com https://s.ytimg.com https://player.twitch.tv` без `unsafe-eval`;
- `frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.twitch.tv`;
- `connect-src 'self' https://api.example... wss://api.example...` плюс только реально требуемые provider endpoints;
- `img-src 'self' data: https:` с более узкой allowlist после наблюдения;
- `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors` совместимый с Telegram hosting flow;
- строгий `Referrer-Policy: strict-origin-when-cross-origin`, потому что YouTube требует HTTP Referer/equivalent client identity и error 153 возможен без него;
- HSTS после проверки всех subdomains, `X-Content-Type-Options: nosniff`, безопасная Permissions Policy.

Нельзя без проверки ставить `Referrer-Policy: no-referrer`: YouTube официально требует client identity через Referer. [YouTube API Client Identity](https://developers.google.com/youtube/terms/required-minimum-functionality#api-client-identity-and-credentials).

## Realtime controls

- Max event payload 16 KiB, max source URL substantially less, strict enum/numeric ranges.
- Команды содержат source revision; seek отрицательный/NaN/за duration отклоняется или clamp'ится сервером.
- `CHANGE_SOURCE` по умолчанию owner-only даже при `EVERYONE` playback policy; расширение требует отдельной setting.
- Каждая accepted команда пишет actor/version в audit/system event; rejected flood агрегируется без sensitive payload.
- Socket reconnect никогда не продолжает состояние только из client cache — получает полный snapshot и заново проверяет room grant.

## Безопасность внутреннего чата

- Только участники с действующей session и доступом к комнате могут читать/писать; закрытая комната требует актуальный room grant.
- Текст 1–500 символов, plain text; control characters отклоняются, URL не разворачиваются, вложения отсутствуют.
- Реализован лимит 20 отправок/минуту по user+room в одном API-процессе; максимум 40 сообщений на комнату ограничивает и данные, и память. Общий IP/distributed limiter нужен до горизонтального масштабирования.
- Автор может удалить своё сообщение; owner/moderator — любое. Owner/moderator могут выдать временный mute, но moderator не может ограничить owner. Endpoint снятия mute в MVP отсутствует, поэтому moderator не может снять owner restriction.
- Действия пишутся в bounded audit на 30 дней без копирования текста сообщения; записи ограничены 100 последними при чтении и очищаются фоновой задачей.
- Удалённый текст не остаётся в application logs, analytics или audit. Backup retention должен быть ограничен и описан отдельно.
- Mute блокирует только текст: viewing и emoji reactions остаются доступны. Реакции имеют отдельный rate bucket, не сохраняются и исчезают через 10 секунд; owner может полностью отключить их для комнаты.
- Реализованы room-scoped жалоба, owner block и закрытая operations-очередь OPEN/RESOLVED/DISMISSED. До выдачи тестировщикам нужно назначить доступный abuse/privacy контакт и SLA быстрого удаления явно незаконного или опасного контента; автоматической фильтрации в MVP нет.

## Privacy и retention

- Собирать только Telegram ID и display data, нужные UX; не импортировать contacts/chat history.
- Внутренний чат хранит максимум 40 сообщений на комнату и максимум 24 часа; 41-е сообщение атомарно удаляет самое старое, удаление комнаты каскадно удаляет чат.
- До отправки UI сообщает, что сообщение увидят участники комнаты и оно временно хранится WatchRoom; текст не используется для рекламы, профилирования или обучения моделей.
- Active presence живёт в памяти и исчезает после grace. Системные room events не пишутся в БД: они доставляются только активным realtime-подписчикам и удаляются из UI через 10 минут. Moderation audit хранится до 30 дней; reaction events — 10 секунд и только в памяти клиентов.
- Preview display names минимальны; до public beta требуется настройка «не показывать меня в preview» или решение показывать только count.
- Telegram chat binding не доказывает текущую membership; не используется для скрытой корреляции пользователей.
- Документировать удаление аккаунта/канала, cascade/анонимизацию audit и backup retention до запуска.

Лимит 40 сообщений снижает риск, но не отменяет требования закона: текст вместе с Telegram ID/display name может быть персональными данными. До публичного запуска нужны применимые правовое основание, privacy notice, контакты оператора, процесс запросов на удаление и договоры с hosting/DB processors. Для пользователей из ЕС применимы принципы минимизации и ограничения срока хранения из [статьи 5 GDPR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679). При запуске из России или для российского рынка нужно отдельно проверить статус оператора, уведомление Роскомнадзора и локализацию; [Роскомнадзор прямо указывает](https://82.rkn.gov.ru/directions/pers/p15375/), что владелец сайта, собирающий идентифицирующие данные, обычно является оператором. Окончательный перечень обязанностей определяется страной оператора, пользователей и размещения — это требует локальной юридической проверки до production.

## Secrets и операции

- Dev `.env` не коммитится; production secrets — в Render secret env/secret manager.
- Раздельные bot token и provider credentials для test/prod.
- Логи имеют denylist redaction для `authorization`, `cookie`, `initData`, `hash`, `password`, tokens/client_secret и URL query.
- Backup encrypted at rest; restore drill до production.
- Key/token rotation runbook: bot token, session signing/pepper (если появится), Twitch secret, YouTube key.
- При утечке: revoke secrets/sessions, bump affected password revisions, сохранить минимальные forensic audit данные, уведомить по применимому process.

## Результат hardening 31 августа 2026

Исправлены найденные high-проблемы: login CSRF, отсутствие logout/revocation, WebSocket Origin только на уровне CORS, удаление канала с активной комнатой, общий limiter без отдельных source/chat/reaction/room buckets, отсутствие room block/report, слабые security headers и ошибочный `500` на слишком большой payload. Успешная проверка старого Argon2id hash выполняет безопасный rehash без смены password revision и без отзыва действительных grants.

| Риск                                                                                               | Уровень | Состояние                                                                                       | Владелец и срок                                   |
| -------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Несколько API instance имеют раздельные limiter/presence/dedupe                                    | Medium  | Принято только для single-instance closed MVP                                                   | Backend owner: до горизонтального масштабирования |
| CSP содержит `'unsafe-inline'` для совместимости Next/Telegram; `'unsafe-eval'` только development | Medium  | Реальные источники ограничены allowlist; нужен nonce/hash rollout                               | Web owner: до публичной beta                      |
| Реальные autoplay/provider cookie/region и Twitch `parent` зависят от клиента/домена               | Medium  | Автотест не заменяет device QA                                                                  | QA owner: до приглашения внешних тестировщиков    |
| Автоматической передачи owner при disconnect нет                                                   | Low     | Явная политика: persisted owner сохраняется; moderators продолжают только при `MODERATORS`      | Product owner: пересмотреть после closed MVP      |
| Self-service удаления аккаунта нет                                                                 | Medium  | Ручная privacy-процедура обязательна                                                            | Privacy owner: до closed MVP                      |
| Новая migration abuse workflow не прогнана локально из-за повреждённого Docker Desktop socket      | Medium  | Prisma generate/SQL review пройдены; CI поднимает чистый PostgreSQL 17 и выполняет release gate | Operations owner: до merge/release                |
| Backup restore ещё не репетировался на этой машине                                                 | Medium  | Runbook создан                                                                                  | Operations owner: до closed MVP                   |

`publicId`, Telegram ID, message text и source URL не входят в metrics/telemetry. Abuse report хранится до 90 дней; moderation audit — до 30 дней; chat — не более 24 часов/40 сообщений. Полная карта приведена в `PRIVACY_DATA_MAP.md`.

## Security acceptance gates

До MVP release должны пройти:

1. positive/negative official Telegram HMAC test vectors, duplicate/malformed/replay cases;
2. horizontal authorization tests для каждой роли и каждой command;
3. brute-force/rate-limit и password rotation tests;
4. origin/CSRF/socket handshake tests;
5. SSRF corpus и source URL parser fuzz/property tests;
6. CSP в report-only на реальных Telegram clients, затем enforcement;
7. dependency audit, secret scan, production bundle scan;
8. load test sockets, reconnect storm, bounded memory и graceful deploy;
9. privacy/legal review preview, presence, chat, data location и retention;
10. chat authorization/XSS/rate-limit/40-message/24-hour cleanup/moderation tests;
11. provider policy/layout tests на минимальные размеры и отсутствие overlays.
