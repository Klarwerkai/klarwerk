// ================================================================================================
// JOB 4322 · DIE KALIBRIERUNG DER STRECKE — dieselbe Strecke, gezielt verstellt, MUSS ROT WERDEN.
// ================================================================================================
//
// WOZU. Ein Nachweis, der an unverändertem Produkt grün ist, sagt für sich genommen nichts: er wäre
// auch dann grün, wenn er gar nichts prüfte. Diese Datei fährt DENSELBEN Ablauf (`offlineweg.ts`)
// mit je einer verstellten Voraussetzung. Jeder Fall hier MUSS scheitern, und die Meldung MUSS die
// Station nennen, an der er scheitert.
//
// WARUM SIE IM REGELBETRIEB ÜBERSPRUNGEN WIRD (Auftrag Lieferung 3, Codex 17.09. 17:07): Ein
// dauerhaft roter `it` im Tor wäre ein Dauerrot, das nach zwei Tagen niemand mehr liest. Die Fälle
// laufen deshalb nur unter `KLARWERK_KALIBRIERUNG=1` — einmal, im Cloud-Wrapper, mit
// Exit-Code als Beleg. Ohne den Schalter steht der GRUND sichtbar auf stderr; ein stiller Skip
// sähe aus wie ein bestandener Lauf.
//
// DIE SECHS VERSTELLUNGEN und was sie messen:
//   K1  Eigentümer des liegenden Vorgangs auf B gefälscht → der Riegel hat nichts mehr zu greifen,
//       Station (c) muss rot werden. (Auftrag Lieferung 3, wörtlich.)
//   K2  Station (d) erwartet ZWEI Zeilen statt einer → die Zeilenzählung muss anschlagen.
//       (Auftrag §6, Red-first: „verstellte Zeilenzahl → rot".)
//   K3  Die Meldungen der Fläche ausgeblendet → die Sichtbarkeitszusage von Station (a)
//       („mob.queued") muss anschlagen und nicht die blosse Anwesenheit im DOM melden.
//       (REGELN.md §9, Lehren 17.09. zu 4295 R1–R3 und 4305 R1.)
//   K4  Die Zeile über fremde Vorgänge ausgeblendet → die Sichtbarkeitszusage von Station (c)
//       muss anschlagen.
//   K5  Bs manueller Klick wird vollständig verschluckt → Station (c2) muss rot werden. Das ist
//       BENs eigene Probe an Runde 1, an der der Fall damals GRÜN blieb (Korrekturpflicht 2): er
//       fragte nach dem Klick nur Zustände ab, die schon vorher so dastanden.
//   K6  Bs manueller Klick wirkt erst nach 40 s → Station (c2) muss innerhalb ihrer 20-s-Frist rot
//       werden. Ohne diesen Fall bliebe offen, ob der Nachweis den Abschluss misst oder nur lange
//       genug wartet.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { fahreDenOfflineWeg } from "./offlineweg";
import type { Verstellung } from "./offlineweg";
import {
  A_MAIL,
  B_MAIL,
  JOB,
  type Pruefstand,
  TITEL_A,
  inFrischerDatenbank,
  pruefstandAbbauen,
  pruefstandAufbauen,
} from "./pruefstand";

// ================================================================================================
// ZWEI SCHALTER FÜR DIESELBE ANFORDERUNG — und warum es zwei sein müssen.
// ================================================================================================
//
// `KLARWERK_KALIBRIERUNG=1` ist der Schalter, den der Auftrag nennt, und er gilt weiter für jeden
// Lauf von Hand. Der Cloud-Wrapper (`register/cloud/remote_job.py:111`) baut die Umgebung des
// Laufs aber SELBST und reicht keine eigenen Variablen durch — über ihn wäre die Kalibrierung
// unerreichbar, und der Auftrag verlangt ausdrücklich, sie dort einmal zu fahren. Der zweite
// Schalter ist deshalb eine DATEI im Arbeitsbaum: der Wrapper nimmt den Arbeitsbaum samt
// ungesicherter Änderungen als Schnappschuss mit, also reist sie mit.
//
// SIE GEHÖRT NICHT IN DIE AUSLIEFERUNG. Liegt sie, laufen hier vier absichtlich rote Fälle — im
// regulären Tor wäre das ein Dauerrot. Sie wird nach der Messung wieder entfernt; dass sie da war,
// steht in der Rückgabe mit Arbeitsprüfkennung und Exit-Code.
const MARKE = resolve(process.cwd(), "tests/offline-identitaet-anlage/KALIBRIERUNG.angefordert");
const ANGEFORDERT = process.env.KLARWERK_KALIBRIERUNG === "1" || existsSync(MARKE);

describe("JOB 4322 · Kalibrierung: dieselbe Strecke, verstellt — sie MUSS scheitern", () => {
  let stand: Pruefstand | undefined;

  beforeAll(async () => {
    if (!ANGEFORDERT) {
      process.stderr.write(
        `${JOB} KALIBRIERUNG UEBERSPRUNGEN: weder KLARWERK_KALIBRIERUNG=1 noch die Datei ${MARKE} liegt vor. Diese sechs Fälle sind ABSICHTLICH rot und laufen nur auf ausdrückliche Anforderung (Auftrag Lieferung 3); der reguläre Lauf bleibt dadurch grün.\n`,
      );
      return;
    }
    stand = await pruefstandAufbauen("K");
  }, 900_000);

  afterAll(async () => {
    await pruefstandAbbauen(stand);
  }, 120_000);

  const kalibrierung = (marke: string, was: string, verstellen: Verstellung): void => {
    it(`${marke} — ${was}`, async (ctx) => {
      if (!ANGEFORDERT || !stand?.verfuegbar) {
        ctx.skip();
        return;
      }
      const pruefstand = stand;
      process.stderr.write(`${JOB} ${marke} läuft (ABSICHTLICH ROT ERWARTET) · ${was}\n`);
      await inFrischerDatenbank(pruefstand, marke, async (welt) =>
        fahreDenOfflineWeg({
          browser: welt.browser,
          strecke: welt.strecke,
          pool: welt.pool,
          aEmail: A_MAIL,
          bEmail: B_MAIL,
          aId: welt.aId,
          bId: welt.bId,
          titelA: TITEL_A,
          verstellen,
        }),
      );
    }, 900_000);
  };

  kalibrierung("K1", "Eigentümer auf B gefälscht → Station (c) muss rot werden", {
    eigentuemerAufB: true,
  });
  kalibrierung("K2", "Station (d) erwartet zwei Zeilen statt einer → muss rot werden", {
    erwarteteZeilenNachAnlage: 2,
  });
  kalibrierung("K3", "die Meldungen sind ausgeblendet → Station (a) muss rot werden", {
    ausblendenVorA: "output",
  });
  kalibrierung("K4", "die Fremdzeile ist ausgeblendet → Station (c) muss rot werden", {
    ausblendenVorC: '[data-testid="mob-fremde-vorgaenge"]',
  });
  kalibrierung("K5", "Bs manueller Klick wird verschluckt → Station (c2) muss rot werden", {
    klickUnterdruecken: true,
  });
  kalibrierung("K6", "Bs manueller Klick wirkt erst nach 40 s → Station (c2) muss rot werden", {
    klickVerzoegernMs: 40_000,
  });
});
