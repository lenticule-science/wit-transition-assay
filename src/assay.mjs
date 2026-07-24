import { assayEffectTransition, checkTerm, semanticBytes, semanticId } from "@emsenn/rmn-semantic-conformance";
import { validateFour } from "@emsenn/rmn-semantic-conformance/four";
import { decodeRelationalValue, encodeRelationalValue, RELATIONAL_VALUE_TYPE } from "@emsenn/rmn-semantic-conformance/relational-value";

export const WIT_TRANSITION_ASSAY_PROFILE = "org.emsenn.obsmetrology.wit-transition-assay.v1";
export const PROVIDER_ACCOUNT = "eip155:31337:0x0aadad1c6a71d34f89dad0cb41a75603433a6071";
export const EFFECT_TRANSITION_TYPE = ["product", ["product", ["effect"], ["effect"]], ["base", "Evidence"]];
const WIT_TYPE = ["wit", ["grounded", ["base", "Effect"], ["base", "Evidence"]]];
const NI = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function exactKeys(value, keys) { return value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"); }
function typed(value) { const encoded = encodeRelationalValue(value), term = ["ascribe", encoded.type, encoded.term]; return { id: semanticId(term), bytes: semanticBytes(term), type: encoded.type, term: encoded.term }; }

export function encodeWitTransitionAssayRequest({ proposalCell, completionCell, evidence }) {
  const term = ["pair", ["pair", ["effect", proposalCell], ["effect", completionCell]], ["constant", ["base", "Evidence"], evidence]];
  checkTerm(term, EFFECT_TRANSITION_TYPE);
  return { type: EFFECT_TRANSITION_TYPE, term };
}

export function decodeWitTransitionAssayRequest(type, term) {
  if (JSON.stringify(type) !== JSON.stringify(EFFECT_TRANSITION_TYPE)) fail("malformed-wit-transition", "WIT transition request has the wrong RMN type");
  checkTerm(term, type);
  if (term?.[0] !== "pair" || term?.[1]?.[0] !== "pair" || term?.[1]?.[1]?.[0] !== "effect" || term?.[1]?.[2]?.[0] !== "effect" || term?.[2]?.[0] !== "constant") fail("malformed-wit-transition", "WIT transition request must be ((proposal, completion), evidence)");
  return { proposalCell: term[1][1][1], completionCell: term[1][2][1], evidence: term[2][2] };
}

export function assayWitTransition(source) {
  const encoded = encodeWitTransitionAssayRequest(source), request = ["ascribe", encoded.type, encoded.term];
  const result = assayEffectTransition(source);
  const receipt = {
    kind: "WitTransitionAssayReceipt",
    profile: WIT_TRANSITION_ASSAY_PROFILE,
    provider: PROVIDER_ACCOUNT,
    request: semanticId(request),
    proposal: result.proposal,
    completion: result.completion,
    evidence: source.evidence,
    witness: result.witness,
    witnessTerm: result.witnessTerm,
    outcome: result.outcome,
  };
  const document = typed(receipt);
  return { receipt, semanticId: document.id, canonicalBytes: document.bytes, type: document.type, term: document.term };
}

export function decodeWitTransitionAssayReceipt(type, term) {
  if (JSON.stringify(type) !== JSON.stringify(RELATIONAL_VALUE_TYPE)) fail("malformed-wit-transition", "WIT transition receipt must use the relational RMN type");
  const value = decodeRelationalValue(type, term);
  const fields = ["completion", "evidence", "kind", "outcome", "profile", "proposal", "provider", "request", "witness", "witnessTerm"];
  if (!exactKeys(value, fields) || value.kind !== "WitTransitionAssayReceipt" || value.profile !== WIT_TRANSITION_ASSAY_PROFILE || value.provider !== PROVIDER_ACCOUNT || ![value.request, value.proposal, value.completion, value.evidence, value.witness].every((identity) => NI.test(identity ?? ""))) fail("malformed-wit-transition", "WIT transition receipt has an unknown, absent, legacy, or foreign-provider field");
  validateFour(value.outcome);
  checkTerm(value.witnessTerm, WIT_TYPE);
  if (semanticId(value.witnessTerm) !== value.witness) fail("malformed-wit-transition", "WIT transition receipt witness identity does not match its typed term");
  return value;
}
