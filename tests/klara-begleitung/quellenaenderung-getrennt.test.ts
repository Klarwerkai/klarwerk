// ================================================================================================
// BPA-05 · AKTIVE BEGLEITUNG — K9 (und die Quelltextseite von K4/K8): die Begleitung ist KEIN
// Quellenänderungsdienst, kein Rekorder und kein Verlauf.
// ================================================================================================
//
// Originalkriterium K9: „Langfristige Änderungen einer freigegebenen Datei werden über den
// Quellenänderungsdienst erkannt, auch ohne geöffnetes Fenster; Live-Begleitung ersetzt diesen
// Dienst nicht."
//
// Das ERKENNEN belegen die bestehenden Prüfstände des getrennten Dienstes, die in derselben
// Prüfauswahl laufen — beide arbeiten am Server, ohne dass irgendein Fenster geöffnet ist:
//   · `tests/confluence-quellabgleich/abgleich.test.ts` — der Abgleich zieht neue Fassungen und
//     Löschungen der Quelle nach.
//   · `tests/quellenaenderungen-bewusst-uebernehmen/dienst-und-tuer.test.ts` — eine neuere
//     Quellfassung erscheint als Vorschlag, mit Prüfzeitpunkt und Ergebnis.
// Dieser Fall hält die andere Hälfte fest: die Begleitung greift in diesen Dienst nicht ein und
// spielt ihn nicht nach. Gelesen aus dem Quelltext und am Verhalten des Kerns.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auskunft,
  leseAuftrag,
  nimmKontext,
  starte,
} from "../../apps/web/src/components/klara-begleitung/kern";

const DATEIEN = [
  "apps/web/src/components/klara-begleitung/kern.ts",
  "apps/web/src/components/klara-begleitung/adapter.ts",
  "apps/web/src/components/klara-begleitung/KlaraBegleitung.tsx",
];

/** Der Quelltext ohne Kommentare — eine Erwähnung im Kommentar ist kein Aufruf. */
function code(pfad: string): string {
  return readFileSync(pfad, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("K9 · Live-Begleitung ersetzt den Quellenänderungsdienst nicht", () => {
  it("die Begleitung importiert und ruft keinen Quellen-, Abgleich- oder Änderungsdienst", () => {
    for (const pfad of DATEIEN) {
      const text = code(pfad);
      const importe = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const ziel of importe) {
        expect(ziel, `${pfad} importiert ${ziel}`).not.toMatch(
          /gesamtanweisung|confluence|sharepoint|onedrive|quell|abgleich|aenderung|api\//i,
        );
      }
    }
  });

  it("ein Dateiereignis außerhalb des Bereichs wird weder gelesen noch als Änderung verbucht", () => {
    const r = starte(
      leseAuftrag("Produktrecherche, 30 Minuten"),
      { art: "domain", kennung: "hersteller.example", bezeichnung: "Herstellerseite" },
      { konto: "u-pia", jetzt: 0, id: "f" },
    );
    if (!r.ok) {
      throw new Error(r.fehler);
    }
    const datei = nimmKontext(
      r.begleitung,
      {
        quelle: { art: "anwendung", kennung: "finder:/Freigaben/Datenblatt.docx" },
        konto: "u-pia",
        felder: [{ name: "inhalt", bezeichnung: "Inhalt", wert: "Fassung 2" }],
      },
      { konto: "u-pia", darfBegleiten: true, jetzt: 1000 },
    );
    expect(datei.ergebnis).toBe("ausserhalb");
    expect(datei.begleitung.kontext).toBeNull();
    expect(auskunft(datei.begleitung, []).quellenaenderung).toBe("getrennter_dienst");
  });
});

describe("K4/K8 · im Quelltext: kein Netz, kein Gerät, kein Dauerspeicher", () => {
  it("keine Netz-, Medien- oder Dauerspeicheraufrufe in den drei Dateien der Begleitung", () => {
    for (const pfad of DATEIEN) {
      const text = code(pfad);
      for (const verboten of [
        /\bfetch\s*\(/,
        /XMLHttpRequest/,
        /WebSocket/,
        /sendBeacon/,
        /getUserMedia/,
        /getDisplayMedia/,
        /MediaRecorder/,
        /localStorage/,
        /indexedDB/,
      ]) {
        expect(text, `${pfad}: ${verboten}`).not.toMatch(verboten);
      }
    }
  });
});
