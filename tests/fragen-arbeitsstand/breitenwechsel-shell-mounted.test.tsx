// @vitest-environment jsdom
// ================================================================================================
// ERGÄNZUNG 1 · BREITENWECHSEL DURCH DIE ECHTE HÜLLE (Ben L2 R3, P1).
// ================================================================================================
//
// `weiterarbeiten-mounted.test.tsx` W1 baut `Ask` allein ab und wieder auf; die Tutorialtests setzen
// die Breite VOR der Montage. Ein Wechsel der Breite bei STEHENDER Seite kam in keinem
// Produkttest vor. Hier läuft er durch die echte `AppShell`: sie hat für schmal und breit getrennte
// Rückgaben und montiert die Seite dabei neu. Ausgelöst wird er wie im Browser — `matchMedia`
// meldet über seinen `change`-Hörer eine neue Lage, `useMediaQuery` liest `matches` neu.
//
// Geprüft nach JEDEM Schritt (Tutorial auf, Tutorial zu, breit→schmal, schmal→breit):
// der ungesendete Folgeentwurf steht im Feld, die Antwort steht mit ihrer Quelle da, und es ist
// bei der EINEN Modellanfrage geblieben. Dass der Wechsel wirklich stattfand, belegen das
// Menü-Symbol des schmalen Kopfbands und ein NEUES Eingabefeld (die Seite wurde neu montiert).
//
// Gerüst: `tests/fe003-tutorial-fragen/huelle.tsx` (echte Hülle, Netz auf `fetch`-Ebene).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  ECHTE_QUELLE,
  type Montiert,
  echtesFeld,
  klick,
  montiere,
  netz,
  netzStub,
  oeffneTutorial,
  q,
  ruhe,
  tippe,
} from "../fe003-tutorial-fragen/huelle";

type Hoerer = (ereignis: { matches: boolean }) => void;

/** `matchMedia`, dessen schmale Lage sich zur Laufzeit umschalten lässt — mit echten Hörern. */
function umschaltbareMedien(): { setze: (schmal: boolean) => Promise<void> } {
  let schmal = false;
  const hoerer = new Set<Hoerer>();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        get matches() {
          return query.includes("max-width: 899px") && schmal;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: Hoerer) => hoerer.add(cb),
        removeEventListener: (_: string, cb: Hoerer) => hoerer.delete(cb),
        addListener: (cb: Hoerer) => hoerer.add(cb),
        removeListener: (cb: Hoerer) => hoerer.delete(cb),
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
  return {
    setze: async (wert: boolean) => {
      await act(async () => {
        schmal = wert;
        for (const cb of [...hoerer]) {
          cb({ matches: wert });
        }
      });
      await ruhe();
    },
  };
}

const FOLGEENTWURF = "Ungesendeter Folgeentwurf";

let f: Montiert | null = null;

afterEach(() => {
  f?.abbauen();
  f = null;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Ergänzung 1 · Breitenwechsel der echten Hülle mit vorhandenem Arbeitsstand", () => {
  it("breit → schmal → breit (und Tutorial): Entwurf, Antwort und Quelle bleiben, keine neue Anfrage", async () => {
    localStorage.clear();
    netz.anfragen = [];
    netz.lage = { kiAktiv: true, rolle: "experte" };
    vi.stubGlobal("fetch", vi.fn(netzStub));
    const medien = umschaltbareMedien();
    await i18n.changeLanguage("de");
    f = await montiere("/fragen");
    const c = f.container;

    // Eine Antwort mit Quelle erzeugen, dann einen ungesendeten Folgeentwurf tippen.
    await tippe(echtesFeld(c), "Wie werden Reisen genehmigt?");
    await klick(echtesFeld(c).form?.querySelector('button[type="submit"]'));
    await ruhe();
    await tippe(echtesFeld(c), FOLGEENTWURF);

    const modellanfragen = (): number => netz.anfragen.filter((a) => a.pfad === "/api/ask").length;
    const pruefen = (schritt: string): void => {
      expect(echtesFeld(c).value, `${schritt}: Entwurf`).toBe(FOLGEENTWURF);
      expect(q(c, "ask-answer")?.textContent, `${schritt}: Antwort`).toContain(
        "Reisen werden vorab",
      );
      expect(q(c, "ask-quellen-chip")?.textContent, `${schritt}: Quelle`).toContain(
        ECHTE_QUELLE.title,
      );
      expect(modellanfragen(), `${schritt}: Modellanfragen`).toBe(1);
    };
    pruefen("Ausgang");
    expect(q(c, "kopfband-menue"), "Ausgang ist breit").toBeNull();

    await oeffneTutorial(c);
    pruefen("Tutorial offen");
    await klick(q(c, "tutorial-knopf"));
    pruefen("Tutorial zu");

    const feldBreit = echtesFeld(c);
    await medien.setze(true);
    expect(q(c, "kopfband-menue"), "schmale Hülle aktiv").not.toBeNull();
    expect(echtesFeld(c), "die Seite wurde beim Wechsel neu montiert").not.toBe(feldBreit);
    pruefen("schmal");

    const feldSchmal = echtesFeld(c);
    await medien.setze(false);
    expect(q(c, "kopfband-menue"), "breite Hülle aktiv").toBeNull();
    expect(echtesFeld(c), "die Seite wurde beim Wechsel neu montiert").not.toBe(feldSchmal);
    pruefen("wieder breit");
  });
});
