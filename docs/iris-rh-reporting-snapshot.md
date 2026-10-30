# Íris RH reporting snapshot contract

`POST /backend/v1/access/integrations/iris/rh-reporting/snapshot` is a machine-only, read-only reporting boundary. It does not accept a PocketBase bearer token as authorization and does not create, update, delete, email, publish, or change any workflow status.

## Authentication

Configure a unique `PMAIS_IRIS_RH_REPORT_HMAC_SECRET` of at least 32 characters. It must not reuse any GV/RH login, integration, proof, API, WordPress, e-mail or external-provider credential. The route fails closed when it matches a known secret available to the runtime.

Send:

- `X-PMais-Iris-RH-Reporting-Timestamp`: current ten-digit Unix timestamp;
- `X-PMais-Iris-RH-Reporting-Signature`: lowercase hex HMAC-SHA256 of:

```text
<timestamp>\nPOST\n/backend/v1/access/integrations/iris/rh-reporting/snapshot\n<canonical-json-body>
```

Canonical JSON recursively sorts object keys and preserves array order. Timestamps outside the 60-second window are rejected. Responses use `Cache-Control: no-store`.

## Request

```json
{
  "request_version": 1,
  "resources": ["vacancies", "candidates", "pipeline_history", "candidate_history"],
  "candidate_field_set": "professional"
}
```

`resources` must be a non-empty, duplicate-free subset of the four listed resources. `candidate_field_set` is optional, applies only when `candidates` is requested, and defaults to `professional`.

- `professional` returns stable candidate/vacancy/application identifiers, name, rank, status, operational sequence, integration date, and record dates.
- `contact` returns the professional projection plus only email, phone, city, and bairro.

The response has exactly `schema_version`, `generated_at`, and `resources`. Every requested collection is fully paginated; the route applies no silent page or record cap.

## Privacy and curriculum detail

All resources use explicit field projections. The route never exposes CPF, RG, birth date, parents, emergency contacts, clothing/transport data, unrestricted observations or integration notes, full addresses, or résumé binaries.

The current GV candidate schema has no authoritative education or experience fields. This snapshot therefore does not invent them. Protected WordPress application context remains the authoritative source for curriculum education and experience detail and must be joined using the stable vacancy/candidate and `wordpress_application_id` identifiers returned here.

## Íris consumer

The governed consumer is `/home/spok/workspace/scripts/pmais_iris_rh_reporting.py`. It accepts only the exact production backend base, refuses redirects, signs without a human GV login, validates response keys and scalar types, requires `Cache-Control: no-store`, and writes the snapshot to a mode-`0600` file. Its standard output contains only schema, counts, timestamp and the protected output path.
