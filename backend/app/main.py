from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.core.config import settings
from app.models import ijtimoiy_hodim as _  # noqa: ensure table is registered
from app.core.database import create_tables, AsyncSessionLocal
from app.routers import auth, sections, appeals, dashboard, bot_admin, districts, bot_webhook, ai_chat, voice, bolim, ijtimoiy_hodimlar

# Built frontend lives at  backend/static/  (vite outDir: '../backend/static')
STATIC_DIR = Path(__file__).parent.parent / "static"


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

# ── API routes (must be registered BEFORE the SPA catch-all) ────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(districts.router, prefix="/api")
app.include_router(sections.router, prefix="/api")
app.include_router(appeals.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(bot_admin.router, prefix="/api")
app.include_router(bot_webhook.router, prefix="/api")
app.include_router(ai_chat.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(bolim.router, prefix="/api")
app.include_router(ijtimoiy_hodimlar.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


# ── Frontend (SPA) serving ───────────────────────────────────────────────────
# Only activated when `backend/static/` exists (i.e. after `npm run build`).
# During development Vite's own dev server handles the frontend.
if STATIC_DIR.is_dir():
    # Vite assets folder (hashed filenames: index-abc123.js, index-abc123.css …)
    _assets = STATIC_DIR / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="vite-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Serve an actual static file if it exists, otherwise return index.html
        so that React Router can handle client-side navigation."""
        # Try exact file first (favicon.ico, robots.txt, manifest.webmanifest …)
        candidate = STATIC_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        # SPA fallback
        return FileResponse(STATIC_DIR / "index.html")
