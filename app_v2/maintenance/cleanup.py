import sqlite3
import logging
from app_v2.db.core import resolve_db_path

# uvicornのロガーを使うとログが見やすい
logger = logging.getLogger("uvicorn")

def run_pending_gc(retention_days: int = 1) -> int:
    """
    指定された日数（デフォルト1日）以上経過した PENDING 予約を物理削除する。
    
    条件:
    - status = 'PENDING'
    - created_at < 現在時刻 - 指定日数
    """
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    deleted_count = 0
    
    try:
        # SQLite の datetime('now') は UTC。
        # アプリ側の created_at も UTC (datetime.utcnow) なので比較は正確。
        sql = f"""
            DELETE FROM reservations 
            WHERE status = 'PENDING' 
              AND created_at < datetime('now', '-{retention_days} days')
        """
        
        cur = conn.execute(sql)
        deleted_count = cur.rowcount
        conn.commit()
        
        if deleted_count > 0:
            logger.info(f"🧹 [GC] Cleaned up {deleted_count} expired PENDING reservations (older than {retention_days} days).")
        else:
            logger.info(f"✨ [GC] No expired PENDING reservations found.")
            
    except Exception as e:
        logger.error(f"⚠️ [GC] Failed to clean up pending reservations: {e}")
    finally:
        conn.close()
    
    return deleted_count