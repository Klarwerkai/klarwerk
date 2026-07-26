// ==============================================================================================
// AUFTRAG-mega23 Block A — DIE BEHAUPTUNG ÜBER DIE AUFRUFER WIRD GEPRÜFT, NICHT GEGLAUBT.
// ==============================================================================================
//
// In `services/app/src/routes/capture-routes.ts` stand: „Die Oberfläche schickt ihn ausnahmslos
// (Capture.tsx, CaptureFrontDoor.tsx)." Für die Vordertür war das objektiv FALSCH — sie verdrahtete
// `promoteDraft: (id) => endpoints.drafts.promote(id)`. Der Satz hat einen ungeprüften Zustand als
// geprüft aussehen lassen; ben hat ihn als eigenen Befund gewertet, und zu Recht.
//
// WARUM ES DIESE DATEI GIBT UND NICHT NUR EINEN KORRIGIERTEN SATZ. Ein Kommentar, der eine Aussage
// über FREMDE Dateien trifft, verfällt schweigend — genau daran ist er das erste Mal gescheitert.
// Diese Prüfung schlägt fehl, sobald einer der beiden Aufrufer den Schlüssel wieder weglässt.
//
// Sie prüft die QUELLE und nicht das Laufzeitverhalten: die Wirkung ist an anderer Stelle belegt
// (mega22-vorgang-mounted für den Erfassen-Weg, mega23-vordertuer-vorgang-mounted für die
// Vordertür, beide gegen die echte Anwendung). Hier geht es allein darum, dass die Aussage im
// Serverkommentar nicht wieder unbemerkt unwahr wird.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function lies(pfad: string): string {
  return readFileSync(resolve(process.cwd(), pfad), "utf8");
}

describe("AUFTRAG-mega23 Block A: beide Oberflächen-Aufrufer des Promote schicken den Vorgang", () => {
  it("Erfassen-Weg: operationId UND draftPayload reisen mit dem Promote", () => {
    const quelle = lies("apps/web/src/pages/Capture.tsx");
    // Der Aufruf selbst, mit beiden Feldern im Rumpf.
    expect(quelle).toMatch(
      /endpoints\.drafts\.promote\(draftId,\s*\{[\s\S]{0,400}?operationId,[\s\S]{0,400}?draftPayload,/,
    );
    // Und der Schlüssel lebt in einer REF ausserhalb der Mutationsfunktion — daran hängt, dass er
    // die Wiederholung überlebt.
    expect(quelle).toContain("const submitOperationRef = useRef<string | null>(null);");
  });

  it("Vordertür: operationId UND draftPayload reisen mit dem Promote", () => {
    const seite = lies("apps/web/src/pages/CaptureFrontDoor.tsx");
    const lib = lies("apps/web/src/lib/captureFrontDoor.ts");

    // Die Seite reicht den Vorgang durch — beide Refs ausserhalb der Mutationsfunktion.
    expect(seite).toContain("const submitOperationRef = useRef<string | null>(null);");
    expect(seite).toContain("const submitDraftRef = useRef<string | null>(null);");
    expect(seite).toContain("newCreateOperationId()");
    expect(seite).toMatch(/promoteDraft:\s*\(id,\s*vorgang\)\s*=>\s*endpoints\.drafts\.promote\(/);
    expect(seite).toMatch(/id:\s*submitOperationRef\.current,\s*draftRef:\s*submitDraftRef/);

    // Und der Clientvertrag verlangt beides — ein Aufrufer kann es nicht mehr weglassen.
    expect(lib).toMatch(/operationId:\s*operation\.id/);
    expect(lib).toMatch(/draftPayload:\s*payload/);
  });

  it("Vordertür: KEIN vorgeschaltetes Entwurfs-Update mehr auf dem Einreich-Weg", () => {
    // Der Grund steht ausgeschrieben in der lib: nach einem gelungenen ersten Promote ist der
    // Entwurf gelöscht — ein vorgeschaltetes PUT fing die Wiederholung mit 404 ab, bevor der
    // serverseitige Nachschlag überhaupt erreicht war.
    // Geprüft wird der CODE, nicht die Prosa: weder eine Vertragszusage (`updateDraft:`) noch ein
    // Aufruf (`updateDraft(`) darf übrig sein. Der Name darf in der Begründung weiter vorkommen —
    // dort erklärt er, was WEGGEFALLEN ist.
    const lib = lies("apps/web/src/lib/captureFrontDoor.ts");
    expect(lib).not.toMatch(/updateDraft\s*[:(]/);
  });

  it("der Serverkommentar behauptet die Aufrufer nicht mehr ungeprüft", () => {
    const route = lies("services/app/src/routes/capture-routes.ts");
    // Der alte, falsche Satz ist weg …
    expect(route).not.toContain("Die Oberfläche schickt ihn\n    //      ausnahmslos");
    // … und die verbliebene Aussage nennt diese Prüfung beim Namen.
    expect(route).toContain("promote-operation-\n    // callers.test.ts");
  });
});
