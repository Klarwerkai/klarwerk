// ================================================================================================
// JOB 2620 · D4 — WISSEN ERFASSEN: DIE ECHTE PRODUKTDATEI IM WERTEVERGLEICH.
// ================================================================================================
//
// PEDIS FRAGE: „Ist die Erfassungsflaeche im Word-Add-in jetzt die echte — und sieht sie aus wie
// gezeichnet?"
//
// BEN an D3: „Test A muss `DESIGN_ZIELBILD_20260827/WissenErfassen.dc.html` direkt mit
// `apps/web/public/word-addin/taskpane.html` vergleichen" und „Test D muss genau einen
// ausgewaehlten Wert in der echten Produktdatei verstellen und zuverlaessig zuruecksetzen;
// erwartet ist ausschliesslich der zugehoerige Vergleich rot."
//
// WAS SICH GEGEN D2 GEAENDERT HAT:
//   · A misst die ECHTE Produktdatei (taskpane.html), nicht mehr die Kopie unter
//     tools/design-vergleich/staende/. Der alte Kopienvergleich ist ABGELOEST: die Stand-Datei
//     `wissen-erfassen-2620-d1.html` wird von keinem Test mehr gelesen und ist in diesem Stand nicht
//     enthalten; der frühere Fall B (Einbau-Reissleine „21 fehlende Werte") ist gegenstandslos,
//     weil der Einbau jetzt IST — er entfaellt ersatzlos, kein zweiter Pruefweg bleibt stehen.
//   · D verstellt den Wert IN DER ECHTEN DATEI AUF DER PLATTE und setzt sie im `finally` byteweise
//     zurueck (Hash vorher == Hash nachher wird im Test selbst gemessen). Gemessen wird die
//     Differenz „rot nach der Mutation, gruen davor" — so kippt eine AEUSSERE Gegenmutation eines
//     anderen Werts (Lauf 2 des Auftrags) nur A, nicht D: ein Fall je Zusicherung.
//
// Die Werte (25, WERTE_WISSEN_ERFASSEN in tools/design-vergleich/werte.ts) und ihre Begruendung
// (bewusst Weggelassenes) sind unveraendert aus D2.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WERTE_WISSEN_ERFASSEN, vergleiche } from "../../tools/design-vergleich/werte";

const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/WissenErfassen.dc.html";
/** DIE ECHTE PRODUKTDATEI — kein Stand, keine Kopie. */
const PRODUKT = new URL("../../apps/web/public/word-addin/taskpane.html", import.meta.url).pathname;

const zielbildDa = existsSync(ZIELBILD);
const lies = (p: string): string => readFileSync(p, "utf8");
const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

describe.runIf(zielbildDa)(
  "JOB 2620 · Zielbild-Abgleich Wissen erfassen — an der echten taskpane.html",
  () => {
    it("A — die ECHTE Produktdatei entspricht dem Zielbild: jeder tragende Wert einzeln gleich", () => {
      const befunde = vergleiche(lies(ZIELBILD), lies(PRODUKT), WERTE_WISSEN_ERFASSEN);
      for (const b of befunde) {
        expect(
          b.gleich,
          `${b.name}: ziel=${JSON.stringify(b.ziel)} produkt=${JSON.stringify(b.gebaut)}`,
        ).toBe(true);
      }
      expect(befunde.every((b) => b.ziel !== null)).toBe(true);
      expect(befunde.length).toBe(WERTE_WISSEN_ERFASSEN.length);
    });

    it("C — KALIBRIERUNG: die Pruefung kennt keinen null-null-Treffer, und jeder Zielwert existiert", () => {
      const gegenLeer = vergleiche(lies(ZIELBILD), "<html></html>", WERTE_WISSEN_ERFASSEN);
      expect(gegenLeer.every((b) => !b.gleich)).toBe(true);
      expect(gegenLeer.every((b) => b.ziel !== null)).toBe(true);
    });

    it("D — GEGENPROBE IN DER ECHTEN DATEI: ein verstellter Wert kippt genau seinen Vergleich, die Datei kommt byteweise zurueck", () => {
      // Der Kasten-Innenabstand „9px 10px" ist in der Produktdatei EINDEUTIG (gemessen unten);
      // `border-radius: 8px` kaeme mehrfach vor und traefe die falsche Regel.
      const ANKER = "padding: 9px 10px";
      const original = lies(PRODUKT);
      const hashVorher = sha256(original);
      // Auch die ZEITEN kommen zurueck: das Tor (tools/check) baut das Buendel VOR den Tests und
      // laesst den UI-Smoke danach nur laufen, wenn keine Quelle juenger ist als das Buendel. Ein
      // byteweise restaurierter, aber neu gestempelter Produktstand liess den Smoke sonst mit
      // „dist ist AELTER als der Quellstand" abbrechen — rot ohne Fehler.
      const zeitenVorher = statSync(PRODUKT);
      expect(original.split(ANKER).length, "Anker in der Produktdatei nicht eindeutig").toBe(2);
      const rotVorher = vergleiche(lies(ZIELBILD), original, WERTE_WISSEN_ERFASSEN)
        .filter((b) => !b.gleich)
        .map((b) => b.name);
      let gefallen: string[] = [];
      try {
        writeFileSync(PRODUKT, original.replace(ANKER, "padding: 9px 11px"), "utf8");
        // Gelesen wird die DATEI, nicht die Speicherkopie — die Mutation liegt wirklich auf der Platte.
        gefallen = vergleiche(lies(ZIELBILD), lies(PRODUKT), WERTE_WISSEN_ERFASSEN)
          .filter((b) => !b.gleich)
          .map((b) => b.name)
          .filter((n) => !rotVorher.includes(n));
      } finally {
        writeFileSync(PRODUKT, original, "utf8");
        utimesSync(PRODUKT, zeitenVorher.atime, zeitenVorher.mtime);
      }
      expect(gefallen).toEqual(["kasten-innenabstand 9px 10px"]);
      expect(sha256(lies(PRODUKT)), "die Produktdatei kam nicht byteweise zurueck").toBe(
        hashVorher,
      );
    });
  },
);

describe.runIf(!zielbildDa)("JOB 2620 · Zielbild-Abgleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — Abgleich hier nicht messbar.`).toBe(
      false,
    );
  });
});
