import { readFileSync } from "node:fs";
import { compileRmlLaw } from "@red-cup-engineering/rmn-semantic-conformance/law";

export const WIT_TRANSITION_ASSAY_LAW = compileRmlLaw(readFileSync(new URL("../content/contracts/assay-wit-transition.rml", import.meta.url), "utf8"));
