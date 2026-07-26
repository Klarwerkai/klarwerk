import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ==============================================================================================
// AUFTRAG-mega19 Block F — DER LAUNCHER: WAS ER DURCHREICHT UND WAS ER AUSGIBT.
// ==============================================================================================
//
// F-1: `tools/localhost` reicht die lokale-KI-Umgebung bewusst als NAMENSLISTE durch (kein
// Praefix-Sammler, sonst wanderte unkontrollierte Umgebung in den Prozess). Der Preis dieser
// Strenge ist, dass eine NEUE Variable in ZWEI Listen gehoert — den Leser im Code und die
// Durchreichung. In mega18 wurde `KLARWERK_LOCAL_LLM_MAX_TOKENS` im Code eingefuehrt und hier
// vergessen; `env -i` verwarf sie also weiterhin. Dieser Test prueft den Abgleich, statt sich auf
// Aufmerksamkeit zu verlassen: was der Code liest, muss der Launcher durchreichen.
//
// F-2: die Startmeldung gab die ROHE URL aus. Eine Adresse kann Userinfo oder eine sensitive Query
// tragen — beides stuende dann im Terminal und im Startlog. Ausgegeben wird jetzt nur der Origin.

const ROOT = process.cwd();
const LAUNCHER = resolve(ROOT, "tools/localhost");

function launcherSource(): string {
  return readFileSync(LAUNCHER, "utf8");
}

/** Ruft eine einzelne Funktion des Launchers in einer eigenen Shell auf — ohne ihn zu starten. */
function callLauncherFn(fn: string, env: Record<string, string>): string {
  // Der Launcher wird NICHT ausgefuehrt (er wuerde Ports pruefen und Prozesse starten). Aus seinem
  // ECHTEN Quelltext werden genau die beiden Meldungs-Funktionen ausgeschnitten und aufgerufen —
  // keine Kopie im Test, sonst prueft der Test sich selbst.
  const src = launcherSource();
  const von = src.indexOf("sanitize_llm_origin() {");
  const bis = src.indexOf("start_backend() {");
  expect(von).toBeGreaterThan(0);
  expect(bis).toBeGreaterThan(von);
  const defs = src.slice(von, bis);
  return execFileSync("bash", ["-c", `${defs}\n${fn}`], {
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  }).trim();
}

describe("mega19 F-1: die lokale-KI-Umgebung wird vollstaendig durchgereicht", () => {
  it("jede KLARWERK_LOCAL_LLM_*-Variable, die der Code LIEST, steht in LOCAL_LLM_VARS", () => {
    const client = readFileSync(resolve(ROOT, "services/reasoner/src/model-client.ts"), "utf8");
    // Alle im Code gelesenen Namen — aus dem echten Quelltext, nicht aus einer gepflegten Liste.
    const gelesen = [...new Set(client.match(/KLARWERK_LOCAL_LLM_[A-Z_]+/g) ?? [])].sort();
    expect(gelesen.length).toBeGreaterThan(0);

    const launcher = launcherSource();
    const block = launcher.slice(
      launcher.indexOf("LOCAL_LLM_VARS=("),
      launcher.indexOf(")", launcher.indexOf("LOCAL_LLM_VARS=(")),
    );
    const durchgereicht = [...new Set(block.match(/KLARWERK_LOCAL_LLM_[A-Z_]+/g) ?? [])].sort();

    // DIE ZUSAGE: keine Variable, die der Code liest, faellt beim `env -i` unter den Tisch.
    expect(durchgereicht).toEqual(gelesen);
    // Und der konkrete Nachzuegler aus mega18 ist ausdruecklich dabei.
    expect(durchgereicht).toContain("KLARWERK_LOCAL_LLM_MAX_TOKENS");
  });
});

describe("mega19 F-2: die Startmeldung gibt kein Geheimnis preis", () => {
  it("eine URL mit Userinfo und Query wird auf den Origin reduziert", () => {
    const out = callLauncherFn("report_local_llm", {
      KLARWERK_LOCAL_LLM_URL: "https://benutzer:geheim@llm.werk.local:8443/v1?token=abc123",
      KLARWERK_LOCAL_LLM_MODEL: "qwen3-30b",
    });
    // Weder das Passwort noch der Benutzername noch der Query-Parameter tauchen auf.
    expect(out).not.toContain("geheim");
    expect(out).not.toContain("benutzer");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("/v1");
    // Was bleibt, beantwortet die einzige Frage, die diese Zeile beantworten soll.
    expect(out).toContain("https://llm.werk.local:8443");
    expect(out).toContain("qwen3-30b");
  });

  it("eine gewoehnliche URL bleibt lesbar (die Meldung wird nicht unbrauchbar)", () => {
    const out = callLauncherFn("report_local_llm", {
      KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:1234/v1",
      KLARWERK_LOCAL_LLM_MODEL: "qwen3-30b",
    });
    expect(out).toBe("Lokale KI: http://127.0.0.1:1234 (Modell: qwen3-30b)");
  });

  it("laesst sich der Origin nicht sicher lesen, wird NICHTS geraten", () => {
    const out = callLauncherFn("report_local_llm", {
      KLARWERK_LOCAL_LLM_URL: "file:///etc/geheim",
      KLARWERK_LOCAL_LLM_MODEL: "qwen3-30b",
    });
    expect(out).not.toContain("geheim");
    expect(out).toContain("verdrahtet");
  });

  it("ohne Verdrahtung bleibt die ehrliche Fehlanzeige (unveraendert aus mega18)", () => {
    const out = callLauncherFn("report_local_llm", {});
    expect(out).toContain("nicht verdrahtet");
    expect(out).toContain("KLARWERK_LOCAL_LLM_URL");
  });

  it("der Schluessel wird NIE ausgegeben", () => {
    const out = callLauncherFn("report_local_llm", {
      KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:1234/v1",
      KLARWERK_LOCAL_LLM_MODEL: "qwen3-30b",
      KLARWERK_LOCAL_LLM_KEY: "sk-streng-geheim",
    });
    expect(out).not.toContain("sk-streng-geheim");
  });
});
