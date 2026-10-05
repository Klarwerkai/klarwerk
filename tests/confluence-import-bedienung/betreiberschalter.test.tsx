// @vitest-environment jsdom
// ================================================================================================
// R-0134 / R-1005 — DER BETREIBER SCHALTET DEN CONFLUENCE-IMPORT ÜBER DIE OBERFLÄCHE EIN UND AUS.
// ================================================================================================
//
// Bens Befund: Die Bedienung las den Zustand und sperrte den Start — aber eingeschaltet werden
// konnte der Import nur auf dem Server, und die bisherige Gegenprobe setzte nur den Abfragespeicher.
// Hier ist es der ECHTE Weg: Zugangskasten → Knopf → `PUT /api/import/confluence/schalter` →
// gespeicherter Betreiberschalter → jede Confluence-Importroute lehnt ab (409) → die Lauf-Karte
// sperrt den Start mit eigenem Grund → wieder einschalten → der Import läuft wirklich.
//
// Ersetzt ist allein die Antwort der externen Confluence-Instanz (`confluence-buehne.ts`).
//
//   B1  AUS UND WIEDER AN, über den Knopf — mit Durchsetzung an allen fünf Importrouten,
//       Prüfprotokoll und ohne Zugangsdaten im Spiel.
//   B2  OHNE FREIGABE der Installation: kein Knopf, und der Schreibweg lehnt ehrlich ab.
//   B3  OHNE ANMELDUNG: kein Umlegen (die volle Rollenmatrix fährt die Beta-Rollenabnahme,
//       `tests/beta-rollenabnahme/schreibende-tueren.ts`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ImportAccessPanel } from "../../apps/web/src/components/ImportAccessPanel";
import i18n from "../../apps/web/src/i18n";
import { ImportRunPanel } from "../../apps/web/src/pages/Stufe2";
import { warteAufOffeneImportLaeufe } from "../../services/app/src/routes/confluence-import-routes";
import { type Buehne, TOKEN, baueBuehne, confluenceInstanz, seite } from "./confluence-buehne";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IMPORTROUTEN = [
  "/api/admin/import/confluence",
  "/api/admin/import/confluence/explore",
  "/api/admin/import/confluence/select",
  "/api/admin/import/confluence/group",
  "/api/admin/import/confluence/apply",
];

let b: Buehne | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function warteBis(bedingung: () => boolean, ms = 8000): Promise<void> {
  const ende = Date.now() + ms;
  while (!bedingung() && Date.now() < ende) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

const el = (testid: string): Element | null =>
  container?.querySelector(`[data-testid="${testid}"]`) ?? null;

/** Die Importseite, soweit sie hier zählt: Zugangskasten und Lauf-Karte unter EINEM Client. */
async function seiteOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(ToastProvider, null, [
              createElement(ImportAccessPanel, { key: "zugang" }),
              createElement(ImportRunPanel, { key: "lauf" }),
            ]),
          ),
        ),
      ),
    );
  });
  await warteBis(() => el("import-access-state") !== null);
}

async function klick(element: Element | null): Promise<void> {
  expect(element, "das Bedienelement fehlt").toBeTruthy();
  await act(async () => {
    (element as HTMLElement).click();
  });
}

async function importroutenStatus(buehne: Buehne): Promise<number[]> {
  const status: number[] = [];
  for (const url of IMPORTROUTEN) {
    const res = await buehne.app.inject({ method: "POST", url, headers: buehne.kopf, payload: {} });
    status.push(res.statusCode);
    if (res.statusCode === 409) {
      expect((res.json() as { error?: string }).error, url).toBe("IMPORT_SWITCHED_OFF");
    }
  }
  return status;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    const r = root;
    await act(async () => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  b?.abbauen();
  b = null;
});

describe("R-0134 / R-1005 · der Betreiberschalter, bedient und durchgesetzt", () => {
  it("B1 · aus über den Knopf → alle Importrouten lehnen ab, Start gesperrt → an → der Import läuft", async () => {
    const instanz = confluenceInstanz({
      ergebnisseiten: [[seite("501", "Wartung Pumpe", 1, "Pumpe vor dem Anlauf prüfen.")]],
    });
    b = await baueBuehne({ fetchFn: instanz.fetchFn, freigabe: true });
    const buehne = b;
    await seiteOeffnen();

    // Ausgangslage: freigegeben, nie umgelegt ⇒ an. Der Knopf bietet „ausschalten" an.
    expect(el("import-access-state")?.getAttribute("data-state")).toBe("ready");
    expect(el("import-access-schalter")?.getAttribute("data-an")).toBe("yes");
    expect(el("import-access-schalter")?.textContent).toBe(i18n.t("imp.access.schalter.aus"));

    // AUSSCHALTEN — über den Knopf, nicht über den Abfragespeicher.
    await klick(el("import-access-schalter"));
    await warteBis(() => el("import-access-schalter")?.getAttribute("data-an") === "no");
    expect(buehne.aufrufe).toContainEqual({
      method: "PUT",
      url: "/api/import/confluence/schalter",
    });
    expect(el("import-access-state")?.getAttribute("data-state")).toBe("switched-off");
    expect(el("import-access-state")?.textContent).toBe(i18n.t("imp.access.switchedOff.title"));
    expect(el("import-access-schalter")?.textContent).toBe(i18n.t("imp.access.schalter.an"));
    // Die Lauf-Karte liest denselben Stand und sperrt den Start mit EIGENEM Grund.
    const start = (): HTMLButtonElement | null =>
      container?.querySelector<HTMLButtonElement>('[data-testid="f0140-start"]') ?? null;
    expect(start()?.disabled).toBe(true);
    expect(el("f0140-gesperrt")?.getAttribute("data-state")).toBe("switched-off");
    expect(el("f0140-gesperrt")?.textContent).toBe(i18n.t("w2.run.gesperrt.switchedOff"));

    // DURCHGESETZT AM SERVER — jede der fünf Importrouten, auch an der Fläche vorbei.
    expect(await importroutenStatus(buehne)).toEqual([409, 409, 409, 409, 409]);
    // Bei ausgeschaltetem Import wird Confluence gar nicht erst gefragt.
    expect(instanz.abrufe).toEqual([]);
    // Die Auskunft sagt dasselbe — und der Stand ist gespeichert, nicht nur angezeigt.
    const zugang = await buehne.app.inject({
      method: "GET",
      url: "/api/import/confluence/zugang",
      headers: buehne.kopf,
    });
    expect(zugang.json()).toMatchObject({
      enabled: false,
      betreiber: { freigegeben: true, an: false },
    });
    const schalter = buehne.dienste.confluenceImportSchalter;
    expect(await schalter.lies()).toEqual({ an: false, version: 1 });
    // Nachvollziehbar: wer, was, alt → neu.
    const protokoll = await buehne.dienste.audit.list({
      action: "confluence-import.betreiberschalter",
    });
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0]?.payload).toMatchObject({ vorherAn: true, an: false, version: 1 });

    // WIEDER EINSCHALTEN — und der Import läuft wirklich, über den Startknopf.
    await klick(el("import-access-schalter"));
    await warteBis(() => el("import-access-schalter")?.getAttribute("data-an") === "yes");
    expect(el("import-access-state")?.getAttribute("data-state")).toBe("ready");
    await warteBis(() => start()?.disabled === false);
    expect(el("f0140-gesperrt")).toBeNull();
    await klick(start());
    await warteBis(() => buehne.aufrufe.some((a) => a.url.includes("/api/admin/import/runs/")));
    await warteAufOffeneImportLaeufe(buehne.dienste.importRuns);
    const kandidaten = await buehne.app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: buehne.kopf,
    });
    const liste = kandidaten.json() as Array<{ item: { externalId?: string } }>;
    expect(liste.map((k) => k.item.externalId)).toEqual(["501"]);
    const protokollDanach = await buehne.dienste.audit.list({
      action: "confluence-import.betreiberschalter",
    });
    expect(protokollDanach).toHaveLength(2);

    // Kein Zugangswert irgendwo — der Schalter nimmt keinen entgegen und gibt keinen aus.
    expect(container?.textContent ?? "").not.toContain(TOKEN);
    expect(zugang.body).not.toContain(TOKEN);
    expect(container?.querySelectorAll("input, textarea, form").length).toBe(0);
  });

  it("B2 · ohne Freigabe der Installation: kein Knopf, und der Schreibweg lehnt ehrlich ab", async () => {
    b = await baueBuehne({ fetchFn: confluenceInstanz({ ergebnisseiten: [[]] }).fetchFn });
    const buehne = b;
    await seiteOeffnen();

    expect(el("import-access-state")?.getAttribute("data-state")).toBe("disabled");
    expect(el("import-access-schalter")).toBeNull();
    const res = await buehne.app.inject({
      method: "PUT",
      url: "/api/import/confluence/schalter",
      headers: buehne.kopf,
      payload: { an: false },
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error?: string }).error).toBe("IMPORT_NOT_RELEASED");
    // Nichts gespeichert — ein „aus", das nichts bewirken kann, wird nicht behauptet.
    const schalter = buehne.dienste.confluenceImportSchalter;
    expect(await schalter.lies()).toEqual({ an: true, version: 0 });
  });

  it("B3 · ohne Anmeldung und mit falschem Rumpf wird nichts umgelegt", async () => {
    b = await baueBuehne({
      fetchFn: confluenceInstanz({ ergebnisseiten: [[]] }).fetchFn,
      freigabe: true,
    });
    const buehne = b;
    const anonym = await buehne.app.inject({
      method: "PUT",
      url: "/api/import/confluence/schalter",
      payload: { an: false },
    });
    expect(anonym.statusCode).toBe(401);
    // Ein Rumpf, der kein Ja/Nein ist, ist kein Schalterstand — auch kein Zugangswert.
    const falsch = await buehne.app.inject({
      method: "PUT",
      url: "/api/import/confluence/schalter",
      headers: buehne.kopf,
      payload: { an: "aus", token: TOKEN },
    });
    expect(falsch.statusCode).toBe(400);
    expect(falsch.body).not.toContain(TOKEN);
    const schalter = buehne.dienste.confluenceImportSchalter;
    expect(await schalter.lies()).toEqual({ an: true, version: 0 });
  });
});
