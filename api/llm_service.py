from __future__ import annotations

import json
import logging
import re
import time

from openai import OpenAI, RateLimitError

from .schemas import SummarizationResult

logger = logging.getLogger(__name__)

_JSON_INSTRUCTION = """
You MUST respond with ONLY a valid JSON object, no prose before or after. The JSON must have exactly these two keys:
- "lines": an array of English script lines (strings)
- "vietnamese_lines": an array of Vietnamese translations of each line, in the same order

Example format:
{"lines": ["Line one.", "Line two."], "vietnamese_lines": ["Dòng một.", "Dòng hai."]}
"""


def _extract_json(text: str) -> dict | None:
    """Extract the first JSON object from text, tolerating surrounding prose or truncation."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown code fences
    fenced = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    fenced = re.sub(r"\s*```$", "", fenced, flags=re.MULTILINE).strip()
    try:
        return json.loads(fenced)
    except json.JSONDecodeError:
        pass
    # Find first { ... } block
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    # JSON truncated — salvage lines from partial content
    partial = text[start:]
    lines_match = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', partial)
    content_lines = [s for s in lines_match if s not in ("lines", "vietnamese_lines") and len(s) > 10]
    if content_lines:
        logger.warning("[llm] JSON truncated, salvaged %d lines from partial response", len(content_lines))
        return {"lines": content_lines, "vietnamese_lines": []}
    return None


class LLMService:
    def __init__(self, api_key: str, model: str, base_url: str = ""):
        self._api_key = api_key
        self._model = model
        if api_key:
            kwargs: dict = {"api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url
            self._client = OpenAI(**kwargs)
        else:
            self._client = None

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

        model = model_override or self._model
        logger.info(
            "[llm] Requesting script summary with model '%s' (title=%r, text_chars=%d)",
            model,
            title,
            len(text),
        )

        augmented_prompt = (
            system_prompt
            + "\n\nIMPORTANT: After generating the script lines, also provide a Vietnamese translation of each line in the same order in the 'vietnamese_lines' field. The translation should be natural Vietnamese, not literal."
            + _JSON_INSTRUCTION
        )

        max_retries = 4
        response = None
        for attempt in range(max_retries):
            try:
                kwargs: dict = dict(
                    model=model,
                    messages=[
                        {"role": "system", "content": augmented_prompt},
                        {
                            "role": "user",
                            "content": json.dumps({"title": title, "text": text}),
                        },
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.4,
                    max_tokens=2000,
                )
                response = self._client.chat.completions.create(**kwargs)
                break
            except RateLimitError as exc:
                if attempt < max_retries - 1:
                    wait = 10 * (2 ** attempt)  # 10s, 20s, 40s
                    logger.warning("[llm] Rate limited (429), retrying in %ds (attempt %d/%d)", wait, attempt + 1, max_retries)
                    time.sleep(wait)
                else:
                    raise exc

        if response is None:
            raise ValueError("LLM request failed after all retries")

        raw = response.choices[0].message.content or ""
        if not raw.strip():
            raise ValueError("LLM returned empty response")

        data = _extract_json(raw)
        if data is None:
            raise ValueError(f"LLM returned non-JSON content: {raw[:300]}")

        parsed = SummarizationResult.model_validate(data)

        lines = [line.strip() for line in parsed.lines if line and line.strip()]
        if not lines:
            raise ValueError("OpenAI summarization produced no usable script lines")

        vietnamese_lines = [line.strip() for line in parsed.vietnamese_lines if line and line.strip()]
        while len(vietnamese_lines) < len(lines):
            vietnamese_lines.append("")

        logger.info("[llm] Script summary completed (lines=%d, vi_lines=%d)", len(lines), len(vietnamese_lines))
        return lines, vietnamese_lines
