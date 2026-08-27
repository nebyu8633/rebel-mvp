import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import models  # noqa: F401 - register models on Base metadata
from app.db.database import Base
from app.db.models import Restaurant


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    yield session
    session.close()


@pytest.fixture()
def settings() -> Settings:
    return Settings(
        database_url="sqlite:///:memory:",
        ai_api_key="test-key",
        whatsapp_access_token="test-token",
        whatsapp_phone_number_id="123456",
        whatsapp_verify_token="verify-me",
        price_alert_threshold=0.03,
        price_alert_critical_threshold=0.10,
        min_confidence=0.85,
        price_history_window_days=60,
    )


@pytest.fixture()
def make_restaurant(db_session):
    def _make(phone: str = "+972500000001", name: str = "Test Restaurant") -> Restaurant:
        restaurant = Restaurant(name=name, whatsapp_phone=phone)
        db_session.add(restaurant)
        db_session.flush()
        return restaurant

    return _make
