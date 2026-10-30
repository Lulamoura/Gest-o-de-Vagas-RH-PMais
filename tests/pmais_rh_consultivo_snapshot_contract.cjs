"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const hook = fs.readFileSync(
  path.join(root, "pocketbase/hooks/enforce_user_ativo.js"),
  "utf8",
);

const routePath =
  "/backend/v1/access/integrations/pmais-rh-consultivo/snapshot";
const routePathIndex = hook.indexOf(`'${routePath}'`);
assert.notEqual(
  routePathIndex,
  -1,
  "dedicated consultative snapshot route must exist",
);
const routeStart = hook.lastIndexOf("routerAdd(", routePathIndex);
const routeEnd = hook.indexOf("routerAdd(", routePathIndex);
const route = hook.slice(routeStart, routeEnd === -1 ? hook.length : routeEnd);

assert.match(route, /PMAIS_RH_CONSULTIVO_GV_PREVIEW_HMAC_SECRET/);
assert.match(route, /PMAIS_RH_CONSULTIVO_GV_PREVIEW_ENABLED/);
assert.match(route, /PMAIS_RH_CONSULTIVO_GV_RUNTIME_ENV/);
assert.match(route, /PMAIS_IRIS_GV_HMAC_SECRET/);
assert.match(route, /runtimeEnvironment\s*!==\s*'preview'/);
assert.match(route, /secret\.length\s*<\s*32/);
assert.match(route, /secret\s*===\s*irisSecret/);
assert.match(route, /enabled\s*!==\s*'true'/);
assert.match(route, /X-PMais-Consultivo-Timestamp/);
assert.match(route, /X-PMais-Consultivo-Signature/);
assert.match(route, /\$security\.hs256/);
assert.match(route, /\$security\.equal/);
assert.match(route, /Math\.abs\([\s\S]*?>\s*60/);
assert.match(route, /readAll\('vacancies'\)/);
assert.match(route, /readAll\('candidates'\)/);
assert.match(route, /candidate_status_counts/);
assert.match(route, /priority_45/);
assert.match(route, /vacancies_processed/);
assert.match(route, /candidates_processed/);

for (const forbidden of [
  "PMAIS_GV_USER",
  "PMAIS_GV_PASS",
  "auth-with-password",
  "newStaticAuthToken",
  "recordAuthResponse",
  "findAuthRecordByEmail",
]) {
  assert.equal(
    route.includes(forbidden),
    false,
    `snapshot route must not use ${forbidden}`,
  );
}

for (const forbiddenCandidateField of [
  "nome",
  "email",
  "telefone",
  "cpf",
  "rg",
  "data_nascimento",
  "bairro",
  "observacao",
  "observacoes",
  "informacoes_integracao",
]) {
  const candidateRead = new RegExp(
    `candidate\\.get(?:String|Bool|Int|Float)?\\(['\"]${forbiddenCandidateField}['\"]\\)`,
  );
  assert.equal(
    candidateRead.test(route),
    false,
    `snapshot route must not read candidate field ${forbiddenCandidateField}`,
  );
}

console.log("PMais RH consultative snapshot contract passed");
