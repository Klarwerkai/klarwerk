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
//   K1/K4  Nach W4.6 entfernt Abmelden die wartende Arbeit und ihr Foto. Die
//          Gegenproben erwarten bewusst den früheren Rest von eins an der echten O2-Messung.
//   K2     Falsche erwartete Zeilenzahl nach belegter Anlage.
//   K3     Fehlende sichtbare Offlinequittung.
//   K5/K6  Unterdrückter oder verspäteter manueller Wiederholungsversuch von A.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { pgKalibrierung } from "../pg-laufbeleg/kalibrierung";
import { fahreDenAbmeldeWeg, fahreDenOfflineWeg } from "./offlineweg";
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
const { aktiv: ANGEFORDERT, it } = pgKalibrierung(
  process.env.KLARWERK_KALIBRIERUNG === "1" || existsSync(MARKE),
  {
    K1: /^K1: falscher Sollwert am gemessenen Bestand nach Abmeldung \(queueNachAbmeldung\): expected \+?0 to be 1/u,
    K2: /Station \(d\): in `drafts` steht nicht genau eine Zeile: expected 1 to be 2/u,
    K3: /Station \(a\): der Offline-Satz: die Meldung „.+ steht im DOM, ist aber NICHT sichtbar/u,
    K4: /^K4: falscher Sollwert am gemessenen Bestand nach Abmeldung \(fotosNachAbmeldung\): expected \+?0 to be 1/u,
    K5: /Station \(e\): die Wiederholung: nach dem Klick kam KEINE neue Rückmeldung/u,
    K6: /Station \(e\): die Wiederholung: nach dem Klick kam KEINE neue Rückmeldung/u,
  },
);

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

  const kalibrierung = (
    marke: string,
    was: string,
    verstellen: Verstellung | "queueNachAbmeldung" | "fotosNachAbmeldung",
  ): void => {
    it(`${marke} — ${was}`, async (ctx) => {
      if (!ANGEFORDERT || !stand?.verfuegbar) {
        ctx.skip();
        return;
      }
      const pruefstand = stand;
      process.stderr.write(`${JOB} ${marke} läuft (ABSICHTLICH ROT ERWARTET) · ${was}\n`);
      await inFrischerDatenbank(pruefstand, marke, async (welt) => {
        const aufbau = {
          browser: welt.browser,
          strecke: welt.strecke,
          pool: welt.pool,
          aEmail: A_MAIL,
          bEmail: B_MAIL,
          aId: welt.aId,
          bId: welt.bId,
          titelA: TITEL_A,
        };
        if (typeof verstellen === "string") {
          const abmeldung = await fahreDenAbmeldeWeg(aufbau);
          expect(
            abmeldung[verstellen],
            `${marke}: falscher Sollwert am gemessenen Bestand nach Abmeldung (${verstellen})`,
          ).toBe(1);
        } else {
          await fahreDenOfflineWeg({ ...aufbau, verstellen });
        }
      });
    }, 900_000);
  };

  kalibrierung(
    "K1",
    "O2 erwartet eine verbliebene Queue-Zeile nach Abmeldung",
    "queueNachAbmeldung",
  );
  kalibrierung("K2", "Station (d) erwartet zwei Zeilen statt einer → muss rot werden", {
    erwarteteZeilenNachAnlage: 2,
  });
  kalibrierung("K3", "die Meldungen sind ausgeblendet → Station (a) muss rot werden", {
    ausblendenVorA: "output",
  });
  kalibrierung("K4", "O2 erwartet ein verbliebenes Foto nach Abmeldung", "fotosNachAbmeldung");
  kalibrierung("K5", "As manueller Klick wird verschluckt → der manuelle Retry muss rot werden", {
    klickUnterdruecken: true,
  });
  kalibrierung(
    "K6",
    "As manueller Klick wirkt erst nach 40 s → der manuelle Retry muss rot werden",
    {
      klickVerzoegernMs: 40_000,
    },
  );
});
