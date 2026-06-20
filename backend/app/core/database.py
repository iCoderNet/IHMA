from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=False,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Incremental migrations (idempotent — safe to run on every startup)
        await _run_migrations(conn)


async def _run_migrations(conn):
    """Apply schema changes that create_all misses (ALTER TABLE on existing tables)."""
    from sqlalchemy import text

    migrations = [
        # bolim_id FK on sections table
        (
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sections' AND COLUMN_NAME='bolim_id'",
            "ALTER TABLE sections ADD COLUMN bolim_id INT NULL, "
            "ADD CONSTRAINT fk_sections_bolim FOREIGN KEY (bolim_id) "
            "REFERENCES bolimlar(id) ON DELETE SET NULL",
        ),
        # period_year on section_rows
        (
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='section_rows' AND COLUMN_NAME='period_year'",
            "ALTER TABLE section_rows ADD COLUMN period_year INT NULL, "
            "ADD COLUMN period_month INT NULL",
        ),
        # mfy_name on section_rows
        (
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='section_rows' AND COLUMN_NAME='mfy_name'",
            "ALTER TABLE section_rows ADD COLUMN mfy_name VARCHAR(255) NULL",
        ),
    ]

    for check_sql, alter_sql in migrations:
        result = await conn.execute(text(check_sql))
        count = result.scalar()
        if not count:
            await conn.execute(text(alter_sql))
            print(f"✅ Migration applied: {alter_sql[:60]}…")
