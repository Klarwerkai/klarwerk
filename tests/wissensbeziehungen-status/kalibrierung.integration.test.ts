// ================================================================================================
// JOB 4353 · DIE KALIBRIERUNG — SECHS MUTATIONEN, SECHS ROTE STRECKEN, DIESELBE STRECKE.
// ================================================================================================
//
// REGELN.md 9, wörtlich: „Kalibriere jede Sichtbarkeitsbehauptung durch gezieltes Ausblenden genau
// dieses Elements (`display:none`/`visibility:hidden`) bei sonst unveränderter Fläche: der
// unveränderte Test MUSS daran mit konkretem Feldnamen scheitern." Das sind K1, K2, K5 und K6.
//
// K3 und K4 kalibrieren die ZWEITE Fehlerklasse aus REGELN.md — den Ausfall des Messwegs selbst:
// eine Probe gegen die Datenbank, die nichts liest oder etwas anderes liest als die Fläche zeigt,
// darf nicht grün bleiben. Genau daran ist in der Vergangenheit dreimal ein neuer Abnahmeweg
// vorbeigelaufen (4263 R1, 4271 R1, 4275 R1).
//
//   K1  `display:none` auf `[data-testid="wb-status"]` (jedes Profil)
//       → die Liste der ERSTEN Station scheitert NAMENTLICH am Statuswort, nicht an seiner
//         Abwesenheit im Baum.
//   K2  `visibility:hidden` auf `[data-testid="wb-antwort-status"]` (jedes Profil)
//       → der Widerruf der ersten Station scheitert an „nicht SICHTBAR": das Element steht im Baum.
//   K3  nach dem Ablesen der Antwort `UPDATE ko_kanten SET status = 'aktiv'`
//       → die zweite Probe meldet einen ANDEREN Status als die Fläche. Ohne eine Probe, die
//         wirklich liest und wirklich vergleicht, bliebe dieser Lauf grün.
//   K4  vor der ersten Probe `DELETE FROM ko_kanten WHERE id = <gemessene>`
//       → die Probe findet keine Zeile und WIRFT, statt still durchzulassen. Eine Probe ohne
//         Treffer ist kein Bestand.
//
// ================================================================================================
// K5 UND K6 SIND NEU IN RUNDE 2 — SIE KALIBRIEREN DIE SPRACHEN EINZELN.
// ================================================================================================
//
// Runde 1 hat nur DE im Browser gemessen. Runde 2 fährt DE, EN und NL (BEN: „EN/NL zusätzlich im
// echten Chromium prüfen"). Ein Stil, der in JEDEM Profil greift, lässt die Strecke aber schon an
// der ersten Station scheitern — er sagt damit nichts darüber, ob die zweite und dritte Station
// wirklich messen. Genau das wäre die Lücke: zwei zugesagte Sprachen, die nie kalibriert wurden.
//
//   K5  `display:none` auf `[data-testid="wb-status"]` NUR im EN-Profil
//       → DE läuft durch, EN scheitert mit „en:" im Wortlaut. Die EN-Station misst wirklich.
//   K6  `visibility:hidden` auf `[data-testid="wb-antwort-status"]` NUR im NL-Profil
//       → DE und EN laufen durch, NL scheitert mit „nl:". Auch das zweite Wort ist je Sprache
//         kalibriert.
//
// WARUM SIE NUR UNTER `KLARWERK_KALIBRIERUNG=1` LAUFEN: jeder dieser Fälle MUSS rot werden. Als
// dauerhaft roter `it` machte er das Tor rot und wäre nach einer Woche abgeschaltet. Ohne die
// Variable steht der Grund SICHTBAR auf stderr, und der Zeugenfall unten sagt, dass hier nichts
// belegt ist — kein Skip, der wie Grün aussieht.
//
// JEDE MUTATION FAEHRT GEGEN EINE EIGENE Wegwerfdatenbank. Ein gemeinsamer Bestand hätte die
// Mutationen einander sehen lassen. Und jede fährt nur die Stationen, die sie BRAUCHT
// (`nurStationen`) — das kürzt die Wartezeit, nicht die Aussage: die weggelassenen Stationen sind
// die, die hinter dem erwarteten Abbruch lägen und ohnehin nie erreicht würden.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { MARKE, type Mutation, type Umgebung, fahreStrecke, richteUmgebungEin } from "./strecke";

const AN = process.env.KLARWERK_KALIBRIERUNG === "1";

interface Fall {
  readonly nr: string;
  readonly mutation: Mutation;
  /** Der Wortlaut, an dem die Strecke scheitern MUSS — sonst wäre die Gegenprobe wirkungslos. */
  readonly erwarteterFehler: string;
  /** Welche Sprachstationen dieser Fall fahren muss, um seine Stelle zu erreichen. */
  readonly stationen: readonly string[];
}

const FAELLE: readonly Fall[] = [
  {
    nr: "K1",
    mutation: {
      name: "das Statuswort an der Beziehung wird ausgeblendet (display:none)",
      stil: '[data-testid="wb-status"] { display: none !important; }',
    },
    erwarteterFehler: "de: das Statuswort der Beziehung ist nicht SICHTBAR",
    stationen: ["de"],
  },
  {
    nr: "K2",
    mutation: {
      name: "das Statuswort an der Widerrufsantwort wird unsichtbar gemacht (visibility:hidden)",
      stil: '[data-testid="wb-antwort-status"] { visibility: hidden !important; }',
    },
    erwarteterFehler: "de: das Statuswort der Antwort ist nicht SICHTBAR",
    stationen: ["de"],
  },
  {
    nr: "K3",
    mutation: {
      name: "der Widerruf wird im Bestand zurückgenommen, nachdem die Fläche gelesen wurde",
      vorProbeNachher: async (pool, kanteId) => {
        const ergebnis = await pool.query(
          "UPDATE ko_kanten SET status = 'aktiv' WHERE id = $1 AND status = 'widerrufen'",
          [kanteId],
        );
        // Null Treffer wären eine wirkungslose Gegenprobe — und die darf nicht als Kalibrierung
        // durchgehen.
        expect(ergebnis.rowCount, "K3 hat keine widerrufene Zeile getroffen").toBe(1);
      },
    },
    erwarteterFehler: "die Datenbank meldet",
    stationen: ["de"],
  },
  {
    nr: "K4",
    mutation: {
      name: "die gemessene Beziehung wird vor der Probe aus dem Bestand entfernt",
      vorProbeVorher: async (pool, kanteId) => {
        const ergebnis = await pool.query("DELETE FROM ko_kanten WHERE id = $1", [kanteId]);
        expect(ergebnis.rowCount, "K4 hat keine Zeile gelöscht").toBe(1);
      },
    },
    erwarteterFehler: "die Probe gegen die Datenbank fand 0 Zeilen",
    stationen: ["de"],
  },
  {
    nr: "K5",
    mutation: {
      name: "das Statuswort wird NUR im EN-Profil ausgeblendet (display:none)",
      stil: '[data-testid="wb-status"] { display: none !important; }',
      nurSprache: "en",
    },
    erwarteterFehler: "en: das Statuswort der Beziehung ist nicht SICHTBAR",
    stationen: ["de", "en"],
  },
  {
    nr: "K6",
    mutation: {
      name: "das Statuswort der Antwort wird NUR im NL-Profil unsichtbar gemacht (visibility:hidden)",
      stil: '[data-testid="wb-antwort-status"] { visibility: hidden !important; }',
      nurSprache: "nl",
    },
    erwarteterFehler: "nl: das Statuswort der Antwort ist nicht SICHTBAR",
    stationen: ["de", "en", "nl"],
  },
];

describe("JOB 4353 · Kalibrierung: dieselbe Strecke, gezielt verstellt", () => {
  let umgebung: Umgebung | undefined;
  let aufraeumen: (() => Promise<void>) | undefined;
  let zustand: Laufzustand | undefined;

  beforeAll(async () => {
    if (!AN) {
      zustand = {
        gelaufen: false,
        grund:
          "KLARWERK_KALIBRIERUNG ist nicht 1 — diese sechs Fälle MUESSEN rot werden und laufen deshalb nur auf ausdrückliche Anforderung",
      };
      process.stderr.write(befundsatz(`${MARKE} KALIBRIERUNG`, zustand));
      return;
    }
    const eingerichtet = await richteUmgebungEin();
    zustand = eingerichtet.zustand;
    umgebung = eingerichtet.umgebung;
    aufraeumen = eingerichtet.aufraeumen;
    if (!zaehltAlsBestanden(zustand)) {
      process.stderr.write(befundsatz(`${MARKE} KALIBRIERUNG`, zustand));
    }
  }, 900_000);

  afterAll(async () => {
    await aufraeumen?.();
    process.stderr.write(befundsatz(`${MARKE} KALIBRIERUNG`, zustand));
  }, 300_000);

  for (const fall of FAELLE) {
    it(`${fall.nr} · ${fall.mutation.name} → die Strecke MUSS rot werden`, async () => {
      if (!umgebung) {
        process.stderr.write(befundsatz(`${MARKE} KALIBRIERUNG ${fall.nr}`, zustand));
        return;
      }
      let fehler: unknown;
      try {
        await fahreStrecke(umgebung, {
          mutation: fall.mutation,
          nurStationen: fall.stationen,
          kennung: `${fall.nr.toLowerCase()}${`${Date.now()}`.slice(-8)}`,
        });
      } catch (gefangen) {
        fehler = gefangen;
      }
      // DIE GEGENPROBE IST NUR WIRKSAM, WENN SIE AN DER RICHTIGEN STELLE SCHEITERT: ein beliebiger
      // Fehler (Zeitablauf, fehlender Container) belegt nichts. Deshalb wird der WORTLAUT geprüft
      // und nicht nur die Tatsache, dass etwas schieflief — bei K5/K6 einschliesslich der Sprache.
      expect(
        fehler,
        `${fall.nr}: die Strecke blieb GRUEN, obwohl ${fall.mutation.name} — die Zusage ist damit nicht kalibriert`,
      ).toBeDefined();
      expect(
        String(fehler),
        `${fall.nr}: die Strecke scheiterte, aber nicht an der kalibrierten Stelle`,
      ).toContain(fall.erwarteterFehler);
      // UND SIE MUSS ROT BLEIBEN: der Fall selbst endet hier absichtlich fehlerhaft, damit der
      // Lauf mit Exit 1 endet und niemand eine grüne Kalibrierung als Nachweis liest.
      throw new Error(
        `${MARKE} ${fall.nr} KALIBRIERUNG WIRKSAM: ${fall.mutation.name} → ${String(fehler).split("\n")[0]}`,
      );
    }, 3_600_000);
  }

  it("Zeuge: ohne KLARWERK_KALIBRIERUNG=1 ist hier nichts belegt", () => {
    process.stderr.write(befundsatz(`${MARKE} KALIBRIERUNG ZEUGE`, zustand));
    if (!AN) {
      expect(zaehltAlsBestanden(zustand), "ohne die Variable darf nichts als belegt gelten").toBe(
        false,
      );
      return;
    }
    expect(FAELLE.length, "es sind sechs Kalibrierungen zugesagt").toBe(6);
    expect(
      FAELLE.filter((f) => f.mutation.stil).length,
      "vier davon sind Sichtbarkeitskalibrierungen nach REGELN.md 9",
    ).toBe(4);
    expect(
      FAELLE.filter((f) => f.mutation.vorProbeVorher ?? f.mutation.vorProbeNachher).length,
      "zwei davon kalibrieren den Messweg selbst",
    ).toBe(2);
    // Jede zugesagte Sprache ist eigens kalibriert — sonst wäre eine davon nur behauptet.
    for (const sprache of ["de", "en", "nl"]) {
      expect(
        FAELLE.some((f) => f.erwarteterFehler.startsWith(`${sprache}:`)),
        `für ${sprache} gibt es keine Gegenprobe, die an DIESER Station scheitert`,
      ).toBe(true);
    }
  });
});
