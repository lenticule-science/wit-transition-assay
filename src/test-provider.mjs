import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
async function unusedPort() { const socket = createServer(); await new Promise((accept, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", accept); }); const port = socket.address().port; await new Promise((accept, reject) => socket.close((error) => error ? reject(error) : accept())); return port; }
export async function startWitTransitionAssayProcess({ witnessJournalAgentUrl, port = undefined, timeoutMs = 10_000 } = {}) {
  if (!witnessJournalAgentUrl) throw new Error("witnessJournalAgentUrl is required for the WIT transition assay test provider");
  const selectedPort = port ?? await unusedPort(), baseUrl = `http://127.0.0.1:${selectedPort}`;
  const taskStoreRoot = mkdtempSync(resolve(tmpdir(), "wit-transition-assay-a2a-tasks-"));
  const signingRoot = mkdtempSync(resolve(tmpdir(), "wit-transition-assay-signing-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519"), kid = "wit-transition-assay-test-ed25519";
  const keyPath = resolve(signingRoot, "ed25519-private.pem"), jwksPath = resolve(signingRoot, "jwks.json");
  writeFileSync(keyPath, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
  writeFileSync(jwksPath, JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "EdDSA", use: "sig" }] }));
  const child = spawn(process.execPath, [resolve(ROOT, "scripts/test-server.mjs")], { cwd: ROOT, env: { ...process.env, A2A_TASK_STORE_ROOT: taskStoreRoot, HOST: "127.0.0.1", PORT: String(selectedPort), BASE_URL: baseUrl, WITNESS_JOURNAL_RDF_AGENT: witnessJournalAgentUrl, SETTLEMENT_CAIP2: "eip155:31337", CONTROLLER_ACCOUNT: "eip155:31337:0x0aadad1c6a71d34f89dad0cb41a75603433a6071", WIT_TEST_EPHEMERAL_WITNESS_JOURNAL: "1", AGENT_CARD_SIGNING_KEY: keyPath, AGENT_CARD_JWKS: jwksPath, AGENT_CARD_SIGNING_KID: kid }, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = ""; child.stderr.setEncoding("utf8"); child.stderr.on("data", (chunk) => { stderr += chunk; });
  const announced = await new Promise((accept, reject) => { const timeout = setTimeout(() => reject(new Error(`WIT transition provider startup timed out: ${stderr}`)), timeoutMs); let stdout = ""; child.stdout.setEncoding("utf8"); child.stdout.on("data", (chunk) => { stdout += chunk; const line = stdout.split(/\r?\n/u)[0]; if (line) { clearTimeout(timeout); accept(line); } }); child.once("error", (error) => { clearTimeout(timeout); reject(error); }); child.once("exit", (status) => { clearTimeout(timeout); reject(new Error(`WIT transition provider exited during startup (${status}): ${stderr}`)); }); });
  let closed = false;
  return { baseUrl: announced, agentCardUrl: `${announced}/.well-known/agent-card.json`, async close() { if (closed) return; closed = true; if (child.exitCode === null) { child.kill("SIGTERM"); await new Promise((accept) => { const timeout = setTimeout(() => child.kill("SIGKILL"), 2_000); child.once("exit", () => { clearTimeout(timeout); accept(); }); }); } rmSync(taskStoreRoot, { recursive: true, force: true }); rmSync(signingRoot, { recursive: true, force: true }); } };
}
