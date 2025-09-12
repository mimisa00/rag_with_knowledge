"""
查詢相關 API 路由
"""
import json
import time
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Generator, Optional

from app.models.request import QueryRequest
from app.core.rag.indexing import search_similar_chunks, load_kb_index
from app.core.rag.reranking import rerank_with_bge
from app.core.rag.ollama_client import (
    get_ollama_client,
    get_model_options,
    test_connection
)
from app.dao.conversation import conversation_dao
from app.dao.knowledge_base import knowledge_base_dao
from app.dao.llm_request import llm_request_dao
from app.config.settings import app_config
from app.api.dependencies import get_current_user
from app.core.security.permissions import permission_required
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

def build_context_from_chunks(chunks: List[Dict[str, Any]], kb: Dict[str, Any]) -> str:
    """從文本塊建立上下文"""
    context_parts = []
    
    # 加入知識庫的系統提示
    if kb and kb.get("system_prompt"):
        context_parts.append(f"系統提示：{kb['system_prompt']}\n")
    
    # 加入檢索到的相關內容
    context_parts.append("以下是相關的背景資訊：\n")
    
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("source_file", "未知來源")
        content = chunk.get("content", "").strip()
        
        if content:
            context_parts.append(f"資料 {i} (來源：{source})：\n{content}\n")
    
    return "\n".join(context_parts)

@router.post("/query")
@permission_required("USER.QUERY")
def query_knowledge_base(
    query_data: QueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """問答功能 - 按照原始 app.py 的實作方式"""
    # 檢查請求限制
    config = app_config.all
    user_limit = int(config.get("llm_req_limit_user", 1))
    total_limit = int(config.get("llm_req_limit_total", 3))
    
    if llm_request_dao.get_total_active_request_count() >= total_limit:
        return StreamingResponse(
            "# 系統忙碌，請稍後再試", media_type="application/json"
        )
    if llm_request_dao.get_user_active_request_count(current_user["id"]) >= user_limit:
        return StreamingResponse("# 仍在處理上次的請求", media_type="application/json")
    
    req_id = llm_request_dao.add_user_request(
        current_user["id"],
        query_data.conv_id,
        query_data.question,
    )
    start_time = time.time()
    
    try:
        # 檢查知識庫
        kb_system_prompt = None
        if query_data.kb_id:
            kb = knowledge_base_dao.get_knowledge_base(query_data.kb_id)
            if not kb:
                raise HTTPException(status_code=404, detail="知識庫不存在")
            if kb["status"] != "enable":
                raise HTTPException(status_code=400, detail="知識庫已停用")
            
            # 載入知識庫索引
            load_kb_index(query_data.kb_id)
            kb_system_prompt = kb["system_prompt"]
            logger.info(f"使用知識庫: {query_data.kb_id} ({kb['name']})")
        
        # 檢查索引是否存在（這裡需要從 indexing 模組獲取）
        try:
            similar_chunks = search_similar_chunks(
                query_data.question, 
                k=int(config.get("idx_result_count", 20)),
                kb_id=query_data.kb_id
            )
        except ValueError as e:
            error_msg = f"知識庫 {query_data.kb_id or '預設'} 尚未建立索引，請先分析文件"
            logger.error(error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        if not similar_chunks:
            error_msg = f"知識庫 {query_data.kb_id or '預設'} 尚未建立索引，請先分析文件"
            logger.error(error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 重排序
        try:
            from app.core.rag.reranking import rerank_with_bge
            candidate_texts = [chunk["content"] for chunk in similar_chunks]
            top_passages = rerank_with_bge(
                query_data.question,
                candidate_texts,
                int(config.get("rerank_top_k_final", 16))
            )
        except Exception as e:
            logger.warning(f"重排序失敗，使用原始結果: {e}")
            top_passages = [chunk["content"] for chunk in similar_chunks[:int(config.get("rerank_top_k_final", 16))]]
        
        # 建立上下文
        passage_to_chunk = {c["content"]: c for c in similar_chunks}
        md_files = set()
        src_files = set()
        chunk_context = ""
        for passage in top_passages:
            chunk = passage_to_chunk.get(passage)
            if chunk:
                markdown_file = chunk.get("markdown_file", "")
                source_file = chunk.get("source_file", "")
                if markdown_file:  # 只添加非空的檔案名
                    md_files.add(markdown_file)
                if source_file:  # 只添加非空的檔案名
                    src_files.add(source_file)
                chunk_context += chunk["content"]
        
        context = chunk_context
        
        # 載入對話歷史
        conversation_history = []
        if query_data.conv_id and kb:
            # 從知識庫設定讀取歷史筆數限制
            history_limit = kb.get("conversation_history_limit", 0)
            
            if history_limit > 0:
                history_records = conversation_dao.get_conversations_by_conv_id(query_data.conv_id)
                # 取最近 N 筆對話，只載入純淨的回答內容
                for record in history_records[-history_limit:]:
                    clean_answer = record["answer"]
                    # 移除 HTML 前綴標籤（如果存在舊資料）
                    if clean_answer.startswith('<i class="fa-solid fa-robot"> 回覆如下 : </i><BR/><BR/>'):
                        clean_answer = clean_answer.replace('<i class="fa-solid fa-robot"> 回覆如下 : </i><BR/><BR/>', '', 1)
                    
                    # 移除引用來源連結（如果存在舊資料）
                    if '\n\n引用來源：' in clean_answer:
                        clean_answer = clean_answer.split('\n\n引用來源：')[0]
                    
                    conversation_history.extend([
                        {"role": "user", "content": record["question"]},
                        {"role": "assistant", "content": clean_answer.strip()}
                    ])
                logger.info(f"載入 {len(conversation_history)//2} 筆歷史對話（知識庫 {kb['name']} 限制 {history_limit} 筆）")

        # 加入當前系統時間
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        time_context = f"當前時間：{current_time}\n\n"

        # 使用知識庫特定的 system_prompt，如果沒有則使用預設的
        prompt_template = (
            kb_system_prompt if kb_system_prompt else config.get("system_prompt", "")
        )
        
        system_prompt = (
            time_context + 
            prompt_template.replace("{context}", context)
            .replace("{question}", query_data.question)
            .replace("{keyword}", query_data.keyword or "")
        )
        
        # 建構完整的 messages
        messages = [
            {"role": "system", "content": system_prompt},
            *conversation_history,  # 插入歷史對話
            {"role": "user", "content": query_data.question},
        ]
        
        # 提前初始化 Ollama 客戶端和模型選項
        logger.info("初始化 Ollama 客戶端")
        client = get_ollama_client()
        model_options = get_model_options()
        model_name = config.get("llm_model", "gemma2:9b")
        
        def stream_generator():
            try:
                # 前端顯示用的完整回答（包含HTML標籤）
                full_display_answer = '<i class="fa-solid fa-robot"> 回覆如下 : </i><BR/><BR/>'
                # 純淨的 LLM 回答內容（用於儲存和歷史對話）
                clean_answer = ""
                
                yield json.dumps(
                    {"prompt": system_prompt, "answer": "", "thinking": ""}
                ) + "\n"
                
                logger.info("開始呼叫 Ollama LLM")
                stream = client.chat(
                    model=model_name,
                    messages=messages,
                    think=query_data.think,
                    stream=True,
                    options=model_options,
                )
                
                # 等待第一個回應再傳送 HTML 前綴
                first_response = True
                logger.info("開始處理 LLM 串流回應")
                
                for chunk in stream:
                    if chunk and getattr(chunk, "message", None):
                        # 第一個回應時，先傳送 HTML 前綴
                        if first_response:
                            logger.info("收到 LLM 第一個回應，傳送前綴")
                            yield json.dumps(
                                {"content": '<i class="fa-solid fa-robot"> 回覆如下 : </i><BR/><BR/>'}
                            ) + "\n"
                            first_response = False
                        
                        content = chunk.message.content
                        full_display_answer += content
                        clean_answer += content
                        yield json.dumps(
                            {
                                "content": content,
                                "thinking": chunk.message.thinking or "",
                            }
                        ) + "\n"
                
                # 處理引用來源
                sources_list = []
                logger.info(f"處理引用來源 - src_files: {src_files}")
                if src_files:
                    links = []
                    for src in src_files:
                        if src and src.lower().endswith(".md"):
                            link = f'<a href="/md_viewer?file={src}" target="_blank">{src}</a>'
                            links.append(link)
                            sources_list.append({"file": src, "type": "md", "url": f"/md_viewer?file={src}"})
                        elif src:
                            link = f'<a href="/api/document/file/{src}?kb_id={query_data.kb_id}" target="_blank">{src}</a>'
                            links.append(link)
                            sources_list.append({"file": src, "type": "doc", "url": f"/api/document/file/{src}?kb_id={query_data.kb_id}"})
                    
                    logger.info(f"產生的引用連結: {links}")
                    if links:
                        source_content = "<br><br>引用來源：" + "、".join(links)
                        full_display_answer += source_content
                        logger.info(f"傳送引用來源內容，長度: {len(source_content)}")
                        yield json.dumps({"content": source_content}) + "\n"
                else:
                    logger.info("沒有找到 src_files")
                
                # 儲存對話記錄 - 分別儲存純淨內容和引用來源
                try:
                    from app.dao.conversation import conversation_dao
                    conversation_dao.store_conversation(
                        query_data.conv_id, 
                        query_data.question, 
                        clean_answer,  # 儲存純淨內容
                        current_user["id"],
                        sources_list  # 儲存引用來源資訊
                    )
                except Exception as e:
                    logger.error(f"儲存對話記錄失敗: {e}")
                
            except Exception as e:
                logger.error(f"問答流程失敗: {e}")
                yield json.dumps({"error": "系統錯誤，請稍後再試"}) + "\n"
            finally:
                logger.debug("finally")
        
        return StreamingResponse(stream_generator(), media_type="application/json")
        
    except Exception as ex:
        logger.error(f"問答失敗: {ex}")
        return StreamingResponse(
            iter([json.dumps({"error": "系統錯誤，請稍後再試"})]), 
            media_type="application/json"
        )
    finally:
        response_time = time.time() - start_time
        llm_request_dao.mark_request_completed(req_id, response_time=response_time)



@router.post("/query/noun/analysis") 
def noun_analysis_endpoint(
    query_data: QueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """名詞分析功能 - 按照原始 app.py 的實作方式"""
    # 檢查請求限制
    config = app_config.all
    user_limit = int(config.get("llm_req_limit_user", 1))
    total_limit = int(config.get("llm_req_limit_total", 3))
    
    if llm_request_dao.get_total_active_request_count() >= total_limit:
        return StreamingResponse(
            "# 系統忙碌，請稍後再試", media_type="application/json"
        )
    if llm_request_dao.get_user_active_request_count(current_user["id"]) >= user_limit:
        return StreamingResponse("# 仍在處理上次的請求", media_type="application/json")
    
    req_id = llm_request_dao.add_user_request(
        current_user["id"],
        query_data.conv_id,
        query_data.question,
    )
    start_time = time.time()
    
    try:
        config = app_config.all
        prompt = config.get("noun_analysis_prompt", "{question}").replace("{question}", query_data.question)
        
        # Prepare messages for ollama_client.chat
        messages = [{"role": "user", "content": prompt}]
        
        def stream_generator():
            try:
                client = get_ollama_client()
                stream = client.chat(
                    model=config.get("llm_model", "gemma2:9b"),
                    messages=messages,
                    think=False,
                    stream=True,
                    options=get_model_options(),
                )

                for chunk in stream:
                    if chunk and getattr(chunk, "message", None):
                        yield chunk.message.content

            except Exception as e:
                logger.error(f"名詞分析失敗: {e}")
                yield f"# 分析失敗: {str(e)}"
            finally:
                logger.debug("finally")
                
        return StreamingResponse(stream_generator(), media_type="application/json")
        
    except Exception as ex:
        logger.error(f"名詞分析失敗: {ex}")
        return StreamingResponse(
            iter(["# 系統錯誤，請稍後再試"]), 
            media_type="application/json"
        )
    finally:
        response_time = time.time() - start_time
        llm_request_dao.mark_request_completed(req_id, response_time=response_time)
