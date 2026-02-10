"""
Database Administration API - Backups, Restore and Stats
"""

import json
import logging
import os
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.dependencies import get_current_active_user
from backend.models import User, Deadline
from backend.utils.security import verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/database", tags=["Database"])

# Project root: /home/kktapp/kkt-system/backend/api/database.py -> ../../
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKUP_DIR = PROJECT_ROOT / "backups" / "database"
METADATA_FILE = BACKUP_DIR / "backup_metadata.json"

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB


def ensure_backup_dir():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def load_metadata() -> dict:
    if METADATA_FILE.exists():
        try:
            return json.loads(METADATA_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_metadata(metadata: dict):
    METADATA_FILE.write_text(json.dumps(metadata, indent=2, default=str))


def run_pg_dump(filepath: Path) -> None:
    """Run pg_dump to create a backup file."""
    pg_env = os.environ.copy()
    pg_env["PGPASSWORD"] = settings.db_password
    cmd = [
        "pg_dump",
        "-h", settings.db_host,
        "-p", str(settings.db_port),
        "-U", settings.db_user,
        "-d", settings.db_name,
        "--no-owner",
        "--no-acl",
        "-f", str(filepath),
    ]
    result = subprocess.run(cmd, env=pg_env, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"pg_dump failed: {result.stderr[:500]}")


class BackupRequest(BaseModel):
    description: str = ""


class RestoreRequest(BaseModel):
    filename: str
    password: str


class BackupInfo(BaseModel):
    filename: str
    size_bytes: int
    size_mb: float
    created_at: str | None = None
    created_by: str | None = None
    description: str | None = None


class BackupListResponse(BaseModel):
    backups: list[BackupInfo]
    total_count: int
    total_size_mb: float


class StatsResponse(BaseModel):
    total_users: int
    total_deadlines: int
    database_size_mb: float
    total_cash_registers: int


@router.get("/backups", response_model=BackupListResponse, summary="List backups")
async def list_backups(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    ensure_backup_dir()
    metadata = load_metadata()

    backups: list[BackupInfo] = []
    total_size = 0

    for f in sorted(BACKUP_DIR.glob("*.sql"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = f.stat()
        size_bytes = stat.st_size
        total_size += size_bytes

        meta = metadata.get(f.name, {})
        backups.append(BackupInfo(
            filename=f.name,
            size_bytes=size_bytes,
            size_mb=round(size_bytes / (1024 * 1024), 3),
            created_at=meta.get("created_at") or datetime.fromtimestamp(stat.st_mtime).isoformat(),
            created_by=meta.get("created_by"),
            description=meta.get("description"),
        ))

    return BackupListResponse(
        backups=backups,
        total_count=len(backups),
        total_size_mb=round(total_size / (1024 * 1024), 2),
    )


@router.post("/backup", summary="Create backup")
async def create_backup(
    body: BackupRequest = BackupRequest(),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    ensure_backup_dir()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"kkt_backup_{timestamp}.sql"
    filepath = BACKUP_DIR / filename

    try:
        run_pg_dump(filepath)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Backup timed out (120s)")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="pg_dump not found")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    size_bytes = filepath.stat().st_size

    metadata = load_metadata()
    metadata[filename] = {
        "created_at": datetime.now().isoformat(),
        "size_bytes": size_bytes,
        "created_by": current_user.email,
        "description": body.description,
    }
    save_metadata(metadata)

    return {
        "message": "Бэкап успешно создан",
        "filename": filename,
        "size_mb": round(size_bytes / (1024 * 1024), 3),
    }


@router.post("/upload", summary="Upload backup file")
async def upload_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    if not file.filename or not file.filename.endswith(".sql"):
        raise HTTPException(status_code=400, detail="Допустимы только .sql файлы")

    ensure_backup_dir()

    # Read content with size check
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 100 MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Файл пустой")

    # Sanitize filename
    safe_name = file.filename.replace("/", "_").replace("\\", "_").replace("..", "_")
    # Avoid overwriting existing files
    target = BACKUP_DIR / safe_name
    if target.exists():
        base = safe_name.rsplit(".", 1)[0]
        timestamp = datetime.now().strftime("%H%M%S")
        safe_name = f"{base}_{timestamp}.sql"
        target = BACKUP_DIR / safe_name

    target.write_bytes(content)

    metadata = load_metadata()
    metadata[safe_name] = {
        "created_at": datetime.now().isoformat(),
        "size_bytes": len(content),
        "created_by": current_user.email,
        "description": f"Загружен: {file.filename}",
    }
    save_metadata(metadata)

    return {
        "message": "Файл успешно загружен",
        "filename": safe_name,
        "size_mb": round(len(content) / (1024 * 1024), 3),
    }


@router.post("/restore", summary="Restore database from backup")
async def restore_backup(
    body: RestoreRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # Only admins can restore
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может восстанавливать базу данных")

    # Verify password
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=403, detail="Неверный пароль")

    # Validate filename
    if "/" in body.filename or "\\" in body.filename or ".." in body.filename:
        raise HTTPException(status_code=400, detail="Некорректное имя файла")

    filepath = BACKUP_DIR / body.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Файл бэкапа не найден")

    ensure_backup_dir()

    # Step 1: Create safety backup before restore
    safety_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safety_filename = f"kkt_pre_restore_{safety_timestamp}.sql"
    safety_filepath = BACKUP_DIR / safety_filename

    try:
        run_pg_dump(safety_filepath)
        logger.info(f"Pre-restore safety backup created: {safety_filename}")
    except Exception as e:
        logger.error(f"Failed to create safety backup: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Не удалось создать страховочный бэкап: {str(e)[:200]}",
        )

    safety_size = safety_filepath.stat().st_size
    metadata = load_metadata()
    metadata[safety_filename] = {
        "created_at": datetime.now().isoformat(),
        "size_bytes": safety_size,
        "created_by": "system",
        "description": f"Автобэкап перед восстановлением из {body.filename}",
    }
    save_metadata(metadata)

    # Step 2: Drop all tables, then restore
    pg_env = os.environ.copy()
    pg_env["PGPASSWORD"] = settings.db_password

    # Drop all tables in public schema
    drop_cmd = [
        "psql",
        "-h", settings.db_host,
        "-p", str(settings.db_port),
        "-U", settings.db_user,
        "-d", settings.db_name,
        "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;",
    ]

    try:
        result = subprocess.run(drop_cmd, env=pg_env, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            logger.error(f"Drop schema failed: {result.stderr}")
            raise HTTPException(
                status_code=500,
                detail=f"Ошибка очистки БД: {result.stderr[:300]}. Страховочный бэкап: {safety_filename}",
            )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail=f"Таймаут очистки БД. Страховочный бэкап: {safety_filename}")

    # Restore from backup file
    restore_cmd = [
        "psql",
        "-h", settings.db_host,
        "-p", str(settings.db_port),
        "-U", settings.db_user,
        "-d", settings.db_name,
        "-f", str(filepath),
    ]

    try:
        result = subprocess.run(restore_cmd, env=pg_env, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            # Non-zero exit but might have warnings, check stderr for real errors
            errors = [line for line in result.stderr.splitlines() if "ERROR" in line]
            if errors:
                logger.error(f"Restore had errors: {result.stderr[:500]}")
                return {
                    "message": f"Восстановление завершено с ошибками. Страховочный бэкап: {safety_filename}",
                    "errors": errors[:10],
                    "safety_backup": safety_filename,
                    "status": "partial",
                }
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail=f"Таймаут восстановления. Страховочный бэкап: {safety_filename}",
        )

    logger.info(f"Database restored from {body.filename} by {current_user.email}")

    return {
        "message": f"База данных успешно восстановлена из {body.filename}",
        "safety_backup": safety_filename,
        "status": "success",
    }


@router.get("/stats", response_model=StatsResponse, summary="Database stats")
async def get_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    total_users = db.execute(text("SELECT count(*) FROM users WHERE role = 'client'")).scalar() or 0
    total_deadlines = db.execute(text("SELECT count(*) FROM deadlines")).scalar() or 0
    total_cash_registers = db.execute(text("SELECT count(*) FROM cash_registers")).scalar() or 0

    try:
        size_result = db.execute(text("SELECT pg_database_size(current_database())")).scalar()
        db_size_mb = round((size_result or 0) / (1024 * 1024), 2)
    except Exception:
        db_size_mb = 0.0

    return StatsResponse(
        total_users=total_users,
        total_deadlines=total_deadlines,
        database_size_mb=db_size_mb,
        total_cash_registers=total_cash_registers,
    )


@router.get("/backups/{filename}", summary="Download backup")
async def download_backup(
    filename: str,
    current_user: User = Depends(get_current_active_user),
):
    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    return FileResponse(
        path=str(filepath),
        filename=filename,
        media_type="application/sql",
    )
