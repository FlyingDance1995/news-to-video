from __future__ import annotations

import json
import logging

from openai import OpenAI

from .schemas import SummarizationResult

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model
        self._client = OpenAI(api_key=api_key) if api_key else None

    def summarize_into_lines(
        self,
        text: str,
        title: str,
        system_prompt: str,
        model_override: str | None = None,
    ) -> tuple[list[str], list[str]]:
        if not self._api_key:
            raise ValueError(
                "OPENAI_API_KEY is required to summarize article text when script_lines are not provided"
            )
        if self._client is None:
            raise ValueError("OpenAI client is not initialized")

        logger.info(
            "[llm] Requesting script summary with model '%s' (title=%r, text_chars=%d)",
            model_override or self._model,
            title,
            len(text),
        )

        augmented_prompt = (
            system_prompt
            + "\n\nIMPORTANT: After generating the script lines, also provide a Vietnamese translation of each line in the same order in the 'vietnamese_lines' field. The translation should be natural Vietnamese, not literal."
        )

        response = self._client.responses.parse(
            model=model_override or self._model,
            input=[
                {"role": "system", "content": augmented_prompt},
                {
                    "role": "user",
                    "content": json.dumps({"title": title, "text": text}),
                },
            ],
            text_format=SummarizationResult,
            temperature=0.4,
            max_output_tokens=600,
        )

        parsed = response.output_parsed
        if parsed is None:
            raise ValueError("OpenAI summarization did not return a parseable response")

        lines = [line.strip() for line in parsed.lines if line and line.strip()]
        if not lines:
            raise ValueError("OpenAI summarization produced no usable script lines")

        vietnamese_lines = [line.strip() for line in parsed.vietnamese_lines if line and line.strip()]
        # Nếu thiếu bản dịch thì pad bằng chuỗi rỗng
        while len(vietnamese_lines) < len(lines):
            vietnamese_lines.append("")

        logger.info("[llm] Script summary completed (lines=%d, vi_lines=%d)", len(lines), len(vietnamese_lines))
        return lines, vietnamese_lines
