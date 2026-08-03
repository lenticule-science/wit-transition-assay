#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { seavt } from "@red-cup-engineering/witness-journal-entry-service";
import { appendSeavt } from "@red-cup-engineering/witness-journal-log-service";
import { assayWitTransition, decodeWitTransitionAssayRequest, witTransitionBytes, witTransitionFromBytes } from "../src/assay.mjs";

function surface(role, token) { const match = /^ni:\/\/\/sha-256;([A-Za-z0-9_-]{43})$/u.exec(token); if (!match) throw new TypeError(`${role} must be semantic content identity`); return `semantic-content.${role}.sha256.${Buffer.from(match[1], "base64url").toString("hex")}`; }
export async function executeA2aMessage(source, env = process.env) {
  const message = Message.fromJSON(source);
  if (message.role !== Role.ROLE_USER) throw new Error("WIT transition assay requires an A2A ROLE_USER message");
  const request = decodeWitTransitionAssayRequest(witTransitionFromBytes(extractRmnPart(message.parts).bytes));
  const result = assayWitTransition(request, { providerAccount: env.CONTROLLER_ACCOUNT });
  const recordedAt = new Date().toISOString(), root = resolve(env.WIT_TRANSITION_DATA_ROOT ?? "data");
  appendSeavt(root, "wit-transition.assay", [seavt(surface("receipt", result.semanticId), "wit-transition:receipt", surface("witness", result.receipt.witness), recordedAt)], recordedAt);
  return Message.toJSON({ messageId: randomUUID(), contextId: message.contextId, taskId: message.taskId, role: Role.ROLE_AGENT, parts: [rmnPart(result.canonicalBytes, "wit-transition-receipt.rmn.cbor")], metadata: { disposition: "witnessed-cover", receiptNi: result.semanticId, witnessNi: result.receipt.witness }, extensions: [], referenceTaskIds: [] });
}
try { process.stdout.write(`${JSON.stringify(await executeA2aMessage(JSON.parse(readFileSync(0, "utf8"))))}\n`); } catch (error) { process.stderr.write(`${error.code ?? "wit-transition-refusal"}: ${error.message}\n`); process.exitCode = 1; }
