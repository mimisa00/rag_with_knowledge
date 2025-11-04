"""
Base LLM Provider Interface

Defines the abstract base class that all LLM providers must implement.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Generator, Optional, Union
import json


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the provider with configuration

        Args:
            config: Provider-specific configuration dictionary
        """
        self.config = config
        self.provider_name = self.__class__.__name__.replace('Provider', '')

    @abstractmethod
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
        Generate chat completion

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            model: Model to use (if None, use default from config)
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            **kwargs: Additional provider-specific parameters

        Returns:
            Generator yielding chunks if stream=True, otherwise complete response
        """
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to the provider

        Returns:
            Dictionary with 'success' boolean and 'message' string
        """
        pass

    @abstractmethod
    def list_models(self) -> List[str]:
        """
        List available models for this provider

        Returns:
            List of model names
        """
        pass

    def format_streaming_response(self, content: str, thinking: str = "") -> str:
        """
        Format response for streaming to match existing format

        Args:
            content: The content to stream
            thinking: Optional thinking/reasoning content

        Returns:
            JSON formatted string for streaming
        """
        return json.dumps({
            "content": content,
            "thinking": thinking
        }) + "\n"

    def validate_config(self) -> bool:
        """
        Validate the provider configuration

        Returns:
            True if configuration is valid
        """
        # Default implementation - can be overridden by specific providers
        required_fields = self.get_required_config_fields()
        for field in required_fields:
            if field not in self.config or not self.config[field]:
                return False
        return True

    @abstractmethod
    def get_required_config_fields(self) -> List[str]:
        """
        Get list of required configuration fields for this provider

        Returns:
            List of required field names
        """
        pass

    def get_default_model(self) -> str:
        """
        Get the default model for this provider

        Returns:
            Default model name
        """
        return self.config.get('model', self.config.get('default_model', ''))

    def handle_error(self, error: Exception) -> Dict[str, Any]:
        """
        Handle provider-specific errors

        Args:
            error: The exception that occurred

        Returns:
            Dictionary with error information
        """
        return {
            "success": False,
            "provider": self.provider_name,
            "error": str(error),
            "error_type": type(error).__name__
        }