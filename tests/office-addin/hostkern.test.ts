// ================================================================================================
// aufnahme:20260922:excel-erster-weg · DIE REGELN DES HOSTKERNS, OHNE OFFICE
// ================================================================================================
//
// Geladen wird die AUSGELIEFERTE Datei `apps/web/public/office-addin/hostkern.js` — kein Zwilling.
// Geprüft wird, was das Fenster entscheidet, bevor es Office überhaupt fragt: API-Stufen (KO-04-01),
// Werte/Formeln/Anzeige und Grenzen der Excel-Auswahl (K2, KO-04-02), Nachrechnung und Summe
// (KO-04-03), PowerPoint-Lagen mit Ausweg (KO-04-04), die Zielprüfungen vor jeder Rückgabe
// (KO-04-05, KO-04-06). Alle Daten sind erfunden.
import { describe, expect, it } from "vitest";
import { lies } from "./buehne";

type Daten = Record<string, unknown>;

interface Zelle {
  adresse: string;
  wert: unknown;
  formel: string | null;
  text: string;
  art: string;
}

interface Bereich {
  adresse: string;
  zellenGesamt: number;
  zellenGelesen: number;
  gekuerzt: boolean;
  zellen: Zelle[];
  werte: unknown[][];
}

interface Bewertung {
  zustand: string;
  hinweise: string[];
}

interface Pruefung {
  ok: boolean;
  grund: string | null;
}

interface Api {
  hoechste: string | null;
  faehigkeiten: Record<string, boolean>;
}

interface Zerlegt {
  blatt: string;
  startSpalte: number;
  endSpalte: number;
  startZeile: number;
  endZeile: number;
}

interface Summenplan {
  ok: boolean;
  grund?: string;
  zielAdresse?: string;
  inhalt?: string;
  erwartet?: number;
}

interface PptLage {
  zustand: string;
  rueckgabeMoeglich: boolean;
  ausweg: string;
}

interface Hostkern {
  GRENZEN: { maxZellen: number; maxKontextZeichen: number; planGueltigMs: number };
  RUECKGABE_ARTEN: Record<string, string[]>;
  hostAusOffice(wert: unknown): string | null;
  pruefeApiStufen(host: string, isSetSupported: unknown): Api | null;
  fehlendeFaehigkeiten(api: unknown): string[];
  plattformAus(diagnostics: unknown): { anzeige: string; version: string; imAuftrag: boolean };
  dokumentName(url: string): string;
  adresseZerlegen(adresse: string): Zerlegt | null;
  teilblock(z: unknown, max: number): unknown;
  lokaleAdresse(z: unknown): string;
  zelleBeschreiben(wert: unknown, formel: unknown, text: unknown, typ?: string): Zelle;
  excelBereich(roh: Daten, gesamt?: number): Bereich;
  excelAuswahlBewerten(bereiche: Bereich[]): Bewertung;
  excelKontextText(kontext: Daten): string;
  excelTabelleHtml(kontext: Daten): string;
  zahlenNachrechnen(bereiche: Bereich[]): Daten;
  summenPlan(kontext: Daten): Summenplan;
  zielVorschlag(kontext: Daten): string;
  zellTextSicher(text: string): string;
  ergebnisVergleichen(erwartet: number, gelesen: unknown): { gleich: boolean };
  abdruck(daten: unknown): string;
  excelZielPruefen(plan: Daten, lage: Daten): Pruefung;
  pptLageBewerten(lage: Daten): PptLage;
  pptKontextText(kontext: Daten): string;
  pptZielPruefen(plan: Daten, lage: Daten): Pruefung;
  pptErgebnisPruefen(plan: Daten, nachher: Daten | null): { ok: boolean; abweichungen: string[] };
  kontextBindung(host: string, kontext: Daten | null): string | null;
  antwortBindungPruefen(antwort: Daten | null, aktuelleBindung: string | null): Pruefung;
  rueckgabeErlaubt(host: string, art: string): boolean;
  kontextZeile(host: string, kontext: unknown): string;
  grundSatz(grund: string): string;
}

function laden(): Hostkern {
  const fenster: Daten = {};
  new Function("window", lies("hostkern.js"))(fenster);
  return fenster.KlaraOfficeHost as Hostkern;
}

const K = laden();

/** Ein fiktiver Bereich B2:B4 mit Anzeigeformat, Wert und einer Formelzelle. */
function haushalt(): Bereich {
  return K.excelBereich({
    address: "Tabelle1!B2:B4",
    values: [[1200], [85.5], [40]],
    formulas: [[1200], [85.5], ["=20*2"]],
    text: [["1.200 €"], ["85,50 €"], ["40"]],
    valueTypes: [["Double"], ["Double"], ["Double"]],
    rowCount: 3,
    columnCount: 1,
    cellCount: 3,
  });
}

function typVon(wert: unknown): string {
  if (typeof wert === "number") {
    return "Double";
  }
  return wert === "" ? "Empty" : "String";
}

/** Ein einspaltiger Bereich aus Werten; die Typen folgen dem Wert. */
function spalte(address: string, werte: unknown[]): Bereich {
  return K.excelBereich({
    address,
    values: werte.map((w) => [w]),
    formulas: werte.map((w) => [w]),
    text: werte.map((w) => [String(w)]),
    valueTypes: werte.map((w) => [typVon(w)]),
  });
}

function kontext(bereiche: Bereich[]): Daten {
  return {
    mappe: "Haushalt-fiktiv.xlsx",
    blatt: "Tabelle1",
    bereiche,
    bewertung: K.excelAuswahlBewerten(bereiche),
  };
}

describe("KO-04-01 · Host und API-Stufen werden zur Laufzeit geprüft, nicht angenommen", () => {
  it("erkennt nur Excel und PowerPoint als eigene Hosts; Word bleibt Word", () => {
    expect(K.hostAusOffice("Excel")).toBe("excel");
    expect(K.hostAusOffice("PowerPoint")).toBe("powerpoint");
    expect(K.hostAusOffice("Word")).toBe("word");
    expect(K.hostAusOffice("Outlook")).toBeNull();
    expect(K.hostAusOffice(undefined)).toBeNull();
  });

  it("schaltet jede Fähigkeit nur mit bestätigter Stufe frei; ein werfender Host gilt als nein", () => {
    const nurEins = (satz: string, stufe: string) => satz === "ExcelApi" && stufe === "1.1";
    const nur11 = K.pruefeApiStufen("excel", nurEins);
    expect(nur11?.hoechste).toBe("1.1");
    expect(nur11?.faehigkeiten).toEqual({
      bereichLesen: true,
      bereichSchreiben: true,
      blattschutz: false,
      mappenname: false,
      mehrfachauswahl: false,
    });
    expect(K.fehlendeFaehigkeiten(nur11)).toContain("mehrfachauswahl (ExcelApi 1.9)");
    const wirft = K.pruefeApiStufen("powerpoint", () => {
      throw new Error("kein Host");
    });
    expect(wirft?.hoechste).toBeNull();
    expect(Object.values(wirft?.faehigkeiten ?? {})).toEqual([false, false, false]);
    expect(K.pruefeApiStufen("word", () => true)).toBeNull();
  });

  it("nennt Plattform und Version; nur Mac und Web gehören zur Abnahme", () => {
    expect(K.plattformAus({ host: "Excel", platform: "Mac", version: "16.89" })).toMatchObject({
      anzeige: "Mac",
      version: "16.89",
      imAuftrag: true,
    });
    expect(K.plattformAus({ platform: "OfficeOnline" }).anzeige).toBe("Web");
    expect(K.plattformAus({ platform: "PC" }).imAuftrag).toBe(false);
    const url = "https://fiktiv-my.sharepoint.com/x/Haushalt%20fiktiv.xlsx?web=1";
    expect(K.dokumentName(url)).toBe("Haushalt fiktiv.xlsx");
    expect(K.dokumentName("")).toBe("");
  });
});

describe("K2 · KO-04-02 · Excel: Bereich, Wert, Formel und Anzeige getrennt; Grenzen benannt", () => {
  it("zerlegt Adressen mit Blatt, Anführung, ganzen Spalten und Zeilen", () => {
    expect(K.adresseZerlegen("Tabelle1!B2:C5")).toEqual({
      blatt: "Tabelle1",
      startSpalte: 2,
      endSpalte: 3,
      startZeile: 2,
      endZeile: 5,
    });
    expect(K.adresseZerlegen("'Mein ''Blatt'''!$A$1")?.blatt).toBe("Mein 'Blatt'");
    expect(K.adresseZerlegen("Tabelle1!B:B")).toMatchObject({ startZeile: 1, endZeile: 1048576 });
    expect(K.adresseZerlegen("Tabelle1!2:3")).toMatchObject({ startSpalte: 1, endSpalte: 16384 });
    expect(K.adresseZerlegen("Tabelle1!B2:??")).toBeNull();
  });

  it("liest von einer ganzen Spalte nur einen begrenzten Block", () => {
    const ganzeSpalte = K.adresseZerlegen("Tabelle1!B:B");
    expect(K.lokaleAdresse(K.teilblock(ganzeSpalte, K.GRENZEN.maxZellen))).toBe("B1:B500");
    const breit = K.adresseZerlegen("Tabelle1!A1:Z100");
    expect(K.lokaleAdresse(K.teilblock(breit, 500))).toBe("A1:Z19");
  });

  it("unterscheidet Zahl, Formel, Text, Fehler, Wahrheitswert und leer", () => {
    expect(K.zelleBeschreiben(1200, 1200, "1.200 €", "Double").art).toBe("zahl");
    const formel = K.zelleBeschreiben(40, "=20*2", "40", "Double");
    expect([formel.art, formel.formel]).toEqual(["zahl", "=20*2"]);
    expect(K.zelleBeschreiben("Miete", "Miete", "Miete", "String").art).toBe("text");
    expect(K.zelleBeschreiben("#DIV/0!", "=1/0", "#DIV/0!", "Error").art).toBe("fehler");
    expect(K.zelleBeschreiben(true, true, "WAHR", "Boolean").art).toBe("wahrheitswert");
    expect(K.zelleBeschreiben("", "", "", "Empty").art).toBe("leer");
  });

  it("der Kontext trägt je Zelle Anzeige, Wert und Formel in eigenen Spalten", () => {
    const text = K.excelKontextText(kontext([haushalt()]));
    expect(text).toContain("Arbeitsmappe: Haushalt-fiktiv.xlsx");
    expect(text).toContain("Blatt: Tabelle1");
    expect(text).toContain("Adresse | angezeigt | Wert | Formel");
    expect(text).toContain("B2 | 1.200 € | 1200 | –");
    expect(text).toContain("B4 | 40 | 40 | =20*2");
  });

  it("leer, mehrteilig und zu groß sind eigene Zustände mit verständlichem Satz", () => {
    const leer = spalte("Tabelle1!F1:F3", ["", "", ""]);
    expect(K.excelAuswahlBewerten([leer]).zustand).toBe("leer");
    expect(K.excelAuswahlBewerten([]).hinweise[0]).toContain("Die Auswahl ist leer");
    const zwei = K.excelAuswahlBewerten([haushalt(), haushalt()]);
    expect(zwei.zustand).toBe("mehrteilig");
    expect(zwei.hinweise[0]).toContain("Mehrere Bereiche markiert (2)");
    const gross = K.excelBereich(
      {
        address: "Tabelle1!B:B",
        values: [[1], [2]],
        formulas: [[1], [2]],
        text: [["1"], ["2"]],
        valueTypes: [["Double"], ["Double"]],
        rowCount: 1048576,
        columnCount: 1,
      },
      1048576,
    );
    const bewertung = K.excelAuswahlBewerten([gross]);
    expect(bewertung.zustand).toBe("zuGross");
    expect(bewertung.hinweise[0]).toContain("nur die ersten 500");
  });

  it("der Kontext bleibt unter der Grenze des Klara-Wegs (selection ≤ 8000) bei 500 Zellen", () => {
    const werte: string[] = [];
    for (let i = 0; i < 500; i += 1) {
      werte.push(`Ein sehr langer fiktiver Zelltext Nummer ${i} `.repeat(10));
    }
    const text = K.excelKontextText(kontext([spalte("Tabelle1!A1:A500", werte)]));
    expect(K.GRENZEN.maxKontextZeichen).toBeLessThan(8000);
    expect(text.length).toBeLessThan(8000);
    expect(text).toMatch(/weitere Zellen passen nicht in den Kontext/);
  });

  it("R-0187 · der Entwurf trägt Herkunft, angezeigte Werte und Formeln — escaped", () => {
    const b = haushalt();
    const erste = b.zellen[0];
    if (erste) {
      erste.text = "<b>1.200 €</b>";
    }
    const html = K.excelTabelleHtml(kontext([b]));
    expect(html).toContain("Herkunft: Excel-Arbeitsmappe „Haushalt-fiktiv.xlsx“");
    expect(html).toContain("Blatt „Tabelle1“, Bereich Tabelle1!B2:B4");
    expect(html).toContain("<table>");
    expect(html).toContain("&lt;b&gt;1.200 €&lt;/b&gt;");
    expect(html).toContain("Formeln: B4: =20*2");
  });
});

describe("KO-04-03 · Nachrechnung und Summe: Excel rechnet, Klara vergleicht", () => {
  it("rechnet die gespeicherten Werte nach, nicht den Anzeigetext", () => {
    expect(K.zahlenNachrechnen([haushalt()])).toMatchObject({
      anzahl: 3,
      summe: 1325.5,
      nichtZahlen: 0,
    });
  });

  it("plant die Summe unter eine einspaltige Zahlenauswahl", () => {
    expect(K.summenPlan(kontext([haushalt()]))).toMatchObject({
      ok: true,
      zielAdresse: "B5",
      inhalt: "=SUM(B2:B4)",
      erwartet: 1325.5,
    });
    expect(K.zielVorschlag(kontext([haushalt()]))).toBe("B5");
  });

  it("lehnt Summe bei Text, mehreren Spalten, mehreren Bereichen und leerer Auswahl ab", () => {
    const mitText = spalte("Tabelle1!A2:A3", ["Miete", 3]);
    expect(K.summenPlan(kontext([mitText])).grund).toBe("textInSpalte");
    const breit = K.excelBereich({
      address: "Tabelle1!A2:B2",
      values: [[1, 2]],
      formulas: [[1, 2]],
      text: [["1", "2"]],
      valueTypes: [["Double", "Double"]],
    });
    expect(K.summenPlan(kontext([breit])).grund).toBe("keineEinzelspalte");
    expect(K.summenPlan(kontext([haushalt(), haushalt()])).grund).toBe("auswahl-mehrteilig");
    expect(K.summenPlan(kontext([])).grund).toBe("auswahl-leer");
  });

  it("vergleicht mit Toleranz und erkennt Abweichung", () => {
    expect(K.ergebnisVergleichen(0.3, 0.1 + 0.2).gleich).toBe(true);
    expect(K.ergebnisVergleichen(1325.5, 1325).gleich).toBe(false);
    expect(K.ergebnisVergleichen(1, "#WERT!").gleich).toBe(false);
  });

  it("Text in einer Zelle bleibt Text: =, +, - und @ werden nicht zur Formel", () => {
    expect(K.zellTextSicher("=1+1")).toBe("'=1+1");
    expect(K.zellTextSicher("+49 fiktiv")).toBe("'+49 fiktiv");
    expect(K.zellTextSicher("@fiktiv")).toBe("'@fiktiv");
    expect(K.zellTextSicher("Antwort")).toBe("Antwort");
    expect(K.zellTextSicher("x".repeat(40000)).length).toBe(32767);
  });
});

describe("KO-04-03 · KO-04-06 · die Excel-Zielprüfung verhindert falsche Zieländerungen", () => {
  const jetzt = 1_000_000;
  const leer = K.abdruck([[""]]);
  const plan = {
    art: "summenformel",
    dokument: "https://fiktiv/Haushalt.xlsx",
    blatt: "Tabelle1",
    quelleAbdruck: "q1",
    zielAdresse: "B5",
    zielAbdruck: leer,
    erstelltMs: jetzt,
  };
  const lage = {
    jetztMs: jetzt + 1000,
    dokument: "https://fiktiv/Haushalt.xlsx",
    blatt: "Tabelle1",
    modus: "readWrite",
    blattGeschuetzt: false,
    quelleAbdruck: "q1",
    zielFormeln: [[""]],
    zielAbdruck: leer,
  };
  const notiz = { zielFormeln: [["Notiz"]], zielAbdruck: K.abdruck([["Notiz"]]) };
  const verweigert: [string, Daten][] = [
    ["dokumentGewechselt", { dokument: "https://fiktiv/Anderes.xlsx" }],
    ["blattGewechselt", { blatt: "Tabelle2" }],
    ["nurLesen", { modus: "readOnly" }],
    ["blattGeschuetzt", { blattGeschuetzt: true }],
    ["quelleGeaendert", { quelleAbdruck: "q2" }],
    ["zielBelegt", notiz],
    ["planVeraltet", { jetztMs: jetzt + K.GRENZEN.planGueltigMs + 1 }],
  ];

  it("lässt die unveränderte Lage zu", () => {
    expect(K.excelZielPruefen(plan, lage)).toEqual({ ok: true, grund: null });
  });

  it.each(verweigert)("verweigert bei %s", (grund, aenderung) => {
    expect(K.excelZielPruefen(plan, { ...lage, ...aenderung })).toEqual({ ok: false, grund });
    expect(K.grundSatz(grund)).not.toBe("Nichts wurde geschrieben.");
  });

  it("überschreibt eine belegte Zelle nur bestätigt — und nur, wenn sie unverändert ist", () => {
    const bestaetigt = { ...plan, ueberschreibenBestaetigt: true, zielAbdruck: notiz.zielAbdruck };
    expect(K.excelZielPruefen(bestaetigt, { ...lage, ...notiz }).ok).toBe(true);
    const neu = { ...lage, zielFormeln: [["Neu"]], zielAbdruck: K.abdruck([["Neu"]]) };
    expect(K.excelZielPruefen(bestaetigt, neu).grund).toBe("zielGeaendert");
  });

  it("kennt nur Summenformel und Zelltext — keine andere Rückgabe", () => {
    expect(K.excelZielPruefen({ ...plan, art: "bild" }, lage).grund).toBe("artNichtErlaubt");
    const zweiZellen = { ...plan, zielAdresse: "B5:B6" };
    expect(K.excelZielPruefen(zweiZellen, lage).grund).toBe("zielUngueltig");
    expect(K.RUECKGABE_ARTEN).toEqual({
      excel: ["summenformel", "zelltext"],
      powerpoint: ["formtext"],
    });
    for (const art of ["bild", "form", "figur", "avatar", "folie"]) {
      expect(K.rueckgabeErlaubt("powerpoint", art)).toBe(false);
      expect(K.rueckgabeErlaubt("excel", art)).toBe(false);
    }
  });
});

describe("KO-04-04 · KO-04-05 · PowerPoint: Lage, Ausweg und Zielprüfung", () => {
  const api = { faehigkeiten: { folienListe: true, formTextSchreiben: true, auswahl: true } };
  const textfeld = { id: "11", name: "Textfeld 2", typ: "TextBox", text: "Umsatz (fiktiv)" };
  const bild = { id: "12", name: "Bild 3", typ: "Image", text: null };
  const bearbeiten = (mehr: Daten): PptLage => K.pptLageBewerten({ ansicht: "edit", api, ...mehr });

  it("unterscheidet Lese-/Präsentationsansicht und Nur-Lesen von der Bearbeitung", () => {
    const lesen = K.pptLageBewerten({ ansicht: "read", api, formen: [textfeld] });
    expect([lesen.zustand, lesen.rueckgabeMoeglich]).toEqual(["leseansicht", false]);
    expect(lesen.ausweg).toContain("Ansicht › Normal");
    expect(bearbeiten({ modus: "readOnly", formen: [textfeld] }).zustand).toBe("nurLesen");
  });

  it("gibt für jede nicht erreichbare Auswahl einen konkreten Ausweg", () => {
    const form = bearbeiten({ formen: [textfeld] });
    expect([form.zustand, form.rueckgabeMoeglich]).toEqual(["form", true]);
    const markiertesBild = bearbeiten({ formen: [bild] });
    expect(markiertesBild.zustand).toBe("formOhneText");
    expect(markiertesBild.ausweg).toContain("markiere ein Textfeld");
    expect(bearbeiten({ formen: [textfeld, textfeld] }).zustand).toBe("mehrereFormen");
    expect(bearbeiten({ folien: [{ id: "256#", nummer: 1 }] }).zustand).toBe("folie");
    expect(bearbeiten({}).ausweg).toContain("Klicke links eine Folie an");
    const ohneAuswahlApi = { ansicht: "edit", api: { faehigkeiten: {} }, textAuswahl: "x" };
    const alt = K.pptLageBewerten(ohneAuswahlApi);
    expect([alt.zustand, alt.rueckgabeMoeglich]).toEqual(["nurText", false]);
    expect(alt.ausweg).toContain("PowerPointApi 1.5");
  });

  it("der Kontext nennt Präsentation, Folie und Textfelder, Bilder nicht", () => {
    const text = K.pptKontextText({
      praesentation: "Quartal-fiktiv.pptx",
      folien: [{ id: "256#", nummer: 1 }],
      formen: [textfeld, bild],
    });
    expect(text).toContain("Präsentation: Quartal-fiktiv.pptx");
    expect(text).toContain("Folie: Nr. 1");
    expect(text).toContain("Form „Textfeld 2“ (TextBox): Umsatz (fiktiv)");
    expect(text).not.toContain("Bild 3");
  });

  const position = { links: 40, oben: 120, breite: 600, hoehe: 80 };

  it("schreibt nur in dieselbe, unveränderte Form derselben Präsentation in Bearbeitung", () => {
    const plan = {
      art: "formtext",
      dokument: "d",
      zielAbdruck: K.abdruck("Umsatz (fiktiv)"),
      position,
      erstelltMs: 0,
    };
    const lage = {
      jetztMs: 10,
      dokument: "d",
      ansicht: "edit",
      modus: "readWrite",
      folieVorhanden: true,
      formVorhanden: true,
      formTyp: "TextBox",
      formText: "Umsatz (fiktiv)",
      position: { ...position },
    };
    expect(K.pptZielPruefen(plan, lage).ok).toBe(true);
    const faelle: [string, Daten][] = [
      ["zielGeaendert", { formText: "Koautor" }],
      ["folieFehlt", { folieVorhanden: false }],
      ["formFehlt", { formVorhanden: false }],
      ["keinTextfeld", { formTyp: "Image" }],
      ["leseansicht", { ansicht: "read" }],
      ["dokumentGewechselt", { dokument: "e" }],
      ["zielVerschoben", { position: { ...position, links: 41 } }],
      ["zielVerschoben", { position: { ...position, hoehe: 120 } }],
      ["zielVerschoben", { position: null }],
    ];
    for (const [grund, aenderung] of faelle) {
      expect(K.pptZielPruefen(plan, { ...lage, ...aenderung }).grund).toBe(grund);
    }
    expect(K.pptZielPruefen({ ...plan, art: "bild" }, lage).grund).toBe("artNichtErlaubt");
    expect(K.pptZielPruefen({ ...plan, position: undefined }, lage).grund).toBe("zielVerschoben");
  });

  it("prüft das zurückgelesene Ergebnis: Text wie beabsichtigt, Lage und Größe unverändert", () => {
    const plan = { inhalt: "Zeile 1\nZeile 2", position };
    const gut = { formVorhanden: true, text: "Zeile 1\rZeile 2", position: { ...position } };
    expect(K.pptErgebnisPruefen(plan, gut)).toEqual({ ok: true, abweichungen: [] });
    const falsch = { formVorhanden: true, text: "anders", position: { ...position, oben: 0 } };
    expect(K.pptErgebnisPruefen(plan, falsch).abweichungen).toEqual([
      "textAbweichend",
      "positionAbweichend",
    ]);
    expect(K.pptErgebnisPruefen(plan, null).abweichungen).toEqual(["formFehlt"]);
  });
});

describe("Ben-Befund · eine Antwort gilt nur für Dokument, Auswahl und Inhalt, zu denen sie kam", () => {
  const folie = [{ id: "256#", nummer: 1 }];
  const formA = { id: "11", name: "Textfeld 2", typ: "TextBox", text: "Umsatz (fiktiv)" };
  const formB = { id: "10", name: "Titel 1", typ: "Placeholder", text: "Titel (fiktiv)" };
  const lageA = { dokument: "d", folien: folie, formen: [formA] };

  it("andere Form, anderer Text, anderes Dokument ergeben einen anderen Schlüssel", () => {
    const a = K.kontextBindung("powerpoint", lageA);
    expect(a).toMatch(/^powerpoint:/);
    expect(K.kontextBindung("powerpoint", { ...lageA })).toBe(a);
    expect(K.kontextBindung("powerpoint", { ...lageA, formen: [formB] })).not.toBe(a);
    const neuerText = { ...lageA, formen: [{ ...formA, text: "Koautor" }] };
    expect(K.kontextBindung("powerpoint", neuerText)).not.toBe(a);
    expect(K.kontextBindung("powerpoint", { ...lageA, dokument: "e" })).not.toBe(a);
    expect(K.kontextBindung("powerpoint", null)).toBeNull();
    const excel = { dokument: "d", blatt: "Tabelle1", bereiche: [haushalt()] };
    const x = K.kontextBindung("excel", excel);
    const zelle = haushalt();
    const erste = zelle.werte[0];
    if (erste) {
      erste[0] = 999;
    }
    expect(K.kontextBindung("excel", { ...excel, bereiche: [zelle] })).not.toBe(x);
    expect(K.kontextBindung("excel", { ...excel, blatt: "Tabelle2" })).not.toBe(x);
  });

  it("nur die Antwort zur gerade gültigen Lage darf zurückgegeben werden", () => {
    const a = K.kontextBindung("powerpoint", lageA);
    const b = K.kontextBindung("powerpoint", { ...lageA, formen: [formB] });
    const antwort = { text: "Antwort (fiktiv)", bindung: a };
    expect(K.antwortBindungPruefen(antwort, a)).toEqual({ ok: true, grund: null });
    expect(K.antwortBindungPruefen(antwort, b).grund).toBe("antwortVeraltet");
    expect(K.antwortBindungPruefen(antwort, null).grund).toBe("antwortVeraltet");
    expect(K.antwortBindungPruefen({ text: "ohne Bindung" }, a).grund).toBe("antwortVeraltet");
    expect(K.antwortBindungPruefen(null, a).grund).toBe("keineAntwort");
    expect(K.grundSatz("antwortVeraltet")).toContain("früheren Auswahl");
  });
});

describe("KO-04-06 · die Kontextzeile der Begleitfigur folgt Host und Auswahl", () => {
  it("nennt Host, Datei, Blatt bzw. Folie und Bereich bzw. Form", () => {
    const excel = { mappe: "Haushalt-fiktiv.xlsx", blatt: "Tabelle1", bereiche: [haushalt()] };
    const zeile = K.kontextZeile("excel", excel);
    expect(zeile).toBe("Excel · Haushalt-fiktiv.xlsx · Tabelle1 · B2:B4");
    const ppt = {
      praesentation: "Quartal-fiktiv.pptx",
      folien: [{ id: "256#", nummer: 2 }],
      formen: [{ id: "11", name: "Textfeld 2", typ: "TextBox" }],
    };
    expect(K.kontextZeile("powerpoint", ppt)).toBe(
      "PowerPoint · Quartal-fiktiv.pptx · Folie 2 · Textfeld 2",
    );
    expect(K.kontextZeile("excel", null)).toBe("Excel · noch nichts gelesen");
  });
});
