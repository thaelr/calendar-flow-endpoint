# Woof WhatsApp Flow Endpoint

Минимальный отдельный backend для `WhatsApp Flows`, который подходит под ваш текущий flow `month -> date -> time -> details -> summary`.

Сейчас это **MVP на моковых слотах**:
- endpoint уже умеет отвечать на `ping`
- отдает месяцы, даты и время
- собирает `DETAILS`
- возвращает `extension_message_response` на подтверждении

Следующий шаг после запуска - заменить моковый календарь на `Google Calendar`.

## Что внутри

- `src/server.js` - HTTP endpoint для Meta
- `src/encryption.js` - расшифровка запроса и шифрование ответа
- `src/flow.js` - логика экранов flow
- `src/mock-calendar.js` - временная логика месяцев, дат и слотов
- `src/key-generator.js` - генерация RSA ключей для Meta

## Быстрый старт локально

```bash
npm install
cp .env.example .env
npm run dev
```

По умолчанию сервис поднимется на:

```text
http://localhost:3000/whatsapp-flow
```

Health check:

```text
http://localhost:3000/health
```

## Какие env понадобятся

Минимально:

- `APP_SECRET` - app secret из Meta app
- `PRIVATE_KEY` - приватный RSA ключ
- `PASSPHRASE` - фраза, которой этот ключ зашифрован

Дополнительно:

- `FLOW_ENDPOINT_PATH` - по умолчанию `/whatsapp-flow`
- `STUDIO_ADDRESS` - адрес студии
- `CALENDAR_TIMEZONE` - по умолчанию `Europe/Berlin`
- `BOOKING_HORIZON_DAYS` - по умолчанию `180`
- `CALENDAR_MONTH_COUNT` - по умолчанию `6`

## Как сделать ключи

```bash
npm run gen:keys -- "your-strong-passphrase"
```

После этого:

- `Public key` загружаете в Meta
- `Private key` кладёте в env `PRIVATE_KEY`
- ту же фразу кладёте в env `PASSPHRASE`

## Как подключить к Railway

1. Создаете отдельный git-репо из этой папки.
2. Подключаете репо к `Railway`.
3. Добавляете env:
   - `APP_SECRET`
   - `PRIVATE_KEY`
   - `PASSPHRASE`
   - при желании `STUDIO_ADDRESS`
4. После деплоя получаете URL вида:

```text
https://your-service.up.railway.app/whatsapp-flow
```

5. Именно этот URL вставляете в Meta в поле `Конечная точка`.

## Как загрузить через GitHub Desktop

1. Открываете папку [whatsapp-flow-endpoint](</Users/nikolaisekusheko/Documents/Проекты/SMBs project/woof tattoo/whatsapp-flow-endpoint>).
2. В `GitHub Desktop` выбираете `File -> Add Local Repository`.
3. Если Desktop скажет, что это еще не репозиторий, выбираете `create a repository here`.
4. Публикуете его в `GitHub` как отдельный репо, например `woof-whatsapp-flow-endpoint`.
5. В `Railway` создаете новый сервис из этого репо.

В папке уже есть:

- `.gitignore`
- `.nvmrc`
- `railway.json`
- `package.json`

То есть для `GitHub` и `Railway` она уже самодостаточная.

## Как это стыкуется с вашим flow

Текущий endpoint рассчитан на такой сценарий:

- `INIT` -> отдает экран `APPOINTMENT`
- `month_selected` -> наполняет `date`
- `date_selected` -> наполняет `time`
- `DETAILS` submit -> собирает экран `SUMMARY`
- `SUMMARY` confirm -> возвращает `extension_message_response`

Под ваш файл `Календарь flows.rtf` это уже близко по структуре.

## Что дальше после первого запуска

1. Пройти Meta `health check`.
2. Проверить, что flow реально открывается с моковыми слотами.
3. Добавить `Google Calendar API`.
4. Заменить `mock-calendar.js` на реальную availability-логику.
5. Перед финальным подтверждением добавить повторную проверку слота и создание события.

## Важный нюанс

Сейчас это **не production-ready backend**, а быстрая рабочая основа.

Еще один практический момент:

- в официальных examples Meta финальный ответ идет через `SUCCESS` response с `extension_message_response`
- если ваш текущий flow JSON в builder попросит другой response snippet, ориентируйтесь на snippet из Meta builder, а не на догадки
- при первой интеграции это нормальная точка для дебага

Чего пока нет:

- интеграции с Google Calendar
- записи события в календарь
- защиты от дублей бронирования
- idempotency
- постоянного хранения booking sessions
- нормального audit/logging слоя

Но для старта и первого подключения Meta этого достаточно.
