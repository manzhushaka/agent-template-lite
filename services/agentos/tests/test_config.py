import pytest

from app.config import Settings


def test_real_model_configuration_is_required(monkeypatch):
    monkeypatch.setenv("MODEL_NAME", "test-model")
    monkeypatch.setenv("MODEL_BASE_URL", "https://model.example/v1")
    monkeypatch.setenv("AGENT_DATABASE_URL", "mysql+pymysql://demo:demo@127.0.0.1/demo_db")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "internal")
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="MODEL_API_KEY"):
        Settings.from_env()


def test_settings_accept_openai_compatible_model(monkeypatch, tmp_path):
    values = {
        "MODEL_NAME": "test-model",
        "MODEL_BASE_URL": "https://model.example/v1",
        "MODEL_API_KEY": "test-key",
        "AGENT_DATABASE_URL": "mysql+pymysql://demo:demo@127.0.0.1/demo_db",
        "INTERNAL_API_TOKEN": "internal",
        "LANCEDB_URI": str(tmp_path),
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    settings = Settings.from_env()
    assert settings.model_name == "test-model"
    assert settings.agent_database_schema == "demo_db"
    assert settings.lancedb_uri == tmp_path
