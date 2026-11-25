import { expect } from "vitest";
import type { AppServices, buildApp } from "../../services/app/src/build-app";
import type { WorkflowDefinition } from "../../services/app/src/teamworkflows-vertrag";
import { anfrage } from "../teamassistenten/aufbau";
import { workflowUmfeld } from "./definition-fixture";

export async function ergebnisUmfeld(
  s: AppServices,
  app: ReturnType<typeof buildApp>,
  art: "normal" | "beschluss" | "aktion" = "normal",
) {
  const f = await workflowUmfeld(s, app);
  const admin = (await s.auth.listUsers()).find((u) => u.role === "admin");
  if (!admin) throw new Error("Testverwaltung fehlt");
  await s.auth.changeRole(f.autor.id, "controller", admin.id);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "autorin@team.test", password: "synthetisch123" },
  });
  expect(login.statusCode, login.body).toBe(200);
  const token = login.json<{ token: string }>().token;
  const chef = anfrage(app, token);
  const leser = anfrage(app, f.leser.token);
  const fremd = anfrage(app, f.fremd.token);
  const schritte = f.definition.schritte.filter(
    (s) =>
      art === "normal" || (art === "beschluss" && s.typ === "entscheidung") || s.typ === "aktion",
  );
  const definition: WorkflowDefinition = { ...f.definition, schritte };
  const w = await chef("POST", f.api, { teamId: f.team.id, definition });
  expect(w.statusCode, w.body).toBe(201);
  const pfad = `${f.api}/${w.json().id}`;
  const test = await chef("POST", `${pfad}/pruefen`, { revision: 1, sprache: "en" });
  expect(test.json().pruefung.bestanden, test.body).toBe(true);
  const frei = await chef("POST", `${pfad}/freigeben`, { revision: 2, version: 1 });
  expect(frei.statusCode, frei.body).toBe(200);
  let r = await leser("POST", `${pfad}/laeufe`, {
    vorgang: "wissensuebernahme",
    version: 1,
    fall: f.aussage,
    sprache: "en",
  });
  expect(r.statusCode, r.body).toBe(200);
  const lauf = `${pfad}/laeufe/${r.json().id}`;
  for (const schritt of schritte) {
    const entscheidung = schritt.typ === "entscheidung";
    r = await chef("POST", `${lauf}/weiter`, {
      revision: r.json().revision,
      aktion: entscheidung ? "annehmen" : "weiter",
      ...(entscheidung && art === "beschluss"
        ? { notiz: "Beschluss zum sachlich geprüften Einkauf" }
        : {}),
    });
    expect(r.statusCode, r.body).toBe(200);
  }
  expect(r.json().stand).toBe("abgeschlossen");
  const ergebnisId = r.json().ergebnisse[0].id;
  return {
    ...f,
    chef,
    leserApi: leser,
    fremdApi: fremd,
    ownerToken: token,
    lauf,
    ergebnisId,
    b: `${lauf}/ergebnisse/${ergebnisId}/wissensvorschlag`,
  };
}
