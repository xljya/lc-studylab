"""
SQLite 持久化层

为当前演示项目提供最小但完整的数据库能力：
1. 用户注册与登录信息存储
2. AI 面试准备包持久化
3. 按用户维度的数据隔离
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Optional

from config import get_logger, settings

logger = get_logger(__name__)


def _resolve_database_path() -> Path:
    configured = Path(settings.database_path)
    if configured.is_absolute():
        return configured

    backend_dir = Path(__file__).resolve().parents[1]
    return backend_dir / configured


DATABASE_PATH = _resolve_database_path()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS interview_kits (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                candidate_name TEXT,
                target_role TEXT NOT NULL,
                company_name TEXT,
                resume_text TEXT NOT NULL,
                job_description TEXT NOT NULL,
                focus_areas_json TEXT NOT NULL,
                role_fit_score INTEGER NOT NULL,
                summary TEXT NOT NULL,
                strengths_json TEXT NOT NULL,
                risks_json TEXT NOT NULL,
                focus_points_json TEXT NOT NULL,
                self_intro TEXT NOT NULL,
                project_story TEXT NOT NULL,
                likely_questions_json TEXT NOT NULL,
                prep_plan_json TEXT NOT NULL,
                suggested_followups_json TEXT NOT NULL,
                metrics_json TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email);

            CREATE INDEX IF NOT EXISTS idx_interview_kits_user_created_at
            ON interview_kits(user_id, created_at DESC);
            """
        )

    logger.info(f"🗄️ 数据库初始化完成: {DATABASE_PATH}")


def _decode_json_field(value: Optional[str], fallback: Any) -> Any:
    if not value:
        return fallback

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _kit_row_to_record(row: sqlite3.Row) -> dict[str, Any]:
    record = dict(row)
    record["focus_areas"] = _decode_json_field(record.pop("focus_areas_json", "[]"), [])
    record["strengths"] = _decode_json_field(record.pop("strengths_json", "[]"), [])
    record["risks"] = _decode_json_field(record.pop("risks_json", "[]"), [])
    record["focus_points"] = _decode_json_field(record.pop("focus_points_json", "[]"), [])
    record["likely_questions"] = _decode_json_field(record.pop("likely_questions_json", "[]"), [])
    record["prep_plan"] = _decode_json_field(record.pop("prep_plan_json", "[]"), [])
    record["suggested_followups"] = _decode_json_field(
        record.pop("suggested_followups_json", "[]"),
        [],
    )
    record["metrics"] = _decode_json_field(record.pop("metrics_json", None), None)
    return record


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, password_hash, display_name, created_at, updated_at
            FROM users
            WHERE email = ?
            """,
            (email,),
        ).fetchone()

    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, password_hash, display_name, created_at, updated_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    return dict(row) if row else None


def create_user(
    *,
    user_id: str,
    email: str,
    password_hash: str,
    display_name: Optional[str],
) -> dict[str, Any]:
    now = utc_now_iso()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, email, password_hash, display_name, now, now),
        )

    user = get_user_by_id(user_id)
    if user is None:
        raise RuntimeError("用户创建后未能读取到记录")
    return user


def list_interview_kits_for_user(user_id: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM interview_kits
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [_kit_row_to_record(row) for row in rows]


def get_interview_kit_for_user(user_id: str, kit_id: str) -> Optional[dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM interview_kits
            WHERE id = ? AND user_id = ?
            """,
            (kit_id, user_id),
        ).fetchone()

    return _kit_row_to_record(row) if row else None


def create_interview_kit_for_user(user_id: str, kit: dict[str, Any]) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO interview_kits (
                id,
                user_id,
                created_at,
                candidate_name,
                target_role,
                company_name,
                resume_text,
                job_description,
                focus_areas_json,
                role_fit_score,
                summary,
                strengths_json,
                risks_json,
                focus_points_json,
                self_intro,
                project_story,
                likely_questions_json,
                prep_plan_json,
                suggested_followups_json,
                metrics_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kit["id"],
                user_id,
                kit["created_at"],
                kit.get("candidate_name"),
                kit["target_role"],
                kit.get("company_name"),
                kit["resume_text"],
                kit["job_description"],
                json.dumps(kit.get("focus_areas", []), ensure_ascii=False),
                kit["role_fit_score"],
                kit["summary"],
                json.dumps(kit.get("strengths", []), ensure_ascii=False),
                json.dumps(kit.get("risks", []), ensure_ascii=False),
                json.dumps(kit.get("focus_points", []), ensure_ascii=False),
                kit["self_intro"],
                kit["project_story"],
                json.dumps(kit.get("likely_questions", []), ensure_ascii=False),
                json.dumps(kit.get("prep_plan", []), ensure_ascii=False),
                json.dumps(kit.get("suggested_followups", []), ensure_ascii=False),
                json.dumps(kit.get("metrics"), ensure_ascii=False)
                if kit.get("metrics") is not None
                else None,
            ),
        )


def delete_interview_kit_for_user(user_id: str, kit_id: str) -> bool:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            DELETE FROM interview_kits
            WHERE id = ? AND user_id = ?
            """,
            (kit_id, user_id),
        )

    return cursor.rowcount > 0
