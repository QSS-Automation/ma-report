from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
    db_host: str = "10.1.10.1"
    db_port: int = 3306
    db_user: str = "quandatics"
    db_pass: str = ""
    debug:   bool = False
    teams_webhook_url: str = ""
    @property
    def database_url(self) -> str:
        return (f"mysql+pymysql://{self.db_user}:{self.db_pass}"
                f"@{self.db_host}:{self.db_port}/staging_QM?charset=utf8mb4")

settings = Settings()
