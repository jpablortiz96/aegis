import json
import re
import os
import base64

import httpx

from app.config import settings


# ---------------------------------------------------------------------------
# Prompt helper — also imported by orchestrator.py for Langfuse logging
# ---------------------------------------------------------------------------

def build_prompt(title: str, description: str) -> str:
    return (
        "You are an expert SRE engineer triaging incidents for an e-commerce platform "
        "(Reaction Commerce - Node.js). Analyze the incident and respond with ONLY a valid JSON object. "
        "No markdown, no backticks, no explanation. Just the JSON:\n"
        '{"severity": "critical|high|medium|low", '
        '"category": "checkout|payment|inventory|authentication|ui|performance|other", '
        '"technical_summary": "2-3 sentences describing the issue technically", '
        '"probable_root_cause": "1 sentence with the most likely cause", '
        '"recommended_action": "1 sentence with what to do next"}\n\n'
        f"Incident Title: {title}\nDescription: {description}"
    )


# ---------------------------------------------------------------------------
# Main entry point — called by orchestrator.py
# ---------------------------------------------------------------------------

async def analyze_incident(
    title: str,
    description: str,
    image_path: str = None,
    has_threats: bool = False,
) -> dict:
    """Try Gemini REST API, fall back to rule-based on any failure."""

    if not settings.gemini_api_key:
        print("[TRIAGE] No GEMINI_API_KEY set — using rule-based fallback", flush=True)
        return _rule_based_fallback(title, description, "No API key configured")

    try:
        result = await _call_gemini_rest(title, description, image_path, has_threats)
        return result
    except Exception as exc:
        print(f"[TRIAGE] Gemini failed: {exc}", flush=True)
        return _rule_based_fallback(title, description, str(exc))


# ---------------------------------------------------------------------------
# Gemini REST (httpx — no SDK, no import-time issues)
# ---------------------------------------------------------------------------

def _extract_field(text: str, field: str, default: str) -> str:
    """Extract a field value from malformed JSON using regex."""
    pattern = rf'"{field}"\s*:\s*"((?:[^"\\]|\\.{{0,500}}))"'
    match = re.search(pattern, text)
    if match:
        return match.group(1).replace('\\"', '"').replace('\\n', ' ')
    return default


async def _call_gemini_rest(
    title: str,
    description: str,
    image_path: str = None,
    has_threats: bool = False,
) -> dict:
    model   = settings.gemini_model
    api_key = settings.gemini_api_key

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    system_instruction = (
        "You are an expert SRE engineer triaging incidents for an e-commerce platform "
        "(Reaction Commerce - Node.js). Analyze the incident and respond with ONLY a valid JSON object. "
        "No markdown, no backticks, no explanation. Just the JSON:\n"
        '{"severity": "critical|high|medium|low", '
        '"category": "checkout|payment|inventory|authentication|ui|performance|other", '
        '"technical_summary": "2-3 sentences describing the issue technically", '
        '"probable_root_cause": "1 sentence with the most likely cause", '
        '"recommended_action": "1 sentence with what to do next"}'
    )

    user_text = f"Incident Title: {title}\nDescription: {description}"
    parts = [{"text": user_text}]

    # Attach image if present and text is clean
    if image_path and not has_threats:
        for try_path in [image_path, f"/app{image_path}", f".{image_path}"]:
            if os.path.exists(try_path):
                with open(try_path, "rb") as f:
                    img_bytes = f.read()
                img_b64 = base64.b64encode(img_bytes).decode()
                mime = "image/png" if try_path.lower().endswith(".png") else "image/jpeg"
                parts.append({
                    "inline_data": {
                        "mime_type": mime,
                        "data": img_b64,
                    }
                })
                print(f"[TRIAGE] Image attached from {try_path}", flush=True)
                break
        else:
            print(f"[TRIAGE] WARNING: image not found for path: {image_path}", flush=True)

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1000,
        },
    }

    print(f"[TRIAGE] Calling Gemini REST API, model={model}", flush=True)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)

    print(f"[TRIAGE] Response status: {response.status_code}", flush=True)

    if response.status_code != 200:
        error_text = response.text[:500]
        print(f"[TRIAGE] Error response: {error_text}", flush=True)
        raise Exception(f"Gemini API error {response.status_code}: {error_text}")

    data = response.json()

    content = data["candidates"][0]["content"]["parts"][0]["text"]
    print(f"[TRIAGE] Raw LLM response: {content[:300]}", flush=True)

    # Parse JSON from response - robust handling
    # Remove markdown backticks if present
    cleaned = content.strip()
    json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', cleaned, re.DOTALL)
    if json_match:
        cleaned = json_match.group(1).strip()

    # Find JSON object
    json_obj_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned, re.DOTALL)
    if json_obj_match:
        cleaned = json_obj_match.group(0)

    # Fix common JSON issues
    # Replace newlines inside strings
    cleaned = cleaned.replace('\n', ' ').replace('\r', ' ')
    # Fix trailing commas
    cleaned = re.sub(r',\s*}', '}', cleaned)
    cleaned = re.sub(r',\s*]', ']', cleaned)

    print(f"[TRIAGE] Cleaned JSON to parse: {cleaned[:500]}", flush=True)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        print(f"[TRIAGE] JSON parse failed: {exc}", flush=True)
        print(f"[TRIAGE] Raw content was: {content}", flush=True)
        # Extract fields manually with regex as last resort
        result = {
            "severity": _extract_field(content, "severity", "medium"),
            "category": _extract_field(content, "category", "other"),
            "technical_summary": _extract_field(content, "technical_summary", f"AI analysis of: {title}"),
            "probable_root_cause": _extract_field(content, "probable_root_cause", "Requires further investigation"),
            "recommended_action": _extract_field(content, "recommended_action", "Escalate to engineering team"),
            "_parse_fallback": True,
        }

    # Normalise / validate fields
    valid_severities = {"critical", "high", "medium", "low"}
    if result.get("severity") not in valid_severities:
        result["severity"] = "medium"

    valid_categories = {"checkout", "payment", "inventory", "authentication", "ui", "performance", "other"}
    if result.get("category") not in valid_categories:
        result["category"] = "other"

    for field in ("technical_summary", "probable_root_cause", "recommended_action"):
        if field not in result:
            result[field] = "Not available"

    usage = data.get("usageMetadata", {})
    result["_provider"] = "gemini"
    result["_model"]    = model
    result["_tokens"]   = {
        "input":  usage.get("promptTokenCount", 0),
        "output": usage.get("candidatesTokenCount", 0),
    }
    # _meta for Langfuse (orchestrator pops this before saving to DB)
    result["_meta"] = {
        "provider":     f"gemini/{model}",
        "prompt":       build_prompt(title, description),
        "raw_response": data["candidates"][0]["content"]["parts"][0]["text"],
        "usage": {
            "input":  usage.get("promptTokenCount"),
            "output": usage.get("candidatesTokenCount"),
            "total":  usage.get("totalTokenCount"),
        },
    }

    print(
        f"[TRIAGE] SUCCESS: severity={result['severity']}, category={result['category']}",
        flush=True,
    )
    return result


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

def _rule_based_fallback(title: str, description: str, error: str = None) -> dict:
    text = f"{title} {description}".lower()

    if any(w in text for w in ["down", "outage", "crash", "500", "unresponsive"]):
        severity = "critical"
    elif any(w in text for w in ["payment", "checkout", "purchase", "billing", "charge",
                                  "error", "fail", "broken", "exception"]):
        severity = "high"
    elif any(w in text for w in ["slow", "timeout", "delay", "latency", "loading"]):
        severity = "medium"
    else:
        severity = "low"

    categories = {
        "checkout":       ["checkout", "cart", "order", "purchase"],
        "payment":        ["payment", "pay", "billing", "charge", "stripe", "card"],
        "inventory":      ["inventory", "stock", "product", "catalog", "quantity"],
        "authentication": ["login", "auth", "password", "session", "register", "signup"],
        "ui":             ["display", "layout", "css", "render", "visual", "button", "page"],
        "performance":    ["slow", "timeout", "latency", "speed", "loading"],
    }

    category = "other"
    for cat, keywords in categories.items():
        if any(k in text for k in keywords):
            category = cat
            break

    summary = f"Incident detected: {title}. Rule-based triage applied."
    if error:
        summary += f" LLM error: {error[:150]}"

    return {
        "severity": severity,
        "category": category,
        "technical_summary": summary,
        "probable_root_cause": "Root cause analysis requires a working LLM provider.",
        "recommended_action": "Review logs and escalate to on-call engineer.",
        "_fallback": True,
        "_meta": {
            "provider":     "fallback",
            "prompt":       build_prompt(title, description),
            "raw_response": "",
            "usage":        None,
        },
    }
