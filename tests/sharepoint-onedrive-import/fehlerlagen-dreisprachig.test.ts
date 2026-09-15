// ================================================================================================
// JOB 4086 · S3 — VIER FEHLERLAGEN, DREI SPRACHEN, ZWÖLF EIGENE SÄTZE.
// ================================================================================================
//
// DER SATZ, DEN DIESER FALL MISST: „Jede der vier Fehlerlagen hat in de, en und nl einen eigenen,
// AUFGELÖSTEN Satz, und keiner davon enthält eine Zahl aus dem Protokoll oder ein Serverwort."
//
// WARUM „EIGEN" EINE EIGENE ZUSAGE IST: Der billigste Weg, diesen Auftrag scheinbar zu erfüllen,
// wäre ein Satz für alle vier Lagen („Der Zugriff auf SharePoint ist fehlgeschlagen."). Er wäre in
// drei Sprachen aufgelöst, enthielte keine Zahl — und sagte dem Menschen nichts. Deshalb prüft
// dieser Fall, dass die zwölf Sätze PAARWEISE VERSCHIEDEN sind.
//
// WARUM „KEIN SERVERWORT": Auf der Fläche steht, was IST und was der Mensch TUN kann. „503",
// „IMPORT_UNAVAILABLE", „Graph", „HTTP", „Token" sind Werkstattwissen. Sie stehen im Protokoll und
// im Zugangskasten (dort mit Grund: der Variablenname ist der einzige Weg, den Zustand zu ändern) —
// nicht in einem Satz, den jemand liest, während etwas nicht geht.
import { describe, expect, it } from "vitest";
import {
  SHAREPOINT_FEHLERLAGEN,
  SHAREPOINT_FEHLER_TEXT,
  type SharePointFehlerCode,
  sharepointFehlertextKey,
} from "../../apps/web/src/components/sharepoint-import/fehlerlagen";
import i18n from "../../apps/web/src/i18n";

const SPRACHEN = ["de", "en", "nl"] as const;

/**
 * Wörter, die auf der Fläche nichts zu suchen haben. Sie sind mit Bedacht gewählt: jedes einzelne
 * ist in mindestens einer der drei Sprachen ein Wort, das ein Mensch ohne Werkstattwissen nicht
 * deuten kann — oder ein Rest aus der Serverantwort.
 */
const SERVERWOERTER = [
  "http",
  "503",
  "403",
  "404",
  "401",
  "graph",
  "api",
  "token",
  "endpoint",
  "server",
  "error",
  "unavailable",
  "forbidden",
  "status",
];

function text(lng: (typeof SPRACHEN)[number], key: string): string {
  const wert = i18n.getResource(lng, "translation", key);
  return typeof wert === "string" ? wert : "";
}

describe("JOB 4086 · S3 — die vier Fehlerlagen in de/en/nl", () => {
  it("es sind GENAU vier Lagen, und jeder Server-Fehlercode trifft eine davon", () => {
    expect(SHAREPOINT_FEHLERLAGEN).toHaveLength(4);
    const codes: SharePointFehlerCode[] = [
      "IMPORT_UNAVAILABLE",
      "SHAREPOINT_FORBIDDEN",
      "SHAREPOINT_NOT_FOUND",
      "SHAREPOINT_UNREACHABLE",
    ];
    const getroffen = codes.map((code) => sharepointFehlertextKey(code));
    expect(new Set(getroffen).size, "jeder Code hat seine EIGENE Lage").toBe(4);
    // Und ein unbekannter Code fällt ehrlich in die Lage „nicht erreichbar" — nie in ein leeres
    // Bild und nie in einen durchgereichten Serverbrocken.
    expect(sharepointFehlertextKey("IRGENDWAS_UNBEKANNTES")).toBe(
      SHAREPOINT_FEHLER_TEXT.SHAREPOINT_UNREACHABLE,
    );
    expect(sharepointFehlertextKey(null)).toBe(SHAREPOINT_FEHLER_TEXT.SHAREPOINT_UNREACHABLE);
  });

  it("jede Lage hat in jeder Sprache einen aufgelösten, nicht leeren Satz", () => {
    for (const lng of SPRACHEN) {
      for (const key of SHAREPOINT_FEHLERLAGEN) {
        const satz = text(lng, key);
        expect(satz, `${lng}:${key} fehlt`).not.toBe("");
        // Ein Schlüssel, der als Schlüssel dasteht, ist kein Satz.
        expect(satz, `${lng}:${key} ist unaufgelöst`).not.toContain("imp.sharepoint.");
        expect(satz.length, `${lng}:${key} ist zu kurz für eine Auskunft`).toBeGreaterThan(20);
      }
    }
  });

  it("die zwölf Sätze sind paarweise verschieden — kein Sammeltext für vier Lagen", () => {
    for (const lng of SPRACHEN) {
      const saetze = SHAREPOINT_FEHLERLAGEN.map((key) => text(lng, key));
      expect(new Set(saetze).size, `${lng}: die vier Lagen sagen nicht dasselbe`).toBe(4);
    }
  });

  it("kein Satz trägt eine Zahl aus dem Protokoll oder ein Serverwort", () => {
    for (const lng of SPRACHEN) {
      for (const key of SHAREPOINT_FEHLERLAGEN) {
        const satz = text(lng, key);
        expect(satz, `${lng}:${key} enthält eine Zahl`).not.toMatch(/\d/);
        const klein = satz.toLowerCase();
        for (const wort of SERVERWOERTER) {
          expect(klein.includes(wort), `${lng}:${key} enthält „${wort}"`).toBe(false);
        }
      }
    }
  });
});
