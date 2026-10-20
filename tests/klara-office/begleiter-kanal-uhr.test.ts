// ================================================================================================
// KLARA-OFFICE-02 · DER KONTEXTKANAL ÜBER DIE ZEIT — mit gestellter Uhr, ohne Server.
// ================================================================================================
//
// Was sich am echten Server nur mit Warten zeigen liesse, misst dieser Fall an `BegleiterKanal`
// selbst (dieselbe Klasse, die `build-app.ts` verdrahtet), mit einer Uhr, die der Test stellt:
//
//   U1  KO-02-05 · Ohne aktiven Adapter keine Auswahl: nach `BEGLEITER_AKTIV_MS` Stille liefert der
//       Kanal das Fenster als inaktiv und OHNE Auswahl — auch die zuletzt bekannte nicht. Ein
//       Auftrag an ein stilles Fenster wird abgewiesen.
//   U2  KO-02-07 · Wiederverbindung: nach `BEGLEITER_ABLAUF_MS` ist das Fenster vergessen (404); eine
//       neue Anmeldung derselben Kennung beginnt sauber von vorn.
//   U3  Aufträge, die Word nicht abholt, verfallen nach `BEGLEITER_AKTION_FRIST_MS`; an Word
//       übergebene verfallen nicht (Nacharbeit 60) — ihr Ende meldet nur Word.
//   U4  Grenzen: höchstens drei offene Aufträge je Fenster, höchstens acht Fenster je Konto (das
//       stillste weicht), Konten sind getrennt.
import { describe, expect, it } from "vitest";
import {
  BEGLEITER_ABLAUF_MS,
  BEGLEITER_ADAPTER_MAX,
  BEGLEITER_AKTION_FRIST_MS,
  BEGLEITER_AKTIV_MS,
  BEGLEITER_AUFTRAEGE_MERKEN_MAX,
  BEGLEITER_SCHLUESSEL_FRIST_MS,
  BEGLEITER_VERMERK_MINDESTENS_MS,
  BegleiterFehler,
  BegleiterKanal,
} from "../../services/app/src/klara-begleiter";

const KONTO = "u-erik";
const FREMD = "u-vera";

function kennung(n: number): string {
  return `bgl-${n.toString(16).padStart(32, "0")}`;
}

function neuerKanal() {
  const uhr = { jetzt: Date.parse("2026-10-10T08:00:00.000Z") };
  let zaehler = 0;
  const kanal = new BegleiterKanal(
    () => uhr.jetzt,
    () => {
      zaehler += 1;
      return `aktion-${zaehler}`;
    },
  );
  return { kanal, uhr };
}

function anmelden(kanal: BegleiterKanal, instanz: string, konto = KONTO): void {
  kanal.anmelden(konto, {
    instanz,
    host: "word-web",
    hostFassung: "16.0.18129.40500",
    dokument: { kennung: `url-${"c".repeat(32)}`, titel: "Protokoll.docx", gespeichert: true },
  });
}

function fehlerVon(f: () => unknown): BegleiterFehler {
  try {
    f();
  } catch (fehler) {
    if (fehler instanceof BegleiterFehler) {
      return fehler;
    }
    throw fehler;
  }
  throw new Error("kein Fehler geworfen");
}

describe("U1 · KO-02-05 — ohne aktiven Adapter keine aktuelle Auswahl", () => {
  it("wird still: inaktiv, ohne Auswahl, und ein Auftrag wird abgewiesen", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(1);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Fiktiver Satz.", laenge: 14, stand: 1 } });
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({ aktiv: true, auswahl: { stand: 1 } });

    uhr.jetzt += BEGLEITER_AKTIV_MS;
    expect(kanal.kontext(KONTO).adapter[0]?.aktiv).toBe(true);

    uhr.jetzt += 1;
    const still = kanal.kontext(KONTO).adapter[0];
    expect(still?.aktiv).toBe(false);
    expect(still?.auswahl).toBeNull();
    const f = fehlerVon(() =>
      kanal.beauftragen(KONTO, a, { art: "frage", text: "Was gilt?", auswahlStand: 1 }),
    );
    expect([f.status, f.grund]).toEqual([409, "adapter_inaktiv"]);

    // Meldet sich das Fenster wieder, ist es wieder aktiv — mit seiner AKTUELLEN Auswahl.
    kanal.melden(KONTO, a, { seq: 2, auswahl: { text: "Neuer Satz.", laenge: 11, stand: 2 } });
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({
      aktiv: true,
      auswahl: { text: "Neuer Satz.", stand: 2 },
    });
  });
});

describe("U2 · KO-02-07 — Wiederverbindung nach Abbruch", () => {
  it("vergisst ein Fenster nach der Frist; eine neue Anmeldung beginnt von vorn", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(2);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 7, auswahl: null, auswahlStand: 3 });

    uhr.jetzt += BEGLEITER_ABLAUF_MS + 1;
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
    const f = fehlerVon(() => kanal.melden(KONTO, a, { seq: 8, auswahl: null, auswahlStand: 3 }));
    expect([f.status, f.grund]).toEqual([404, "nicht_angemeldet"]);

    anmelden(kanal, a);
    // Von vorn: Folgenummer 1 und Auswahlstand 1 gelten wieder.
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Wieder da.", laenge: 10, stand: 1 } });
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({
      aktiv: true,
      auswahl: { text: "Wieder da." },
    });
  });
});

describe("U3 · nicht abgeholte Aufträge verfallen", () => {
  it("ein Auftrag, den Word nicht abholt, verfällt nach der Frist — bis dahin bleibt sein Fenster", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(3);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    kanal.beauftragen(KONTO, a, { art: "einfuegen", text: "Ergänzung", auswahlStand: 1 });
    // Das Fenster verstummt: mit noch offener Aktion bleibt es (inaktiv) samt Aktion sichtbar.
    uhr.jetzt += BEGLEITER_ABLAUF_MS + 1;
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({
      instanz: a,
      aktiv: false,
      aktionen: [{ stand: "offen" }],
    });
    // Nach der Frist ist die nie abgeholte Aktion verfallen (Word hat sie nie erhalten) — damit
    // läuft nichts mehr, und das stille Fenster ist vergessen.
    uhr.jetzt += BEGLEITER_AKTION_FRIST_MS;
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
  });

  // Nacharbeit 60 (Ben): eine ÜBERGEBENE Aktion endet nur mit Words Meldung — keine Frist ersetzt
  // diesen Beleg (bisher stand sie hier nach der Frist als „verfallen“ da, obwohl Word weiterlief).
  it("eine an Word übergebene Aktion verfällt NICHT: ohne Words Meldung bleibt sie laufend und stoppbar", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(3);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    const aktion = kanal.beauftragen(KONTO, a, {
      art: "einfuegen",
      text: "Ergänzung",
      auswahlStand: 1,
    });
    // Das Fenster meldet sich weiter (bleibt aktiv), meldet aber kein Ergebnis — Word hängt.
    const schritte = BEGLEITER_AKTION_FRIST_MS / 10_000 + 1;
    let seq = 2;
    for (let i = 0; i < schritte; i += 1) {
      uhr.jetzt += 10_000;
      const r = kanal.melden(KONTO, a, { seq: seq++, auswahl: null, auswahlStand: 2 });
      if (i === 0) {
        expect(r.aktionen).toHaveLength(1);
      }
    }
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen[0]?.stand).toBe("uebergeben");
    // Der Stopp wirkt weiter über Word: angefordert, weitergereicht, erst Words Bestätigung beendet.
    expect(kanal.stoppen(KONTO, a, aktion.id).abbruchAngefordert).toBe(true);
    const weiter = kanal.melden(KONTO, a, { seq: seq++, auswahl: null, auswahlStand: 2 });
    expect(weiter.abbrechen).toEqual([aktion.id]);
    kanal.melden(KONTO, a, {
      seq: seq++,
      auswahl: null,
      auswahlStand: 2,
      erledigt: [{ id: aktion.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen[0]?.stand).toBe("gestoppt");
  });
});

describe("U4 · Grenzen und Trennung der Konten", () => {
  it("höchstens drei offene Aufträge je Fenster", () => {
    const { kanal } = neuerKanal();
    const a = kennung(4);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    for (let i = 0; i < 3; i += 1) {
      kanal.beauftragen(KONTO, a, { art: "frage", text: `Frage ${i}`, auswahlStand: 1 });
    }
    const f = fehlerVon(() =>
      kanal.beauftragen(KONTO, a, { art: "frage", text: "Noch eine", auswahlStand: 1 }),
    );
    expect([f.status, f.grund]).toEqual([409, "zu_viele"]);
  });

  it("acht Fenster je Konto — beim neunten weicht das stillste; fremde Konten sind getrennt", () => {
    const { kanal, uhr } = neuerKanal();
    for (let i = 0; i < BEGLEITER_ADAPTER_MAX; i += 1) {
      anmelden(kanal, kennung(10 + i));
      uhr.jetzt += 100;
    }
    anmelden(kanal, kennung(99));
    const offen = kanal.kontext(KONTO).adapter.map((x) => x.instanz);
    expect(offen).toHaveLength(BEGLEITER_ADAPTER_MAX);
    expect(offen).not.toContain(kennung(10));
    expect(offen).toContain(kennung(99));

    anmelden(kanal, kennung(200), FREMD);
    expect(kanal.kontext(FREMD).adapter.map((x) => x.instanz)).toEqual([kennung(200)]);
    expect(kanal.kontext(KONTO).adapter.map((x) => x.instanz)).not.toContain(kennung(200));
  });
});

// Nacharbeit 60 (Ben): weder Verbindungsverlust noch ein neues Fenster entfernt eine laufende Aktion.
describe("U8 · UI-MIN-06/07/14 — laufende Aktionen überstehen Verlust und Verdrängung", () => {
  function fensterMitUebergebenerFrage(kanal: BegleiterKanal, instanz: string): string {
    anmelden(kanal, instanz);
    kanal.melden(KONTO, instanz, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    const aktion = kanal.beauftragen(KONTO, instanz, {
      art: "frage",
      text: "Fiktive Frage?",
      auswahlStand: 1,
    });
    const r = kanal.melden(KONTO, instanz, { seq: 2, auswahl: null, auswahlStand: 1 });
    expect(r.aktionen.map((x) => x.id)).toEqual([aktion.id]);
    return aktion.id;
  }

  it("stilles Fenster: Aktion bleibt (inaktiv) mit Stopp; Wiederanmeldung behält sie; Ende erst durch Word", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(7);
    const id = fensterMitUebergebenerFrage(kanal, a);
    // Verbindung verloren — weit über Ablauf- und Aktionsfrist hinaus.
    uhr.jetzt += BEGLEITER_ABLAUF_MS + BEGLEITER_AKTION_FRIST_MS + 1;
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({
      instanz: a,
      aktiv: false,
      aktionen: [{ id, stand: "uebergeben" }],
    });
    // Der Stopp wird angenommen und wartet auf das Fenster.
    expect(kanal.stoppen(KONTO, a, id).abbruchAngefordert).toBe(true);
    // Dasselbe Fenster meldet sich neu an: die Aktion und ihre Abbruchanforderung bleiben.
    anmelden(kanal, a);
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen).toMatchObject([
      { id, stand: "uebergeben", abbruchAngefordert: true },
    ]);
    const r = kanal.melden(KONTO, a, { seq: 1, auswahl: null, auswahlStand: 1 });
    expect(r.abbrechen).toEqual([id]);
    kanal.melden(KONTO, a, {
      seq: 2,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen).toMatchObject([{ id, stand: "gestoppt" }]);
    // Jetzt läuft nichts mehr: ein wieder stilles Fenster wird regulär vergessen.
    uhr.jetzt += BEGLEITER_ABLAUF_MS + 1;
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
  });

  it("neuntes Fenster verdrängt nur eines OHNE laufende Aktion; haben alle eine, wird es abgewiesen", () => {
    const { kanal, uhr } = neuerKanal();
    const ids = new Map<string, string>();
    for (let i = 0; i < BEGLEITER_ADAPTER_MAX; i += 1) {
      ids.set(kennung(10 + i), fensterMitUebergebenerFrage(kanal, kennung(10 + i)));
      uhr.jetzt += 100;
    }
    const f = fehlerVon(() => anmelden(kanal, kennung(99)));
    expect([f.status, f.grund]).toEqual([409, "zu_viele_fenster"]);
    expect(kanal.kontext(KONTO).adapter).toHaveLength(BEGLEITER_ADAPTER_MAX);

    // Im ältesten Fenster meldet Word das Ende — erst jetzt darf es weichen.
    const aeltestes = kennung(10);
    kanal.melden(KONTO, aeltestes, {
      seq: 3,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: ids.get(aeltestes), stand: "erledigt", ergebnis: "Fiktive Antwort." }],
    });
    anmelden(kanal, kennung(99));
    const danach = kanal.kontext(KONTO).adapter;
    expect(danach.map((x) => x.instanz)).toContain(kennung(99));
    expect(danach.map((x) => x.instanz)).not.toContain(aeltestes);
    // Alle übrigen laufenden Aktionen sind unverändert da — mit Stopp.
    for (const [instanz, id] of ids) {
      if (instanz === aeltestes) {
        continue;
      }
      const fenster = danach.find((x) => x.instanz === instanz);
      expect(fenster?.aktionen).toMatchObject([{ id, stand: "uebergeben" }]);
    }
  });
});

// Nacharbeit 61 (Ben): Abmelden ersetzt kein von Word gemeldetes Ende.
describe("U9 · UI-MIN-06/07/14 — Abmelden mit laufender Aktion", () => {
  it("nie abgeholt: beim Abmelden bestätigt ohne Wirkung beendet, das Fenster geht", () => {
    const { kanal } = neuerKanal();
    const a = kennung(8);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    kanal.beauftragen(KONTO, a, { art: "frage", text: "Fiktive Frage?", auswahlStand: 1 });
    expect(kanal.abmelden(KONTO, a)).toBe(true);
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
  });

  it("übergeben: Fenster bleibt abgemeldet samt Aktion und Stopp, nimmt nichts Neues an, Ende wird nachgemeldet", () => {
    const { kanal } = neuerKanal();
    const a = kennung(8);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    const aktion = kanal.beauftragen(KONTO, a, {
      art: "einfuegen",
      text: "Ergänzung",
      auswahlStand: 1,
    });
    // Ein zweiter, noch nicht abgeholter Auftrag kommt erst NACH der Übergabe hinzu.
    kanal.melden(KONTO, a, { seq: 2, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    const offen = kanal.beauftragen(KONTO, a, {
      art: "frage",
      text: "Fiktive Frage?",
      auswahlStand: 1,
    });

    expect(kanal.abmelden(KONTO, a)).toBe(true);
    const [fenster] = kanal.kontext(KONTO).adapter;
    expect(fenster).toMatchObject({ instanz: a, aktiv: false, auswahl: null });
    expect(fenster?.aktionen).toMatchObject([
      { id: aktion.id, stand: "uebergeben" },
      { id: offen.id, stand: "gestoppt", grund: "fenster_abgemeldet" },
    ]);
    // Keine neuen Aufträge an das abgemeldete Fenster; der Stopp der laufenden bleibt möglich.
    const f = fehlerVon(() =>
      kanal.beauftragen(KONTO, a, { art: "frage", text: "Neu?", auswahlStand: 1 }),
    );
    expect([f.status, f.grund]).toEqual([404, "nicht_angemeldet"]);
    expect(kanal.stoppen(KONTO, a, aktion.id).stand).toBe("uebergeben");

    // Nachmeldung ohne Auswahl: macht das Fenster nicht wieder aktiv und gibt nichts Neues heraus.
    const r = kanal.melden(KONTO, a, {
      seq: 3,
      auswahl: null,
      erledigt: [{ id: aktion.id, stand: "erledigt", grund: "abbruch_nach_dem_schreiben" }],
    });
    expect(r.aktionen).toEqual([]);
    // Words Ende ist gemeldet, nichts läuft mehr: erst jetzt ist das Fenster weg.
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
  });

  it("vom abgemeldeten Fenster selbst beendet: „gestoppt“ gilt auch ohne angeforderten Abbruch", () => {
    const { kanal } = neuerKanal();
    const a = kennung(8);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    const aktion = kanal.beauftragen(KONTO, a, {
      art: "frage",
      text: "Fiktive Frage?",
      auswahlStand: 1,
    });
    kanal.melden(KONTO, a, { seq: 2, auswahl: null, auswahlStand: 1 });
    // Gegenprobe: ein ANGEMELDETES Fenster kann ohne Anforderung kein „gestoppt“ behaupten.
    const abgewiesen = kanal.melden(KONTO, a, {
      seq: 3,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: aktion.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen[0]?.stand).toBe("uebergeben");
    // Nacharbeit 63: und quittiert es auch nicht — der Adapter muss den Endbeleg behalten.
    expect(abgewiesen.quittiert).toEqual([]);
    kanal.abmelden(KONTO, a);
    const angenommen = kanal.melden(KONTO, a, {
      seq: 4,
      auswahl: null,
      erledigt: [{ id: aktion.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(angenommen.quittiert).toEqual([aktion.id]);
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
  });
});

// produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14) — Stoppen hat genau die
// benannte Wirkung: eine offene Aktion erreicht Word nie; bei einer übergebenen wird der Abbruch an das
// ausführende Fenster weitergereicht und gilt erst mit dessen Bestätigung; ein Ergebnis zu einer
// gestoppten Aktion bleibt wirkungslos; fremde Konten stoppen nichts.
describe("U5 · UI-MIN-06/14 — Stoppen einer Word-Aktion", () => {
  it("offen → gestoppt, Word erhält sie nie; übergeben → Abbruch an Word, gestoppt erst nach Bestätigung", () => {
    const { kanal } = neuerKanal();
    const a = kennung(5);
    const b = kennung(6);
    anmelden(kanal, a);
    anmelden(kanal, b);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz A.", laenge: 7, stand: 1 } });
    kanal.melden(KONTO, b, { seq: 1, auswahl: { text: "Satz B.", laenge: 7, stand: 1 } });
    const inA = kanal.beauftragen(KONTO, a, { art: "frage", text: "Frage A", auswahlStand: 1 });
    const inB = kanal.beauftragen(KONTO, b, { art: "einfuegen", text: "Zusatz", auswahlStand: 1 });

    // Fremdes Konto: gleiche Antwort wie unbekannt, nichts geändert.
    const fremd = fehlerVon(() => kanal.stoppen(FREMD, a, inA.id));
    expect([fremd.status, fremd.grund]).toEqual([404, "nicht_angemeldet"]);
    const unbekannt = fehlerVon(() => kanal.stoppen(KONTO, a, "aktion-999"));
    expect([unbekannt.status, unbekannt.grund]).toEqual([404, "unbekannt"]);

    expect(kanal.stoppen(KONTO, a, inA.id).stand).toBe("gestoppt");
    expect(kanal.melden(KONTO, a, { seq: 2, auswahl: null, auswahlStand: 1 }).aktionen).toEqual([]);
    // Auch ein (gefälschtes) Ergebnis zur gestoppten Aktion ändert nichts.
    kanal.melden(KONTO, a, {
      seq: 3,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: inA.id, stand: "erledigt", ergebnis: "x" }],
    });
    expect(kanal.kontext(KONTO).adapter.find((x) => x.instanz === a)?.aktionen[0]).toMatchObject({
      stand: "gestoppt",
      ergebnis: null,
    });

    // Fenster B holt seine Aktion ab. Nacharbeit 7: ab jetzt wird der Stopp ANGEFORDERT und an das
    // ausführende Fenster weitergereicht — als gestoppt gilt sie erst, wenn Word das bestätigt.
    expect(
      kanal.melden(KONTO, b, { seq: 2, auswahl: null, auswahlStand: 1 }).aktionen,
    ).toHaveLength(1);
    const angefordert = kanal.stoppen(KONTO, b, inB.id);
    expect([angefordert.stand, angefordert.abbruchAngefordert]).toEqual(["uebergeben", true]);
    const sichtB = () => kanal.kontext(KONTO).adapter.find((x) => x.instanz === b)?.aktionen[0];
    expect(sichtB()).toMatchObject({ stand: "uebergeben", abbruchAngefordert: true });
    // Jede Meldung trägt den Abbruch, bis Word ein Ende meldet.
    const m3 = kanal.melden(KONTO, b, { seq: 3, auswahl: null, auswahlStand: 1 });
    expect([m3.aktionen, m3.abbrechen]).toEqual([[], [inB.id]]);
    // Word bestätigt den Abbruch: gestoppt, nicht mehr im Abbruchauftrag.
    const m4 = kanal.melden(KONTO, b, {
      seq: 4,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: inB.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(m4.abbrechen).toBeUndefined();
    expect(sichtB()).toMatchObject({ stand: "gestoppt", ergebnis: null });
  });

  it("ohne Anforderung gilt ein „gestoppt“ des Adapters nicht; war Word schon fertig, bleibt es erledigt", () => {
    const { kanal } = neuerKanal();
    const c = kennung(7);
    anmelden(kanal, c);
    kanal.melden(KONTO, c, { seq: 1, auswahl: { text: "Satz C.", laenge: 7, stand: 1 } });
    const eins = kanal.beauftragen(KONTO, c, { art: "frage", text: "Eins", auswahlStand: 1 });
    const zwei = kanal.beauftragen(KONTO, c, { art: "einfuegen", text: "Zwei", auswahlStand: 1 });
    kanal.melden(KONTO, c, { seq: 2, auswahl: null, auswahlStand: 1 });
    const sicht = (id: string) =>
      kanal.kontext(KONTO).adapter[0]?.aktionen.find((x) => x.id === id);

    // Unaufgefordert „gestoppt“: wirkungslos, die Aktion bleibt übergeben.
    kanal.melden(KONTO, c, {
      seq: 3,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: eins.id, stand: "gestoppt" }],
    });
    expect(sicht(eins.id)?.stand).toBe("uebergeben");

    // Abbruch angefordert, aber Word hatte schon eingefügt: ehrlich „erledigt“ — keine Rücknahme.
    expect(kanal.stoppen(KONTO, c, zwei.id).abbruchAngefordert).toBe(true);
    kanal.melden(KONTO, c, {
      seq: 4,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: zwei.id, stand: "erledigt" }],
    });
    expect(sicht(zwei.id)).toMatchObject({ stand: "erledigt", abbruchAngefordert: true });
    // Ein beendeter Auftrag bleibt beim Stoppen unverändert.
    expect(kanal.stoppen(KONTO, c, zwei.id).stand).toBe("erledigt");
  });
});

// Nacharbeit 54 (Ben, MAC5-02): eine laufende Aktion darf nicht durch jüngere, schon beendete
// Aktionen aus der Anzeige (früher die letzten fünf) oder aus dem Kanal (früher die letzten zehn)
// gedrängt werden — sonst verschwände ihr Stopp, während Word weiterarbeitet.
describe("U6 · UI-MIN-06/14 — laufende Aktionen bleiben, gekürzt wird nur der Verlauf", () => {
  it("A bleibt übergeben, zwölf jüngere werden erledigt: A steht weiter im Kontext und ist stoppbar", () => {
    const { kanal } = neuerKanal();
    const d = kennung(8);
    anmelden(kanal, d);
    kanal.melden(KONTO, d, { seq: 1, auswahl: { text: "Satz D.", laenge: 7, stand: 1 } });
    const a = kanal.beauftragen(KONTO, d, { art: "frage", text: "Lange Frage A", auswahlStand: 1 });
    let seq = 2;
    // Word holt A ab — A ist ab jetzt „uebergeben“ und läuft.
    const abgeholt = kanal.melden(KONTO, d, { seq: seq++, auswahl: null, auswahlStand: 1 });
    expect(abgeholt.aktionen.map((x) => x.id)).toEqual([a.id]);
    // Zwölf jüngere Aktionen, jede wird abgeholt und erledigt (höchstens zwei laufen gleichzeitig).
    const erledigt: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const x = kanal.beauftragen(KONTO, d, { art: "frage", text: `Kurz ${i}`, auswahlStand: 1 });
      kanal.melden(KONTO, d, { seq: seq++, auswahl: null, auswahlStand: 1 });
      kanal.melden(KONTO, d, {
        seq: seq++,
        auswahl: null,
        auswahlStand: 1,
        erledigt: [{ id: x.id, stand: "erledigt", ergebnis: `Antwort ${i}` }],
      });
      erledigt.push(x.id);
    }
    const sicht = kanal.kontext(KONTO).adapter[0]?.aktionen ?? [];
    // A ist da, mit Stand „uebergeben“ — und daneben genau die fünf jüngsten beendeten.
    expect(sicht.find((x) => x.id === a.id)?.stand).toBe("uebergeben");
    const beendet = sicht.filter((x) => x.stand === "erledigt").map((x) => x.id);
    expect(beendet).toEqual(erledigt.slice(-5));
    // Der Stopp wirkt weiterhin: angefordert, an Word weitergereicht, nach Bestätigung gestoppt.
    expect(kanal.stoppen(KONTO, d, a.id).abbruchAngefordert).toBe(true);
    const weiter = kanal.melden(KONTO, d, { seq: seq++, auswahl: null, auswahlStand: 1 });
    expect(weiter.abbrechen).toEqual([a.id]);
    kanal.melden(KONTO, d, {
      seq: seq++,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: a.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    // Nach Words Bestätigung ist A BEENDET (gestoppt). Als beendete Aktion fällt sie wie jeder
    // Verlaufseintrag hinter die fünf jüngsten zurück — ihr Ende bestätigt der Kanal selbst.
    expect(kanal.stoppen(KONTO, d, a.id).stand).toBe("gestoppt");
    const danach = kanal.kontext(KONTO).adapter[0]?.aktionen ?? [];
    expect(danach.some((x) => x.id === a.id && x.stand === "uebergeben")).toBe(false);
    // Die Obergrenze laufender Aufträge gilt unverändert.
    for (let i = 0; i < 3; i += 1) {
      kanal.beauftragen(KONTO, d, { art: "frage", text: `Offen ${i}`, auswahlStand: 1 });
    }
    const zuViele = fehlerVon(() =>
      kanal.beauftragen(KONTO, d, { art: "frage", text: "Eine zu viel", auswahlStand: 1 }),
    );
    expect([zuViele.status, zuViele.grund]).toEqual([409, "zu_viele"]);
  });
});

// Nacharbeit 58 (Ben, MACG57-POST-GET-01): ein Auftrag mit verlorener Antwort wird über SEINEN
// Schlüssel geklärt — nicht über einen jüngeren (leeren) Kontextabruf.
describe("U7 · UI-MIN-06/07/14 — auftragsbezogene Klärung über den Schlüssel", () => {
  const S1 = "s".repeat(32);
  const S2 = "t".repeat(32);

  function mitFenster() {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(1);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Fiktiver Satz.", laenge: 14, stand: 1 } });
    // Nacharbeit 59: der Ausstellungszeitpunkt ist die Serverzeit des gelesenen Kontexts;
    // Nacharbeit 64: dazu dessen Kanalinstanz.
    const gelesen = kanal.kontext(KONTO);
    const ausgestelltAm = gelesen.jetzt;
    const auftrag = (schluessel: string, text = "Was gilt?") => ({
      art: "frage",
      text,
      auswahlStand: 1,
      schluessel,
      ausgestelltAm,
      kanal: gelesen.kanal,
    });
    // Nacharbeit 63: die Klärung trägt den Ausstellungszeitpunkt des Auftrags (Vorgabe: der dieses
    // Fensters); `jetztIso` ist der eines jetzt neu ausgestellten Auftrags.
    const klaere = (konto: string, s: string, am = ausgestelltAm) =>
      kanal.klaeren(konto, s, { ausgestelltAm: am, kanal: gelesen.kanal, instanz: a });
    const jetztIso = () => new Date(uhr.jetzt).toISOString();
    return { kanal, uhr, a, auftrag, klaere, jetztIso };
  }

  it("Klärung VOR dem verspäteten POST sperrt den Schlüssel: der POST legt danach nichts an", () => {
    const { kanal, a, auftrag, klaere } = mitFenster();
    expect(klaere(KONTO, S1)).toEqual({ stand: "nicht_angelegt" });
    // Wiederholbar mit demselben Ergebnis.
    expect(klaere(KONTO, S1)).toEqual({ stand: "nicht_angelegt" });
    const f = fehlerVon(() => kanal.beauftragen(KONTO, a, auftrag(S1, "Spät")));
    expect([f.status, f.grund]).toEqual([409, "geklaert_nicht_angelegt"]);
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen).toEqual([]);
  });

  it("Klärung NACH der Annahme liefert genau diese Aktion; derselbe Schlüssel legt keine zweite an", () => {
    const { kanal, a, auftrag: zu, klaere } = mitFenster();
    const auftrag = zu(S1);
    const angelegt = kanal.beauftragen(KONTO, a, auftrag);
    const k = klaere(KONTO, S1);
    expect(k.stand).toBe("angenommen");
    expect(k.stand === "angenommen" ? [k.instanz, k.aktion.id] : null).toEqual([a, angelegt.id]);
    // Ein wiederholter POST mit demselben Schlüssel: dieselbe Aktion, keine zweite.
    expect(kanal.beauftragen(KONTO, a, auftrag).id).toBe(angelegt.id);
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen.map((x) => x.id)).toEqual([angelegt.id]);
  });

  it("Schlüssel sind kontogebunden; ein ungültiger Schlüssel sperrt nichts", () => {
    const { kanal, a, auftrag, klaere } = mitFenster();
    kanal.beauftragen(KONTO, a, auftrag(S2, "Eigen"));
    // Ein fremdes Konto erfährt nichts über den Schlüssel (und sperrt den eigenen nicht).
    expect(klaere(FREMD, S2)).toEqual({ stand: "nicht_angelegt" });
    expect(klaere(KONTO, S2).stand).toBe("angenommen");
    const f = fehlerVon(() => klaere(KONTO, "zu-kurz"));
    expect([f.status, f.grund]).toEqual([400, "ungueltig"]);
    // Nacharbeit 63: ohne Ausstellungszeitpunkt ist eine Klärung ungültig — und sperrt nichts.
    const ohne = fehlerVon(() => kanal.klaeren(KONTO, "u".repeat(32)));
    expect([ohne.status, ohne.grund]).toEqual([400, "ungueltig"]);
    expect(kanal.beauftragen(KONTO, a, auftrag("u".repeat(32))).stand).toBe("offen");
  });

  // Nacharbeit 59 (Ben): wartender POST, bestätigte Ablehnung, dann viele weitere Schlüssel.
  it("eine Sperre wird nie verdrängt: voll ⇒ Abweisung; erst nach Ablauf darf sie weichen", () => {
    const { kanal, uhr, a, auftrag, klaere, jetztIso } = mitFenster();
    // Der POST zu S1 „wartet“ (er ist noch nicht angekommen); die Klärung sperrt S1.
    const spaeterPost = auftrag(S1, "Spät");
    expect(klaere(KONTO, S1)).toEqual({ stand: "nicht_angelegt" });
    // Bis zur Obergrenze weitere Schlüssel klären.
    for (let i = 1; i < BEGLEITER_AUFTRAEGE_MERKEN_MAX; i += 1) {
      const s = `w${i.toString().padStart(31, "0")}`;
      expect(klaere(KONTO, s).stand).toBe("nicht_angelegt");
    }
    // Voll: ein weiterer Schlüssel wird ABGEWIESEN — weder die Klärung noch eine Beauftragung
    // verdrängt die Sperre von S1.
    const voll = fehlerVon(() => klaere(KONTO, "x".repeat(32)));
    expect([voll.status, voll.grund]).toEqual([409, "zu_viele_auftraege"]);
    const vollPost = fehlerVon(() => kanal.beauftragen(KONTO, a, auftrag("y".repeat(32))));
    expect([vollPost.status, vollPost.grund]).toEqual([409, "zu_viele_auftraege"]);
    // Der verspätete POST trifft weiter auf die Sperre.
    const gesperrt = fehlerVon(() => kanal.beauftragen(KONTO, a, spaeterPost));
    expect([gesperrt.status, gesperrt.grund]).toEqual([409, "geklaert_nicht_angelegt"]);

    // Erst wenn kein POST mit diesem Schlüssel mehr angenommen werden kann, darf die Sperre weichen.
    uhr.jetzt += BEGLEITER_VERMERK_MINDESTENS_MS + 1;
    // Das Fenster war so lange still, dass es sich neu anmeldet — aktiv, mit Markierung.
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Fiktiver Satz.", laenge: 14, stand: 1 } });
    expect(klaere(KONTO, "x".repeat(32), jetztIso()).stand).toBe("nicht_angelegt");
    // S1 ist nicht mehr vermerkt — der verspätete POST ist trotzdem abgewiesen (abgelaufen).
    const abgelaufen = fehlerVon(() => kanal.beauftragen(KONTO, a, spaeterPost));
    expect([abgelaufen.status, abgelaufen.grund]).toEqual([409, "schluessel_abgelaufen"]);
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen).toEqual([]);
  });

  it("Ausstellungszeitpunkt: fehlend oder in der Zukunft ungültig, älter als die Frist abgewiesen", () => {
    const { kanal, uhr, a, auftrag, klaere } = mitFenster();
    const ohne = { art: "frage", text: "Ohne", auswahlStand: 1, schluessel: S1 };
    expect(fehlerVon(() => kanal.beauftragen(KONTO, a, ohne)).status).toBe(400);
    const zukunft = { ...auftrag(S1), ausgestelltAm: new Date(uhr.jetzt + 1).toISOString() };
    expect(fehlerVon(() => kanal.beauftragen(KONTO, a, zukunft)).status).toBe(400);
    // Eine Millisekunde nach der Frist wird der Auftrag nicht mehr angenommen — auch bei aktivem
    // Fenster.
    const alt = auftrag(S2);
    uhr.jetzt += BEGLEITER_SCHLUESSEL_FRIST_MS + 1;
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Fiktiver Satz.", laenge: 14, stand: 1 } });
    const f = fehlerVon(() => kanal.beauftragen(KONTO, a, alt));
    expect([f.status, f.grund]).toEqual([409, "schluessel_abgelaufen"]);
    // Kein Vermerk, keine Aktion. Nacharbeit 63: für einen Auftrag älter als die Frist beweist ein
    // fehlender Vermerk kein „nicht angelegt“ mehr — die Klärung sagt ehrlich „unbekannt“
    // (angenommen werden kann er ohnehin nicht mehr, s. oben).
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen).toEqual([]);
    expect(klaere(KONTO, S2)).toEqual({ stand: "unbekannt" });
  });

  // Nacharbeit 62 (Ben, MACG60-VERMERK-LEBENSDAUER-01): die Zuordnung einer angenommenen Aktion lebt
  // so lange wie die Aktion, nicht nur so lange wie die Mindestaufbewahrung des Schlüssels.
  it("übergebene Aktion läuft über die Mindestaufbewahrung hinaus: klaeren bleibt „angenommen“", () => {
    const { kanal, uhr, a, auftrag, klaere, jetztIso } = mitFenster();
    const spaeterPost = auftrag(S1);
    const angelegt = kanal.beauftragen(KONTO, a, spaeterPost);
    // Word holt sie ab — sie ist übergeben und meldet kein Ende.
    const r = kanal.melden(KONTO, a, { seq: 2, auswahl: null, auswahlStand: 1 });
    expect(r.aktionen.map((x) => x.id)).toEqual([angelegt.id]);

    // Weit über die Mindestaufbewahrung hinaus; ein anderer (neuer) Schlüssel löst die Bereinigung
    // aus.
    uhr.jetzt += BEGLEITER_VERMERK_MINDESTENS_MS + 1;
    expect(klaere(KONTO, S2, jetztIso())).toEqual({ stand: "nicht_angelegt" });
    const k = klaere(KONTO, S1);
    expect(k.stand).toBe("angenommen");
    expect(k.stand === "angenommen" ? k.aktion.id : null).toBe(angelegt.id);
    // Derselbe Schlüssel legt weiter keine zweite Aktion an.
    expect(kanal.beauftragen(KONTO, a, spaeterPost).id).toBe(angelegt.id);

    // Word meldet das Ende (das stille Fenster meldet sich dafür neu an); erst danach darf die
    // Zuordnung bei der nächsten Bereinigung weichen — ein verspäteter POST startet trotzdem
    // nichts neu, denn sein Ausstellungszeitpunkt ist abgelaufen.
    anmelden(kanal, a);
    kanal.melden(KONTO, a, {
      seq: 1,
      auswahl: null,
      erledigt: [{ id: angelegt.id, stand: "erledigt", ergebnis: "Fiktive Antwort." }],
    });
    uhr.jetzt += BEGLEITER_VERMERK_MINDESTENS_MS + 1;
    // Nichts lief mehr: das stille Fenster ist regulär vergessen und meldet sich neu an.
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    expect(klaere(KONTO, "z".repeat(32), jetztIso())).toEqual({ stand: "nicht_angelegt" });
    const f = fehlerVon(() => kanal.beauftragen(KONTO, a, spaeterPost));
    expect([f.status, f.grund]).toEqual([409, "schluessel_abgelaufen"]);
    // Nacharbeit 63 (Ben, MACG62-VERMERK-ENDHISTORIE-01): die Annahmehistorie von S1 ist bereinigt
    // — die Klärung behauptet NICHT „nicht angelegt“ (er war angenommen), sondern „unbekannt“.
    expect(klaere(KONTO, S1)).toEqual({ stand: "unbekannt" });
    expect(
      kanal.kontext(KONTO).adapter[0]?.aktionen.filter((x) => x.stand === "uebergeben"),
    ).toEqual([]);
  });
});

// Nacharbeit 64 (Ben): ein Serverneustart (neue Kanalinstanz, Bestand verloren) belegt weder
// Nichtannahme noch Ende. Erst das Zielfenster klärt, indem es seinen laufenden Bestand meldet.
describe("U10 · UI-MIN-07/14 — Klärung und Vorgänge über einen Serverneustart", () => {
  const S1 = "n".repeat(32);
  const S2 = "m".repeat(32);
  const DOK = { kennung: `url-${"c".repeat(32)}`, titel: "Protokoll.docx", gespeichert: true };

  function zweiInstanzen() {
    const uhr = { jetzt: Date.parse("2026-10-10T08:00:00.000Z") };
    let zaehler = 0;
    const id = () => {
      zaehler += 1;
      return `aktion-${zaehler}`;
    };
    const vorher = new BegleiterKanal(() => uhr.jetzt, id, "kanal-vorher");
    const nachher = new BegleiterKanal(() => uhr.jetzt, id, "kanal-nachher");
    return { uhr, vorher, nachher };
  }

  function fensterMitAuftrag(kanal: BegleiterKanal, instanz: string, schluessel: string) {
    anmelden(kanal, instanz);
    kanal.melden(KONTO, instanz, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    const gelesen = kanal.kontext(KONTO);
    const auftrag = {
      art: "frage",
      text: "Fiktive Frage?",
      auswahlStand: 1,
      schluessel,
      ausgestelltAm: gelesen.jetzt,
      kanal: gelesen.kanal,
    };
    const aktion = kanal.beauftragen(KONTO, instanz, auftrag);
    // Word holt sie ab — der Schlüssel geht mit (für die Bestandsmeldung nach einem Neustart).
    const r = kanal.melden(KONTO, instanz, { seq: 2, auswahl: null, auswahlStand: 1 });
    expect(r.aktionen).toMatchObject([{ id: aktion.id, schluessel }]);
    return { aktion, auftrag };
  }

  function mitBestand(kanal: BegleiterKanal, instanz: string, laufend: unknown[]) {
    kanal.anmelden(KONTO, {
      instanz,
      host: "word-web",
      hostFassung: "16.0.18129.40500",
      dokument: DOK,
      laufend,
    });
  }

  it("vor der Bestandsmeldung „offen“ (kein „nicht angelegt“); übernommen mit Kennung und Stopp", () => {
    const { vorher, nachher } = zweiInstanzen();
    const a = kennung(21);
    const { aktion, auftrag } = fensterMitAuftrag(vorher, a, S1);
    expect(vorher.kontext(KONTO).kanal).toBe("kanal-vorher");
    const klaerung = { ausgestelltAm: auftrag.ausgestelltAm, kanal: auftrag.kanal, instanz: a };

    // Neustart: der neue Kanal kennt nichts. Ein junger Auftrag ist trotzdem NICHT „nicht angelegt“.
    expect(nachher.kontext(KONTO)).toMatchObject({ kanal: "kanal-nachher", adapter: [] });
    expect(nachher.klaeren(KONTO, S1, klaerung)).toEqual({ stand: "offen" });
    // Ein verspäteter POST aus der Zeit davor wird nie angenommen.
    const b = kennung(22);
    anmelden(nachher, b);
    nachher.melden(KONTO, b, { seq: 1, auswahl: { text: "S.", laenge: 2, stand: 1 } });
    const spaet = fehlerVon(() => nachher.beauftragen(KONTO, b, auftrag));
    expect([spaet.status, spaet.grund]).toEqual([409, "kanal_neu_gestartet"]);

    // Das Fenster meldet sich neu an und meldet, was es noch ausführt: übernommen, mit Stopp.
    mitBestand(nachher, a, [{ id: aktion.id, art: "frage", schluessel: S1 }]);
    const fenster = nachher.kontext(KONTO).adapter.find((x) => x.instanz === a);
    expect(fenster).toMatchObject({
      bestand: true,
      aktionen: [{ id: aktion.id, stand: "uebergeben" }],
    });
    const k = nachher.klaeren(KONTO, S1, klaerung);
    expect(k.stand === "angenommen" ? k.aktion.id : k.stand).toBe(aktion.id);
    expect(nachher.stoppen(KONTO, a, aktion.id).abbruchAngefordert).toBe(true);
    const r = nachher.melden(KONTO, a, { seq: 1, auswahl: null, auswahlStand: 1 });
    expect(r.abbrechen).toEqual([aktion.id]);
    // Words Ende wird angenommen und quittiert.
    const ende = nachher.melden(KONTO, a, {
      seq: 2,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: aktion.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(ende.quittiert).toEqual([aktion.id]);
  });

  it("Bestand ohne den Auftrag: „nicht_laufend“ — nichts läuft, die Annahme bleibt offen", () => {
    const { vorher, nachher } = zweiInstanzen();
    const a = kennung(23);
    const { auftrag } = fensterMitAuftrag(vorher, a, S2);
    const klaerung = { ausgestelltAm: auftrag.ausgestelltAm, kanal: auftrag.kanal, instanz: a };
    // Ohne Bestandsmeldung (Anmeldung ohne `laufend`) bleibt es offen.
    anmelden(nachher, a);
    expect(nachher.kontext(KONTO).adapter[0]?.bestand).toBe(false);
    expect(nachher.klaeren(KONTO, S2, klaerung)).toEqual({ stand: "offen" });
    // Mit vollständiger (leerer) Bestandsmeldung: dazu läuft nachweislich nichts.
    mitBestand(nachher, a, []);
    expect(nachher.klaeren(KONTO, S2, klaerung)).toEqual({ stand: "nicht_laufend" });
    // Innerhalb DERSELBEN Instanz gilt die bisherige Klärung unverändert (Bestandskontinuität).
    const gelesen = nachher.kontext(KONTO);
    const jetzt = { ausgestelltAm: gelesen.jetzt, kanal: gelesen.kanal, instanz: a };
    expect(nachher.klaeren(KONTO, "q".repeat(32), jetzt)).toEqual({ stand: "nicht_angelegt" });
  });

  // Nacharbeit 65 (Ben): ein schon angenommener Abbruch übersteht die Wiederaufnahme.
  it("Abbruch übersteht die Übernahme: „gestoppt“ wird übernommen und quittiert; ohne Abbruch abgewiesen", () => {
    const { vorher, nachher } = zweiInstanzen();
    const a = kennung(24);
    const b = kennung(25);
    const { aktion: mitAbbruch } = fensterMitAuftrag(vorher, a, S1);
    const { aktion: ohneAbbruch } = fensterMitAuftrag(vorher, b, S2);
    expect(vorher.stoppen(KONTO, a, mitAbbruch.id).abbruchAngefordert).toBe(true);

    // Neustart: beide Fenster melden ihren Bestand — a bricht seinen Auftrag bereits ab.
    mitBestand(nachher, a, [{ id: mitAbbruch.id, art: "frage", schluessel: S1, abbruch: true }]);
    mitBestand(nachher, b, [{ id: ohneAbbruch.id, art: "frage", schluessel: S2 }]);
    const sicht = (instanz: string) =>
      nachher.kontext(KONTO).adapter.find((x) => x.instanz === instanz)?.aktionen[0];
    expect(sicht(a)).toMatchObject({ id: mitAbbruch.id, abbruchAngefordert: true });
    const weiter = nachher.melden(KONTO, a, { seq: 1, auswahl: null, auswahlStand: 1 });
    expect(weiter.abbrechen).toEqual([mitAbbruch.id]);
    const angenommen = nachher.melden(KONTO, a, {
      seq: 2,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: mitAbbruch.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(angenommen.quittiert).toEqual([mitAbbruch.id]);
    expect(sicht(a)?.stand).toBe("gestoppt");

    // Gegenprobe: ohne angefordertem Abbruch bleibt „gestoppt“ abgewiesen und unquittiert.
    const abgewiesen = nachher.melden(KONTO, b, {
      seq: 1,
      auswahl: null,
      auswahlStand: 1,
      erledigt: [{ id: ohneAbbruch.id, stand: "gestoppt", grund: "abgebrochen" }],
    });
    expect(abgewiesen.quittiert).toEqual([]);
    expect(sicht(b)?.stand).toBe("uebergeben");
  });
});
