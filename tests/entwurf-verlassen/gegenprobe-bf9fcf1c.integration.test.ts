// ================================================================================================
// K5 · GEGENPROBE: DIE NEUEN TESTS FÜR K1 UND K3 SIND GEGEN bf9fcf1c ROT.
// ================================================================================================
//
// Kriterium 5 (wörtlich): „Gegenprobe: Die neuen Tests für die Kriterien 1 und 3 sind gegen
// bf9fcf1c rot und auf der neuen Fassung grün." Die grüne Hälfte belegen die regulären Läufe auf dem
// Kandidaten. HIER steht die rote: dieselben Testdateien, in einem Unterlauf gegen den TATSÄCHLICHEN
// Produktstand bf9fcf1c (`apps/web` und `services` aus einem commitgebundenen Quellarchiv, per
// Git-Baum-Hash gegen bf9fcf1c geprüft; Herstellung und Testumgebung: `gegenprobe-bf9fcf1c.ts`).
//
// ROT HEISST FACHLICH ROT. Ein Fall, der nur scheitert, weil ein Modul fehlt oder die Datei nicht
// lädt, zählt nicht — er beweise nichts über das Verhalten. Deshalb:
//   · K1-Fälle müssen an der Fachzusage scheitern („der geänderte Inhalt bekam einen neuen
//     Schlüssel" — der alte Stand vergibt für geänderten Inhalt einen neuen Schlüssel und legt einen
//     zweiten Entwurf an).
//   · Kein erwarteter Fehlschlag darf eine Lade-/Modulmeldung tragen.
//   · KALIBRIERUNG: Fälle, die das alte Verhalten NICHT betrifft (Erstspeicherung, Doppelklick,
//     Antwortverlust ohne Änderung), müssen im alten Stand GRÜN sein. Sonst wäre die Kopie selbst
//     kaputt, und jedes „rot" hiesse nichts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type Fall, bereiteAltenStand, fahreAlteTests } from "./gegenprobe-bf9fcf1c";

const ECHTE_API = "tests/entwurf-verlassen/erfassen-doppelklick-echte-api-mounted.test.tsx";
const ATTRAPPEN = "tests/entwurf-verlassen/erfassen-doppelklick-mounted.test.tsx";
const ROUTE = "tests/entwurf-verlassen/anlage-fortschreiben-route.test.ts";

/** Die Fachzusage, an der die K1-Fälle im alten Stand scheitern müssen. */
const K1_ZUSAGE = "der geänderte Inhalt bekam einen neuen Schlüssel";
/** Meldungen, die nichts über Verhalten sagen — ein solcher Fehlschlag zählt nicht als rot. */
const LADEFEHLER = new RegExp(
  [
    "Cannot find module",
    "Failed to load",
    "SyntaxError",
    "does not provide an export",
    "is not exported",
  ].join("|"),
);

type Erwartung = { datei: string; kennung: string; kriterium: "K1" | "K3"; zusage?: string };

/** Die neuen bzw. für diesen Auftrag geänderten Fälle zu K1 und K3 — sie müssen ROT sein. */
const ROT: readonly Erwartung[] = [
  { datei: ECHTE_API, kennung: "E1", kriterium: "K1", zusage: K1_ZUSAGE },
  { datei: ECHTE_API, kennung: "E2", kriterium: "K1", zusage: K1_ZUSAGE },
  { datei: ATTRAPPEN, kennung: "V5", kriterium: "K1", zusage: K1_ZUSAGE },
  { datei: ATTRAPPEN, kennung: "V6", kriterium: "K1", zusage: K1_ZUSAGE },
  { datei: ROUTE, kennung: "S2", kriterium: "K1" },
  { datei: ECHTE_API, kennung: "E3", kriterium: "K3" },
  { datei: ECHTE_API, kennung: "E7", kriterium: "K3" },
  { datei: ECHTE_API, kennung: "A2", kriterium: "K3" },
  { datei: ECHTE_API, kennung: "A3", kriterium: "K3" },
  { datei: ECHTE_API, kennung: "A6", kriterium: "K3" },
  { datei: ATTRAPPEN, kennung: "V1", kriterium: "K3" },
  { datei: ATTRAPPEN, kennung: "V2", kriterium: "K3" },
  { datei: ATTRAPPEN, kennung: "V3", kriterium: "K3" },
  { datei: ATTRAPPEN, kennung: "V4", kriterium: "K3" },
  { datei: ROUTE, kennung: "S1", kriterium: "K3" },
];

/** Kalibrierung: vom alten Verhalten unberührt — im alten Stand GRÜN. */
const GRUEN: readonly { datei: string; kennung: string }[] = [
  { datei: ECHTE_API, kennung: "A1" },
  { datei: ECHTE_API, kennung: "A5" },
  { datei: ECHTE_API, kennung: "E4" },
  { datei: ECHTE_API, kennung: "E5" },
  { datei: ECHTE_API, kennung: "E6" },
  { datei: ATTRAPPEN, kennung: "K1" },
  { datei: ATTRAPPEN, kennung: "D1" },
  { datei: ATTRAPPEN, kennung: "D2" },
  { datei: ATTRAPPEN, kennung: "F2" },
];

function finde(faelle: readonly Fall[], datei: string, kennung: string): Fall {
  const treffer = faelle.filter((f) => f.datei === datei && f.titel.startsWith(`${kennung} `));
  expect(treffer, `${datei} ${kennung}: nicht genau ein Fall im Unterlauf`).toHaveLength(1);
  return treffer[0] as Fall;
}

describe("K5 · Gegenprobe gegen bf9fcf1c (Umkehrung dieser Änderung, Commitbindung über Blob-Kennung)", () => {
  const ziel = mkdtempSync(join(tmpdir(), "klarwerk-gegenprobe-bf9fcf1c-"));
  afterAll(() => rmSync(ziel, { recursive: true, force: true }));

  it("die neuen Tests zu K1 und K3 sind im alten Stand fachlich rot, die unberührten grün", () => {
    const stand = bereiteAltenStand(ziel);
    const faelle = fahreAlteTests(ziel, [ECHTE_API, ATTRAPPEN, ROUTE]);

    // Der Beleg steht VOR den Zusicherungen — auch ein roter Ausgang nennt jeden Fall.
    const bezug = (d: string, k: string): Fall | undefined =>
      faelle.find((f) => f.datei === d && f.titel.startsWith(`${k} `));
    const beleg: string[] = [
      `[KLARWERK] K5 BELEG · Produktstand = ${stand.commit} (apps/web, services aus dem Archiv)`,
      `  verlinkte Abhängigkeiten vom Kandidaten: ${stand.verlinkt.join(", ") || "keine"}`,
    ];
    for (const [ordner, kennung] of Object.entries(stand.baeume)) {
      beleg.push(`  Baum ${ordner} = ${kennung} (gerechnet, = bf9fcf1c)`);
    }
    for (const e of ROT) {
      const f = bezug(e.datei, e.kennung);
      beleg.push(`  ${e.kriterium} ${e.kennung} ${f?.status ?? "fehlt"} · ${f?.meldung ?? ""}`);
    }
    for (const g of GRUEN) {
      beleg.push(`  Kalibrierung ${g.kennung} ${bezug(g.datei, g.kennung)?.status ?? "fehlt"}`);
    }
    process.stderr.write(`${beleg.join("\n")}\n`);

    for (const e of ROT) {
      const f = finde(faelle, e.datei, e.kennung);
      const wer = `${e.kennung} (${e.kriterium})`;
      expect(f.status, `${wer} ist gegen bf9fcf1c nicht rot`).toBe("failed");
      expect(f.meldung, `${wer}: rot nur wegen eines Ladefehlers`).not.toMatch(LADEFEHLER);
      if (e.zusage) {
        expect(f.meldung, `${wer}: rot, aber nicht an der Fachzusage`).toContain(e.zusage);
      }
    }
    for (const g of GRUEN) {
      const f = finde(faelle, g.datei, g.kennung);
      expect(f.status, `Kalibrierung ${g.kennung}: der Prüfbaum ist kaputt`).toBe("passed");
    }
  }, 1_200_000);
});
