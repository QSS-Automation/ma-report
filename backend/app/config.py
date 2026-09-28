from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
    db_host: str = "10.1.10.1"
    db_port: int = 3306
    db_user: str = "quandatics"
    db_pass: str = ""
    debug:   bool = False
    teams_webhook_url: str = ""
    # Microsoft Graph (app-only) — used to find invoice PDFs in SharePoint.
    # App registration needs Application permission Sites.Read.All (admin
    # consented) and a client secret. Leave blank to disable the feature.
    graph_tenant_id: str = ""
    graph_client_id: str = ""
    graph_client_secret: str = ""
    @property
    def database_url(self) -> str:
        return (f"mysql+pymysql://{self.db_user}:{self.db_pass}"
                f"@{self.db_host}:{self.db_port}/ops_QM?charset=utf8mb4")

settings = Settings()
