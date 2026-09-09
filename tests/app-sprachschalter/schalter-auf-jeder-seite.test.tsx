// @vitest-environment jsdom
// ================================================================================================
// JOB 3323 · A + F — DER SCHALTER IST VON JEDER ANGEMELDETEN SEITE AUS ERREICHBAR, AUCH AUF 390 px.
// ================================================================================================
//
// DIE FRAGE, DIE HIER GEMESSEN WIRD, ist nicht „gibt es eine Komponente", sondern „kommt Pedi in
// einer LAUFENDEN SZENE an sie heran". Deshalb wird nichts nachgebaut: jede Seite ist die ECHTE
// Seite (`pages/Capture`, `pages/Validation`, `pages/Library`, `pages/Stufe2#ImportReview`), sie
// hängt in der ECHTEN `AppShell` mit der Providerkette aus `App.tsx`, und die Route steht in der
// Adresse. Ein Nachbau der Kopfzeile hätte genau die Frage nicht beantwortet.
//
// VOR DIESEM AUFTRAG WAR JEDER FALL DIESER DATEI ROT: Sprachwechsel gab es nur auf der
// Anmeldefläche (`auth/BrandPanel.tsx`) und unter /profil (`pages/Profile.tsx`) — beide außerhalb
// jeder Szene. Gegenprobe in der Rückgabe: nimmt man `<SprachSchalter />` aus `KontoEintraege`
// wieder heraus, fallen alle Fälle hier zurück in dieses Rot.
//
// WARUM IM MENÜ UND NICHT ALS PILLE IM BAND: der sichtbare Text des geschlossenen Kopfbands ist
// gepinnt — `tests/design/zielbild-h1-kein-erklaertext.test.ts`, Fall N verbietet „DE", „EN", „NL"
// dort ausdrücklich. Das Konto-Menü ist der Ort, den der Auftrag nennt („Kopfzeile/Kontomenü"),
// und der einzige, der den Pin nicht bricht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // Admin, damit auch /import (minRole: admin, Stufe 2) wirklich seine Seite rendert.
    me: vi.fn(async () => ({ id: "u1", name: "Pia Klar", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die HTTP-Grenze stillgelegt: jeder Endpunkt antwortet mit einer leeren Liste. Diese Datei fragt
// nach der ERREICHBARKEIT des Schalters, nicht nach Seiteninhalten — und ein Netzabruf, der in
// jsdom ins Leere liefe, wäre nur eine Fehlerquelle.
vi.mock("../../apps/web/src/api/endpoints", () => {
  // Die wenigen Endpunkte, deren LEERE Antwort keine leere Seite, sondern einen Absturz ergäbe:
  // `pages/Start.tsx:157` reicht die Antwort von `learningPaths.byRole` an `learningOpenSteps`
  // weiter, das `path.steps.length` liest (`lib/workCenter.ts:141`). Eine leere Liste ist dort ein
  // Pfad OHNE `steps`. Das ist ein Befund an einer anderen Datei und nicht Gegenstand dieses
  // Auftrags — hier steht deshalb die Antwortform, die der Server liefert, und keine Reparatur.
  const ANTWORTEN: Record<string, unknown> = {
    "learningPaths.byRole": { id: "p1", role: "admin", steps: [] },
    "gaps.summary": { total: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => ANTWORTEN[pfad] ?? []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
});

import { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { ERLAUBTE_SPRACHEN } from "../../apps/web/src/lib/htmlLang";
import { Capture } from "../../apps/web/src/pages/Capture";
import { Library } from "../../apps/web/src/pages/Library";
import { Profile } from "../../apps/web/src/pages/Profile";
import { Start } from "../../apps/web/src/pages/Start";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { Validation } from "../../apps/web/src/pages/Validation";
import {
  type Montage,
  breite,
  flush,
  klick,
  kontoMenueOeffnen,
  montiere,
  sprachKnoepfe,
  sprachKnopf,
} from "./huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// Die vier Szenen des Auftrags plus die beiden Seiten, auf denen der Wechsel schon vorher lebte
// bzw. die jeder zuerst sieht. „Prüfen" heißt in der Adresse `/validierung`
// (`app/navigation.ts:177`, Beschriftung `kopfband.pruefen`).
const SEITEN: Array<{ route: string; name: string; seite: unknown }> = [
  { route: "/erfassen", name: "Erfassen", seite: Capture },
  { route: "/validierung", name: "Prüfen", seite: Validation },
  { route: "/bibliothek", name: "Bibliothek", seite: Library },
  { route: "/import", name: "Import", seite: ImportReview },
  { route: "/start", name: "Start", seite: Start },
  { route: "/profil", name: "Profil", seite: Profile },
];

let montage: Montage | null = null;

function neueQc(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Ein echter Tastendruck auf das Element, das gerade den Fokus hat.
 *
 * `bubbles: true` ist Pflicht und keine Formalie: der Griff sitzt am `role="menu"`
 * (`shell/Menue.tsx:154`), nicht an der Zeile — ein Ereignis ohne Aufstieg käme dort nie an, und
 * der Fall wäre grün, ohne je eine Taste geprüft zu haben.
 */
async function pfeil(key: "ArrowDown" | "ArrowUp"): Promise<void> {
  const ziel = document.activeElement ?? document.body;
  await act(async () => {
    ziel.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  breite(1280);
});

afterEach(() => {
  montage?.abbauen();
  montage = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("JOB 3323 A · der Sprachschalter ist aus jeder laufenden Szene erreichbar", () => {
  for (const { route, name, seite } of SEITEN) {
    it(`${route} (${name}): Konto-Kreis → Schalter mit ${ERLAUBTE_SPRACHEN.join("/")}`, async () => {
      montage = await montiere(route, createElement(seite as never), neueQc());
      const c = montage.container;

      // Der Weg dorthin ist auf jeder Seite derselbe und er ist im Kopfband, nicht in der Seite.
      const kreis = c.querySelector('[data-testid="kopfband-konto"]');
      expect(kreis, "Konto-Kreis fehlt im Kopfband").toBeTruthy();
      expect(c.querySelector("header")?.contains(kreis as Node)).toBe(true);

      // Geschlossen zeigt das Band KEINE Sprachkürzel — der Pin des Zielbilds bleibt heil.
      expect(c.querySelector('[data-testid="sprach-schalter"]')).toBeNull();

      await kontoMenueOeffnen(c);
      const schalter = c.querySelector('[data-testid="sprach-schalter"]');
      expect(schalter, `Kein Sprachschalter im Konto-Menü auf ${route}`).toBeTruthy();
      // Er liegt IM Menü, nicht irgendwo daneben — sonst wäre er per Tastatur nicht erreichbar.
      expect(c.querySelector('[data-testid="konto-menue"]')?.contains(schalter as Node)).toBe(true);

      const knoepfe = sprachKnoepfe(c);
      expect(knoepfe.map((b) => b.textContent?.trim())).toEqual([...ERLAUBTE_SPRACHEN]);
    });
  }
});

describe("JOB 3323 A · Tastatur und aria — der Schalter ist bedienbar, nicht nur sichtbar", () => {
  beforeEach(async () => {
    montage = await montiere("/erfassen", createElement(Capture), neueQc());
    await kontoMenueOeffnen(montage.container);
  });

  it("jeder Knopf: echter <button type=button>, im Tab-Fluss, role=menuitemradio mit aria-checked", () => {
    const c = (montage as Montage).container;
    const knoepfe = sprachKnoepfe(c);
    expect(knoepfe).toHaveLength(ERLAUBTE_SPRACHEN.length);
    for (const b of knoepfe) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("type")).toBe("button");
      // Kein `tabIndex={-1}`: Enter/Leertaste kommen nativ, der Knopf ist ein echter Tab-Stopp.
      expect(b.tabIndex).toBe(0);
      expect(b.getAttribute("role")).toBe("menuitemradio");
      expect(b.getAttribute("aria-checked")).toMatch(/^(true|false)$/);
    }
    // Genau EINER ist gewählt — „eine aus drei", nicht drei unabhängige Schalter.
    expect(knoepfe.filter((b) => b.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(
      c.querySelector('[data-testid="sprach-schalter-de"]')?.getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("aria-Label: die Gruppe trägt den Namen der Wahl, jeder Knopf den Sprachnamen", () => {
    const c = (montage as Montage).container;
    const gruppe = c.querySelector('[data-testid="sprach-schalter"]');
    expect(gruppe?.getAttribute("role")).toBe("group");
    expect(gruppe?.getAttribute("aria-label")).toBe(i18n.t("prof.language"));
    for (const l of ERLAUBTE_SPRACHEN) {
      const b = c.querySelector(`[data-testid="sprach-schalter-${l}"]`);
      // Sichtbar steht das Kürzel, vorgelesen wird der Name — „de" allein ist keine Ansage.
      expect(b?.getAttribute("aria-label")).toBe(i18n.t(`lib.facet.lang.${l}`));
      expect(b?.getAttribute("aria-label")).not.toBe(l);
    }
  });

  // ================================================================================================
  // JOB 3323 R2 — HIER WIRD WIRKLICH GETIPPT (Codex-Vorprüfung, Prüflücke 3).
  // ================================================================================================
  // Runde 1 hat an dieser Stelle den Zeilen-Selektor aus `shell/Menue.tsx` ABGESCHRIEBEN und
  // geprüft, dass die Sprachknöpfe darunter fallen. Das ist eine Aussage über zwei Zeichenketten,
  // nicht über die Tastatur: hätte jemand den Selektor im Produkt geändert, wäre die Kopie hier
  // stillgeblieben und der Fall weiter grün. Ab jetzt löst dieser Fall echte `keydown`-Ereignisse
  // aus und misst, wohin der FOKUS wandert — das ist die Frage, die Pedi mit der Tastatur stellt.
  it("die Pfeiltasten wandern wirklich auf die Sprachknöpfe (echter keydown, echter Fokuswechsel)", async () => {
    const c = (montage as Montage).container;
    const menue = c.querySelector('[data-testid="konto-menue"]');
    expect(menue, "Konto-Menü nicht offen").toBeTruthy();

    // Beim Öffnen setzt das Menü den Fokus auf seine erste Zeile (`shell/Menue.tsx:96`).
    expect(menue?.contains(document.activeElement)).toBe(true);

    // ---- 1. Die Wanderung erreicht alle drei Sprachknöpfe -----------------------------------
    const besucht: Element[] = [];
    const zeilenZahl = menue?.querySelectorAll("button, a[href], input").length ?? 0;
    for (let i = 0; i < zeilenZahl + 1; i++) {
      await pfeil("ArrowDown");
      if (document.activeElement) {
        besucht.push(document.activeElement);
      }
    }
    for (const l of ERLAUBTE_SPRACHEN) {
      expect(besucht, `„${l}“ wird von der Pfeiltaste nie erreicht`).toContain(sprachKnopf(c, l));
    }

    // ---- 2. Und der Schritt VON einem Sprachknopf ZUM nächsten ist wirklich einer -------------
    // Der schärfste Beleg: nicht „irgendwann war der Fokus dort", sondern EIN Tastendruck bewegt
    // ihn von „de" auf „en" und einer zurück. Das kann nur gelingen, wenn beide Knöpfe in
    // derselben Zeilenfolge liegen und der Fokus wirklich gesetzt wird.
    sprachKnopf(c, "de").focus();
    expect(document.activeElement).toBe(sprachKnopf(c, "de"));
    await pfeil("ArrowDown");
    expect(document.activeElement, "ArrowDown bewegt den Fokus nicht von „de“ auf „en“").toBe(
      sprachKnopf(c, "en"),
    );
    await pfeil("ArrowUp");
    expect(document.activeElement, "ArrowUp führt nicht auf „de“ zurück").toBe(
      sprachKnopf(c, "de"),
    );
  });

  it("KEIN aria-pressed — der Design-Umschalter bleibt der EINE Knopf des Menüs mit aria-pressed", () => {
    const c = (montage as Montage).container;
    // `tests/app/mega40-design-umschalter-mounted.test.tsx:166` erhebt den Design-Umschalter als
    // `[data-testid="konto-menue"] button[aria-pressed]` — der ERSTE Treffer. Drei weitere Knöpfe
    // mit aria-pressed hätten diesen Wächter stumpf gemacht, ohne dass er rot geworden wäre.
    for (const b of sprachKnoepfe(c)) {
      expect(b.hasAttribute("aria-pressed")).toBe(false);
    }
    const mitPressed = [...c.querySelectorAll('[data-testid="konto-menue"] button[aria-pressed]')];
    expect(mitPressed).toHaveLength(1);
    expect(mitPressed[0]?.getAttribute("data-testid")).toBe("konto-darstellung");
  });
});

describe("JOB 3323 F · auf 390 px — beide Wege der schmalen Hülle führen hin", () => {
  beforeEach(() => {
    breite(390);
  });

  it("schmales Kopfband: der Konto-Kreis steht weiterhin da und öffnet den Schalter", async () => {
    montage = await montiere("/bibliothek", createElement(Library), neueQc());
    const c = montage.container;
    // Auf 390 px entfallen Punkte und Suchfeld — Zahnrad und Konto bleiben (Kopfband.tsx).
    expect(c.querySelector('[data-testid="kopfband"] input[type="search"]')).toBeNull();
    await kontoMenueOeffnen(c);
    expect(sprachKnoepfe(c).map((b) => b.textContent?.trim())).toEqual([...ERLAUBTE_SPRACHEN]);
  });

  it("Off-Canvas-Drawer (Hamburger): derselbe Baustein, dieselben drei Knöpfe", async () => {
    montage = await montiere("/erfassen", createElement(Capture), neueQc());
    const c = montage.container;
    await klick(c.querySelector(`[aria-label="${i18n.t("topbar.openMenu")}"]`));
    const drawer = c.querySelector('dialog[aria-modal="true"]');
    expect(drawer, "Drawer nicht offen").toBeTruthy();
    const imDrawer = [
      ...(drawer?.querySelectorAll<HTMLButtonElement>('[data-testid="sprach-schalter"] button') ??
        []),
    ];
    expect(imDrawer.map((b) => b.textContent?.trim())).toEqual([...ERLAUBTE_SPRACHEN]);
    // Und er ist dort auch WIRKSAM, nicht nur gerendert.
    await klick(imDrawer[1]);
    expect(i18n.language).toBe("en");
  });
});
