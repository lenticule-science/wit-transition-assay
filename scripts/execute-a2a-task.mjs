#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { checkTerm, decodeSemantic, semanticBytes } from "@red-cup-engineering/relation-model-notation-runtime";
import { recordSettlementRecord } from "@red-cup-engineering/witness-journal-rdf-projection-service/client";
import { assayWitTransition, decodeWitTransitionAssayRequest } from "../src/assay.mjs";

function ephemeralWitnessJournalBoundary() {
  const objects = new Map(), memberships = new Map();
  return Object.freeze({
    custody: Object.freeze({
      async put({ ni, bytes, mediaType }) { objects.set(ni, { ni, bytes: Buffer.from(bytes), mediaType }); return { ni }; },
      async get(reference) { return objects.get(typeof reference === "string" ? reference : reference?.ni) ?? null; },
    }),
    categoryIndex: Object.freeze({
      async add({ predicate, category, ni }) { const key = `${predicate}\n${category}`; if (!memberships.has(key)) memberships.set(key, new Set()); memberships.get(key).add(ni); return { predicate, category, ni }; },
      async query(category, { predicate }) { return { references: [...(memberships.get(`${predicate}\n${category}`) ?? [])].map((ni) => ({ ni })), continuationToken: undefined }; },
    }),
  });
}
export async function executeA2aMessage(source, env = process.env, witnessJournal) {
  const message = Message.fromJSON(source);
  if (message.role !== Role.ROLE_USER) throw new Error("WIT transition assay requires an A2A ROLE_USER message");
  if (!env.WITNESS_JOURNAL_RDF_AGENT) throw new Error("WITNESS_JOURNAL_RDF_AGENT is required; the assay cannot keep an ambient book");
  const input = extractRmnPart(message.parts), request = decodeSemantic(input.bytes);
  if (!semanticBytes(request).equals(input.bytes) || request?.[0] !== "ascribe" || request.length !== 3) throw new Error("WIT transition request must be canonical typed RMN CBOR");
  checkTerm(request[2], request[1]);
  const providerAccount = env.CONTROLLER_ACCOUNT;
  if (!/^eip155:[1-9][0-9]*:0x[0-9a-fA-F]{40}$/u.test(providerAccount ?? "")) throw new Error("CONTROLLER_ACCOUNT must name the deployed WIT provider CAIP-10 account");
  const result = assayWitTransition(decodeWitTransitionAssayRequest(request[1], request[2]), { providerAccount }), recordedAt = new Date().toISOString();
  if (!witnessJournal?.custody || !witnessJournal?.categoryIndex) throw new Error("WIT assay WitnessJournal custody and category index must be injected explicitly");
  await recordSettlementRecord({ agentUrl: env.WITNESS_JOURNAL_RDF_AGENT, settlement: providerAccount, actor: "urn:ame:wit-transition-assay", category: "wit-transition-assay.receipt", recordedAt, record: { ...result.receipt, semanticId: result.semanticId }, ...witnessJournal });
  return Message.toJSON({ messageId: randomUUID(), contextId: message.contextId, taskId: message.taskId, role: Role.ROLE_AGENT, parts: [rmnPart(result.canonicalBytes, "wit-transition-receipt.rmn.cbor")], metadata: { disposition: "witnessed-cover", receiptNi: result.semanticId, witnessNi: result.receipt.witness }, extensions: [], referenceTaskIds: [] });
}
try { const source = JSON.parse(readFileSync(0, "utf8")); const witnessJournal = process.env.WIT_TEST_EPHEMERAL_WITNESS_JOURNAL === "1" ? ephemeralWitnessJournalBoundary() : undefined; process.stdout.write(`${JSON.stringify(await executeA2aMessage(source, process.env, witnessJournal))}\n`); } catch (error) { process.stderr.write(`${error.code ?? "wit-transition-refusal"}: ${error.message}\n`); process.exitCode = 1; }
