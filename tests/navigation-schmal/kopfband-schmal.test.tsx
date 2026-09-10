// @vitest-environment jsdom
// ================================================================================================
// JOB 3525 · CHR-NAVIGATION-SCHMAL — DIE NAVIGATION IST AUCH SCHMAL ERREICHBAR UND ERKENNBAR.
// ================================================================================================
//
// PEDIS BEFUND (10.09.2026, 09:05, Bildschirmfoto bei Codex): mit einem schmaleren Fenster waren
// die Menüpunkte oben verschwunden, sichtbar war nur ein Symbol. Er hat den Weg zu „Meine
// Entwürfe" und „Gehe zu …" nicht gefunden.
//
// GEMESSEN WIRD AN DER ECHTEN HÜLLE (`shell/AppShell.tsx`) — nicht am Kopfband allein. Das ist die
// Stelle, an der `narrow` wirklich entsteht (`useMediaQuery(NARROW_QUERY)`), und der Drawer ist
// derselbe, den ein Mensch aufzieht. Attrappen sind nur die beiden Endpunktgrenzen.
//
// DIE BREITE IST HIER KEINE ZAHL IM KOPF: `matchMedia` wird gegen eine echte Breite AUSGEWERTET
// (`passt()` unten parst `min-width`/`max-width`). Ein Stub, der pauschal `true` zurückgibt, könnte
// die Frage dieses Auftrags gar nicht beantworten — es geht um zwei Bänder, nicht um einen Schalter.
//
// EHRLICHE GRENZE, ausdrücklich benannt: jsdom rechnet KEIN Layout. Jede Aussage hier ist eine über
// den BAUM (steht es da, führt es wohin), keine über Pixel. Die Zusage „kein Layoutbruch, 56 px
// bleiben, nichts überlappt" wird deshalb NICHT hier gemessen, sondern im Browser —
// `tests/navigation-schmal/kopfband-schmal-chromium.test.ts`.
//
// DIE FÄLLE:
//   A  schmal (390): der Menü-Knopf trägt ein WORT, und der zugängliche Name enthält es
//   B  schmal (390): die Punkte sind nicht oben — aber der Knopf öffnet den Drawer, und darin
//      stehen „Meine Entwürfe" UND „Gehe zu …"  → höchstens zwei Wege
//   C  Tablet-Band (768): „Meine Entwürfe" und „Gehe zu …" stehen OBEN → ein Weg
//   D  EN: dieselben zwei Bänder mit den englischen Wörtern
//   E  breit (1280): unverändert — kein Menü-Knopf, die volle Punktreihe der Rolle, Suchfeld
//   F  INVARIANZ: eine Breite, die das neue Band bejaht, ändert die BREITE Ansicht um kein Zeichen
//   G  die beiden Bänder schliessen lückenlos an `NARROW_QUERY` an — keine stumme Zwischenbreite
//   H  über den ganzen Breitenverlauf gilt: entweder volle Punkte oder ein beschrifteter Knopf
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // `experte` ist die kleinste Rolle, die „Meine Entwürfe" sieht (navigation.ts:160,
    // `minRole: "experte"`). Mit `viewer` gäbe es den Punkt gar nicht und der Fall wäre leer.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Breiter, robuster Endpoints-Mock (Muster `tests/app/mobile-shell-mounted.test.tsx`): jede
// Namenskette liefert eine Funktion, die `[]` auflöst. Die Hülle ruft an mehr Stellen ab, als
// dieser Auftrag berührt; eine Aufzählung wäre hier nur eine zweite Fehlerquelle.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { canSee, kopfbandItems } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { SCHMAL_PUNKTE_QUERY } from "../../apps/web/src/shell/Kopfband";
import { NARROW_QUERY } from "../../apps/web/src/shell/useMediaQuery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ------------------------------------------------------------------------------------------------
// WELCHE PUNKTE DIESE ROLLE ÜBERHAUPT SEHEN DARF
// ------------------------------------------------------------------------------------------------
//
// Gemessen wird als `experte` — die KLEINSTE Rolle, die „Meine Entwürfe" sieht (navigation.ts:160).
// Sie sieht „Prüfen" NICHT: `validierung` verlangt `controller` (navigation.ts:218). Die Erwartung
// „alle Punkte" heisst hier deshalb „alle, die diese Rolle sehen darf", und sie wird aus derselben
// Regel gerechnet, die das Produkt benutzt (`canSee`) — nicht abgeschrieben.
//
// Kein Kopfbandpunkt hängt an Stufe 2 (die `stufe2`-Gruppe ist „erweitert", navigation.ts:296, und
// steht nicht in `KOPFBAND_IDS`); `false` ist damit kein weggelassener Fall, sondern der einzige.
const SICHTBARE_PUNKTE = kopfbandItems()
  .filter((i) => canSee(i, "experte", false))
  .map((i) => i.id);

// ------------------------------------------------------------------------------------------------
// DIE BREITE, AUSGEWERTET STATT BEHAUPTET
// ------------------------------------------------------------------------------------------------
/** Wertet eine Abfrage aus `min-width`/`max-width` gegen eine Breite aus — mehr braucht keiner. */
function passt(query: string, breite: number): boolean {
  let ergebnis = true;
  for (const m of query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
    const grenze = Number(m[2]);
    ergebnis = ergebnis && (m[1] === "min" ? breite >= grenze : breite <= grenze);
  }
  return ergebnis;
}

/**
 * `matchMedia` an einer echten Breite. `stoerung` beantwortet EINE Abfrage abweichend — das ist
 * das Werkzeug für Fall F (Invarianz) und für die Gegenproben in der Rückgabe.
 */
function setzeBreite(breite: number, stoerung?: { query: string; antwort: boolean }): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: stoerung && stoerung.query === q ? stoerung.antwort : passt(q, breite),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** Die echte Hülle auf `/start`, mit einem erkennbaren Inhalt darin. */
async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/start"] },
                  createElement(AppShell, null, createElement("div", null, "INHALT")),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function kopfband(): HTMLElement {
  const el = container.querySelector<HTMLElement>('header[data-testid="kopfband"]');
  if (!el) {
    throw new Error("das Kopfband steht nicht");
  }
  return el;
}

function menueKnopf(): HTMLButtonElement | null {
  return kopfband().querySelector<HTMLButtonElement>('[data-testid="kopfband-menue"]');
}

/** Die Ids der Punkte, die OBEN im Kopfband stehen — in Bildreihenfolge. */
function punkteOben(): string[] {
  return [...kopfband().querySelectorAll("[data-kopfband-punkt]")].map(
    (a) => a.getAttribute("data-kopfband-punkt") ?? "",
  );
}

function geheZuOben(): HTMLButtonElement | null {
  return kopfband().querySelector<HTMLButtonElement>('[data-testid="kopfband-gehezu"]');
}

function drawer(): HTMLElement | null {
  return container.querySelector<HTMLElement>("dialog[aria-modal='true']");
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

// ================================================================================================
describe("JOB 3525 · A · das Symbol bekommt ein Wort", () => {
  it("schmal (390 px) steht „Menü“ SICHTBAR am Knopf — nicht nur im aria-label", async () => {
    setzeBreite(390);
    await montiere();
    const knopf = menueKnopf();
    expect(knopf, "auf 390 px gibt es keinen Menü-Knopf").not.toBeNull();
    // DAS IST DER KERN DES AUFTRAGS: ein Mensch, der die Seite zum ersten Mal schmal sieht, liest
    // dort ein Wort. Vor JOB 3525 war `textContent` hier leer (nur ein <svg>).
    expect(knopf?.textContent?.trim(), "der Knopf trägt kein sichtbares Wort").toBe("Menü");
    expect(i18n.t("topbar.menuShort")).toBe("Menü");
  });

  it("der zugängliche Name ENTHÄLT das sichtbare Wort (WCAG 2.5.3 „Label in Name“)", async () => {
    setzeBreite(390);
    await montiere();
    const knopf = menueKnopf();
    const name = knopf?.getAttribute("aria-label") ?? "";
    const sichtbar = knopf?.textContent?.trim() ?? "";
    expect(name).toBe(i18n.t("topbar.openMenu"));
    expect(sichtbar.length, "der Knopf ist stumm — dann prüft dieser Fall nichts").toBeGreaterThan(
      0,
    );
    // Ohne diese Zusicherung könnte jemand später „Navigation" sichtbar und „Menü öffnen"
    // zugänglich schreiben — Sprachbedienung („Klick Menü") träfe den Knopf dann nicht mehr.
    //
    // VERGLICHEN WIRD OHNE GROSS-/KLEINSCHREIBUNG, und das ist keine Aufweichung: auf Englisch
    // steht sichtbar „Menu" und zugänglich „Open menu" — dasselbe Wort, ein anderer Satzanfang.
    // Spracherkennung wertet Groß-/Kleinschreibung nicht aus (WCAG-Technik G208 vergleicht den
    // Text, nicht seine Schreibung), ein zeichengenauer Vergleich wäre hier also strenger als die
    // Regel und würde eine korrekte Übersetzung als Fehler melden. GEMESSEN, nicht vermutet: der
    // zeichengenaue Vergleich lief in dieser Datei zuerst und wurde rot — „expected 'Open menu' to
    // contain 'Menu'".
    expect(
      name.toLowerCase(),
      `„${name}“ enthält das sichtbare Wort „${sichtbar}“ nicht`,
    ).toContain(sichtbar.toLowerCase());
  });

  it("das Zeichen selbst bleibt für Assistenz stumm — das Wort trägt, nicht das Bild", async () => {
    setzeBreite(390);
    await montiere();
    expect(menueKnopf()?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ================================================================================================
describe("JOB 3525 · B · schmal (390 px): der Weg geht über den beschrifteten Knopf", () => {
  it("oben stehen keine Punkte — aber ein Klick öffnet den Drawer mit BEIDEN gesuchten Wegen", async () => {
    setzeBreite(390);
    await montiere();
    expect(punkteOben(), "auf 390 px stehen Punkte oben, dafür ist kein Platz").toEqual([]);
    expect(geheZuOben(), "auf 390 px steht „Gehe zu …“ oben").toBeNull();
    expect(drawer(), "der Drawer stand schon vor dem Klick offen").toBeNull();

    // WEG 1 von 2: der beschriftete Knopf.
    const knopf = menueKnopf();
    expect(knopf).not.toBeNull();
    if (knopf) {
      await klick(knopf);
    }
    const auf = drawer();
    expect(auf, "der Klick auf „Menü“ öffnet nichts").not.toBeNull();

    // WEG 2 von 2: die Zeile im Drawer. Beide gesuchten Ziele stehen dort.
    const entwuerfe = auf?.querySelector('a[href="/entwuerfe"]');
    expect(entwuerfe, "„Meine Entwürfe“ steht nicht im Drawer").not.toBeNull();
    expect(entwuerfe?.textContent).toContain(i18n.t("mob.drafts"));
    const geheZu = auf?.querySelector('[data-testid="zahnrad-schnellnavigation"]');
    expect(geheZu, "„Gehe zu …“ steht nicht im Drawer").not.toBeNull();
    expect(geheZu?.textContent).toContain(i18n.t("menue.schnellnavigation"));
  });

  it("höchstens zwei Wege: Knopf, Zeile — dazwischen liegt nichts", async () => {
    setzeBreite(390);
    await montiere();
    const schritte: string[] = [];
    const knopf = menueKnopf();
    if (knopf) {
      schritte.push("Menü");
      await klick(knopf);
    }
    const ziel = drawer()?.querySelector<HTMLAnchorElement>('a[href="/entwuerfe"]');
    expect(ziel, "„Meine Entwürfe“ ist nach EINEM Schritt noch nicht erreichbar").not.toBeNull();
    if (ziel) {
      schritte.push("Meine Entwürfe");
    }
    expect(schritte.length, `es waren ${schritte.length} Schritte`).toBeLessThanOrEqual(2);
  });
});

// ================================================================================================
describe("JOB 3525 · C · Tablet-Band (768 px): die zwei gesuchten Wege stehen OBEN", () => {
  it("„Meine Entwürfe“ steht im Kopfband und führt auf /entwuerfe", async () => {
    setzeBreite(768);
    await montiere();
    expect(punkteOben(), "„Meine Entwürfe“ steht auf 768 px nicht oben").toEqual(["entwuerfe"]);
    const punkt = kopfband().querySelector<HTMLAnchorElement>('a[data-kopfband-punkt="entwuerfe"]');
    expect(punkt?.getAttribute("href")).toBe("/entwuerfe");
    expect(punkt?.textContent).toContain(i18n.t("mob.drafts"));
  });

  it("„Gehe zu … ⌘K“ steht daneben — derselbe Knopf wie breit, keine zweite Bauform", async () => {
    setzeBreite(768);
    await montiere();
    const knopf = geheZuOben();
    expect(knopf, "„Gehe zu …“ steht auf 768 px nicht oben").not.toBeNull();
    expect(knopf?.textContent).toContain(i18n.t("menue.schnellnavigation"));
    expect(knopf?.textContent, "das Kürzel fehlt am Knopf").toContain("⌘K");
  });

  it("der beschriftete Menü-Knopf bleibt daneben stehen — der Rest der Punkte ist nicht fort", async () => {
    setzeBreite(768);
    await montiere();
    expect(menueKnopf()?.textContent?.trim()).toBe("Menü");
    const knopf = menueKnopf();
    if (knopf) {
      await klick(knopf);
    }
    // Die volle Navigation steht weiterhin im Drawer — was oben steht, ist eine AUSWAHL, kein Ersatz.
    for (const item of kopfbandItems().filter((i) => SICHTBARE_PUNKTE.includes(i.id))) {
      expect(
        drawer()?.querySelector(`a[href="${item.path}"]`),
        `„${item.id}“ fehlt im Drawer`,
      ).not.toBeNull();
    }
  });

  it("was oben steht, ist wirklich ein Kopfbandpunkt — keine erfundene Nebenliste", async () => {
    setzeBreite(768);
    await montiere();
    const erlaubt = kopfbandItems().map((i) => i.id);
    expect(
      punkteOben().length,
      "es steht gar nichts oben — der Fall prüfte nichts",
    ).toBeGreaterThan(0);
    for (const id of punkteOben()) {
      expect(erlaubt, `„${id}“ ist gar kein Kopfbandpunkt`).toContain(id);
    }
  });

  it("das Suchfeld bleibt schmal fort (Nicht-Ziel §6) — die Suche läuft über die Bibliothek", async () => {
    setzeBreite(768);
    await montiere();
    expect(kopfband().querySelector('input[type="search"]')).toBeNull();
  });
});

// ================================================================================================
describe("JOB 3525 · D · dieselben Zusagen auf Englisch", () => {
  it("390 px: der Knopf heisst „Menu“, und der zugängliche Name enthält das Wort", async () => {
    await i18n.changeLanguage("en");
    setzeBreite(390);
    await montiere();
    const knopf = menueKnopf();
    expect(knopf?.textContent?.trim()).toBe("Menu");
    expect(knopf?.getAttribute("aria-label")).toBe("Open menu");
    // Ohne Rücksicht auf den Satzanfang — dieselbe Regel wie in Fall A, dieselbe Begründung.
    expect((knopf?.getAttribute("aria-label") ?? "").toLowerCase()).toContain("menu");
  });

  it("768 px: „My drafts“ und „Go to …“ stehen oben", async () => {
    await i18n.changeLanguage("en");
    setzeBreite(768);
    await montiere();
    expect(punkteOben()).toEqual(["entwuerfe"]);
    expect(kopfband().querySelector('a[data-kopfband-punkt="entwuerfe"]')?.textContent).toContain(
      "My drafts",
    );
    expect(geheZuOben()?.textContent).toContain("Go to …");
    expect(menueKnopf()?.textContent?.trim()).toBe("Menu");
  });
});

// ================================================================================================
describe("JOB 3525 · E · breit (1280 px) bleibt, was es war", () => {
  it("kein Menü-Knopf, die volle Punktreihe der Rolle, Suchfeld und „Gehe zu …“", async () => {
    // Kalibrierung: die Reihe steht hier ausgeschrieben da, damit die Erwartung nicht bloss eine
    // zweite Kopie derselben Rechnung ist. Ändert sich das Kopfband, wird DIESE Zeile rot.
    expect(SICHTBARE_PUNKTE).toEqual(["start", "fragen", "bibliothek", "erfassen", "entwuerfe"]);
    setzeBreite(1280);
    await montiere();
    expect(menueKnopf(), "breit steht ein Menü-Knopf im Kopfband").toBeNull();
    expect(punkteOben()).toEqual(SICHTBARE_PUNKTE);
    expect(kopfband().querySelector('input[type="search"]')).not.toBeNull();
    expect(geheZuOben()).not.toBeNull();
  });
});

// ================================================================================================
// F · INVARIANZ — die neue Abfrage KANN die breite Ansicht nicht berühren.
// ================================================================================================
//
// Muster `tests/app/mega40-theme-invarianz.test.ts`: eine Zusage „hier ändert sich nichts" wird
// nicht erzählt, sie wird gegen einen Sollwert gehalten. Der Sollwert ist hier das gerenderte
// Kopfband selbst — Zeichen für Zeichen.
//
// DIE STÖRUNG IST DER BEWEIS: `SCHMAL_PUNKTE_QUERY` wird künstlich auf `true` gezwungen, während
// `NARROW_QUERY` (1280 px) weiter `false` sagt. Wäre das neue Band irgendwo NICHT an `narrow`
// gebunden, stünde jetzt ein zweites `<nav>` oder ein Menü-Knopf im Baum und die Zeichenketten
// gingen auseinander. Sie tun es nicht.
describe("JOB 3525 · F · Invarianz der breiten Ansicht", () => {
  it("1280 px mit und ohne bejahtes Schmalband ergeben ZEICHENGLEICH dasselbe Kopfband", async () => {
    setzeBreite(1280);
    await montiere();
    const ohne = kopfband().outerHTML;
    abbauen();

    setzeBreite(1280, { query: SCHMAL_PUNKTE_QUERY, antwort: true });
    await montiere();
    const mit = kopfband().outerHTML;

    expect(mit, "die neue Abfrage verändert die breite Ansicht").toBe(ohne);
  });
});

// ================================================================================================
describe("JOB 3525 · G · die Bänder schliessen lückenlos an", () => {
  it("die obere Grenze des Schmalbands ist DIESELBE wie die von NARROW_QUERY", () => {
    const obenSchmal = /\(max-width:\s*(\d+)px\)/.exec(SCHMAL_PUNKTE_QUERY)?.[1];
    const obenNarrow = /\(max-width:\s*(\d+)px\)/.exec(NARROW_QUERY)?.[1];
    expect(obenNarrow, "NARROW_QUERY hat keine max-width mehr").toBeDefined();
    expect(
      obenSchmal,
      "die beiden Bänder enden verschieden — dazwischen entstünde eine stumme Breite",
    ).toBe(obenNarrow);
  });

  it("das Schmalband liegt VOLLSTÄNDIG innerhalb des schmalen Bereichs", () => {
    const unten = Number(/\(min-width:\s*(\d+)px\)/.exec(SCHMAL_PUNKTE_QUERY)?.[1]);
    expect(Number.isFinite(unten)).toBe(true);
    // Jede Breite, die das Punkte-Band bejaht, muss auch „schmal" sein — sonst zeigte das
    // Kopfband auf einer breiten Ansicht plötzlich die schmale Auswahl.
    for (const breite of [unten, unten + 1, 800, 899]) {
      expect(passt(NARROW_QUERY, breite), `${breite}px ist nicht schmal`).toBe(true);
    }
    expect(passt(SCHMAL_PUNKTE_QUERY, unten - 1), `${unten - 1}px liegt noch im Band`).toBe(false);
  });
});

// ================================================================================================
// H · KEINE ZWISCHENBREITE, IN DER PUNKTE EINFACH UNSICHTBAR SIND (Auftrag §5.2, letzter Satz).
// ================================================================================================
//
// Der Verlauf wird nicht behauptet, sondern abgefahren: an jeder dieser Breiten steht ENTWEDER die
// volle Punktreihe ODER ein Knopf, der ein Wort trägt und in die Navigation führt. Ein Zustand, in
// dem beides fehlt, wäre genau Pedis Befund — und er kommt hier nicht vor.
describe("JOB 3525 · H · der Breitenverlauf hat keine stumme Stelle", () => {
  for (const breite of [320, 599, 759, 760, 768, 899, 900, 1280]) {
    it(`${breite} px: entweder alle Punkte oben oder ein beschrifteter Weg dorthin`, async () => {
      setzeBreite(breite);
      await montiere();
      const knopf = menueKnopf();
      if (knopf === null) {
        // Breit: die volle Reihe steht da.
        expect(punkteOben(), `${breite}px: weder Knopf noch volle Punktreihe`).toEqual(
          SICHTBARE_PUNKTE,
        );
        return;
      }
      // Schmal: der Knopf trägt ein Wort — nicht nur ein Zeichen.
      expect(knopf.textContent?.trim().length, `${breite}px: der Knopf ist stumm`).toBeGreaterThan(
        0,
      );
      await klick(knopf);
      expect(drawer(), `${breite}px: der Knopf führt nirgendwohin`).not.toBeNull();
      expect(
        drawer()?.querySelector('a[href="/entwuerfe"]'),
        `${breite}px: „Meine Entwürfe“ ist nicht erreichbar`,
      ).not.toBeNull();
    });
  }
});
