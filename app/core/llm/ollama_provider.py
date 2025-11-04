"""
Ollama Provider Implementation

Implements the BaseLLMProvider interface for Ollama local models.
"""

import os
import json
from typing import Dict, Any, List, Generator, Optional, Union
import ollama
from app.core.llm.base import BaseLLMProvider
from app.utils.logging import get_logger

logger = get_logger(__name__)


class OllamaProvider(BaseLLMProvider):
    """Ollama provider for local LLM models"""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Ollama provider

        Args:
            config: Configuration dictionary with Ollama settings
        """
        super().__init__(config)
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the Ollama client"""
        try:
            host = self.config.get('api_base', os.getenv("OLLAMA_API_HOST", "http://ollama:11434"))
            self.client = ollama.Client(host=host)
            logger.info(f"Ollama client initialized, connected to: {host}")
        except Exception as e:
            logger.error(f"Failed to initialize Ollama client: {e}")
            raise

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        stream: bool = False,
        **kwargs
    ) -> Union[Generator[str, None, None], str]:
        """
        Generate chat completion using Ollama

        Args:
            messages: List of message dictionaries
            model: Model to use (if None, use default from config)
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            **kwargs: Additional Ollama-specific parameters

        Returns:
            Generator yielding chunks if stream=True, otherwise complete response
        """
        if not self.client:
            raise RuntimeError("Ollama client not initialized")

        model_name = model or self.get_default_model()

        # Build options for Ollama
        # Handle stop parameter - ensure it's always an array
        stop_value = self.config.get("stop", "<|endoftext|>")
        if isinstance(stop_value, str):
            stop_array = [stop_value] if stop_value else []
        elif isinstance(stop_value, list):
            stop_array = stop_value
        else:
            stop_array = ["<|endoftext|>"]

        options = {
            "temperature": temperature,
            "num_predict": max_tokens,
            "num_ctx": int(self.config.get("num_ctx", 4096)),
            "repeat_last_n": int(self.config.get("repeat_last_n", 64)),
            "repeat_penalty": float(self.config.get("repeat_penalty", 1.1)),
            "top_k": int(self.config.get("top_k", 40)),
            "top_p": float(self.config.get("top_p", 0.9)),
            "min_p": float(self.config.get("min_p", 0.0)),
            "seed": int(self.config.get("seed", 0)),
            "stop": stop_array,
        }

        # Support keep_alive setting
        keep_alive = os.getenv("OLLAMA_KEEP_ALIVE") or self.config.get("keep_alive")
        if keep_alive:
            options["keep_alive"] = keep_alive

        # Extract think parameter if present
        think = kwargs.get('think', False)

        try:
            if stream:
                # Streaming response
                response_stream = self.client.chat(
                    model=model_name,
                    messages=messages,
                    stream=True,
                    options=options,
                    think=think
                )

                def stream_generator():
                    for chunk in response_stream:
                        if chunk and hasattr(chunk, 'message'):
                            content = chunk.message.content or ""
                            thinking = chunk.message.thinking or ""

                            # Format response to match existing streaming format
                            yield self.format_streaming_response(content, thinking)

                return stream_generator()
            else:
                # Non-streaming response
                response = self.client.chat(
                    model=model_name,
                    messages=messages,
                    stream=False,
                    options=options,
                    think=think
                )

                if response and hasattr(response, 'message'):
                    return response.message.content
                return ""

        except Exception as e:
            logger.error(f"Ollama chat completion failed: {e}")
            raise

    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to Ollama

        Returns:
            Dictionary with connection status
        """
        try:
            if not self.client:
                self._initialize_client()

            # Try to list models as a connection test
            models = self.client.list()
            return {
                "success": True,
                "message": f"Connected to Ollama successfully. Found {len(models.get('models', []))} models.",
                "models_count": len(models.get('models', []))
            }
        except Exception as e:
            logger.error(f"Ollama connection test failed: {e}")
            return self.handle_error(e)

    def list_models(self) -> List[str]:
        """
        List available Ollama models

        Returns:
            List of model names
        """
        try:
            if not self.client:
                self._initialize_client()

            response = self.client.list()
            models = response.get('models', [])
            return [model.get('name', '') for model in models if model.get('name')]
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

    def get_required_config_fields(self) -> List[str]:
        """
        Get required configuration fields for Ollama

        Returns:
            List of required field names
        """
        # Ollama doesn't require API keys, just the host
        return ['model']

    def get_default_model(self) -> str:
        """
        Get the default model for Ollama

        Returns:
            Default model name
        """
        return self.config.get('model', 'gemma3:4b')

    def pull_model(self, model_name: str) -> bool:
        """
        Pull a model from Ollama registry

        Args:
            model_name: Name of the model to pull

        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.client:
                self._initialize_client()

            logger.info(f"Pulling Ollama model: {model_name}")
            self.client.pull(model_name)
            logger.info(f"Successfully pulled model: {model_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to pull Ollama model {model_name}: {e}")
            return False