import json
from openai import AsyncOpenAI, APIError, RateLimitError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from api.core.config import settings
from api.core.logger import logger
from api.models.schemas import QueryType, StructuredReport, MetricItem
from api.services.prompts import build_extraction_prompt, build_synthesis_prompt
from api.services.data_quality import is_weak_value


class LLMClient:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    @staticmethod
    def _truncate_context(context: str, max_chars: int = 18000) -> str:
        if len(context) <= max_chars:
            return context
        return context[:max_chars]

    async def _chat_json(self, system_prompt: str, user_message: str, max_tokens: int) -> dict:
        response = await self.client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
            max_tokens=max_tokens,
            timeout=settings.timeout_seconds,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        return json.loads(raw)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((APIError, RateLimitError)),
        reraise=True,
    )
    async def extract_facts(self, context: str, query: str, query_type: QueryType) -> dict:
        system_prompt, user_message = build_extraction_prompt(query, query_type, context)
        logger.info(f"Extracting structured facts for query: {query}")
        try:
            return await self._chat_json(
                system_prompt,
                user_message,
                max_tokens=min(settings.llm_max_tokens, 1600),
            )
        except json.JSONDecodeError as e:
            logger.error(f"Fact extraction JSON invalid: {e}")
            try:
                fallback_context = self._truncate_context(context)
                fallback_system, fallback_user = build_extraction_prompt(
                    query, query_type, fallback_context
                )
                fallback_user += (
                    "\n\nRetry requirement: return compact valid JSON only. "
                    "Prefer fewer fields over malformed output."
                )
                return await self._chat_json(
                    fallback_system,
                    fallback_user,
                    max_tokens=min(settings.llm_max_tokens, 1200),
                )
            except Exception as retry_error:
                logger.error(f"Fact extraction retry failed: {retry_error}")
                return {
                    "verified_metrics": [],
                    "comparisons": [],
                    "coverage_gaps": ["Fact extraction failed — synthesis will rely on raw source text only."],
                    "source_quality_notes": [],
                    "analytical_angles": [],
                }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((APIError, RateLimitError)),
        reraise=True,
    )
    async def synthesize(
        self,
        context: str,
        query: str,
        query_type: QueryType,
        extracted_facts: dict | None = None,
    ) -> StructuredReport:
        facts_text = json.dumps(extracted_facts, ensure_ascii=False, indent=2) if extracted_facts else None
        system_prompt, user_message = build_synthesis_prompt(
            query, query_type, context, extracted_facts=facts_text
        )

        logger.info(f"Initiating LLM synthesis for query: {query} (type: {query_type.value})")

        try:
            data = await self._chat_json(
                system_prompt,
                user_message,
                max_tokens=settings.llm_max_tokens,
            )
            report = self._parse_report(data)
            return self._merge_extraction_into_report(report, extracted_facts)
        except json.JSONDecodeError as e:
            logger.error(f"LLM returned invalid JSON: {e}")
            return StructuredReport(
                headline="Synthesis incomplete",
                executive_summary="The intelligence engine could not structure the response. Please retry.",
                caveats=["JSON parse failed — raw data may be incomplete."],
            )
        except Exception as e:
            logger.error(f"Error during LLM synthesis: {str(e)}")
            raise

    def _merge_extraction_into_report(
        self, report: StructuredReport, extracted_facts: dict | None
    ) -> StructuredReport:
        if not extracted_facts:
            return report

        gaps = extracted_facts.get("coverage_gaps") or []
        quality_notes = extracted_facts.get("source_quality_notes") or []
        for note in [*gaps, *quality_notes]:
            if isinstance(note, str) and note and note not in report.caveats:
                report.caveats.append(note)

        angles = extracted_facts.get("analytical_angles") or []
        if angles and not report.intelligence_brief:
            report.intelligence_brief = "\n\n".join(
                angle for angle in angles if isinstance(angle, str) and angle.strip()
            )

        return report

    def _parse_report(self, data: dict) -> StructuredReport:
        metrics = []
        for m in data.get("metrics", []) or []:
            if isinstance(m, dict) and m.get("label"):
                value = str(m.get("value", "—"))
                if is_weak_value(value):
                    continue
                metrics.append(
                    MetricItem(
                        label=str(m.get("label", "")),
                        value=value,
                        unit=m.get("unit"),
                        change=m.get("change"),
                    )
                )

        table = []
        for row in data.get("comparison_table", []) or []:
            if not isinstance(row, dict):
                continue
            cleaned = {str(k): str(v) for k, v in row.items()}
            value_fields = [v for k, v in cleaned.items() if k != "entity"]
            if value_fields and all(is_weak_value(v) for v in value_fields):
                continue
            for key, value in list(cleaned.items()):
                if key != "entity" and is_weak_value(value):
                    cleaned[key] = ""
            table.append(cleaned)

        return StructuredReport(
            headline=str(data.get("headline", "")),
            executive_summary=str(data.get("executive_summary", "")),
            intelligence_brief=str(data.get("intelligence_brief", "")),
            key_findings=[str(f) for f in (data.get("key_findings") or [])],
            metrics=metrics,
            comparison_table=table,
            recommendation=str(data.get("recommendation", "")),
            data_as_of=data.get("data_as_of"),
            caveats=[str(c) for c in (data.get("caveats") or [])],
        )


llm_client = LLMClient()
