import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
async function unusedPort() { const socket = createServer(); await new Promise((accept, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", accept); }); const port = socket.address().port; await new Promise((accept, reject) => socket.close((error) => error ? reject(error) : accept())); return port; }
export async function startWitTransitionAssayProcess({ rwilAgentUrl, port = undefined, timeoutMs = 10_000 } = {}) {
  if (!rwilAgentUrl) throw new Error("rwilAgentUrl is required for the WIT transition assay test provider");
  const selectedPort = port ?? await unusedPort(), baseUrl = `http://127.0.0.1:${selectedPort}`;
  const child = spawn(process.execPath, [resolve(ROOT, "bin/server.mjs")], { cwd: ROOT, env: { ...process.env, HOST: "127.0.0.1", PORT: String(selectedPort), BASE_URL: baseUrl, RWIL_RDF_AGENT: rwilAgentUrl, AGENT_CARD_SIGNING_KEY: resolve(ROOT, "data/agent-card-signing/ed25519-private.pem"), AGENT_CARD_JWKS: resolve(ROOT, "content/agent-card-signing/jwks.json"), AGENT_CARD_SIGNING_KID: "wit-transition-assay-ed25519" }, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = ""; child.stderr.setEncoding("utf8"); child.stderr.on("data", (chunk) => { stderr += chunk; });
  const announced = await new Promise((accept, reject) => { const timeout = setTimeout(() => reject(new Error(`WIT transition provider startup timed out: ${stderr}`)), timeoutMs); let stdout = ""; child.stdout.setEncoding("utf8"); child.stdout.on("data", (chunk) => { stdout += chunk; const line = stdout.split(/\r?\n/u)[0]; if (line) { clearTimeout(timeout); accept(line); } }); child.once("error", (error) => { clearTimeout(timeout); reject(error); }); child.once("exit", (status) => { clearTimeout(timeout); reject(new Error(`WIT transition provider exited during startup (${status}): ${stderr}`)); }); });
  let closed = false;
  return { baseUrl: announced, agentCardUrl: `${announced}/.well-known/agent-card.json`, async close() { if (closed || child.exitCode !== null) return; closed = true; child.kill("SIGTERM"); await new Promise((accept) => { const timeout = setTimeout(() => child.kill("SIGKILL"), 2_000); child.once("exit", () => { clearTimeout(timeout); accept(); }); }); } };
}
