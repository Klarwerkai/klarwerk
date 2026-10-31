import type { Page } from "playwright-core";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";

export const EMAIL = "admin@webb9-fiktiv.test";
export const TITEL = "Fiktive WEBB9 Prüfquelle";
export const ANTWORT = "Fiktiver Prüfhinweis: zuerst die Anlage stillsetzen.";
export const RECEIPT = "webb9-fiktiver-eigener-antwortbeleg";
export const WEG = "Mein fiktiver eigener Prüfweg";
export const RUECKMELDUNG = `Das war nicht hilfreich, ich habe es so gemacht: ${WEG}`;

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export async function fragenWelt() {
  const services = assembleServices(inMemoryRepos());
  const app = buildApp(services);
  const erreicht = signal();
  const weiter = signal();
  const laeufe = new Set<Promise<void>>();
  const posts: Record<string, unknown>[] = [];
  const lage = { askAufrufe: 0 };
  let seite: Page | undefined;
  const ziel = (url: URL) => url.pathname === "/api/ask/not-helpful";
  try {
    await mitFlaeche().vorListen(app);
    const basis = await app.listen({ host: "127.0.0.1", port: 0 });
    const strecke: Strecke = {
      app,
      basis,
      profil: (name, sprache) => new Sitzung(basis, name, sprache),
      schliessen: () => app.close(),
    };
    const { sitzung: admin, admin: konto } = await ersteinrichtung(strecke, EMAIL);
    mussGelingen("Hinweis bestätigen", await admin.sende("POST", "/api/auth/notice"));
    const angelegt = mussGelingen(
      "Fiktive Quelle anlegen",
      await admin.sende("POST", "/api/kos", {
        title: TITEL,
        statement: ANTWORT,
        type: "best_practice",
        category: "WEBB9 fiktiv",
        confidentiality: "intern",
      }),
      201,
    ).json as { id: string };
    await services.aiCheckWorker?.idle();
    await services.ko.setValidationState(angelegt.id, { trust: 90, status: "validiert" });
    const ko = mussGelingen(
      "Eigene Quelle lesen",
      await admin.sende("GET", `/api/kos/${angelegt.id}`),
    ).json as { id: string; version: number };
    const key = `kw.fragen.arbeitsstand.v1:${konto.id}`;
    const stand = {
      entwurf: "",
      antwort: {
        frage: "Welche fiktive Prüfung ist vorgesehen?",
        result: {
          answered: true,
          answer: ANTWORT,
          knowledgeClass: "gesichert",
          trust: 90,
          sources: [ko.id],
          citedSources: [ko.id],
          steps: [],
          demo: false,
        },
        receipt: RECEIPT,
        verschlossen: [],
        gapId: null,
        angezeigtAm: new Date().toISOString(),
        serverQuellenStand: { [ko.id]: ko.version },
      },
      startadressen: [],
    };
    return {
      basis,
      key,
      stand,
      koId: ko.id,
      kontoId: konto.id,
      posts,
      lage,
      erreicht: erreicht.promise,
      freigeben: () => weiter.resolve(),
      async steuern(p: Page) {
        seite = p;
        // Nur die lesende Verfügbarkeitsauskunft ist gesetzt; kein Modell wird aufgerufen.
        await p.route(
          (url) => url.pathname === "/api/reasoner/status",
          async (route) => {
            const original = await route.fetch();
            try {
              const status = await original.json();
              await route.fulfill({
                response: original,
                json: {
                  ...status,
                  active: true,
                  tasks: { ...status.tasks, answer: true },
                },
              });
            } finally {
              await original.dispose();
            }
          },
        );
        await p.route(
          (url) => url.pathname === "/api/ask",
          async (route) => {
            lage.askAufrufe += 1;
            await route.fulfill({
              status: 503,
              json: { error: "KEIN_MODELL_IM_WEBB9_PRUEFSTAND" },
            });
          },
        );
        await p.route(ziel, async (route) => {
          const lauf = (async () => {
            if (route.request().method() !== "POST")
              throw new Error("Nur POST-Rückmeldung erwartet");
            posts.push(route.request().postDataJSON() as Record<string, unknown>);
            erreicht.resolve();
            await weiter.promise;
            // Kontrollierte HTTP-Bestätigung des fiktiven Antwortbelegs, kein Callbackersatz.
            await route.fulfill({ status: 200, json: { vermerkt: true, entwurfId: null } });
          })();
          laeufe.add(lauf);
          try {
            await lauf;
          } finally {
            laeufe.delete(lauf);
          }
        });
      },
      async antwortenAbgeschlossen() {
        await seite?.unroute(ziel);
        await Promise.all([...laeufe]);
      },
      schliessen: () => app.close(),
    };
  } catch (error) {
    weiter.resolve();
    await app.close();
    throw error;
  }
}
export type FragenWelt = Awaited<ReturnType<typeof fragenWelt>>;

// Nur Status und knappe sichere Formen bereits laufender GETs der eigenen Prüfwelt.
export function beobachteEigeneGETs(seite: Page, welt: FragenWelt, belege: Record<string, unknown>[]) {
  seite.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(welt.basis).origin || response.request().method() !== "GET") return;
    if (!["/api/auth/me", "/api/kos", "/api/conflicts", "/api/reasoner/status",
      `/api/kos/${welt.koId}`].includes(url.pathname)) return;
    const beleg: Record<string, unknown> = { pfad: url.pathname, status: response.status() };
    try {
      const daten: unknown = await response.json();
      const obj = daten && typeof daten === "object" && !Array.isArray(daten)
        ? daten as Record<string, unknown> : {};
      const user = obj.user && typeof obj.user === "object"
        ? obj.user as Record<string, unknown> : obj;
      const tasks = obj.tasks && typeof obj.tasks === "object"
        ? obj.tasks as Record<string, unknown> : {};
      beleg.form = Array.isArray(daten) ? "array" : typeof daten;
      beleg.anzahl = Array.isArray(daten) ? daten.length : null;
      beleg.felder = Object.keys(obj).filter((k) =>
        ["user", "id", "role", "status", "version", "active", "tasks", "error", "permissions"].includes(k));
      beleg.eigeneKontoId = user.id === welt.kontoId ? welt.kontoId : null;
      beleg.eigeneQuellId = obj.id === welt.koId ? welt.koId : null;
      beleg.rolle = ["admin", "controller", "editor", "viewer"].includes(String(user.role)) ? user.role : null;
      beleg.version = typeof obj.version === "number" ? obj.version : null;
      beleg.active = typeof obj.active === "boolean" ? obj.active : null;
      beleg.answer = typeof tasks.answer === "boolean" ? tasks.answer : null;
    } catch {
      beleg.form = "nicht als JSON lesbar";
    }
    belege.push(beleg);
  });
}
