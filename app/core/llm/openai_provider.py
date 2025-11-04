"""
OpenAI Provider Implementation

Implements the BaseLLMProvider interface for OpenAI API.
"""

import json
from typing import Dict, Any, List, Generator, Optional, Union
from app.core.llm.base import BaseLLMProvider
from app.utils.logging import get_logger

logger = get_logger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider for GPT models"""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize OpenAI provider

        Args:
            config: Configuration dictionary with OpenAI settings
        """
        super().__init__(config)
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the OpenAI client"""
        try:
            # Use requests library (already installed)
            import requests

            api_key = self.config.get('api_key', '')
            if not api_key:
                raise ValueError("OpenAI API key is required")

            self.api_key = api_key
            self.api_base = self.config.get('api_base', 'https://api.openai.com/v1')
            self.organization = self.config.get('organization', '')

            # Create headers for requests
            self.headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            if self.organization:
                self.headers["OpenAI-Organization"] = self.organization

            # Create a requests session for connection pooling
            self.client = requests.Session()
            self.client.headers.update(self.headers)

            logger.info(f"OpenAI client initialized with base URL: {self.api_base}")
        except ImportError:
            logger.error("requests is not installed. Please install it with: pip install requests")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
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
        Generate chat completion using OpenAI API

        Args:
            messages: List of message dictionaries
            model: Model to use (if None, use default from config)
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            **kwargs: Additional OpenAI-specific parameters

        Returns:
            Generator yielding chunks if stream=True, otherwise complete response
        """
        if not self.client:
            raise RuntimeError("OpenAI client not initialized")

        model_name = model or self.get_default_model()

        # Build request payload
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }

        # Add optional parameters
        if 'top_p' in kwargs:
            payload['top_p'] = kwargs['top_p']
        if 'frequency_penalty' in kwargs:
            payload['frequency_penalty'] = kwargs['frequency_penalty']
        if 'presence_penalty' in kwargs:
            payload['presence_penalty'] = kwargs['presence_penalty']
        if 'stop' in kwargs:
            payload['stop'] = kwargs['stop']

        try:
            if stream:
                # Streaming response using requests
                import requests

                response = requests.post(
                    f"{self.api_base}/chat/completions",
                    headers=self.headers,
                    json=payload,
                    stream=True,
                    timeout=120.0
                )
                response.raise_for_status()

                def stream_generator():
                    for line in response.iter_lines():
                        if line:
                            decoded_line = line.decode('utf-8')
                            if decoded_line.startswith("data: "):
                                data = decoded_line[6:]  # Remove "data: " prefix
                                if data.strip() == "[DONE]":
                                    break

                                try:
                                    chunk = json.loads(data)
                                    if 'choices' in chunk and len(chunk['choices']) > 0:
                                        delta = chunk['choices'][0].get('delta', {})
                                        content = delta.get('content', '')
                                        if content:
                                            # Format response to match existing streaming format
                                            yield self.format_streaming_response(content)
                                except json.JSONDecodeError:
                                    continue

                return stream_generator()
            else:
                # Non-streaming response
                response = self.client.post(
                    f"{self.api_base}/chat/completions",
                    json=payload,
                    timeout=120.0
                )
                response.raise_for_status()

                data = response.json()
                if 'choices' in data and len(data['choices']) > 0:
                    return data['choices'][0]['message']['content']
                return ""

        except Exception as e:
            logger.error(f"OpenAI chat completion failed: {e}")
            raise

    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to OpenAI API

        Returns:
            Dictionary with connection status
        """
        try:
            if not self.client:
                self._initialize_client()

            # Try to list models as a connection test
            response = self.client.get(f"{self.api_base}/models", timeout=10)
            response.raise_for_status()

            data = response.json()
            model_count = len(data.get('data', []))

            return {
                "success": True,
                "message": f"Connected to OpenAI successfully. Found {model_count} models.",
                "models_count": model_count
            }
        except Exception as e:
            logger.error(f"OpenAI connection test failed: {e}")
            return self.handle_error(e)

    def list_models(self) -> List[str]:
        """
        List available OpenAI models

        Returns:
            List of model names
        """
        try:
            if not self.client:
                self._initialize_client()

            response = self.client.get(f"{self.api_base}/models", timeout=10)
            response.raise_for_status()

            data = response.json()
            models = data.get('data', [])

            # Filter for chat models
            chat_models = [
                model['id'] for model in models
                if 'gpt' in model['id'].lower() or 'davinci' in model['id'].lower()
            ]

            return sorted(chat_models)
        except Exception as e:
            logger.error(f"Failed to list OpenAI models: {e}")
            return []

    def get_required_config_fields(self) -> List[str]:
        """
        Get required configuration fields for OpenAI

        Returns:
            List of required field names
        """
        return ['api_key', 'model']

    def get_default_model(self) -> str:
        """
        Get the default model for OpenAI

        Returns:
            Default model name
        """
        return self.config.get('model', 'gpt-4-turbo-preview')

    def __del__(self):
        """Cleanup HTTP client on deletion"""
        if self.client:
            self.client.close()