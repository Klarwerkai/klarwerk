// ================================================================================================
// JOB 4328 · DIE KALIBRIERUNG — FUENF MUTATIONEN, FUENF ROTE STATIONEN, DIESELBE STRECKE.
// ================================================================================================
//
// REGELN.md 9, wörtlich: „Kalibriere jede Sichtbarkeitsbehauptung durch gezieltes Ausblenden genau
// dieses Elements (`display:none`/`visibility:hidden`) bei sonst unveränderter Fläche: der
// unveränderte Test MUSS daran mit konkretem Feldnamen scheitern." Das sind K1 und K2. K3–K5
// kalibrieren die zweite Fehlerklasse: eine Zusage, die auch dann grün bliebe, wenn die Sache
// selbst nicht stimmt.
//
//   K1  `display:none` auf `[data-testid="graph-kuratiert-gekuerzt"]`
//       → Station (f) scheitert NAMENTLICH an diesem Element, nicht an seiner Abwesenheit.
//   K2  `visibility:hidden` auf `[data-testid="graph-kante-kuratiert"]`
//       → Station (c) scheitert an „nicht SICHTBAR", nicht an „fehlt": die Linien stehen im Baum.
//   K3  verstellte Erwartung: in Station (c) wird der Kürzungshinweis VERLANGT
//       → rot, denn ohne Kürzung steht er nicht. Das kalibriert die Gegenprobe „kein Hinweis".
//   K4  nach bestätigtem Widerruf `UPDATE ko_kanten SET status = 'aktiv'`
//       → Station (d) scheitert beim NEULADEN: die Fläche folgt dem Bestand und nicht einer
//         Erfolgsmeldung. Die Mutation greift AUSDRUECKLICH erst nach der Bestandsprüfung, sonst
//         schlüge diese zuerst an und der Nachweis über die Fläche wäre nicht gefahren.
//   K5  zwischen SIGTERM und dem neuen Prozess `DELETE FROM ko_kanten WHERE id = <gerichtete>`
//       → Station (e) scheitert an der Kachelzahl: ein Bestandsverlust über den Prozesswechsel
//         wird gesehen.
//
// WARUM SIE NUR UNTER `KLARWERK_KALIBRIERUNG=1` LAUFEN: jede dieser Fälle MUSS rot werden. Als
// dauerhaft roter `it` machte er das Tor rot und wäre nach einer Woche abgeschaltet. Ohne die
// Variable steht der Grund SICHTBAR auf stderr, und der Zeugenfall unten sagt, dass hier nichts
// belegt ist — kein Skip, der wie Grün aussieht.
//
// JEDE MUTATION FAEHRT NUR DIE STATIONEN, DIE SIE BRAUCHT, und jede gegen eine EIGENE
// Wegwerfdatenbank. Ein gemeinsamer Bestand hätte die Mutationen einander sehen lassen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import {
  MARKE,
  type Mutation,
  SOLL,
  type Station,
  type Umgebung,
  WIDERRUFEN_KURZ,
  fahreStrecke,
  richteUmgebungEin,
} from "./strecke";

const AN = process.env.KLARWERK_KALIBRIERUNG === "1";

interface Fall {
  readonly nr: string;
  readonly stationen: readonly Station[];
  readonly mutation: Mutation;
  /** Der Wortlaut, an dem die Station scheitern MUSS — sonst wäre die Gegenprobe wirkungslos. */
  readonly erwarteterFehler: string;
}

const FAELLE: readonly Fall[] = [
  {
    nr: "K1",
    stationen: ["f"],
    mutation: {
      name: "der Kürzungshinweis wird ausgeblendet (display:none)",
      stil: '[data-testid="graph-kuratiert-gekuerzt"] { display: none !important; }',
    },
    erwarteterFehler: "der Kuerzungshinweis ist nicht SICHTBAR",
  },
  {
    nr: "K2",
    stationen: ["c"],
    mutation: {
      name: "die Fachkanten werden unsichtbar gemacht (visibility:hidden)",
      stil: '[data-testid="graph-kante-kuratiert"] { visibility: hidden !important; }',
    },
    erwarteterFehler: "jede gezeichnete Fachkante muss SICHTBAR sein",
  },
  {
    nr: "K3",
    stationen: ["c"],
    mutation: {
      name: "verstellte Erwartung: der Kürzungshinweis wird ohne Kürzung verlangt",
      erwarteHinweisInC: true,
    },
    erwarteterFehler: "verstellte Erwartung K3",
  },
  {
    nr: "K4",
    stationen: ["d"],
    mutation: {
      name: "der Widerruf wird im Bestand zurückgenommen",
      nachBestandspruefung: async (pool, bestand) => {
        const ergebnis = await pool.query(
          "UPDATE ko_kanten SET status = 'aktiv' WHERE id = $1 AND status = 'widerrufen'",
          [bestand.kanteId(WIDERRUFEN_KURZ)],
        );
        // Null Treffer wären eine wirkungslose Gegenprobe — und die darf nicht als Kalibrierung
        // durchgehen (Muster `VERSTECKE` in `beziehungen-im-browser-nach-restore`).
        expect(ergebnis.rowCount, "K4 hat keine widerrufene Zeile getroffen").toBe(1);
      },
    },
    erwarteterFehler: "die widerrufene Kachel ist nach dem Neuladen wieder da",
  },
  {
    nr: "K5",
    stationen: ["d", "e"],
    mutation: {
      name: "eine aktive Beziehung wird zwischen SIGTERM und Neustart gelöscht",
      vorNeustart: async (pool, bestand) => {
        const ergebnis = await pool.query("DELETE FROM ko_kanten WHERE id = $1", [
          bestand.kanteId(SOLL.gerichtet.kurz),
        ]);
        expect(ergebnis.rowCount, "K5 hat keine Zeile gelöscht").toBe(1);
      },
    },
    erwarteterFehler: "Kacheln an alpha nach dem Prozessneustart",
  },
];

describe("JOB 4328 · Kalibrierung: dieselbe Strecke, gezielt verstellt", () => {
  let umgebung: Umgebung | undefined;
  let aufraeumen: (() => Promise<void>) | undefined;
  let zustand: Laufzustand | undefined;

  beforeAll(async () => {
    if (!AN) {
      zustand = {
        gelaufen: false,
        grund:
          "KLARWERK_KALIBRIERUNG ist nicht 1 — diese fünf Fälle MUESSEN rot werden und laufen deshalb nur auf ausdrückliche Anforderung",
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
          stationen: fall.stationen,
          mutation: fall.mutation,
          kennung: `${fall.nr.toLowerCase()}${`${Date.now()}`.slice(-8)}`,
        });
      } catch (gefangen) {
        fehler = gefangen;
      }
      // DIE GEGENPROBE IST NUR WIRKSAM, WENN SIE AN DER RICHTIGEN STELLE SCHEITERT: ein
      // beliebiger Fehler (Zeitablauf, fehlender Container) belegt nichts. Deshalb wird der
      // WORTLAUT geprüft und nicht nur die Tatsache, dass etwas schieflief.
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
    }, 1_800_000);
  }

  it("Zeuge: ohne KLARWERK_KALIBRIERUNG=1 ist hier nichts belegt", () => {
    process.stderr.write(befundsatz(`${MARKE} KALIBRIERUNG ZEUGE`, zustand));
    if (!AN) {
      expect(zaehltAlsBestanden(zustand), "ohne die Variable darf nichts als belegt gelten").toBe(
        false,
      );
      return;
    }
    expect(FAELLE.length, "es sind fünf Kalibrierungen zugesagt").toBe(5);
    expect(
      FAELLE.filter((f) => f.mutation.stil).length,
      "zwei davon sind Sichtbarkeitskalibrierungen nach REGELN.md 9",
    ).toBe(2);
  });
});
