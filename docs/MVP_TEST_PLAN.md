# WatchRoom — план закрытого MVP-теста

## Цель и участники

Цель — проверить понятность создания комнаты, реальную устойчивость синхронизации в Telegram WebView, ограничения официальных плееров и достаточность короткого чата. Набор: **10–20 приглашённых пользователей**, минимум по два человека на Telegram Android, iOS и Desktop; один ведущий и один наблюдатель QA.

Тест длится 5–7 дней. Это закрытая проверка без публичной рекламы. Пользователи получают краткое privacy notice: Telegram display data сохраняются для аккаунта, чат — максимум 40 сообщений/24 часа, медиапоток идёт напрямую YouTube/Twitch.

## Три комнаты

| Комната         | Источник и доступ                             | Политика   | Что проверяем                                                                               |
| --------------- | --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| A «Киносеанс»   | Public YouTube VOD                            | EVERYONE   | join/share, play/pause/seek, drift после background/reconnect, 40-message chat              |
| B «Прямой эфир» | Public YouTube Live                           | OWNER_ONLY | autoplay tap, live latency warning, запрет viewer control, best-effort sync                 |
| C «Стрим»       | Private Twitch channel live, затем Twitch VOD | MODERATORS | пароль/grant, Twitch `parent`, no seek live, moderator playback, seek после перехода на VOD |

В каждой комнате 4–8 участников. Один пользователь входит с двух устройств, чтобы проверить presence dedupe. Отдельно проверяются owner disconnect: роль не передаётся автоматически; в B управление ждёт owner, в C назначенный moderator продолжает допустимые команды.

## Сценарии

1. Владелец создаёт внутренний канал и комнату, копирует обычную и compact ссылку.
2. Второй пользователь входит по `startapp=room_<publicId>`; PRIVATE пароль не появляется в URL.
3. Проверяются Telegram share, system share и clipboard fallback.
4. Viewer пытается сменить источник/завершить комнату — сервер отклоняет.
5. Play/pause/seek выполняются с двух разрешённых клиентов; наблюдатель записывает drift, buffering и feedback loop.
6. Отправляется 41 сообщение; старейшее исчезает. Проверяются self-delete, moderator delete, mute и owner block.
7. Открывается Telegram discussion; после возврата комната и socket восстанавливаются.
8. Владелец завершает комнату; все клиенты получают ended state.

## Плохой интернет и восстановление

На Android/iOS применить системное ограничение сети или proxy profile:

- 3G-like: 1.5 Mbps down, 750 Kbps up, RTT 200 ms;
- краткий offline 15 секунд;
- packet loss 3–5% в течение двух минут;
- переключение Wi‑Fi → mobile data.

Критерии: UI показывает reconnect, не теряет room route/grant, после восстановления получает server snapshot; presence нормализуется после grace; устаревшая команда не перезаписывает новую version. Видео может буферизоваться независимо — это фиксируется отдельно от WatchRoom realtime.

## Матрица клиентов и плееров

- Telegram Android: YouTube VOD/Live, Twitch live/VOD, compact/fullscreen, keyboard/safe area.
- Telegram iOS: те же источники, autoplay user gesture, возврат из Telegram discussion.
- Telegram Desktop: keyboard navigation, window resize, share/requestChat availability.
- Обычный Chromium/Safari: Web Share/clipboard fallback и CSP console.

Для каждого источника записать: модель/OS/Telegram version, room ID, время, provider error code, embedding allowed/blocked, autoplay outcome и приблизительный drift. Не копировать initData, cookies, пароль или chat text в отчёт.

## Метрики и обратная связь

Собираются только агрегаты: active rooms/socket, reconnect, player error, autoplay blocked и 5xx. После сессии пользователь отвечает на пять вопросов по шкале 1–5:

1. Было ли понятно, как войти и запустить просмотр?
2. Насколько синхронным казался VOD?
3. Было ли понятно, кто управляет?
4. Достаточен ли короткий чат/реакции?
5. Возникло ли желание использовать WatchRoom повторно?

Свободный комментарий отдельно; не просить присылать персональные данные или скриншоты секретов. Abuse/privacy обращения идут назначенному владельцу процесса.

## Критерии GO после теста

- нет critical/high security или privacy incident;
- ≥90% успешных Telegram launch и room join;
- reconnect восстанавливает snapshot без ручной перезагрузки в ≥95% проверок;
- viewer ни разу не выполняет запрещённую server-side команду;
- Twitch `parent` и четыре вида источника подтверждены хотя бы на Android, iOS и Desktop;
- нет потери/выхода за предел 40/24 часа;
- median оценки понятности входа и управления ≥4/5.

Любой auth bypass, утечка PRIVATE metadata/секрета, потеря авторитетного playback state или неработающий rollback означает NO-GO и остановку приглашений.
