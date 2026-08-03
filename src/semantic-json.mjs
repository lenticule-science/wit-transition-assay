import {
  EMPTY_WITNESS_ROOT,
  admitJsonSemanticContent,
  identifyJsonSemanticContent,
} from "@red-cup-engineering/semantic-content-identify-service";

const OBJECT_KIND = "lenticule-science.wit-transition-assay.json";

export function semanticJsonIdentified(value) {
  return identifyJsonSemanticContent({ objectKind: OBJECT_KIND, value, witnessRoot: EMPTY_WITNESS_ROOT });
}

export function semanticJsonId(value) { return semanticJsonIdentified(value).token; }
export function semanticJsonBytes(value) { return semanticJsonIdentified(value).bytes; }
export function semanticJsonFromBytes(bytes, token) {
  return admitJsonSemanticContent({ bytes, token, objectKind: OBJECT_KIND }).value;
}
export function semanticJsonRecord(value) {
  const record = structuredClone(value);
  return Object.freeze({ ...record, id: semanticJsonId(record) });
}
