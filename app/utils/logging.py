import os
import sys
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import Optional


class FlushingStreamHandler(logging.StreamHandler):
    """自定義控制台處理器，支援 flush 功能以確保即時輸出"""
    
    def emit(self, record):
        try:
            msg = self.format(record)
            stream = self.stream
            stream.write(msg + self.terminator)
            stream.flush()
        except Exception:
            self.handleError(record)


class CustomFormatter(logging.Formatter):
    """自定義格式化器，提供彩色輸出和統一格式"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # 青色
        'INFO': '\033[32m',     # 綠色
        'WARNING': '\033[33m',  # 黃色
        'ERROR': '\033[31m',    # 紅色
        'CRITICAL': '\033[35m', # 紫色
        'RESET': '\033[0m'      # 重置
    }
    
    def __init__(self, use_color: bool = True):
        self.use_color = use_color
        fmt = '%(asctime)s [%(levelname)s] %(name)s:%(lineno)d - %(message)s'
        super().__init__(fmt, datefmt='%Y-%m-%d %H:%M:%S')
    
    def format(self, record):
        formatted = super().format(record)
        
        if self.use_color and hasattr(sys.stderr, 'isatty') and sys.stderr.isatty():
            level_color = self.COLORS.get(record.levelname, '')
            reset_color = self.COLORS['RESET']
            formatted = f"{level_color}{formatted}{reset_color}"
        
        return formatted


class LoggerManager:
    """Logger 管理器，提供統一的日誌配置"""
    
    def __init__(self):
        self.log_dir = self._get_log_directory()
        self.log_level = self._get_log_level()
        self._configured = False
    
    def _get_log_directory(self) -> str:
        """獲取日誌目錄"""
        if os.path.exists('/backend'):
            default_log_dir = '/backend/logs'
        else:
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            default_log_dir = os.path.join(current_dir, 'logs')
        
        log_dir = os.getenv('LOG_DIR', default_log_dir)
        os.makedirs(log_dir, exist_ok=True)
        return log_dir
    
    def _get_log_level(self) -> int:
        """獲取日誌級別"""
        level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
        return getattr(logging, level_str, logging.INFO)
    
    def configure_root_logger(self) -> None:
        """配置根 logger"""
        if self._configured:
            return
        
        root_logger = logging.getLogger()
        root_logger.setLevel(self.log_level)
        root_logger.handlers.clear()
        
        # 控制台處理器
        console_handler = FlushingStreamHandler(sys.stdout)
        console_handler.setLevel(self.log_level)
        console_formatter = CustomFormatter(use_color=True)
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)
        
        # 檔案處理器
        log_file = os.path.join(self.log_dir, 'app.log')
        file_handler = RotatingFileHandler(
            log_file, 
            maxBytes=10*1024*1024,
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_formatter = CustomFormatter(use_color=False)
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
        
        # 錯誤日誌檔案處理器
        error_log_file = os.path.join(self.log_dir, 'error.log')
        error_handler = RotatingFileHandler(
            error_log_file,
            maxBytes=10*1024*1024,
            backupCount=5,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        root_logger.addHandler(error_handler)
        
        self._configured = True
    
    def get_logger(self, name: str) -> logging.Logger:
        """獲取指定名稱的 logger"""
        if not self._configured:
            self.configure_root_logger()
        
        logger = logging.getLogger(name)
        return logger


# 全域 logger 管理器實例
logger_manager = LoggerManager()


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """獲取 logger 實例的便捷函數"""
    if name is None:
        import inspect
        frame = inspect.currentframe().f_back
        name = frame.f_globals.get('__name__', 'unknown')
    
    return logger_manager.get_logger(name)


def setup_logging() -> None:
    """設置日誌系統的便捷函數"""
    logger_manager.configure_root_logger()


# 為了保持向後相容性，在模組載入時自動配置
setup_logging()