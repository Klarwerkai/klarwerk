// ================================================================================================
// R-0431 / R-1728 / FR-LIB-01 (K2, K20, K28 · BEN NACHARBEIT 10) — DER FACHGEBIETSWEG AM STÜCK.
// ================================================================================================
// Ohne Dienst-, Routen- oder Suchantwortattrappen: `buildApp(buildServices())`, ein Konto über die
// echten Auth-Routen, Anlage über `POST /api/kos`, Änderung und Entfernung über
// `PUT /api/kos/:id` (`action: "domain"`), gelesen über die echte Bibliothekssuche
// `GET /api/library/search`. Die TATSÄCHLICHEN Antwortobjekte laufen anschließend durch dieselbe
// Facettenableitung (`libraryFilterValues`) und denselben Facettenfilter (`applyFacetSelection`),
// die die Bibliotheksfläche benutzt.
//
// Der Bestand einer frischen App kann Demoobjekte enthalten; sie tragen kein Fachgebiet. Eine
// Fachgebietsauswahl muss deshalb EXAKT die eigenen Objekte liefern — jede Abweichung wäre rot.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { applyFacetSelection } from "../../apps/web/src/lib/facets";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const NOW = Date.parse("2026-10-04T00:00:00.000Z");
const KATEGORIE = "Anlage Fachgebiet";

async function setup(): Promise<{ app: App; auth: Auth }> {
  const app = buildApp(buildServices());
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@fachgebiet.test", password: "geheim12345" },
  });
  expect([200, 201], `Registrierung: ${reg.body}`).toContain(reg.statusCode);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@fachgebiet.test", password: "geheim12345" },
  });
  expect(login.statusCode, `Anmeldung: ${login.body}`).toBe(200);
  return { app, auth: { authorization: `Bearer ${login.json().token}` } };
}

async function anlegen(app: App, auth: Auth, titel: string, domain?: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      confidentiality: "intern",
      title: titel,
      type: "best_practice",
      category: KATEGORIE,
      statement: `${titel} — Aussage.`,
      ...(domain === undefined ? {} : { domain }),
    },
  });
  expect(res.statusCode, `Anlage ${titel}: ${res.body}`).toBe(201);
  return res.json().id as string;
}

async function suche(app: App, auth: Auth): Promise<KnowledgeObject[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/search", headers: auth });
  expect(res.statusCode, `Suche: ${res.body}`).toBe(200);
  return res.json() as KnowledgeObject[];
}

function objekt(liste: readonly KnowledgeObject[], id: string): KnowledgeObject {
  const k = liste.find((x) => x.id === id);
  if (!k) {
    throw new Error(`Objekt ${id} fehlt in der Suchantwort`);
  }
  return k;
}

function fachgebietTreffer(liste: readonly KnowledgeObject[], wert: string): string[] {
  return applyFacetSelection(liste, (k) => libraryFilterValues(k, NOW), { domain: [wert] }).map(
    (k) => k.id,
  );
}

async function setzen(app: App, auth: Auth, id: string, domain: unknown) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: auth,
    payload: { action: "domain", domain },
  });
}

describe("K2 · Fachgebiet über die öffentlichen Routen bis in die Bibliothekssuche", () => {
  it("R1 · anlegen → suchen → ändern → abweisen → entfernen, jeweils durch den Facettenfilter", async () => {
    const { app, auth } = await setup();
    try {
      const mitFach = await anlegen(app, auth, "Lager fetten", "Instandhaltung");
      const ohneFach = await anlegen(app, auth, "Lager prüfen");

      // 1 · Anlage: die Suchantwort trägt das Fachgebiet am einen, kein Feld am anderen Objekt.
      const nachAnlage = await suche(app, auth);
      expect(objekt(nachAnlage, mitFach).domain).toBe("Instandhaltung");
      expect("domain" in objekt(nachAnlage, ohneFach)).toBe(false);
      expect(objekt(nachAnlage, ohneFach).category).toBe(KATEGORIE);
      expect(fachgebietTreffer(nachAnlage, "Instandhaltung")).toEqual([mitFach]);

      // 2 · Änderung: derselbe Objektbezug, neues Fachgebiet, Kategorie unverändert.
      const geaendert = await setzen(app, auth, mitFach, "Qualität");
      expect(geaendert.statusCode, geaendert.body).toBe(200);
      expect(geaendert.json().domain).toBe("Qualität");
      const nachAenderung = await suche(app, auth);
      expect(objekt(nachAenderung, mitFach).domain).toBe("Qualität");
      expect(objekt(nachAenderung, mitFach).category).toBe(KATEGORIE);
      expect(fachgebietTreffer(nachAenderung, "Qualität")).toEqual([mitFach]);
      expect(fachgebietTreffer(nachAenderung, "Instandhaltung")).toEqual([]);

      // 3 · Abweisung: Nicht-Text und überlanger Wert sind 400 — und ändern nichts.
      const keinText = await setzen(app, auth, mitFach, 42);
      expect(keinText.statusCode, keinText.body).toBe(400);
      const zuLang = await setzen(app, auth, mitFach, "x".repeat(121));
      expect(zuLang.statusCode, zuLang.body).toBe(400);
      const nachAbweisung = await suche(app, auth);
      expect(objekt(nachAbweisung, mitFach).domain).toBe("Qualität");
      expect(fachgebietTreffer(nachAbweisung, "Qualität")).toEqual([mitFach]);

      // 4 · Entfernung: leerer Wert — das Feld fehlt, kein Fachgebiet liefert mehr ein Objekt.
      const entfernt = await setzen(app, auth, mitFach, "");
      expect(entfernt.statusCode, entfernt.body).toBe(200);
      const nachEntfernung = await suche(app, auth);
      expect("domain" in objekt(nachEntfernung, mitFach)).toBe(false);
      expect(objekt(nachEntfernung, mitFach).category).toBe(KATEGORIE);
      expect(fachgebietTreffer(nachEntfernung, "Qualität")).toEqual([]);
      expect(fachgebietTreffer(nachEntfernung, "Instandhaltung")).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
