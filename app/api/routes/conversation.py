"""
對話相關 API 路由
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import json

from app.dao.conversation import conversation_dao
from app.api.dependencies import get_current_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


def rebuild_full_answer(clean_answer: str, sources: List[Dict[str, str]] = None) -> str:
    """重建完整的回答內容，包含 HTML 前綴和引用來源"""
    if not clean_answer:
        return ""
    
    # 加上 HTML 前綴
    full_answer = '<i class="fa-solid fa-robot"> 回覆如下 : </i><BR/><BR/>' + clean_answer
    
    # 加上引用來源
    if sources:
        links = []
        for source in sources:
            if source.get("type") == "md":
                links.append(f'<a href="/md_viewer?file={source["file"]}" target="_blank">{source["file"]}</a>')
            elif source.get("type") == "doc":
                # 從 URL 中提取 kb_id
                url = source.get("url", "")
                if "kb_id=" in url:
                    kb_id = url.split("kb_id=")[1].split("&")[0]
                    links.append(f'<a href="/api/document/file/{source["file"]}?kb_id={kb_id}" target="_blank">{source["file"]}</a>')
                else:
                    links.append(f'<a href="{url}" target="_blank">{source["file"]}</a>')
        
        if links:
            full_answer += "<br><br>引用來源：" + "、".join(links)
    
    return full_answer


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
            formatted_messages = []
            
            for msg in messages:
                # 重建完整的回答內容
                clean_answer = msg["answer"]
                sources = msg.get("sources", [])
                full_answer = rebuild_full_answer(clean_answer, sources)
                
                formatted_messages.append({
                    "q": msg["question"], 
                    "a": full_answer
                })

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