// ================================================================================================
// aufnahme:20260922:gesamt-modelltraining-entscheidung · R-0720 / R-0864 — DIE NOTIZ HÄLT, WAS DER
// CODE IST, UND ERSETZT KEINE ENTSCHEIDUNG.
// ================================================================================================
//
// Die vier Kriterien sind Dokumentationskriterien: offene Geltungsfrage mit Alternativen (K1),
// konkretisierte Evaluationskriterien nur für Stil/Struktur (K2), Bewertung gegen Datenstrategie
// und Abschaltbarkeit (K3), Lieferstand und Abgrenzung (K4). Dieser Wächter liest die Notiz und hält
// ihre Aussagen über den Bestand gegen den Code. Er ist Quelleninspektion — eine Modellmessung
// findet hier nicht statt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  InMemoryEmbeddingStore,
  STUB_DEFAULT_DIM,
  createEmbeddingProviderFromEnv,
} from "../../services/embedding";
import { KiAbgeschaltetFehler, LOAD_FAILURE_FALLBACK_POLICY } from "../../services/reasoner";

const root = resolve(import.meta.dirname, "../..");
const lies = (pfad: string) => readFileSync(resolve(root, pfad), "utf8");
const DOK = "docs/operations/fine-tuning-decision.md";

function abschnitt(text: string, kopf: string): string {
  const start = text.indexOf(kopf);
  expect(start, `Abschnitt „${kopf}“ fehlt`).toBeGreaterThan(-1);
  const rest = text.slice(start + kopf.length);
  const ende = rest.search(/\n## /);
  return ende === -1 ? rest : rest.slice(0, ende);
}

describe("Modelltraining-Entscheidung · Notiz gegen Bestand", () => {
  const dok = lies(DOK);

  it("K1 · Geltungsfrage: Quellen, drei Alternativen, keine ersetzte Entscheidung", () => {
    const frage = abschnitt(dok, "## 14. Offene Geltungsfrage");
    for (const quelle of ["R-0720", "R-0864", "specs/stories/reasoner.md", "§5.1"]) {
      expect(frage, quelle).toContain(quelle);
    }
    for (const alternative of ["**A — ", "**B — ", "**C — "]) {
      expect(frage, alternative).toContain(alternative);
    }
    expect(frage).toContain("**keine der Alternativen freigegeben**");
    expect(frage).toContain("Firmenfakten kommen nie in Modellgewichte");
    // Das zitierte Nicht-Ziel steht wirklich in der Story.
    expect(lies("specs/stories/reasoner.md")).toContain("Fine-Tuning eigener Modelle");
  });

  it("K2 · Kriterien nur für Stil/Struktur, kein Trainingsauftrag, keine erfundenen Schwellen", () => {
    const kriterien = abschnitt(dok, "## 15. Kriterien");
    for (const nr of ["E1", "E2", "E3", "E4", "E5", "E6", "E7"]) {
      expect(kriterien, nr).toContain(`| ${nr} |`);
    }
    for (const nr of ["R1", "R2", "R3", "R4", "R5", "R6"]) {
      expect(kriterien, nr).toContain(`| ${nr} |`);
    }
    expect(kriterien).toContain("Eine Evaluation ist **kein Trainingsauftrag**");
    expect(kriterien).toContain("keine Firmen- oder Kundenfakten");
    expect(kriterien).toContain("Zahlenschwellen");
    expect(kriterien).not.toMatch(/\d\s*%/);
    // Die genannten Prüfstand-Checks gibt es im Datenvertrag wirklich.
    const vertrag = lies("docs/team2-austausch/VERTRAG-PRUEFSTAND-ARTEFAKTE.md");
    for (const check of [
      "json",
      "jsonFeld",
      "istFrage",
      "enthaelt",
      "belegstelleImText",
      "ehrlichLeer",
      "ehrlichUnwissend",
    ]) {
      expect(kriterien, check).toContain(`\`${check}\``);
      expect(vertrag, check).toContain(`\`${check}`);
    }
  });

  it("K3 · die beschriebene Abschaltbarkeit ist die des Codes", () => {
    const bewertung = abschnitt(dok, "## 16. Bewertung");
    expect(bewertung).toContain("**ausgeschlossen**");
    // Ladefehler → fail-closed deterministisch.
    expect(bewertung).toContain("`LOAD_FAILURE_FALLBACK_POLICY` = `deterministic`");
    expect(LOAD_FAILURE_FALLBACK_POLICY.global).toBe("deterministic");
    // Administrative Abschaltung beendet einen wartenden Modellaufruf.
    expect(bewertung).toContain("`KiAbgeschaltetFehler`");
    expect(new KiAbgeschaltetFehler().message).toContain("KI abgeschaltet");
    const reasoner = lies("services/reasoner/src/service.ts");
    expect(reasoner).toContain("kiAbschaltung(): ReasonerKiAbschaltung");
    expect(reasoner).toContain("KLARWERK_REASONER_POLICY");
  });

  it("K3 · Stand §13: Vektoren nur im Vorfilter (AUS), kein Cloud-Embedder, löschbar", async () => {
    const stand = abschnitt(dok, "## 13. Abgleich");
    expect(stand).toContain("**keinen** Cloud-Anbieter");
    const stub = createEmbeddingProviderFromEnv({});
    expect(stub?.embeddingVersion).toBe(`stub@${STUB_DEFAULT_DIM}`);
    const cloud = createEmbeddingProviderFromEnv({ KLARWERK_EMBEDDING_PROVIDER: "cloud" });
    expect(cloud).toBeUndefined();
    // Der Vorfilter entsteht nur mit gesetztem Schalter.
    const app = lies("services/app/src/build-app.ts");
    expect(app).toContain('if (flag !== "1" && flag !== "true") {');
    expect(app).toContain("process.env.KLARWERK_DUP_PREFILTER");
    // Der Antwortweg bleibt ohne Embedder.
    expect(lies("services/ask/src/service.ts")).toContain(
      "Der semantische Vorfilter bleibt unberührt und AUS.",
    );
    // Löschpflicht: ein Vektor ist je Objekt löschbar — anders als Gewichte.
    const speicher = new InMemoryEmbeddingStore();
    const [vektor] = (await stub?.embed(["Ventil X schliessen"]))?.vectors ?? [];
    expect(vektor).toBeDefined();
    await speicher.upsert("ko-1", vektor ?? [], stub?.embeddingVersion ?? "");
    await speicher.delete("ko-1");
    expect(await speicher.standVon("ko-1")).toBeUndefined();
  });

  it("K4 · Lieferstand, Abgrenzung, Widersprüche und fehlende Belege sind benannt", () => {
    const lieferung = abschnitt(dok, "## 17. Lieferstand und Abgrenzung");
    for (const teil of [
      "**Mit dieser Klärung geliefert:**",
      "**Früher geliefert (historisch, nicht erneut geprüft):**",
      "**Gesonderte Bestände, nicht Teil dieser Klärung:**",
      "**Quellenwidersprüche:**",
      "**Fehlende Belege:**",
      "fehlt der Lieferbeleg",
    ]) {
      expect(lieferung, teil).toContain(teil);
    }
    // Die alte Entscheidung (§1) bleibt wörtlich erhalten.
    expect(dok).toContain(
      "**Fine-Tuning / LoRA wird jetzt NICHT durchgeführt und ist aktuell NICHT nötig.**",
    );
  });
});
