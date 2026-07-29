FROM python:3.10-slim

WORKDIR /backend

COPY test_db_connection.py ./
# LLM 所需 Python LIB
COPY requirements.txt ./
#RUN pip install --no-cache-dir -r requirements.txt
RUN  pip install --upgrade pip
RUN pip install -r requirements.txt

# 創建必要的目錄
RUN mkdir -p /backend/logs /backend/models /backend/conversations /backend/documents/markdown /backend/frontend /backend/app     

# Docling 異常修復
# 補上系統層級的 OpenGL / GLib 函式庫
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# 裝完 docling 之後,強制把 opencv 換成 headless 版
# 務必放在所有 pip install 的「最後面」,確保它是最終生效的版本
RUN pip uninstall -y opencv-python opencv-python-headless && \
    pip install --no-cache-dir opencv-python-headless

# 啟用 8080 PORT
EXPOSE 8080

#啟動 app/main.py 裡面的 app 實例，綁定在 0.0.0.0:8080 主機
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

