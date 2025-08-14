#!/usr/bin/env python3
"""
資料庫連線測試腳本
"""

import os
import sys
from dbutils.pooled_db import PooledDB
import pymysql
from mysql.connector import Error


def test_database_connection():
    """測試資料庫連線"""
    print("=== 測試資料庫連線 ===")

    try:

        connection = PooledDB(
            creator=pymysql,  # 使用 pymysql 作為資料庫連接的驅動
            maxconnections=10,  # 最大連線數
            mincached=2,  # 最小連線數
            maxcached=5,  # 最大空閒連線數
            blocking=True,  # 是否阻塞直到有空閒連線
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT")),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
        )

        if connection.is_connected():
            print("✅ 資料庫連線成功")

            # 測試查詢
            cursor = connection.cursor()

            # 檢查表是否存在
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print(f"📋 資料庫中的表: {[table[0] for table in tables]}")

            # 檢查配置
            cursor.execute("SELECT COUNT(*) FROM configs")
            config_count = cursor.fetchone()[0]
            print(f"⚙️ 配置數量: {config_count}")

            # 檢查使用者
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            print(f"👥 使用者數量: {user_count}")

            # 檢查對話記錄
            cursor.execute("SELECT COUNT(*) FROM conversations")
            conv_count = cursor.fetchone()[0]
            print(f"💬 對話記錄數量: {conv_count}")

            cursor.close()
            connection.close()
            print("✅ 資料庫測試完成")
            return True

    except Error as e:
        print(f"❌ 資料庫連線失敗: {e}")
        return False


def test_dao_functions():
    """測試 DAO 功能"""
    print("\n=== 測試 DAO 功能 ===")

    try:
        from app.dao import config_dao, conversation_dao, user_dao

        # 測試配置 DAO
        print("📋 測試配置 DAO...")
        configs = config_dao.get_all_configs()
        print(f"✅ 取得配置成功，共 {len(configs)} 項")

        # 測試對話 DAO
        print("💬 測試對話 DAO...")
        conversations = conversation_dao.list_all_conversations()
        print(f"✅ 取得對話列表成功，共 {len(conversations)} 個對話")

        print("✅ DAO 功能測試完成")
        return True

    except Exception as e:
        print(f"❌ DAO 功能測試失敗: {e}")
        return False


def main():
    """主函數"""
    print("🚀 開始資料庫測試...")

    # 設定環境變數（如果沒有設定）
    if not os.getenv("DB_HOST"):
        os.environ["DB_HOST"] = "localhost"
    if not os.getenv("DB_PORT"):
        os.environ["DB_PORT"] = "3306"
    if not os.getenv("DB_NAME"):
        os.environ["DB_NAME"] = "rag_db"
    if not os.getenv("DB_USER"):
        os.environ["DB_USER"] = "rag_user"
    if not os.getenv("DB_PASSWORD"):
        os.environ["DB_PASSWORD"] = "rag_password_2024"

    # 測試資料庫連線
    db_ok = test_database_connection()

    # 測試 DAO 功能
    dao_ok = test_dao_functions()

    if db_ok and dao_ok:
        print("\n🎉 所有測試通過！資料庫系統正常運作。")
        return 0
    else:
        print("\n❌ 測試失敗，請檢查資料庫設定。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
