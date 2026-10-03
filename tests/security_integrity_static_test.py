#!/usr/bin/env python3
"""Static acceptance fixtures for the SKIP GV Wave 1 security/integrity contract."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOK = (ROOT / "pocketbase/hooks/requisition_wordpress_draft.js").read_text(encoding="utf-8")
SERVICE = (ROOT / "src/services/requisitions.ts").read_text(encoding="utf-8")
PAGE = (ROOT / "src/pages/RequisitionDetail.tsx").read_text(encoding="utf-8")
RICH_EDITOR = (ROOT / "src/components/RichTextEditor.tsx").read_text(encoding="utf-8")
IRIS_PUBLIC_HTML_PATH = ROOT / "src/lib/iris-public-html.ts"
IRIS_PUBLIC_HTML = IRIS_PUBLIC_HTML_PATH.read_text(encoding="utf-8") if IRIS_PUBLIC_HTML_PATH.exists() else ""


def require(source: str, pattern: str, message: str) -> None:
    if not re.search(pattern, source, re.MULTILINE | re.DOTALL):
        raise AssertionError(message)


def forbid(source: str, pattern: str, message: str) -> None:
    if re.search(pattern, source, re.MULTILINE | re.DOTALL):
        raise AssertionError(message)


def test_canonical_actor() -> None:
    require(HOOK, r"function\s+resolveCanonicalActor|var\s+resolveCanonicalActor", "missing canonical actor resolver")
    require(HOOK, r"findRecordById\(['\"]users['\"],\s*authId\)", "actor is not reloaded from users")
    require(HOOK, r"collection.*users|users.*collection", "auth collection is not checked")
    if HOOK.count("authorizeRhOrAdmin(e)") < 2:
        raise AssertionError("both routes must resolve and authorize the canonical users actor")
    forbid(HOOK, r"e\.auth\.getString", "authorization still trusts mutable auth snapshot fields")
    forbid(HOOK, r"getBool\(['\"]active['\"]\)|getString\(['\"]active['\"]", "hook assumes nonexistent active field")


def test_source_fingerprint_and_proof_binding() -> None:
    require(HOOK, r"buildSourceSnapshot", "missing authoritative source snapshot")
    require(HOOK, r"sourceFingerprint", "missing deterministic source fingerprint")
    require(HOOK, r"\$security\.sha256", "source/content hashes must use PocketBase sha256")
    for field in (
        "updated", "status", "numero_oe", "quantidade_vagas", "prioridade",
        "prazo_desejado", "faixa_salarial", "jornada", "horario", "escala",
        "remuneracao", "beneficios", "requisitos", "escolaridade", "experiencia",
        "especificacoes", "justificativa", "observacoes_internas", "cargo", "cliente",
        "cidade", "tipo_vaga", "tipo_contrato", "departamento", "solicitante",
    ):
        require(HOOK, rf"buildSourceSnapshot[\s\S]*?{field}", f"source snapshot omits {field}")
    require(HOOK, r"suggestion_proof[\s\S]*source_fingerprint", "suggestion proof does not return source fingerprint")
    require(HOOK, r"proofCanonical[\s\S]*sourceFingerprint", "HMAC canonical proof is not bound to source fingerprint")
    require(HOOK, r"stale|desatualiz|fonte.*alter", "draft confirmation does not reject a stale requisition")


def test_limits_are_rejections() -> None:
    for limit in (160, 10000, 8000):
        require(HOOK, rf"\.length\s*>\s*{limit}", f"missing {limit}-character server limit")
    require(HOOK, r"e\.json\(422", "oversized reviewed fields must return HTTP 422")
    forbid(HOOK, r"tituloPublicoIris\s*=\s*tituloPublicoIris\.substring", "title is still silently truncated")
    forbid(HOOK, r"descricaoPublicaIris\s*=\s*descricaoPublicaIris\.substring", "public text is still silently truncated")
    forbid(HOOK, r"perfilInternoIris\s*=\s*perfilInternoIris\.substring", "internal profile is still silently truncated")


def test_preview_gate_and_wordpress_url() -> None:
    gate = HOOK.find("PMAIS_WORDPRESS_DRAFT_ENABLED")
    token = HOOK.find("WORDPRESS_INTEGRATION_TOKEN")
    send = HOOK.find("$http.send", gate)
    if min(gate, token, send) < 0 or not gate < token < send:
        raise AssertionError("Preview mutation gate must run before WordPress token read/network write")
    require(HOOK, r"previewGate\s*!==\s*['\"]true['\"]", "gate must require exact string true")
    forbid(HOOK, r"var\s+previewGate\s*=[^\n]*\.trim\(\)", "gate must not normalize values other than exact true")
    require(HOOK, r"e\.json\(503[\s\S]{0,300}(desabilitad|não habilitad)", "disabled gate must return a clear 503")
    require(HOOK, r"PMAIS_WORDPRESS_DRAFT_URL", "WordPress URL is not sourced from its secret")
    require(HOOK, r"approvedWpHost|WORDPRESS_APPROVED_HOST", "missing exact approved WordPress host check")
    require(HOOK, r"approvedWpPath|WORDPRESS_APPROVED_PATH", "missing exact approved WordPress path check")
    forbid(HOOK, r"https://pmaisservicos\.com\.br/wp-json/pmais-skip/v1/requisicoes/vagas", "full WordPress endpoint must not be hardcoded")


def test_verified_wordpress_response_and_atomic_success() -> None:
    require(HOOK, r"verified\s*(?:===\s*true|!==\s*true)", "WordPress response verified=true is not mandatory")
    require(HOOK, r"post_status[\s\S]{0,80}draft", "WordPress response post_status=draft is not mandatory")
    for key in ("titulo_sha256", "descricao_publica_sha256", "perfil_interno_sha256"):
        require(HOOK, key, f"missing exact WordPress verification hash: {key}")
    require(HOOK, r"duplicate[\s\S]{0,500}verified|verified[\s\S]{0,500}duplicate", "duplicate is not bound to exact verification")
    require(HOOK, r"\$app\.runInTransaction", "requisition success and history are not transactional")
    transaction = re.search(r"\$app\.runInTransaction\([\s\S]+?\n\s*\}\)", HOOK)
    if not transaction or transaction.group(0).count(".save(") < 2:
        raise AssertionError("transaction must persist both requisition and history")
    require(HOOK, r"proof_request_id", "audit observation lacks proof request_id")
    require(HOOK, r"second_brain_version", "audit observation lacks second-brain version")
    require(HOOK, r"second_brain_sha256", "audit observation lacks second-brain sha256")
    require(HOOK, r"source_fingerprint", "audit observation lacks source fingerprint")
    require(HOOK, r"reviewed_field_hashes", "audit observation lacks reviewed-field hashes")
    observation = re.search(
        r"var\s+auditObservation\s*=\s*JSON\.stringify\((\{[\s\S]*?\})\)", HOOK
    )
    if not observation:
        raise AssertionError("audit observation is not a structured JSON object")
    for content_variable in ("publicTitle", "publicDescription", "internalProfile"):
        forbid(observation.group(1), content_variable, "audit observation contains reviewed content")
    forbid(HOOK, r"history save failed", "history failure is still swallowed")


def test_gateway_signed_atomic_commit_endpoint() -> None:
    require(
        HOOK,
        r"/backend/v1/requisitions/\{id\}/wordpress-draft-commit",
        "missing dedicated atomic WordPress commit endpoint",
    )
    require(HOOK, r"pmais_gv_wordpress_commit_v1", "missing commit schema version")
    require(HOOK, r"X-PMais-Timestamp", "commit endpoint does not require a timestamp")
    require(HOOK, r"X-PMais-Signature", "commit endpoint does not require a gateway signature")
    require(HOOK, r"PMAIS_IRIS_GV_HMAC_SECRET", "commit endpoint lacks its server-side HMAC secret")
    require(HOOK, r"canonicalCommitJson", "commit HMAC is not based on order-independent canonical JSON")
    require(HOOK, r"proofExpiresAt\s*<=\s*nowSeconds", "commit endpoint does not expire proof at the exact deadline")
    require(HOOK, r"reviewed_fields", "commit endpoint does not receive exact reviewed fields")
    require(HOOK, r"wordpress_sync_date", "commit endpoint lacks an explicit signed Recife sync date")
    require(HOOK, r"successRecord\.set\(['\"]wordpress_sync_date['\"],\s*wordpressSyncDate\)", "commit endpoint does not persist the signed Recife sync date")
    require(HOOK, r"wordpress_http_status", "commit endpoint does not verify duplicate/status semantics")
    require(HOOK, r"duplicate_local", "commit endpoint lacks idempotent local replay semantics")
    require(HOOK, r"\$app\.runInTransaction", "commit endpoint does not persist atomically")


def test_generation_response_contract() -> None:
    for token in (
        "pmais_iris_gv_rh_job_description_response_v1",
        "generate_job_description_package",
        "gatewayPayload.agent !== 'iris'",
        "gatewayPayload.fallback !== false",
        "audit.request_id",
        "audit.requisition_id",
        "audit.second_brain_version",
        "audit.second_brain_sha256",
        "audit.source_fingerprint",
    ):
        if token not in HOOK:
            raise AssertionError(f"generation response validation missing {token}")
    require(
        HOOK,
        r"responseSourceFingerprint\s*=\s*safeString\(audit\.source_fingerprint\)",
        "Gateway response does not read the audited source fingerprint",
    )
    require(
        HOOK,
        r"constantTimeEqual\(responseSourceFingerprint,\s*currentSourceFingerprint\)",
        "Gateway response is not bound to the exact source fingerprint sent by the hook",
    )


def test_reviewed_content_protected_criteria_gate_precedes_wordpress_mutation() -> None:
    require(HOOK, r"normalizeProtectedCriteriaText", "missing accent/case normalization")
    require(HOOK, r"findProtectedCriterion", "missing reviewed-content protected-criteria validator")
    for category in (
        "age",
        "gender_sex",
        "marital_status",
        "religion",
        "health_disability",
        "address_neighborhood",
        "race_ethnicity",
        "sexual_orientation",
        "pregnancy",
        "appearance_photo",
        "children_dependents_family_status",
    ):
        require(HOOK, rf"category:\s*['\"]{category}['\"]", f"missing protected category {category}")

    extraction = HOOK.index("var publicTitle")
    gate = HOOK.index("findProtectedCriterion", extraction)
    wordpress_response = HOOK.index("var wordpressResponse", gate)
    send = HOOK.index("$http.send", wordpress_response)
    if not extraction < gate < wordpress_response < send:
        raise AssertionError("reviewed-content validation must run after edits and before WordPress mutation")
    between_gate_and_send = HOOK[gate:send]
    require(between_gate_and_send, r"e\.json\(422", "protected reviewed content must return HTTP 422")
    for field in ("titulo_publico", "descricao_publica", "perfil_interno_triagem"):
        require(between_gate_and_send, field, f"protected gate omits exact reviewed field {field}")


def test_frontend_review_contract() -> None:
    for field in (
        "titulo_publico_iris",
        "descricao_publica_iris",
        "perfil_interno_triagem_iris",
        "source_fingerprint",
        "second_brain_sha256",
    ):
        if field not in SERVICE:
            raise AssertionError(f"frontend service contract missing {field}")
    for state in ("irisTitle", "irisText", "irisInternalProfile"):
        require(PAGE, rf"value=\{{{state}\}}[\s\S]{{0,150}}onChange=", f"{state} is no longer human-editable")
    require(
        PAGE,
        r"<RichTextEditor\s+value=\{irisText\}[\s\S]{0,220}onChange=\{setIrisText\}[\s\S]{0,220}showHtmlToggle=\{false\}[\s\S]{0,220}sanitizeHtml=\{sanitizeIrisPublicHtml\}",
        "public WordPress HTML must be shown in a sanitized visual rich-text editor",
    )
    forbid(
        PAGE,
        r"<Textarea\s+value=\{irisText\}",
        "public WordPress HTML must not be exposed as literal tags in a textarea",
    )
    require(PAGE, r"sanitizeIrisPublicHtml\(suggestion\.descricao_publica\)", "generated public HTML must be sanitized before display")
    require(RICH_EDITOR, r"showHtmlToggle\?:\s*boolean", "rich-text editor must support hiding raw HTML mode")
    require(RICH_EDITOR, r"sanitizeHtml\?:\s*\(value:\s*string\)\s*=>\s*string", "rich-text editor must sanitize edited HTML")
    require(
        RICH_EDITOR,
        r"const\s+emitEditorValue[\s\S]*?onChange\(cleanValue\)",
        "rich-text editor must emit only sanitized HTML",
    )
    forbid(
        RICH_EDITOR,
        r"const\s+emitEditorValue\s*=\s*\(\)\s*=>\s*\{[^}]*editorRef\.current\.innerHTML\s*=",
        "onInput sanitization must not rewrite innerHTML and reset the caret",
    )
    require(RICH_EDITOR, r"onBlur=\{normalizeEditorValue\}", "editor DOM must normalize after editing")
    require(RICH_EDITOR, r"onKeyDown=\{handleEditorKeyDown\}", "editor must normalize line breaks without moving the caret")
    require(RICH_EDITOR, r"onPaste=\{handleEditorPaste\}", "pasted HTML must be sanitized before insertion")
    require(RICH_EDITOR, r"onDrop=\{handleEditorDrop\}", "dropped content must be intercepted before DOM insertion")
    require(RICH_EDITOR, r"event\.preventDefault\(\)[\s\S]{0,600}dataTransfer\.getData\('text/html'\)[\s\S]{0,600}sanitizeHtml", "dropped HTML must be prevented and sanitized before insertion")
    require(RICH_EDITOR, r"onBeforeInput=\{handleEditorBeforeInput\}", "drop beforeinput must fail closed")
    require(RICH_EDITOR, r"inputType\s*===\s*'insertFromDrop'[\s\S]{0,120}preventDefault", "native drop insertion must be blocked")
    require(IRIS_PUBLIC_HTML, r"DOMPurify\.sanitize", "Íris public HTML must use a vetted sanitizer")
    require(IRIS_PUBLIC_HTML, r"ALLOWED_ATTR:\s*\[\]", "Íris public HTML must reject all HTML attributes")
    expected_tags = {"p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "ul", "ol", "li"}
    tag_block = re.search(r"const\s+IRIS_PUBLIC_HTML_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const", IRIS_PUBLIC_HTML)
    if not tag_block:
        raise AssertionError("Íris sanitizer allowlist is missing")
    actual_tags = set(re.findall(r"['\"]([a-z0-9]+)['\"]", tag_block.group(1)))
    if actual_tags != expected_tags:
        raise AssertionError(f"Íris sanitizer allowlist differs: {actual_tags!r}")
    require(PAGE, r"sugestão expira em 15 minutos", "UI proof TTL must match the 900-second Gateway TTL")
    require(
        PAGE,
        r"descricao_publica_iris:\s*irisText,",
        "the exact sanitized HTML reviewed by RH must be sent to WordPress",
    )
    forbid(
        PAGE,
        r"descricao_publica_iris:\s*irisText\.trim\(\)",
        "reviewed public HTML must not be silently changed during submission",
    )
    if PAGE.count("createWordpressDraft(") != 1:
        raise AssertionError("unexpected legacy/direct WordPress mutation path in page")
    forbid(PAGE, r">\s*Criar vaga no WordPress\s*<", "old direct WordPress button returned")


def test_frontend_uses_preview_browser_adapter() -> None:
    expected_fragments = (
        "https://agents.pmaisservicos.com.br/preview/iris-gv",
        "/v1/pessoas/iris/gv-rh/browser/requisitions/",
        "/job-description-package",
        "/wordpress-draft",
        "pb.authStore.token",
        "Authorization: `Bearer ${token}`",
    )
    for fragment in expected_fragments:
        if fragment not in SERVICE:
            raise AssertionError(f"frontend browser adapter contract missing {fragment}")
    for legacy_route in (
        "/backend/v1/iris/requisitions/",
        "/backend/v1/requisitions/${id}/wordpress-draft",
    ):
        if legacy_route in SERVICE:
            raise AssertionError(f"legacy PocketBase transport remains active: {legacy_route}")
    for secret_name in (
        "PMAIS_IRIS_GV_API_KEY",
        "PMAIS_IRIS_GV_HMAC_SECRET",
        "IRIS_HERMES_SECRET",
    ):
        if secret_name in SERVICE:
            raise AssertionError(f"frontend must not reference server secret {secret_name}")


def test_manifest() -> None:
    manifest_path = ROOT / "manifest.json"
    if not manifest_path.exists():
        # The canonical Git repository provides integrity through its commit tree;
        # manifest.json is required only in the detached SKIP handoff bundle.
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = {entry["path"]: entry for entry in manifest["files"]}
    expected = {
        "pocketbase/hooks/requisition_wordpress_draft.js",
        "src/services/requisitions.ts",
        "src/pages/RequisitionDetail.tsx",
        "tests/security_integrity_static_test.py",
        "tests/protected_criteria_node_test.js",
    }
    if set(entries) != expected:
        raise AssertionError(f"manifest paths differ: {set(entries)!r}")
    for rel in sorted(expected):
        data = (ROOT / rel).read_bytes()
        if entries[rel].get("bytes") != len(data):
            raise AssertionError(f"wrong byte size for {rel}")
        if entries[rel].get("sha256") != hashlib.sha256(data).hexdigest():
            raise AssertionError(f"wrong sha256 for {rel}")


def main() -> None:
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print(f"PASS {len(tests)} static acceptance fixtures")


if __name__ == "__main__":
    main()
