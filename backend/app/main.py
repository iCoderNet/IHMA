from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import create_tables, AsyncSessionLocal
from app.routers import auth, sections, appeals, dashboard, bot_admin, districts, bot_webhook, ai_chat, voice


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and seed superadmin
    await create_tables()
    await seed_superadmin()
    yield


async def seed_superadmin():
    """Create default superadmin if not exists."""
    from sqlalchemy import select
    from app.models.user import User, UserRole
    from app.core.security import get_password_hash

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.role == UserRole.SUPERADMIN)
        )
        if not result.scalar_one_or_none():
            admin = User(
                username=settings.SUPERADMIN_USERNAME,
                full_name="Super Administrator",
                password_hash=get_password_hash(settings.SUPERADMIN_PASSWORD),
                role=UserRole.SUPERADMIN,
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print(f"✅ Superadmin created: {settings.SUPERADMIN_USERNAME}")

        # Seed Andijan districts
        from app.models.district import District
        from sqlalchemy import func as sql_func
        count = (await db.execute(
            select(sql_func.count()).select_from(District)
        )).scalar()
        if count == 0:
            andijan_districts = [
                "Andijon shahri", "Asaka", "Baliqchi", "Bo'ston", "Jalolquduq",
                "Izboskan", "Qo'rg'ontepa", "Marhamat", "Oltinko'l", "Paxtaobod",
                "Shahrixon", "Ulug'nor", "Xo'jaobod",
            ]
            for name in andijan_districts:
                db.add(District(name=name, name_ru=name))
            await db.commit()
            print(f"✅ {len(andijan_districts)} districts seeded")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api")
app.include_router(districts.router, prefix="/api")
app.include_router(sections.router, prefix="/api")
app.include_router(appeals.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(bot_admin.router, prefix="/api")
app.include_router(bot_webhook.router, prefix="/api")
app.include_router(ai_chat.router, prefix="/api")
app.include_router(voice.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
