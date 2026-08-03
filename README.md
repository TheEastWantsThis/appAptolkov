# Апотолков CRM/ERP

Мобильная CRM/ERP на Next.js для работы с лидами, проектами, замерами, сметами, монтажами, финансами, складом и управленческой аналитикой.

## Стек

- Next.js 16, React 19, TypeScript strict, Tailwind CSS 4;
- PostgreSQL 17, Prisma 7;
- Auth.js Credentials, Argon2id, серверный RBAC;
- Zod, Vitest, PostgreSQL integration tests и Playwright;
- PDFKit для клиентских и внутренних смет.

## Требования

- Node.js 20.19 или новее;
- npm;
- Docker Desktop либо PostgreSQL 17;
- для E2E: Chromium, устанавливаемый командой npx playwright install chromium.

## Переменные окружения

Скопируйте шаблон:

```powershell
Copy-Item .env.example .env
```

| Переменная          | Назначение                                 |
| ------------------- | ------------------------------------------ |
| DATABASE_URL        | Строка подключения PostgreSQL              |
| AUTH_SECRET         | Секрет Auth.js длиной не менее 32 символов |
| AUTH_TRUST_HOST     | Доверять заголовку host за reverse proxy   |
| SEED_ADMIN_PASSWORD | Пароль локального администратора при seed  |
| SEED_DEMO_PASSWORD  | Пароль демонстрационных пользователей      |

Создание секрета:

```powershell
npx auth secret
```

Не коммитьте .env и не используйте демонстрационные пароли в production.

## Локальный запуск

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Приложение: [http://localhost:3000](http://localhost:3000).

Проверка контейнера:

```powershell
docker compose ps
docker compose logs postgres
```

## База данных и миграции

Создание миграции после изменения схемы:

```powershell
npm run db:migrate -- --name short_description
```

Применение готовых миграций без их изменения:

```powershell
npm run db:deploy
```

Другие команды:

```powershell
npm run db:generate
npm run db:studio
npm run db:seed
```

Seed идемпотентно создаёт permissions, роли, пользователей, тарифы, демонстрационный проект, замер, монтаж, финансы и складские материалы.

## Тестовые пользователи

| Роль              | Логин     | Email                   | Пароль по умолчанию |
| ----------------- | --------- | ----------------------- | ------------------- |
| ADMIN             | admin     | admin@example.local     | Admin123!           |
| PROMOTER          | promoter  | promoter@example.local  | Demo123!            |
| AD_OPERATOR       | operator  | operator@example.local  | Demo123!            |
| MEASURER          | measurer  | measurer@example.local  | Demo123!            |
| INSTALLER         | installer | installer@example.local | Demo123!            |
| WAREHOUSE_MANAGER | warehouse | warehouse@example.local | Demo123!            |
| FINANCE_MANAGER   | finance   | finance@example.local   | Demo123!            |
| MANAGER           | manager   | manager@example.local   | Demo123!            |

Пароли берутся из SEED_ADMIN_PASSWORD и SEED_DEMO_PASSWORD.

## Проверки

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

npm test запускает unit-тесты. Integration-тесты используют DATABASE_URL, создают данные с уникальными идентификаторами и удаляют только собственные записи.

## Модули и безопасность

- Лиды: быстрый мобильный ввод, нормализация телефона, защита дублей и операторская очередь.
- Проекты: state machine, задачи, статусы, история, файлы и календарь.
- Замеры и сметы: локальные черновики, серверный калькулятор, snapshot тарифов и раздельные PDF.
- Монтажи: бригады, пересечения календаря, ход работ и повторные выезды.
- Финансы: договор, скидка, платежи, себестоимость, прибыль и маржинальность. Все изменения записываются в AuditLog.
- Склад: остатки, резервы, движения, дефицит и optimistic concurrency через version.
- Аналитика: период, источник, сотрудник и статус; воронка, финансы, эффективность, материалы и загрузка.
- Уведомления: лиды, просрочки, завтрашние выезды, назначения, статусы, дефицит и повторные выезды.

Все проверки доступа выполняются сервером. UI скрывает недоступные элементы только для удобства. Кабинеты замерщика и монтажника используют отдельные DTO, в которые не выбираются телефон и финансовые поля. Промоутерская аналитика принудительно ограничена собственным authorId и не загружает финансы.

Проект нельзя закрыть, пока остаются открытые задачи, незавершённые монтажи или непогашенные финансовые условия.

## Хранилище файлов

В MVP приложение хранит только HTTPS-ссылки и метаданные файлов; бинарные данные не проксируются через Next.js. Ссылки с javascript:, file: и другими протоколами отклоняются Zod.

Для production:

1. Создайте закрытый bucket в S3-совместимом хранилище.
2. Запретите публичный листинг и постоянные публичные URL.
3. Выдавайте короткоживущие signed upload/download URL серверным endpoint с RBAC.
4. Ограничьте MIME-типы, размер, количество файлов и расширения.
5. Проверяйте magic bytes и запускайте антивирусную проверку.
6. Сохраняйте в БД непрогнозируемый object key, размер, MIME, автора и checksum.
7. Включите lifecycle, versioning, шифрование и журнал доступа.
8. Не передавайте секреты bucket в браузер.

До подключения такого адаптера формы принимают только готовые HTTPS-ссылки доверенного хранилища.

## Резервное копирование

```powershell
docker compose exec postgres pg_dump -U apotolkov -d apotolkov -Fc -f /tmp/apotolkov.dump
docker cp apotolkov-postgres:/tmp/apotolkov.dump .\apotolkov.dump
```

Храните резервные копии зашифрованно вне сервера приложения и регулярно проверяйте восстановление.

## Восстановление базы

Восстановление перезаписывает данные. Сначала остановите приложение и создайте свежую резервную копию.

```powershell
docker cp .\apotolkov.dump apotolkov-postgres:/tmp/apotolkov.dump
docker compose exec postgres pg_restore -U apotolkov -d apotolkov --clean --if-exists /tmp/apotolkov.dump
npm run db:deploy
```

После восстановления выполните smoke-тест входа, RBAC и ключевых карточек.

## Деплой

1. Создайте отдельную PostgreSQL и production-секреты.
2. Соберите immutable image или установите зависимости через npm ci.
3. Выполните npm run db:deploy отдельным release-job.
4. Выполните npm run build, затем npm start.
5. Настройте HTTPS, reverse proxy, централизованные логи и мониторинг.
6. Настройте ежедневные backup, retention и тестовое восстановление.
7. Не запускайте демонстрационный seed в production.

## Документация

- docs/ARCHITECTURE.md — архитектура;
- docs/ACCESS-WORKFLOWS.md — сценарии доступа;
- docs/SECURITY-AUDIT.md — финальный аудит MVP.
