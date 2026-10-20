// @vitest-environment jsdom
// ================================================================================================
// PP-02 · HERKUNFT AN DER ZAHL IM POWERPOINT-FENSTER (produkt:20261015:klara-powerpoint-datenherkunft)
// ================================================================================================
//
// Das ausgelieferte Fenster aus A01 (`taskpane.html`, `hostkern.js`, `taskpane.js`) samt
// `folien-herkunft.js` auf der Bühne (`buehne.ts`), PowerPoint als Attrappe nach dem Vertrag der
// Office-JS-API. Die Antworten des Servers sind ECHT: für genau die Bytes, die die Attrappe als
// geöffnete Datei liefert, vorab über die echte Route `folien-abgleich` (pp02-hostwelt.ts) erzeugt;
// das Fenster muss genau diese Bytes senden, sonst bricht der Test.
//
//   P1  verbinden, abgleichen, Form markieren → die Zahl an der Form; Herkunft mit Rechenweg und
//       allen verwendeten Eingaben bis zur Quellzelle; Zurück und Schließen.
//   P2  manuell, OCR und berechnet sind an der Zahl und in der Herkunft unterscheidbar.
//   P3  Office-Kennungen anders als in der Datei: Zuordnung über den Namen, im Fenster benannt.
//   P4  bearbeitete Datei: neue Folie vorn, geänderte Zahl, gelöschtes Feld — Befund je Zahl.
//   P5  Grenzen: ohne Anmeldung, ohne PowerPointApi 1.5, in Excel; nichts wird ins Dokument geschrieben.
//   Unabhängige Prüfung 0001–0006 (18.10.2026):
//   P7  (B2) ein Name trägt nur, wenn er in PowerPoint UND in der Datei eindeutig ist — eine leere
//       Kopie mit gleichem Namen erbt die Zahl nicht.
//   P8  (P1, B9) die Folie gilt über ihre Stelle, gegengeprüft an der Kennung „<p:sldId>#…“; weicht
//       sie ab, wird nichts zugeordnet. Der Satz im Fenster nennt die Regel, die galt.
//   P9  (B6) kein Anhangwechsel während des Abgleichs; eine veraltete Antwort wird verworfen.
//   P10 (B8) der Fokus folgt der Herkunft und kehrt beim Schließen an die Zahl zurück.
//   P11 (B5) die Frist des Abgleichs wächst mit der Datei; ein Abbruch ist ein deutscher Satz.
//   Nachprüfung 0007 (18.10.2026):
//   P8  (N5) „uneins“ nur, wenn die Office-Kennung die p:sldId einer ANDEREN Folie der Datei nennt;
//       eine unbekannte Zahl oder ein anderes Format: Zuordnung nach Position, und der Satz sagt es.
//   P12 (N6) der Fokus geht beim Schließen an den tatsächlich geklickten Knopf — auch wenn derselbe
//       Datenpunkt mehrfach in der Liste steht und die Liste inzwischen neu gezeichnet wurde.
//
// NICHT belegt: PowerPoint für Mac und im Web selbst — ob dort `getFileAsync` und die Auswahl so
// antworten, zeigt erst der Hostlauf (Prüfoperatoren H01/H02).
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type Bestand,
  type Koerper,
  PPTX,
  type Welt,
  abgleichPfad,
  baueWelt,
  bestandAnlegen,
  deck,
  rufe,
} from "../klara-powerpoint/pp02-hostwelt";
import {
  type Abruf,
  type Antwortregel,
  type Buehne,
  type Knoten,
  type OfficeOptionen,
  type PptForm,
  type PptStand,
  type Regelantwort,
  abbauen,
  alleKnoten,
  folienHerkunft,
  knoten,
  starte,
  textVon,
  warte,
} from "./buehne";

const URL_PRAESENTATION = "https://fiktiv-my.sharepoint.com/personal/test/Quartal-fiktiv.pptx";

const PPT_MAC: OfficeOptionen = {
  host: "PowerPoint",
  plattform: "Mac",
  version: "16.111",
  url: URL_PRAESENTATION,
  stufen: { PowerPointApi: ["1.1", "1.2", "1.3", "1.4", "1.5"] },
};

function form(id: string, name: string, type: string, text = ""): PptForm {
  return { id, name, type, text, left: 40, top: 40, width: 400, height: 60 };
}

/** Die Formen, wie PowerPoint sie meldet; `kennung` macht aus der Datei-Kennung die Office-Kennung. */
function stand(
  auswahlFormen: string[],
  kennung: (cNvPr: string) => string = (k) => k,
  bearbeitet = false,
): PptStand {
  const folie256 = [
    form(kennung("2"), "Titel 1", "Placeholder", "Ergebnis Q4 2025"),
    form(kennung("4"), "Tabelle Kennzahlen", "Table"),
    form(kennung("6"), "Ergebnis", "TextBox", "Ergebnis Q4: 300 T€"),
    ...(bearbeitet ? [] : [form(kennung("7"), "Marktanteil", "TextBox", "Marktanteil: 12 %")]),
    form(kennung("8"), "Grafik Belegschaft", "Image"),
  ];
  return {
    folien: [
      // Die neue Folie trägt in der Datei `p:sldId` 258 (pp02-hostwelt.ts) — PowerPoint nennt sie „258#“.
      ...(bearbeitet
        ? [{ id: "258#", formen: [form("2", "Titel 1", "Placeholder", "Agenda (neu)")] }]
        : []),
      { id: "256#", formen: folie256 },
      {
        id: "257#",
        formen: [
          form(kennung("2"), "Titel 1", "Placeholder", "Ausblick"),
          form(kennung("6"), "Ergebnis", "TextBox", "Ergebnis 2026: 320 T€"),
        ],
      },
    ],
    auswahlFolien: ["256#"],
    auswahlFormen,
    ansicht: "edit",
    syncs: 0,
  };
}

let w: Welt;
let s: Bestand;
let original: Buffer;
let bearbeitet: Buffer;
const antworten = new Map<string, Koerper>();

beforeAll(async () => {
  w = await baueWelt();
  s = await bestandAnlegen(w);
  original = await deck();
  bearbeitet = await deck({ kostenQ4: "1.250 T€", neueFolieVorn: true, ohneMarktanteil: true });
  for (const bytes of [original, bearbeitet]) {
    const r = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: bytes.toString("base64") });
    expect(r.status).toBe(200);
    antworten.set(bytes.toString("base64"), r.body);
  }
});

afterEach(() => {
  abbauen();
});

/** Der Server: der Artikel mit seinen Anhängen und der Abgleich genau der gesendeten Bytes. */
const SERVER: Antwortregel = (a) => {
  if (a.method === "GET" && a.url === `/api/kos/${s.koId}`) {
    return {
      status: 200,
      body: {
        id: s.koId,
        title: "Quartalsbericht Q4 2025 (fiktiv)",
        attachments: [
          { id: "notiz", name: "Notiz-fiktiv.docx", mime: "application/msword" },
          { id: s.anhangId, name: "Quartal-fiktiv.pptx", mime: PPTX },
        ],
      },
    };
  }
  if (a.method === "POST" && a.url === abgleichPfad(s)) {
    const gesendet = JSON.parse(a.body ?? "{}").datei as string;
    const echt = antworten.get(gesendet);
    return echt
      ? { status: 200, body: echt }
      : { status: 400, body: { message: "unbekannte Bytes" } };
  }
  return undefined;
};

function herkunftAbrufe(b: Buehne): Abruf[] {
  return b.abrufe.filter((a) => a.url.startsWith("/api/kos/"));
}

async function verbundenUndAbgeglichen(
  datei: Buffer,
  ppt: PptStand,
  optionen: OfficeOptionen = PPT_MAC,
  regeln: Antwortregel[] = [],
): Promise<Buehne> {
  const b = await starte({ ...optionen, datei }, { powerpoint: ppt }, [...regeln, SERVER]);
  expect(knoten("herkunft-block").hidden).toBe(false);
  knoten("herkunft-artikel").value = `https://klarwerk.ai/wissen/${s.koId}?tab=anhaenge`;
  knoten("herkunft-verbinden").click();
  await warte();
  knoten("herkunft-abgleichen").click();
  await warte();
  return b;
}

function zahlKnoepfe(): Knoten[] {
  return alleKnoten("#herkunft-liste button.zahl");
}

async function markiere(b: Buehne, ppt: PptStand, formen: string[]): Promise<void> {
  ppt.auswahlFormen = formen;
  b.fenster.auswahlGeaendert();
  await new Promise((r) => setTimeout(r, 450));
  await warte();
}

describe("P1 · Herkunft direkt an der Zahl in PowerPoint", () => {
  it("verbinden, abgleichen, Form markieren, Herkunft samt aller Eingaben öffnen", async () => {
    const ppt = stand(["6"]);
    const b = await verbundenUndAbgeglichen(original, ppt);
    // Nur der .pptx-Anhang steht zur Wahl.
    expect(alleKnoten("#herkunft-anhang option").map((o) => o.textContent)).toEqual([
      "Quartal-fiktiv.pptx",
    ]);
    // Das Fenster hat genau die geöffnete Datei gesendet und sie danach geschlossen.
    const post = b.abrufe.find((a) => a.method === "POST" && a.url === abgleichPfad(s));
    expect(JSON.parse(post?.body ?? "{}").datei).toBe(original.toString("base64"));
    expect(b.datei).toEqual({ geoeffnet: 1, geschlossen: 1, scheibe: 1 });
    // Hostlauf H01: die Zeile sagt nach dem Abgleich, dass abgeglichen ist.
    expect(textVon("herkunft-zeile")).toMatch(
      /Anhang „Quartal-fiktiv\.pptx“\. Abgeglichen um \d\d:\d\d\.$/,
    );
    expect(textVon("herkunft-abgleich")).toBe(
      "Die geöffnete Datei ist dieselbe Fassung wie der Anhang. 2 Folien zugeordnet über ihre Stelle in der Datei, jede bestätigt durch ihre Kennung (p:sldId). Formen: 7 über Kennung und Name, 0 über den Namen, 0 ohne lesbares Element.",
    );

    const knoepfe = zahlKnoepfe();
    expect(knoepfe.map((k) => k.textContent?.split(" · ").slice(0, 2).join(" · "))).toEqual([
      "300 T€ · berechnet",
    ]);
    expect(knoepfe[0]?.getAttribute("aria-label")).toContain("am Element „Ergebnis“");
    knoepfe[0]?.click();
    const detail = () => textVon("herkunft-detail-inhalt");
    expect(knoten("herkunft-detail").hidden).toBe(false);
    expect(detail()).toContain("Erfasst alsberechnet");
    expect(detail()).toContain(
      "Differenz: 1.500 T€ − 1.200 T€ = 300 (gerundet auf 0 Nachkommastellen)",
    );
    expect(detail()).toContain(
      "In dieser PräsentationIn dieser Präsentation steht der Wert an seinem Element.",
    );
    const eingaben = alleKnoten("#herkunft-detail-inhalt [data-eingabe]");
    expect(eingaben.map((e) => e.textContent)).toEqual([
      "Eingabe 1: 1.500 T€ (Fassung 1, direkt)",
      "Eingabe 2: 1.200 T€ (Fassung 1, direkt)",
    ]);
    // Die Eingabe führt zur richtigen Quelle: Tabellenzelle der Quellfassung des Anhangs.
    eingaben[0]?.click();
    expect(detail()).toContain(
      "Folie 1 „Ergebnis Q4 2025“ · Tabelle Kennzahlen · Zeile 2 („Umsatz“), Spalte 3 („Q4“): „1.500 T€“",
    );
    expect(detail()).toContain("„Quartalsbericht Q4 2025 (fiktiv)“, Fassung");
    expect(detail()).toContain("Anhang „Quartal-fiktiv.pptx“");
    expect(knoten("herkunft-zurueck").hidden).toBe(false);
    knoten("herkunft-zurueck").click();
    expect(detail()).toContain("Differenz: 1.500 T€ − 1.200 T€");
    expect(knoten("herkunft-link").getAttribute("href")).toBe(`/wissen/${s.koId}`);
    knoten("herkunft-schliessen").click();
    expect(knoten("herkunft-detail").hidden).toBe(true);

    // Dieselbe Elementkennung 6 auf Folie 257 trägt keine Zahl: die Folie zählt mit (p:sldId).
    ppt.auswahlFolien = ["257#"];
    await markiere(b, ppt, ["6"]);
    expect(zahlKnoepfe()).toEqual([]);
    expect(textVon("herkunft-leer")).toBe("An der markierten Form hängt keine gebundene Zahl.");
  });
});

describe("P2 · manuell, OCR und berechnet sind unterscheidbar", () => {
  it("an der Zahl und in der Herkunft", async () => {
    const ppt = stand(["7"]);
    const b = await verbundenUndAbgeglichen(original, ppt);
    const manuell = zahlKnoepfe();
    expect(manuell.map((k) => k.getAttribute("data-erfassung"))).toEqual(["manuell"]);
    expect(manuell[0]?.textContent).toMatch(/^12 % · manuell · /);
    manuell[0]?.click();
    expect(textVon("herkunft-detail-inhalt")).toContain("Erfasst alsmanuell eingegeben");
    expect(textVon("herkunft-detail-inhalt")).toContain(
      "FundstelleEingabe, gestützt auf: Mündliche Auskunft Vertrieb (fiktiv)",
    );
    expect(textVon("herkunft-detail-inhalt")).toContain("Quellekeine eigene Quelle");
    expect(knoten("herkunft-detail").hidden).toBe(false);

    await markiere(b, ppt, ["8"]);
    // Hostlauf H01: eine andere Auswahl schließt die Herkunft der vorher geöffneten Zahl.
    expect(knoten("herkunft-detail").hidden).toBe(true);
    const ocr = zahlKnoepfe();
    expect(ocr.map((k) => k.getAttribute("data-erfassung"))).toEqual(["ocr"]);
    expect(ocr[0]?.textContent).toMatch(/^85 · OCR · /);
    ocr[0]?.click();
    const d = textVon("herkunft-detail-inhalt");
    expect(d).toContain("Erfasst alsper Texterkennung (OCR) aus einem Bild gelesen");
    expect(d).toContain("Bild „Grafik Belegschaft“ · erkannter Text:");
    expect(d).toContain("die Erkennung meldete unsichere Stellen");
    // Erkennung validiert nicht: der Prüfstand ist nicht „validiert“.
    expect(d).not.toContain("Prüfstandvalidiert");

    await markiere(b, ppt, ["4"]);
    expect(
      zahlKnoepfe().map((k) => [k.textContent?.split(" · ")[0], k.getAttribute("data-erfassung")]),
    ).toEqual([
      ["1.500 T€", "direkt"],
      ["1.200 T€", "direkt"],
    ]);
  });
});

describe("P3 · Office-Kennungen anders als in der Datei", () => {
  it("ordnet über den Namen zu und sagt es", async () => {
    const ppt = stand(["{G-6}"], (k) => `{G-${k}}`);
    await verbundenUndAbgeglichen(original, ppt);
    expect(textVon("herkunft-abgleich")).toContain(
      "Formen: 0 über Kennung und Name, 7 über den Namen, 0 ohne lesbares Element.",
    );
    expect(zahlKnoepfe().map((k) => k.textContent?.split(" · ")[0])).toEqual(["300 T€"]);
  });

  it("eine zufällig gleiche Kennung an einer anderen Form gilt nicht: Kennung UND Name", async () => {
    // Office nennt „Ergebnis“ 7 und „Marktanteil“ 6 — in der Datei ist es umgekehrt (auf Folie 256;
    // auf Folie 257 hat „Ergebnis“ dann 7, das es dort nicht gibt).
    const tausch: Record<string, string> = { "6": "7", "7": "6" };
    const ppt = stand(["7"], (k) => tausch[k] ?? k);
    await verbundenUndAbgeglichen(original, ppt);
    expect(textVon("herkunft-abgleich")).toContain(
      "Formen: 4 über Kennung und Name, 3 über den Namen, 0 ohne lesbares Element.",
    );
    expect(zahlKnoepfe().map((k) => k.textContent?.split(" · ").slice(0, 2).join(" · "))).toEqual([
      "300 T€ · berechnet",
    ]);
  });
});

describe("P4 · bearbeitete Präsentation geöffnet", () => {
  it("neue Folie vorn, geänderte Zahl, gelöschtes Feld: Befund je Zahl", async () => {
    const ppt = stand(["4"], undefined, true);
    const b = await verbundenUndAbgeglichen(bearbeitet, ppt);
    expect(textVon("herkunft-abgleich")).toContain(
      "Die geöffnete Datei ist nicht bytegleich mit dem Anhang (PowerPoint gibt sie neu gespeichert heraus); jede Zahl nennt ihren Befund in dieser Datei. 3 Folien",
    );
    const knoepfe = zahlKnoepfe();
    expect(knoepfe.map((k) => k.textContent?.split(" · ")[0])).toEqual(["1.500 T€", "1.200 T€"]);
    knoepfe[1]?.click();
    expect(textVon("herkunft-detail-inhalt")).toContain(
      "In dieser Präsentation steht dort heute: „1.250 T€“ – das weicht vom Datenpunkt ab.",
    );
    // Die Zahl der gelöschten Form ist an keiner Form mehr — sie erscheint nirgends als „passt“.
    await markiere(b, ppt, ["6"]);
    expect(zahlKnoepfe().map((k) => k.textContent?.split(" · ")[0])).toEqual(["300 T€"]);
  });
});

describe("P6 · Vorwärtsverträglich mit PP-03: an der Zahl gilt die Datenkontrolle", () => {
  it("trägt die Sicht `kontrolle`, nennt der Knopf deren Zustand statt des PP-02-Prüfstands", async () => {
    await starte({ ...PPT_MAC, datei: original }, { powerpoint: stand(["6"]) }, [SERVER]);
    const sicht = antworten.get(original.toString("base64")).datenpunkte[0];
    const regeln = folienHerkunft().regeln;
    expect(regeln.zahlKnopfText({ ...sicht, kontrolle: undefined })).toContain(" · in Prüfung");
    expect(
      regeln.zahlKnopfText({
        ...sicht,
        kontrolle: {
          zustand: "klaerung",
          zustandName: "Klärung nötig",
          grund: "fiktiv",
          dimensionen: [],
        },
      }),
    ).toMatch(/ · Klärung nötig$/);
  });
});

describe("P5 · Grenzen", () => {
  it("ohne Anmeldung kein Abruf", async () => {
    const abgemeldet: Antwortregel = (a) =>
      a.url === "/api/auth/me" ? { status: 401, body: {} } : undefined;
    const b = await starte({ ...PPT_MAC, datei: original }, { powerpoint: stand(["6"]) }, [
      abgemeldet,
      SERVER,
    ]);
    knoten("herkunft-artikel").value = s.koId;
    knoten("herkunft-verbinden").click();
    await warte();
    expect(textVon("herkunft-meldung")).toBe("Bitte zuerst oben bei KLARWERK anmelden.");
    expect(herkunftAbrufe(b)).toEqual([]);
  });

  it("ohne PowerPointApi 1.5 kein Abgleich, mit Begründung", async () => {
    const ohne15 = { ...PPT_MAC, stufen: { PowerPointApi: ["1.1", "1.2", "1.3", "1.4"] } };
    const b = await verbundenUndAbgeglichen(original, stand(["6"]), ohne15);
    expect(knoten("herkunft-abgleichen").disabled).toBe(true);
    await folienHerkunft().abgleichen();
    expect(textVon("herkunft-meldung")).toContain("PowerPointApi 1.5");
    expect(b.datei.geoeffnet).toBe(0);
  });

  it("in Excel bleibt der Bereich verborgen", async () => {
    await starte(
      {
        host: "Excel",
        plattform: "Mac",
        version: "16.111",
        url: "https://fiktiv/Haushalt-fiktiv.xlsx",
        stufen: { ExcelApi: ["1.1", "1.2", "1.7", "1.9"] },
      },
      {
        excel: {
          mappe: "Haushalt-fiktiv.xlsx",
          blaetter: { Tabelle1: { zellen: { A1: { wert: 1, formel: null } }, geschuetzt: false } },
          aktiv: "Tabelle1",
          auswahl: ["A1"],
          syncs: 0,
        },
      },
    );
    expect(knoten("herkunft-block").hidden).toBe(true);
  });

  it("nichts wird ins Dokument geschrieben", async () => {
    const ppt = stand(["6"]);
    const vorher = JSON.stringify(ppt.folien);
    const b = await verbundenUndAbgeglichen(original, ppt);
    zahlKnoepfe()[0]?.click();
    expect(JSON.stringify(ppt.folien)).toBe(vorher);
    expect(herkunftAbrufe(b).map((a) => `${a.method} ${a.url}`)).toEqual([
      `GET /api/kos/${s.koId}`,
      `POST ${abgleichPfad(s)}`,
    ]);
  });
});

// ---- Unabhängige Prüfung 0001–0006 (18.10.2026) --------------------------------------------------

interface Zuordnung {
  formen: Record<string, { shapeId: string; regel: string } | undefined>;
  befund: Record<string, unknown>;
}
const zuordnung = (officeFolien: unknown, geoeffnet: unknown): Zuordnung =>
  (
    folienHerkunft().regeln as unknown as {
      zuordnungBauen(o: unknown, g: unknown): Zuordnung;
    }
  ).zuordnungBauen(officeFolien, geoeffnet);

describe("P7 · gleichnamige Formen (Prüfbefund B2)", () => {
  it("eine leere Kopie mit demselben Namen erbt die Zahl nicht; ein eindeutiger Name trägt weiter", async () => {
    await starte({ ...PPT_MAC, datei: original }, { powerpoint: stand(["6"]) }, [SERVER]);
    const geoeffnet = {
      folien: [{ sldId: "256", position: 1, elemente: [{ shapeId: "3", name: "TextBox 3" }] }],
    };
    // Mac: die Kopie hat eine andere Kennung — früher griff der Name, und sie zeigte „passt“.
    const mac = zuordnung(
      [
        {
          id: "256#",
          formen: [
            { id: "3", name: "TextBox 3" },
            { id: "9", name: "TextBox 3" },
          ],
        },
      ],
      geoeffnet,
    );
    expect(mac.formen["256#|3"]).toMatchObject({ shapeId: "3", regel: "kennung" });
    expect(mac.formen["256#|9"]).toBeUndefined();
    expect(mac.befund).toMatchObject({ zustand: "ok", kennung: 1, name: 0, ohne: 1 });
    // Kennungen, die die Datei nicht kennt: ein doppelter Name ordnet nichts zu.
    const fremd = zuordnung(
      [
        {
          id: "256#",
          formen: [
            { id: "{A}", name: "TextBox 3" },
            { id: "{B}", name: "TextBox 3" },
          ],
        },
      ],
      geoeffnet,
    );
    expect(fremd.befund).toMatchObject({ kennung: 0, name: 0, ohne: 2 });
    // Eindeutig in PowerPoint und in der Datei: der Name trägt.
    const eindeutig = zuordnung(
      [{ id: "256#", formen: [{ id: "{A}", name: "TextBox 3" }] }],
      geoeffnet,
    );
    expect(eindeutig.formen["256#|{A}"]).toMatchObject({ shapeId: "3", regel: "name" });
  });
});

describe("P8 · Folienkennung gegengeprüft (Prüfbefunde P1, B9)", () => {
  it("abweichende Kennung an derselben Stelle: keine Zuordnung, der Satz nennt den Grund", async () => {
    const ppt = stand(["6"]);
    const [erste, zweite] = ppt.folien;
    ppt.folien = [zweite, erste].filter((f): f is PptStand["folien"][number] => !!f);
    await verbundenUndAbgeglichen(original, ppt);
    expect(textVon("herkunft-abgleich")).toBe(
      "An Stelle 1 zeigt PowerPoint die Folie mit der Kennung 257, die gelesene Datei die Folie 256. Ohne passende Folien wird keine Zahl zugeordnet – bitte kurz warten und neu abgleichen.",
    );
    expect(zahlKnoepfe()).toEqual([]);
  });

  it("ohne prüfbare Folienkennung: Zuordnung über die Stelle — und der Satz sagt genau das", async () => {
    const ppt = stand(["6"]);
    ppt.folien = ppt.folien.map((f, i) => ({ ...f, id: `{F${i}}` }));
    ppt.auswahlFolien = ["{F0}"];
    await verbundenUndAbgeglichen(original, ppt);
    expect(textVon("herkunft-abgleich")).toContain(
      "2 Folien zugeordnet nach Position (Kennung nicht vergleichbar). Formen: 7 über Kennung und Name",
    );
    expect(zahlKnoepfe().map((k) => k.textContent?.split(" · ")[0])).toEqual(["300 T€"]);
  });

  it("N5 · eine Zahl vor „#“, die die Datei nicht kennt, ist kein Fehlalarm — es gilt die Position", async () => {
    const ppt = stand(["6"]);
    ppt.folien = ppt.folien.map((f, i) => ({ ...f, id: `${i + 1}#4711${i}` }));
    ppt.auswahlFolien = ["1#47110"];
    await verbundenUndAbgeglichen(original, ppt);
    expect(textVon("herkunft-abgleich")).toContain(
      "2 Folien zugeordnet nach Position (Kennung nicht vergleichbar). Formen: 7 über Kennung und Name",
    );
    expect(zahlKnoepfe().map((k) => k.textContent?.split(" · ")[0])).toEqual(["300 T€"]);
    // Gemischt: eine Folie bestätigt, eine unbekannt — Zuordnung, und der Satz nennt beides.
    const geoeffnet = {
      folien: [
        { sldId: "256", position: 1, elemente: [] },
        { sldId: "257", position: 2, elemente: [] },
      ],
    };
    const gemischt = zuordnung(
      [
        { id: "256#", formen: [] },
        { id: "999#", formen: [] },
      ],
      geoeffnet,
    );
    expect(gemischt.befund).toMatchObject({ zustand: "ok", folienGeprueft: 1 });
    // Vertauscht (die Zahl nennt die ANDERE Folie der Datei): keine Zuordnung.
    const vertauscht = zuordnung(
      [
        { id: "257#", formen: [] },
        { id: "256#", formen: [] },
      ],
      geoeffnet,
    );
    expect(vertauscht.befund).toMatchObject({ zustand: "uneins", grund: "kennung", stelle: 1 });
  });
});

describe("P9 · Anhangwechsel während des Abgleichs (Prüfbefund B6)", () => {
  it("das Auswahlfeld ist gesperrt; eine veraltete Antwort wird verworfen", async () => {
    let freigeben: () => void = () => undefined;
    const halt = new Promise<void>((weiter) => {
      freigeben = weiter;
    });
    const langsam: Antwortregel = (a) => {
      const echt = a.method === "POST" && a.url === abgleichPfad(s) ? SERVER(a) : undefined;
      return echt ? ({ ...echt, warten: halt } satisfies Regelantwort) : undefined;
    };
    await starte({ ...PPT_MAC, datei: original }, { powerpoint: stand(["6"]) }, [langsam, SERVER]);
    knoten("herkunft-artikel").value = s.koId;
    knoten("herkunft-verbinden").click();
    await warte();
    expect(knoten("herkunft-anhang").disabled).toBe(false);
    const lauf = folienHerkunft().abgleichen();
    await warte();
    expect(knoten("herkunft-anhang").disabled).toBe(true);
    // Ein Host, der das Feld trotzdem ändert: die Verbindung wechselt, während die Antwort unterwegs ist.
    const h = (
      folienHerkunft() as unknown as { zustand: { verbindung: Koerper; antwort: Koerper } }
    ).zustand;
    h.verbindung = { ...h.verbindung, anhangId: "anderer", anhangName: "Anderer-fiktiv.pptx" };
    freigeben();
    await lauf;
    await warte();
    expect(h.antwort).toBeNull();
    expect(zahlKnoepfe()).toEqual([]);
    expect(textVon("herkunft-abgleich")).toBe("Nicht abgeglichen.");
    expect(knoten("herkunft-anhang").disabled).toBe(false);
  });
});

/** Der DOM der Bühne (jsdom) — ohne DOM-Typen, die der Node-reine Wurzel-Typcheck nicht kennt. */
const buehnenDom = () =>
  globalThis as unknown as {
    document: { activeElement: unknown; body: unknown };
    KeyboardEvent: new (typ: string, init: Record<string, unknown>) => unknown;
  };
type Bedienbar = Knoten & { blur(): void; dispatchEvent(ereignis: unknown): boolean };

describe("P10 · Fokus in der Herkunft (Prüfbefund B8)", () => {
  it("Öffnen fokussiert die Herkunft; Schließen und Escape geben den Fokus an die Zahl zurück", async () => {
    const ppt = stand(["6"]);
    const b = await verbundenUndAbgeglichen(original, ppt);
    const dom = buehnenDom();
    const detail = knoten("herkunft-detail") as Bedienbar;
    const zahl = () => zahlKnoepfe()[0] as Bedienbar;
    zahl().click();
    expect(dom.document.activeElement).toBe(detail);
    // Eine Eingabe und „Zurück“ zeichnen den Inhalt neu — der Fokus bleibt in der Herkunft.
    alleKnoten("#herkunft-detail-inhalt [data-eingabe]")[0]?.click();
    expect(dom.document.activeElement).toBe(detail);
    knoten("herkunft-zurueck").click();
    expect(dom.document.activeElement).toBe(detail);
    knoten("herkunft-schliessen").click();
    expect(knoten("herkunft-detail").hidden).toBe(true);
    expect(dom.document.activeElement).toBe(zahl());
    zahl().click();
    detail.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(knoten("herkunft-detail").hidden).toBe(true);
    expect(dom.document.activeElement).toBe(zahl());
    // Eine andere Auswahl in PowerPoint schließt die Herkunft, ohne dem Dokument den Fokus zu nehmen.
    zahl().click();
    (dom.document.activeElement as Bedienbar | null)?.blur();
    await markiere(b, ppt, ["7"]);
    expect(knoten("herkunft-detail").hidden).toBe(true);
    expect(dom.document.activeElement).toBe(dom.document.body);
  });
});

describe("P11 · Frist des Abgleichs (Prüfbefund B5)", () => {
  it("die Frist wächst mit der Datei; ein Abbruch erscheint als deutscher Satz", async () => {
    const abbrechend: Antwortregel = (a) =>
      a.method === "POST" && a.url === abgleichPfad(s)
        ? { status: 200, warten: Promise.reject(new DOMException("aborted", "AbortError")) }
        : undefined;
    const b = await starte({ ...PPT_MAC, datei: original }, { powerpoint: stand(["6"]) }, [
      abbrechend,
      SERVER,
    ]);
    const fenster = b.fenster as unknown as {
      abruf(pfad: string, init: unknown, fristMs?: number): Promise<unknown>;
    };
    const echt = fenster.abruf;
    const fristen: (number | undefined)[] = [];
    fenster.abruf = (pfad, init, fristMs) => {
      if (pfad.endsWith("/folien-abgleich")) {
        fristen.push(fristMs);
      }
      return echt(pfad, init, fristMs);
    };
    knoten("herkunft-artikel").value = s.koId;
    knoten("herkunft-verbinden").click();
    await warte();
    knoten("herkunft-abgleichen").click();
    await warte();
    const koerper = JSON.stringify({ datei: original.toString("base64") }).length;
    expect(fristen).toEqual([30_000 + Math.ceil(koerper / (128 * 1024)) * 1000]);
    expect(textVon("herkunft-meldung")).toBe(
      `Der Abgleich dauerte länger als ${Math.round((fristen[0] ?? 0) / 1000)} Sekunden und wurde abgebrochen. Bitte neu abgleichen – bei einer großen Präsentation über eine schnellere Verbindung.`,
    );
    expect(textVon("herkunft-abgleich")).toBe("Nicht abgeglichen.");
  });
});

describe("P12 · Fokus an den geklickten Knopf (Nachprüfung N6)", () => {
  it("derselbe Datenpunkt zweimal in der Liste: Schließen und Escape geben den Fokus an DEN geklickten", async () => {
    // Die echte Antwort, dazu dieselbe berechnete Zahl auch am Element 7 (zwei Bindungen).
    const echt = antworten.get(original.toString("base64"));
    const ergebnis = echt.hostLagen.find((l: Koerper) => l.datenpunktId === s.ids.ergebnis);
    const doppelt: Antwortregel = (a) =>
      a.method === "POST" && a.url === abgleichPfad(s)
        ? {
            status: 200,
            body: {
              ...echt,
              hostLagen: [...echt.hostLagen, { ...ergebnis, bindungId: "zusatz", shapeId: "7" }],
            },
          }
        : undefined;
    const ppt = stand(["6", "7"]);
    await verbundenUndAbgeglichen(original, ppt, PPT_MAC, [doppelt]);
    const dom = buehnenDom();
    const knoepfe = () => zahlKnoepfe() as Bedienbar[];
    expect(knoepfe().map((k) => k.getAttribute("data-datenpunkt"))).toEqual([
      s.ids.ergebnis,
      s.ids.marktanteil,
      s.ids.ergebnis,
    ]);
    // Der ZWEITE Knopf derselben Zahl (Element 7) öffnet — Schließen gibt ihm den Fokus zurück.
    knoepfe()[2]?.click();
    knoten("herkunft-schliessen").click();
    expect(dom.document.activeElement).toBe(knoepfe()[2]);
    // Wieder öffnen, die Liste wird neu gezeichnet (gleiche Auswahl — direkt über das Modul, denn auf
    // der Bühne hören Fenster früherer Fälle am selben `window` mit), dann Escape: derselbe Platz.
    knoepfe()[2]?.click();
    const vorher = knoepfe()[2];
    (folienHerkunft() as unknown as { auswahlZeigen(): void }).auswahlZeigen();
    expect(knoepfe()[2]).not.toBe(vorher);
    expect(knoten("herkunft-detail").hidden).toBe(false);
    (knoten("herkunft-detail") as Bedienbar).dispatchEvent(
      new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(dom.document.activeElement).toBe(knoepfe()[2]);
  });
});
