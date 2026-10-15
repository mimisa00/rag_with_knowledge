# RAG (Retrieval-Augmented Generation) System

## This project implements an enhanced retrieval system by Claude Code that supports multiple LLM platforms. Features include:
- **Account Management**: Simple user registration and login
- **File Upload and Extraction**: Upload files and extract their content
- **Index Building**: Build the data indexes required for semantic retrieval
- **Admin Parameter Tuning**: Adjust the parameters the system needs to run
- **Multi-LLM Provider Support**: Ollama, OpenAI, Anthropic, Vertex AI

## Quick View
<img width="500" alt="580768214-c731f5f6-96fc-456d-b55d-257c7c9c5c45" src="https://github.com/user-attachments/assets/b1716ef8-78c3-41c8-9a48-fad9599f1666" />


## Supported LLM Providers
- **Ollama** (default) - Run models locally
- **OpenAI** - GPT-4, GPT-3.5, and other models
- **Anthropic** - Claude 4 models
- **Vertex AI** - Anthropic Claude models on Google Cloud ([Setup Guide](docs/vertex-ai-setup.md))

We welcome your feedback! Feel free to leave a comment or contact us by email.


## Project Structure

```
rag/
├── app/                      # Python application
│   ├── main.py               # FastAPI application entry point
│   ├── config/               # Configuration management
│   │   ├── settings.py       # Application settings
│   │   ├── database.py       # Database configuration
│   │   └── paths.py          # Path configuration
│   ├── api/                  # API routing layer
│   │   └── routes/           # Route definitions
│   ├── core/                 # Core business logic
│   │   ├── security/         # Security
│   │   ├── rag/              # RAG functionality
│   │   └── document/         # Document processing
│   ├── dao/                  # Data access layer
│   ├── models/               # Data models
│   ├── services/             # Business service layer
│   ├── utils/                # Utility functions
│   └── tests/                # Unit tests
├── backend/                  # Backend configuration
│   ├── Dockerfile            # Container configuration
│   ├── requirements.txt      # Python dependencies
│   └── test_db_connection.py # DB connection test at startup
├── documents/                # Location for documents to be indexed
├── faiss_data/               # Vector database storage
├── frontend/                 # Frontend directory
│   └── static/               # Static files (HTML, CSS, JS)
├── init-db/                  # DB initialization files
├── logs/                     # Log files
├── mariadb_data/             # Database storage
├── models/                   # Model storage
├── ollama/                   # Ollama cache
├── ollama_modelfile/         # Custom Ollama Modelfiles
├── docker-compose.yml        # Docker service configuration
├── env.example               # Example environment variables
├── README.md                 # Documentation
├── startup.ps1.sh            # Startup script for Windows
└── startup.sh                # Startup script for Linux
```

## Quick Start

### Prerequisites
- Docker
- Git
- At least 8GB RAM
- NVIDIA GPU (optional, for acceleration)

### 1. Clone the Repository

```bash
git clone https://github.com/mimisa00/rag_with_knowledge.git
cd rag_with_knowledge
```

### 2. Environment Setup

#### Linux/macOS:
```bash
chmod +x startup.sh
./startup.sh
```

### 3. Access the System
- Main interface: http://localhost:8080/login


## Local Development Setup
```
# The following steps must be performed manually:
1. Install and start Ollama
2. Install MariaDB v10.11 and create a DB account (credentials must match env.example)
3. Initialize the database: run all SQL files under init-db
4. Create environment variables: copy env.example to .env and place it in the project directory
5. Create working directories: documents faiss_data logs models
6. Upgrade pip: pip install --upgrade pip
7. Install Python libraries: pip install -r requirements.txt
8. Start FastAPI: uvicorn app.main:app --host 127.0.0.1 --port 8080
```
