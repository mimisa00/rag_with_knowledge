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

# 啟用 8080 PORT
EXPOSE 8080

#啟動 app/main.py 裡面的 app 實例，綁定在 0.0.0.0:8080 主機
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

