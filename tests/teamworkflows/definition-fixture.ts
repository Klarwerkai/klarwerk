import { expect } from "vitest";
import type { AppServices, buildApp } from "../../services/app/src/build-app";
import type { WorkflowDefinition } from "../../services/app/src/teamworkflows-vertrag";
import { anfrage, fachbereich } from "../teamassistenten/aufbau";

export async function workflowUmfeld(s: AppServices, app: ReturnType<typeof buildApp>) {
  const f = await fachbereich(s, app);
  const autor = anfrage(app, f.autor.token);
  const test = await autor("POST", `${f.pfad}/pruefen`, { revision: 1, sprache: "en" });
  expect(test.statusCode, test.body).toBe(200);
  const frei = await autor("POST", `${f.pfad}/freigeben`, {
    revision: test.json().revision,
    version: 1,
  });
  expect(frei.statusCode, frei.body).toBe(200);
  const definition: WorkflowDefinition = {
    name: "Einkaufsfreigabe",
    ausloeser: "Anfrage aus dem Einkauf",
    beispielfall: f.aussage,
    schritte: [
      {
        typ: "assistent",
        titel: "Freigegebene Regel prüfen",
        assistentId: f.id,
        version: 1,
        frage: "{{fall}}",
        erwartet: "belegt",
      },
      { typ: "entscheidung", titel: "Einkaufsregel freigeben", rolle: "verantwortlich" },
      { typ: "aktion", titel: "Einkaufsergebnis protokollieren", aktion: "ergebnis_festhalten" },
    ],
  };
  return { ...f, definition, api: "/api/teamworkflows", assistentId: f.id, assistentPfad: f.pfad };
}
