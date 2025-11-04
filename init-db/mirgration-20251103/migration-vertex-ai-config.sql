-- Vertex AI (Anthropic on GCP) Configuration Migration
-- This migration adds configuration fields for Vertex AI provider support

-- Insert Vertex AI configuration fields
INSERT INTO configs (`key`, value) VALUES
    -- Core configuration
    ('vertex_ai_project_id', ''),                           -- GCP Project ID (required)
    ('vertex_ai_location_id', 'us-central1'),              -- Deployment location
    ('vertex_ai_model_id', 'claude-4-5-haiku@20251001'),   -- Default model
    ('vertex_ai_anthropic_version', 'vertex-2023-10-16'),  -- API version

    -- Credentials configuration
    ('vertex_ai_credentials_path', ''),                    -- Service Account key path (optional)

    -- UI helper flags
    ('vertex_ai_setup_guide_shown', 'false'),             -- Track if setup guide has been shown
    ('vertex_ai_last_key_check', ''),                     -- Last time credentials were checked

    -- Model options (similar to other providers)
    ('vertex_ai_max_tokens', '1024'),                     -- Maximum tokens for response
    ('vertex_ai_temperature', '0.7')                      -- Temperature for generation
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- Add a comment to explain the configuration
-- This is helpful for database administrators
ALTER TABLE configs COMMENT = 'System configuration table including LLM provider settings';

-- Log the migration
INSERT INTO configs (`key`, value) VALUES
    ('migration_vertex_ai', NOW())
ON DUPLICATE KEY UPDATE value = NOW();