# ADR-0003: только официальные YouTube/Twitch embeds и capability-based sync

- Статус: принято
- Дата: 2026-08-29

## Контекст

Плееры имеют несовпадающие API и policy: Twitch Live не допускает seek/current time, YouTube Live зависит от DVR, мобильный autoplay ограничен, embed имеет минимальные размеры. Попытка скрыть различия создаст ложные продуктовые гарантии.

## Решение

Использовать только YouTube IFrame Player API и Twitch Interactive Embedded Player. Сервер нормализует source metadata; web реализует отдельные adapters с runtime capability matrix.

Матрица MVP:

- YouTube VOD: play/pause/seek/source;
- Twitch VOD: play/pause/seek/source;
- YouTube Live: play/pause/source и best-effort live alignment; seek только после прототипа DVR;
- Twitch Live: play/pause/source, reload-to-live; seek/current timestamp отсутствуют.

Медиапоток никогда не проходит через WatchRoom. Ошибка embed/region/age/DRM показывается как ограничение источника, без обходного player. Twitch требует `parent` и минимум 400×300; YouTube — минимум 200×200 и не допускает overlays над player. Источники: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [YouTube minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality), [Twitch Video & Clips](https://dev.twitch.tv/docs/embed/video-and-clips/), [Twitch embed requirements](https://dev.twitch.tv/docs/embed/).

## Layout и PiP

Один iframe меняет layout без destroy/recreate: full, sticky top, внутренний corner. Размер embed не нарушает provider minimum; если corner не помещается, выбирается sticky.

Системный Picture-in-Picture — progressive enhancement. Стандартный API работает с `HTMLVideoElement`, а WatchRoom не владеет cross-origin media element провайдера. Внутренний mini-player полностью независим от PiP. [W3C Picture-in-Picture](https://www.w3.org/TR/picture-in-picture/).

## Альтернативы

- Прямой HLS/DASH player отклонён: нарушает provider integration/rights, создаёт DRM/ad/region риски.
- Единый wrapper, скрывающий capability, отклонён: типы должны предотвращать `seek` для Twitch Live.
- Browser/system PiP как основной UX отклонён: доступность неодинакова, требуется gesture, cross-origin контроль отсутствует.

## Последствия

UI отображает разные controls для типов источника. Live sync честно называется приблизительной. Прототип на реальных Telegram clients является release gate. Provider terms/embeds остаются внешней availability dependency.
