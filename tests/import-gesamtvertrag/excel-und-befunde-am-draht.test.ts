// ================================================================================================
// R-0179 / FR-EXT-01 (Aufnahme import-gesamtvertrag, Nacharbeit 3) — EXCEL, VERALTET UND
// SCHÜTZENSWERT, DURCHGÄNGIG.
// ================================================================================================
//
// Bens Befunde: (1) Excel hatte keinen Extraktionsweg, (2) „veraltet" erkannte keine veralteten
// Importinhalte, (3) schützenswertes Firmenwissen wurde nicht ermittelt. Diese Datei misst alle
// drei an echten Teilen:
//   X  — echte .xlsx-Bytes (OOXML, mit fflate gepackt) durch den budgetierten Entpacker und
//        `leseXlsxEintraege` bis zu den Einträgen, die `parseImportItems` geprüft hat;
//   D  — dieselben Einträge über HTTP in die echte App (`buildApp`), danach
//        `GET /api/library/import/candidates/befunde`: veraltet aus dem Quellstand, schützenswert
//        aus Einstufung, Schutzdaten und Kennzeichnung — und „nicht bewertet" getrennt.
// Nicht gedeckt: der Dateidialog im Browser und Postgres.
import { afterEach, describe, expect, it } from "vitest";
import {
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  strToU8,
  zipSync,
} from "../../apps/web/node_modules/fflate";
import { ImportParseError } from "../../apps/web/src/lib/importReview";
import {
  XlsxImportError,
  budgetedXlsxUnzip,
  excelDatumZuIso,
  leseXlsxEintraege,
} from "../../apps/web/src/lib/xlsxImport";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { ImportKandidatBefund } from "../../services/app/src/import-befunde";

const unzip = budgetedXlsxUnzip({ Unzip, UnzipInflate, UnzipPassThrough });

type Zelle = string | number | null;

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

function xmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texte der ersten Spalte als gemeinsame Texte, übrige als Inline-Text, Zahlen als Zahlen. */
function zelleXml(z: Zelle, zeile: number, spalte: number, gemeinsam: string[]): string {
  const pos = `${String.fromCharCode(65 + spalte)}${zeile + 1}`;
  if (z === null) {
    return "";
  }
  if (typeof z === "number") {
    return `<c r="${pos}"><v>${z}</v></c>`;
  }
  if (spalte === 0) {
    gemeinsam.push(z);
    return `<c r="${pos}" t="s"><v>${gemeinsam.length - 1}</v></c>`;
  }
  return `<c r="${pos}" t="inlineStr"><is><t xml:space="preserve">${xmlText(z)}</t></is></c>`;
}

/** Ein Arbeitsblatt. Eine ganz leere Zeile wird selbstschließend geschrieben. */
function blattXml(zeilen: readonly (readonly Zelle[])[], gemeinsam: string[]): string {
  const rows = zeilen.map((zeile, r) => {
    if (zeile.every((z) => z === null)) {
      return `<row r="${r + 1}"/>`;
    }
    const zellen = zeile.map((z, c) => zelleXml(z, r, c, gemeinsam));
    return `<row r="${r + 1}">${zellen.join("")}</row>`;
  });
  return `<worksheet xmlns="${NS_MAIN}"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

function blattEintrag(i: number): string {
  return `<sheet name="Blatt${i + 1}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
}

function beziehung(i: number): string {
  const ziel = `worksheets/sheet${i + 1}.xml`;
  return `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="${ziel}"/>`;
}

/** Eine echte .xlsx-Datei aus einem oder mehreren Blättern. */
function xlsx(...blaetter: (readonly (readonly Zelle[])[])[]): Uint8Array {
  const gemeinsam: string[] = [];
  const dateien: Record<string, Uint8Array> = {};
  blaetter.forEach((zeilen, i) => {
    dateien[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(blattXml(zeilen, gemeinsam));
  });
  const sheets = blaetter.map((_, i) => blattEintrag(i)).join("");
  const rels = blaetter.map((_, i) => beziehung(i)).join("");
  const sst = gemeinsam.map((s) => `<si><t>${xmlText(s)}</t></si>`).join("");
  const mappe = `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`;
  const beziehungen = `<Relationships xmlns="${NS_PKG}">${rels}</Relationships>`;
  dateien["xl/workbook.xml"] = strToU8(`${mappe}<sheets>${sheets}</sheets></workbook>`);
  dateien["xl/_rels/workbook.xml.rels"] = strToU8(beziehungen);
  dateien["xl/sharedStrings.xml"] = strToU8(`<sst xmlns="${NS_MAIN}">${sst}</sst>`);
  return zipSync(dateien);
}

const KOPF: Zelle[] = [
  "title",
  "statement",
  "type",
  "category",
  "tags",
  "sourceVersion",
  "updatedAt",
];

// Excel-Seriennummer 43831 = 01.01.2020 (alt), 46296 = 01.10.2026 (frisch).
const TABELLE: Zelle[][] = [
  KOPF,
  [
    "Pumpe entlüften",
    "Nach dem Anfahren zehn Sekunden warten & entlüften.",
    "best_practice",
    "Anlage 1",
    "Pumpe, Wartung",
    3,
    43831,
  ],
  [null, null, null, null, null, null, null],
  [
    "Rezeptur Kleber K7",
    "Betriebsgeheimnis: Mischverhältnis 3:1 bei 40 °C.",
    "technik",
    "Fertigung",
    null,
    null,
    46296,
  ],
  [
    "Lohnkonto",
    "Abrechnung über DE89 3704 0044 0532 0130 00.",
    "technik",
    "Verwaltung",
    null,
    null,
    null,
  ],
];

describe("X — Excel wird zu denselben Einträgen wie JSON", () => {
  it("X1 · liest das erste Blatt: Kopfzeile = Feldnamen, leere Zeilen übersprungen", () => {
    const { items, weitereBlaetter } = leseXlsxEintraege(xlsx(TABELLE), unzip);
    expect(weitereBlaetter).toBe(0);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      title: "Pumpe entlüften",
      statement: "Nach dem Anfahren zehn Sekunden warten & entlüften.",
      type: "best_practice",
      category: "Anlage 1",
      tags: ["Pumpe", "Wartung"],
      sourceVersion: 3,
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    expect(items[2]?.updatedAt).toBeUndefined();
    expect(excelDatumZuIso(46296)).toBe("2026-10-01T00:00:00.000Z");
  });

  it("X2 · weitere Blätter werden nicht gelesen, aber gezählt", () => {
    const zweites: Zelle[][] = [KOPF, ["A", "B", "technik", "C", null, null, null]];
    const { items, weitereBlaetter } = leseXlsxEintraege(xlsx(TABELLE, zweites), unzip);
    expect(items).toHaveLength(3);
    expect(weitereBlaetter).toBe(1);
  });

  it("X3 · ein Formatfehler kommt als dieselbe Meldung wie bei JSON (Datenzeile, Feldname)", () => {
    const kaputt: Zelle[][] = [
      KOPF,
      ["A", "B", "technik", "C", null, null, null],
      ["A2", "B2", "unfug", "C"],
    ];
    let fehler: unknown;
    try {
      leseXlsxEintraege(xlsx(kaputt), unzip);
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(ImportParseError);
    expect((fehler as ImportParseError).index).toBe(1);
    expect((fehler as ImportParseError).fields).toEqual(["type"]);
  });

  it("X4 · kein Archiv → unlesbar; nur Kopfzeile → leer", () => {
    const art = (daten: Uint8Array): string | undefined => {
      try {
        leseXlsxEintraege(daten, unzip);
      } catch (e) {
        return e instanceof XlsxImportError ? e.kind : "anderer Fehler";
      }
      return undefined;
    };
    expect(art(strToU8("kein zip"))).toBe("unreadable");
    expect(art(xlsx([KOPF]))).toBe("empty");
  });
});

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function aufbauen() {
  const app = buildApp(buildServices());
  apps.push(app);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Excel", email: "excel-import@example.test", password: "test-password-xl" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "excel-import@example.test", password: "test-password-xl" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

async function befundeVon(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
): Promise<{ body: string; befunde: ImportKandidatBefund[] }> {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/library/import/candidates/befunde",
    headers,
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return { body: antwort.body, befunde: antwort.json() as ImportKandidatBefund[] };
}

describe("D — durch den Draht: Excel → Prüfliste → Befunde je Kandidat", () => {
  it("D1 · veraltet aus dem Quellstand, schützenswert aus Kennzeichnung und Schutzdaten", async () => {
    const { app, headers } = await aufbauen();
    const { items } = leseXlsxEintraege(xlsx(TABELLE), unzip);
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: { items },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const kandidaten = angelegt.json() as { id: string; item: { title: string } }[];
    const idVon = (titel: string): string =>
      kandidaten.find((k) => k.item.title === titel)?.id ?? `fehlt: ${titel}`;

    const { body, befunde } = await befundeVon(app, headers);
    const nach = new Map(befunde.map((b) => [b.id, b] as const));

    const pumpe = nach.get(idVon("Pumpe entlüften"));
    expect(pumpe?.veraltet).toEqual({
      bewertet: true,
      veraltet: true,
      stand: "2020-01-01T00:00:00.000Z",
    });
    expect(pumpe?.schutz).toEqual({ bewertet: true, gruende: [], schutzdaten: [] });

    const kleber = nach.get(idVon("Rezeptur Kleber K7"));
    expect(kleber?.veraltet).toMatchObject({ bewertet: true });
    expect(kleber?.schutz).toEqual({ bewertet: true, gruende: ["kennzeichnung"], schutzdaten: [] });

    const lohn = nach.get(idVon("Lohnkonto"));
    expect(lohn?.veraltet).toEqual({ bewertet: false });
    expect(lohn?.schutz).toEqual({
      bewertet: true,
      gruende: ["schutzdaten"],
      schutzdaten: ["kontodaten"],
    });
    // Nur Gründe, nie Werte: die IBAN steht nirgends in der Befundantwort.
    expect(body).not.toContain("DE89");
  });

  it("D2 · eine vertrauliche Einstufung der Quelle ist ein Schutzgrund", async () => {
    const { app, headers } = await aufbauen();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: {
        items: [
          {
            title: "Prüfplan Linie 3",
            statement: "Sichtprüfung vor jedem Schichtwechsel.",
            type: "best_practice",
            category: "Qualität",
            confidentiality: "vertraulich",
          },
        ],
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const { befunde } = await befundeVon(app, headers);
    expect(befunde[0]?.schutz).toEqual({
      bewertet: true,
      gruende: ["einstufung"],
      schutzdaten: [],
    });
    expect(befunde[0]?.veraltet).toEqual({ bewertet: false });
  });

  it("D3 · ohne Anmeldung kein Zugang", async () => {
    const { app } = await aufbauen();
    const antwort = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates/befunde",
    });
    expect(antwort.statusCode).toBe(401);
  });
});
