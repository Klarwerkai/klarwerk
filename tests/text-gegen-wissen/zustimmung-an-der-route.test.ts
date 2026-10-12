// ================================================================================================
// R-0708 (E31) — DER PRUEFWEG DES WORD-FENSTERS UND SEINE AUSDRUECKLICHE ZUSTIMMUNG, AN DER ROUTE.
// ================================================================================================
//
// Zielzustand: „Das Word-Seitenfenster behaelt seinen eigenen Pruefweg und bekommt eine
// ausdrueckliche Zustimmung, auch nicht validierten Bestand einzubeziehen. Der Weg der Erfassung
// bleibt davon getrennt, weil beide verschiedene Fragen stellen." Pedi 13.08.2026 (Quelle des
// Registereintrags): „Der Weg: Opt-in auf /api/check-text."
//
// Was die Route dafuer tut (check-text-routes.ts, Handler): das Feld `ungeprueftEinbeziehen`
//   · `false` — der Sitzungsweg prueft NUR gegen Validiertes (Pruefweg ohne Zustimmung);
//   · `true`  — er bezieht auch eingereichte, noch nicht validierte Eintraege ein (mit Zustimmung);
//   · fehlt   — die Reichweite des Wegs wie seit JOB 3020 (Weg der Erfassung: „gibt es das schon,
//               auch ungeprueft?") — unveraendert;
//   · am Add-in-Schluessel wirkungslos: das Feld kann die Reichweite nie ueber die des Wegs hinaus
//     oeffnen (`checktext.validated`).
//
// Gefahren an der ECHTEN Route ueber `buildApp(buildServices())` mit `KLARWERK_ADDON_API=1`, wie
// `tests/pruefung-gegen-alles/n1-ungeprueftes-wird-gefunden.test.ts`. Deterministischer Weg: kein
// Modell, kein Textabfluss.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "r0708-addon-key";

// Nahezu gleiche Kerntexte → deterministischer Treffer.
const TITEL = "Pumpe entlüften";
const SEED_STMT = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
const CHECK_STMT = "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlüften.";

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
  }
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = KEY;
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

type App = ReturnType<typeof buildApp>;

async function angemeldet() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@r0708.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@r0708.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

/** Ein eingereichtes, noch nicht validiertes Wissensobjekt (Zustand „offen"). */
async function eingereicht(app: App, headers: Record<string, string>) {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: TITEL,
      statement: SEED_STMT,
      type: "best_practice",
      category: "Instandhaltung",
      neededValidations: 1,
    },
  });
  return created.json().id as string;
}

/** Dasselbe, danach validiert (rate up). */
async function validiert(app: App, headers: Record<string, string>) {
  const id = await eingereicht(app, headers);
  await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  return id;
}

interface Treffer {
  koId: string;
  pruefstand: string | null;
}

async function pruefe(
  app: App,
  kopf: Record<string, string>,
  zusatz: Record<string, unknown>,
): Promise<{ treffer: Treffer[]; note: string | null }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/check-text",
    headers: kopf,
    payload: { text: CHECK_STMT, title: TITEL, ...zusatz },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json() as { duplicates: Treffer[]; note: string | null };
  return { treffer: body.duplicates, note: body.note };
}

describe("R-0708 · die Zustimmung entscheidet am Pruefweg, was einbezogen wird", () => {
  it("Z1 · ohne Zustimmung (`false`): der Eingereichte bleibt draussen, der Hinweis schweigt", async () => {
    const { app, headers } = await angemeldet();
    const offenId = await eingereicht(app, headers);
    const ohne = await pruefe(app, headers, { ungeprueftEinbeziehen: false });
    expect(ohne.treffer.some((d) => d.koId === offenId)).toBe(false);
    expect(ohne.note ?? "").not.toContain("nicht validiert");
  });

  it("Z1b · Kalibrierung: ohne Zustimmung bleibt der VALIDIERTE Eintrag ein Treffer", async () => {
    // Ohne diese Probe koennte „kein Treffer" in Z1 auch eine Route sein, die gar nichts findet.
    const { app, headers } = await angemeldet();
    const validId = await validiert(app, headers);
    const ohne = await pruefe(app, headers, { ungeprueftEinbeziehen: false });
    const treffer = ohne.treffer.find((d) => d.koId === validId);
    expect(treffer, "der validierte Eintrag muss gefunden werden").toBeDefined();
    expect(treffer?.pruefstand).toBe("validiert");
  });

  it("Z2 · mit Zustimmung (`true`): der Eingereichte wird gefunden und als „eingereicht“ benannt", async () => {
    const { app, headers } = await angemeldet();
    const offenId = await eingereicht(app, headers);
    const mit = await pruefe(app, headers, { ungeprueftEinbeziehen: true });
    const treffer = mit.treffer.find((d) => d.koId === offenId);
    expect(treffer, "mit Zustimmung muss der eingereichte Eintrag erscheinen").toBeDefined();
    expect(treffer?.pruefstand).toBe("eingereicht");
    expect(mit.note).toContain("nicht validiert");
  });
});

describe("R-0708 · der Weg der Erfassung und der Add-in-Schluessel bleiben, wie sie sind", () => {
  it("E1 · ohne das Feld (Weg der Erfassung, JOB 3020): der Eingereichte wird weiter gefunden", async () => {
    const { app, headers } = await angemeldet();
    const offenId = await eingereicht(app, headers);
    const erfassung = await pruefe(app, headers, {});
    expect(erfassung.treffer.some((d) => d.koId === offenId)).toBe(true);
    expect(erfassung.note).toContain("nicht validiert");
  });

  it("E2 · am Add-in-Schluessel oeffnet auch `true` nichts: nur Validiertes", async () => {
    const { app, headers } = await angemeldet();
    const offenId = await eingereicht(app, headers);
    const alsAddin = await pruefe(
      app,
      { [ADDON_KEY_HEADER]: KEY },
      { ungeprueftEinbeziehen: true },
    );
    expect(alsAddin.treffer.some((d) => d.koId === offenId)).toBe(false);
    expect(alsAddin.note).toBeNull();
  });
});
