"""Structured data shapes shared by the research and content agents."""

from typing import Literal

from pydantic import BaseModel, Field

RecommendationStatus = Literal[
    "GENERATED", "SELECTED", "ARCHIVED"
]

DraftStatus = Literal[
    "GENERATED",
    "VALIDATED",
    "PENDING_REVIEW",
    "APPROVED",
    "REJECTED",
    "REVISION_REQUESTED",
    "FINAL",
]


class Recommendation(BaseModel):
    id: str
    topic: str
    source: str
    source_url: str
    published_at: str = ""
    why_it_matters: str
    personal_relevance: str
    suggested_angle: str
    recommended_platform: Literal["linkedin", "blog"]
    recommended_style: Literal[
        "educational", "technical", "storytelling", "conversational"
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_facts: list[str] = Field(default_factory=list)
    status: RecommendationStatus = "GENERATED"


class ResearchRun(BaseModel):
    run_id: str
    date: str
    created_at: str
    recommendations: list[Recommendation]


class ValidationIssue(BaseModel):
    field: str
    problem: str


class ValidationResult(BaseModel):
    passed: bool
    issues: list[ValidationIssue] = Field(default_factory=list)


class Draft(BaseModel):
    id: str
    recommendation_id: str
    date: str
    created_at: str
    topic: str
    platform: Literal["linkedin", "blog"]
    style: Literal["educational", "technical", "storytelling", "conversational"]
    content: str
    supporting_facts: list[str] = Field(default_factory=list)
    validation: ValidationResult | None = None
    status: DraftStatus = "GENERATED"
    revision_feedback: list[str] = Field(default_factory=list)
