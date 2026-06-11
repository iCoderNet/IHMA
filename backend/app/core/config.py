from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "IHMA Social Platform"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "mysql+aiomysql://root:password@localhost:3306/social_platform"

    # JWT
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Telegram
    BOT_TOKEN: Optional[str] = None
    WEBHOOK_URL: Optional[str] = None

    # Superadmin
    SUPERADMIN_USERNAME: str = "superadmin"
    SUPERADMIN_PASSWORD: str = "Admin@123456"

    # Muxlisa AI Voice
    MUXLISA_API_KEY: str = ""
    MUXLISA_TTS_SPEAKER: int = 0  # 0=female, 1=male

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
