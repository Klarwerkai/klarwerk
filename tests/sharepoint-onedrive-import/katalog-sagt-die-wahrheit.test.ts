// ================================================================================================
// JOB 4086 · S2 — DIE KACHEL SAGT, WAS ES GIBT. UND SIE MUSS ES BELEGEN KÖNNEN.
// ================================================================================================
//
// DER SATZ, DEN DIESER FALL MISST: „Die Systemkachel `sharepoint` steht nicht mehr auf `planned`,
// und ihr Zustand ist durch Schalter, Registrierung und Modul GEDECKT."
//
// Der zweite Halbsatz ist der wichtigere. Eine Kachel von Hand auf „aktiv" zu setzen, ist eine
// Zeile Arbeit; sie WAHR zu machen, sind drei Messungen. Genau diese drei nennt der Kopfkommentar
// von `SYSTEM_SOURCES` (`apps/web/src/lib/importSourceGallery.ts`) seit JOB 3235 als Beleg dafür,
// dass es für Word und PDF KEINE Quellenanbindung gibt:
//
//   1. ein eigenes Modul unter `services/`
//   2. ein Eintrag im `SCHALTER_REGISTRY` (`services/app/src/feature-flags.ts`)
//   3. eine Konnektor-Routendatei unter `services/app/src/routes/`, registriert an der EINEN
//      Registrierungsstelle in `services/app/src/build-app.ts`
//
// Dieser Fall dreht sie um: Er lässt die Kachel nur dann `active` heissen, wenn alle drei WIRKLICH
// da sind. Nimmt jemand später die Registrierung heraus und lässt die Kachel stehen, wird er rot —
// und nicht erst der Mensch, der auf eine Fläche klickt, die es nicht gibt.
//
// WAS DIESER FALL AUSDRÜCKLICH NICHT BEHAUPTET: dass die Instanz einen benutzbaren Zugang hat. Der
// Schalter und die Route sind eine Aussage über das PRODUKT; ob in DIESEM Betrieb Zugangsdaten
// stehen, sagt die Zugangs-Auskunft (`/api/import/sharepoint/zugang`) und sonst nichts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SYSTEM_SOURCES } from "../../apps/web/src/lib/importSourceGallery";
import { SCHALTER_REGISTRY } from "../../services/app/src/feature-flags";

const WURZEL = join(__dirname, "..", "..");
const BUILD_APP = readFileSync(join(WURZEL, "services/app/src/build-app.ts"), "utf8");

/** Kommentarzeilen zählen nicht: `build-app.ts` zitiert Registrierungen in Begründungsblöcken. */
function ohneKommentare(quelle: string): string {
  return quelle
    .split("\n")
    .map((zeile) => {
      const strich = zeile.indexOf("//");
      return strich === -1 ? zeile : zeile.slice(0, strich);
    })
    .join("\n");
}

const BUILD_APP_CODE = ohneKommentare(BUILD_APP);

describe("JOB 4086 · S2 — der Quellenkatalog sagt die Wahrheit über SharePoint", () => {
  it("die Systemkachel `sharepoint` steht nicht mehr auf `planned`", () => {
    const kachel = SYSTEM_SOURCES.find((s) => s.id === "sharepoint");
    expect(kachel, "die Systemkachel `sharepoint` muss es weiterhin geben").toBeDefined();
    expect(kachel?.state).not.toBe("planned");
    // Und sie steht auf dem Zustand, den die drei Messungen unten decken: ein realer, von dieser
    // Fläche aus erreichbarer Weg.
    expect(kachel?.state).toBe("active");
  });

  it("Messung 1 — es gibt ein eigenes Modul `services/sharepoint` mit öffentlicher Schnittstelle", () => {
    expect(existsSync(join(WURZEL, "services/sharepoint/index.ts"))).toBe(true);
    expect(existsSync(join(WURZEL, "services/sharepoint/src/adapter.ts"))).toBe(true);
  });

  it("Messung 2 — SharePoint hat einen EIGENEN Quell-Schalter im Registry", () => {
    expect(SCHALTER_REGISTRY.sharepointImport).toBe("KLARWERK_SHAREPOINT_IMPORT");
    // Ein eigener Schalter heisst: NICHT der von Confluence. Wäre es derselbe, könnte ein Betrieb
    // die eine Quelle nicht ohne die andere haben — und die Kachel behauptete etwas über einen
    // Schalter, der einer anderen Quelle gehört.
    expect(SCHALTER_REGISTRY.sharepointImport).not.toBe(SCHALTER_REGISTRY.confluenceImport);
  });

  it("Messung 3 — die Konnektor-Routendatei existiert und ist hinter IHREM Schalter registriert", () => {
    expect(existsSync(join(WURZEL, "services/app/src/routes/sharepoint-import-routes.ts"))).toBe(
      true,
    );
    expect(BUILD_APP_CODE).toContain("sharepointImportRoutes(");
    expect(BUILD_APP_CODE).toContain('schalterAn("sharepointImport")');
  });

  it("der quellneutrale Import-Strang ist an, sobald IRGENDEINE Quelle an ist", () => {
    // `build-app.ts:721` trug bis JOB 4086 den Rest „künftig: || jiraEnabled || …" und genau EINEN
    // Schalter. Ohne das ODER schriebe der Import-Kern für eine reine SharePoint-Instanz keinen
    // Herkunfts-Anker — das Objekt verlöre seine Quelle, und niemand sähe einen Fehler.
    expect(BUILD_APP_CODE).toMatch(
      /externalImportEnabled\s*=\s*schalterAn\("confluenceImport"\)\s*\|\|\s*schalterAn\("sharepointImport"\)/,
    );
  });
});
