import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { semanticId } from "@emsenn/rmn-semantic-conformance";
import { startRwilProviderProcess } from "@emsenn/rwil-rdf-services/test-provider";
import { assayWitTransition as assayLocal, PROVIDER_ACCOUNT } from "../src/assay.mjs";
import { assayWitTransition } from "../src/client.mjs";
import { startWitTransitionAssayProcess } from "../src/test-provider.mjs";

const ni = (label) => `ni:///sha-256;${createHash("sha256").update(label).digest("base64url")}`;
const account = (digit) => `eip155:31337:0x${digit.repeat(40)}`;
function cell(outcome, changes = {}) { return { law: ni("law"), caller: account("1"), provider: account("2"), precondition: ni("pre"), operation: ni("operation"), postcondition: ni("post"), refusal: ni("refusal"), evidenceRoot: ni("bottom"), outcome, measures: [], parent: null, ...changes }; }

test("the die binds one exact positive-evidence cover to its smart account", () => {
  const evidence = ni("positive evidence"), proposalCell = cell({ positiveEvidence: false, negativeEvidence: false }), completionCell = cell({ positiveEvidence: true, negativeEvidence: false }, { evidenceRoot: evidence });
  const result = assayLocal({ proposalCell, completionCell, evidence });
  assert.equal(result.receipt.provider, PROVIDER_ACCOUNT);
  assert.equal(result.receipt.outcome.positiveEvidence, true);
  assert.equal(result.receipt.witness, semanticId(result.receipt.witnessTerm));
});

test("zero-bit, two-bit, downward, and identity-drifting revisions are refused", () => {
  const evidence = ni("refusal evidence"), neither = cell({ positiveEvidence: false, negativeEvidence: false });
  assert.throws(() => assayLocal({ proposalCell: neither, completionCell: cell({ positiveEvidence: false, negativeEvidence: false }, { evidenceRoot: evidence }), evidence }), /exactly one 0→1 cover/u);
  assert.throws(() => assayLocal({ proposalCell: neither, completionCell: cell({ positiveEvidence: true, negativeEvidence: true }, { evidenceRoot: evidence }), evidence }), /exactly one 0→1 cover/u);
  assert.throws(() => assayLocal({ proposalCell: cell({ positiveEvidence: true, negativeEvidence: false }), completionCell: cell({ positiveEvidence: false, negativeEvidence: false }, { evidenceRoot: evidence }), evidence }), /exactly one 0→1 cover/u);
  assert.throws(() => assayLocal({ proposalCell: neither, completionCell: cell({ positiveEvidence: true, negativeEvidence: false }, { evidenceRoot: evidence, operation: ni("changed") }), evidence }), /operation changed/u);
});

test("the signed A2A die returns a provider-bound receipt and records it through RWIL", async () => {
  const rwil = await startRwilProviderProcess(), provider = await startWitTransitionAssayProcess({ rwilAgentUrl: rwil.agentCardUrl });
  try {
    const evidence = ni("live evidence"), proposalCell = cell({ positiveEvidence: false, negativeEvidence: true }), completionCell = cell({ positiveEvidence: true, negativeEvidence: true }, { evidenceRoot: evidence });
    const result = await assayWitTransition({ agentUrl: provider.agentCardUrl, proposalCell, completionCell, evidence, signal: AbortSignal.timeout(10_000) });
    assert.equal(result.provider, PROVIDER_ACCOUNT);
    assert.equal(result.exchange.agentCard.signatures.length, 1);
    assert.equal(result.witness, semanticId(result.witnessTerm));
  } finally { await provider.close(); await rwil.close(); }
});
