"""
Anthropic Provider Implementation

Implements the BaseLLMProvider interface for Anthropic Claude API.
"""

import json
from typing import Dict, Any, List, Generator, Optional, Union
from app.core.llm.base import BaseLLMProvider
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic provider for Claude models"""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Anthropic provider

        Args:
            config: Configuration dictionary with Anthropic settings
        """
        super().__init__(config)
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the Anthropic client"""
        try:
            # Use requests library (already installed)
            import requests

            api_key = self.config.get('api_key', '')
            if not api_key:
                raise ValueError("Anthropic API key is required")

            self.api_key = api_key
            self.api_base = self.config.get('api_base', 'https://api.anthropic.com')
            self.api_version = self.config.get('api_version', '2023-06-01')

            # Create headers for requests
            self.headers = {
                "x-api-key": self.api_key,
                "anthropic-version": self.api_version,
                "Content-Type": "application/json"
            }

            # Create a requests session for connection pooling
            self.client = requests.Session()
            self.client.headers.update(self.headers)

            logger.info(f"Anthropic client initialized with base URL: {self.api_base}")
        except ImportError:
            logger.error("requests is not installed. Please install it with: pip install requests")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {e}")
            raise

    def _convert_messages_to_anthropic_format(self, messages: List[Dict[str, str]]) -> tuple:
        """
        Convert OpenAI-style messages to Anthropic format

        Args:
            messages: List of message dictionaries with 'role' and 'content'

        Returns:
            Tuple of (system_prompt, conversation_messages)
        """
        system_prompt = ""
        conversation_messages = []

        for msg in messages:
            role = msg.get('role', '')
            content = msg.get('content', '')

            if role == 'system':
                # Anthropic uses system parameter separately
                system_prompt = content
            elif role == 'user':
                conversation_messages.append({
                    "role": "user",
                    "content": content
                })
            elif role == 'assistant':
                conversation_messages.append({
                    "role": "assistant",
                    "content": content
                })

        return system_prompt, conversation_messages

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
        Generate chat completion using Anthropic API

        Args:
            messages: List of message dictionaries
            model: Model to use (if None, use default from config)
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            **kwargs: Additional Anthropic-specific parameters

        Returns:
            Generator yielding chunks if stream=True, otherwise complete response
        """
        if not self.client:
            raise RuntimeError("Anthropic client not initialized")

        model_name = model or self.get_default_model()

        # Convert messages to Anthropic format
        system_prompt, conversation_messages = self._convert_messages_to_anthropic_format(messages)

        # Build request payload
        payload = {
            "model": model_name,
            "messages": conversation_messages,
            "max_tokens": max_tokens,
            "stream": stream
        }

        # Add system prompt if present
        if system_prompt:
            payload["system"] = system_prompt

        # Anthropic API doesn't allow both temperature and top_p
        # Use temperature by default, but if top_p is provided, use that instead
        if 'top_p' in kwargs and kwargs['top_p'] is not None:
            payload['top_p'] = kwargs['top_p']
        else:
            payload['temperature'] = temperature
        if 'top_k' in kwargs:
            payload['top_k'] = kwargs['top_k']
        if 'stop_sequences' in kwargs:
            payload['stop_sequences'] = kwargs['stop_sequences']

        try:
            if stream:
                # Streaming response using requests
                import requests

                response = requests.post(
                    f"{self.api_base}/v1/messages",
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

                                try:
                                    chunk = json.loads(data)
                                    if chunk.get('type') == 'content_block_delta':
                                        delta = chunk.get('delta', {})
                                        content = delta.get('text', '')
                                        if content:
                                            # Format response to match existing streaming format
                                            yield self.format_streaming_response(content)
                                except json.JSONDecodeError:
                                    continue

                return stream_generator()
            else:
                # Non-streaming response
                response = self.client.post(
                    f"{self.api_base}/v1/messages",
                    json=payload,
                    timeout=120.0
                )
                response.raise_for_status()

                data = response.json()
                if 'content' in data and len(data['content']) > 0:
                    # Extract text from content blocks
                    text_content = ""
                    for content_block in data['content']:
                        if content_block.get('type') == 'text':
                            text_content += content_block.get('text', '')
                    return text_content
                return ""

        except Exception as e:
            if hasattr(e, 'response'):
                logger.error(f"Anthropic chat completion failed: {e}")
                logger.error(f"Response status: {e.response.status_code if hasattr(e.response, 'status_code') else 'N/A'}")
                logger.error(f"Response body: {e.response.text if hasattr(e.response, 'text') else 'N/A'}")
            else:
                logger.error(f"Anthropic chat completion failed: {e}")
            raise

    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to Anthropic API

        Returns:
            Dictionary with connection status
        """
        try:
            if not self.client:
                self._initialize_client()

            # Try a minimal request to test the connection
            test_payload = {
                "model": self.get_default_model(),
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 10
            }

            response = self.client.post(
                f"{self.api_base}/v1/messages",
                json=test_payload,
                timeout=10
            )

            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connected to Anthropic successfully.",
                    "model": self.get_default_model()
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection test failed with status {response.status_code}",
                    "error": response.text
                }

        except Exception as e:
            logger.error(f"Anthropic connection test failed: {e}")
            return self.handle_error(e)

    def list_models(self) -> List[str]:
        """
        List available Anthropic models

        Based on official Anthropic documentation
        Reference: https://docs.claude.com/zh-TW/docs/about-claude/models/overview

        Returns:
            List of model names
        """
        # Updated with latest models from Anthropic docs
        return [
            # Claude 3.5 models (Latest - 2024)
            "claude-3-5-sonnet-20241022",   # Claude 3.5 Sonnet (Oct 2024)
            "claude-3-5-haiku-20241022",    # Claude 3.5 Haiku (Oct 2024)

            # Claude 3 models (2024)
            "claude-3-opus-20240229",        # Claude 3 Opus
            "claude-3-sonnet-20240229",      # Claude 3 Sonnet
            "claude-3-haiku-20240307",       # Claude 3 Haiku

            # Legacy models (for compatibility)
            "claude-2.1",
            "claude-2.0",
            "claude-instant-1.2"
        ]

    def get_required_config_fields(self) -> List[str]:
        """
        Get required configuration fields for Anthropic

        Returns:
            List of required field names
        """
        return ['api_key', 'model']

    def get_default_model(self) -> str:
        """
        Get the default model for Anthropic

        Returns:
            Default model name (using latest Claude 3.5 Sonnet)
        """
        return self.config.get('model', 'claude-3-5-sonnet-20241022')

    def __del__(self):
        """Cleanup HTTP client on deletion"""
        if self.client:
            self.client.close()