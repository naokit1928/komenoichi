# app_v2/db/core.py
import os
import sqlite3
from pathlib import Path
from typing import Generator

def resolve_db_path() -> Path:
    """
    SQLite データベースファイルの絶対パスを解決して返す。
    環境変数 DB_PATH が設定されていればそれを使い、なければカレントディレクトリの app.db を使う。
    """
    return Path(os.getenv("DB_PATH", "app.db")).resolve()

def get_db_conn() -> Generator[sqlite3.Connection, None, None]:
    """
    FastAPI の Depends で使用するデータベース接続ジェネレータ。
    
    サイクル:
    1. リクエスト開始時に接続を開く
    2. row_factory を設定 (カラム名でアクセス可能にする)
    3. WALモード等の並行処理用PRAGMAを設定
    4. 呼び出し元へ yield
    5. 正常終了時は commit
    6. エラー発生時は rollback
    7. 最後に必ず close
    """
    db_path = resolve_db_path()
    
    # 変更点1: timeoutとcheck_same_threadの設定
    conn = sqlite3.connect(
        db_path,
        timeout=5.0,               # ロック解除を最大5秒待機する (busy_timeout)
        check_same_thread=False    # FastAPIのバックグラウンドタスク等でのスレッドまたぎを許可
    )
    conn.row_factory = sqlite3.Row
    
    # 変更点2: WALモードとパフォーマンスチューニング
    # (毎回実行しても非常に軽量で安全です)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()