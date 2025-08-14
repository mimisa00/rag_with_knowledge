"""
對話相關 API 路由
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List

from app.dao.conversation import conversation_dao
from app.api.dependencies import get_current_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/conversations")
def get_user_conversations(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取用戶的對話記錄"""
    try:
        conversations = conversation_dao.list_all_conversations(current_user["id"])
        res = []
        
        for conv in conversations:
            conv_id = conv["id"]
            messages = conversation_dao.get_conversations_by_conv_id(conv_id)
            formatted_messages = [
                {"q": msg["question"], "a": msg["answer"]} for msg in messages
            ]

            res.append(
                {
                    "id": conv_id,
                    "title": conv["title"],
                    "messages": formatted_messages,
                    "first_message_time": conv["first_message_time"],
                    "last_message_time": conv["last_message_time"],
                    "message_count": conv["message_count"],
                }
            )
        return res
    except Exception as e:
        logger.error(f"取得對話記錄失敗: {e}")
        return []


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: str, 
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """刪除對話記錄"""
    try:
        success = conversation_dao.delete_conversation(conv_id, current_user["id"])
        if success:
            return {"message": "deleted"}
        else:
            raise HTTPException(status_code=404, detail="對話不存在")
    except Exception as e:
        logger.error(f"刪除對話記錄失敗: {e}")
        raise HTTPException(status_code=500, detail="刪除對話記錄失敗")