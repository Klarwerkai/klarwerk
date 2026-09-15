// JOB 4086: DriveItem → ImportItem. Rein, ohne Netz, ohne Zeit.
import { describe, expect, it } from "vitest";
import type { GraphDriveItem } from "./graph-client";
import { istDatei, mapDriveItemToImportItem, sharepointQuellstand } from "./mapper";

const OPTS = { driveId: "b!bibliothek" };

const DATEI: GraphDriveItem = {
  id: "01WARTUNG",
  name: "Wartungsanweisung.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Wartungsanweisung.docx",
  lastModifiedDateTime: "2026-09-10T08:30:00Z",
  size: 24_576,
  description: "Wartung der Abfüllanlage.",
  file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

describe("JOB 4086: der SharePoint-Mapper", () => {
  it("eine Datei wird zum quellneutralen ImportItem mit Kennung, Adresse und Quellstand", () => {
    const item = mapDriveItemToImportItem(DATEI, OPTS);
    expect(item).toBeDefined();
    expect(item?.title).toBe("Wartungsanweisung.docx");
    expect(item?.statement).toBe("Wartung der Abfüllanlage.");
    expect(item?.provider).toBe("SharePoint");
    expect(item?.externalId).toBe("01WARTUNG");
    expect(item?.sourceScope).toBe("b!bibliothek");
    expect(item?.category).toBe("b!bibliothek");
    expect(item?.url).toBe(DATEI.webUrl);
    expect(item?.sourceVersion).toBe(Math.floor(Date.parse("2026-09-10T08:30:00Z") / 1000));
    expect(item?.updatedAt).toBe("2026-09-10T08:30:00Z");
    expect(item?.author).toBe("R. Schuster");
    expect(item?.textCodec).toBe("decoded");
  });

  it("KEINE ERFUNDENE VERTRAULICHKEIT und KEIN erfundener Volltext", () => {
    const item = mapDriveItemToImportItem(DATEI, OPTS);
    // Der DriveItem-Vertrag trägt ohne einen zweiten Abruf kein Governance-Signal. Das Feld FEHLT
    // deshalb — der Import-Kern stuft eine echte Leerstelle fail-safe auf „vertraulich" ein.
    expect(item && "confidentiality" in item).toBe(false);
    // Der Dateiinhalt wird nicht gelesen (Auftrag §5.1). Ein `bodyHtml` hier wäre eine
    // Scheinfunktion: es sähe nach Inhalt aus und trüge keinen.
    expect(item && "bodyHtml" in item).toBe(false);
  });

  it("ohne Beschreibung ist die Kernaussage der Dateiname — nicht ein erfundener Satz", () => {
    const { description: _weg, ...ohne } = DATEI;
    expect(mapDriveItemToImportItem(ohne, OPTS)?.statement).toBe("Wartungsanweisung.docx");
  });

  it("ein ORDNER ist keine importierbare Datei", () => {
    const ordner: GraphDriveItem = { id: "01ORDNER", name: "Archiv", folder: { childCount: 2 } };
    expect(istDatei(ordner)).toBe(false);
    expect(mapDriveItemToImportItem(ordner, OPTS)).toBeUndefined();
  });

  it("ohne Kennung oder ohne Namen entsteht KEIN Item mit leeren Feldern", () => {
    expect(mapDriveItemToImportItem({ name: "A.docx", file: {} }, OPTS)).toBeUndefined();
    expect(mapDriveItemToImportItem({ id: "01A", file: {} }, OPTS)).toBeUndefined();
    expect(mapDriveItemToImportItem({ id: " ", name: " ", file: {} }, OPTS)).toBeUndefined();
  });

  it("der Quellstand fehlt ehrlich, wenn die Quelle keinen lesbaren Zeitpunkt nennt", () => {
    expect(sharepointQuellstand({ lastModifiedDateTime: "kein datum" })).toBeUndefined();
    expect(sharepointQuellstand({})).toBeUndefined();
    const ohneZeit = mapDriveItemToImportItem({ ...DATEI, lastModifiedDateTime: "" }, OPTS);
    // KEINE geratene 1: ein erfundener Stand erzeugte beim nächsten Lauf ein falsches
    // „Quelle ist neuer" oder ein falsches „unverändert".
    expect(ohneZeit && "sourceVersion" in ohneZeit).toBe(false);
  });

  it("der Quellstand WÄCHST, wenn die Datei in der Quelle geändert wurde", () => {
    const alt = mapDriveItemToImportItem(DATEI, OPTS)?.sourceVersion ?? 0;
    const neu =
      mapDriveItemToImportItem({ ...DATEI, lastModifiedDateTime: "2026-09-11T08:30:00Z" }, OPTS)
        ?.sourceVersion ?? 0;
    expect(neu).toBeGreaterThan(alt);
    // Und er ist eine positive sichere Ganzzahl — genau das verlangt `normalizeSourceVersion`.
    expect(Number.isSafeInteger(neu) && neu > 0).toBe(true);
  });
});
