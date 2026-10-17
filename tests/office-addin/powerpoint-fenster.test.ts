// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:excel-erster-weg · DAS AUSGELIEFERTE FENSTER IN POWERPOINT (ATTRAPPE)
// ================================================================================================
//
// Dieselbe Bühne wie für Excel (`buehne.ts`), hier mit einer PowerPoint-Attrappe nach dem Vertrag
// der Office-JS-API. Belegt: Präsentation, Folie, Form und Text lesen; Lese-/Präsentationsansicht
// und nicht erreichbare Auswahl mit Ausweg (KO-04-04); Frage und gezielte Textrückgabe mit Prüfung
// von Ziel, Position und Ergebnis, ohne dass eine Form oder Figur entsteht (KO-04-05); Schutz vor
// falschen Zielen und die Kontextzeile beim Hostwechsel (KO-04-06).
// NICHT belegt: der echte Lauf in PowerPoint für Mac und im Web (KO-04-07) — er bleibt offen.
import { afterEach, describe, expect, it } from "vitest";
import {
  ANTWORT,
  type Abruf,
  type OfficeOptionen,
  type PptForm,
  type PptStand,
  type Regelantwort,
  abbauen,
  figurKontext,
  knoten,
  starte,
  textVon,
  warte,
} from "./buehne";

const URL_PRAESENTATION = "https://fiktiv-my.sharepoint.com/personal/test/Quartal-fiktiv.pptx";

const PPT_WEB: OfficeOptionen = {
  host: "PowerPoint",
  plattform: "OfficeOnline",
  version: "16.0.18000.10000",
  url: URL_PRAESENTATION,
  stufen: { PowerPointApi: ["1.1", "1.2", "1.4", "1.5"] },
};

function form(id: string, name: string, type: string, text: string, top: number): PptForm {
  return { id, name, type, text, left: 40, top, width: 600, height: 80 };
}

function praesentation(auswahlFormen: string[] = ["11"]): PptStand {
  return {
    folien: [
      {
        id: "256#",
        formen: [
          form("10", "Titel 1", "Placeholder", "Quartalsbericht (fiktiv)", 30),
          form("11", "Textfeld 2", "TextBox", "Umsatz Q3: 1,2 Mio. € (fiktiv)", 120),
          form("12", "Bild 3", "Image", "", 240),
        ],
      },
      { id: "257#", formen: [form("20", "Titel 1", "Placeholder", "Ausblick (fiktiv)", 30)] },
    ],
    auswahlFolien: ["256#"],
    auswahlFormen,
    ansicht: "edit",
    syncs: 0,
  };
}

function formVon(stand: PptStand, id: string): PptForm | undefined {
  return stand.folien.flatMap((s) => s.formen).find((f) => f.id === id);
}

function formenJeFolie(stand: PptStand): string[][] {
  return stand.folien.map((s) => s.formen.map((f) => `${f.id}:${f.type}`));
}

afterEach(() => {
  abbauen();
});

describe("KO-04-04 · PowerPoint liefert Präsentation, Folie und Textfeld", () => {
  it("nennt Host, Plattform, Version und liest das markierte Textfeld", async () => {
    await starte(PPT_WEB, { powerpoint: praesentation() });
    expect(textVon("host-zeile")).toBe("PowerPoint · Web 16.0.18000.10000");
    expect(textVon("api-zeile")).toBe("PowerPointApi: bestätigt bis 1.5");
    const zeile = textVon("kontext-zeile");
    expect(zeile).toBe("PowerPoint · Quartal-fiktiv.pptx · Folie 1 · Textfeld 2");
    expect(textVon("kontext-text")).toContain("Form „Textfeld 2“ (TextBox): Umsatz Q3");
    expect(textVon("kontext-zustand")).toBe("Ein Textfeld markiert.");
  });

  it("nur eine Folie markiert: Klara liest ihre Textfelder, Bilder nicht", async () => {
    await starte(PPT_WEB, { powerpoint: praesentation([]) });
    const kontext = textVon("kontext-text");
    expect(kontext).toContain("Form „Titel 1“ (Placeholder): Quartalsbericht (fiktiv)");
    expect(kontext).toContain("Form „Textfeld 2“ (TextBox)");
    expect(kontext).not.toContain("Bild 3");
    expect(textVon("kontext-zustand")).toContain("Folie markiert");
  });

  it("Lese-/Präsentationsansicht: konkreter Ausweg, keine Rückgabe", async () => {
    const stand = praesentation();
    const lesen: OfficeOptionen = { ...PPT_WEB, ansicht: () => "read" };
    const { fenster } = await starte(lesen, { powerpoint: stand });
    expect(textVon("kontext-ausweg")).toContain("Ansicht › Normal");
    knoten("frage-text").value = "Was steht auf der Folie?";
    await fenster.fragen();
    expect(knoten("formtext-vorbereiten").disabled).toBe(true);
    await fenster.formtextVorbereiten();
    expect(knoten("plan").hidden).toBe(true);
  });

  it("Bild markiert: Klara ändert es nicht und sagt, was stattdessen geht", async () => {
    await starte(PPT_WEB, { powerpoint: praesentation(["12"]) });
    const ausweg = textVon("kontext-ausweg");
    expect(ausweg).toContain("Bilder, Diagramme und Grafiken ändert Klara nicht");
    expect(knoten("formtext-vorbereiten").disabled).toBe(true);
  });

  it("ohne PowerPointApi 1.5: markierter Text über die gemeinsame API, ohne Rückgabe", async () => {
    const alt = {
      ...PPT_WEB,
      stufen: { PowerPointApi: ["1.1", "1.2", "1.4"] },
      textAuswahl: "Umsatz Q3 (fiktiv)",
    };
    await starte(alt, { powerpoint: praesentation() });
    expect(textVon("api-fehlt")).toContain("auswahl (PowerPointApi 1.5)");
    expect(textVon("kontext-text")).toContain("Markierter Text: Umsatz Q3 (fiktiv)");
    expect(textVon("kontext-ausweg")).toContain("nicht gezielt zurückschreiben");
  });
});

describe("KO-04-05 · Frage und gezielte Textrückgabe in das markierte Textfeld", () => {
  it("prüft Ziel, Position und Ergebnis; legt keine Form an; nimmt zurück", async () => {
    const stand = praesentation();
    const vorher = formenJeFolie(stand);
    const { fenster, abrufe } = await starte(PPT_WEB, { powerpoint: stand });
    knoten("frage-text").value = "Was ist die wichtigste Aussage der Folie?";
    await fenster.fragen();
    const frage = abrufe.find((a) => a.url === "/api/klara/sessions/s-1/execute");
    const gesendet = JSON.parse(frage?.body ?? "{}") as { selection?: string };
    expect(gesendet.selection).toContain("Präsentation: Quartal-fiktiv.pptx");
    expect(knoten("formtext-vorbereiten").disabled).toBe(false);
    await fenster.formtextVorbereiten();
    expect(textVon("plan-satz")).toContain("Ziel: Folie 1 · Textfeld „Textfeld 2“");
    expect(formVon(stand, "11")?.text).toBe("Umsatz Q3: 1,2 Mio. € (fiktiv)");
    // Ben-Befund C: der zweite Klick ist sofort bedienbar — gemessen am echten Knopf.
    expect(knoten("plan-ausfuehren").disabled).toBe(false);
    knoten("plan-ausfuehren").click();
    await warte();
    expect(formVon(stand, "11")?.text).toBe(ANTWORT);
    expect(formVon(stand, "10")?.text).toBe("Quartalsbericht (fiktiv)");
    expect(formVon(stand, "20")?.text).toBe("Ausblick (fiktiv)");
    expect(formenJeFolie(stand)).toEqual(vorher);
    const meldung = textVon("rueckgabe-meldung");
    expect(meldung).toContain("Geschrieben in Folie 1, Textfeld „Textfeld 2“");
    expect(meldung).toContain("Position unverändert");
    await fenster.zuruecknehmen();
    expect(formVon(stand, "11")?.text).toBe("Umsatz Q3: 1,2 Mio. € (fiktiv)");
    expect(textVon("rueckgabe-meldung")).toContain("Zurückgenommen");
  });

  it("ändert ein Koautor das Textfeld nach dem Vorbereiten, bleibt sein Text stehen", async () => {
    const stand = praesentation();
    const { fenster } = await starte(PPT_WEB, { powerpoint: stand });
    knoten("frage-text").value = "Frage";
    await fenster.fragen();
    await fenster.formtextVorbereiten();
    const ziel = formVon(stand, "11");
    if (ziel) {
      ziel.text = "Koautor (fiktiv)";
    }
    await fenster.ausfuehren();
    expect(formVon(stand, "11")?.text).toBe("Koautor (fiktiv)");
    const meldung = textVon("rueckgabe-meldung");
    expect(meldung).toContain("Das Ziel hat sich seit der Vorbereitung geändert");
  });

  it("gelöschte Form und Wechsel in die Leseansicht verhindern das Schreiben", async () => {
    const stand = praesentation();
    let ansicht: "edit" | "read" = "edit";
    const optionen: OfficeOptionen = { ...PPT_WEB, ansicht: () => ansicht };
    const { fenster } = await starte(optionen, { powerpoint: stand });
    knoten("frage-text").value = "Frage";
    await fenster.fragen();
    await fenster.formtextVorbereiten();
    ansicht = "read";
    await fenster.ausfuehren();
    expect(textVon("rueckgabe-meldung")).toContain("Leseansicht");
    expect(formVon(stand, "11")?.text).toBe("Umsatz Q3: 1,2 Mio. € (fiktiv)");

    ansicht = "edit";
    await fenster.kontextLesen();
    await fenster.formtextVorbereiten();
    const folie = stand.folien[0];
    if (folie) {
      folie.formen = folie.formen.filter((f) => f.id !== "11");
    }
    await fenster.ausfuehren();
    expect(textVon("rueckgabe-meldung")).toContain("Die Form gibt es nicht mehr");
  });
});

describe("Ben-Befund · Antwort und Ziel bleiben an Auswahl, Inhalt und Position gebunden", () => {
  it("eine Antwort zu Textfeld A wird nach dem Wechsel zu Textfeld B nicht zurückgegeben", async () => {
    const stand = praesentation(["11"]);
    const { fenster } = await starte(PPT_WEB, { powerpoint: stand });
    knoten("frage-text").value = "Was steht in Textfeld A?";
    await fenster.fragen();
    expect(knoten("formtext-vorbereiten").disabled).toBe(false);
    stand.auswahlFormen = ["10"];
    fenster.auswahlGeaendert();
    expect(knoten("formtext-vorbereiten").disabled).toBe(true);
    await new Promise((r) => setTimeout(r, 450));
    await warte();
    expect(textVon("kontext-zeile")).toContain("Titel 1");
    expect(knoten("formtext-vorbereiten").disabled).toBe(true);
    expect(textVon("frage-meldung")).toContain("gehört zur vorherigen Auswahl");
    await fenster.formtextVorbereiten();
    expect(knoten("plan").hidden).toBe(true);
    expect(textVon("rueckgabe-meldung")).toContain("früheren Auswahl");
    await fenster.ausfuehren();
    expect(formVon(stand, "10")?.text).toBe("Quartalsbericht (fiktiv)");
    expect(formVon(stand, "11")?.text).toBe("Umsatz Q3: 1,2 Mio. € (fiktiv)");
  });

  it("eine verspätete Antwort nach Auswahlwechsel wird angezeigt, aber für Rückgaben gesperrt", async () => {
    const stand = praesentation(["11"]);
    let freigeben: (wert?: unknown) => void = () => {};
    const tor = new Promise((r) => {
      freigeben = r;
    });
    const spaet = (a: Abruf): Regelantwort | undefined =>
      a.url === "/api/klara/sessions/s-1/execute"
        ? { status: 200, body: { result: { answer: ANTWORT, sources: ["ko-1"] } }, warten: tor }
        : undefined;
    const { fenster } = await starte(PPT_WEB, { powerpoint: stand }, [spaet]);
    knoten("frage-text").value = "Was steht in Textfeld A?";
    const lauf = fenster.fragen();
    stand.auswahlFormen = ["10"];
    await fenster.kontextLesen();
    freigeben();
    await lauf;
    expect(textVon("antwort-text")).toBe(ANTWORT);
    expect(textVon("frage-meldung")).toContain("nach einem Auswahlwechsel");
    expect(knoten("formtext-vorbereiten").disabled).toBe(true);
    await fenster.formtextVorbereiten();
    expect(knoten("plan").hidden).toBe(true);
    expect(formVon(stand, "10")?.text).toBe("Quartalsbericht (fiktiv)");
  });

  it("eine nach der Vorbereitung verschobene Form wird nicht überschrieben", async () => {
    const stand = praesentation();
    const { fenster } = await starte(PPT_WEB, { powerpoint: stand });
    knoten("frage-text").value = "Frage";
    await fenster.fragen();
    await fenster.formtextVorbereiten();
    const ziel = formVon(stand, "11");
    if (ziel) {
      ziel.left = 200;
    }
    await fenster.ausfuehren();
    expect(formVon(stand, "11")?.text).toBe("Umsatz Q3: 1,2 Mio. € (fiktiv)");
    expect(textVon("rueckgabe-meldung")).toContain("verschoben oder in der Größe geändert");
    expect(knoten("ruecknahme").hidden).toBe(true);
  });
});

describe("KO-04-06 · die Begleitfigur zeigt beim Hostwechsel den tatsächlichen Kontext", () => {
  it("Excel, dann PowerPoint: Kontextzeile und Host der Figur folgen dem Host", async () => {
    const excel = {
      mappe: "Haushalt-fiktiv.xlsx",
      aktiv: "Tabelle1",
      auswahl: ["B2"],
      syncs: 0,
      blaetter: { Tabelle1: { geschuetzt: false, zellen: { B2: { wert: 1, formel: null } } } },
    };
    const excelOptionen: OfficeOptionen = {
      host: "Excel",
      plattform: "Mac",
      version: "16.89",
      url: "https://fiktiv-my.sharepoint.com/Haushalt-fiktiv.xlsx",
      stufen: { ExcelApi: ["1.1", "1.2", "1.7", "1.9"] },
    };
    await starte(excelOptionen, { excel });
    expect(figurKontext()).toMatchObject({ host: "excel" });
    expect(textVon("kontext-zeile")).toBe("Excel · Haushalt-fiktiv.xlsx · Tabelle1 · B2");
    abbauen();

    await starte(PPT_WEB, { powerpoint: praesentation() });
    expect(figurKontext()).toMatchObject({
      host: "powerpoint",
      zeile: "PowerPoint · Quartal-fiktiv.pptx · Folie 1 · Textfeld 2",
    });
    expect(knoten("klara-figur").getAttribute("data-host")).toBe("powerpoint");
  });
});
