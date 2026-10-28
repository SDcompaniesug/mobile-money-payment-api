from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Mobile Money Payment API"
    api_key: str = "change-me"
    airtel_base_url: str = "https://openapi.airtel.africa"
    airtel_client_id: str = ""
    airtel_client_secret: str = ""
    airtel_country: str = "UG"
    airtel_currency: str = "UGX"
    airtel_callback_url: str = ""
    mtn_base_url: str = ""
    mtn_subscription_key: str = ""
    mtn_api_user: str = ""
    mtn_api_key: str = ""
    database_url: str = "sqlite:///./payments.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
