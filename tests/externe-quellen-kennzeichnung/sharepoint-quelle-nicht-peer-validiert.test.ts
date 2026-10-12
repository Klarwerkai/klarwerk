// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-1653 — SHAREPOINT LESEN, ABER KLAR
// ALS „NICHT PEER-VALIDIERT" AUSWEISEN.
// ================================================================================================
//
// Originalwortlaut (Roadmap 8.3): „KLARWERK liest, kann aber bestehende Dokumente klar als ‚nicht
// peer-validiert' ausweisen — dem Kunden hilft das, ohne den Trust-Maßstab zu verwässern."
//
// Der Lesezugriff selbst ist bestehende Lieferung (JOB 4086, `services/sharepoint`). Gemessen wird
// hier nur die Kennzeichnung, und zwar über die echten Bausteine des Weges: ein Graph-DriveItem →
// `mapDriveItemToImportItem` (SharePoint-Mapper) → `createImportCandidates` (Prüf-Warteschlange) →
// `reviewImportCandidate(…, "accept")` (Annahme durch den Menschen) → zurückgelesenes Objekt.
//
// BEFUND AM WEG (Prüflauf Kandidat c298002e): beide Fälle scheiterten in `createImportCandidates`
// → `pruefeAnkerEintrag` mit „Ungültige sourceVersion". Der SharePoint-Mapper schreibt den
// Quellstand als Sekunden seit 1970 (`sharepointQuellstand`, hier 1789029000, zehn Stellen); seit
// f29237ad (04.10.) war eine Quellfassung auf neun Stellen begrenzt. Dieselbe Ursache machte
// `tests/sharepoint-onedrive-import/erster-weg-am-draht.test.ts` rot (`imported` 0 statt 1).
// KORREKTUR (Nacharbeit 3, Bens Vorgabe): `MAX_SOURCE_VERSION` hat fünfzehn Stellen, Kandidaten-
// spalte und Revisions-CHECK in PostgreSQL ziehen mit (repo.ts, repo-pg.ts); Bestandswerte und
// ihre Reihenfolge bleiben. Der PG-Nachweis steht daneben in `sharepoint-quellstand-pg.integration.test.ts`.
// Diese Datei ist unverändert die Gegenprobe des Weges bis zum Wissensobjekt. Seit R-0144 (main)
// zählt der Mapper ab 2025-01-01; die Prüfungen hier hängen am Wert nicht und gelten unverändert.
//
// Die Gegenprobe zu Confluence steht in `services/library-analytics/src/service.test.ts`
// („SCRUM-470: Accept einer pageId legt KO mit Herkunfts-Anker an").
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics/src/service";
import {
  SHAREPOINT_PROVIDER,
  mapDriveItemToImportItem,
} from "../../services/sharepoint/src/mapper";

const DATEI_ID = "01WARTUNG7XYZ";
const DATEI_URL =
  "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx";

/** Ein DriveItem, wie Microsoft Graph es ausliefert (dieselbe Form wie im JOB-4086-Drahttest). */
const WARTUNGSANWEISUNG = {
  id: DATEI_ID,
  name: "Wartungsanweisung.docx",
  webUrl: DATEI_URL,
  lastModifiedDateTime: "2026-09-10T08:30:00Z",
  size: 24_576,
  description: "Wartung der Abfüllanlage, Stand September.",
  file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

async function aufbau() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  // Wie `services/library-analytics/src/service.test.ts`: die Suche ist fail-closed und wird über
  // den Produktpfad in Betrieb genommen; der quellneutrale Ankerstrang ist eingeschaltet.
  await koService.activateSearchProjectionV2();
  return { koService, library: new LibraryService({ koService, externalUpsert: true }) };
}

describe("R-1653 · gelesene SharePoint-Datei: am Wissen nicht peer-validiert", () => {
  it("S1 · Mapper → Warteschlange → Annahme: die Quelle ist extern und nicht peer-validiert", async () => {
    const item = mapDriveItemToImportItem(WARTUNGSANWEISUNG, {
      driveId: "b!testbibliothek",
      inhalt: { art: "nur-merkmale" },
    });
    expect(item, "der Mapper muss aus der Datei einen Importeintrag machen").toBeDefined();
    expect(item?.provider).toBe(SHAREPOINT_PROVIDER);

    const { koService, library } = await aufbau();
    const [kandidat] = await library.createImportCandidates([item as NonNullable<typeof item>]);
    expect(kandidat, "die Datei muss als Kandidat in der Warteschlange stehen").toBeDefined();

    const angenommen = await library.reviewImportCandidate(kandidat?.id ?? "", "accept");
    const ko = (await koService.list()).find((k) => k.id === angenommen.koId);
    expect(ko, "die Annahme muss ein Wissensobjekt anlegen").toBeDefined();

    const anker = ko?.sources.find((s) => s.externalId === DATEI_ID);
    expect(anker, "das Objekt muss den Herkunfts-Anker der Datei tragen").toBeDefined();
    expect(anker?.provider).toBe(SHAREPOINT_PROVIDER);
    expect(anker?.kind).toBe("external");
    expect(anker?.peerValidated).toBe(false);
  });

  it("S2 · das Lesen ersetzt keine Prüfung: das angenommene Objekt ist nicht validiert", async () => {
    const item = mapDriveItemToImportItem(WARTUNGSANWEISUNG, {
      driveId: "b!testbibliothek",
      inhalt: { art: "nur-merkmale" },
    });
    const { koService, library } = await aufbau();
    const [kandidat] = await library.createImportCandidates([item as NonNullable<typeof item>]);
    const angenommen = await library.reviewImportCandidate(kandidat?.id ?? "", "accept");
    const ko = (await koService.list()).find((k) => k.id === angenommen.koId);

    expect(ko?.status).not.toBe("validiert");
  });
});
