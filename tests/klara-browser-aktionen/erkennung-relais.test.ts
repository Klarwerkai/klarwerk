// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — ERKENNUNG UND BEFEHLSRELAIS OHNE SERVER.
// ================================================================================================
//
// Zwei Bausteine des Produktwegs, je für sich und dann zusammen mit dem Aktionskern:
//   · DIE ERKENNUNG (`services/app/src/klara-browser-auftrag-erkennung.ts`) macht aus dem Wortlaut
//     der Person Formular, Felder, Speichern und ein ausdrücklich genanntes Auslösen — nach festen
//     Satzformen und allein gegen das Seitenprofil.
//   · DAS RELAIS (`services/app/src/klara-browser-relais.ts`) übergibt jeden Seitenaufruf als
//     Befehl an die Erweiterung. Seine zwei Fristen tragen die Semantik des Adaptervertrags:
//     nicht abgeholt heisst belastbar nicht ausgeführt, abgeholt ohne Antwort heisst unbekannt.
//     Jede Antwort ist Seiteninhalt und wird streng geprüft.
// Die Seite ist hier ein kleiner Doppelgänger, der Befehle so beantwortet wie
// `extensions/klara-browser/aktion.js` (samt `tabId`, die der Worker ergänzt) und zählt, was wirkt.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserAusfuehrung,
  BrowserFaehigkeitsregister,
  type BrowserSchritt,
  BrowserVertragFehler,
  neuerBrowserAuftrag,
} from "../../services/app/src/klara-browser-aktion";
import {
  type BrowserErkennung,
  erkenneBrowserAuftrag,
} from "../../services/app/src/klara-browser-auftrag-erkennung";
import {
  type BrowserBefehl,
  BrowserBefehlsrelais,
  BrowserSeiteStumm,
} from "../../services/app/src/klara-browser-relais";
import {
  ANGREIFER,
  BETREFF,
  EMPFAENGER,
  INJEKTION,
  NACHRICHT,
  ORIGIN,
  PFAD,
  TESTSEITE,
  eingabe,
} from "./testseite";

const WERTE = [
  { label: "Betreff", wert: BETREFF },
  { label: "Empfänger", wert: EMPFAENGER },
  { label: "Nachricht", wert: NACHRICHT },
];

/** Der getippte Auftrag mit typografischen Anführungszeichen „…“ und einem frei wählbaren Schluss. */
const angebot = (schluss: string) =>
  `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“, Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}“${schluss}`;

const erkenne = (wortlaut: string): BrowserErkennung => erkenneBrowserAuftrag(wortlaut, TESTSEITE);

describe("BPA-03 · Erkennung des Auftrags aus dem Wortlaut", () => {
  it("E1 · getippt mit Anführungszeichen: Formular, genaue Werte, Speichern — kein Auslösen", () => {
    expect(erkenne(angebot(" und speichere ihn als Entwurf."))).toEqual({
      ok: true,
      formular: "Angebotsentwurf",
      felder: WERTE,
      speichern: true,
      ausloesen: null,
    });
  });

  it('E1 · die dokumentierte Satzform „…" (Anführung unten, gerades Schlusszeichen) liefert die Werte ohne Anführungszeichen', () => {
    // Wörtlich die Satzform aus dem Kopf von `klara-browser-auftrag-erkennung.ts`; das Paar
    // ["„", '"'] steht ausdrücklich in `ANFUEHRUNG`.
    const r = erkenne(
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}" und speichere ihn als Entwurf.`,
    );
    expect(r).toEqual({
      ok: true,
      formular: "Angebotsentwurf",
      felder: WERTE,
      speichern: true,
      ausloesen: null,
    });
  });

  it("E2 · gesprochen ohne Anführungszeichen und Doppelpunkt: die Beschriftungen selbst trennen die Werte", () => {
    const r = erkenne(
      `Angebotsentwurf Betreff ${BETREFF} Empfänger ${EMPFAENGER} Nachricht ${NACHRICHT} und speichere den Entwurf`,
    );
    // Ohne Anführungszeichen ist ein Schlusspunkt Satzzeichen, kein Teil des Werts (gesprochen lässt
    // er sich nicht anders sagen) — wer ihn im Wert will, setzt den Wert in Anführungszeichen (E1).
    expect(r).toEqual({
      ok: true,
      formular: "Angebotsentwurf",
      felder: [
        { label: "Betreff", wert: BETREFF },
        { label: "Empfänger", wert: EMPFAENGER },
        { label: "Nachricht", wert: NACHRICHT.replace(/\.$/u, "") },
      ],
      speichern: true,
      ausloesen: null,
    });
  });

  it("E3 · ein ausdrücklich mit allen Wörtern genannter Knopf wird das Auslösen — ohne Speichern", () => {
    for (const schluss of [" und klicke Endgültig senden.", " und dann endgültig senden."]) {
      const r = erkenne(angebot(schluss));
      expect(r, schluss).toEqual({
        ok: true,
        formular: "Angebotsentwurf",
        felder: WERTE,
        speichern: false,
        ausloesen: "Endgültig senden",
      });
    }
  });

  it('E3 · „sende ihn endgültig" nennt den Knopf nicht mit allen Wörtern („sende" ist nicht „senden"): der ganze Auftrag wird Übergabe, nie ein halber', () => {
    expect(erkenne(angebot(" und sende ihn endgültig."))).toEqual({
      ok: false,
      art: "gesperrt",
      was: '„sende"',
    });
  });

  it('E4 · ein Entwurfsauftrag mit „bestelle" oder „Bestellung auslösen" ist gesperrt', () => {
    expect(erkenne(angebot(" und speichere ihn als Entwurf, dann bestelle."))).toEqual({
      ok: false,
      art: "gesperrt",
      was: '„bestelle"',
    });
    expect(erkenne(angebot(" und klicke Bestellung auslösen."))).toEqual({
      ok: false,
      art: "gesperrt",
      was: '„Bestellung"',
    });
  });

  it('E5 · ein Sendewort ohne den vollen Knopfnamen („und schicke ihn ab") ist gesperrt', () => {
    const r = erkenne(angebot(" und schicke ihn ab."));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.art).toBe("gesperrt");
    // Auch gesprochen, wenn der Befehlsteil den letzten ungeklammerten Wert beendet.
    const gesprochen = erkenne(`Angebotsentwurf Betreff ${BETREFF} und schicke ihn ab`);
    expect(gesprochen).toEqual({ ok: false, art: "gesperrt", was: '„schicke"' });
  });

  it("E6 · ein Sendewort NUR im Wert in Anführungszeichen ist Inhalt, keine Handlung", () => {
    const nachricht = "Wir senden Ihnen das Angebot und bestellen gern die Teile.";
    const r = erkenne(
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“, Nachricht „${nachricht}“ und speichere ihn als Entwurf.`,
    );
    expect(r).toEqual({
      ok: true,
      formular: "Angebotsentwurf",
      felder: [
        { label: "Betreff", wert: BETREFF },
        { label: "Nachricht", wert: nachricht },
      ],
      speichern: true,
      ausloesen: null,
    });
  });

  it("E7 · eine Beschriftung zweimal ohne Anführungszeichen: Klärung statt Raten", () => {
    const r = erkenne(
      "Fülle den Angebotsentwurf aus: Betreff Angebot, Betreff Kühlanlage und speichere ihn.",
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.art).toBe("klaerung");
    expect(!r.ok && r.art === "klaerung" && r.text).toContain('„Betreff" steht mehrfach');
    // In Anführungszeichen zählt die Beschriftung nicht mit.
    const zitiert = erkenne(
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“, Nachricht „Bitte den Betreff beachten.“`,
    );
    expect(zitiert.ok).toBe(true);
  });

  it('E8 · fehlender Wert („Betreff:" direkt vor „Empfänger"): Klärung', () => {
    const r = erkenne(
      `Fülle den Angebotsentwurf aus: Betreff: Empfänger ${EMPFAENGER} und speichere ihn.`,
    );
    expect(r).toEqual({
      ok: false,
      art: "klaerung",
      text: 'Für „Betreff" fehlt der Wert. Nenne ihn direkt nach der Beschriftung.',
    });
  });

  it("E9 · kein Formular genannt und zwei beschreibbare im Profil: Klärung nennt beide", () => {
    const r = erkenne(`Betreff „${BETREFF}“ und speichere ihn.`);
    expect(r.ok).toBe(false);
    const text = !r.ok && r.art === "klaerung" ? r.text : "";
    expect(text).toContain('„Angebotsentwurf"');
    expect(text).toContain('„Rückmeldung"');
  });

  it('E10 · „Fülle die Rückmeldung aus" bindet das genannte Formular', () => {
    expect(erkenne("Fülle die Rückmeldung aus: Betreff „x“")).toEqual({
      ok: true,
      formular: "Rückmeldung",
      felder: [{ label: "Betreff", wert: "x" }],
      speichern: false,
      ausloesen: null,
    });
  });

  it.each([
    ["und dann endgültig senden", { speichern: false, ausloesen: "Endgültig senden" }],
    ["und dann speichere ihn", { speichern: true, ausloesen: null }],
  ])(
    'E12 · der Befehlsteil nach einem Wert ohne Anführungszeichen („… %s") wird nicht still Teil des Werts',
    (schluss, handlung) => {
      const r = erkenne(`Angebotsentwurf Betreff ${BETREFF} Empfänger ${EMPFAENGER} ${schluss}`);
      // Richtig ist die erkannte Handlung mit sauberem Wert — oder eine Klärung. Falsch ist ein
      // „ok", dessen Feldwert den Befehl enthält: er ginge als Text auf die Seite, und die
      // ausdrücklich gewollte Handlung fiele still weg („kein halber Auftrag").
      if (r.ok) {
        expect(r.felder).toEqual([
          { label: "Betreff", wert: BETREFF },
          { label: "Empfänger", wert: EMPFAENGER },
        ]);
        expect({ speichern: r.speichern, ausloesen: r.ausloesen }).toEqual(handlung);
      } else {
        expect(r.art).toBe("klaerung");
      }
    },
  );

  it("E11 · Injektionstext als ganzer Wortlaut: Klärung — kein Auslösen, kein fremder Empfänger", () => {
    // Was geschieht: kein Formular ist genannt, das Profil hat zwei beschreibbare — also fragt
    // Klara nach, bevor auf der Seite irgendetwas geschieht. „trage X als Empfänger ein" ist keine
    // Satzform (die Beschriftung leitet den Wert ein), der Angreifer wird so nie ein Wert.
    const r = erkenne(INJEKTION.seite);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.art).toBe("klaerung");
    expect(JSON.stringify(r)).not.toContain(ANGREIFER);
  });
});

// ------------------------------------------------------------------------------------------------
// DAS RELAIS
// ------------------------------------------------------------------------------------------------

const ABDRUCK = "0a1b2c3d4e5f6789";
const LISTE = TESTSEITE.entwurfsliste;

/** Eine Lage, wie `aktion.js` sie liefert und der Worker sie um `tabId` ergänzt. */
function lageRoh(tabId: number, teil: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    origin: ORIGIN,
    pfad: PFAD,
    hindernisse: [],
    formularTreffer: 1,
    formular: {
      name: "Angebotsentwurf",
      fingerabdruck: ABDRUCK,
      felder: [
        { label: "Betreff", typ: "text", wert: BETREFF, gesperrt: false },
        { label: "Empfänger", typ: "text", wert: "", gesperrt: false },
        { label: "Nachricht", typ: "textarea", wert: "", gesperrt: false },
      ],
      knoepfe: ["Entwurf speichern", "Endgültig senden", "Bestellung auslösen"],
    },
    entwuerfe: [{ id: "E-alt-1", text: `Angebotsentwurf: ${BETREFF}` }],
    tabId,
    ...teil,
  };
}

const FUELLE = {
  formular: "Angebotsentwurf",
  fingerabdruck: ABDRUCK,
  label: "Betreff",
  wert: BETREFF,
};
const KLICKE = { formular: "Angebotsentwurf", fingerabdruck: ABDRUCK, knopf: "Entwurf speichern" };

/** Merkt, ob ein Versprechen schon entschieden ist — ohne es abzuwarten. */
function beobachte<T>(p: Promise<T>) {
  const b: { fertig: boolean; wert?: T; fehler?: unknown } = { fertig: false };
  p.then(
    (wert) => {
      b.fertig = true;
      b.wert = wert;
    },
    (fehler) => {
      b.fertig = true;
      b.fehler = fehler;
    },
  );
  return b;
}

describe("BPA-03 · Befehlsrelais: Fristen und Antwortprüfung", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("R1 · nicht abgeholt innerhalb der Abholfrist: belastbar nicht ausgeführt", async () => {
    vi.useFakeTimers();
    const relais = new BrowserBefehlsrelais("test", { abholMs: 50, antwortMs: 80 });
    const b = beobachte(relais.fuelle(3, { ...FUELLE }));
    expect(relais.hatOffenes()).toBe(true);
    await vi.advanceTimersByTimeAsync(49);
    expect(b.fertig).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(b.wert).toEqual({ ok: false, grund: "nicht_ausgefuehrt" });
    expect(relais.hatOffenes()).toBe(false);
    expect(relais.abholen()).toBeNull();
  });

  it("R2 · abgeholt, aber ohne Antwort innerhalb der Antwortfrist: Zeitüberschreitung (Ausgang unbekannt)", async () => {
    vi.useFakeTimers();
    const relais = new BrowserBefehlsrelais("test", { abholMs: 50, antwortMs: 80 });
    const b = beobachte(relais.fuelle(3, { ...FUELLE }));
    await vi.advanceTimersByTimeAsync(40);
    const befehl = relais.abholen();
    expect(befehl).toMatchObject({ nr: 1, art: "fuelle", tabId: 3, args: FUELLE });
    // Die Abholfrist gilt ab dem Abholen nicht mehr: bei 60 ms ist nichts entschieden.
    await vi.advanceTimersByTimeAsync(20);
    expect(b.fertig).toBe(false);
    await vi.advanceTimersByTimeAsync(59);
    expect(b.fertig).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(b.wert).toEqual({ ok: false, grund: "zeitueberschreitung" });
    expect(relais.hatOffenes()).toBe(false);
  });

  it("R3 · eine Lage, die nicht abgeholt oder nicht beantwortet wird, wirft BrowserSeiteStumm", async () => {
    vi.useFakeTimers();
    const relais = new BrowserBefehlsrelais("test", { abholMs: 50, antwortMs: 80 });
    const liegen = beobachte(relais.lage(3, "Angebotsentwurf", LISTE));
    await vi.advanceTimersByTimeAsync(51);
    expect(liegen.fehler).toBeInstanceOf(BrowserSeiteStumm);
    expect((liegen.fehler as BrowserSeiteStumm).grund).toBe("nicht_ausgefuehrt");

    const stumm = beobachte(relais.lage(3, "Angebotsentwurf", LISTE));
    relais.abholen();
    await vi.advanceTimersByTimeAsync(81);
    expect(stumm.fehler).toBeInstanceOf(BrowserSeiteStumm);
    expect((stumm.fehler as BrowserSeiteStumm).grund).toBe("zeitueberschreitung");
  });

  it("R4 · eine gültige Lage in der Form des Seitenausführers wird zur SeitenLage", async () => {
    const relais = new BrowserBefehlsrelais("test", { abholMs: 500, antwortMs: 500 });
    const p = relais.lage(3, "Angebotsentwurf", LISTE);
    const befehl = relais.abholen();
    expect(befehl).toEqual({
      nr: 1,
      art: "lage",
      tabId: 3,
      args: { formular: "Angebotsentwurf", liste: LISTE },
      // Ohne Angabe im Profil binden nur Herkunft und Pfad.
      adresse: { parameter: [], anker: false },
      wiederholt: false,
    });
    expect(relais.antworte(1, lageRoh(3))).toBe(true);
    const lage = await p;
    expect(lage).toEqual(lageRoh(3));
    // „Tab nicht mehr da" ist eine eigene, gültige Antwort.
    const weg = relais.lage(3, "Angebotsentwurf", LISTE);
    relais.antworte((relais.abholen() as BrowserBefehl).nr, null);
    expect(await weg).toBeNull();
  });

  it.each([
    ["ein anderer Tab", lageRoh(4)],
    [
      "ein Fingerabdruck in falscher Form",
      lageRoh(3, {
        formular: { ...(lageRoh(3).formular as object), fingerabdruck: "ABCDEF0123456789" },
      }),
    ],
    [
      "ein zu langer Fingerabdruck",
      lageRoh(3, {
        formular: { ...(lageRoh(3).formular as object), fingerabdruck: `${ABDRUCK}0` },
      }),
    ],
    [
      "ein Feldwert über 4000 Zeichen",
      lageRoh(3, {
        formular: {
          ...(lageRoh(3).formular as object),
          felder: [
            { label: "Nachricht", typ: "textarea", wert: "x".repeat(4001), gesperrt: false },
          ],
        },
      }),
    ],
    ["ein unbekanntes Hindernis", lageRoh(3, { hindernisse: ["popup"] })],
    [
      "ein Entwurfstext über 500 Zeichen",
      lageRoh(3, { entwuerfe: [{ id: "E-1", text: "y".repeat(501) }] }),
    ],
    ["keine Form", "<html>"],
  ])(
    'R5 · eine Lage mit %s wird abgewiesen (BrowserSeiteStumm „verbindung")',
    async (_fall, roh) => {
      const relais = new BrowserBefehlsrelais("test", { abholMs: 500, antwortMs: 500 });
      const p = relais.lage(3, "Angebotsentwurf", LISTE);
      relais.antworte((relais.abholen() as BrowserBefehl).nr, roh);
      const fehler = await p.then(
        () => null,
        (f: unknown) => f,
      );
      expect(fehler).toBeInstanceOf(BrowserSeiteStumm);
      expect((fehler as BrowserSeiteStumm).grund).toBe("verbindung");
    },
  );

  it("R6 · eine Antwort mit veralteter Nummer wird verworfen; der offene Befehl bleibt stehen", async () => {
    const relais = new BrowserBefehlsrelais("test", { abholMs: 500, antwortMs: 500 });
    const p = relais.klicke(3, { ...KLICKE });
    // Vor dem Abholen zählt keine Antwort — die Erweiterung hat den Befehl nie gesehen.
    expect(relais.antworte(1, { ok: true, wert: null })).toBe(false);
    const befehl = relais.abholen() as BrowserBefehl;
    expect(relais.antworte(befehl.nr + 1, { ok: true, wert: null })).toBe(false);
    expect(relais.antworte(befehl.nr - 1, { ok: true, wert: null })).toBe(false);
    expect(relais.hatOffenes()).toBe(true);
    // Erneut abgeholt: derselbe Befehl, als WIEDERHOLT gekennzeichnet — eine Erweiterung ohne
    // gemerkte Antwort führt ihn nicht aus (Befund N2 der zweiten Prüfung).
    expect(befehl.wiederholt).toBe(false);
    expect(relais.abholen()).toEqual({ ...befehl, wiederholt: true });
    expect(relais.antworte(befehl.nr, { ok: true, wert: null })).toBe(true);
    expect(await p).toEqual({ ok: true, wert: null });
    // Ein zweites Mal dieselbe Nummer: schon beantwortet.
    expect(relais.antworte(befehl.nr, { ok: true, wert: null })).toBe(false);
  });

  it('R7 · {fehler: nicht_ausgefuehrt} zum Klick ist belastbar nicht ausgeführt; eine kaputte Antwort ist „verbindung"', async () => {
    const relais = new BrowserBefehlsrelais("test", { abholMs: 500, antwortMs: 500 });
    const klick = async (antwort: unknown) => {
      const p = relais.klicke(3, { ...KLICKE });
      relais.antworte((relais.abholen() as BrowserBefehl).nr, antwort);
      return p;
    };
    expect(await klick({ fehler: "nicht_ausgefuehrt" })).toEqual({
      ok: false,
      grund: "nicht_ausgefuehrt",
    });
    expect(await klick({ ok: false, grund: "knopf_fehlt" })).toEqual({
      ok: false,
      grund: "knopf_fehlt",
    });
    for (const kaputt of [
      { ok: true, wert: "geklickt" },
      { ok: false, grund: "erfunden" },
      { ok: true },
      "ok",
      null,
    ]) {
      expect(await klick(kaputt), JSON.stringify(kaputt)).toEqual({
        ok: false,
        grund: "verbindung",
      });
    }
    // Auch beim Füllen: ein Wert über 4000 Zeichen ist keine gültige Antwort.
    const p = relais.fuelle(3, { ...FUELLE });
    relais.antworte((relais.abholen() as BrowserBefehl).nr, {
      ok: true,
      wert: { wert: "x".repeat(4001) },
    });
    expect(await p).toEqual({ ok: false, grund: "verbindung" });
  });

  it("R8 · der Wert gesperrter Felder wird geleert, auch wenn die Antwort ihn mitschickt", async () => {
    const relais = new BrowserBefehlsrelais("test", { abholMs: 500, antwortMs: 500 });
    const p = relais.lage(3, "Angebotsentwurf", LISTE);
    const roh = lageRoh(3, {
      formular: {
        ...(lageRoh(3).formular as object),
        felder: [
          { label: "Betreff", typ: "text", wert: BETREFF, gesperrt: false },
          { label: "Kennwort", typ: "password", wert: "geheim-synthetisch-1", gesperrt: true },
        ],
      },
    });
    relais.antworte((relais.abholen() as BrowserBefehl).nr, roh);
    const lage = await p;
    expect(lage?.formular?.felder).toEqual([
      { label: "Betreff", typ: "text", wert: BETREFF, gesperrt: false },
      { label: "Kennwort", typ: "password", wert: "", gesperrt: true },
    ]);
    expect(JSON.stringify(lage)).not.toContain("geheim-synthetisch-1");
  });

  it("R9 · ein zweiter Befehl, solange einer offen ist, wird nicht gestellt", async () => {
    const relais = new BrowserBefehlsrelais("test", { abholMs: 500, antwortMs: 500 });
    const erster = relais.fuelle(3, { ...FUELLE });
    expect(await relais.klicke(3, { ...KLICKE })).toEqual({
      ok: false,
      grund: "nicht_ausgefuehrt",
    });
    expect((relais.abholen() as BrowserBefehl).art).toBe("fuelle");
    relais.antworte(1, { ok: true, wert: { wert: BETREFF } });
    expect(await erster).toEqual({ ok: true, wert: { wert: BETREFF } });
  });

  it("R10 · jeder Befehl trägt die Adressbindung des Seitenprofils; ein ungültiges Profil wird abgewiesen (N4)", async () => {
    const relais = new BrowserBefehlsrelais(
      "test",
      { abholMs: 500, antwortMs: 500 },
      { parameter: ["id"], anker: true },
    );
    const p = relais.klicke(3, { ...KLICKE });
    expect(relais.abholen()).toMatchObject({
      art: "klicke",
      adresse: { parameter: ["id"], anker: true },
      wiederholt: false,
    });
    relais.antworte(1, { ok: true, wert: null });
    await p;
    for (const adressbindung of [
      { parameter: ["id", "id"], anker: false },
      { parameter: ["a b"], anker: false },
      { parameter: Array.from({ length: 11 }, (_, i) => `p${i}`), anker: false },
    ]) {
      expect(() => new BrowserFaehigkeitsregister([{ ...TESTSEITE, adressbindung }])).toThrow(
        BrowserVertragFehler,
      );
    }
  });
});

// ------------------------------------------------------------------------------------------------
// AKTIONSKERN UND RELAIS ZUSAMMEN
// ------------------------------------------------------------------------------------------------

/** Die Seite als Doppelgänger mit der Semantik von `aktion.js` für den Angebotsentwurf. */
function doppelgaenger() {
  const felder = new Map([
    ["Betreff", ""],
    ["Empfänger", ""],
    ["Nachricht", ""],
  ]);
  const z = {
    entwuerfe: [{ id: "E-alt-1", text: `Angebotsentwurf: ${BETREFF}` }],
    naechste: 1,
    speicherungen: 0,
    eintragungen: 0,
    /** Die letzte WIRKENDE Handlung (Füllen, Klicken), etwa `fuelle:Nachricht`. */
    zuletzt: "",
  };
  const knoepfe = ["Entwurf speichern", "Endgültig senden", "Bestellung auslösen"];
  function fuehreAus(b: BrowserBefehl): unknown {
    const a = b.args as Record<string, unknown>;
    if (b.art === "lage") {
      return lageRoh(b.tabId, {
        formular: {
          name: "Angebotsentwurf",
          fingerabdruck: ABDRUCK,
          felder: [...felder].map(([label, wert]) => ({
            label,
            typ: "text",
            wert,
            gesperrt: false,
          })),
          knoepfe,
        },
        entwuerfe: a.liste ? z.entwuerfe.map((e) => ({ ...e })) : [],
      });
    }
    if (a.fingerabdruck !== ABDRUCK) return { ok: false, grund: "ziel_geaendert" };
    if (b.art === "fuelle") {
      const label = String(a.label);
      if (!felder.has(label)) return { ok: false, grund: "feld_fehlt" };
      felder.set(label, String(a.wert));
      z.eintragungen++;
      z.zuletzt = `fuelle:${label}`;
      return { ok: true, wert: { wert: felder.get(label) } };
    }
    if (b.art === "klicke" && a.knopf === "Entwurf speichern") {
      z.speicherungen++;
      z.entwuerfe.push({
        id: `E-${z.naechste++}`,
        text: `Angebotsentwurf: ${felder.get("Betreff")}`,
      });
      z.zuletzt = "klicke:Entwurf speichern";
      return { ok: true, wert: null };
    }
    return { ok: false, grund: "knopf_fehlt" };
  }
  return { felder, z, fuehreAus };
}

type Stille = "liegen_lassen" | "schweigen" | null;

/**
 * Die Erweiterung im Kleinen: holt jeden Befehl ab und beantwortet ihn aus dem Doppelgänger, bis
 * der Lauf endet. `stille` entscheidet VOR dem Abholen, ob ein Befehl liegen bleibt (nie gesehen)
 * oder abgeholt, aber nie beantwortet wird.
 */
async function mitSeite<T>(
  relais: BrowserBefehlsrelais,
  seite: ReturnType<typeof doppelgaenger>,
  lauf: Promise<T>,
  stille: () => Stille = () => null,
): Promise<T> {
  let fertig = false;
  const ende = lauf.finally(() => {
    fertig = true;
    relais.melde();
  });
  const gesehen = new Set<number>();
  while (!fertig) {
    if (relais.hatOffenes()) {
      const art = stille();
      if (art !== "liegen_lassen") {
        const b = relais.abholen();
        if (b && !gesehen.has(b.nr)) {
          gesehen.add(b.nr);
          if (art !== "schweigen") relais.antworte(b.nr, seite.fuehreAus(b));
        }
      }
    }
    await relais.warte(5);
  }
  return ende;
}

const stand = (schritte: readonly BrowserSchritt[], art: BrowserSchritt["art"]) =>
  schritte.find((s) => s.art === art)?.stand;

describe("BPA-03 · Aktionskern über das Relais", () => {
  it.each([
    ["nicht abgeholt", "liegen_lassen"],
    ["abgeholt, ohne Antwort", "schweigen"],
  ] as const)(
    "K7 · die Lage VOR dem Speichern kommt nicht zurück (%s): Speichern bleibt offen (nicht unklar), Klärung; Fortsetzen speichert genau einmal",
    async (_fall, modus) => {
      const register = new BrowserFaehigkeitsregister([TESTSEITE]);
      const anlage = neuerBrowserAuftrag(
        register,
        eingabe({ ziel: { ...eingabe().ziel, tabId: 3 } }),
      );
      if (!anlage.ok) throw new Error(JSON.stringify(anlage));
      const relais = new BrowserBefehlsrelais("Erweiterung test · aktion.js", {
        abholMs: 40,
        antwortMs: 40,
      });
      const lauf = new BrowserAusfuehrung(anlage.auftrag, {
        adapter: relais,
        register,
        rechte: async () => true,
        warte: async () => {},
      });
      const seite = doppelgaenger();
      // Nach dem letzten Eintrag kommt genau die Lage, die das Speichern vorbereitet.
      const erst = await mitSeite(relais, seite, lauf.ausfuehren(), () =>
        seite.z.zuletzt === "fuelle:Nachricht" ? modus : null,
      );
      expect(erst.stand).toBe("klaerung");
      expect(erst.klaerung).toContain("nicht geantwortet");
      expect(stand(erst.schritte, "speichern")).toBe("offen");
      expect(stand(erst.schritte, "nachlesen")).toBe("offen");
      expect(erst.schritte.filter((s) => s.art === "fuellen").map((s) => s.stand)).toEqual([
        "erfolgt",
        "erfolgt",
        "erfolgt",
      ]);
      expect(erst.erfolg).toBe(false);
      expect(seite.z.speicherungen).toBe(0);
      expect(seite.felder.get("Nachricht")).toBe(NACHRICHT);

      const zweit = await mitSeite(relais, seite, lauf.fortsetzen());
      expect(zweit.stand).toBe("fertig");
      expect(zweit.erfolg).toBe(true);
      expect(zweit.ergebnis).toEqual({
        entwurfId: "E-1",
        nachgelesen: true,
        zurueckgenommen: false,
      });
      expect(seite.z.speicherungen).toBe(1);
      // Erledigte Einträge werden nicht wiederholt.
      expect(seite.z.eintragungen).toBe(3);
      // Ein weiteres Fortsetzen nach dem Ende wirkt nicht mehr.
      await mitSeite(relais, seite, lauf.fortsetzen());
      expect(seite.z.speicherungen).toBe(1);
    },
  );
});
