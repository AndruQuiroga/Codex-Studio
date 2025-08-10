from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    project_root: str = Field(..., alias="PROJECT_ROOT")
    database_url: str = Field(
        "postgresql+psycopg://postgres:postgres@localhost:5432/codex",
        alias="DATABASE_URL",
    )
    redis_url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")
    codex_command: str = Field("", alias="CODEX_COMMAND")
    cors_origin: str = Field("http://localhost:3000", alias="CORS_ORIGIN")
    api_port: int = Field(5050, alias="API_PORT")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings(_env_file=".env", _secrets_dir=None)

