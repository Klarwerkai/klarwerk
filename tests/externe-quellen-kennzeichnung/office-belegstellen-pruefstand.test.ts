// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-0205 — DER PRÜFSTAND REIST MIT DER
// OFFICE-BELEGSTELLE, UNABHÄNGIG VOM DOKUMENTSTAND.
// ================================================================================================
//
// Bens Befund (Nacharbeit 29): `belegstellenZumAnhang` (services/app/src/office-artikel.ts) gab in
// beiden Zweigen (`aktuell`, `frueher`) nur Kennung, Bezeichnung, Auszug und Stand aus —
// `peerValidated` ging verloren, und die Fläche konnte keine Quelle als ungeprüft kennzeichnen.
// Übernommen aus der Prüfvorbereitung HILFE/d86c898f…/belegstellen-kennzeichnung.test.ts (dort am
// unveränderten Kandidaten: 4 bestanden, 4 rot — genau die Fälle `true`/`false` je Zweig).
//
// Geändert gegenüber der Vorbereitung: die Altquelle OHNE Feld muss jetzt ausdrücklich `false`
// tragen (fail-closed), nicht nur „nicht true".
import { describe, expect, it } from "vitest";
import { type AnhangFassung, belegstellenZumAnhang } from "../../services/app/src/office-artikel";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

const quellen = ["aktuell", "frueher"].flatMap((stand) =>
  [false, true, undefined].map((peerValidated) => ({
    id: `synthetisch-${stand}-${String(peerValidated)}`,
    label: `Künstliche Quelle ${stand} / ${String(peerValidated)}`,
    url: "https://quelle.example.invalid/beleg",
    excerpt: "Nur künstliche Prüfdaten.",
    kind: "external",
    author: "synthetischer-autor",
    at: "2026-01-01T00:00:00Z",
    objectId: stand === "aktuell" ? "obj-neu" : "obj-alt",
    ...(peerValidated === undefined ? {} : { peerValidated }),
  })),
);
const artikel = {
  id: "synthetisches-ko",
  version: 2,
  history: [],
  attachments: [{ id: "anhang-probe", objectId: "obj-neu" }],
  sources: [...quellen, { ...quellen[0], id: "fremder-anhang", objectId: "obj-fremd" }],
} as unknown as KnowledgeObject;
const verlauf: AnhangFassung[] = [
  { version: 1, objectId: "obj-alt", at: "2026-01-01T00:00:00Z", author: "a", aktuell: false },
  { version: 2, objectId: "obj-neu", at: "2026-01-02T00:00:00Z", author: "a", aktuell: true },
];

/** Die echte Mapperausgabe nach JSON-Rundlauf — so, wie die Route sie ausliefert. */
function antwort(): Array<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(belegstellenZumAnhang(artikel, verlauf, "anhang-probe")));
}

describe("R-0205 · Prüfstand bleibt am Beleg unabhängig vom Dokumentstand", () => {
  for (const stand of ["aktuell", "frueher"]) {
    for (const peerValidated of [false, true]) {
      it(`${stand}: peerValidated=${peerValidated} erreicht die JSON-Ausgabe unverändert`, () => {
        const row = antwort().find((b) => b.quelleId === `synthetisch-${stand}-${peerValidated}`);
        expect(row).toBeDefined();
        expect(row).toHaveProperty("peerValidated", peerValidated);
        expect(row?.stand).toBe(stand);
      });
    }
    it(`${stand}: Altquelle ohne Prüfstand wird als ungeprüft (false) ausgegeben`, () => {
      const row = antwort().find((b) => b.quelleId === `synthetisch-${stand}-undefined`);
      expect(row).toBeDefined();
      expect(row).toHaveProperty("peerValidated", false);
      expect(row?.stand).toBe(stand);
    });
  }

  it("Dokumentstand und frühere Fassung bleiben unabhängig vom Prüfstand erhalten", () => {
    const rows = antwort();
    expect(rows).toHaveLength(6);
    expect(rows.filter((b) => b.stand === "aktuell")).toHaveLength(3);
    const alt = rows.filter((b) => b.stand === "frueher");
    expect(alt).toHaveLength(3);
    expect(alt.every((b) => b.ausFassung === 1)).toBe(true);
    expect(rows.some((b) => b.quelleId === "fremder-anhang")).toBe(false);
  });

  it("Lesen der Belegstellen verändert weder Quellen noch Verlauf", () => {
    const vorher = JSON.stringify({ artikel, verlauf });
    antwort();
    expect(JSON.stringify({ artikel, verlauf })).toBe(vorher);
  });
});
