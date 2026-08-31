# Ручная проверка официальных плееров

Дата подготовки: 30 августа 2026 года. Страница стенда доступна только в development: `/dev/player`.

## Browser responsive smoke, 30 августа 2026

Development-only стенд `/dev/room` проверен во встроенном Chromium на 320, 375, 430 и 768 px. На всех ширинах `document.scrollWidth <= window.innerWidth`; topbar, карточки, реакции и chat-form не дают горизонтального overflow. Режимы normal, sticky и hidden/restore проверены интерактивно. На 320 px YouTube sticky имеет ширину 232 px и сохраняет официальную минимальную область 200×200; нижний отступ оставляет место Telegram bottom safe area.

Это browser smoke, а не отметка реальных Telegram-клиентов. Пункты Android/iOS/Desktop ниже остаются обязательными перед pilot.

## Матрица устройств

Повторить сценарии ниже в Telegram Android, Telegram iOS, Telegram Desktop и обычном браузере. Для Twitch использовать production-like HTTPS hostname, внесённый без схемы/порта в `NEXT_PUBLIC_TWITCH_PARENT_DOMAINS`.

## Сценарии для каждого клиента

- [ ] YouTube VIDEO по `watch`, `youtu.be`, `shorts` и `embed` нормализуется в один video ID.
- [ ] YouTube Live загружается; реальное поведение DVR записано для эфира с DVR и без него.
- [ ] Twitch channel live загружается при корректном `parent`; с неверным parent видна понятная ошибка Twitch.
- [ ] Twitch VOD загружается и выполняет seek; Twitch Live не показывает и не выполняет seek.
- [ ] Ничего не стартует до нажатия «Начать просмотр»; после tap воспроизведение восстанавливается либо показывается `AUTOPLAY_BLOCKED` с повторным действием.
- [ ] YouTube embed не меньше 200×200; рекомендованный 16:9 размер 480×270 достижим.
- [ ] Twitch отображается только при области минимум 400×300; на узком viewport показано предупреждение и ссылка на оригинал.
- [ ] Controls/branding официального iframe не перекрыты интерфейсом WatchRoom.
- [ ] Ошибка YouTube 101/150 и `embeddable=false` дают русское сообщение и кнопку открытия оригинала.
- [ ] Ошибка YouTube 153 проверена с `Referrer-Policy: strict-origin-when-cross-origin` и корректным HTTPS origin.
- [ ] Смена source уничтожает прежний adapter/iframe; после 20 смен нет накопления iframe/listeners.
- [ ] Метаданные без API credentials недоступны, но sourceId и ручной `nowWatchingText` позволяют смотреть.
- [ ] В Network нет HTML scraping и медиапрокси: только официальные SDK/embed/API hosts.
- [ ] В логах API отсутствуют YouTube key, Twitch secret/token, URL query с secret и Telegram initData.
- [ ] Twitch Chat не загружается.

## Что записать после прогона

Для каждой платформы сохранить версию Telegram/ОС, источник, результат autoplay/tap recovery, фактический размер iframe, YouTube Live DVR/seek, Twitch latency/offline и текст ошибок. Без этого прогона нельзя объявлять подтверждёнными одинаковое mobile-поведение, YouTube Live seek или работу Twitch на production hostname.
