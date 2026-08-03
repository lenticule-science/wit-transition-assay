import { randomUUID } from "node:crypto";
import { Message, Role } from "@a2a-js/sdk";
import { a2aResultParts, sendRmnTask } from "@red-cup-engineering/a2a-rmn-task-client-service";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { decodeWitTransitionAssayReceipt, encodeWitTransitionAssayRequest, witTransitionBytes, witTransitionFromBytes } from "./assay.mjs";

export async function assayWitTransition({ agentUrl, proposalCell, completionCell, evidence, signal, send = sendRmnTask }) {
  const request = encodeWitTransitionAssayRequest({ proposalCell, completionCell, evidence });
  const message = Message.toJSON({ messageId: randomUUID(), contextId: "", taskId: "", role: Role.ROLE_USER, parts: [rmnPart(witTransitionBytes(request), "wit-transition-request.rmn.cbor")], metadata: { request: request.id }, extensions: [], referenceTaskIds: [] });
  const exchange = await send({ agentUrl, message, requireSignature: true, ...(signal ? { signal } : {}) });
  const output = extractRmnPart(a2aResultParts(exchange.result));
  const receipt = decodeWitTransitionAssayReceipt(witTransitionFromBytes(output.bytes));
  if (receipt.request !== request.id) throw new Error("WIT transition receipt does not bind the exact request");
  return { ...receipt, receipt, receiptNi: receipt.id, exchange };
}
