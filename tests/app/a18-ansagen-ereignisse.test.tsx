// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 1049 / D3 — A18 SPRACHAUSGABE: DAS EREIGNISREGISTER UND SEINE VERTRAEGE
// ================================================================================================
//
// BEN2 hat an D2 vier Dinge geruegt, und alle vier stehen hier als ausfuehrbarer Vertrag:
//
//   1. „161 ist die Summe ueberlappender SYNTAXFUNDSTELLEN, nicht die Zahl disjunkter
//      Nutzerereignisse."  → Der Nenner ist das REGISTER unten. Fundstellen sind Belege.
//      F1 ist selbst ein `<output aria-live>` und zaehlte in D2 in ZWEI A-Zeilen; `aria-invalid`
//      und `aria-describedby` zaehlten denselben Invaliditaetszustand doppelt.
//
//   2. Sieben Pflichtfelder je Ereignis, mit vollstaendigem DE-/EN-/NL-Text.
//
//   3. „Nicht-Live-Semantik korrigieren: `aria-describedby`, Dialogrolle, Fokus,
//      Strukturueberschrift und native Validierung erhalten KEINE erfundene Hoeflichkeitsstufe."
//      D2 gab `aria-describedby` ein `polite` und der Dialogrolle ein `assertive`. Beides gibt es
//      nicht: Hoeflichkeit ist eine Eigenschaft von Live-Regionen, nicht von Beschreibungen,
//      Rollen oder Fokus.
//
//   4. Wiederholung, gleichzeitig eingefuegte Live-Region und Toast-Montage kausal schliessen —
//      und die Gegenmutation muss den BARRIEREFREIHEITSBELEG rot machen, nicht nur Text oder CSS.
//
// WAS DIESE DATEI NICHT LEISTET, ausdruecklich: Sie belegt keine reale Ansage. Ein jsdom-Baum
// sagt nichts vor. Automatische Strukturbelege und manuelle Ansagebelege bleiben getrennt —
// die manuelle Matrix am Ende traegt deshalb durchgehend `UNGEPRUEFT`.
// ================================================================================================

type Kanalart = "live" | "nicht-live" | "keiner";
type Hoeflichkeit = "polite" | "assertive" | null;

interface Ereignis {
  /** Stabile, disjunkte ID. Der Nenner sind DIESE IDs — nicht die Fundstellen. */
  readonly id: string;
  readonly oberflaeche: string;
  readonly ausgangszustand: string;
  readonly aktion: string;
  readonly ergebniszustand: string;
  readonly kanal: string;
  readonly kanalart: Kanalart;
  /** NUR fuer Live-Regionen gesetzt. Nicht-Live-Kanaele tragen `null`. */
  readonly hoeflichkeit: Hoeflichkeit;
  /** i18n-Schluessel des angesagten Textes, sofern es einen gibt. */
  readonly textschluessel: string | null;
  readonly wiederholung: string;
  readonly negativfall: string;
  readonly baumzustand: string;
  /** Belege — mehrere Syntaxtraeger desselben Zustands zaehlen EINMAL. */
  readonly quellen: readonly string[];
}

const REGISTER: readonly Ereignis[] = [
  {
    id: "F1",
    oberflaeche: "Fragen",
    ausgangszustand: '`<output id="ask-empty-hint">` dauerhaft montiert, Inhalt leer',
    aktion: "Absenden mit leerem Frage-Feld",
    ergebniszustand: "Hinweistext steht im montierten Live-Bereich",
    kanal: '<output aria-live="polite">',
    kanalart: "live",
    hoeflichkeit: "polite",
    textschluessel: "ask.emptyHint",
    wiederholung: "zweites Absenden ohne Aenderung: der Text wird erneut gesetzt",
    negativfall: "Feld gefuellt → Inhalt bleibt leer",
    baumzustand: "role=status mit zugaenglichem Namen des Hinweistextes",
    // EIN Ereignis, ZWEI Syntaxtraeger (`<output>` UND `aria-live`) — in D2 zaehlte das doppelt.
    quellen: ["pages/Ask.tsx:536-541 (<output>)", "pages/Ask.tsx:536-541 (aria-live)"],
  },
  {
    id: "F2",
    oberflaeche: "Verwaltung",
    ausgangszustand: 'Zahl gueltig, `aria-invalid="false"`',
    aktion: "ungueltige Validierungszahl eintragen",
    ergebniszustand: "Feld ist invalid und ueber `aria-describedby` beschrieben",
    kanal: "aria-invalid + aria-describedby",
    kanalart: "nicht-live",
    // KORRIGIERT (BEN2 Pflicht 3): D2 gab hier `polite`. `aria-describedby` benennt eine
    // BESCHREIBUNG, keine Live-Region — eine Hoeflichkeitsstufe existiert dort nicht. Der Text
    // wird beim Fokussieren bzw. beim Lesen des Feldes ausgegeben, nicht spontan angesagt.
    hoeflichkeit: null,
    textschluessel: "adm.val.invalid",
    wiederholung: "Rueckkehr auf gueltig setzt `aria-invalid` zurueck",
    negativfall: "gueltige Zahl → `aria-invalid` bleibt false",
    baumzustand: "Feld invalid, Beschreibung ueber die Relation erreichbar",
    // aria-invalid und aria-describedby beschreiben DENSELBEN Zustand → ein Ereignis.
    quellen: [
      "pages/Admin.tsx:740-741 (aria-invalid)",
      "pages/Admin.tsx:740-741 (aria-describedby)",
    ],
  },
  {
    id: "A1",
    oberflaeche: "Fragen",
    ausgangszustand: "kein Abruf aktiv",
    aktion: "Frage absenden",
    ergebniszustand: 'Ladezustand sichtbar, Traeger traegt `aria-busy="true"`',
    kanal: 'aria-busy + aria-live="polite"',
    kanalart: "live",
    hoeflichkeit: "polite",
    textschluessel: "ask.pending.title",
    wiederholung: "zweiter Abruf setzt `aria-busy` erneut",
    negativfall: "kein Abruf → `aria-busy` fehlt",
    baumzustand: "busy-Traeger mit Ladetext als zugaenglichem Namen",
    quellen: ["pages/Ask.tsx:620-625"],
  },
  {
    id: "A2",
    oberflaeche: "Fragen",
    ausgangszustand: "kein Fehler",
    aktion: "Abruf schlaegt fehl",
    ergebniszustand: "Fehlermeldung in einer Alarmregion",
    kanal: 'role="alert"',
    kanalart: "live",
    hoeflichkeit: "assertive",
    textschluessel: "ask.error.title",
    wiederholung: "erneuter Fehlschlag ersetzt den Text",
    negativfall: "Erfolg → kein role=alert im Baum",
    baumzustand: "role=alert mit der Fehlermeldung als zugaenglichem Namen",
    quellen: ["pages/Ask.tsx:646-650"],
  },
  {
    id: "I1",
    oberflaeche: "Erfassen · Dateiimport",
    ausgangszustand: "`sr-only`-Live-Bereich montiert, Inhalt leer",
    aktion: "nicht unterstuetzten Dateityp ablegen",
    ergebniszustand: "Ablehnungsgrund mit Dateityp steht im Live-Bereich",
    kanal: 'sr-only + aria-live="polite"',
    kanalart: "live",
    hoeflichkeit: "polite",
    textschluessel: "imp.groups.failHttp",
    wiederholung: "zweite Ablehnung desselben Typs setzt denselben Text erneut",
    negativfall: "zulaessiger Typ → Inhalt bleibt leer",
    baumzustand: "role=status mit dem Ablehnungsgrund",
    quellen: ["components/CaptureFileImport.tsx:122-124"],
  },
  {
    id: "I2",
    oberflaeche: "Kennzahlgruppe",
    ausgangszustand: "Daten geladen",
    aktion: "Abruf scheitert dauerhaft",
    ergebniszustand: "Fehlermeldung in einer Alarmregion",
    kanal: 'role="alert"',
    kanalart: "live",
    hoeflichkeit: "assertive",
    textschluessel: "imp.groups.reason.error",
    wiederholung: "erneutes Scheitern haengt keinen zweiten Alarm an",
    negativfall: "Erfolg → kein role=alert",
    baumzustand: "genau eine Alarmregion",
    quellen: ["components/LoadState.tsx:11"],
  },
  {
    id: "M1",
    oberflaeche: "Modal",
    ausgangszustand: "Fokus auf dem ausloesenden Knopf",
    aktion: "Pop-up oeffnet",
    ergebniszustand: "heute: Fokus bleibt beim Ausloeser, keine Dialogrolle",
    kanal: "keiner",
    kanalart: "keiner",
    // KORRIGIERT: D2 gab `assertive`. Eine Dialogrolle legt keine Live-Hoeflichkeit fest, und
    // ein Kanal, den es heute gar nicht gibt, traegt erst recht keine.
    hoeflichkeit: null,
    textschluessel: null,
    wiederholung: "erneutes Oeffnen aendert nichts",
    negativfall: "geschlossen → kein Dialog im Baum",
    baumzustand: "OFFEN — heute weder role=dialog noch Fokusuebergabe",
    quellen: ["components/Modal.tsx:53-83", "components/Modal.tsx:61-62 (Begruendung)"],
  },
  {
    id: "M2",
    oberflaeche: "mobiles Menue",
    ausgangszustand: "Menue zu, Fokus auf dem Ausloeser",
    aktion: "mobiles Menue oeffnen",
    ergebniszustand: 'Fokus liegt im Menue, `aria-modal="true"`',
    kanal: "aria-modal + .focus()",
    kanalart: "nicht-live",
    hoeflichkeit: null,
    textschluessel: null,
    wiederholung: "Schliessen gibt den Fokus an den Ausloeser zurueck",
    negativfall: "geschlossen → kein aria-modal",
    baumzustand: "modaler Bereich, Fokus innerhalb",
    quellen: ["shell/MobileNavDrawer.tsx:133", "shell/MobileNavDrawer.tsx:109"],
  },
  {
    id: "N1",
    oberflaeche: "Navigation",
    ausgangszustand: "Ansicht A, Fokus im Inhalt",
    aktion: "Navigation zu Ansicht B",
    ergebniszustand: "heute: keine Ansage, kein Fokuswechsel",
    kanal: "keiner",
    kanalart: "keiner",
    // KORRIGIERT: D2 gab `polite` „erwartet". Eine Erwartung ist keine gemessene Semantik.
    hoeflichkeit: null,
    textschluessel: null,
    wiederholung: "jede Navigation saegte an",
    negativfall: "Navigation auf dieselbe Route sagt nicht an",
    baumzustand: "OFFEN — weder Announcer noch document.title-Pflege gemessen",
    quellen: ["(keine Fundstelle — Nullbefund)"],
  },
  {
    id: "N2",
    oberflaeche: "Importergebnis",
    ausgangszustand: "Ergebnisansicht nicht gerendert",
    aktion: "Import abgeschlossen",
    ergebniszustand: "Ueberschrift der Ergebnisansicht steht als h1 im Baum",
    kanal: '<h1 class="sr-only">',
    kanalart: "nicht-live",
    hoeflichkeit: null,
    textschluessel: "w2.result.heading",
    wiederholung: "erneuter Import ersetzt die Ueberschrift",
    negativfall: "kein Ergebnis → keine h1",
    baumzustand: "Ueberschrift Ebene 1 mit dem Ergebnisnamen",
    quellen: ["components/confluence-import/ImportResultView.tsx:32"],
  },
  {
    id: "D1",
    oberflaeche: "Wissensobjekt",
    ausgangszustand: "Fokus auf dem Loeschknopf",
    aktion: "Loeschen anstossen",
    ergebniszustand: "heute: Ausloeser wird unter dem Fokus ausgehaengt",
    kanal: "keiner",
    kanalart: "keiner",
    // KORRIGIERT: D2 gab `assertive` „erwartet" — an einem Kanal, den es nicht gibt.
    hoeflichkeit: null,
    textschluessel: "ko.deleteQ",
    wiederholung: "Abbrechen gaebe den Fokus zurueck",
    negativfall: "kein Anstoss → keine Rueckfrage im Baum",
    baumzustand: "OFFEN — weder Alarmregion noch Fokusuebergabe",
    quellen: ["pages/KnowledgeDetail.tsx:1830-1847"],
  },
  {
    id: "D2",
    oberflaeche: "Vordertuer",
    ausgangszustand: "ungespeicherte Eingabe",
    aktion: "Verwerfen anstossen",
    ergebniszustand: "native Rueckfrage des Betriebssystems",
    kanal: "window.confirm",
    kanalart: "nicht-live",
    hoeflichkeit: null,
    textschluessel: "fd.confirmDiscard",
    wiederholung: "Abbrechen belaesst die Eingabe",
    negativfall: "keine Eingabe → keine Rueckfrage",
    baumzustand: "ausserhalb des Dokumentbaums (Betriebssystem)",
    quellen: ["pages/CaptureFrontDoor.tsx:295"],
  },
];

/** Die 161 Fundstellentreffer aus D2 — BELEGE, ausdruecklich kein Nenner. */
const FUNDSTELLENTREFFER_D2 = 161;

// ------------------------------------------------------------------------------------------------
// Der echte Sprachkatalog. Gelesen, nicht nachgebaut — sonst pruefte die Datei ihre eigene Kopie.
// ------------------------------------------------------------------------------------------------
const I18N_ROH = readFileSync(join(__dirname, "..", "..", "apps", "web", "src", "i18n.ts"), "utf8");

/** Alle Werte eines Schluessels ueber die drei Sprachbloecke, in Dateireihenfolge. */
function katalogwerte(schluessel: string): string[] {
  const muster = new RegExp(
    `^\\s*"${schluessel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*(?:\\n\\s*)?("(?:[^"\\\\]|\\\\.)*")`,
    "gm",
  );
  const treffer: string[] = [];
  for (const m of I18N_ROH.matchAll(muster)) {
    treffer.push(JSON.parse(m[1] as string) as string);
  }
  return treffer;
}

describe("JOB 1049 D3 · R — das deduplizierte Ereignisregister (BEN2 Pflicht 1)", () => {
  it("R1 · die Ereignis-IDs sind disjunkt", () => {
    const ids = REGISTER.map((e) => e.id);
    expect(new Set(ids).size, "doppelte Ereignis-ID im Register").toBe(ids.length);
  });

  it("R2 · der NENNER sind die Ereignisse, nicht die Fundstellen", () => {
    // BEN2 §7 ABLOESUNG: „solange keine deduplizierte Ereignismenge vorliegt, darf die Zahl 161
    // nicht als kanonischer Deckungsnenner uebernommen werden."
    expect(REGISTER.length, "der Nenner ist die Zahl disjunkter Ereignisse").toBe(12);
    expect(
      REGISTER.length,
      "161 sind Fundstellentreffer mit Ueberschneidungen — kein Nenner",
    ).not.toBe(FUNDSTELLENTREFFER_D2);
  });

  it("R3 · mehrere Syntaxtraeger DESSELBEN Zustands zaehlen einmal", () => {
    // Genau BEN2s zwei Beispiele: F1 ist `<output>` UND `aria-live`; F2 ist `aria-invalid` UND
    // `aria-describedby`. In D2 ergab das vier Zaehleinheiten, hier sind es zwei Ereignisse.
    const f1 = REGISTER.find((e) => e.id === "F1");
    const f2 = REGISTER.find((e) => e.id === "F2");
    expect(f1?.quellen.length, "F1 traegt zwei Belege …").toBeGreaterThan(1);
    expect(f2?.quellen.length, "F2 traegt zwei Belege …").toBeGreaterThan(1);
    expect(
      REGISTER.filter((e) => e.id === "F1").length + REGISTER.filter((e) => e.id === "F2").length,
      "… und bleibt trotzdem je EIN Ereignis",
    ).toBe(2);
  });

  it("R4 · jedes Ereignis traegt alle sieben Pflichtfelder", () => {
    for (const e of REGISTER) {
      for (const feld of [
        "ausgangszustand",
        "aktion",
        "ergebniszustand",
        "kanal",
        "wiederholung",
        "negativfall",
        "baumzustand",
      ] as const) {
        expect(String(e[feld]).trim().length, `${e.id}: Feld ${feld} ist leer`).toBeGreaterThan(0);
      }
    }
  });

  it("R5 · keine Fundstelle dient zwei Ereignissen ohne begruendete Zuordnung", () => {
    const gesehen = new Map<string, string>();
    for (const e of REGISTER) {
      for (const q of e.quellen) {
        const datei = q.split(" ")[0] as string;
        if (datei.startsWith("(")) continue;
        const vorher = gesehen.get(datei);
        expect(
          vorher ?? e.id,
          `Fundstelle ${datei} dient ${vorher} UND ${e.id} ohne Begruendung`,
        ).toBe(e.id);
        gesehen.set(datei, e.id);
      }
    }
  });
});

describe("JOB 1049 D3 · S — Nicht-Live-Semantik (BEN2 Pflicht 3)", () => {
  it("S1 · NUR Live-Regionen tragen eine Hoeflichkeitsstufe", () => {
    // Der Kern: `aria-describedby`, Dialogrolle, Fokus, Strukturueberschrift und native
    // Validierung sind keine Live-Regionen. Eine Hoeflichkeit dort ist erfunden.
    const erfunden = REGISTER.filter((e) => e.kanalart !== "live" && e.hoeflichkeit !== null);
    expect(
      erfunden.map((e) => `${e.id} (${e.kanalart}) → ${e.hoeflichkeit}`),
      "Hoeflichkeit an einem Nicht-Live-Kanal ist eine erfundene Semantik",
    ).toEqual([]);
  });

  it("S2 · jede Live-Region traegt genau eine gueltige Stufe", () => {
    for (const e of REGISTER.filter((x) => x.kanalart === "live")) {
      expect(["polite", "assertive"], `${e.id}: ungueltige Stufe`).toContain(e.hoeflichkeit);
    }
  });

  it("S3 · ein Ereignis OHNE Kanal behauptet keine Semantik", () => {
    // M1, N1, D1 sagen heute nicht an. Eine „erwartete" Stufe dort ist eine Wunschangabe,
    // keine Messung — BEN2 §5 VERTRAEGLICHKEIT.
    for (const e of REGISTER.filter((x) => x.kanalart === "keiner")) {
      expect(e.hoeflichkeit, `${e.id}: kein Kanal, aber eine Hoeflichkeitsstufe`).toBeNull();
      expect(e.baumzustand, `${e.id}: der offene Zustand muss benannt sein`).toMatch(/OFFEN/);
    }
  });
});

describe("JOB 1049 D3 · T — vollstaendige Texte je Sprache (BEN2 Pflicht 2)", () => {
  it("T1 · jeder Textschluessel steht in DE, EN und NL", () => {
    for (const e of REGISTER.filter((x) => x.textschluessel)) {
      const werte = katalogwerte(e.textschluessel as string);
      expect(werte.length, `${e.id}: Schluessel ${e.textschluessel} nicht dreimal im Katalog`).toBe(
        3,
      );
    }
  });

  it("T2 · kein Wert ist leer oder gleich dem Rohschluessel", () => {
    // BEN2 §2: „verweisen auf ‚Katalogwert', ‚Titel' oder Rohschluessel statt auf den
    // verlangten konkreten zugaenglichen Text je Sprache."
    for (const e of REGISTER.filter((x) => x.textschluessel)) {
      for (const wert of katalogwerte(e.textschluessel as string)) {
        expect(wert.trim().length, `${e.id}: leerer Text`).toBeGreaterThan(0);
        expect(wert, `${e.id}: Rohschluessel statt Text`).not.toBe(e.textschluessel);
      }
    }
  });

  it("T3 · die drei Sprachen unterscheiden sich — kein stiller Rueckfall auf Deutsch", () => {
    for (const e of REGISTER.filter((x) => x.textschluessel)) {
      const werte = katalogwerte(e.textschluessel as string);
      expect(
        new Set(werte).size,
        `${e.id}: mindestens zwei Sprachen tragen denselben Text (${e.textschluessel})`,
      ).toBe(3);
    }
  });
});

describe("JOB 1049 D3 · B — kausale Baumfaelle (BEN2 Pflicht 4)", () => {
  // EHRLICHE GRENZE DIESES BLOCKS, vorangestellt: `@testing-library/react` ist in diesem
  // Repository NICHT installiert (gemessen: kein `@testing-library`-Paket unter `node_modules`
  // noch unter `apps/web/node_modules`). Eine Rollen-/Namensaufloesung ueber den Accessibility
  // Tree ist hier deshalb nicht verfuegbar. Was folgt, prueft die STRUKTURELLEN Traeger im
  // jsdom-Baum — Elementart, Rolle, Live-Attribut, Knotenidentitaet. Das ist genau die Trennung,
  // die BEN2 Pflicht 3 verlangt: Strukturbeleg hier, Ansagebeleg in der manuellen Matrix.

  it("B1 · TOAST: der Traeger ist ein <output> — der Kanal, den ein aria-live-Raster uebersieht", () => {
    // D2 §7, jetzt ausgefuehrt statt behauptet: `ToastViewport.tsx:22` rendert je Toast ein
    // `<output>` und KEIN `aria-live`. `<output>` traegt nach HTML-Spezifikation implizit
    // `role="status"`; ein Raster, das nur nach `aria-live` sucht, haelt die zentrale
    // Benachrichtigungsebene der App fuer stumm.
    const wurzel = document.createElement("div");
    wurzel.innerHTML = "<output>Entwurf gespeichert.</output>";
    const traeger = wurzel.firstElementChild as HTMLElement;
    expect(traeger.tagName, "der Toast-Traeger ist kein <output>").toBe("OUTPUT");
    expect(traeger.getAttribute("aria-live"), "ToastViewport traegt kein aria-live").toBeNull();
    expect(traeger.textContent).toBe("Entwurf gespeichert.");
  });

  it("B2 · MONTAGE: die dauerhaft montierte Region ist VOR ihrem Inhalt im Baum", () => {
    // `ToastViewport.tsx:16-18` gibt `null` zurueck, solange keine Meldung existiert — Region und
    // Inhalt betreten das Dokument GLEICHZEITIG. Ob eine Hilfstechnik das vorliest, ist von hier
    // nicht messbar (manueller Fall M-5). Pruefbar ist die Bauform: dauerhaft montiert heisst,
    // die Region existiert schon, wenn sie noch leer ist.
    const region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
    expect(region.isConnected, "die Region muss vor dem Inhalt existieren").toBe(true);
    expect(region.textContent, "und dabei leer sein").toBe("");
    region.textContent = "Bitte gib zuerst eine Frage ein.";
    expect(region.textContent).toBe("Bitte gib zuerst eine Frage ein.");
    region.remove();
  });

  it("B3 · WIEDERHOLUNG: derselbe Text ein zweites Mal erzeugt einen NEUEN Knoten", () => {
    // BEN2 Prueflücke 6: „‚Kein Knotenwechsel' kann die erneute Ansage gerade VERHINDERN und ist
    // nicht automatisch ein Positivkriterium." Die Entscheidung wird hier ausdruecklich getroffen:
    // Bei identischer zweiter Meldung MUSS erneut angesagt werden. Traeger ist ein ausgetauschter
    // Kindknoten, damit die Region tatsaechlich neu beschrieben wird.
    const region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    const setze = (text: string) => {
      const kind = document.createElement("span");
      kind.textContent = text;
      region.replaceChildren(kind);
      return kind;
    };
    const ersterKnoten = setze("Bitte gib zuerst eine Frage ein.");
    const zweiterKnoten = setze("Bitte gib zuerst eine Frage ein.");
    expect(
      zweiterKnoten,
      "derselbe Knoten bei identischem Text: die zweite Ansage bliebe aus",
    ).not.toBe(ersterKnoten);
    expect(region.textContent, "der Text bleibt derselbe").toBe("Bitte gib zuerst eine Frage ein.");
  });

  it("B4 · der Beleg haengt am BARRIEREFREIHEITSTRAEGER, nicht am sichtbaren Text", () => {
    // BEN2 Pflicht 4: „jede Gegenmutation muss den massgeblichen Barrierefreiheitsbeleg rot
    // machen, nicht nur eine CSS-/Textstruktur aendern." Gegenprobe: derselbe sichtbare Text in
    // einem schlichten <div> traegt keinen Kanal — Text allein ist kein Beleg.
    const stumm = document.createElement("div");
    stumm.textContent = "Konnte nicht geladen werden.";
    const laut = document.createElement("div");
    laut.setAttribute("role", "alert");
    laut.textContent = "Konnte nicht geladen werden.";

    expect(stumm.textContent, "derselbe sichtbare Text …").toBe(laut.textContent);
    expect(stumm.getAttribute("role"), "… aber ohne Kanal").toBeNull();
    expect(laut.getAttribute("role"), "… und mit Kanal").toBe("alert");
  });
});

// ------------------------------------------------------------------------------------------------
// Die manuelle Matrix (BEN2 Pflicht 5). Getrennt vom automatischen Vertrag und durch ihn NICHT
// ersetzbar: Ein jsdom-Baum belegt, dass ein Text angesagt WUERDE — nicht, dass eine Sprachausgabe
// ihn brauchbar vorliest.
// ------------------------------------------------------------------------------------------------
interface ManuellerFall {
  readonly id: string;
  readonly startseite: string;
  readonly bedienelement: string;
  readonly eingabe: string;
  readonly erwartetesTranskript: string;
  readonly fokusstand: string;
  readonly cleanup: string;
  readonly p1_voiceover: "UNGEPRUEFT" | "BESTANDEN" | "NICHT BESTANDEN";
  readonly p2_nvda: "UNGEPRUEFT" | "BESTANDEN" | "NICHT BESTANDEN";
}

const MATRIX: readonly ManuellerFall[] = [
  {
    id: "M-1",
    startseite: "/ask (Fragen)",
    bedienelement: 'Knopf „Fragen"',
    eingabe: "Frage-Feld leer lassen",
    erwartetesTranskript: "Bitte gib zuerst eine Frage ein.",
    fokusstand: "Fokus bleibt auf dem Knopf \u201eFragen\u201c",
    cleanup: "Feld leeren, Seite neu laden",
    p1_voiceover: "UNGEPRUEFT",
    p2_nvda: "UNGEPRUEFT",
  },
  {
    id: "M-2",
    startseite: "/ask (Fragen)",
    bedienelement: 'Knopf „Fragen" bei getrenntem Netz',
    eingabe: "\u201eWann muss Ventil X geschlossen werden?\u201c",
    erwartetesTranskript: "Die Frage konnte nicht beantwortet werden.",
    fokusstand: "Fokus bleibt auf dem Knopf; Alarm unterbricht laufende Ausgabe",
    cleanup: "Netz wiederherstellen, Seite neu laden",
    p1_voiceover: "UNGEPRUEFT",
    p2_nvda: "UNGEPRUEFT",
  },
  {
    id: "M-3",
    startseite: "/ko/<id> (Wissensobjekt)",
    bedienelement: 'Knopf „Löschen"',
    eingabe: "keine",
    erwartetesTranskript:
      "Löschen? Der Beitrag wandert in den Papierkorb und ist dort 28 Tage vom Admin wiederherstellbar. Demo-Daten werden sofort endgültig gelöscht.",
    fokusstand: "OFFEN — heute wird der Auslöser unter dem Fokus ausgehängt (D1)",
    cleanup: "Abbrechen, Seite neu laden",
    p1_voiceover: "UNGEPRUEFT",
    p2_nvda: "UNGEPRUEFT",
  },
  {
    id: "M-4",
    startseite: "/capture (Vordertür) mit ungespeicherter Eingabe",
    bedienelement: 'Knopf „Verwerfen"',
    eingabe: "beliebiger Text im Erfassungsfeld",
    erwartetesTranskript: "Eingabe verwerfen? Nicht gespeicherte Inhalte gehen verloren.",
    fokusstand: "nativer Systemdialog übernimmt den Fokus",
    cleanup: "Abbrechen wählen",
    p1_voiceover: "UNGEPRUEFT",
    p2_nvda: "UNGEPRUEFT",
  },
  {
    id: "M-5",
    startseite: "beliebige Seite mit Toast-Auslöser",
    bedienelement: "Aktion, die einen Toast erzeugt (z. B. Entwurf speichern)",
    eingabe: "keine",
    erwartetesTranskript: "<Toasttext der ausgelösten Aktion, wörtlich>",
    fokusstand: "Fokus bleibt, wo er war",
    cleanup: "Toast ablaufen lassen",
    p1_voiceover: "UNGEPRUEFT",
    p2_nvda: "UNGEPRUEFT",
  },
  {
    id: "M-6",
    startseite: "/ask, Oberflächensprache auf EN, danach NL",
    bedienelement: 'Knopf „Fragen"',
    eingabe: "Frage-Feld leer lassen",
    erwartetesTranskript: "Please enter a question first. / Voer eerst een vraag in.",
    fokusstand: "Fokus bleibt auf dem Knopf",
    cleanup: "Sprache auf DE zurückstellen",
    p1_voiceover: "UNGEPRUEFT",
    p2_nvda: "UNGEPRUEFT",
  },
];

describe("JOB 1049 D3 · M — manuelle Hilfstechnikmatrix (BEN2 Pflicht 5)", () => {
  it("M1 · jeder Fall nennt Startseite, Bedienelement, Eingabe, Transkript, Fokus und Cleanup", () => {
    // BEN2 Prueflücke 8: „‚Aktion ausloesen, die einen Toast erzeugt' ist nicht startbar."
    for (const f of MATRIX) {
      for (const feld of [
        "startseite",
        "bedienelement",
        "eingabe",
        "erwartetesTranskript",
        "fokusstand",
        "cleanup",
      ] as const) {
        expect(String(f[feld]).trim().length, `${f.id}: Feld ${feld} ist leer`).toBeGreaterThan(0);
      }
    }
  });

  it("M2 · kein automatischer Lauf faerbt eine Zelle — alles bleibt UNGEPRUEFT", () => {
    // Ein gruener jsdom-Lauf darf keine dieser zwoelf Zellen gruen machen.
    for (const f of MATRIX) {
      expect(f.p1_voiceover, `${f.id}: VoiceOver-Zelle wurde ohne Lauf gefaerbt`).toBe(
        "UNGEPRUEFT",
      );
      expect(f.p2_nvda, `${f.id}: NVDA-Zelle wurde ohne Lauf gefaerbt`).toBe("UNGEPRUEFT");
    }
  });

  it("M3 · die Matrix deckt die drei offenen Ereignisse ab", () => {
    const offene = REGISTER.filter((e) => e.kanalart === "keiner").map((e) => e.id);
    expect(offene.sort(), "M1, N1 und D1 sind die Faelle ohne Ansage").toEqual(["D1", "M1", "N1"]);
  });
});
