// @vitest-environment jsdom
// ================================================================================================
// JOB 4022 · EINSTIEG-HILFE — DER GEFÜHRTE ERSTE ARBEITSWEG FÜHRT NIEMANDEN MEHR INS LEERE.
// ================================================================================================
//
// DER BEFUND (gemessen am Stand 1.0.0-beta.1.503): Die Einstiegsführung auf der Hilfeseite trug je
// Schritt einen Link „Bereich öffnen". Vier ihrer fünf Schritte zeigten auf Routen, die ein
// Betrachter nicht betreten darf (`/erfassen` experte, `/validierung`, `/risiko`, `/lebenszyklus`
// controller — `app/navigation.ts`). Die Hilfeseite selbst steht jeder Rolle offen
// (`navigation.ts:348-357`); der Klick endete also in der Sperrkarte `RoleNotice`
// (`routes.tsx:184-188`). Die Liste wurde genau denen gezeigt, für die sie nicht galt.
//
// WAS HIER GEMESSEN WIRD, und warum gemountet: `lib/pilotChecklist.ts` ist DOM-frei und im
// Zwilling `tests/app/pilot-checklist.test.ts` geprüft. Er bliebe grün, wenn die SEITE die
// Rollenauskunft gar nicht liest — gebaut und nie gerufen ist der teuerste Fehler dieses Projekts.
// Geprüft wird deshalb die echte Seite `pages/Help.tsx` mit echtem Router und echtem i18n.
//
// DIE LISTE WIRD AN IHREM INHALT GEFUNDEN, nicht an einer Testmarke (`einstiegsListe()`): genau so
// war dieser Fall auch am ALTEN Stand messbar und wurde dort rot — G1 fand vier Links, G2 fand
// keinen Rollensatz, G4 fand die Schritte `/start` und `/bibliothek` überhaupt nicht.
//
// DIE VIER GEGENPROBEN (in der RUECKGABE mit Ergebnis protokolliert):
//   a) Rollenherleitung auf die feste Zeichenfolge "viewer" umstellen  → G1/G2 rot
//   b) einen Schritt auf `/gibtesnicht` zeigen lassen                  → G5 rot
//   c) den NL-Text eines neuen Schlüssels entfernen                    → G6 rot
//   d) die Rollenprüfung invertieren                                   → G3 rot
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ALL_ITEMS, ROLES, ROLE_RANK, type Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { PILOT_CHECKLIST, type PilotCheckItem } from "../../apps/web/src/lib/pilotChecklist";
import { Help } from "../../apps/web/src/pages/Help";
import { alleSprachbestaende } from "../support/i18nBestand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Die EINE Rollenquelle der Anwendung, hier gesteuert. Die Attrappe gibt genau die Form zurück, die
// `RoleContext` liefert — mehr liest die Seite nicht.
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

const SPRACHEN = ["de", "en", "nl"] as const;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function hilfeMounten(rolle: Role, sprache: string): Promise<void> {
  rollenquelle.rolle = rolle;
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
  });
}

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

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Hilfeseite ist nicht montiert.");
  }
  return container;
}

function schritt(id: string): PilotCheckItem {
  const gefunden = PILOT_CHECKLIST.find((item) => item.id === id);
  if (!gefunden) {
    throw new Error(`Schritt fehlt in der Einstiegsführung: ${id}`);
  }
  return gefunden;
}

/**
 * Die EINE Einstiegsführung auf der Seite — an ihrem Inhalt erkannt.
 *
 * Der Anker ist der Text des Schrittes „use", der die Liste seit SCRUM-305 trägt. Dass genau EINE
 * Liste ihn führt, ist zugleich der Nachweis von Lieferung 7: es entsteht keine zweite Liste
 * daneben.
 */
function einstiegsListe(): HTMLElement {
  const anker = i18n.t(schritt("use").labelKey);
  const treffer = [...flaeche().querySelectorAll("ol")].filter((liste) =>
    (liste.textContent ?? "").includes(anker),
  );
  expect(treffer, "genau EINE Einstiegsführung auf der Hilfeseite").toHaveLength(1);
  return treffer[0] as HTMLElement;
}

function zeile(id: string): HTMLElement {
  const text = i18n.t(schritt(id).labelKey);
  const gefunden = [...einstiegsListe().querySelectorAll("li")].find((li) =>
    (li.textContent ?? "").includes(text),
  );
  if (!gefunden) {
    throw new Error(`Die Einstiegsführung zeigt den Schritt „${id}" nicht.`);
  }
  return gefunden as HTMLElement;
}

/** Die verlangte Rolle — aus derselben Quelle, über die der Router entscheidet. */
function mindestrolle(id: string): Role {
  const ziel = schritt(id).to;
  const eintrag = ALL_ITEMS.find((item) => item.path === ziel);
  if (!eintrag) {
    throw new Error(`Route ohne Navigationseintrag: ${ziel}`);
  }
  return eintrag.minRole;
}

function darfHinein(id: string, rolle: Role): boolean {
  return ROLE_RANK[rolle] >= ROLE_RANK[mindestrolle(id)];
}

function sperrsatz(id: string): string {
  return i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${mindestrolle(id)}`) });
}

/** Die ganze Karte: Überschrift, Zugangszeile und Liste — das, was der Mensch dort liest. */
function karte(): HTMLElement {
  const eltern = einstiegsListe().parentElement;
  if (!eltern) {
    throw new Error("Die Einstiegsführung steht in keiner Karte.");
  }
  expect(eltern.textContent ?? "", "die Karte trägt ihre Überschrift").toContain(
    i18n.t("pilot.access.title"),
  );
  return eltern;
}

describe("JOB 4022 · die Einstiegsführung auf der Hilfeseite kennt die Rolle des Lesenden", () => {
  for (const sprache of SPRACHEN) {
    // G6: G1–G4 laufen in allen drei Sprachen — jede Sprache mit ihrem eigenen Wortlaut.
    describe(`Sprache ${sprache}`, () => {
      it("G1: als Betrachter führt kein Schritt in die Absage", async () => {
        await hilfeMounten("viewer", sprache);
        const gesperrt = PILOT_CHECKLIST.filter((item) => !darfHinein(item.id, "viewer"));
        expect(gesperrt.length, "es gibt überhaupt gesperrte Schritte zu prüfen").toBeGreaterThan(
          0,
        );
        for (const item of gesperrt) {
          expect(
            zeile(item.id).querySelector("a"),
            `Schritt „${item.id}" (${item.to}) bietet einem Betrachter einen Link in die Sperrkarte`,
          ).toBeNull();
        }
      });

      it("G2: jeder gesperrte Schritt nennt die Rolle, die er verlangt", async () => {
        await hilfeMounten("viewer", sprache);
        for (const item of PILOT_CHECKLIST.filter((s) => !darfHinein(s.id, "viewer"))) {
          expect(zeile(item.id).textContent ?? "").toContain(sperrsatz(item.id));
          // Der Schritttext selbst bleibt lesbar — der Gast soll den ganzen Weg kennen.
          expect(zeile(item.id).textContent ?? "").toContain(i18n.t(item.labelKey));
        }
      });

      it("G3: als Controller sind dieselben Schritte begehbar und tragen ihren Link", async () => {
        await hilfeMounten("controller", sprache);
        const offen = PILOT_CHECKLIST.filter((item) => darfHinein(item.id, "controller"));
        expect(offen.length, "ein Controller darf mehr als der Betrachter").toBeGreaterThan(
          PILOT_CHECKLIST.filter((item) => darfHinein(item.id, "viewer")).length,
        );
        for (const item of offen) {
          const link = zeile(item.id).querySelector("a");
          expect(
            link,
            `Schritt „${item.id}" trägt für einen Controller keinen Link`,
          ).not.toBeNull();
          expect(link?.getAttribute("href")).toBe(item.to);
          expect(zeile(item.id).textContent ?? "").not.toContain(
            i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${mindestrolle(item.id)}`) }),
          );
        }
      });

      it("G4: der Weg /start → /fragen → /bibliothek steht da und ist für den Gast ganz begehbar", async () => {
        await hilfeMounten("viewer", sprache);
        for (const ziel of ["/start", "/fragen", "/bibliothek"]) {
          const item = PILOT_CHECKLIST.find((s) => s.to === ziel);
          if (!item) {
            throw new Error(`Die Einstiegsführung führt nicht nach ${ziel}.`);
          }
          expect(darfHinein(item.id, "viewer"), `${ziel} ist für einen Gast gar nicht offen`).toBe(
            true,
          );
          const link = zeile(item.id).querySelector("a");
          expect(link, `Der Schritt nach ${ziel} trägt keinen Link`).not.toBeNull();
          expect(link?.getAttribute("href")).toBe(ziel);
        }
      });

      it("L3: die Karte sagt gerechnet, wie viel des Weges der Rolle offensteht", async () => {
        await hilfeMounten("viewer", sprache);
        const offenGast = PILOT_CHECKLIST.filter((item) => darfHinein(item.id, "viewer")).length;
        const satzGast = i18n.t("pilot.access.summary", {
          rolle: i18n.t("role.name.viewer"),
          offen: offenGast,
          gesamt: PILOT_CHECKLIST.length,
        });
        expect(flaeche().textContent ?? "").toContain(satzGast);

        await act(async () => {
          root?.unmount();
        });
        container?.remove();
        root = null;
        container = null;

        await hilfeMounten("controller", sprache);
        const offenController = PILOT_CHECKLIST.filter((item) =>
          darfHinein(item.id, "controller"),
        ).length;
        expect(flaeche().textContent ?? "").toContain(
          i18n.t("pilot.access.summary", {
            rolle: i18n.t("role.name.controller"),
            offen: offenController,
            gesamt: PILOT_CHECKLIST.length,
          }),
        );
        // Gerechnet, nicht verdrahtet: dieselbe Liste, zwei Rollen, zwei verschiedene Zahlen.
        expect(offenController).not.toBe(offenGast);
      });

      // ==========================================================================================
      // G7 — DIE KARTE SPRICHT DIE SPRACHE DES ANWENDERS (Steuerungs-Nachführung 14.09. 18:16).
      // ==========================================================================================
      // Codex' Bedienbefund (17:45, Screenshot `13-hilfe.png`) fand auf der echten Hilfeseite
      // Systemsprache: „Stage-1, ehrlich", „Review/Entscheidung", „Peers". Pedi (16:49): „Es ist
      // ein Unterschied, als wenn ein Anwender daran arbeitet oder du als System." Gemessen wird
      // am DOM und für JEDE Rolle — und zwar an der ganzen Karte, nicht nur an den Schritttexten.
      it("G7: kein interner Begriff in der Karte, und jeder Schritt bleibt für jede Rolle lesbar", async () => {
        const intern = ["Stage-1", "Stage 1", "Peers", "peers", "Review", "review"];
        for (const rolle of ROLES) {
          await hilfeMounten(rolle, sprache);
          const text = karte().textContent ?? "";
          for (const begriff of intern) {
            expect(text, `„${begriff}" steht für ${rolle} (${sprache}) in der Karte`).not.toContain(
              begriff,
            );
          }
          for (const item of PILOT_CHECKLIST) {
            expect(text, `Schritt „${item.id}" fehlt für ${rolle}`).toContain(
              i18n.t(item.labelKey),
            );
          }
          await act(async () => {
            root?.unmount();
          });
          container?.remove();
          root = null;
          container = null;
        }
      });
    });
  }

  it("G5 (Wächter): jeder Schritt zeigt auf eine Route, die es in ALL_ITEMS gibt", () => {
    const bekannt = new Set(ALL_ITEMS.map((item) => item.path));
    for (const item of PILOT_CHECKLIST) {
      expect(bekannt.has(item.to), `Schritt „${item.id}" zeigt ins Nichts: ${item.to}`).toBe(true);
    }
  });

  it("G6: die neuen Sätze stehen in DE, EN und NL — jede Sprache mit eigenem Wortlaut", () => {
    const bestaende = alleSprachbestaende();
    const neueSchluessel = [
      "pilot.access.title",
      "pilot.access.subtitle",
      "pilot.access.summary",
      "pilot.access.locked",
      "pilot.access.roleUnknown",
      "pilot.check.start",
      "pilot.check.library",
    ];
    for (const key of neueSchluessel) {
      const texte = SPRACHEN.map((sprache) => bestaende[sprache]?.[key] ?? "");
      for (const [i, text] of texte.entries()) {
        expect(text.length, `${key} fehlt in ${SPRACHEN[i]}`).toBeGreaterThan(0);
      }
      expect(new Set(texte).size, `${key} erbt einen fremden Wortlaut`).toBe(SPRACHEN.length);
    }
  });
});
