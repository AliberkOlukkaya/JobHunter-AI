import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def database_url() -> str:
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "jobhunter")
    user = os.getenv("POSTGRES_USER", "jobhunter")
    password = os.getenv("POSTGRES_PASSWORD", "")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"


class Base(DeclarativeBase):
    pass


engine = create_engine(database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
