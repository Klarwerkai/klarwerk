// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0443 — DIE EIGENE SEITE „SO ARBEITET KLARWERK“.
// ================================================================================================
//
// DER ORIGINALWORTLAUT: „Eine eigene Seite zeigt dem Anwender, wie das Wissensnetz aufgebaut ist
// und wie mit Klarwerk gearbeitet wird.“
//
// BENS BEFUND (Nacharbeit 5): „Die beauftragte eigene Erklärseite aus R-0443 fehlt weiterhin. Die
// vorhandene aufklappbare Vorführsicht im Wissensnetz … belegt keine Ablösung.“ Korrektur: „Die
// eigene Erklärseite … vervollständigen und erreichbar machen; die gelieferte Vorführsicht dabei
// wiederverwenden.“ Geprüft wird hier die ECHTE Seite `pages/Arbeitsweise.tsx`:
//   W1 · sie erklärt den Aufbau des Wissensnetzes und zeigt die WIEDERVERWENDETE Vorführsicht
//        (`SoArbeitetKlarwerk`) mit den gesetzten Fachbeziehungen aus `/api/graph`;
//   W2 · sie erklärt den Arbeitsweg mit dem Weg in jeden Bereich — und zwar nach Rolle: wo die Rolle
//        nicht reicht, steht der Bereich ohne Link da;
//   W3 · sie liegt in DE, EN und NL vor;
//   W4 · sie ist erreichbar: eigene Route in `routes.tsx` und ein Einstieg oben auf der Hilfeseite.
//
// Ersetzt sind nur die Rollenquelle und die zwei Datenabfragen (`useGraph`, `useKos`) — der Rest der
// Hooks bleibt echt (`importOriginal`).
//
// GEGENPROBEN: die Sicht aus der Seite nehmen → W1 rot; `RoleLink` durch `Link` ersetzen → W2 rot;
// die Route oder den Hilfe-Einstieg entfernen → W4 rot.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Arbeitsweise } from "../../apps/web/src/pages/Arbeitsweise";
import { Help } from "../../apps/web/src/pages/Help";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rollenquelle = vi.hoisted(() => ({ rolle: "viewer" as string }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: rollenquelle.rolle,
    setRole: () => {},
    stufe2: false,
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

/** Zwei sichtbare Einträge und EINE gesetzte Fachbeziehung zwischen ihnen. */
const GRAPH = {
  nodes: [
    { id: "ko-neu", title: "Kessel 2: Grenzdruck acht bar" },
    { id: "ko-alt", title: "Kessel 2: Grenzdruck sechs bar" },
  ],
  edges: [],
  kuratierteKanten: [
    {
      a: "ko-neu",
      b: "ko-alt",
      art: "ersetzt",
      richtung: "gerichtet",
      status: "aktiv",
      herkunft: "kuratiert",
    },
  ],
};

vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useGraph: () => ({ isLoading: false, isError: false, error: null, data: GRAPH }),
  useKos: () => ({
    isLoading: false,
    isError: false,
    error: null,
    data: [{ id: "ko-neu" }, { id: "ko-alt" }],
  }),
}));

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(async () => {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  await i18n.changeLanguage("de");
});

async function mounten(seite: "arbeitsweise" | "hilfe", rolle: string, sprache = "de") {
  rollenquelle.rolle = rolle;
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  const inhalt = seite === "arbeitsweise" ? createElement(Arbeitsweise) : createElement(Help);
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/"] }, inhalt));
  });
  return flaeche;
}

describe("R-0443 · die eigene Seite „So arbeitet Klarwerk“", () => {
  it("W1 · sie erklärt den Aufbau des Wissensnetzes und zeigt die gesetzten Fachbeziehungen", async () => {
    const flaeche = await mounten("arbeitsweise", "viewer");
    expect(flaeche.querySelector("h1")?.textContent).toBe(i18n.t("arbeitsweise.titel"));
    const netz = flaeche.querySelector('[data-testid="arbeitsweise-netz"]');
    for (const key of [
      "arbeitsweise.netz.objekt",
      "arbeitsweise.netz.themen",
      "arbeitsweise.netz.beziehungen",
      "arbeitsweise.netz.stand",
    ]) {
      expect(netz?.textContent, key).toContain(i18n.t(key));
    }
    // Die wiederverwendete Vorführsicht — aufgeklappt zeigt sie die eine gesetzte Beziehung.
    const schalterAuswahl = '[data-testid="graph-sicht-schalter"]';
    const schalter = flaeche.querySelector<HTMLButtonElement>(schalterAuswahl);
    expect(schalter, "die Vorführsicht fehlt auf der Seite").not.toBeNull();
    await act(async () => schalter?.click());
    const beziehungen = flaeche.querySelectorAll('[data-testid="graph-sicht-beziehung"]');
    expect(beziehungen).toHaveLength(1);
    expect(beziehungen[0]?.textContent).toContain("Kessel 2: Grenzdruck acht bar");
    expect(beziehungen[0]?.textContent).toContain("Kessel 2: Grenzdruck sechs bar");
    // Ohne Bild auf dieser Seite: die drei Sätze über Punkte und Linien „im Bild“ stehen nicht da.
    expect(flaeche.textContent).not.toContain(i18n.t("wissensgraph.sicht.schritt1"));
  });

  it("W2 · der Arbeitsweg führt in jeden Bereich — so weit die Rolle reicht", async () => {
    const wege = ["erfassen", "pruefen", "nutzen", "pflegen", "luecken"];
    const alsLink = (flaeche: HTMLElement): string[] =>
      wege.filter(
        (id) => flaeche.querySelector(`[data-testid="arbeitsweise-weg-${id}"]`)?.tagName === "A",
      );
    const betrachter = await mounten("arbeitsweise", "viewer");
    expect(betrachter.querySelectorAll("[data-arbeitsweise-schritt]")).toHaveLength(5);
    expect(alsLink(betrachter)).toEqual(["nutzen"]);
    await act(async () => root?.unmount());
    container?.remove();
    root = null;
    const controller = await mounten("arbeitsweise", "controller");
    expect(alsLink(controller)).toEqual(wege);
  });

  it.each(["en", "nl"] as const)("W3 · %s: Seite in Oberflächensprache", async (s) => {
    const flaeche = await mounten("arbeitsweise", "viewer", s);
    expect(i18n.t("arbeitsweise.titel")).not.toBe(i18n.getFixedT("de")("arbeitsweise.titel"));
    expect(flaeche.querySelector("h1")?.textContent).toBe(i18n.t("arbeitsweise.titel"));
    expect(flaeche.textContent).toContain(i18n.t("arbeitsweise.arbeit.erfassen"));
  });

  it("W4 · erreichbar: eigene Route und ein Einstieg oben auf der Hilfeseite", async () => {
    const routen = readFileSync(repoPfad("apps/web/src/routes.tsx"), "utf8");
    expect(routen).toContain('path="/so-arbeitet-klarwerk" element={<Arbeitsweise />}');
    expect(routen).toContain('import("./pages/Arbeitsweise")');
    const hilfe = await mounten("hilfe", "viewer");
    const einstieg = hilfe.querySelector('[data-testid="hilfe-arbeitsweise"]');
    expect(einstieg?.getAttribute("href")).toBe("/so-arbeitet-klarwerk");
    expect(einstieg?.textContent).toContain(i18n.t("arbeitsweise.einstieg"));
  });
});
