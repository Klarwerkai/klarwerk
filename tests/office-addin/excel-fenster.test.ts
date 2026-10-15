// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:excel-erster-weg · DAS AUSGELIEFERTE FENSTER IN EXCEL (ATTRAPPE)
// ================================================================================================
//
// Ausgeführt werden `hostkern.js` und `taskpane.js` unverändert auf dem Rumpf von `taskpane.html`.
// Excel ist eine Attrappe nach dem Vertrag der Office-JS-API (`buehne.ts`). Belegt wird der ganze
// Weg im Fenster: Kontext lesen (KO-04-02), Frage über den vorhandenen Klara-Sitzungsweg
// (KO-04-03), zielgeprüfte Rückgabe mit Excel-Ergebnis gegen Nachrechnung und Rücknahme
// (KO-04-03, KO-04-06) sowie der Wissens-Entwurf (R-0187).
// NICHT belegt: der echte Lauf in Excel für Mac und Excel im Web (KO-04-07) — er bleibt offen.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Abruf,
  type ExcelStand,
  type OfficeOptionen,
  abbauen,
  figurKontext,
  knoten,
  starte,
  textVon,
  warte,
} from "./buehne";

const URL_MAPPE = "https://fiktiv-my.sharepoint.com/personal/test/Documents/Haushalt-fiktiv.xlsx";

const EXCEL_MAC: OfficeOptionen = {
  host: "Excel",
  plattform: "Mac",
  version: "16.89",
  url: URL_MAPPE,
  stufen: { ExcelApi: ["1.1", "1.2", "1.7", "1.9"] },
};

function mappe(auswahl: string[] = ["B2:B4"]): ExcelStand {
  return {
    mappe: "Haushalt-fiktiv.xlsx",
    aktiv: "Tabelle1",
    auswahl,
    syncs: 0,
    blaetter: {
      Tabelle1: {
        geschuetzt: false,
        zellen: {
          A1: { wert: "Position", formel: null },
          B1: { wert: "Betrag", formel: null },
          A2: { wert: "Miete", formel: null },
          B2: { wert: 1200, formel: null, text: "1.200 €" },
          A3: { wert: "Strom", formel: null },
          B3: { wert: 85.5, formel: null, text: "85,50 €" },
          A4: { wert: "Wasser", formel: null },
          B4: { wert: 40, formel: "=20*2", text: "40,00 €" },
        },
      },
      Tabelle2: { geschuetzt: false, zellen: {} },
    },
  };
}

function zellen(stand: ExcelStand, blatt = "Tabelle1") {
  const b = stand.blaetter[blatt];
  if (!b) {
    throw new Error(`Blatt ${blatt} fehlt`);
  }
  return b.zellen;
}

function koerper(abruf: Abruf | undefined): Record<string, unknown> {
  return JSON.parse(abruf?.body ?? "{}") as Record<string, unknown>;
}

afterEach(() => {
  abbauen();
});

describe("KO-04-01 · KO-04-02 · Excel liefert Arbeitsmappe, Blatt und Auswahl", () => {
  it("nennt Host, Plattform, Version und die zur Laufzeit bestätigte API-Stufe", async () => {
    await starte(EXCEL_MAC, { excel: mappe() });
    expect(textVon("host-zeile")).toBe("Excel · Mac 16.89");
    expect(textVon("api-zeile")).toBe("ExcelApi: bestätigt bis 1.9");
    expect(knoten("api-fehlt").hidden).toBe(true);
    expect(knoten("klara-figur").getAttribute("data-host")).toBe("excel");
  });

  it("liest Wert, Formel und Anzeige getrennt und rechnet die Werte selbst nach", async () => {
    await starte(EXCEL_MAC, { excel: mappe() });
    expect(textVon("kontext-zeile")).toBe("Excel · Haushalt-fiktiv.xlsx · Tabelle1 · B2:B4");
    const kontext = textVon("kontext-text");
    expect(kontext).toContain("B2 | 1.200 € | 1200 | –");
    expect(kontext).toContain("B4 | 40,00 € | 40 | =20*2");
    expect(textVon("nachrechnung")).toContain("3 Zahlen, Summe 1325.5");
    expect(figurKontext()).toMatchObject({ host: "excel", zeile: textVon("kontext-zeile") });
  });

  it("leere Auswahl: verständlicher Satz, keine Rückgabe, kein Entwurf", async () => {
    await starte(EXCEL_MAC, { excel: mappe(["F10:F12"]) });
    expect(textVon("kontext-ausweg")).toContain("Die Auswahl ist leer");
    expect(knoten("summe-vorbereiten").disabled).toBe(true);
    expect(knoten("entwurf-senden").disabled).toBe(true);
  });

  it("zu große Auswahl (ganze Spalte): nur 500 Zellen gelesen, Kontext begrenzt", async () => {
    const stand = mappe(["B:B"]);
    await starte(EXCEL_MAC, { excel: stand });
    expect(textVon("kontext-zustand")).toContain("(1048576 markiert)");
    expect(textVon("kontext-ausweg")).toContain("nur die ersten 500");
    expect(textVon("kontext-text").length).toBeLessThan(8000);
    expect(knoten("summe-vorbereiten").disabled).toBe(true);
  });

  it("mehrteilige Auswahl: beide Bereiche gelesen, Summe gesperrt", async () => {
    await starte(EXCEL_MAC, { excel: mappe(["A2:A3", "B2:B3"]) });
    expect(textVon("kontext-ausweg")).toContain("Mehrere Bereiche markiert (2)");
    expect(textVon("kontext-text")).toContain("A2 | Miete");
    expect(textVon("kontext-text")).toContain("B3 | 85,50 €");
    expect(knoten("summe-vorbereiten").disabled).toBe(true);
  });

  it("ohne ExcelApi 1.9 sagt das Fenster, was fehlt, statt mehrteilig zu raten", async () => {
    const alt = { ...EXCEL_MAC, stufen: { ExcelApi: ["1.1"] } };
    await starte(alt, { excel: mappe(["A2:A3", "B2:B3"]) });
    expect(textVon("api-fehlt")).toContain("mehrfachauswahl (ExcelApi 1.9)");
    expect(textVon("kontext-zustand")).toContain("Mehrere Bereiche markiert");
  });
});

describe("KO-04-03 · Frage über den vorhandenen Klara-Sitzungsweg", () => {
  it("bindet die Sitzung an die Datei und schickt den Kontext als Auswahl mit", async () => {
    const { fenster, abrufe } = await starte(EXCEL_MAC, { excel: mappe() });
    const sitzung = abrufe.find((a) => a.url === "/api/klara/sessions");
    const beschreiber = koerper(sitzung).documentDescriptor;
    expect(beschreiber).toEqual({ kind: "saved", canonicalUrl: URL_MAPPE });
    knoten("frage-text").value = "Welche Position ist am höchsten?";
    await fenster.fragen();
    const frage = abrufe.find((a) => a.url === "/api/klara/sessions/s-1/execute");
    expect(frage?.method).toBe("POST");
    expect(frage?.headers["x-klara-session"]).toBe("s-1");
    expect(frage?.headers["x-klara-document"]).toBe("doc-s-1");
    const gesendet = koerper(frage);
    expect(gesendet.question).toBe("Welche Position ist am höchsten?");
    expect(gesendet.questionSource).toBe("manual");
    expect(gesendet.mode).toBe("retrieval-only");
    expect(String(gesendet.selection)).toContain("Blatt: Tabelle1");
    expect(String(gesendet.selection)).toContain("B4 | 40,00 € | 40 | =20*2");
    expect(textVon("antwort-text")).toBe("Die höchste Position ist Miete (fiktiv).");
    expect(textVon("antwort-quellen")).toContain("/wissen/ko-1");
    expect(textVon("antwort-grenze")).toContain("nicht nachgerechnet");
  });
});

describe("KO-04-03 · Summe: Ziel prüfen, Excel rechnen lassen, gegen Nachrechnung vergleichen", () => {
  it("schreibt =SUM unter die Spalte erst nach zweitem Klick und nimmt es zurück", async () => {
    const stand = mappe();
    const { fenster } = await starte(EXCEL_MAC, { excel: stand });
    await fenster.summeVorbereiten();
    expect(knoten("plan").hidden).toBe(false);
    expect(textVon("plan-satz")).toContain("Ziel: Tabelle1!B5");
    expect(textVon("plan-satz")).toContain("=SUM(B2:B4)");
    expect(zellen(stand).B5).toBeUndefined();
    await fenster.ausfuehren();
    expect(zellen(stand).B5).toMatchObject({ formel: "=SUM(B2:B4)", wert: 1325.5 });
    expect(textVon("rueckgabe-meldung")).toContain("Excel hat 1325.5 berechnet");
    expect(textVon("rueckgabe-meldung")).toContain("stimmt überein");
    expect(knoten("speichern-hinweis").hidden).toBe(false);
    await fenster.zuruecknehmen();
    expect(zellen(stand).B5).toBeUndefined();
    expect(textVon("rueckgabe-meldung")).toContain("Zurückgenommen");
  });

  it("ändert ein Koautor die Quelle nach dem Vorbereiten, wird nichts geschrieben", async () => {
    const stand = mappe();
    const { fenster } = await starte(EXCEL_MAC, { excel: stand });
    await fenster.summeVorbereiten();
    zellen(stand).B3 = { wert: 99, formel: null };
    await fenster.ausfuehren();
    expect(zellen(stand).B5).toBeUndefined();
    expect(textVon("rueckgabe-meldung")).toContain("haben sich seitdem geändert");
  });

  it("geschütztes Blatt: Klara hebt keinen Schutz auf und schreibt nicht", async () => {
    const stand = mappe();
    const { fenster } = await starte(EXCEL_MAC, { excel: stand });
    await fenster.summeVorbereiten();
    const blatt = stand.blaetter.Tabelle1;
    if (blatt) {
      blatt.geschuetzt = true;
    }
    await fenster.ausfuehren();
    expect(zellen(stand).B5).toBeUndefined();
    expect(textVon("rueckgabe-meldung")).toContain("Das Blatt ist geschützt");
  });

  it("belegte Zielzelle wird ohne ausdrückliche Bestätigung nicht überschrieben", async () => {
    const stand = mappe();
    zellen(stand).B5 = { wert: "Notiz (fiktiv)", formel: null };
    const { fenster } = await starte(EXCEL_MAC, { excel: stand });
    await fenster.summeVorbereiten();
    expect(textVon("plan-satz")).toContain("nicht leer");
    await fenster.ausfuehren();
    expect(zellen(stand).B5).toEqual({ wert: "Notiz (fiktiv)", formel: null });
    expect(textVon("rueckgabe-meldung")).toContain("Zielzelle ist nicht leer");
  });

  it("Blattwechsel, Dokumentwechsel und Auswahländerung verhindern das Schreiben", async () => {
    const stand = mappe();
    const { fenster, office } = await starte(EXCEL_MAC, { excel: stand });
    await fenster.summeVorbereiten();
    stand.aktiv = "Tabelle2";
    await fenster.ausfuehren();
    expect(textVon("rueckgabe-meldung")).toContain("anderes Blatt");
    expect(Object.keys(zellen(stand, "Tabelle2"))).toEqual([]);

    stand.aktiv = "Tabelle1";
    await fenster.kontextLesen();
    await fenster.summeVorbereiten();
    office.context.document.url = "https://fiktiv-my.sharepoint.com/Andere-fiktiv.xlsx";
    await fenster.ausfuehren();
    expect(textVon("rueckgabe-meldung")).toContain("anderes Dokument");
    expect(zellen(stand).B5).toBeUndefined();

    office.context.document.url = URL_MAPPE;
    await fenster.summeVorbereiten();
    fenster.auswahlGeaendert();
    expect(knoten("plan").hidden).toBe(true);
    expect(textVon("rueckgabe-meldung")).toContain("verworfen");
    await fenster.ausfuehren();
    expect(zellen(stand).B5).toBeUndefined();
    // Die Auswahländerung liest nach kurzer Ruhe neu — abwarten, bevor die Bühne abgebaut wird.
    await new Promise((r) => setTimeout(r, 450));
    await warte();
    expect(textVon("kontext-zeile")).toBe("Excel · Haushalt-fiktiv.xlsx · Tabelle1 · B2:B4");
  });

  it("nur lesbar geöffnete Datei: nichts wird geschrieben", async () => {
    const stand = mappe();
    const { fenster } = await starte({ ...EXCEL_MAC, modus: "readOnly" }, { excel: stand });
    await fenster.summeVorbereiten();
    await fenster.ausfuehren();
    expect(zellen(stand).B5).toBeUndefined();
    expect(textVon("rueckgabe-meldung")).toContain("nur zum Lesen geöffnet");
  });
});

describe("KO-04-03 · Antwort als Text in eine Zelle — bleibt Text", () => {
  it("schreibt die Antwort in die gewählte Zelle; ein führendes = wird keine Formel", async () => {
    const stand = mappe();
    const formelAntwort = "=1+1 ist keine Rechnung, sondern Text (fiktiv)";
    const regel = (a: Abruf) =>
      a.url === "/api/klara/sessions/s-1/execute"
        ? { status: 200, body: { result: { answer: formelAntwort, sources: ["ko-1"] } } }
        : undefined;
    const { fenster } = await starte(EXCEL_MAC, { excel: stand }, [regel]);
    knoten("frage-text").value = "Was steht hier?";
    await fenster.fragen();
    knoten("ziel-zelle").value = "D2";
    await fenster.zelltextVorbereiten();
    expect(textVon("plan-satz")).toContain("Ziel: Tabelle1!D2");
    await fenster.ausfuehren();
    expect(zellen(stand).D2).toEqual({ wert: formelAntwort, formel: null });
    expect(textVon("rueckgabe-meldung")).toContain("Antwort als Text in Tabelle1!D2");
  });

  it("ohne Antwort oder mit ungültigem Ziel wird nichts vorbereitet", async () => {
    const { fenster } = await starte(EXCEL_MAC, { excel: mappe() });
    await fenster.zelltextVorbereiten();
    expect(textVon("rueckgabe-meldung")).toContain("Erst fragen");
    knoten("frage-text").value = "Frage";
    await fenster.fragen();
    knoten("ziel-zelle").value = "D2:D3";
    await fenster.zelltextVorbereiten();
    expect(knoten("plan").hidden).toBe(true);
    expect(textVon("rueckgabe-meldung")).toContain("keine einzelne Zelle");
  });
});

describe("R-0187 · package:excel · Auswahl als Wissens-Entwurf über den vorhandenen Weg", () => {
  it("legt einen Entwurf mit Herkunft, Tabelle und Formeln an — als ungeprüft benannt", async () => {
    const { fenster, abrufe } = await starte(EXCEL_MAC, { excel: mappe() });
    await fenster.entwurfSenden();
    const entwurf = abrufe.find((a) => a.url === "/api/drafts");
    const gesendet = koerper(entwurf);
    expect(entwurf?.method).toBe("POST");
    expect(gesendet.title).toBe("Tabelle aus Excel: Haushalt-fiktiv.xlsx · Tabelle1!B2:B4");
    expect(String(gesendet.bodyHtml)).toContain("Herkunft: Excel-Arbeitsmappe");
    expect(String(gesendet.bodyHtml)).toContain("<td>1.200 €</td>");
    expect(String(gesendet.bodyHtml)).toContain("Formeln: B4: =20*2");
    expect(textVon("rueckgabe-meldung")).toContain("noch keine geprüfte Quelle");
  });
});
