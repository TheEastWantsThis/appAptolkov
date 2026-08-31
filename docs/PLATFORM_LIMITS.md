# Подтверждённые ограничения платформ

Проверено 31 августа 2026 года. Технические выводы ниже основаны только на официальных документациях Telegram, Google/YouTube, Twitch и спецификациях W3C. Любое поведение, не гарантированное этими источниками, помечено как предположение или пункт прототипа.

## Telegram Mini Apps и Bot API

### Аутентификация и доверие

`Telegram.WebApp.initDataUnsafe` нельзя считать доверенным. Mini App передаёт на backend исходную строку `Telegram.WebApp.initData`; сервер проверяет её и только затем использует вложенные данные. Официальный алгоритм:

1. разобрать query string;
2. исключить поле `hash`;
3. отсортировать остальные пары по имени и соединить `\n` в виде `key=<value>`;
4. вычислить `secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)`;
5. вычислить `HMAC_SHA256(key=secret_key, message=data_check_string)` и constant-time сравнить hex с `hash`;
6. отдельно ограничить возраст `auth_date`, потому что подпись не защищает от replay свежих, но украденных данных.

Источник: [Validating data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). Telegram также описывает Ed25519-проверку поля `signature` для третьих сторон без bot token; для собственного backend WatchRoom проще и уместнее HMAC-вариант с bot token.

Официальная документация не задаёт обязательный TTL `auth_date`. Значение 5 минут в WatchRoom — локальная security policy, а не гарантия Telegram. `initData` обменивается на собственную короткоживущую серверную сессию и не хранится/логируется.

### Когда доступны `chat_type` и `chat_instance`

В `WebAppInitData`:

- `chat_type` и `chat_instance` возвращаются **только для Mini Apps, запущенных из direct links**;
- поле `chat` возвращается для group/supergroup/channel при запуске из attachment menu и для chat join request;
- `receiver` возвращается только для private chat из attachment menu;
- `WebAppInitData` пуст для запуска из keyboard button и inline mode.

Источник: таблица [WebAppInitData](https://core.telegram.org/bots/webapps#webappinitdata).

Следствия для WatchRoom:

- `chat_type/chat_instance` — контекст запуска, не доказательство членства, владения или прав администратора;
- они могут отсутствовать, если ссылка открыта вне текущего чата или приложение запущено другим способом;
- внутренний канал и доступ к комнате нельзя привязывать исключительно к этим полям.

Direct Link Mini Apps при этом **не имеют доступа к сообщениям текущего чата и не могут сами отправить сообщение**; для отправки пользователь должен перейти в inline mode и выбрать результат. Источник: [Direct Link Mini Apps](https://core.telegram.org/bots/webapps#direct-link-mini-apps).

### `startapp` и `mode=compact`

Для именованного Mini App официальный формат:

```text
https://t.me/<bot_username>/<short_name>?startapp=<start_parameter>&mode=<mode>
```

Telegram передаёт `startapp` как `start_param`; Mini App также получает `tgWebAppStartParam`. `mode=compact` просит compact/half-height открытие, `mode=fullscreen` — fullscreen. Для direct link с Bot API 7.6 default стал full-height, поэтому compact — предпочтение запуска, а не CSS-режим или гарантия конкретных пикселей. Источники: [Deep links: Direct Mini App links](https://core.telegram.org/api/links#direct-mini-app-links), [Direct Link Mini Apps](https://core.telegram.org/bots/webapps#direct-link-mini-apps), [`messages.requestAppWebView`](https://core.telegram.org/method/messages.requestAppWebView).

WatchRoom использует `startapp=room_<publicId>`, где `publicId` состоит только из URL-safe символов. Официальная страница direct links не фиксирует отдельный максимальный размер `startapp`, поэтому payload делается коротким и не содержит авторизационных данных или пароля.

### Отправка и открытие ссылок

| Возможность                    | Подтверждённое поведение                                                                                                | Ограничение/решение                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Telegram.WebApp.shareMessage` | Bot API 8.0+, открывает native dialog для сообщения, которое backend заранее сохранил через `savePreparedInlineMessage` | Требуется prepared message ID для конкретного user, есть expiry, пользователь выбирает/отменяет отправку. [WebApp API](https://core.telegram.org/bots/webapps#initializing-mini-apps), [Bot API method](https://core.telegram.org/bots/api#savepreparedinlinemessage)                                                                    |
| `switchInlineQuery`            | Bot API 6.7+, вставляет username бота и query; с `choose_chat_types` показывает выбор чата                              | Это переход в заранее включённый inline mode, а не скрытая отправка. Пользователь сам выбирает результат; backend отвечает через `answerInlineQuery`. Direct/inline Mini App не читает чат. [WebApp API](https://core.telegram.org/bots/webapps#initializing-mini-apps), [Bot API](https://core.telegram.org/bots/api#answerinlinequery) |
| `openTelegramLink`             | Открывает `t.me`-ссылку внутри Telegram; с Bot API 7.0 Mini App не закрывается                                          | Использовать только для валидированной Telegram-ссылки. [WebApp API](https://core.telegram.org/bots/webapps#initializing-mini-apps)                                                                                                                                                                                                      |
| `openLink`                     | Открывает внешний URL, не закрывая Mini App                                                                             | Только по явному действию пользователя; на нижнем уровне interaction TTL равен 1 секунде. [Web events](https://core.telegram.org/api/web-events#web-app-open-link)                                                                                                                                                                       |
| Telegram clipboard read        | `readTextFromClipboard` ограничен attachment-menu/whitelisted bots и требует свежего пользовательского действия         | WatchRoom не читает clipboard. [Web events](https://core.telegram.org/api/web-events#web-app-read-text-from-clipboard)                                                                                                                                                                                                                   |

Telegram не документирует JS-метод записи текста в clipboard. Для копирования WatchRoom использует стандартный `navigator.clipboard.writeText`, а не вымышленный Telegram bridge.

### `requestChat` / `savePreparedKeyboardButton`

Официальный Bot API 9.6+ поток:

1. backend вызывает `savePreparedKeyboardButton(user_id, button)`;
2. `button` обязан быть `request_users`, `request_chat` или `request_managed_bot`;
3. backend отдаёт Mini App ID `PreparedKeyboardButton`;
4. только после нажатия пользователя Mini App вызывает `Telegram.WebApp.requestChat(req_id)`;
5. Telegram показывает диалог, где пользователь выбирает существующий чат или создаёт новый;
6. после выбора Telegram отправляет боту service message `chat_shared`; JS callback сообщает лишь факт отправки этого сообщения, но не является подтверждением прав или завершённой привязки.

Источники: [`requestChat`](https://core.telegram.org/bots/webapps#initializing-mini-apps), [`savePreparedKeyboardButton`](https://core.telegram.org/bots/api#savepreparedkeyboardbutton), [Requesting peers via Mini Apps](https://core.telegram.org/api/bots/buttons#requesting-peers-via-mini-apps).

Это подтверждает обязательное участие пользователя. Обычный Bot API не предоставляет WatchRoom автономный `createChannel/createChat`; следовательно, «скрыто создать Telegram-канал» нельзя. Это вывод из документированного request flow и списка Bot API methods, а не отдельная цитата-запрет. Допустимы: попросить выбрать/создать чат через `requestChat`, либо открыть Telegram link, после чего пользователь сам завершает действие.

`ChatShared` содержит `request_id`, `chat_id` и опциональные title/username/photo. Документация отдельно предупреждает, что бот не обязательно имеет доступ к выбранному чату, поэтому WatchRoom не доверяет этим полям как доказательству прав: webhook связывается с одноразовым pending request, затем backend вызывает `getChat`, `getChatAdministrators`, `getMe` и `getChatMember`. Проверка другого пользователя через `getChatMember` гарантируется только когда бот — администратор; чтобы не требовать лишних прав, WatchRoom ищет владельца в результате `getChatAdministrators`, а членство самого бота проверяет отдельно. Источники: [`ChatShared`](https://core.telegram.org/bots/api#chatshared), [`getChatAdministrators`](https://core.telegram.org/bots/api#getchatadministrators), [`getChatMember`](https://core.telegram.org/bots/api#getchatmember).

Реализованный безопасный MVP-фильтр выбирает только **публичную группу/супергруппу с username**, где пользователь является owner/administrator, а бот уже участник. Ссылка строится сервером как `https://t.me/<verified_username>`. Приватный `chat_id` сам по себе не является публичной ссылкой; создание invite link потребовало бы дополнительных администраторских прав бота, поэтому приватные группы пока не привязываются. Если `requestChat` отсутствует в клиенте, UI даёт инструкцию создать публичную группу, добавить бота и повторить выбор в обновлённом Telegram.

## YouTube IFrame Player API

### Что можно

- Официальный IFrame API управляет `playVideo`, `pauseVideo`, `seekTo`, загрузкой/сменой video ID и отдаёт player state events. [IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference)
- `enablejsapi=1` включает JS-управление; `origin` должен соответствовать origin приложения. [Player parameters](https://developers.google.com/youtube/player_parameters)
- Для live `getDuration()` возвращает время с начала непрерывного стрима, а не гарантированный общий wall-clock/live-edge timestamp. [IFrame API: getDuration](https://developers.google.com/youtube/iframe_api_reference#Playback_status)
- YouTube Live может иметь DVR: официальный `enableDvr` позволяет паузу, rewind и fast forward. Это свойство broadcast, которое WatchRoom не контролирует для чужого видео. [LiveBroadcast contentDetails](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts#contentDetails.enableDvr)

### Размер, видимость и UI

Viewport embed должен быть не меньше 200×200 px; если отображаются controls, они должны полностью помещаться. Для 16:9 рекомендовано не меньше 480×270. Нельзя закрывать player/controls overlays или изменять плеер неописанными способами. [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-youtube-player-size).

Поэтому внутренний corner player остаётся минимум 200×200 и не накрывается reaction controls; controls WatchRoom располагаются рядом. На узких экранах применяется sticky, а не слишком маленький corner.

### Autoplay и мобильные клиенты

Браузер может блокировать `autoplay`, `loadVideoById` и даже `playVideo`, особенно для unmuted playback без user gesture или без Permissions Policy. API предоставляет `onAutoplayBlocked`. Кроме того, автоматически запускаемый YouTube player должен быть видим более чем наполовину, и одновременно автоматически проигрываться может не больше одного YouTube player. Источники: [`onAutoplayBlocked`](https://developers.google.com/youtube/iframe_api_reference#onAutoplayBlocked), [Autoplay requirements](https://developers.google.com/youtube/terms/required-minimum-functionality#autoplay-and-scripted-playbacks).

Следствие: удалённая команда PLAY не гарантирует, что новый мобильный viewer услышит/увидит воспроизведение без собственного tap. WatchRoom показывает «Начать просмотр» и после gesture применяет свежий snapshot.

### Доступность и правила контента

Владелец видео может запретить embed; `video.status.embeddable` это отражает. Возрастные видео часто нельзя смотреть на сторонних сайтах; региональные ограничения зависят от владельца/закона. Источники: [Video resource](https://developers.google.com/youtube/v3/docs/videos#status.embeddable), [Embed videos](https://support.google.com/youtube/answer/171780), [Regional availability](https://support.google.com/youtube/answer/92571).

API client не должен скачивать, импортировать, backup/cache/store копии аудиовизуального YouTube content или делать offline playback без письменного разрешения. [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies#e.-handling-youtube-data-and-content). Поэтому архитектура использует только официальный embed и metadata API.

### Ограничение YouTube Live для синхронизации

IFrame API документирует общий `seekTo`, а Live API документирует опциональный DVR, но не гарантирует WatchRoom способ надёжно узнать и синхронизировать одинаковый live edge для каждого стороннего viewer. Поэтому seek/go-live на YouTube Live — capability, подтверждаемая прототипом и конкретным broadcast; MVP не обещает точность, эквивалентную VOD.

## Twitch Embedded Player

### `parent`, HTTPS и embed

Twitch embed требует HTTPS и параметр `parent`; без него пользователю показывается playback error/click-through. Для каждого embedding domain нужен свой parent. Player нельзя заслонять другими page elements. [Embedding Twitch requirements](https://dev.twitch.tv/docs/embed/).

Для WatchRoom список `parent` строится из статической allowlist production hostname. Пользовательский `Host` header не отражается в iframe URL. Неизвестные preview domains не получают Twitch player до явного добавления.

### Размеры

Окно Twitch video embed должно быть минимум 400×300 px (`width >= 400`, `height >= 300`). [Video & Clips](https://dev.twitch.tv/docs/embed/video-and-clips/). Поэтому corner layout на телефонах не используется; выбирается sticky/full layout. CSS transform, визуально уменьшающий embed ниже минимума, также не соответствует назначению требования.

### Live и VOD

Interactive Player API поддерживает `play`, `pause`, `setChannel`, `setVideo` и `seek(timestamp)`. Но:

- `seek` **не работает для live streams**;
- `getCurrentTime` и `getDuration` работают только для VOD;
- `time` query parameter валиден только для VOD;
- playback stats содержит `hlsLatencyBroadcaster` для live, но это локальная текущая задержка конкретного player, а не общий seekable timestamp.

Источник: [Twitch Synchronous JavaScript Playback and Status APIs](https://dev.twitch.tv/docs/embed/video-and-clips/#interactive-frames-for-live-streams-and-vods).

Следствие: Twitch VOD поддерживает полную MVP-синхронизацию. Twitch Live поддерживает общие play/pause/source и приблизительный «вернуться к live» через перезагрузку channel; точный seek и точное равенство позиций невозможны средствами официального API.

### Autoplay

Twitch явно говорит, что на mobile video нельзя проиграть без user interaction. На остальных клиентах autoplay зависит от минимального размера/видимости и может породить `PLAYBACK_BLOCKED`, обычно после unmuted autoplay/programmatic `play()`. [Video & Clips parameters/events](https://dev.twitch.tv/docs/embed/video-and-clips/).

### Контент

Для видео должен использоваться Twitch embeddable player; распространение вне него требует отдельного разрешения. Хранить копии Twitch Content без разрешения нельзя, кроме отдельно оговорённых случаев/ограниченного cache. [Twitch Developer Services Agreement](https://legal.twitch.com/legal/developer-agreement). WatchRoom не скачивает и не ретранслирует Twitch content.

## Web Share, Clipboard и Picture-in-Picture

### `navigator.share`

Web Share API доступен только в secure context, управляется Permissions Policy `web-share` и требует transient user activation, которую вызов потребляет. Пользователь всегда видит chooser и может отменить. В third-party iframe default allowlist — `self`, а interoperability enabling через `allow="web-share"` не абсолютна. [W3C Web Share API](https://www.w3.org/TR/web-share/).

Telegram WebView может не предоставить API даже при наличии браузерной поддержки. Поэтому `typeof navigator.share === "function"`, `navigator.canShare` и catch обязательны; это fallback после Telegram-native share, а не основная гарантия.

### Clipboard

Async Clipboard — powerful API, зависит от разрешений/фокуса/реализации user agent. `navigator.clipboard.writeText` вызывается по click в HTTPS и оборачивается в catch; fallback — выделяемое поле/ручное копирование. [W3C Clipboard API](https://www.w3.org/TR/clipboard-apis/#dom-clipboard-writetext).

### Внутренний мини-плеер и системный PiP

Внутренний mini-player — тот же iframe в CSS-контейнере страницы. Он остаётся частью Mini App, подчиняется viewport/minimum size и исчезает при закрытии/сворачивании webview.

Системный Picture-in-Picture — отдельное always-on-top окно браузера/ОС. Стандартный программный API определён для доступного текущему document `HTMLVideoElement`, требует user gesture и может быть запрещён browser/Permissions Policy. YouTube/Twitch media element находится внутри cross-origin iframe и не доступен DOM WatchRoom; провайдер или user agent может показать собственный PiP control, но WatchRoom не может полагаться на него или программно вызвать его единообразно. [W3C Picture-in-Picture](https://www.w3.org/TR/picture-in-picture/).

Итог: системный PiP — только feature-detected progressive enhancement. MVP полностью работает через full/sticky/internal corner layouts без него.

## Матрица возможностей

| Возможность                |                   YouTube VOD |                                 YouTube Live |               Twitch VOD |                        Twitch Live |
| -------------------------- | ----------------------------: | -------------------------------------------: | -----------------------: | ---------------------------------: |
| Официальный embed          | Да, если embeddable/available |               Да, если embed/region доступны |                       Да |           Да, когда channel online |
| play/pause API             |                            Да |           Да, с platform/autoplay оговорками |                       Да | Да, с platform/autoplay оговорками |
| seek API                   |                            Да | Только если реальный DVR допускает; прототип |                       Да |                                Нет |
| текущий VOD timestamp      |                            Да |                    Не эквивалентен live edge |                       Да |                                Нет |
| точная синхронизация       |      Best effort с коррекцией |                   Нет, только приблизительно | Best effort с коррекцией |         Нет, только приблизительно |
| смена источника            |                            Да |                                           Да |                       Да |                                 Да |
| autoplay на mobile без tap |   Ненадёжно/часто блокируется |                  Ненадёжно/часто блокируется |                      Нет |                                Нет |

## Подтверждённо невозможное или ненадёжное

- Скрыто создать Telegram-канал обычным ботом и незаметно добавить туда пользователя — невозможно в документированном Bot API flow.
- Прочитать Telegram-чат из Direct Link Mini App — невозможно. Собственный чат WatchRoom технически возможен, но это отдельное хранение пользовательских данных и отдельная ответственность сервиса.
- Отправить приглашение без пользовательского dialog/choice через `shareMessage` или inline mode — невозможно.
- Выполнить seek Twitch Live или получить его current timestamp — невозможно.
- Гарантировать autoplay/audio после удалённой команды на mobile — ненадёжно.
- Гарантировать одинаковую live latency и покадровую синхронизацию — ненадёжно.
- Уменьшить Twitch embed ниже 400×300 или заслонить controls — недопустимо.
- Программно управлять системным PiP cross-origin embed единообразно — ненадёжно.
- Обойти embedding, age, DRM или region restrictions — вне разрешённого и вне продукта.
