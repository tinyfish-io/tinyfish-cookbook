from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class QueryType(str, Enum):
    SME_LOAN = "sme_loan"
    REGULATORY = "regulatory"
    COMPETITOR = "competitor"
    REAL_ESTATE = "real_estate"
    MOBILITY = "mobility"
    GENERAL = "general"


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500, description="The user's natural language query")
    query_type: QueryType = Field(..., description="Type of query: 'sme_loan', 'regulatory', or 'competitor'")


class MetricItem(BaseModel):
    label: str
    value: str
    unit: Optional[str] = None
    change: Optional[str] = None


class StructuredReport(BaseModel):
    headline: str = ""
    executive_summary: str = ""
    intelligence_brief: str = ""
    key_findings: List[str] = Field(default_factory=list)
    metrics: List[MetricItem] = Field(default_factory=list)
    comparison_table: List[Dict[str, str]] = Field(default_factory=list)
    recommendation: str = ""
    data_as_of: Optional[str] = None
    caveats: List[str] = Field(default_factory=list)


class PipelineEvent(BaseModel):
    stage: str = Field(..., description="search | fetch | preflight | synthesize")
    message: str
    url: Optional[str] = None
    status: Optional[str] = Field(None, description="ok | failed | warn | skipped | pending")
    meta: Optional[Dict[str, Any]] = None


class DataQuality(BaseModel):
    score: float = Field(..., ge=0.0, le=1.0)
    tier: str = Field(..., description="high | medium | low | insufficient")
    sources_discovered: int = 0
    sources_fetched: int = 0
    sources_with_content: int = 0
    weak_metrics_count: int = 0
    low_signal_sources: int = 0
    verified_metrics_count: int = 0
    coverage_gaps: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)


class IntelligenceResult(BaseModel):
    title: str = Field(..., description="Title of the finding")
    summary: str = Field(..., description="Short executive summary for legacy clients")
    structured: Optional[StructuredReport] = Field(None, description="Structured fintech report")
    source_urls: List[str] = Field(default_factory=list, description="URLs used for the synthesis")
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")


class QueryResponse(BaseModel):
    status: str = Field(default="success")
    results: List[IntelligenceResult]
    analysis: str = Field(..., description="Overall market analysis based on the results")
    query_type: Optional[QueryType] = None
    data_quality: Optional[DataQuality] = None
    pipeline: List[PipelineEvent] = Field(default_factory=list)
