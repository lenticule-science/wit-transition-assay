import { isDeepStrictEqual } from "node:util";

import { semanticJsonBytes, semanticJsonFromBytes, semanticJsonId, semanticJsonRecord } from "./semantic-json.mjs";

export const WIT_TRANSITION_ASSAY_PROFILE = "org.emsenn.obsmetrology.wit-transition-assay.v2";
const NI = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;
const CAIP10 = /^eip155:[1-9][0-9]*:0x[0-9a-fA-F]{40}$/u;
const STABLE_CELL_FIELDS = ["caller", "law", "operation", "parent", "postcondition", "precondition", "provider", "refusal"];

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function charge(value, name) {
  if (value === null || typeof value !== "object" || Object.keys(value).sort().join("\0") !== "negativeEvidence\0positiveEvidence" || typeof value.positiveEvidence !== "boolean" || typeof value.negativeEvidence !== "boolean") fail("malformed-four", `${name} must expose exactly the independent positiveEvidence and negativeEvidence bits`);
  return Object.freeze({ positiveEvidence: value.positiveEvidence, negativeEvidence: value.negativeEvidence });
}
function cell(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("malformed-wit-transition", `${name} must be an effect cell`);
  if (!NI.test(value.evidenceRoot ?? "")) fail("malformed-wit-transition", `${name}.evidenceRoot must be semantic content identity`);
  return Object.freeze({ ...structuredClone(value), outcome: charge(value.outcome, `${name}.outcome`) });
}
function cover(before, after) {
  const positive = !before.positiveEvidence && after.positiveEvidence && before.negativeEvidence === after.negativeEvidence;
  const negative = !before.negativeEvidence && after.negativeEvidence && before.positiveEvidence === after.positiveEvidence;
  if (positive === negative) fail("not-one-wit", "a WIT must be exactly one 0→1 cover transition in the FOUR knowledge order");
  return positive ? "positiveEvidence" : "negativeEvidence";
}
function withoutId(value) { const copy = { ...value }; delete copy.id; return copy; }
function exactRecord(value) { return value?.id === semanticJsonId(withoutId(value)); }

export function encodeWitTransitionAssayRequest({ proposalCell, completionCell, evidence }) {
  if (!NI.test(evidence ?? "")) fail("malformed-wit-transition", "transition evidence must be semantic content identity");
  return semanticJsonRecord({ type: "WitTransitionAssayRequest", proposalCell: cell(proposalCell, "proposalCell"), completionCell: cell(completionCell, "completionCell"), evidence });
}
export function decodeWitTransitionAssayRequest(value) {
  if (!exactRecord(value) || value.type !== "WitTransitionAssayRequest") fail("malformed-wit-transition", "WIT transition request must be exact addressed semantic JSON");
  return { proposalCell: cell(value.proposalCell, "proposalCell"), completionCell: cell(value.completionCell, "completionCell"), evidence: value.evidence };
}
export function assayWitTransition(source, { providerAccount } = {}) {
  if (!CAIP10.test(providerAccount ?? "")) fail("missing-wit-provider", "WIT transition assay requires the deployed provider's CAIP-10 account");
  const request = encodeWitTransitionAssayRequest(source);
  const proposal = request.proposalCell, completion = request.completionCell;
  const bit = cover(proposal.outcome, completion.outcome);
  for (const field of STABLE_CELL_FIELDS) if (!isDeepStrictEqual(proposal[field], completion[field])) fail("malformed-effect-transition", `${field} changed across one effect transition`);
  if (completion.evidenceRoot !== request.evidence) fail("malformed-effect-transition", "completion evidenceRoot must equal the WIT evidence identity");
  const proposalId = semanticJsonId(proposal), completionId = semanticJsonId(completion);
  const witnessTerm = semanticJsonRecord({ type: "WitTransitionWitness", proposal: proposalId, completion: completionId, evidence: request.evidence, before: proposal.outcome, after: completion.outcome, articulatedAxis: bit });
  const receipt = semanticJsonRecord({ kind: "WitTransitionAssayReceipt", profile: WIT_TRANSITION_ASSAY_PROFILE, provider: providerAccount, request: request.id, proposal: proposalId, completion: completionId, evidence: request.evidence, witness: witnessTerm.id, witnessTerm, outcome: completion.outcome });
  return { receipt, semanticId: receipt.id, canonicalBytes: semanticJsonBytes(receipt) };
}
export function decodeWitTransitionAssayReceipt(value) {
  if (!exactRecord(value) || value.kind !== "WitTransitionAssayReceipt" || value.profile !== WIT_TRANSITION_ASSAY_PROFILE || !CAIP10.test(value.provider ?? "") || !exactRecord(value.witnessTerm) || value.witness !== value.witnessTerm.id) fail("malformed-wit-transition", "WIT transition receipt is not exact current semantic content");
  charge(value.outcome, "receipt.outcome");
  return Object.freeze(value);
}
export const witTransitionBytes = semanticJsonBytes;
export const witTransitionFromBytes = semanticJsonFromBytes;
