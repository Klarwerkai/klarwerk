// @vitest-environment jsdom
// ================================================================================================
// JOB 4067 · DIE ZWEITE KARTE AUF `/hilfe` — GEMESSEN AM DOM, IN DE, EN UND NL.
// ================================================================================================
//
// WARUM GEMOUNTET, obwohl `wortwahl-waechter.test.ts` dieselben Texte schon DOM-frei prüft: der
// Wächter dort bliebe grün, wenn die SEITE die Schlüssel gar nicht mehr liest oder einen Link
// verlöre. Gebaut und nie gerufen ist der teuerste Fehler dieses Projekts (Kopf von
// `tests/einstieg-gastweg/hilfe-fuehrt-den-gast-nicht-ins-leere.test.tsx`). Hier steht deshalb die
// echte `pages/Help.tsx` mit echtem Router und echtem i18n.
//
// OHNE JEDE UMGEBUNG — kein `<RoleProvider>`, kein React-Query, kein Server. Das ist kein
// Notbehelf, sondern die Zusage der Hilfeseite: sie hängt an keinem Abruf und steht in jedem
// Zustand (laden · leer · Fehler · Cache frisch · Cache veraltet · offline) identisch da
// (`Help.tsx:36-39`, `:60-68`). Drei vorhandene Prüfstände montieren sie genauso.
//
// DIE KARTE WIRD AN IHREM INHALT GEFUNDEN, nicht an einer Testmarke: die `<ul>`, die den Text des
// fünften Eintrags trägt. Dass es genau EINE davon gibt, ist zugleich der Nachweis, dass neben der
// umgestellten Karte keine zweite mit dem alten Textbestand stehen geblieben ist.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { PILOT_OBSERVATIONS } from "../../apps/web/src/lib/pilotObservationGuide";
import { Help } from "../../apps/web/src/pages/Help";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;

// Dieselbe Herkunft wie im Wächter nebenan, hier auf die Sprachen der Karte angewandt: was der
// Bedienbefund 18:16 namentlich beanstandet hat, plus die Wörter, die die Oberfläche selbst anders
// nennt. Am DOM gemessen heisst: einschliesslich Überschrift, Zuordnungsetikett und Linkschrift.
const INTERN = [
  "Pilot",
  "pilot",
  "Stage-1",
  "Stage 1",
  "Peers",
  "peers",
  "Review",
  "review",
  "UX",
  "Workflow",
  "workflow",
  "Fluss",
  "Flow",
  "flow",
  "KO-Detail",
  "KO-detail",
  "Trust",
  "trust",
];

// ------------------------------------------------------------------------------------------------
// DIE ZIELE STEHEN HIER FEST — UND ZWAR UNABHÄNGIG VON DER QUELLE, DIE DIE SEITE LIEST.
// ------------------------------------------------------------------------------------------------
// DAS IST GEMESSEN, NICHT VORSORGLICH. Die erste Fassung von H3 verglich die Links im DOM gegen
// `PILOT_OBSERVATIONS.filter(o => o.to !== null)`. Gegenprobe (d) des Auftrags — „einen `obs.to`-Link
// entfernen" — lief damit GRÜN durch (Arbeitsprüfung 2add11297d4a4250a1ef77f24c8b0424, Exit 0): mit
// `to: null` verschwand das Ziel aus dem DOM UND aus der Erwartung zugleich. Ein Fall, der seine
// Erwartung aus dem Messgegenstand ableitet, misst nichts.
//
// Die Liste ist deshalb ausgeschrieben: fünf Einträge in ihrer Anzeigereihenfolge, vier vorhandene
// App-Routen und ein bewusstes `null` (Auftrag Lieferung 2). Sie ist dieselbe Zusage, die
// `tests/app/pilot-observation-guide.test.ts:24-31` DOM-frei hält — hier wird sie an der FLÄCHE
// gemessen. Wer einen Eintrag umhängt, wird an beiden Stellen rot und muss es begründen.
const ZIELE: readonly { id: string; to: string | null }[] = [
  { id: "missing", to: "/risiko" },
  { id: "unverified", to: "/validierung" },
  { id: "outdated", to: "/lebenszyklus" },
  { id: "source", to: "/bibliothek" },
  { id: "uxnote", to: null },
];

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function hilfeMounten(sprache: string): Promise<HTMLElement> {
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
  });
  return flaeche;
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

/** Die EINE Beobachtungskarte — an der Liste erkannt, die den Text des fünften Eintrags trägt. */
function karte(flaeche: HTMLElement): HTMLElement {
  const anker = i18n.t(PILOT_OBSERVATIONS[4]?.labelKey ?? "");
  const listen = [...flaeche.querySelectorAll("ul")].filter((liste) =>
    (liste.textContent ?? "").includes(anker),
  );
  expect(listen, "genau EINE Beobachtungskarte auf der Hilfeseite").toHaveLength(1);
  const eltern = (listen[0] as HTMLElement).parentElement;
  if (!eltern) {
    throw new Error("Die Beobachtungsliste steht in keiner Karte.");
  }
  return eltern;
}

function zeile(flaeche: HTMLElement, id: string): HTMLElement {
  const eintrag = PILOT_OBSERVATIONS.find((o) => o.id === id);
  if (!eintrag) {
    throw new Error(`Eintrag fehlt in der Beobachtungskarte: ${id}`);
  }
  const text = i18n.t(eintrag.labelKey);
  const gefunden = [...karte(flaeche).querySelectorAll("li")].find((li) =>
    (li.textContent ?? "").includes(text),
  );
  if (!gefunden) {
    throw new Error(`Die Beobachtungskarte zeigt den Eintrag „${id}" nicht.`);
  }
  return gefunden as HTMLElement;
}

describe("JOB 4067 · die Beobachtungskarte auf `/hilfe`", () => {
  for (const sprache of SPRACHEN) {
    describe(`Sprache ${sprache}`, () => {
      it("H1: die Karte trägt ihre Überschrift und ihren Untertitel", async () => {
        const flaeche = await hilfeMounten(sprache);
        const text = karte(flaeche).textContent ?? "";
        expect(text).toContain(i18n.t("pilot.obs.title"));
        expect(text).toContain(i18n.t("pilot.obs.subtitle"));
      });

      it("H2: alle fünf Einträge stehen mit Text UND Zuordnung sichtbar da", async () => {
        const flaeche = await hilfeMounten(sprache);
        for (const obs of PILOT_OBSERVATIONS) {
          const text = zeile(flaeche, obs.id).textContent ?? "";
          expect(text, `Zuordnung fehlt bei „${obs.id}"`).toContain(i18n.t(obs.mapKey));
          expect(text, `Etikett fehlt bei „${obs.id}"`).toContain(i18n.t("pilot.obs.mapLabel"));
        }
      });

      it("H3: die vier Links stehen an derselben Stelle wie vorher — der fünfte Eintrag hat keinen", async () => {
        const flaeche = await hilfeMounten(sprache);
        // Gemessen wird die REIHENFOLGE der Ziele über die ganze Karte gegen die FESTE Liste oben,
        // nicht gegen die Quelle, die die Seite selbst liest: eine vertauschte, verlorene oder auf
        // `null` gesetzte Route fällt sonst nicht auf (siehe Kommentar bei `ZIELE`).
        const gesehen = [...karte(flaeche).querySelectorAll("a")].map((a) =>
          a.getAttribute("href"),
        );
        expect(gesehen).toEqual(ZIELE.filter((z) => z.to !== null).map((z) => z.to));
        // Und die Einträge stehen in derselben Reihenfolge da wie die Zielliste.
        expect(PILOT_OBSERVATIONS.map((o) => o.id)).toEqual(ZIELE.map((z) => z.id));
        for (const ziel of ZIELE) {
          const anker = [...zeile(flaeche, ziel.id).querySelectorAll("a")];
          if (ziel.to === null) {
            expect(
              anker,
              `„${ziel.id}" hat einen Link, obwohl es dafür keine Fläche gibt`,
            ).toHaveLength(0);
          } else {
            expect(anker, `„${ziel.id}" hat keinen Link mehr`).toHaveLength(1);
            expect(anker[0]?.getAttribute("href"), `„${ziel.id}" zeigt woandershin`).toBe(ziel.to);
            expect(anker[0]?.textContent ?? "").toContain(i18n.t("pilot.obs.openFlow"));
          }
        }
      });

      it("H4: kein interner Begriff steht in der Karte", async () => {
        const flaeche = await hilfeMounten(sprache);
        const text = karte(flaeche).textContent ?? "";
        for (const begriff of INTERN) {
          expect(text, `„${begriff}" steht in der Karte (${sprache})`).not.toContain(begriff);
        }
      });
    });
  }

  it("H5: die Karte bleibt ausserhalb der Hilfe-Suche — sie ist ein fester Orientierungspunkt", async () => {
    // Prüflücke (b) des Auftrags: würde die Karte in den Suchraum gezogen, verschwände sie beim
    // ersten Tastendruck. `Help.tsx` baut `items` allein aus HELP_TOPICS + ISO_HELP_TOPICS —
    // gemessen wird das hier an der Wirkung, nicht am Quelltext.
    const flaeche = await hilfeMounten("de");
    const suche = flaeche.querySelector('[data-testid="hilfe-suche"]') as HTMLInputElement | null;
    expect(suche, "das Suchfeld der Hilfeseite fehlt").not.toBeNull();
    expect(
      flaeche.querySelectorAll("[data-hilfe-thema]").length,
      "vor der Suche steht kein einziges Kapitel da",
    ).toBeGreaterThan(0);

    // Der native Setter ist nötig, weil React den `value`-Setter des Elements überschreibt; ohne
    // ihn käme der Tastendruck im Zustand der Seite gar nicht an.
    const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setzer?.call(suche, "zzz-kein-kapitel-traegt-das");
      suche?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(
      flaeche.querySelectorAll("[data-hilfe-thema]").length,
      "die Kapitelliste hat auf die Suche nicht reagiert",
    ).toBe(0);
    const text = karte(flaeche).textContent ?? "";
    expect(text, "die Karte ist mit den Kapiteln verschwunden").toContain(
      i18n.t("pilot.obs.title"),
    );
    for (const obs of PILOT_OBSERVATIONS) {
      expect(text, `Eintrag „${obs.id}" ist mit der Suche verschwunden`).toContain(
        i18n.t(obs.labelKey),
      );
    }
  });
});
