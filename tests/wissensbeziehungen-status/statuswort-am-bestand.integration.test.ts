// ================================================================================================
// JOB 4353 · DER GEMESSENE LAUF — echtes Chromium in DE/EN/NL, echtes PostgreSQL, eigene Proben.
// ================================================================================================
//
// Er belegt die vier Abnahmekriterien des Auftrags an EINER Strecke (`strecke.ts`):
//
//   1. Eine geltende Beziehung zeigt ihr Wort, eine widerrufene ihres — je Sprachstation beide,
//      SICHTBAR gelesen (`checkVisibility`, `innerText`), an der Beziehung, über die gesprochen
//      wird. DE, EN und NL, jede in einem eigenen Browserprofil, mit drei VERSCHIEDENEN Wörtern.
//   2. Art, Richtung und Herkunft stehen daneben unverändert und werden je Station gegen den
//      Katalog DIESER Sprache gelesen.
//   3. Jedes Wort wird gegen `SELECT status FROM ko_kanten` derselben Datenbank gehalten — eigene
//      Verbindung, nicht über die Anwendung.
//   4. Der Lauf sagt selbst, ob er gelaufen ist, und ein Skip zählt NICHT als Grün.
//
// ================================================================================================
// EIN ÜBERSPRUNGENER PFLICHTFALL IST HIER ROT — UND DAS IST DIE KORREKTUR DER RUNDE 2.
// ================================================================================================
//
// BEN, Runde 1, Prüflücke 6, wörtlich: „`statuswort-am-bestand.integration.test.ts:62` und
// Zeugenfall ab Zeile 95 bleiben bei fehlender Umgebung erfolgreich. Testvorschlag: fehlende
// Voraussetzungen gezielt simulieren und sicherstellen, dass die Pflichtabnahme nicht erfolgreich
// endet."
//
// Genau das ist jetzt so: fehlen PostgreSQL oder Chromium, SCHEITERT der Pflichtfall unten mit
// ausgeschriebenem Grund (`pruefePflichtabnahme`), statt still grün zurückzukehren. Pedi wörtlich:
// „Erforderliche Fälle dürfen nicht durch Skip grün erscheinen."
//
// DAS IST ABSICHT UND KEIN VERSEHEN, auch wenn es `npm run test:integration` auf einer Maschine
// ohne Container-Laufzeit rot macht. Diese Datei trägt kein `*.test.ts` ohne `integration` im
// Namen und läuft deshalb NICHT im Tor (`vitest.config.ts`, `AUSSCHLUSS`); sie wird ausdrücklich
// gegen echte Infrastruktur gefahren. Ein Lauf ohne diese Infrastruktur hat die Abnahme nicht
// erbracht — und soll das auch sagen.
//
// Die Regel selbst wohnt in `pflichtabnahme.ts` und wird im TOR gegen jeden ihrer Ausfälle gefahren
// (`pflichtabnahme.test.ts`: fünfzehn simulierte Lücken plus der Erfolgsfall) — datenbankfrei,
// browserfrei. Stünde sie nur hier, fiele ihre Prüfung mit derselben Umgebung aus, gegen deren
// Fehlen sie schützt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { type Protokoll, pruefePflichtabnahme } from "./pflichtabnahme";
import { SPRACHEN, sollWort } from "./sollwoerter";
import {
  MARKE,
  SOLL,
  STATIONEN,
  type Umgebung,
  fahreStrecke,
  protokollzeile,
  richteUmgebungEin,
} from "./strecke";

describe("JOB 4353 · Das Statuswort an der Beziehung, gemessen gegen den Bestand", () => {
  let umgebung: Umgebung | undefined;
  let aufraeumen: (() => Promise<void>) | undefined;
  let zustand: Laufzustand | undefined;
  let protokoll: Protokoll | undefined;

  beforeAll(async () => {
    const eingerichtet = await richteUmgebungEin();
    zustand = eingerichtet.zustand;
    umgebung = eingerichtet.umgebung;
    aufraeumen = eingerichtet.aufraeumen;
    if (!zaehltAlsBestanden(zustand)) {
      process.stderr.write(befundsatz(`${MARKE} STRECKE`, zustand));
    }
  }, 900_000);

  afterAll(async () => {
    await aufraeumen?.();
    process.stderr.write(befundsatz(`${MARKE} STRECKE`, zustand));
    if (protokoll) {
      process.stderr.write(`${protokollzeile(protokoll)}\n`);
    }
  }, 300_000);

  it("EINE Strecke: DE, EN und NL zeigen das Wort der geltenden und der widerrufenen Beziehung, jedes gegen die Datenbank geprüft", async () => {
    if (umgebung) {
      protokoll = await fahreStrecke(umgebung, {
        kennung: `gruen${`${Date.now()}`.slice(-8)}`,
      });
    } else {
      process.stderr.write(befundsatz(`${MARKE} STRECKE`, zustand));
    }

    // DIE EINE ENTSCHEIDUNG, fail-closed und ausgeschrieben. Fehlt die Umgebung, ist `belegt`
    // falsch und dieser Fall ROT — mit dem Grund in der Meldung.
    const abnahme = pruefePflichtabnahme(zustand, protokoll, SPRACHEN);
    expect(abnahme.belegt, abnahme.grund).toBe(true);

    // AB HIER IST EIN PROTOKOLL GARANTIERT. Die Werte der Rückgabe stammen aus DIESEM Lauf; jeder
    // Sollwert kommt aus der gemeinsamen Tabelle bzw. aus der festen Liste `BEZIEHUNGEN`.
    const p = protokoll as Protokoll;
    expect(
      p.sprachen.map((s) => s.sprache),
      "die drei Sprachstationen in ihrer Reihenfolge",
    ).toEqual([...SPRACHEN]);

    for (const station of STATIONEN) {
      const b = p.sprachen.find((s) => s.sprache === station.sprache);
      expect(b, `für ${station.sprache} fehlt der Befund`).toBeDefined();
      expect(b?.kurz, `${station.sprache}: die gemessene Beziehung`).toBe(station.kurz);
      expect(b?.pgVorher, `${station.sprache}: der Bestand vor dem Widerruf`).toBe("aktiv");
      expect(b?.pgNachher, `${station.sprache}: der Bestand nach dem Widerruf`).toBe("widerrufen");
      expect(b?.wortListe, `${station.sprache}: das Wort an der geltenden Beziehung`).toBe(
        sollWort(station.sprache, "aktiv"),
      );
      expect(b?.wortAntwort, `${station.sprache}: das Wort an der widerrufenen Beziehung`).toBe(
        sollWort(station.sprache, "widerrufen"),
      );
      expect(b?.kachelnVorher, `${station.sprache}: Kacheln vor dem Widerruf`).toBe(
        station.kachelnVorher,
      );
      expect(b?.kachelnNachher, `${station.sprache}: Kacheln nach dem Widerruf`).toBe(
        station.kachelnNachher,
      );
      expect(
        (b?.satz ?? "").length,
        `${station.sprache}: der Richtungssatz wurde gelesen (Kriterium 2)`,
      ).toBeGreaterThan(0);
      expect(
        (b?.herkunft ?? "").length,
        `${station.sprache}: das Herkunftsetikett wurde gelesen (Kriterium 2)`,
      ).toBeGreaterThan(0);
    }

    // Die Kachelzahl läuft über die Stationen hinweg bis auf null — hergeleitet aus `BEZIEHUNGEN`.
    expect(p.sprachen[0]?.kachelnVorher, "am Anfang stehen alle Beziehungen des Eintrags").toBe(
      SOLL.kachelnAmAnfang,
    );
    expect(
      p.sprachen[p.sprachen.length - 1]?.kachelnNachher,
      "nach der letzten Station ist keine gesetzte Beziehung mehr aktiv",
    ).toBe(0);
  }, 3_600_000);

  // ----------------------------------------------------------------------------------------------
  // DER ZEUGENFALL — er LAEUFT IMMER und sagt, was dieser Lauf belegt (und was nicht)
  // ----------------------------------------------------------------------------------------------
  it("Zeuge: dieser Lauf sagt selbst, ob er gelaufen ist — ein Skip ist kein Grün", () => {
    process.stderr.write(befundsatz(`${MARKE} ZEUGE`, zustand));
    const abnahme = pruefePflichtabnahme(zustand, protokoll, SPRACHEN);
    if (!zaehltAlsBestanden(zustand)) {
      // Der Zeuge selbst bleibt grün — er ist die AUSKUNFT, nicht die Abnahme. Dass die Abnahme
      // fehlt, sagt der Pflichtfall oben mit Rot; hier wird nur festgehalten, dass beide dasselbe
      // sagen und nichts stillschweigend als belegt gilt.
      expect(protokoll, "ohne Voraussetzungen darf kein Protokoll entstanden sein").toBeUndefined();
      expect(abnahme.belegt, "und die Abnahme darf dann NICHT als belegt gelten").toBe(false);
      return;
    }
    expect(
      protokoll,
      "die Voraussetzungen lagen vor — dann MUSS die Strecke gefahren sein",
    ).toBeDefined();
    expect(abnahme.belegt, abnahme.grund).toBe(true);
    expect(protokoll?.chromium, "die Chromium-Fassung fehlt im Protokoll").not.toBe("");
    expect(protokoll?.pgFassung, "die PostgreSQL-Fassung fehlt im Protokoll").not.toBe("");
    expect(protokoll?.datenbank, "der Name der Wegwerfdatenbank muss test enthalten").toContain(
      "test",
    );
    expect(protokoll?.sprachen.length, "drei Sprachen im echten Browser").toBe(SPRACHEN.length);
  });
});
