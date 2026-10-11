// @vitest-environment jsdom
// ================================================================================================
// BPA-05 · AKTIVE BEGLEITUNG — die montierte Statusleiste mit dem echten Vorgangsadapter.
// ================================================================================================
//
// Gemessen wird `KlaraBegleitung.tsx` mit `adapter.ts` an einem synthetischen, ausdrücklich
// eingerichteten Testformular (`data-klara-begleitbereich`), daneben ein nicht freigegebener
// Bereich mit privatem Text. Die Leiste steht OHNE das Gespräch der Assistenz — genau so hängt sie
// in der Hülle (`AppShell.tsx`, neben der Figur, nicht in ihr).
//
// WAS HIER NICHT GEMESSEN WIRD: ein echter Sperrbildschirm, ein echtes Inkognitofenster und ein
// echter Fensterwechsel des Betriebssystems. Diese Signale liefern Browser- (BPA-01) und
// Nativadapter (BPA-04) als `klarwerk:begleitung-system`/`-kontext`; hier werden sie als genau
// diese Ereignisse gestellt. Eine reale Hostprobe bleibt offen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { KlaraBegleitung } from "../../apps/web/src/components/klara-begleitung/KlaraBegleitung";
import {
  KONTEXT_EREIGNIS,
  SYSTEM_EREIGNIS,
} from "../../apps/web/src/components/klara-begleitung/adapter";
import i18n from "../../apps/web/src/i18n";

const T0 = Date.parse("2026-10-11T10:00:00+02:00");
const MIN = 60_000;
const GEHEIM = ["KD-GEHEIM-4711", "PIN-9999", "PRIVAT-NOTIZ-XYZ", "INKOGNITO-INHALT"];

let uhr = T0;
let wurzel: HTMLDivElement;
let root: Root | null = null;
const fetchSpion = vi.fn();
const mikrofonSpion = vi.fn();

const FORMULAR = `
  <form data-klara-begleitbereich="pruefformular-netzteil"
        data-klara-begleitbereich-name="Prüfformular Netzteil"
        data-klara-begleitbereich-rollen="experte,controller">
    <label for="leistung">Leistung</label>
    <input id="leistung" name="leistung" data-klara-einheit="W,kW" value="">
    <label for="spannung">Spannung</label>
    <input id="spannung" name="spannung" data-klara-einheit="V" value="230 V">
    <label for="kunde">Kundennummer</label>
    <input id="kunde" name="kundennummer" data-klara-ausgeschlossen value="${GEHEIM[0]}">
    <label for="pin">PIN</label>
    <input id="pin" name="pin" type="password" value="${GEHEIM[1]}">
  </form>
  <section id="nicht-freigegeben"><textarea name="privat">${GEHEIM[2]}</textarea></section>
`;

const pruefSpion = vi.fn();

/** `rolle` und `geprueftAm` stehen für die vom Server bestätigte Sitzung (`/auth/me`). */
function montiere(
  konto: string | null = "u-pia",
  rolle: string | null = "experte",
  geprueftAm = 0,
): void {
  act(() => {
    if (!root) {
      root = createRoot(wurzel);
    }
    root.render(
      createElement(KlaraBegleitung, {
        konto,
        rolle,
        rechteGeprueftAm: geprueftAm,
        pruefeRechte: pruefSpion,
        jetzt: () => uhr,
      }),
    );
  });
}

/** Hat jemand den eingerichteten Vorgang im Dokument gesucht — also zu lesen begonnen? */
function vorgangAbgefragt(aufrufe: readonly unknown[][]): boolean {
  return aufrufe.some(([selektor]) => String(selektor).includes("begleitbereich"));
}

function abbauen(): void {
  act(() => root?.unmount());
  root = null;
}

function q(testid: string): HTMLElement | null {
  return wurzel.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function knopf(text: string): HTMLButtonElement {
  const k = Array.from(wurzel.querySelectorAll("button")).find((b) => b.textContent === text);
  if (!k) {
    throw new Error(`Knopf „${text}" fehlt`);
  }
  return k;
}

function setzeWert(el: HTMLInputElement, wert: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, wert);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function vergeht(ms: number): void {
  act(() => {
    uhr += ms;
    vi.advanceTimersByTime(ms);
  });
}

function starte(satz: string): void {
  act(() => setzeWert(q("begleitung-auftrag") as HTMLInputElement, satz));
  act(() => knopf("Begleitung starten").click());
}

function taste(code: "KeyP" | "KeyS"): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, altKey: true, shiftKey: true }));
  });
}

function leistung(): HTMLInputElement {
  return document.getElementById("leistung") as HTMLInputElement;
}

function eintraege(speicher: Storage): Record<string, string | null> {
  const alle: Record<string, string | null> = {};
  for (let i = 0; i < speicher.length; i += 1) {
    const k = speicher.key(i);
    if (k !== null) {
      alle[k] = speicher.getItem(k);
    }
  }
  return alle;
}

/** Nichts Geheimes in der Leiste, im Sitzungs- oder Dauerspeicher, und kein Netzaufruf. */
function ohneLeck(): void {
  const speicher =
    JSON.stringify(eintraege(sessionStorage)) + JSON.stringify(eintraege(localStorage));
  for (const g of GEHEIM) {
    expect(wurzel.textContent).not.toContain(g);
    expect(speicher).not.toContain(g);
  }
  expect(fetchSpion).not.toHaveBeenCalled();
  expect(mikrofonSpion).not.toHaveBeenCalled();
}

function ende(minuten: number): string {
  return new Date(T0 + minuten * MIN).toLocaleTimeString("de", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("de");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  uhr = T0;
  sessionStorage.clear();
  localStorage.clear();
  fetchSpion.mockReset();
  mikrofonSpion.mockReset();
  pruefSpion.mockReset();
  vi.stubGlobal("fetch", fetchSpion);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: mikrofonSpion, getDisplayMedia: mikrofonSpion },
  });
  document.body.innerHTML = FORMULAR;
  wurzel = document.createElement("div");
  document.body.appendChild(wurzel);
});

afterEach(() => {
  abbauen();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("K1 · ein Satz schaltet die Begleitung ein; Bereich, Zweck und Endpunkt stehen da", () => {
  it("Angebot nur am eingerichteten Vorgang; nach dem Start zeigt die Leiste den aktiven Umfang", () => {
    montiere();
    expect(q("begleitung-angebot")?.textContent).toContain("Bereich: Prüfformular Netzteil");
    starte("Produktrecherche, 45 Minuten");
    expect(q("begleitung-zustand")?.textContent).toBe(
      `Begleiten · Prüfformular Netzteil · bis ${ende(45)}`,
    );
    expect(q("begleitung-status")?.textContent).toContain("Zweck: Produktrecherche");
    expect(q("begleitung-medien")?.textContent).toBe(
      "Mikrofon aus · Video aus · keine Aufzeichnung",
    );
    ohneLeck();
  });

  it("ohne eingerichteten Vorgang gibt es kein Angebot", () => {
    document.body.innerHTML = '<section><textarea name="privat">nur so</textarea></section>';
    document.body.appendChild(wurzel);
    montiere();
    expect(wurzel.textContent).toBe("");
  });
});

describe("K4 · Mikrofon und Video bleiben aus", () => {
  it("ein Auftrag mit Mikrofon wird mit Erklärung abgewiesen; kein Gerät wird angefragt", () => {
    montiere();
    starte("Begleite mich 30 Minuten bei der Recherche mit Mikrofon");
    expect(q("begleitung-status")).toBeNull();
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "Mikrofon, Ton und Video aus",
    );
    ohneLeck();
  });
});

describe("K6/K5 · fehlende Einheit: ein Hinweis mit nächstem Schritt, keine Eingabe, keine Wiederholung", () => {
  it("der Hinweis erklärt den Schritt, trägt nichts ein und kommt nach Verwerfen nicht wieder", () => {
    montiere();
    starte("Produktrecherche, 60 Minuten");
    expect(q("begleitung-hinweis")).toBeNull();

    act(() => setzeWert(leistung(), "250"));
    vergeht(1000);
    expect(q("begleitung-hinweis")).toBeNull(); // noch in der Tipppause
    vergeht(1000);
    expect(q("begleitung-hinweis")?.textContent).toContain(
      "Im Feld „Leistung“ steht „250“ ohne Einheit. Nächster Schritt: die Einheit ergänzen (W, kW).",
    );
    expect(q("begleitung-hinweis")?.textContent).toContain("trägt nichts ein");
    expect(leistung().value).toBe("250");
    ohneLeck();

    act(() => knopf("Hinweis verwerfen").click());
    vergeht(20 * MIN);
    expect(q("begleitung-hinweis")).toBeNull();
    expect(leistung().value).toBe("250");

    // Der Mensch ergänzt die Einheit selbst — der Befund ist erledigt, es kommt nichts nach.
    act(() => setzeWert(leistung(), "250 W"));
    vergeht(5 * MIN);
    expect(q("begleitung-hinweis")).toBeNull();
    ohneLeck();
  });
});

describe("K2 · privates oder fremdes Fenster und ausgeschlossene Felder bleiben draußen", () => {
  it("ein privates Fenster und eine fremde Domain werden nicht übernommen", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => {
      window.dispatchEvent(
        new CustomEvent(KONTEXT_EREIGNIS, {
          detail: {
            quelle: { art: "vorgang", kennung: "pruefformular-netzteil", privat: true },
            konto: "u-pia",
            felder: [{ name: "x", bezeichnung: "x", wert: GEHEIM[3] }],
          },
        }),
      );
    });
    expect(q("begleitung-ausserhalb")?.textContent).toContain("hier wird nichts gelesen");
    act(() => {
      window.dispatchEvent(
        new CustomEvent(KONTEXT_EREIGNIS, {
          detail: {
            quelle: { art: "domain", kennung: "privates-postfach.example" },
            konto: "u-pia",
            felder: [{ name: "betreff", bezeichnung: "Betreff", wert: GEHEIM[3] }],
          },
        }),
      );
    });
    expect(q("begleitung-ausserhalb")).not.toBeNull();
    act(() => {
      (q("begleitung-auskunft") as HTMLDetailsElement).open = true;
    });
    expect(q("begleitung-auskunft")?.textContent).toContain("0 gelesene Felder");
    ohneLeck();
  });

  it("im Bereich werden nur die freigegebenen Felder gelesen — nie Kundennummer, PIN oder Nachbartext", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    vergeht(5000);
    expect(q("begleitung-auskunft")?.textContent).toContain(
      "verfällt bei Pause und Stopp: 2 gelesene Felder",
    );
    ohneLeck();
  });
});

describe("K3 · Pause und Stopp über Tastatur und Leiste, ohne geöffnetes Gespräch", () => {
  it("Alt+Umschalt+P pausiert und setzt fort, Alt+Umschalt+S stoppt; danach wird nichts übernommen", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    const pause = knopf("Pause");
    expect(pause.getAttribute("aria-keyshortcuts")).toBe("Alt+Shift+P");
    expect(knopf("Stopp").getAttribute("aria-keyshortcuts")).toBe("Alt+Shift+S");

    taste("KeyP");
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · Prüfformular Netzteil/);
    expect(q("begleitung-grund")?.textContent).toBe("Von dir pausiert.");
    act(() => setzeWert(leistung(), "250"));
    vergeht(10_000);
    expect(q("begleitung-hinweis")).toBeNull();
    expect(q("begleitung-auskunft")?.textContent).toContain(": 0 gelesene Felder");

    taste("KeyP");
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    taste("KeyS");
    expect(q("begleitung-beendet")?.textContent).toContain(
      "Der beobachtete Kontext ist verworfen, nichts davon wurde gespeichert.",
    );
    expect(sessionStorage.getItem("klarwerk.begleitung.freigabe")).toBeNull();

    act(() => setzeWert(leistung(), "999"));
    act(() => {
      window.dispatchEvent(
        new CustomEvent(KONTEXT_EREIGNIS, {
          detail: {
            quelle: { art: "vorgang", kennung: "pruefformular-netzteil" },
            konto: "u-pia",
            felder: [{ name: "y", bezeichnung: "y", wert: GEHEIM[3] }],
          },
        }),
      );
    });
    vergeht(MIN);
    expect(q("begleitung-hinweis")).toBeNull();
    expect(q("begleitung-status")).toBeNull();
    ohneLeck();
  });

  it("Pause und Stopp gehen auch mit der Maus über die Leiste", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => knopf("Pause").click());
    expect(knopf("Fortsetzen")).toBeTruthy();
    act(() => knopf("Stopp").click());
    expect(q("begleitung-beendet")).not.toBeNull();
  });
});

describe("K7 · Sperrbildschirm, Kontowechsel, Rechteentzug pausieren; Neuladen verlängert nichts", () => {
  it("Sperrbildschirm pausiert, Kontowechsel und fehlende Rechte verhindern das Fortsetzen", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => {
      window.dispatchEvent(
        new CustomEvent(SYSTEM_EREIGNIS, { detail: { ereignis: "sperrbildschirm" } }),
      );
    });
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil der Bildschirm gesperrt wurde.",
    );

    // Ein anderes Konto sieht weder Zweck noch Bereich der pausierten Begleitung.
    montiere("u-ben");
    expect(wurzel.textContent).toBe("");
    montiere("u-pia");
    expect(q("begleitung-grund")?.textContent).toBe("Pausiert, weil das Konto gewechselt hat.");

    // Weiter angemeldet, aber die Rolle ist für diesen Vorgang nicht (mehr) zugelassen: auch
    // Verwaltung allein genügt nicht.
    uhr = T0 + 2 * MIN;
    montiere("u-pia", "admin");
    expect(q("begleitung-grund")?.textContent).toBe("Pausiert, weil der Zugriff entzogen wurde.");
    act(() => knopf("Fortsetzen").click());
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain("gerade nicht erlaubt");

    // Die Rolle passt wieder, aber die Serverbestätigung stammt von VOR dem Entzug: gesperrt, und
    // eine frische Bestätigung wird angefordert.
    uhr = T0 + 3 * MIN;
    montiere("u-pia", "experte", T0 + MIN);
    act(() => knopf("Fortsetzen").click());
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain("neu bestätigt");
    expect(pruefSpion).toHaveBeenCalledTimes(1);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);

    // Erst die nach dem Entzug bestätigte Berechtigung erlaubt das bewusste Fortsetzen.
    montiere("u-pia", "experte", T0 + 3 * MIN);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    act(() => knopf("Fortsetzen").click());
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
  });

  it("Rechteentzug bei weiter angemeldetem Nutzer: sofort pausiert, ohne das Formular zu lesen", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    vergeht(5000);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 2 gelesene Felder");
    const lesen = vi.spyOn(document, "querySelectorAll");
    montiere("u-pia", "viewer");
    vergeht(10_000);
    expect(q("begleitung-grund")?.textContent).toBe("Pausiert, weil der Zugriff entzogen wurde.");
    expect(q("begleitung-auskunft")?.textContent).toContain(": 0 gelesene Felder");
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);
    lesen.mockRestore();
  });

  it("verborgenes Fenster pausiert ohne vorheriges Lesen; Fortsetzen nur bewusst", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    const lesen = vi.spyOn(document, "querySelectorAll");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(q("begleitung-grund")?.textContent).toContain("Fenster verborgen");
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);
    lesen.mockRestore();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    vergeht(10_000);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    act(() => knopf("Fortsetzen").click());
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
  });

  it("mit Idle Detection: ein gesperrter Bildschirm pausiert — gemeldet vom Browser, nicht gestellt", async () => {
    const box: { melder: (EventTarget & { screenState: string }) | null } = { melder: null };
    class IdleDetectorAttrappe extends EventTarget {
      screenState = "unlocked";
      static requestPermission = vi.fn(async () => "granted");
      constructor() {
        super();
        box.melder = this;
      }
      async start(): Promise<void> {}
    }
    vi.stubGlobal("IdleDetector", IdleDetectorAttrappe);
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    expect(box.melder).not.toBeNull();
    expect(IdleDetectorAttrappe.requestPermission).toHaveBeenCalledTimes(1);
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(
      "Sperrbildschirm wird erkannt und pausiert.",
    );
    act(() => {
      const melder = box.melder;
      if (melder) {
        melder.screenState = "locked";
        melder.dispatchEvent(new Event("change"));
      }
    });
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil der Bildschirm gesperrt wurde.",
    );
  });

  it("Neuladen findet die Freigabe pausiert und mit demselben Endpunkt; nach dem Endpunkt ist Schluss", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    vergeht(10 * MIN);
    abbauen();

    montiere();
    expect(q("begleitung-zustand")?.textContent).toBe(
      `Pausiert · Prüfformular Netzteil · bis ${ende(30)}`,
    );
    expect(q("begleitung-grund")?.textContent).toContain("Nach dem Neuladen pausiert");
    act(() => {
      uhr = T0 + 31 * MIN;
    });
    act(() => knopf("Fortsetzen").click());
    expect(q("begleitung-beendet")?.textContent).toContain("am Endpunkt abgelaufen");
    abbauen();

    montiere();
    expect(q("begleitung-status")).toBeNull();
    expect(sessionStorage.getItem("klarwerk.begleitung.freigabe")).toBeNull();
  });
});

describe("K8 · bewusst übernommene Notiz getrennt, Gespeichertes einsehbar, Löschen wirkt", () => {
  it("nur die übernommene Notiz bleibt — auch nach Stopp —, und Löschen entfernt sie aus dem Speicher", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => setzeWert(leistung(), "250"));
    vergeht(2000);
    act(() => knopf("Als Notiz übernehmen").click());
    expect(q("begleitung-notizen")?.textContent).toContain(
      "Prüfformular Netzteil: „Leistung“ = „250“ – Einheit fehlt",
    );
    expect(q("begleitung-auskunft")?.textContent).toContain("Bewusst übernommene Notizen: 1");
    expect(q("begleitung-auskunft")?.textContent).toContain("Kein Verlauf, keine Aufnahme");
    const schluessel = "klarwerk.begleitung.notizen.u-pia";
    expect(sessionStorage.getItem(schluessel)).toContain("Einheit fehlt");

    taste("KeyS");
    expect(q("begleitung-notizen")).not.toBeNull();
    act(() => knopf("Notiz löschen").click());
    expect(q("begleitung-notizen")).toBeNull();
    expect(sessionStorage.getItem(schluessel)).toBeNull();
    const rest = Object.keys(eintraege(sessionStorage));
    expect(rest.filter((k) => k.startsWith("klarwerk.begleitung"))).toEqual([]);
    ohneLeck();
  });
});
