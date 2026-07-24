#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@emsenn/a2a-rmn-part-service";
import { checkTerm, decodeSemantic, semanticBytes } from "@emsenn/rmn-semantic-conformance";
import { createSettlementStore } from "@emsenn/rwil-rdf-services/client";
import { assayWitTransition, decodeWitTransitionAssayRequest } from "../src/assay.mjs";
import { WIT_TRANSITION_ASSAY_LAW } from "../src/law.mjs";

const ROOT = resolve(import.meta.dirname, "..");
export async function executeA2aMessage(source, env = process.env) {
  const message = Message.fromJSON(source);
  if (message.role !== Role.ROLE_USER) throw new Error("WIT transition assay requires an A2A ROLE_USER message");
  if (!env.RWIL_RDF_AGENT) throw new Error("RWIL_RDF_AGENT is required; the assay cannot keep an ambient book");
  const input = extractRmnPart(message.parts), request = decodeSemantic(input.bytes);
  if (!semanticBytes(request).equals(input.bytes) || request?.[0] !== "ascribe" || request.length !== 3) throw new Error("WIT transition request must be canonical typed RMN CBOR");
  checkTerm(request[2], request[1]);
  const result = assayWitTransition(decodeWitTransitionAssayRequest(request[1], request[2])), recordedAt = new Date().toISOString();
  const store = createSettlementStore({ settlementRoot: ROOT, dataRoot: resolve(ROOT, "data"), agentUrl: env.RWIL_RDF_AGENT });
  await store.record({ category: "wit-transition-assay.receipt", recordedAt, record: { ...result.receipt, semanticId: result.semanticId, law: WIT_TRANSITION_ASSAY_LAW.id } });
  return Message.toJSON({ messageId: randomUUID(), contextId: message.contextId, taskId: message.taskId, role: Role.ROLE_AGENT, parts: [rmnPart(result.canonicalBytes, "wit-transition-receipt.rmn.cbor")], metadata: { disposition: "witnessed-cover", receiptNi: result.semanticId, witnessNi: result.receipt.witness }, extensions: [], referenceTaskIds: [] });
}
try { const source = JSON.parse(readFileSync(0, "utf8")); process.stdout.write(`${JSON.stringify(await executeA2aMessage(source))}\n`); } catch (error) { process.stderr.write(`${error.code ?? "wit-transition-refusal"}: ${error.message}\n`); process.exitCode = 1; }
