import assert from "node:assert/strict";
import test from "node:test";
import { startWitnessJournalProviderProcess } from "@red-cup-engineering/witness-journal-rdf-projection-service/test-provider";
import { assayWitTransition as assayLocal } from "../src/assay.mjs";
import { assayWitTransition } from "../src/client.mjs";
import { startWitTransitionAssayProcess } from "../src/test-provider.mjs";
import { semanticJsonId } from "../src/semantic-json.mjs";

const ni = (label) => semanticJsonId({ type: "WitTransitionTestIdentity", label });
const exactId = ({ id: _id, ...body }) => semanticJsonId(body);
const account = (digit) => `eip155:31337:0x${digit.repeat(40)}`;
const PROVIDER_ACCOUNT = account("0");
function cell(outcome, changes = {}) { return { law: ni("law"), caller: account("1"), provider: account("2"), precondition: ni("pre"), operation: ni("operation"), postcondition: ni("post"), refusal: ni("refusal"), evidenceRoot: ni("bottom"), outcome, measures: [], parent: null, ...changes }; }

test("the die binds one exact positive-evidence cover to its smart account", () => {
  const evidence = ni("positive evidence"), proposalCell = cell({ positiveEvidence: false, negativeEvidence: false }), completionCell = cell({ positiveEvidence: true, negativeEvidence: false }, { evidenceRoot: evidence });
  const result = assayLocal({ proposalCell, completionCell, evidence }, { providerAccount: PROVIDER_ACCOUNT });
  assert.equal(result.receipt.provider, PROVIDER_ACCOUNT);
  assert.equal(result.receipt.outcome.positiveEvidence, true);
  assert.equal(result.receipt.witness, exactId(result.receipt.witnessTerm));
});

test("zero-bit, two-bit, downward, and identity-drifting revisions are refused", () => {
  const evidence = ni("refusal evidence"), neither = cell({ positiveEvidence: false, negativeEvidence: false });
  assert.throws(() => assayLocal({ proposalCell: neither, completionCell: cell({ positiveEvidence: false, negativeEvidence: false }, { evidenceRoot: evidence }), evidence }, { providerAccount: PROVIDER_ACCOUNT }), /exactly one 0→1 cover/u);
  assert.throws(() => assayLocal({ proposalCell: neither, completionCell: cell({ positiveEvidence: true, negativeEvidence: true }, { evidenceRoot: evidence }), evidence }, { providerAccount: PROVIDER_ACCOUNT }), /exactly one 0→1 cover/u);
  assert.throws(() => assayLocal({ proposalCell: cell({ positiveEvidence: true, negativeEvidence: false }), completionCell: cell({ positiveEvidence: false, negativeEvidence: false }, { evidenceRoot: evidence }), evidence }, { providerAccount: PROVIDER_ACCOUNT }), /exactly one 0→1 cover/u);
  assert.throws(() => assayLocal({ proposalCell: neither, completionCell: cell({ positiveEvidence: true, negativeEvidence: false }, { evidenceRoot: evidence, operation: ni("changed") }), evidence }, { providerAccount: PROVIDER_ACCOUNT }), /operation changed/u);
});

test("the signed A2A die returns a provider-bound receipt and records it through WitnessJournal", async () => {
  const witnessJournal = await startWitnessJournalProviderProcess(), provider = await startWitTransitionAssayProcess({ witnessJournalAgentUrl: witnessJournal.agentCardUrl });
  try {
    const evidence = ni("live evidence"), proposalCell = cell({ positiveEvidence: false, negativeEvidence: true }), completionCell = cell({ positiveEvidence: true, negativeEvidence: true }, { evidenceRoot: evidence });
    const result = await assayWitTransition({ agentUrl: provider.agentCardUrl, proposalCell, completionCell, evidence, signal: AbortSignal.timeout(10_000) });
    assert.match(result.provider, /^eip155:[1-9][0-9]*:0x[0-9a-f]{40}$/u);
    assert.equal(result.exchange.agentCard.signatures.length, 1);
    assert.equal(result.witness, exactId(result.witnessTerm));
  } finally { await provider.close(); await witnessJournal.close(); }
});
