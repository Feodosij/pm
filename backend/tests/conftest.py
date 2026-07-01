import pytest
from app import db


@pytest.fixture(autouse=True)
def tmp_db(tmp_path, monkeypatch):
    """Redirect DB to a fresh temp file for every test."""
    db_file = str(tmp_path / "test.db")
    monkeypatch.setattr(db, "_DB_PATH", db_file)
    db.init_db(db_file)
    return db_file
