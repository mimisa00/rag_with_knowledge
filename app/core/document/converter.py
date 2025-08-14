"""
文檔轉換核心模組 (原 model_docling.py 的重構版本)
"""
import os
from typing import Optional, Dict, Any
from collections import defaultdict

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat
from docling_core.types.doc import TextItem
from app.config.settings import app_config
from app.config.paths import path_config
from app.utils.logging import get_logger

logger = get_logger(__name__)


class DoclingConverter:
    """文檔轉換器"""
    
    def __init__(self):
        self.config = app_config
        self.paths = path_config.get_base_paths()
    
    def _output_picture_as_markdown_table(self, doc, picture):
        """將圖片中的文字輸出為 Markdown 表格格式"""
        Y_TOLERANCE = 10
        
        # 將文字依照 Y 軸分行
        line_map = defaultdict(list)
        for item, _ in doc.iterate_items(root=picture, traverse_pictures=True):
            if isinstance(item, TextItem):
                text = item.text
                bbox = item.prov[0].bbox
                y = bbox.t
                x = bbox.l

                matched = False
                for key_y in line_map:
                    if abs(key_y - y) < Y_TOLERANCE:
                        line_map[key_y].append((x, text))
                        matched = True
                        break
                if not matched:
                    line_map[y].append((x, text))

        # 排序 Y 軸（上到下）
        sorted_lines = sorted(line_map.items(), key=lambda kv: kv[0])

        logger.info("### 📄 Markdown 表格輸出")
        pic_md_lines = []
        for _, items in sorted_lines:
            logger.debug("======= items ======")
            logger.debug(f"items: {items}")

            # 按 x 軸左到右排序每一行的文字
            row = [str(text) for x, text in sorted(items, key=lambda i: i[0])]
            logger.debug("| " + " | ".join(row) + " |")
            pic_md_lines.append("| " + " | ".join(row) + " |")

        return pic_md_lines
    
    def convert_file_via_docling(self, file_path: str, filename: str, kb_id: str = None) -> Optional[Dict[str, Any]]:
        """使用 Docling 轉換文件"""
        try:
            logger.info(f"開始轉換文件: {file_path}")
            logger.info(f"文件名稱: {filename}")

            # 透過原生 Docling LIB 處理
            pipeline_options = PdfPipelineOptions()
            pipeline_options.images_scale = 2
            pipeline_options.generate_page_images = True
            pipeline_options.do_ocr = True
            pipeline_options.do_table_structure = True
            pipeline_options.table_structure_options.do_cell_matching = True
            
            doc_converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                }
            )
            
            result = doc_converter.convert(file_path)
            mdtext = result.document.export_to_markdown()
            mdtext += "\n"
            
            logger.debug(f"轉換後的 Markdown 文字: {mdtext[:200]}...")

            doc = result.document

            # 處理圖片中的文字
            for picture in doc.pictures:
                md_lines = self._output_picture_as_markdown_table(doc, picture)
                mdtext += "\n".join(md_lines) + "\n\n"

            # 儲存 markdown 內容到知識庫特定目錄
            markdown_dir = os.path.join(self.paths["DOC_PATH"], kb_id, "markdown")
            
            os.makedirs(markdown_dir, exist_ok=True)
            markdown_filename = f"{filename}.md"
            markdown_path = os.path.join(markdown_dir, markdown_filename)
            
            with open(markdown_path, "w", encoding="utf-8") as md_file:
                md_file.write(mdtext)

            if not mdtext:
                logger.warning(f"無法擷取內容：{filename}")
                return None

            # 回傳 dict 結構，包含內容與檔案資訊
            return {
                "content": mdtext,
                "source_file": filename,
                "markdown_file": markdown_filename
            }
            
        except Exception as e:
            logger.error(f"處理 {filename} 時發生例外：{e}")
            return None


# 全域文檔轉換器實例
document_converter = DoclingConverter()