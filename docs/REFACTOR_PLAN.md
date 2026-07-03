# Refactor Plan — Backend Structural Cleanup

Дата: 2026-07-03. Основан на `docs/REVIEW.md`.
**Никаких изменений поведения** — только реорганизация кода и покрытие тестами.

**Статус: ✅ ВЫПОЛНЕНО 2026-07-03**
Итог: 51 pytest passed (1 skipped), 77 vitest passed. Coverage 93% → 97%.

После каждого шага: `pytest` в `backend/`. При падении — стоп, отчёт.

---

## Шаг 1 — `constants.py`: единый источник `USERNAME`

**Что:**
- Создать `backend/app/constants.py` с одной строкой:
  ```python
  USERNAME = "user"
  ```
- `auth.py`: убрать `_USERNAME = "user"`, импортировать `from app.constants import USERNAME as _USERNAME`
- `db.py`: убрать `_USERNAME = "user"`, импортировать `from app.constants import USERNAME`
- `board.py`: убрать 5 инлайн-импортов `from app.auth import _USERNAME` внутри функций,
  добавить на уровне модуля `from app.constants import USERNAME`

**Почему сейчас нет кругового импорта:**  
`auth.py` → не импортирует `board.py` или `chat.py`. Инлайн-импорты в `board.py` были
историческим артефактом, а не защитой от реального цикла.

**Риск:** низкий. Тесты `test_auth.py` используют `auth._sessions` и не зависят от значения `_USERNAME` напрямую.

---

## Шаг 2 — Публичные хелперы в `board.py`

**Что:**
- Переименовать `_get_user_id` → `get_user_id`
- Переименовать `_get_board_id` → `get_board_id`
- Переименовать `_load_board` → `load_board`
- Обновить все вызовы внутри `board.py` и в `chat.py` (строка 10 и далее)

**Почему:** `chat.py` импортирует приватные `_`-функции, создавая хрупкую связь.
После переименования контракт становится явным.

**Риск:** низкий. Сугубо механическое переименование.

---

## Шаг 3 — Косметика в `board.py`

**Что:**
- Строка 7: убрать `get_db_path` из импорта (мёртвый импорт, нигде не используется)
- Строки 39–43 (`PatchCardBody`): заменить `Optional[str]` / `Optional[int]` → `str | None` / `int | None`
- Убрать `from typing import Optional` (станет неиспользуемым)

**Риск:** минимальный. Только синтаксис аннотаций, runtime не меняется.

---

## Шаг 4 — `_move_card` + унификация move-логики

Это самый сложный шаг. Move-логика дублируется в `board.py:patch_card`
(строки 152–179) и `chat.py:_apply_operation` (строки 117–163).

### 4а. Переместить `CardOperation` в `board.py`

`CardOperation` — модель операции над доской, а не AI-специфичная структура.
Переносим её (с `@model_validator`) из `chat.py` в конец секции моделей `board.py`.
`chat.py` импортирует `CardOperation` из `board.py`.

Это единственный способ избежать кругового импорта при переносе `_apply_operation`:
`board.py` → должна принимать `CardOperation` как аргумент.
Если `CardOperation` остаётся в `chat.py` → цикл `chat → board → chat`.

### 4б. Добавить `_move_card` в `board.py`

```python
def _move_card(conn, card_id: int, dest_col_id: int, new_pos: int) -> None:
    """Shift positions and move a card. Caller must compute new_pos."""
    row = conn.execute(
        "SELECT column_id, position FROM cards WHERE id = ?", (card_id,)
    ).fetchone()
    src_col_id = row["column_id"]
    old_pos    = row["position"]

    if src_col_id == dest_col_id:
        if old_pos < new_pos:
            conn.execute(
                "UPDATE cards SET position = position - 1 "
                "WHERE column_id = ? AND position > ? AND position <= ?",
                (src_col_id, old_pos, new_pos),
            )
        elif old_pos > new_pos:
            conn.execute(
                "UPDATE cards SET position = position + 1 "
                "WHERE column_id = ? AND position >= ? AND position < ?",
                (src_col_id, new_pos, old_pos),
            )
        conn.execute("UPDATE cards SET position = ? WHERE id = ?", (new_pos, card_id))
    else:
        conn.execute(
            "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
            (src_col_id, old_pos),
        )
        conn.execute(
            "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
            (dest_col_id, new_pos),
        )
        conn.execute(
            "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
            (dest_col_id, new_pos, card_id),
        )
```

**Ключевое наблюдение:** «открывать слот» в dest безопасно всегда.
Когда `new_pos = MAX + 1` (append), `WHERE position >= MAX+1` не затрагивает ни одну строку.
Поэтому один хелпер без флагов покрывает оба случая.

### 4в. Рефакторинг `patch_card` в `board.py`

Текущая move-ветка (строки 152–179) заменяется на:
```python
new_pos = body.position if body.position is not None else 0
_move_card(conn, int(card_id), dest_col_id, new_pos)
# title/details обновить отдельным UPDATE если изменились
```

### 4г. Перенести `_apply_operation` из `chat.py` в `board.py`

Переносим как публичную функцию `apply_board_operation(conn, op: CardOperation) -> None`.
Move-ветка внутри неё делегирует `_move_card`:
```python
elif op.operation == "move":
    card_id    = int(op.card_id)
    dest_col_id = int(op.column_id)
    row = conn.execute("SELECT column_id, position FROM cards WHERE id = ?", (card_id,)).fetchone()
    if op.position is not None:
        new_pos = op.position
    elif row["column_id"] == dest_col_id:
        new_pos = conn.execute(
            "SELECT COALESCE(MAX(position), 0) FROM cards WHERE column_id = ?", (dest_col_id,)
        ).fetchone()[0]
    else:
        new_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?", (dest_col_id,)
        ).fetchone()[0] + 1
    _move_card(conn, card_id, dest_col_id, new_pos)
```

### 4д. Обновить `chat.py`

- Добавить импорт `from app.board import CardOperation, apply_board_operation`
- Убрать определение `CardOperation`, убрать `_apply_operation`
- Заменить `_apply_operation(conn, op)` → `apply_board_operation(conn, op)` в роуте

**Риск:** средний. Тесты `test_board.py` и `test_chat.py` должны поймать любую регрессию move-логики.

---

## Шаг 5 — Недостающие тесты (покрытие существующего поведения)

Добавляем в `backend/tests/test_chat.py`:

### 5а. AI intra-column reorder — shift down
Переместить первую карточку Backlog (pos 0) в конец (pos 2).
Проверить, что порядок изменился корректно.

### 5б. AI intra-column reorder — shift up
Переместить последнюю карточку Backlog (pos 2) в начало (pos 0).
Проверить, что порядок изменился корректно.

### 5в. AI move в ту же колонку без `position`
`{"operation": "move", "card_id": X, "column_id": SAME}` (position не задан).
Проверить, что карточка оказалась в той же колонке на последней позиции.

### 5г. AI cross-column move с явным `position`
`{"operation": "move", "card_id": X, "column_id": OTHER, "position": 0}`.
Проверить, что карточка оказалась на позиции 0 в целевой колонке,
а остальные карточки сдвинулись.

### 5д. DB-ошибка во время `apply_board_operation` → graceful return
Мокать `apply_board_operation` (или `get_connection`) так, чтобы бросить `Exception`.
Проверить:
- статус 200
- `board_update` == `None`
- `logger.error` сработал (через `caplog`)
- доска не изменилась

---

## Финальная проверка

После всех шагов:
1. `pytest` — все тесты зелёные
2. `npx vitest run` — все frontend-тесты зелёные
3. Поднять `backend` + `frontend`, вручную проверить: логин, доска, drag&drop, AI-чат
4. Обновить `REVIEW.md` — отметить выполненные пункты

---

## Сводная таблица шагов

| Шаг | Файлы | Риск | Результат |
|-----|-------|------|-----------|
| 1. constants.py ✅ | `constants.py` (new), `auth.py`, `db.py`, `board.py` | низкий | 46 passed |
| 2. Публичные хелперы ✅ | `board.py`, `chat.py` | низкий | 46 passed |
| 3. Косметика ✅ | `board.py` | минимальный | (совмещён с шагом 1) |
| 4. `_move_card` ✅ | `board.py`, `chat.py` | средний | 46 passed |
| 5. Новые тесты ✅ | `tests/test_chat.py` | низкий | 51 passed |

**Решение по шагу 4:** перенесён только `_move_card` в `board.py`.
`_apply_operation` и `CardOperation` остались в `chat.py` — направление зависимости
`chat → board`, но не `board → chat`. Слои разделены.
