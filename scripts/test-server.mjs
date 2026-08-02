#!/usr/bin/env node
import { resolve } from "node:path";
import { serveContractedAgent } from "@red-cup-engineering/a2a-contracted-agent-service";
import { createEphemeralCoordinationStateCustody, createEphemeralTaskStateCustody } from "../src/ephemeral-a2a-custody.mjs";

const ROOT = resolve(import.meta.dirname, "..");
serveContractedAgent({
  port: Number(process.env.PORT ?? "8787"), host: process.env.HOST ?? "127.0.0.1", baseUrl: process.env.BASE_URL,
  agentCard: resolve(ROOT, "content/agent-cards/wit-transition-assay.json"), executor: process.execPath,
  executorArgs: [resolve(ROOT, "scripts/execute-a2a-task.mjs")], taskSource: createEphemeralTaskStateCustody(), coordinationSource: createEphemeralCoordinationStateCustody(),
}).then(({ baseUrl }) => process.stdout.write(`${baseUrl}\n`)).catch((error) => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 1; });
