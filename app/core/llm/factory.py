"""
LLM Provider Factory

Factory pattern for creating appropriate LLM provider instances.
"""

from typing import Dict, Any, Optional, List
from app.core.llm.base import BaseLLMProvider
from app.core.llm.ollama_provider import OllamaProvider
from app.core.llm.openai_provider import OpenAIProvider
from app.core.llm.anthropic_provider import AnthropicProvider
from app.core.llm.vertex_ai_provider import VertexAIProvider
from app.config.settings import app_config
from app.utils.logging import get_logger

logger = get_logger(__name__)


class LLMFactory:
    """Factory for creating LLM provider instances"""

    # Provider mappings
    PROVIDERS = {
        'ollama': OllamaProvider,
        'openai': OpenAIProvider,
        'anthropic': AnthropicProvider,
        'vertex_ai': VertexAIProvider,
        # Future providers can be added here
        # 'gemini': GeminiProvider,
        # 'azure': AzureOpenAIProvider,
    }

    @classmethod
    def create_provider(cls, provider_type: Optional[str] = None) -> BaseLLMProvider:
        """
        Create an LLM provider instance

        Args:
            provider_type: Type of provider to create. If None, uses config default.

        Returns:
            Instance of the appropriate LLM provider

        Raises:
            ValueError: If provider type is not supported
        """
        config = app_config.all

        # Get provider type from parameter or config
        if provider_type is None:
            provider_type = config.get('llm_provider', 'ollama')

        provider_type = provider_type.lower()

        if provider_type not in cls.PROVIDERS:
            raise ValueError(
                f"Unsupported provider type: {provider_type}. "
                f"Supported providers: {', '.join(cls.PROVIDERS.keys())}"
            )

        # Build provider-specific configuration
        provider_config = cls._build_provider_config(provider_type, config)

        # Create and return provider instance
        provider_class = cls.PROVIDERS[provider_type]
        logger.info(f"Creating LLM provider: {provider_type}")

        try:
            provider = provider_class(provider_config)
            logger.info(f"Successfully created {provider_type} provider")
            return provider
        except Exception as e:
            logger.error(f"Failed to create {provider_type} provider: {e}")
            raise

    @classmethod
    def _build_provider_config(cls, provider_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build provider-specific configuration

        Args:
            provider_type: Type of provider
            config: Global configuration

        Returns:
            Provider-specific configuration dictionary
        """
        provider_config = {}

        if provider_type == 'ollama':
            provider_config = {
                'api_base': config.get('ollama_api_base', 'http://ollama:11434'),
                'model': config.get('llm_model', config.get('ollama_model', 'gemma3:4b')),
                'keep_alive': config.get('ollama_keep_alive'),
                # Copy all model options
                'num_ctx': config.get('num_ctx', 4096),
                'num_predict': config.get('num_predict', 1024),
                'temperature': config.get('temperature', 0.7),
                'top_k': config.get('top_k', 40),
                'top_p': config.get('top_p', 0.9),
                'min_p': config.get('min_p', 0.0),
                'repeat_last_n': config.get('repeat_last_n', 64),
                'repeat_penalty': config.get('repeat_penalty', 1.1),
                'seed': config.get('seed', 0),
                'stop': config.get('stop', '<|endoftext|>'),
            }

        elif provider_type == 'openai':
            provider_config = {
                'api_key': config.get('openai_api_key'),
                'api_base': config.get('openai_api_base', 'https://api.openai.com/v1'),
                'organization': config.get('openai_organization', ''),
                'model': config.get('openai_model', 'gpt-4-turbo-preview'),
                # reasoning_effort: low / medium / high / none
                # 'none' 表示即使啟用推理也不傳送此參數（用於不支援的模型）
                'reasoning_effort': config.get('openai_reasoning_effort', 'medium'),
            }

        elif provider_type == 'anthropic':
            provider_config = {
                'api_key': config.get('anthropic_api_key'),
                'api_base': config.get('anthropic_api_base', 'https://api.anthropic.com'),
                'api_version': config.get('anthropic_api_version', '2023-06-01'),
                'model': config.get('anthropic_model', 'claude-3-5-sonnet-latest'),
            }

        elif provider_type == 'vertex_ai':
            provider_config = {
                'project_id': config.get('vertex_ai_project_id', ''),
                'location_id': config.get('vertex_ai_location_id', 'us-central1'),
                'model': config.get('vertex_ai_model_id', 'claude-haiku-4-5@20251001'),
                'anthropic_version': config.get('vertex_ai_anthropic_version', 'vertex-2023-10-16'),
                'credentials_path': config.get('vertex_ai_credentials_path', ''),
            }

        # Add common configurations
        provider_config.update({
            'max_retries': int(config.get('llm_max_retries', 3)),
            'timeout_seconds': int(config.get('llm_timeout_seconds', 120)),
        })

        return provider_config

    @classmethod
    def test_provider_connection(cls, provider_type: str) -> Dict[str, Any]:
        """
        Test connection for a specific provider

        Args:
            provider_type: Type of provider to test

        Returns:
            Dictionary with test results
        """
        try:
            provider = cls.create_provider(provider_type)
            return provider.test_connection()
        except Exception as e:
            logger.error(f"Failed to test {provider_type} connection: {e}")
            return {
                "success": False,
                "provider": provider_type,
                "error": str(e)
            }

    @classmethod
    def list_available_providers(cls) -> List[str]:
        """
        List all available provider types

        Returns:
            List of provider type names
        """
        return list(cls.PROVIDERS.keys())

    @classmethod
    def get_provider_models(cls, provider_type: str) -> List[str]:
        """
        Get available models for a specific provider

        Args:
            provider_type: Type of provider

        Returns:
            List of available model names
        """
        try:
            provider = cls.create_provider(provider_type)
            return provider.list_models()
        except Exception as e:
            logger.error(f"Failed to get models for {provider_type}: {e}")
            return []