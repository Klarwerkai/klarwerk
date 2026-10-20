// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — LERNEN UND WIEDERHOLEN (BPA-S06).
// ================================================================================================
//
// Synthetischer Fall nach BPA-S06: zwei vorgeführte Wochenberichte mit wechselnden Werten und
// Empfängern und einem fachlichen Sonderfall, der nur in einer Vorführung vorkommt. Dazu ein
// Kennwortfeld, ein Token in einem harmlos benannten Feld, ein ausgeschlossenes Feld und ein Klick
// nur mit Koordinaten.
//
// GRENZE DIESER PRÜFUNG (G13): die Hostereignisse sind nachgebildet, nicht von einem echten
// Chrome-/Word-Adapter gemeldet; „Lauf" heißt hier der geprüfte Plan, nicht eine Wirkung im Host,
// und das Ergebnis in `pruefeErgebnis` ist ein nachgebildeter Bericht. Das ist Simulation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Bindung,
  type HostEreignis,
  type LaufAnfrage,
  type LaufBestaetigung,
  type LaufRechte,
  type LernFreigabe,
  type LernSitzung,
  type Lernnotiz,
  type PersoenlicheFunktion,
  type Wirkung,
  type Ziel,
  aendere,
  aussenwirkung,
  beendeLernen,
  beginneLernen,
  bestaetige,
  brichLernenAb,
  darfStarten,
  entwerfeLernnotiz,
  lernAnzeige,
  loesche,
  naechsteVorfuehrung,
  nimmAuf,
  pausiere,
  pausiereLernen,
  planeLauf,
  pruefeErgebnis,
  pruefeVorWirkung,
  pruefeZeitplan,
  setzeFort,
  setzeLernenFort,
  ueberarbeite,
  vorschau,
} from "../../services/app/src/assistenz-lernen";

const KENNWORT = "Beispiel-Kennwort-1";
// Zur Laufzeit gebaut: kein echter Schlüssel, keine Zeichenkette für Geheimnisscanner.
const TOKEN = `Bearer ${"Zx9".repeat(12)}`;
const JWT_AEHNLICH = ["eyJ", "a".repeat(8), ".", "b".repeat(8), ".", "c".repeat(8)].join("");
/** Das bestätigte Zieldokument der Funktion (G04). Die Vorführung selbst meldet kein Objekt. */
const DOKUMENT = "dok-wochenbericht";
const LERNTEXT = "Verfolge, wie ich diesen Bericht erstelle. Übernimm es künftig jeden Montag.";

const BINDUNG: Bindung = {
  mandant: "mandant-test",
  nutzer: "person-a",
  sitzung: "sitzung-1",
  host: "word-mac",
  hostVersion: "16.90",
  anwendung: "Word",
  fenster: "Wochenbericht.docx",
  zeitpunkt: "2026-10-12T08:00:00+02:00",
};

const FREIGABE: LernFreigabe = {
  anwendungen: ["Word", "Finder"],
  ausgeschlosseneFelder: ["Personalnummer"],
  fensterbild: false,
  abbruchRegel: "rohdaten_verwerfen",
};

const Z = {
  vorlage: { rolle: "menuitem", name: "Vorlage Wochenbericht" },
  kennwort: { rolle: "textbox", name: "Kennwort" },
  zeitraum: { rolle: "textbox", name: "Zeitraum" },
  umsatz: { rolle: "textbox", name: "Umsatz" },
  region: { rolle: "combobox", name: "Region" },
  sonderfall: { rolle: "textbox", name: "Sonderfall" },
  hinweis: { rolle: "textbox", name: "Hinweis" },
  personal: { rolle: "textbox", name: "Personalnummer" },
  speichern: { rolle: "button", name: "Speichern" },
  an: { rolle: "textbox", name: "An" },
  senden: { rolle: "button", name: "Senden" },
} satisfies Record<string, Ziel>;

function ev(
  art: HostEreignis["art"],
  ziel: Ziel | undefined,
  wert?: string,
  extra: Partial<HostEreignis> = {},
): HostEreignis {
  return {
    anwendung: "Word",
    fenster: "Wochenbericht.docx",
    art,
    ...(ziel ? { ziel } : {}),
    ...(wert === undefined ? {} : { wert }),
    zeitpunkt: "2026-10-12T08:01:00+02:00",
    ...extra,
  };
}

interface Bericht {
  zeitraum: string;
  umsatz: string;
  an: string;
  sonderfall?: string;
}

function vorfuehrung(w: Bericht): HostEreignis[] {
  return [
    ev("oeffnen", Z.vorlage),
    ev("eingabe", Z.kennwort, KENNWORT, { feldTyp: "password" }),
    ev("eingabe", Z.zeitraum, w.zeitraum),
    ev("eingabe", Z.umsatz, w.umsatz),
    ev("auswahl", Z.region, "Nord"),
    ...(w.sonderfall ? [ev("eingabe", Z.sonderfall, w.sonderfall)] : []),
    ev("klick", undefined, undefined, { koordinaten: { x: 4123, y: 3071 } }),
    ev("eingabe", Z.hinweis, TOKEN),
    ev("eingabe", Z.personal, "PN-77881"),
    ev("speichern", Z.speichern),
    ev("eingabe", Z.an, w.an),
    ev("senden", Z.senden),
  ];
}

const BERICHT_1: Bericht = {
  zeitraum: "05.10.2026",
  umsatz: "12.400",
  an: "a.muster@example.org",
  sonderfall: "Lieferverzug",
};
const BERICHT_2: Bericht = {
  zeitraum: "12.10.2026",
  umsatz: "9.870",
  an: "b.beispiel@example.org",
};

function begonnen(text = LERNTEXT, bindung = BINDUNG): LernSitzung {
  const beginn = beginneLernen("lernen-1", text, bindung, FREIGABE);
  if (!beginn.ok) {
    throw new Error(beginn.text);
  }
  return beginn.sitzung;
}

function gelernt(): LernSitzung {
  let s = begonnen();
  for (const e of vorfuehrung(BERICHT_1)) {
    s = nimmAuf(s, e);
  }
  s = naechsteVorfuehrung(s);
  for (const e of vorfuehrung(BERICHT_2)) {
    s = nimmAuf(s, e);
  }
  return beendeLernen(s);
}

function notiz(): Lernnotiz {
  const n = entwerfeLernnotiz(gelernt());
  if ("fehler" in n) {
    throw new Error(n.fehler);
  }
  return n;
}

/** Die in der Vorschau korrigierte Notiz: geschützte und unklare Schritte entfernt. */
function korrigiert(): Lernnotiz {
  let n = notiz();
  // Absteigend entfernen, damit die Nummern der übrigen stimmen.
  for (const nr of [9, 8, 7, 2]) {
    n = aendere(n, { art: "schritt_entfernen", nr });
  }
  return aendere(n, { art: "name", wert: "Wochenbericht Vertrieb" });
}

const ZEITPLAN = {
  art: "woechentlich",
  wochentag: 1,
  uhrzeit: "08:00",
  ab: "2026-10-19",
  zeitzone: "Europe/Berlin",
  nachholen: "einmal_nachholen",
} as const;

function funktion(
  n: Lernnotiz,
  erlaubteWirkungen: Wirkung[],
  bisher?: PersoenlicheFunktion,
): PersoenlicheFunktion {
  const bestaetigung = { person: "person-a", am: "2026-10-12T09:00:00+02:00", erlaubteWirkungen };
  const ziel = { zeitplan: ZEITPLAN, objekt: DOKUMENT };
  const f = bestaetige("funktion-1", n, { ...bestaetigung, ...ziel }, bisher);
  if ("fehler" in f) {
    throw new Error(f.fehler);
  }
  return f;
}

function aktiv(): PersoenlicheFunktion {
  return funktion(korrigiert(), ["eingeben", "speichern", "senden"]);
}

/** Fassung 2: der Sonderfall-Haltepunkt ist entfernt. Schritte 1–7, Schritt 7 = Senden. */
function ohneSonderfall(erlaubteWirkungen: Wirkung[]): PersoenlicheFunktion {
  const entwurf = ueberarbeite(aktiv(), korrigiert().herkunft);
  const n = aendere(entwurf, { art: "schritt_entfernen", nr: 5 });
  return funktion(n, erlaubteWirkungen, aktiv());
}

const NUR_EINGEBEN: Wirkung[] = ["eingeben"];
const HOST_ZIELE: Ziel[] = [Z.vorlage, Z.zeitraum, Z.umsatz, Z.region, Z.speichern, Z.an, Z.senden];
const EINGABEN = { zeitraum: "19.10.2026", umsatz: "10.000", an: "team@example.org" };

const STAND = { kennung: DOKUMENT, fassung: "fassung-7" };
const HOST = { kennung: "word-mac", anwendung: "Word", hostVersion: "16.90", ziele: HOST_ZIELE };

function rechte(beobachten: boolean, schreiben: boolean, stand = STAND): LaufRechte {
  return { objekt: stand.kennung, fassung: stand.fassung, beobachten, schreiben };
}

function anfrage(f: PersoenlicheFunktion, mehr: Partial<LaufAnfrage> = {}): LaufAnfrage {
  return {
    lauf: "lauf-1",
    version: f.version,
    person: "person-a",
    mandant: "mandant-test",
    sitzung: "sitzung-2",
    eingaben: EINGABEN,
    host: HOST,
    objekt: STAND,
    rechte: rechte(true, true),
    bestaetigungen: [],
    ...mehr,
  };
}

/** Die Bestätigung, die die Person für genau die gezeigte Außenwirkung von Schritt 7 gibt. */
function bestaetigtFuer(f: PersoenlicheFunktion, a: LaufAnfrage): LaufBestaetigung {
  const w = aussenwirkung(f, a, 7);
  if (!w) {
    throw new Error("Schritt 7 wirkt nicht nach außen.");
  }
  return {
    funktion: w.funktion,
    lauf: w.lauf,
    version: w.version,
    nr: 7,
    wirkung: w.wirkung,
    abdruck: w.abdruck,
  };
}

function vorschauText(n: Lernnotiz | PersoenlicheFunktion): string {
  const zeilen = vorschau(n).abschnitte.flatMap((a) => a.zeilen);
  return zeilen.join("\n");
}

describe("BPA-06-AC01 · Lernauftrag grenzt ab, Lernmodus sichtbar, Pause sofort", () => {
  it("natürlicher Lernauftrag → Vorgang und Anwendung abgegrenzt, Pause steht vorn", () => {
    const s = begonnen();
    expect(s.auftrag).toMatchObject({
      vorgang: "Bericht",
      anwendung: "Word",
      fenster: "Wochenbericht.docx",
    });
    const anzeige = lernAnzeige(s);
    expect(anzeige.modus).toBe("Lernen");
    expect(anzeige.zustand).toContain("Lernt gerade: Bericht in Word");
    expect(anzeige.steuerung[0]).toBe("pause");
    expect(anzeige.mikrofon).toBe(false);
    const pausiert = lernAnzeige(pausiereLernen(s));
    expect(pausiert.zustand).toContain("pausiert");
    expect(pausiert.steuerung[0]).toBe("fortsetzen");
  });

  it("kein Lernauftrag, fremde Anwendung oder unklarer Vorgang → nichts beginnt", () => {
    const outlook = { ...BINDUNG, anwendung: "Outlook" };
    expect(beginneLernen("l", "Erstelle den Bericht.", BINDUNG, FREIGABE)).toMatchObject({
      ok: false,
      grund: "kein_lernauftrag",
    });
    expect(beginneLernen("l", LERNTEXT, outlook, FREIGABE)).toMatchObject({
      ok: false,
      grund: "anwendung_nicht_freigegeben",
    });
    expect(beginneLernen("l", "Verfolge, wie ich arbeite.", BINDUNG, FREIGABE)).toMatchObject({
      ok: false,
      grund: "vorgang_unklar",
    });
  });

  it("pausiert, anderes Fenster oder andere Anwendung → nichts aufgenommen", () => {
    let s = pausiereLernen(begonnen());
    s = nimmAuf(s, ev("eingabe", Z.umsatz, "1"));
    expect(s.aktuell).toHaveLength(0);
    s = setzeLernenFort(s);
    s = nimmAuf(s, { ...ev("eingabe", Z.umsatz, "2"), fenster: "Privat.docx" });
    s = nimmAuf(s, { ...ev("eingabe", Z.umsatz, "3"), anwendung: "Outlook" });
    expect(s.aktuell).toHaveLength(0);
    s = nimmAuf(s, ev("eingabe", Z.umsatz, "4"));
    expect(s.aktuell).toHaveLength(1);
  });

  it("Abbruch verwirft die Rohdaten nach der eingestellten Regel", () => {
    const vorher = gelernt().vorfuehrungen;
    const mitDaten = { ...begonnen(), vorfuehrungen: vorher, aktuell: vorher[0] ?? [] };
    expect(brichLernenAb(mitDaten)).toMatchObject({
      stand: "abgebrochen",
      vorfuehrungen: [],
      aktuell: [],
    });
    const regel = { ...FREIGABE, abbruchRegel: "abgeschlossene_behalten" as const };
    const behalten = brichLernenAb({ ...mitDaten, freigabe: regel });
    expect(behalten.vorfuehrungen).toHaveLength(2);
    expect(behalten.aktuell).toHaveLength(0);
  });
});

describe("BPA-06-AC02 · zwei Berichte → parametrisierte Vorschau", () => {
  it("wechselnde Werte und jeder Empfänger werden Eingaben ohne Beispielwert", () => {
    const d = notiz().definition;
    expect(d.parameter).toEqual([
      { name: "zeitraum", beschriftung: "Zeitraum", art: "datum" },
      { name: "umsatz", beschriftung: "Umsatz", art: "zahl" },
      { name: "an", beschriftung: "An", art: "empfaenger" },
    ]);
    const region = d.schritte.find((s) => s.ziel?.name === "Region");
    expect(region?.wert).toEqual({ konstante: "Nord" });
    const gespeichert = JSON.stringify(d);
    const beispiele = [BERICHT_1, BERICHT_2].flatMap((b) => [b.zeitraum, b.umsatz, b.an]);
    for (const beispiel of beispiele) {
      expect(gespeichert).not.toContain(beispiel);
    }
  });

  it("gleicher Empfänger in beiden Vorführungen wird trotzdem nicht fest übernommen", () => {
    let s = nimmAuf(begonnen(), ev("eingabe", Z.an, "gleich@example.org"));
    s = naechsteVorfuehrung(s);
    s = nimmAuf(s, ev("eingabe", Z.an, "gleich@example.org"));
    const n = entwerfeLernnotiz(beendeLernen(s));
    if ("fehler" in n) {
      throw new Error(n.fehler);
    }
    expect(n.definition.schritte[0]?.wert).toEqual({ parameter: "an" });
    expect(JSON.stringify(n)).not.toContain("gleich@example.org");
  });
});

describe("BPA-06-AC03 · Vorschau in einfacher Sprache, änderbar vor Aktivierung", () => {
  it("nennt Zweck, Eingaben, Schritte, Ergebnis, Rechte und Haltepunkte", () => {
    expect(vorschau(notiz()).abschnitte.map((a) => a.ueberschrift)).toEqual([
      "Stand",
      "Zweck",
      "Deine Eingaben bei jedem Lauf",
      "Schritte",
      "Ergebnis",
      "Rechte",
      "Hier entscheidest du selbst",
    ]);
    const alles = vorschauText(notiz());
    expect(alles).toContain("Lernnotiz — noch nicht bestätigt");
    expect(alles).toContain("An (Empfänger — wird nie aus der Vorführung übernommen)");
    expect(alles).toContain("„Umsatz“ ausfüllen mit deiner Eingabe „Umsatz“");
    expect(alles).toContain("Schreiben in Word — wird vor jedem Lauf neu geprüft.");
    expect(alles).toContain("Zuschauen allein genügt nicht.");
    expect(alles).toContain("Senden: nur mit deiner Bestätigung im jeweiligen Lauf.");
    expect(alles).toContain("Nicht in jeder Vorführung: „Sonderfall“");
  });

  it("Änderungen vor der Aktivierung wirken auf die Vorschau", () => {
    let n = korrigiert();
    n = aendere(n, { art: "beschriftung", parameter: "an", wert: "Verteiler" });
    n = aendere(n, { art: "als_eingabe", nr: 4, beschriftung: "Region" });
    n = aendere(n, { art: "zweck", wert: "Wöchentlichen Vertriebsbericht vorbereiten." });
    expect(n.definition.name).toBe("Wochenbericht Vertrieb");
    expect(n.definition.schritte.map((s) => s.ziel?.name ?? s.art)).toEqual([
      "Vorlage Wochenbericht",
      "Zeitraum",
      "Umsatz",
      "Region",
      "entscheidung",
      "Speichern",
      "An",
      "Senden",
    ]);
    const alles = vorschauText(n);
    expect(alles).toContain("Verteiler (Empfänger");
    expect(alles).toContain("Wöchentlichen Vertriebsbericht vorbereiten.");
    expect(alles).toContain("In „Region“ auswählen mit deiner Eingabe „Region“");
  });
});

describe("BPA-06-AC04 · Lernnotiz startet nichts; bestätigte Funktion ohne Einzelrückfrage", () => {
  it("Lernnotiz startet nicht; nur die Eigentümerin bestätigt, mit festgelegten Wirkungen", () => {
    expect(darfStarten(korrigiert())).toBe(false);
    const b = { person: "person-a", am: "x", erlaubteWirkungen: NUR_EINGEBEN, zeitplan: null };
    expect(bestaetige("f", korrigiert(), { ...b, person: "person-b" })).toHaveProperty("fehler");
    expect(bestaetige("f", korrigiert(), { ...b, erlaubteWirkungen: [] })).toHaveProperty("fehler");
    // Ohne bestätigtes Zielobjekt entsteht keine Funktion (G04).
    expect(bestaetige("f", korrigiert(), b)).toMatchObject({
      fehler: expect.stringContaining("Dokument oder Ordner"),
    });
    const f = aktiv();
    expect(darfStarten(f)).toBe(true);
    expect(f).toMatchObject({ stand: "aktiv", version: 1, eigentuemer: "person-a" });
    expect(f.bindung).toEqual({
      mandant: "mandant-test",
      host: "word-mac",
      anwendung: "Word",
      objekt: DOKUMENT,
    });
  });

  it("harmlose Schritte laufen ohne Bestätigung bis zum fachlichen Haltepunkt", () => {
    const plan = planeLauf(aktiv(), anfrage(aktiv()));
    expect(plan).toMatchObject({ stand: "haelt_an", haltBei: 5 });
    if (plan.stand === "abgelehnt") {
      return;
    }
    expect(plan.schritte).toHaveLength(5);
    expect(plan.schritte.slice(0, 4).every((s) => s.ausfuehrung === "automatisch")).toBe(true);
    expect(plan.schritte[1]).toMatchObject({ ziel: Z.zeitraum, wert: "19.10.2026" });
    expect(plan.schritte[4]?.grund).toContain("Sonderfall");
  });
});

describe("BPA-06-AC05 · Zeitplan für die vorhandene Zeitsteuerung, kein eigener Zeitgeber", () => {
  it("Zeitzone, Uhrzeit und Nachholregel werden geprüft", () => {
    const ab = { art: "ab_datum", start: "2026-10-26T08:00", zeitzone: "Europe/Berlin" } as const;
    expect(pruefeZeitplan(ZEITPLAN)).toBeUndefined();
    expect(pruefeZeitplan({ art: "sofort" })).toBeUndefined();
    expect(pruefeZeitplan(ab)).toBeUndefined();
    expect(pruefeZeitplan({ ...ZEITPLAN, zeitzone: "Mars/Olympus" })).toContain("Zeitzone");
    expect(pruefeZeitplan({ ...ZEITPLAN, uhrzeit: "8 Uhr" })).toContain("hh:mm");
    const falsch = { ...ZEITPLAN, zeitzone: "Mars/Olympus" };
    const b = { person: "person-a", am: "x", erlaubteWirkungen: NUR_EINGEBEN, objekt: DOKUMENT };
    expect(bestaetige("f", korrigiert(), { ...b, zeitplan: falsch })).toMatchObject({
      fehler: expect.stringContaining("Zeitzone"),
    });
    expect(aktiv().zeitplan).toEqual(ZEITPLAN);
  });

  it("das Modul enthält keinen Zeitgeber (Quelleninspektion)", () => {
    const pfad = new URL("../../services/app/src/assistenz-lernen.ts", import.meta.url);
    expect(readFileSync(pfad, "utf8")).not.toMatch(/setInterval|setTimeout|cron|schedule\(/);
  });
});

describe("BPA-06-AC06 · keine Zugangsdaten im Trace oder in Routineparametern", () => {
  it("Kennwort, Token, ausgeschlossenes Feld und Koordinaten fehlen in Trace und Funktion", () => {
    const s = gelernt();
    const abgelegt = [s, notiz(), aktiv()].map((x) => JSON.stringify(x));
    for (const gespeichert of abgelegt) {
      expect(gespeichert).not.toContain(KENNWORT);
      expect(gespeichert).not.toContain(TOKEN);
      expect(gespeichert).not.toContain("PN-77881");
      expect(gespeichert).not.toContain("4123");
      expect(gespeichert).not.toContain("koordinaten");
    }
    const erste = s.vorfuehrungen[0] ?? [];
    const ausgelassen = (name: string) => erste.find((t) => t.ziel?.name === name)?.ausgelassen;
    expect(ausgelassen("Kennwort")).toBe("zugangsdaten");
    expect(ausgelassen("Hinweis")).toBe("zugangsdaten");
    expect(ausgelassen("Personalnummer")).toBe("ausgeschlossen");
    expect(notiz().definition.parameter.map((p) => p.name)).not.toContain("kennwort");
  });

  it("Fensterbild kommt auch mit Bildfreigabe nicht in den Trace", () => {
    const bild = "data:image/png;base64,QklMRC1NSVQtS0VOTldPUlQ=";
    const freigabe = { ...FREIGABE, fensterbild: true };
    const b = beginneLernen("l", LERNTEXT, BINDUNG, freigabe);
    if (!b.ok) {
      throw new Error(b.text);
    }
    // Harmloses Ziel — das Bild zeigt aber das ganze Fenster samt geschützter Felder.
    const s = nimmAuf(b.sitzung, ev("eingabe", Z.umsatz, "10.000", { bild }));
    expect(s.aktuell[0]).toMatchObject({
      wert: "10.000",
      bildAusgelassen: "keine_gesicherte_schwaerzung",
    });
    expect(JSON.stringify(s)).not.toContain("QklMRC1NSVQtS0VOTldPUlQ");
    expect(lernAnzeige(s).fensterbild).toBe(false);
  });

  it("Zugangsdaten als Eingabe eines Laufs werden abgewiesen", () => {
    const f = aktiv();
    const plan = planeLauf(f, anfrage(f, { eingaben: { ...EINGABEN, umsatz: JWT_AEHNLICH } }));
    expect(plan).toMatchObject({ stand: "abgelehnt", grund: "zugangsdaten_als_eingabe" });
  });
});

describe("BPA-06-AC07 · geänderter Host oder Verzweigung → nachvollziehbarer Halt", () => {
  it("Klick ohne benanntes Ziel wird Entscheidungspunkt, nicht Koordinaten-Replay", () => {
    const schritte = notiz().definition.schritte;
    const unklar = schritte.find((s) => s.frage?.includes("ohne erkennbares Ziel"));
    expect(unklar?.art).toBe("entscheidung");
    expect(schritte.some((s) => s.art === "klick")).toBe(false);
  });

  it("Hostwechsel bei gleich benannten Zielen hält vor dem ersten Schritt", () => {
    const f = aktiv();
    const plan = planeLauf(f, anfrage(f, { host: { ...HOST, hostVersion: "16.91" } }));
    expect(plan).toMatchObject({ stand: "haelt_an", haltBei: 1 });
    if (plan.stand === "abgelehnt") {
      return;
    }
    expect(plan.schritte).toHaveLength(1);
    expect(plan.schritte[0]).toMatchObject({ ausfuehrung: "angehalten" });
    expect(plan.schritte[0]?.grund).toContain("16.90 → 16.91");
  });

  it("nach geprüfter neuer Hostfassung und neuer Bestätigung läuft die Funktion wieder", () => {
    const entwurf = ueberarbeite(aktiv(), korrigiert().herkunft);
    const neu = aendere(entwurf, { art: "hostfassung", wert: "16.91" });
    const f = funktion(neu, ["eingeben", "speichern", "senden"], aktiv());
    const plan = planeLauf(f, anfrage(f, { host: { ...HOST, hostVersion: "16.91" } }));
    expect(plan).toMatchObject({ stand: "haelt_an", haltBei: 5 });
  });

  it("umbenanntes Feld in derselben Hostfassung hält genau an diesem Schritt", () => {
    const f = aktiv();
    const umbenannt = { ...Z.umsatz, name: "Umsatz (netto)" };
    const ziele = HOST_ZIELE.map((z) => (z.name === "Umsatz" ? umbenannt : z));
    const plan = planeLauf(f, anfrage(f, { host: { ...HOST, ziele } }));
    expect(plan).toMatchObject({ stand: "haelt_an", haltBei: 3 });
    if (plan.stand === "abgelehnt") {
      return;
    }
    expect(plan.schritte).toHaveLength(3);
    expect(plan.schritte[2]?.grund).toContain("„Umsatz“ ist nicht da");
  });
});

describe("BPA-06-AC08 · Testbericht nur mit Schreibrecht; Beobachtung allein genügt nicht", () => {
  it("nur Beobachtung bzw. kein Schreibrecht → kein Lauf", () => {
    const f = aktiv();
    const nurSehen = anfrage(f, { rechte: rechte(true, false) });
    const nichts = anfrage(f, { rechte: rechte(false, false) });
    expect(planeLauf(f, nurSehen)).toMatchObject({ stand: "abgelehnt", grund: "nur_beobachtung" });
    expect(planeLauf(f, nichts)).toMatchObject({ stand: "abgelehnt", grund: "schreibrecht_fehlt" });
  });

  it("andere Person, andere Anwendung oder fehlende Eingabe → kein Lauf", () => {
    const f = aktiv();
    const excel = { ...HOST, anwendung: "Excel" };
    const leer = { ...EINGABEN, umsatz: "" };
    const grund = (mehr: Partial<LaufAnfrage>) => planeLauf(f, anfrage(f, mehr));
    expect(grund({ person: "person-b" })).toMatchObject({ grund: "fremde_person" });
    expect(grund({ host: excel })).toMatchObject({ grund: "andere_anwendung" });
    expect(grund({ eingaben: leer })).toMatchObject({ grund: "eingabe_fehlt" });
  });

  it("anderes Dokument mit gleichen Feldern, anderer Mandant oder Host → kein Lauf", () => {
    const f = aktiv();
    const grund = (mehr: Partial<LaufAnfrage>) => planeLauf(f, anfrage(f, mehr));
    const fremd = { kennung: "dok-privat", fassung: "fassung-1" };
    const fremdesDokument = { objekt: fremd, rechte: rechte(true, true, fremd) };
    expect(grund(fremdesDokument)).toMatchObject({ grund: "anderes_objekt" });
    expect(grund({ mandant: "mandant-b" })).toMatchObject({ grund: "anderer_mandant" });
    const chrome = { ...HOST, kennung: "chrome-mac" };
    expect(grund({ host: chrome })).toMatchObject({ grund: "anderer_host" });
  });

  it("Rechte für eine ältere Fassung gelten nicht für die aktuelle", () => {
    const f = aktiv();
    const alt = rechte(true, true, { kennung: DOKUMENT, fassung: "fassung-6" });
    expect(planeLauf(f, anfrage(f, { rechte: alt }))).toMatchObject({
      stand: "abgelehnt",
      grund: "rechte_nicht_aktuell",
    });
  });

  it("vor jeder Wirkung: fremde Änderung oder Rechteentzug stoppt, eigene Fassung nicht", () => {
    const f = aktiv();
    const plan = planeLauf(f, anfrage(f));
    const eigene = { kennung: DOKUMENT, fassung: "fassung-8" };
    expect(pruefeVorWirkung(plan, 2, { objekt: STAND, rechte: rechte(true, true) })).toBeNull();
    const nachEigenem = { objekt: eigene, rechte: rechte(true, true, eigene) };
    expect(pruefeVorWirkung(plan, 3, nachEigenem, ["fassung-8"])).toBeNull();
    expect(pruefeVorWirkung(plan, 3, nachEigenem)).toContain("von anderer Seite geändert");
    const entzogen = { objekt: STAND, rechte: rechte(true, false) };
    expect(pruefeVorWirkung(plan, 3, entzogen)).toContain("Schreibrecht");
    const gesperrt = pruefeVorWirkung(plan, 5, { objekt: STAND, rechte: rechte(true, true) });
    expect(gesperrt).toContain("nicht freigegeben");
  });

  it("erlaubter Testbericht (nachgebildet): Plan erstellt und Ergebnis geprüft", () => {
    let n = ueberarbeite(aktiv(), korrigiert().herkunft);
    // Sonderfall, Empfänger und Senden heraus: übrig bleibt der reine Bericht mit Speichern.
    for (const nr of [8, 7, 5]) {
      n = aendere(n, { art: "schritt_entfernen", nr });
    }
    const f = funktion(n, ["eingeben", "speichern"], aktiv());
    const eingaben = { zeitraum: "19.10.2026", umsatz: "10.000" };
    const plan = planeLauf(f, anfrage(f, { eingaben }));
    expect(plan.stand).toBe("vollstaendig");
    const felder = { Zeitraum: "19.10.2026", Umsatz: "10.000" };
    const passend = { kennung: "bericht-test-1", felder };
    const falsch = { kennung: "bericht-test-2", felder: { ...felder, Umsatz: "1" } };
    expect(pruefeErgebnis(plan, passend)).toEqual({ ok: true, abweichungen: [] });
    expect(pruefeErgebnis(plan, falsch).ok).toBe(false);
  });
});

describe("BPA-06-AC09 · Außenaktion nur mit passender Bestätigung; Pause und Löschen", () => {
  it("Senden hält ohne passende Bestätigung; die passende lässt den Lauf vollständig zu", () => {
    const f = ohneSonderfall(["eingeben", "speichern", "senden"]);
    expect(f.version).toBe(2);
    const a = anfrage(f);
    const mit = (b: LaufBestaetigung[]) => planeLauf(f, { ...a, bestaetigungen: b });
    const richtig = bestaetigtFuer(f, a);
    expect(mit([])).toMatchObject({ stand: "haelt_an", haltBei: 7 });
    expect(mit([{ ...richtig, version: 1 }])).toMatchObject({ stand: "haelt_an" });
    expect(mit([richtig])).toMatchObject({ stand: "vollstaendig" });
    // Die Person sieht vor der Bestätigung Ziel, Dokument und den ganzen Inhalt.
    expect(aussenwirkung(f, a, 7)).toMatchObject({
      ziel: "Senden",
      objekt: STAND,
      inhalt: { "2 Zeitraum": "19.10.2026", "3 Umsatz": "10.000", "6 An": "team@example.org" },
    });
  });

  it("frühere Bestätigung passt nicht für anderen Inhalt, Lauf, Funktion oder Fassung", () => {
    const f = ohneSonderfall(["eingeben", "speichern", "senden"]);
    const frueher = bestaetigtFuer(f, anfrage(f));
    // Gleiche Fassung, gleicher Schritt, gleicher Empfänger — aber geänderter Berichtsinhalt.
    const geaendert = anfrage(f, { eingaben: { ...EINGABEN, umsatz: "99.999" } });
    expect(planeLauf(f, { ...geaendert, bestaetigungen: [frueher] })).toMatchObject({
      stand: "haelt_an",
      haltBei: 7,
    });
    const naechsterLauf = anfrage(f, { lauf: "lauf-2", bestaetigungen: [frueher] });
    expect(planeLauf(f, naechsterLauf)).toMatchObject({ stand: "haelt_an", haltBei: 7 });
    const andereFunktion = { ...frueher, funktion: "funktion-2" };
    const fremd = anfrage(f, { bestaetigungen: [andereFunktion] });
    expect(planeLauf(f, fremd)).toMatchObject({ stand: "haelt_an", haltBei: 7 });
    const andereSeite = { ...STAND, fassung: "fassung-9" };
    const anderesDok = anfrage(f, { objekt: andereSeite, rechte: rechte(true, true, andereSeite) });
    expect(planeLauf(f, { ...anderesDok, bestaetigungen: [frueher] })).toMatchObject({
      stand: "haelt_an",
      haltBei: 7,
    });
  });

  it("nicht erlaubte Wirkung hält trotz Bestätigung", () => {
    const f = ohneSonderfall(["eingeben", "speichern"]);
    const a = anfrage(f);
    const plan = planeLauf(f, { ...a, bestaetigungen: [bestaetigtFuer(f, a)] });
    expect(plan).toMatchObject({ stand: "haelt_an", haltBei: 7 });
  });

  it("Pause verhindert Läufe; Löschen entfernt Schritte und Zeitplan, Ergebnisse bleiben", () => {
    const ergebnisse = ["ko-freigegeben-1", "bericht-test-1"];
    const f = { ...ohneSonderfall(["eingeben", "speichern", "senden"]), ergebnisse };
    const p = pausiere(f);
    expect(darfStarten(p)).toBe(false);
    expect(planeLauf(p, anfrage(p))).toMatchObject({ stand: "abgelehnt", grund: "pausiert" });
    expect(darfStarten(setzeFort(p))).toBe(true);
    const g = loesche(f);
    expect(darfStarten(g)).toBe(false);
    expect(planeLauf(g, anfrage(g))).toMatchObject({ stand: "abgelehnt", grund: "geloescht" });
    expect(g.zeitplan).toBeNull();
    expect(g.definition.schritte).toEqual([]);
    expect(g.fassungen.every((x) => x.definition.schritte.length === 0)).toBe(true);
    expect(g.ergebnisse).toEqual(ergebnisse);
  });

  it("Wiederaufnahme bindet die Fassung; Veraltetes wird nicht still bestätigt", () => {
    const f = ohneSonderfall(["eingeben", "speichern", "senden"]);
    const alt = planeLauf(f, anfrage(f, { version: 1 }));
    expect(alt).toMatchObject({ stand: "abgelehnt", grund: "fassung_geaendert" });
    const veraltet = ueberarbeite(aktiv(), korrigiert().herkunft);
    const b = { person: "person-a", am: "x", erlaubteWirkungen: NUR_EINGEBEN, zeitplan: null };
    expect(bestaetige("f", veraltet, b, f)).toHaveProperty("fehler");
  });
});
