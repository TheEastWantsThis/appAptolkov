# WatchRoom — QA checklist закрытого MVP

Дата контрольного прогона: 31 августа 2026 года. Этот список является release gate: пункт считается выполненным только при наличии автоматического результата или записи ручной проверки.

## Автоматические проверки

- [x] `pnpm lint` — ESLint и Prettier без ошибок.
- [x] `pnpm typecheck` — strict TypeScript для shared, API и web.
- [x] `pnpm test` — unit и integration, включая REST/Socket.IO.
- [x] `pnpm build` — production build всех deployable-компонентов.
- [x] `pnpm test:e2e` — Chromium mobile, два изолированных browser context.
- [x] `pnpm audit --audit-level high` — нет high/critical advisories.
- [x] `pnpm prisma validate` и `docker compose config --quiet`.

## Критические сценарии

- [x] Валидный, поддельный, устаревший и replay Telegram `initData`.
- [x] Login CSRF, session CSRF, logout/revocation и отключение активного socket.
- [x] Exact Origin для REST login/mutations и Socket.IO handshake.
- [x] Server-side permissions: owner/moderator/viewer и `OWNER_ONLY`/`MODERATORS`/`EVERYONE`.
- [x] PRIVATE room не раскрывает metadata до grant; неверный пароль даёт единый ответ.
- [x] Argon2id 64 MiB/3/1; устаревший hash обнаруживается и обновляется после успешного входа.
- [x] Allowlist parser отклоняет `javascript:`, fake domains, arbitrary iframe и неоднозначные ID.
- [x] Chat: 40 сообщений при конкурентной записи, TTL 24 часа, cleanup read/write/background.
- [x] Удалённый текст отсутствует в audit; mute/block не мешает просмотру и реакциям.
- [x] Владелец комнаты не может быть ограничен модератором.
- [x] Канал с `WAITING`/`LIVE` комнатой нельзя удалить.
- [x] Realtime CAS/version, drift math, reconnect/grace, закрытая комната и 100 socket smoke.
- [x] HTTP payload больше 64 KiB отклоняется; realtime payload ограничен 16 KiB.
- [x] Метрики агрегированы и закрыты bearer token; request ID возвращается в ответах/ошибках.

## Ручная проверка перед выдачей тестировщикам

- [ ] Применить миграции на отдельной PostgreSQL и выполнить backup/restore rehearsal.
- [ ] Telegram Android: auth, theme, safe area, autoplay tap, compact/fullscreen, возврат из discussion.
- [ ] Telegram iOS: те же сценарии, клавиатура и bottom bar.
- [ ] Telegram Desktop: keyboard navigation, BackButton и reconnect.
- [ ] YouTube VOD/Live: embeddable/blocked/region/age ошибки, autoplay и live best effort.
- [ ] Twitch channel/VOD на production domain: корректный `parent`, минимум 400×300, no seek live.
- [ ] Проверить CSP в report-only наблюдении на production-like домене, затем enforcement.
- [ ] Проверить restore с зашифрованной резервной копии и зафиксировать фактические RPO/RTO.
- [ ] Назначить abuse/privacy контакт и пройти процедуру удаления/блокировки.

## Решение

Закрытый тест получает **GO** только если все автоматические проверки зелёные и первые четыре device/provider пункта выполнены на реальных клиентах. Публичный запуск до этого — **NO-GO**. Фактическое решение и результаты последнего прогона записываются в `IMPLEMENTATION_STATUS.md`.
