// @vitest-environment jsdom
// ================================================================================================
// FR-I18N-02 · „NEUE SPRACHE OHNE CODE-UMBAU ERGÄNZBAR" — DURCHGÄNGIG, VOM ANLEGEN BIS ZUM NEUÖFFNEN.
// ================================================================================================
//
// BEN, Nacharbeit 3: Bis hierher waren Anlegen, Pflegen und Speichern einer weiteren Sprache belegt,
// ihre NUTZUNG nicht — sie stand weder im Kontomenü noch im Profil, und die gespeicherte Wahl nahm
// sie nicht an. Dieser Fall fährt den ganzen Weg:
//
//   D1  Eine Administratorin legt „fr" an und pflegt einen Oberflächentext — über dieselben
//       Clientwege, die die Karte Verwaltung › System › Übersetzungen benutzt (`endpoints.i18n`).
//   D2  Der Startabgleich (`gleicheAngelegteSprachenAb`, wie in `main.tsx`) macht „fr" wählbar; das
//       ECHTE Kontomenü (`components/SprachSchalter.tsx`) zeigt einen Knopf dafür.
//   D3  Ein Klick wählt „fr"; der gepflegte Text steht da, die Wahl ist gespeichert.
//   D4  Neu öffnen: frische Module (wie ein Neuladen der Seite) starten in „fr" und zeigen den
//       gepflegten Text wieder — ein nicht übersetzter Text fällt auf Deutsch zurück.
//   D5  Nimmt der Server die Sprache nicht mehr, fällt der nächste Start auf die Vorgabe zurück.
//
// DIE APP IST ECHT (`buildApp(buildServices())`, Routen aus `i18n-routes.ts`); ersetzt ist allein
// der Transport: `globalThis.fetch` liegt auf `app.inject` — dieselbe Bauform wie
// `tests/supportkontakt/help-mounted.test.tsx`.
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const SCHLUESSEL = "prof.language";
const NICHT_UEBERSETZT = "uebersetzungen.titel";

let app: FastifyInstance;
let adminToken = "";
let vorherigerFetch: typeof globalThis.fetch;

function drahtLegen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.authorization = `Bearer ${adminToken}`;
    const antwort = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: String(eingabe),
      headers: kopf,
      ...(typeof init?.body === "string" ? { payload: init.body } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

async function ruhe(runden = 20): Promise<void> {
  const { act } = await import("../../apps/web/node_modules/react");
  for (let i = 0; i < runden; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Startet die Webmodule frisch — so, wie ein Neuladen der Seite sie auswertet (vgl. `main.tsx`). */
async function starteWeb() {
  vi.resetModules();
  const i18nModul = await import("../../apps/web/src/i18n");
  await i18nModul.sprachBereit;
  const i18n = i18nModul.default;
  const { endpoints } = await import("../../apps/web/src/api/endpoints");
  const { bindTextpflege } = await import("../../apps/web/src/lib/textpflege");
  const { STANDARD_SPRACHE, bindSpracheSpeichern } = await import(
    "../../apps/web/src/lib/sprachwahl"
  );
  const { gleicheAngelegteSprachenAb } = await import("../../apps/web/src/lib/instanzSprachen");
  const abmelden = [
    bindSpracheSpeichern(i18n),
    bindTextpflege(i18n, (s) => endpoints.i18n.texte(s).then((a) => a.texte)),
  ];
  await gleicheAngelegteSprachenAb(i18n, endpoints.i18n.sprachen, STANDARD_SPRACHE);
  await ruhe();
  return {
    i18n,
    endpoints,
    abmelden: () => {
      for (const f of abmelden) {
        f();
      }
    },
  };
}

beforeAll(async () => {
  window.localStorage.clear();
  app = buildApp(buildServices());
  await app.ready();
  const marke = Math.random().toString(36).slice(2, 8);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: `ada@${marke}.test`, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: `ada@${marke}.test`, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  adminToken = login.json().token as string;
  drahtLegen();
});

afterAll(async () => {
  globalThis.fetch = vorherigerFetch;
  window.localStorage.clear();
  await app.close();
});

describe("FR-I18N-02 · eine weitere Sprache anlegen, pflegen, wählen und nach dem Neuöffnen nutzen", () => {
  it("D1–D5 · der ganze Weg ohne Codeänderung", async () => {
    // ---- D1 · anlegen und pflegen ---------------------------------------------------------------
    const erst = await starteWeb();
    expect(erst.i18n.language, "Vorbedingung: Erststart auf Deutsch").toBe("de");
    await erst.endpoints.i18n.setzeSprache("fr", "Français");
    await erst.endpoints.i18n.setzeText("fr", SCHLUESSEL, "Langue");

    // ---- D2 · der Abgleich macht „fr“ im echten Kontomenü wählbar -------------------------------
    const { gleicheAngelegteSprachenAb, waehlbareSprachen } = await import(
      "../../apps/web/src/lib/instanzSprachen"
    );
    await gleicheAngelegteSprachenAb(erst.i18n, erst.endpoints.i18n.sprachen, "de");
    expect(waehlbareSprachen()).toEqual(["de", "en", "nl", "fr"]);

    const { act, createElement } = await import("../../apps/web/node_modules/react");
    const { createRoot } = await import("../../apps/web/node_modules/react-dom/client");
    const { SprachSchalter } = await import("../../apps/web/src/components/SprachSchalter");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(SprachSchalter));
    });
    await ruhe();
    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="sprach-schalter-fr"]');
    expect(knopf, "die angelegte Sprache steht im Kontomenü").not.toBeNull();
    expect(knopf?.getAttribute("aria-label")).toBe("Français");

    // ---- D3 · wählen: der gepflegte Text steht da, die Wahl ist gespeichert ----------------------
    await act(async () => {
      knopf?.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await ruhe();
    expect(erst.i18n.language).toBe("fr");
    expect(erst.i18n.t(SCHLUESSEL)).toBe("Langue");
    expect(container.textContent, "das Kontomenü selbst spricht den gepflegten Text").toContain(
      "Langue",
    );
    expect(knopf?.getAttribute("aria-checked")).toBe("true");
    const { SPRACHE_STORAGE_KEY } = await import("../../apps/web/src/lib/sprachwahl");
    expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("fr");
    act(() => {
      root.unmount();
    });
    container.remove();
    erst.abmelden();

    // ---- D4 · neu öffnen: frische Module starten in „fr“ mit dem gepflegten Text ----------------
    // Ob `i18next` beim Neuladen der Module eine frische Instanz liefert oder dieselbe wieder
    // initialisiert, hängt an der Modulauflösung der Testumgebung. Damit D4 in BEIDEN Fällen den
    // Startweg misst und keine Speicherreste: der übernommene fr-Bestand wird entfernt und die
    // Sprache auf Deutsch gestellt — nach dem Abmelden, die gespeicherte Wahl bleibt „fr“.
    erst.i18n.removeResourceBundle("fr", "translation");
    await erst.i18n.changeLanguage("de");
    expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("fr");
    const zweit = await starteWeb();
    expect(zweit.i18n.language, "die gespeicherte Wahl „fr“ gilt beim Neuöffnen").toBe("fr");
    expect(zweit.i18n.t(SCHLUESSEL)).toBe("Langue");
    expect(zweit.i18n.t(NICHT_UEBERSETZT), "nicht Übersetztes fällt auf Deutsch zurück").toBe(
      "Übersetzungen",
    );
    zweit.abmelden();

    // ---- D5 · kennt der Server die Sprache nicht mehr, gilt beim nächsten Start die Vorgabe -----
    const ohneFr = (async () => ({
      locales: ["de", "en", "nl"],
      sprachen: ["de", "en", "nl"].map((k) => ({ kennung: k, name: null, grundsprache: true })),
    })) as typeof zweit.endpoints.i18n.sprachen;
    const dritt = await starteWeb();
    const instanz = await import("../../apps/web/src/lib/instanzSprachen");
    await instanz.gleicheAngelegteSprachenAb(dritt.i18n, ohneFr, "de");
    expect(dritt.i18n.language).toBe("de");
    expect(instanz.waehlbareSprachen()).toEqual(["de", "en", "nl"]);
    dritt.abmelden();
  });
});
