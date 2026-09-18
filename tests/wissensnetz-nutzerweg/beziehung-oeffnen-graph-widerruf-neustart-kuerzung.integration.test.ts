// ================================================================================================
// JOB 4328 · EINE STRECKE: LINK, MENUE, GRAPH, WIDERRUF, SIGTERM, KUERZUNG — IM ECHTEN CHROMIUM.
// ================================================================================================
//
// DIE DREI RESTE, DIE HIER ZUSAMMENLAUFEN, stehen wörtlich in den Urteilen:
//
//   1. `archiv/4155/runde-3/ben.md:25` — „Die neue Kürzungsauskunft ist SERVERINTERN/API-seitig."
//      Station (f) widerlegt diesen Satz: die Zahlen stehen im GERENDERTEN Text der Fläche.
//   2. `archiv/4155/runde-3/ben.md:31` — „G7 muss ab Browsertest:219 das Beziehungsziel
//      tatsächlich öffnen und Inhalte vergleichen." Station (b) KLICKT den Link, Station (c) den
//      Knoten; der bestehende Smoke fuhr `goto` auf beide Seiten und folgte keinem Link.
//   3. `archiv/4153/runde-5/ben.md:21` — „Echte App-Abnahme bleibt offen" für Art/Richtung im
//      Graphen. Station (c) liest die Kante SICHTBAR und ihre Art/Richtung/Herkunft als
//      METADATENBEFUND — mehr gibt diese Bauform nicht her, und mehr wird nicht behauptet.
//
// WAS DIESE DATEI AUSDRUECKLICH NICHT TUT: sie wiederholt nichts von JOB 4305 (Feldliste der
// Eintragsansicht, Netzmetrik-Zahlen, Rechteentzug, Restore) und nichts von JOB 4275. Ihr Ablauf
// steht in `strecke.ts` und wird von der Kalibrierung mit denselben Zeilen verstellt gefahren —
// nicht mit einer zweiten Beschreibung derselben Anlage.
//
// PRUEFGRENZE, SICHTBAR UND NIEMALS STILL: ohne PostgreSQL oder Chromium steht der Grund auf
// stderr (`befundsatz`), und der Zeugenfall unten LAEUFT IMMER und sagt, dass nichts belegt ist.
// Ein übersprungener Pflichtfall ist kein bestandener (`laufzustand.ts`).
//
// KEINE PRODUKTIVDATEN: jede angelegte Datenbank trägt `test` im Namen (durchgesetzt in `pgUrl`)
// und wird am Ende mit `DROP … WITH (FORCE)` entfernt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import {
  MARKE,
  type Protokoll,
  SOLL,
  type Umgebung,
  fahreStrecke,
  protokollzeile,
  richteUmgebungEin,
} from "./strecke";

describe("JOB 4328 · Beziehung öffnen, Graph, Widerruf, Prozessneustart, Kürzungsauskunft", () => {
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

  it("EINE Strecke: Link zur Gegenseite, Menüweg in Netz und Graph, Widerruf auf beiden Flächen, SIGTERM und neuer Prozess auf derselben Datenbank, sichtbare Kürzungsauskunft", async () => {
    if (!umgebung) {
      process.stderr.write(befundsatz(`${MARKE} STRECKE`, zustand));
      return;
    }
    protokoll = await fahreStrecke(umgebung, {
      stationen: ["b", "c", "d", "e", "f"],
      kennung: `gruen${`${Date.now()}`.slice(-8)}`,
    });
    // DIE ZAHLEN DER RUECKGABE, an einer Stelle und aus dem Protokoll DIESES Laufs — nicht aus
    // dem Auftragstext. Jede Sollzahl kommt aus `SOLL` und damit aus `BEZIEHUNGEN`.
    expect(
      protokoll.kachelnAlpha,
      "Kacheln an alpha: vorher → nach Widerruf → nach Neustart",
    ).toEqual([SOLL.alphaVorher, SOLL.alphaNachher, SOLL.alphaNachher]);
    expect(protokoll.kachelnGegenseite, "Kacheln an der Gegenseite des Links").toBe(
      SOLL.gegenseite,
    );
    expect(protokoll.kantenGraph, "Graphkanten: vorher → nach Widerruf → nach Neustart").toEqual([
      SOLL.graphVorher,
      SOLL.graphNachher,
      SOLL.graphNachher,
    ]);
    expect(protokoll.pgAktiv, "PostgreSQL aktiv: vorher → nach Widerruf → nach Neustart").toEqual([
      SOLL.graphVorher,
      SOLL.aktivNachher,
      SOLL.aktivNachher,
    ]);
    expect(protokoll.pgWiderrufen, "PostgreSQL widerrufen").toEqual([
      0,
      SOLL.widerrufenNachher,
      SOLL.widerrufenNachher,
    ]);
    expect(protokoll.pid2, "der zweite Prozess hat keine PID").toBeGreaterThan(0);
    expect(protokoll.pid2, "SIGTERM hat den Prozess nicht gewechselt").not.toBe(protokoll.pid1);
    expect(protokoll.port2, "der zweite Prozess horcht am selben Socket").not.toBe(protokoll.port1);
    expect(protokoll.metadaten, "Metadaten je gezeichneter Fachkante").toBe(SOLL.graphVorher);
    expect(protokoll.apiVorInsert, "API vor dem INSERT").toBe(
      `gesamt=${SOLL.graphNachher} gekuerzt=false geliefert=${SOLL.graphNachher}`,
    );
    expect(protokoll.apiNachInsert, "API nach dem INSERT").toBe(
      `gesamt=${SOLL.gesamtNachInsert} gekuerzt=true geliefert=${SOLL.geliefert}`,
    );
    expect(protokoll.hinweisText, "der gerenderte Kürzungssatz nennt die Lieferzahl").toContain(
      String(SOLL.geliefert),
    );
    expect(protokoll.hinweisText, "der gerenderte Kürzungssatz nennt die Gesamtzahl").toContain(
      String(SOLL.gesamtNachInsert),
    );
    expect(
      protokoll.gezeichnetBeiDeckel,
      "über dem Knotendeckel sind weniger Linien gezeichnet als geliefert",
    ).toBeLessThan(SOLL.geliefert);
    expect(protokoll.menuestationen.length, "die drei Menüstationen").toBe(3);
  }, 1_800_000);

  // ----------------------------------------------------------------------------------------------
  // DER ZEUGENFALL — er LAEUFT IMMER und sagt, was dieser Lauf belegt (und was nicht)
  // ----------------------------------------------------------------------------------------------
  it("Zeuge: dieser Lauf sagt selbst, ob er gelaufen ist — ein Skip ist kein Grün", () => {
    process.stderr.write(befundsatz(`${MARKE} ZEUGE`, zustand));
    if (!zaehltAlsBestanden(zustand)) {
      expect(protokoll, "ohne Voraussetzungen darf kein Protokoll entstanden sein").toBeUndefined();
      return;
    }
    expect(
      protokoll,
      "die Voraussetzungen lagen vor — dann MUSS die Strecke gefahren sein",
    ).toBeDefined();
    expect(protokoll?.chromium, "die Chromium-Fassung fehlt im Protokoll").not.toBe("");
    expect(protokoll?.pgFassung, "die PostgreSQL-Fassung fehlt im Protokoll").not.toBe("");
    expect(protokoll?.datenbank, "der Name der Wegwerfdatenbank muss test enthalten").toContain(
      "test",
    );
  });
});
