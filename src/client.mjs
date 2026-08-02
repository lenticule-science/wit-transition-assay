import { randomUUID } from "node:crypto";
import { Message, Role } from "@a2a-js/sdk";
import { a2aResultParts, sendRmnTask } from "@red-cup-engineering/a2a-rmn-task-client-service";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { checkTerm, decodeSemantic, semanticBytes, semanticId } from "@red-cup-engineering/relation-model-notation-runtime";
import { circuitInterfaceFromAgentCard, SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION } from "@red-cup-engineering/relation-model-notation-runtime/hierarchical-circuit";
import { decodeWitTransitionAssayReceipt, encodeWitTransitionAssayRequest } from "./assay.mjs";

const parts = a2aResultParts;

export async function assayWitTransition({ agentUrl, proposalCell, completionCell, evidence, signal, send = sendRmnTask }) {
  const request = encodeWitTransitionAssayRequest({ proposalCell, completionCell, evidence }), document = ["ascribe", request.type, request.term];
  const message = Message.toJSON({ messageId: randomUUID(), contextId: "", taskId: "", role: Role.ROLE_USER, parts: [rmnPart(semanticBytes(document), "wit-transition-request.rmn.cbor")], metadata: {}, extensions: [], referenceTaskIds: [] });
  const exchange = await send({ agentUrl, extensions: [SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION], message, requireSignature: true, ...(signal ? { signal } : {}) });
  const output = extractRmnPart(parts(exchange.result)), response = decodeSemantic(output.bytes);
  if (!semanticBytes(response).equals(output.bytes) || response?.[0] !== "ascribe" || response.length !== 3) throw new Error("WIT transition provider returned noncanonical RMN");
  checkTerm(response[2], response[1]);
  const receipt = decodeWitTransitionAssayReceipt(response[1], response[2]), provider = circuitInterfaceFromAgentCard(exchange.agentCard);
  if (receipt.provider !== provider.account) throw new Error("WIT transition receipt provider does not own the signed Agent Card");
  if (receipt.request !== semanticId(document)) throw new Error("WIT transition receipt does not bind the exact request");
  return { ...receipt, receipt, receiptNi: semanticId(response), response, exchange };
}
