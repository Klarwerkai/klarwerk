// AUFTRAG-mega1 Block D8 (E2E-006): der lokale LLM-Test lebt auf der LOKALEN Achse — die
// Fehlermeldung nennt KLARWERK_LOCAL_LLM_URL/_MODEL und NICHT ANTHROPIC_API_KEY; der Healthcheck ist
// pro Provider isoliert (probeLocal berührt den Cloud-Reachability-Cache nicht). Kein Code-Umbau
// nötig — dieser Test sichert die bereits ehrliche Achsen-Trennung als Regression ab.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const svc = readFileSync(join(__dirname, "../../services/reasoner/src/service.ts"), "utf8");
const client = readFileSync(join(__dirname, "../../services/reasoner/src/model-client.ts"), "utf8");

function probeLocalBody(): string {
  const start = svc.indexOf("async probeLocal(");
  const cloudProbe = svc.indexOf("async probe(", start === -1 ? 0 : start + 1);
  // Von probeLocal bis zum nächsten async probe( — grober, aber stabiler Ausschnitt.
  return svc.slice(start, cloudProbe > start ? cloudProbe : start + 1200);
}

describe("Block D8: lokaler LLM-Test bleibt auf der lokalen Achse", () => {
  it("die lokale Fehlermeldung nennt KLARWERK_LOCAL_LLM, nicht ANTHROPIC_API_KEY", () => {
    const body = probeLocalBody();
    expect(body).toContain("KLARWERK_LOCAL_LLM_URL/_MODEL");
    expect(body).not.toContain("ANTHROPIC_API_KEY");
  });

  it("ANTHROPIC_API_KEY gehört ausschließlich zur Cloud-Achse (nur im model-client, nicht im Service)", () => {
    expect(svc).not.toContain("ANTHROPIC_API_KEY");
    expect(client).toContain('CLOUD_API_KEY_ENV = "ANTHROPIC_API_KEY"');
  });

  it("recordReachability wird pro Provider getrennt geführt (cloud/local isoliert)", () => {
    expect(svc).toContain('this.recordReachability((await this.probe()).ok, "cloud")');
    expect(svc).toContain('this.recordReachability((await this.probeLocal()).ok, "local")');
  });
});
