import logging
import re
from typing import TypedDict

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 5000

# Risk weights per threat category
CATEGORY_WEIGHTS = {
    "sqli": 0.9,
    "prompt_injection": 0.8,
    "xss": 0.7,
    "data_exfil": 0.65,
    "role_hijack": 0.45,
}

HIGH_RISK_THRESHOLD = 0.7   # >= this → is_safe=False (block from LLM)
WARN_THRESHOLD = 0.3        # >= this → is_safe=True but flagged as warning


class GuardrailResult(TypedDict):
    is_safe: bool
    risk_score: float
    threats_detected: list
    sanitized_text: str


THREAT_PATTERNS = [
    # ── Prompt injection ─────────────────────────────────────────────────────
    (r"ignore\s+(previous|prior|all)\s+(instructions?|prompts?|context)", "prompt_injection:ignore_instructions"),
    (r"forget\s+(your|all|the)\s+(instructions?|training|context|rules)", "prompt_injection:forget_instructions"),
    (r"you\s+are\s+now\s+(a|an|the)\b", "prompt_injection:role_override"),
    (r"\bact\s+as\b.{0,40}\b(admin|root|god|hacker|assistant\s+without|uncensored|unrestricted)", "prompt_injection:act_as_privileged"),
    (r"\bpretend\s+to\s+be\b", "prompt_injection:pretend_to_be"),
    (r"\bsystem\s*:", "prompt_injection:system_marker"),
    (r"\bnew\s+instructions?\b", "prompt_injection:new_instructions"),
    (r"\boverride\s+(safety|security|guidelines|restrictions|rules)\b", "prompt_injection:override_safety"),
    (r"\bdisregard\s+(all|your|previous|prior)\b", "prompt_injection:disregard"),
    (r"\bjailbreak\b", "prompt_injection:jailbreak"),
    # ── SQL injection ────────────────────────────────────────────────────────
    (r"\bDROP\s+(TABLE|DATABASE|SCHEMA)\b", "sqli:drop_statement"),
    (r"\bDELETE\s+FROM\b", "sqli:delete_statement"),
    (r"\bUNION\s+(ALL\s+)?SELECT\b", "sqli:union_select"),
    (r";\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b", "sqli:stacked_query"),
    (r"--\s*$", "sqli:comment_terminator"),
    (r"'?\s*OR\s*'?1'?\s*=\s*'?1", "sqli:tautology"),
    (r"SLEEP\s*\(\s*\d+\s*\)", "sqli:time_based"),
    # ── XSS ──────────────────────────────────────────────────────────────────
    (r"<\s*script[\s>]", "xss:script_tag"),
    (r"javascript\s*:", "xss:javascript_protocol"),
    (r"on(load|error|click|mouseover|focus|blur|submit)\s*=", "xss:event_handler"),
    (r"<\s*iframe[\s>]", "xss:iframe_tag"),
    (r"data\s*:\s*text/html", "xss:data_uri"),
    # ── Data exfiltration ────────────────────────────────────────────────────
    (r"\bsend\s+(this|the|all|data|info(rmation)?|results?)\s+to\b", "data_exfil:send_to"),
    (r"\bforward\s+(this|the|all|data|results?)\s+to\b", "data_exfil:forward_to"),
    (r"\bemail\s+(me|this|it|the\s+results?)\s+(at|to)\b", "data_exfil:email_me"),
    (r"\bexfiltrate\b", "data_exfil:explicit"),
    (r"https?://(?!example\.com)[^\s]{20,}", "data_exfil:suspicious_url"),
    # ── Role hijacking ────────────────────────────────────────────────────────
    (r"\broleplay\s+(as|a|an)\b", "role_hijack:roleplay"),
    (r"\bact\s+as\b.{0,20}(assistant|ai|bot|model|gpt|claude|gemini)", "role_hijack:act_as_ai"),
    (r"\byou\s+are\s+(an?\s+)?(different|new|other|another|better|evil|unrestricted)\b", "role_hijack:you_are_other"),
    (r"\bpersona\s*(switch|change|mode)\b", "role_hijack:persona_switch"),
]

_COMPILED = [
    (re.compile(pat, re.IGNORECASE | re.MULTILINE), label)
    for pat, label in THREAT_PATTERNS
]

# Control-character pattern (keep \t, \n, \r)
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def check_prompt_injection(text: str) -> GuardrailResult:
    # Sanitize: strip control chars and truncate
    text = _CTRL_RE.sub("", text)[:MAX_TEXT_LENGTH]

    threats_detected = []
    matched_categories: set[str] = set()

    for pattern, label in _COMPILED:
        if pattern.search(text):
            threats_detected.append(label)
            category = label.split(":")[0]
            matched_categories.add(category)
            logger.debug(f"Guardrail threat detected: {label}")

    # ── Risk scoring ──────────────────────────────────────────────────────
    if not matched_categories:
        risk_score = 0.0
    else:
        max_weight = max(CATEGORY_WEIGHTS.get(c, 0.5) for c in matched_categories)
        # Each additional threat category adds diminishing risk
        additional = max(0, len(matched_categories) - 1)
        risk_score = min(1.0, max_weight + 0.05 * additional)

    risk_score = round(risk_score, 3)
    is_safe = risk_score < HIGH_RISK_THRESHOLD

    # Sanitize text: replace all matched patterns with [REDACTED]
    sanitized = text
    if threats_detected:
        for pattern, _ in _COMPILED:
            sanitized = pattern.sub("[REDACTED]", sanitized)

    if threats_detected:
        logger.info(
            f"Guardrail result: risk={risk_score}, is_safe={is_safe}, "
            f"threats={threats_detected}, categories={matched_categories}"
        )

    return GuardrailResult(
        is_safe=is_safe,
        risk_score=risk_score,
        threats_detected=threats_detected,
        sanitized_text=sanitized,
    )
