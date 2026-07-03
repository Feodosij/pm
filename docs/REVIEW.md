# Backend Audit — Pre-Refactoring Review

Дата: 2026-07-03. Охват: `backend/app/*.py`, тесты, `.gitignore`, конфигурация.
Никаких изменений кода не внесено — только анализ.

Серьёзность: **критично** / **средне** / **мелочь**

---

## 1. Структура — God Object и смешанные ответственности

### 1.1 `chat.py` содержит четыре ответственности в одном файле

**Серьёзность: средне**

`chat.py` одновременно отвечает за:
- роут (`POST /api/chat`, строки 175–217)
- оркестрацию AI (сборка промпта, парсинг ответа, строки 56–81, 183–215)
- бизнес-логику валидации (строки 84–93)
- прямую работу с БД (функция `_apply_operation`, строки 96–172)

Для MVP это приемлемо, но `_apply_operation` — 77 строк с чистой SQL-логикой — должна жить в `board.py` рядом с аналогичным кодом.

**Предлагаемое разбиение:**

| Что | Куда вынести |
|---|---|
| `_apply_operation` (строки 96–172) | `board.py` — там же живёт вся CRUD-логика карточек |
| `_build_system_prompt` + `_build_messages` (строки 56–81) | можно оставить в `chat.py`, они специфичны для AI |
| `_validate_ops_referential` (строки 84–93) | оставить в `chat.py` — логика валидации AI-ответа |

### 1.2 `board.py` импортирует `_USERNAME` внутри каждой функции

**Серьёзность: мелочь**

Строки 89, 98, 121, 193, 217 — в каждом route handler:
```python
from app.auth import _USERNAME  # повторяется 5 раз внутри функций
```
Это нехарактерный паттерн, вероятно возник для обхода циклического импорта. Импорт должен быть на уровне модуля. Если цикличность — проблема, `_USERNAME` следует вынести в отдельный `constants.py`.

### 1.3 `chat.py` импортирует приватные хелперы из `board.py`

**Серьёзность: мелочь**

```python
# chat.py, строка 10
from app.board import _get_board_id, _get_user_id, _load_board, BoardOut
```

Функции с префиксом `_` являются деталями реализации. Такой импорт создаёт хрупкую связь: переименование хелпера в `board.py` сломает `chat.py` без предупреждения. Эти три функции стоит сделать публичными (убрать `_`).

---

## 2. Безопасность

### 2.1 Пароль хранится в открытом виде

**Серьёзность: критично (для production) / приемлемо для MVP**

`auth.py`, строка 12:
```python
_PASSWORD = "password"
```
Сравнение на строке 22:
```python
if body.username != _USERNAME or body.password != _PASSWORD:
```

Хеширования нет. Это явно задокументировано как MVP-упрощение в `AGENTS.md` («hardcoded to user/password»). Перед переходом к production необходимо заменить на `passlib`/`bcrypt` и хранить хеш в БД.

### 2.2 `.env` не попадает в git — OK

`.gitignore`, строка 5: `.env` исключён. `.env.example` содержит только плейсхолдер без реального ключа. API-ключ нигде не захардкожен в коде.

### 2.3 SQL-инъекции исключены — OK

Все запросы используют параметризацию через `?`. Перед использованием в SQL применяется явное приведение `int(card_id)` (например, `board.py:130`). Никакой конкатенации строк в SQL-запросах нет.

### 2.4 Cookie без флага `secure`

**Серьёзность: мелочь (в текущем окружении)**

`auth.py`, строка 26:
```python
response.set_cookie("session", token, httponly=True, samesite="strict", max_age=86400)
```

`secure=True` отсутствует. В локальном HTTP-окружении (Docker) это нормально. При деплое на HTTPS — обязательно добавить `secure=True`.

### 2.5 `_USERNAME` продублирован в двух файлах

**Серьёзность: мелочь**

- `auth.py`, строка 11: `_USERNAME = "user"`
- `db.py`, строка 31: `_USERNAME = "user"`

Два источника истины. Если имя изменится — надо помнить поменять в обоих местах.

---

## 3. AI-чат (`chat.py`): валидация, all-or-nothing, coverage

### 3.1 Референциальная валидация — работает корректно

`_validate_ops_referential` (строки 84–93) перед любой записью в БД собирает все существующие `card_ids` и `column_ids` из текущего состояния доски и проверяет каждую операцию. Если хоть один ID не существует — вся партия отклоняется (строки 203–206). Логирование warning присутствует (строка 205). Тест `test_chat_multi_op_one_invalid_rejects_all` подтверждает это поведение.

### 3.2 All-or-nothing — работает корректно

Паттерн реализован через двухэтапную структуру:
1. `_validate_ops_referential` — проверка до записи (строка 203)
2. Только после успешной валидации — `with get_connection()` и цикл `_apply_operation` (строки 210–212)

Если `_apply_operation` выбросит исключение, контекст-менеджер `get_connection` сделает `rollback` (`db.py:50`). Всё транзакционно.

### 3.3 Непокрытые 11% в `chat.py` — конкретные строки

**Серьёзность: средне (есть функциональные пробелы)**

| Строки | Что не покрыто | Почему это важно |
|---|---|---|
| 40, 42 | `@model_validator`: ветка `edit`/`delete` без `card_id` → `ValueError` | Нет теста, что AI может прислать `{"operation": "delete"}` без `card_id` |
| 125–127 | Ветка `move` с `src == dest` и `position is None` в `_apply_operation` | Нет теста на AI-перемещение карточки в ту же колонку без указания позиции |
| 136–148 | Весь блок intra-column reorder в `_apply_operation` (`if old_pos < new_pos` / `elif old_pos > new_pos`) | Нет теста на AI-сортировку карточек внутри одной колонки |
| 155 | Ветка cross-column move с явным `position` в `_apply_operation` | Нет теста, где AI задаёт `position` при перемещении между колонками |
| 213–215 | `except Exception` вокруг `_apply_operation` → `logger.error` + graceful return | Нет теста на DB-ошибку во время применения операций |

Дополнительно в `ai.py`:

| Строки | Что не покрыто |
|---|---|
| 13–14 | `_make_client()` — не вызывается, т.к. `chat_completion` мокается в тестах |
| 31 | `RateLimitError` handler — нет теста на rate limit |

---

## 4. Обработка ошибок OpenRouter

### 4.1 `RuntimeError` от `chat_completion` не перехватывается в роуте

**Серьёзность: критично**

`chat.py`, строка 183:
```python
reply_text = await chat_completion(messages)
```

Эта строка обёрнута **без try/except**. Все четыре ошибки из `ai.py` (`AuthenticationError`, `APITimeoutError`, `APIConnectionError`, `RateLimitError`) конвертируются в `RuntimeError` и всплывают до FastAPI, который возвращает **500 Internal Server Error** с трейсбеком.

Реальные сценарии:
- Нет ключа / неверный ключ → 500
- OpenRouter недоступен → 500
- Превышен rate limit → 500
- Таймаут → 500 (нет явного таймаута в клиенте, ждёт indefinitely)

**Предлагаемое исправление** (строки 182–184):
```python
try:
    reply_text = await chat_completion(messages)
except RuntimeError as e:
    return ChatResponse(reply=f"AI unavailable: {e}", board_update=None)
```

### 4.2 Нет timeout у OpenRouter-клиента

**Серьёзность: средне**

`ai.py`, строка 21:
```python
response = await client.chat.completions.create(model=MODEL, messages=messages)
```

Нет параметра `timeout`. Запрос может висеть неограниченно долго, блокируя воркер.

**Предлагаемое исправление:**
```python
response = await client.chat.completions.create(
    model=MODEL,
    messages=messages,
    timeout=30.0,
)
```

---

## 5. Дубликаты и мёртвый код

### 5.1 Логика перемещения карточки дублируется

**Серьёзность: средне**

Move-логика (~40 строк SQL) реализована дважды:
- `board.py:patch_card`, строки 139–179: обработка `PATCH /api/board/cards/{id}`
- `chat.py:_apply_operation`, строки 117–163: применение AI-операции `move`

Оба блока делают одно: закрывают позицию в source-колонке, открывают в dest-колонке, обновляют `column_id` и `position`. Различие только в деталях дефолтного `new_pos` при `position is None`.

**Предлагаемое исправление:** вынести `_apply_operation` в `board.py`, добавить хелпер `_move_card(conn, card_id, dest_col_id, new_pos)`, переиспользовать в обоих местах.

### 5.2 Мёртвый импорт в `board.py`

**Серьёзность: мелочь**

`board.py`, строка 7:
```python
from app.db import get_connection, get_db_path
```

`get_db_path` импортируется, но нигде в `board.py` не используется. Может быть удалён.

### 5.3 Смешанный стиль аннотаций в `board.py`

**Серьёзность: мелочь**

`board.py`, строки 39–43 используют `Optional[str]` / `Optional[int]` из `typing`.
Остальной код (например, `auth.py:31`, `db.py:40`) использует современный синтаксис `str | None`.
Python 3.12 поддерживает `T | None` везде — `Optional` можно убрать вместе с импортом `typing.Optional`.

---

## Сводная таблица

| # | Файл | Строки | Серьёзность | Суть |
|---|---|---|---|---|
| 1 | `chat.py` | 183 | **критично** | `chat_completion` без try/except → 500 при недоступности OpenRouter |
| 2 | `auth.py` | 12 | **критично** (production) | Пароль в открытом виде |
| 3 | `chat.py` | 96–172 | **средне** | `_apply_operation` дублирует move-логику из `board.py` |
| 4 | `ai.py` | 21 | **средне** | Нет timeout на OpenRouter-запрос |
| 5 | `chat.py` | 136–148, 155 | **средне** | Intra-column reorder и cross-column с position не покрыты тестами |
| 6 | `chat.py` | 213–215 | **средне** | DB-ошибка во время `_apply_operation` не покрыта тестом |
| 7 | `board.py` | 89, 98, 121, 193, 217 | **мелочь** | `from app.auth import _USERNAME` повторяется внутри каждого route |
| 8 | `chat.py` | 10 | **мелочь** | Импорт приватных `_get_board_id`, `_get_user_id`, `_load_board` из `board.py` |
| 9 | `auth.py`+`db.py` | 11 и 31 | **мелочь** | `_USERNAME = "user"` продублирован |
| 10 | `board.py` | 7 | **мелочь** | `get_db_path` импортируется но не используется |
| 11 | `board.py` | 39–43 | **мелочь** | `Optional[T]` вместо `T \| None` — устаревший стиль |
| 12 | `auth.py` | 26 | **мелочь** | Cookie без `secure=True` (важно при деплое на HTTPS) |
