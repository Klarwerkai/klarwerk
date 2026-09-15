// ================================================================================================
// JOB 4012 · RUNDE 2 — DIE INSEL, DIE HEUTE LÄUFT, HAT KEINEN VERTRAG.
// ================================================================================================
//
// DIE ZWEI FEHLER AUS BENS GEGENPROBEN (BEN2, BEN3; Cloud 3aabe847) haben dieselbe Wurzel: Runde 1
// hat den Übergang vom BESTAND zum neuen Weg nicht behandelt. Auf dem Mac Studio steht ein Release,
// das mit `install.command` eingespielt wurde — es trägt keinen `SCHEMA-VERTRAG`, und neben den
// Daten liegt kein `SCHEMA-STAND`. Runde 1 las daraus „kein Vorstand" und schloss „nichts zu
// schützen":
//
//   BEN2  Journal mit echten Daten, Altinstallation, neues Release mit einer IRREVERSIBLEN Stufe
//         → Exit 0 und Urteil `ERSTSTAND`. Die Stufe lief und nahm Daten weg, ohne dass jemand
//           zugestimmt hätte. Ein unbekannter Datenstand ist kein leerer Datenstand.
//   BEN3  Rückfall auf dieselbe Altinstallation → `/health` meldete sauber `1.0.0`, der Weg
//         erwartete aber den VERZEICHNISNAMEN und meldete „gescheitert". Ein Verzeichnisname ist
//         keine Version; die App liest ihre aus `package.json` (`build-app.ts:buildVersion`).
//
// Diese Datei misst beide Enden des Übergangs: die Ablehnung des unbekannten Standes VOR dem
// Umschalten, den ausdrücklichen, benannten Weg darüber hinweg — und den Rückfall auf eine
// Altinstallation, der gelingt und das auch sagen darf.
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  type Stufe,
  aktivesRelease,
  fahreRueckfall,
  fahreUpdate,
  feldAus,
  gesundheit,
  legeInselAn,
  legeJournalAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
  standtext,
} from "./insel-probe";

const ALT = "klarwerk-insel-altinstallation";
const NEU = "klarwerk-insel-neu";

/** Dieselben zwei Grundstufen plus eine, die Daten wegnimmt. */
const MIT_IRREVERSIBEL: readonly Stufe[] = [
  { stufe: "AUTH_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ENTWURF_ZUSAMMENFUEHRUNG", risiko: "IRREVERSIBEL" },
];

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Der Bestand vor JOB 4012: eine laufende Fassung ohne Vertrag, daneben Daten. */
async function inselMitAltinstallation(): Promise<Insel> {
  const neue = await legeInselAn();
  schreibeRelease(neue.releases, { name: ALT, appVersion: "1.0.0", ohneVertrag: true });
  setzeCurrent(neue, ALT);
  legeJournalAn(neue);
  return neue;
}

describe("JOB 4012 · unbekannter Datenstand wird abgelehnt, nicht für leer gehalten (BEN2)", () => {
  it("A1 · Altinstallation mit Daten: das Update hält VOR dem Umschalten an", async () => {
    insel = await inselMitAltinstallation();
    const neu = schreibeRelease(join(insel.wurzel, "eingang"), {
      name: NEU,
      appVersion: "1.1.0",
      stufen: MIT_IRREVERSIBEL,
    });

    const lauf = fahreUpdate(insel, neu);

    expect(lauf.code, lauf.ausgabe).toBe(10);
    // Die Vorversion wird bei ihrer App-Version genannt, nicht bei ihrem Verzeichnisnamen.
    expect(lauf.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: datenstand",
    );
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(standtext(insel), "ohne Umschalten wird auch kein Stand erfunden").toBe("");
  });

  it("A2 · die Zustimmung zum unbekannten Stand allein reicht der irreversiblen Stufe nicht", async () => {
    insel = await inselMitAltinstallation();
    const neu = schreibeRelease(join(insel.wurzel, "eingang"), {
      name: NEU,
      appVersion: "1.1.0",
      stufen: MIT_IRREVERSIBEL,
    });

    // Ist der Stand unbekannt, gilt JEDE Stufe des Releases als neu — auch die irreversible.
    const lauf = fahreUpdate(insel, neu, ["--datenstand-unbekannt-uebernehmen"]);

    expect(lauf.code, lauf.ausgabe).toBe(4);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: vertrag");
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("A3 · mit beiden ausdrücklichen Zustimmungen läuft der Übergang durch und wird festgeschrieben", async () => {
    insel = await inselMitAltinstallation();
    const neu = schreibeRelease(join(insel.wurzel, "eingang"), {
      name: NEU,
      appVersion: "1.1.0",
      stufen: MIT_IRREVERSIBEL,
    });

    const lauf = fahreUpdate(insel, neu, [
      "--datenstand-unbekannt-uebernehmen",
      "--nicht-umkehrbar-einspielen",
    ]);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ergebnis).toContain("Update auf 1.1.0 aktiv, Sicherung ");
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
    // Ab jetzt ist der Stand bekannt — das nächste Update braucht keine Zustimmung mehr.
    expect(feldAus(standtext(insel), "stufen")).toContain("ENTWURF_ZUSAMMENFUEHRUNG");
    expect(feldAus(standtext(insel), "bestaetigt")).toBe("ja");
  });

  it("A4 · eine Altinstallation ohne Daten ist ein Erstlauf und braucht keine Zustimmung", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0", ohneVertrag: true });
    setzeCurrent(insel, ALT);
    legeJournalAn(insel, 0);
    const neu = schreibeRelease(join(insel.wurzel, "eingang"), { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdate(insel, neu);

    // Ein LEERES Journal ist ein belegter leerer Datenstand — da ist nichts zu schützen.
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });
});

describe("JOB 4012 · der Rückfall auf eine Altinstallation (BEN3)", () => {
  it("A5 · ohne Vertrag zählt die package.json — dieselbe Quelle, aus der /health liest", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0", ohneVertrag: true });
    schreibeRelease(insel.releases, { name: NEU, appVersion: "1.1.0" });
    setzeCurrent(insel, NEU);

    const zurueck = fahreRueckfall(insel, [ALT]);

    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(zurueck.ergebnis).toBe("Vorversion 1.0.0 aktiv");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("A6 · das gilt auch für den automatischen Rückfall aus einem roten Update", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0", ohneVertrag: true });
    setzeCurrent(insel, ALT);
    legeJournalAn(insel);
    const kaputt = schreibeRelease(join(insel.wurzel, "eingang"), {
      name: NEU,
      appVersion: "1.1.0",
      gesundheit: "rot",
    });

    // Der unbekannte Stand wird ausdrücklich übernommen; die Stufen sind additiv.
    const lauf = fahreUpdate(insel, kaputt, ["--datenstand-unbekannt-uebernehmen"]);

    expect(lauf.code, lauf.ausgabe).toBe(7);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft wieder, Grund: health");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("A7 · ist die Version aus dem Release gar nicht belegbar, wird kein „aktiv“ behauptet", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, {
      name: ALT,
      appVersion: "1.0.0",
      ohneVertrag: true,
      ohnePaketdatei: true,
    });
    schreibeRelease(insel.releases, { name: NEU, appVersion: "1.1.0" });
    setzeCurrent(insel, NEU);

    const zurueck = fahreRueckfall(insel, [ALT]);

    expect(zurueck.code, zurueck.ausgabe).toBe(8);
    expect(zurueck.ergebnis).toContain("nicht belegbar");
    expect(zurueck.ergebnis, "ohne Versionsbeleg gibt es kein „aktiv“").not.toContain("aktiv");
    // Geschaltet wurde trotzdem — der Satz sagt genau das, was ist.
    expect(aktivesRelease(insel)).toBe(ALT);
  });
});
