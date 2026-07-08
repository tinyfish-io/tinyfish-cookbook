import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, computed_field

class Settings(BaseSettings):
    tinyfish_api_key: str = Field(default="", description="TinyFish API Key")
    openai_api_key: str = Field(default="", description="OpenAI API Key")
    frontend_url: str = Field(default="", description="Vercel frontend URL for CORS")
    cors_origins: str = Field(
        default="",
        description="Comma-separated CORS origins (overrides frontend_url if set)",
    )
    analysis_mode: str = Field(
        default="deep",
        description="deep = full fetch + fact extraction + synthesis. fast only on Vercel serverless.",
    )
    timeout_seconds: int = Field(default=60, description="Default timeout for external APIs")
    max_concurrent_fetches: int = Field(default=3, description="Max concurrent URLs to fetch")
    search_result_limit: int = Field(default=4, description="Max TinyFish search results to fetch")
    max_search_angles: int = Field(default=4, description="Max search query angles per run")
    tinyfish_fetch_timeout_seconds: int = Field(default=150, description="TinyFish fetch timeout")
    llm_model: str = Field(default="gpt-4o", description="OpenAI model for synthesis")
    llm_max_tokens: int = Field(default=3200, description="Max tokens for LLM response")
    workflow_timeout_seconds: int = Field(default=120, description="Overall intelligence workflow timeout")
    use_search_snippets_only: bool = Field(
        default=False,
        description="Use TinyFish search snippets directly instead of full fetch",
    )
    skip_fact_extraction: bool = Field(
        default=False,
        description="Skip separate extract_facts LLM pass (single synthesize call)",
    )
    source_content_limit: int = Field(
        default=15000,
        description="Max chars kept per fetched source",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @computed_field
    @property
    def is_vercel(self) -> bool:
        return os.getenv("VERCEL") == "1"

    @computed_field
    @property
    def is_render(self) -> bool:
        return os.getenv("RENDER") == "true"

    @computed_field
    @property
    def is_fast_analysis(self) -> bool:
        return self.analysis_mode == "fast"

    @computed_field
    @property
    def runtime(self) -> str:
        if self.is_render:
            return "render"
        if self.is_vercel:
            return "vercel"
        return "local"

    @computed_field
    @property
    def is_configured(self) -> bool:
        placeholder = {"", "mock_key_for_testing", "your_tinyfish_key_here", "your_openai_key_here"}
        return (
            self.tinyfish_api_key not in placeholder
            and self.openai_api_key not in placeholder
        )

    @computed_field
    @property
    def allowed_origins(self) -> list[str]:
        if self.cors_origins.strip():
            return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]
        if self.frontend_url.strip():
            return [self.frontend_url.strip().rstrip("/")]
        return ["*"]

    def _apply_deep_pipeline(self) -> None:
        self.use_search_snippets_only = False
        self.skip_fact_extraction = False
        self.search_result_limit = max(self.search_result_limit, 4)
        self.max_concurrent_fetches = max(self.max_concurrent_fetches, 3)
        self.max_search_angles = max(self.max_search_angles, 4)
        self.llm_max_tokens = max(self.llm_max_tokens, 3200)
        self.llm_model = os.getenv("FINSIGHT_LLM_MODEL", self.llm_model or "gpt-4o")
        self.source_content_limit = max(self.source_content_limit, 15000)
        self.workflow_timeout_seconds = max(self.workflow_timeout_seconds, 180 if self.is_render else 120)

    def model_post_init(self, __context) -> None:
        if self.is_vercel:
            self.analysis_mode = "fast"
            self.search_result_limit = min(self.search_result_limit, 2)
            self.max_concurrent_fetches = min(self.max_concurrent_fetches, 2)
            self.max_search_angles = min(self.max_search_angles, 2)
            self.tinyfish_fetch_timeout_seconds = min(self.tinyfish_fetch_timeout_seconds, 30)
            self.timeout_seconds = min(self.timeout_seconds, 30)
            self.llm_model = os.getenv("FINSIGHT_LLM_MODEL", "gpt-4o-mini")
            self.llm_max_tokens = min(self.llm_max_tokens, 900)
            self.workflow_timeout_seconds = min(self.workflow_timeout_seconds, 18)
            self.use_search_snippets_only = True
            self.skip_fact_extraction = True
            return

        self.analysis_mode = "deep"
        self._apply_deep_pipeline()

settings = Settings()
