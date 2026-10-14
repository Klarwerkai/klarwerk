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

/** Eine STABILE Uhr: die Leiste hängt ihre Effekte daran, eine neue Funktion je Aufbau täte es nicht. */
const UHR = (): number => uhr;

/**
 * Der Server dieser Bühne (Nacharbeit 13). `pruefSpion` spielt die Antwort auf `/auth/me`: er
 * bestätigt die Sitzung JETZT (`geprueftAm = uhr`) mit der Rolle, die der Server gerade führt —
 * `server.rolle`, wenn ein Fall sie entzieht, sonst die zuletzt montierte. `server.antwortet =
 * false` ist der Server, der nicht antwortet.
 */
const server: { rolle: string | null | undefined; antwortet: boolean } = {
  rolle: undefined,
  antwortet: true,
};
let stand: { konto: string | null; rolle: string | null; geprueftAm: number } = {
  konto: "u-pia",
  rolle: "experte",
  geprueftAm: 0,
};

function zeichne(): void {
  root?.render(
    createElement(KlaraBegleitung, {
      konto: stand.konto,
      rolle: stand.rolle,
      rechteGeprueftAm: stand.geprueftAm,
      pruefeRechte: pruefSpion,
      jetzt: UHR,
    }),
  );
}

const pruefSpion = vi.fn();
function serverAntwortet(): void {
  if (!server.antwortet) {
    return;
  }
  stand = {
    ...stand,
    rolle: server.rolle === undefined ? stand.rolle : server.rolle,
    geprueftAm: uhr,
  };
  zeichne();
}

/** `rolle` und `geprueftAm` stehen für die vom Server bestätigte Sitzung (`/auth/me`). */
function montiere(
  konto: string | null = "u-pia",
  rolle: string | null = "experte",
  geprueftAm = 0,
): void {
  stand = { konto, rolle, geprueftAm };
  act(() => {
    if (!root) {
      root = createRoot(wurzel);
    }
    zeichne();
  });
}

/** Lässt ausstehende Versprechen (Erlaubnis, Melderstart) innerhalb von `act` durchlaufen. */
async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i += 1) {
      await Promise.resolve();
    }
  });
}

type MelderArt = "ok" | "startFehler" | "konstruktorFehler" | "haelt";

interface Melderprobe {
  art: MelderArt;
  melder: (EventTarget & { screenState: string })[];
  signale: AbortSignal[];
  freigeben: (() => void)[];
  erlaubnis: { mock: { calls: unknown[][] } };
}

/**
 * Eine Idle-Detection-Attrappe, deren Verhalten der Fall steuert: Start gelingt, scheitert, der
 * Konstruktor wirft, oder der Start hält an, bis der Fall ihn freigibt.
 */
function idleAttrappe(art: MelderArt): Melderprobe {
  const erlaubnis = vi.fn(async () => "granted");
  const probe: Melderprobe = { art, melder: [], signale: [], freigeben: [], erlaubnis };
  class Attrappe extends EventTarget {
    screenState = "unlocked";
    static requestPermission = erlaubnis;
    constructor() {
      super();
      if (probe.art === "konstruktorFehler") {
        throw new Error("IdleDetector nicht verfügbar");
      }
      probe.melder.push(this);
    }
    start(optionen: { signal: AbortSignal }): Promise<void> {
      probe.signale.push(optionen.signal);
      if (probe.art === "startFehler") {
        return Promise.reject(new Error("NotAllowedError"));
      }
      if (probe.art === "haelt") {
        return new Promise((weiter) => probe.freigeben.push(() => weiter()));
      }
      return Promise.resolve();
    }
  }
  vi.stubGlobal("IdleDetector", Attrappe);
  return probe;
}

function sperreBildschirm(probe: Melderprobe): void {
  act(() => {
    const melder = probe.melder[probe.melder.length - 1];
    if (melder) {
      melder.screenState = "locked";
      melder.dispatchEvent(new Event("change"));
    }
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
  pruefSpion.mockImplementation(serverAntwortet);
  server.rolle = undefined;
  server.antwortet = true;
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

    // Die Rolle ist wieder zugelassen, die gespeicherte Bestätigung stammt aber von VOR dem Entzug.
    // Nacharbeit 16: die alte Zugriffsmeldung ist damit überholt und verschwindet; das allein setzt
    // nicht fort. Der bewusste Klick holt eine FRISCHE Bestätigung und setzt dann in EINEM Schritt
    // fort — ohne Neuladen, ohne zweiten Klick, ohne falsche Zwischenmeldung.
    uhr = T0 + 3 * MIN;
    montiere("u-pia", "experte", T0 + MIN);
    expect(wurzel.querySelector('[role="alert"]')).toBeNull();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    const anfragenVorher = pruefSpion.mock.calls.length;
    act(() => knopf("Fortsetzen").click());
    expect(pruefSpion.mock.calls.length).toBeGreaterThan(anfragenVorher);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(wurzel.querySelector('[role="alert"]')).toBeNull();
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
    await flush();
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

// ================================================================================================
// NACHARBEIT 3 (Ben AC07/G10, AC07-Wiederaufnahme): der Sperrbildschirmmelder sagt nur zu, was er
// tatsächlich tut, und wird bei jeder bewussten Wiederaufnahme neu hergestellt und geprüft.
// ================================================================================================
describe("K7 · Sperrbildschirmmelder: tatsächlicher Zustand, Ausfall, Wiederaufnahme", () => {
  const ERKANNT = "Sperrbildschirm wird erkannt und pausiert.";

  it("die Zusage steht erst nach erfolgreichem Start; vorher ist nichts aktiv", async () => {
    const probe = idleAttrappe("haelt");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    expect(q("begleitung-zustand")).toBeNull();
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(
      "Sperrbildschirmerkennung wird eingerichtet …",
    );
    expect(wurzel.textContent).not.toContain(ERKANNT);

    act(() => probe.freigeben[0]?.());
    await flush();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(ERKANNT);
  });

  it("scheitert start(): pausiert, Fehler sichtbar, keine Zusage — Fortsetzen versucht es neu", async () => {
    const probe = idleAttrappe("startFehler");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil die erlaubte Sperrbildschirmerkennung nicht gestartet werden konnte.",
    );
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "ließ sich nicht starten",
    );
    expect(wurzel.textContent).not.toContain(ERKANNT);
    expect(probe.signale[0]?.aborted).toBe(true);

    probe.art = "ok";
    act(() => knopf("Fortsetzen").click());
    await flush();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(ERKANNT);
  });

  it("wirft der Konstruktor: ebenso pausiert und sichtbar, nichts verschluckt", async () => {
    idleAttrappe("konstruktorFehler");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    expect(q("begleitung-grund")?.textContent).toContain("nicht gestartet werden konnte");
    expect(wurzel.textContent).not.toContain(ERKANNT);
  });

  it("nach Neuladen stellt Fortsetzen den Melder wieder her und prüft ihn, bevor beobachtet wird", async () => {
    const probe = idleAttrappe("ok");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(ERKANNT);
    abbauen();
    expect(probe.signale[0]?.aborted).toBe(true);

    montiere();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(wurzel.textContent).not.toContain(ERKANNT);
    act(() => knopf("Fortsetzen").click());
    await flush();
    expect(probe.erlaubnis.mock.calls.length).toBe(2);
    expect(probe.melder.length).toBe(2);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(ERKANNT);

    sperreBildschirm(probe);
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil der Bildschirm gesperrt wurde.",
    );
    expect(probe.signale[1]?.aborted).toBe(true);
  });

  it("Stopp während des asynchronen Starts: bleibt gestoppt, der späte Melder wird freigegeben", async () => {
    const probe = idleAttrappe("ok");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    act(() => knopf("Pause").click());
    expect(probe.signale[0]?.aborted).toBe(true);

    probe.art = "haelt";
    act(() => knopf("Fortsetzen").click());
    await flush();
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(
      "Sperrbildschirmerkennung wird eingerichtet …",
    );
    act(() => knopf("Stopp").click());
    act(() => probe.freigeben[0]?.());
    await flush();
    expect(q("begleitung-beendet")).not.toBeNull();
    expect(q("begleitung-status")).toBeNull();
    expect(probe.signale[1]?.aborted).toBe(true);
  });

  it("Ablauf während des asynchronen Starts: keine Aktivierung über den Endpunkt hinaus", async () => {
    const probe = idleAttrappe("ok");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    act(() => knopf("Pause").click());
    probe.art = "haelt";
    act(() => knopf("Fortsetzen").click());
    await flush();
    uhr = T0 + 31 * MIN;
    act(() => probe.freigeben[0]?.());
    await flush();
    expect(q("begleitung-beendet")?.textContent).toContain("am Endpunkt abgelaufen");
    expect(probe.signale[1]?.aborted).toBe(true);
  });

  it("Rechteentzug während des asynchronen Starts: bleibt pausiert, der Melder wird freigegeben", async () => {
    const probe = idleAttrappe("ok");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    act(() => knopf("Pause").click());
    probe.art = "haelt";
    act(() => knopf("Fortsetzen").click());
    await flush();
    montiere("u-pia", "viewer");
    act(() => probe.freigeben[0]?.());
    await flush();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(q("begleitung-grund")?.textContent).toBe("Pausiert, weil der Zugriff entzogen wurde.");
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain("gerade nicht erlaubt");
    expect(probe.signale[1]?.aborted).toBe(true);
  });

  it("Sperre während des Erststarts: die verspätete Startantwort aktiviert nicht", async () => {
    const probe = idleAttrappe("haelt");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    expect(probe.melder.length).toBe(1);
    sperreBildschirm(probe);
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "während die Begleitung eingerichtet wurde",
    );

    act(() => probe.freigeben[0]?.());
    await flush();
    // Die verspätete Antwort des entwerteten Versuchs gibt ihren Melder sofort frei.
    expect(probe.signale[0]?.aborted).toBe(true);
    expect(q("begleitung-zustand")).toBeNull();
    expect(q("begleitung-status")).toBeNull();
    expect(q("begleitung-angebot")).not.toBeNull();
    expect(wurzel.textContent).not.toContain(ERKANNT);

    // Erst ein neuer, bewusster Start aktiviert.
    probe.art = "ok";
    starte("Produktrecherche, 30 Minuten");
    await flush();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(ERKANNT);
  });

  it("Sperre während des Fortsetzens: Sperrbildschirmpause bleibt, die Startantwort hebt sie nicht auf", async () => {
    const probe = idleAttrappe("ok");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    act(() => knopf("Pause").click());
    probe.art = "haelt";
    act(() => knopf("Fortsetzen").click());
    await flush();
    expect(probe.melder.length).toBe(2);
    sperreBildschirm(probe);
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil der Bildschirm gesperrt wurde.",
    );
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "während die Begleitung eingerichtet wurde",
    );

    act(() => probe.freigeben[0]?.());
    await flush();
    expect(probe.signale[1]?.aborted).toBe(true);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil der Bildschirm gesperrt wurde.",
    );
    expect(wurzel.textContent).not.toContain(ERKANNT);

    // Erst ein erneutes, bewusstes Fortsetzen aktiviert — mit neu eingerichtetem Melder.
    probe.art = "ok";
    act(() => knopf("Fortsetzen").click());
    await flush();
    expect(probe.melder.length).toBe(3);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(ERKANNT);
  });

  it("Fokusverlust während des Erststarts: die verspätete Antwort aktiviert auch nach Rückkehr nicht", async () => {
    const probe = idleAttrappe("haelt");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "anderes Fenster in den Vordergrund",
    );
    act(() => probe.freigeben[0]?.());
    await flush();
    expect(probe.signale[0]?.aborted).toBe(true);
    expect(q("begleitung-zustand")).toBeNull();
    expect(q("begleitung-angebot")).not.toBeNull();
  });

  it("Fokusverlust während des Fortsetzens: bleibt pausiert, die Rückkehr setzt nicht fort", async () => {
    const probe = idleAttrappe("ok");
    montiere();
    starte("Produktrecherche, 30 Minuten");
    await flush();
    act(() => knopf("Pause").click());
    probe.art = "haelt";
    act(() => knopf("Fortsetzen").click());
    await flush();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    act(() => probe.freigeben[0]?.());
    await flush();
    expect(probe.signale[1]?.aborted).toBe(true);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil ein anderes Fenster im Vordergrund ist. Die Rückkehr setzt nicht von selbst fort.",
    );
  });

  it("ohne Idle Detection bleibt es ehrlich beim Fenstersignal", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    expect(q("begleitung-sperrerkennung")?.textContent).toBe(
      "Sperrbildschirm wird hier nur über das verborgene Fenster erkannt.",
    );
  });
});

// ================================================================================================
// NACHARBEIT 12 (Ben AC02, Hostprobe 84 nicht bestanden): ein SICHTBARES, aber unfokussiertes
// Fenster. Beim Wechsel in ein separates oder privates Fenster bleibt dieses Fenster sichtbar —
// `document.hidden` bleibt `false`, es feuert nur `blur`. Genau so wird es hier gestellt.
// ================================================================================================
describe("K2/K7 · Fensterwechsel bei sichtbarem Fenster: Fokus wird vor jedem Lesen geprüft", () => {
  const FOKUS =
    "Pausiert, weil ein anderes Fenster im Vordergrund ist. Die Rückkehr setzt nicht von selbst fort.";

  it("anderes Fenster vorn: sofort Pause, Kontext verworfen, kein Lesen — Rückkehr setzt nicht fort", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    vergeht(5000);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 2 gelesene Felder");
    expect(document.hidden).toBe(false);

    const lesen = vi.spyOn(document, "querySelectorAll");
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(document.hidden).toBe(false);
    expect(q("begleitung-grund")?.textContent).toBe(FOKUS);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 0 gelesene Felder");

    // Eingaben im Formular während das andere Fenster vorn ist: nichts wird gelesen.
    act(() => setzeWert(leistung(), "250"));
    vergeht(10_000);
    expect(q("begleitung-hinweis")).toBeNull();
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);

    // Zurück ins Fenster: die Rückkehr allein setzt NICHT fort.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    vergeht(10_000);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);
    lesen.mockRestore();

    // Erst das bewusste Fortsetzen liest wieder — frischen Kontext.
    act(() => knopf("Fortsetzen").click());
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    vergeht(2000);
    expect(q("begleitung-hinweis")?.textContent).toContain("„Leistung“");
    ohneLeck();
  });

  it("privates Fenster vorn: kein Inhalt aus ihm, keine Übermittlung, auch nicht über den Host-Weg", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    // Selbst wenn ein Host-Adapter Inhalt eines privaten Fensters meldete: er wird nicht übernommen.
    act(() => {
      window.dispatchEvent(
        new CustomEvent(KONTEXT_EREIGNIS, {
          detail: {
            quelle: { art: "domain", kennung: "privat.example", privat: true },
            konto: "u-pia",
            felder: [{ name: "x", bezeichnung: "x", wert: GEHEIM[3] }],
          },
        }),
      );
    });
    vergeht(10_000);
    expect(q("begleitung-grund")?.textContent).toBe(FOKUS);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 0 gelesene Felder");
    ohneLeck();
  });

  it("Fortsetzen, während ein anderes Fenster vorn ist, aktiviert nicht", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => knopf("Pause").click());
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    // z. B. per Tastenkürzel aus einem anderen Fenster ausgelöst, ohne dass dieses Fenster vorn ist
    taste("KeyP");
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(q("begleitung-grund")?.textContent).toBe(FOKUS);
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "anderes Fenster in den Vordergrund",
    );
  });
});

// ================================================================================================
// NACHARBEIT 13 (Ben AC07/G04, Hostprobe 91 nicht bestanden): nach serverbestätigtem Entzug las
// die Begleitung weiter — sechs Felder und ein neuer Hinweis zum Wert 9191 —, weil sie nur die
// zwischengespeicherte Sitzungsrolle kannte. Hier entzieht der SERVER die Rolle, während die Leiste
// noch die alte im Speicher hat; dieselbe Eingabe 9191 folgt.
// ================================================================================================
describe("K7 · jede lokale Lesung braucht eine frische Serverbestätigung", () => {
  const ENTZOGEN = "Pausiert, weil der Zugriff entzogen wurde.";

  it("Entzug am Server bei weiter angemeldetem Nutzer: vor dem nächsten Lesen erkannt, nichts gelesen", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    vergeht(5000);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 2 gelesene Felder");

    // Der Server entzieht die Rolle. Die Leiste hat noch „experte" im Speicher.
    server.rolle = "viewer";
    const lesen = vi.spyOn(document, "querySelectorAll");
    act(() => setzeWert(leistung(), "9191"));
    vergeht(2000);

    expect(q("begleitung-grund")?.textContent).toBe(ENTZOGEN);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 0 gelesene Felder");
    expect(q("begleitung-hinweis")).toBeNull();
    expect(wurzel.textContent).not.toContain("9191");
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);

    // Noch entzogen: der Klick wartet auf die frische Bestätigung und nennt dann den TATSÄCHLICHEN
    // Grund (Nacharbeit 16).
    act(() => knopf("Fortsetzen").click());
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain("gerade nicht erlaubt");
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);

    // Hostprobe 95: die Rolle wird exakt wiederhergestellt. Eine spätere Serverbestätigung nimmt
    // die überholte Zugriffsmeldung zurück — fortgesetzt wird dadurch NICHT.
    server.rolle = "experte";
    vergeht(20_000);
    act(() => serverAntwortet());
    expect(wurzel.querySelector('[role="alert"]')).toBeNull();
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);
    lesen.mockRestore();

    // Bewusstes Fortsetzen: EIN Klick, ohne Neuladen, mit frischer Bestätigung und derselben Frist.
    const fristVorher = q("begleitung-zustand")?.textContent?.split(" · bis ")[1];
    act(() => knopf("Fortsetzen").click());
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-zustand")?.textContent?.split(" · bis ")[1]).toBe(fristVorher);
    expect(wurzel.querySelector('[role="alert"]')).toBeNull();
    vergeht(2000);
    expect(q("begleitung-hinweis")?.textContent).toContain("„9191“");
    ohneLeck();
  });

  it("Fortsetzen wartet auf die Bestätigung: Hinweis während des Wartens, ohne Antwort „unbestätigt“", () => {
    montiere();
    starte("Produktrecherche, 30 Minuten");
    act(() => knopf("Pause").click());
    server.antwortet = false;
    act(() => knopf("Fortsetzen").click());
    // Kein vorschneller Zugriffsfehler aus dem Zwischenspeicher — sondern ehrlich: es wird bestätigt.
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain(
      "Der Zugriff wird beim Server bestätigt",
    );
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    vergeht(11_000);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    expect(wurzel.querySelector('[role="alert"]')?.textContent).toContain("neu bestätigt");
  });

  it("antwortet der Server nicht, wird nicht gelesen — nach der Frist Pause „unbestätigt“", () => {
    server.antwortet = false;
    montiere();
    starte("Produktrecherche, 30 Minuten");
    // Erst ab hier: vor dem Start sucht das Angebot den Bereich legitim (ohne Feldwerte).
    const lesen = vi.spyOn(document, "querySelectorAll");
    act(() => setzeWert(leistung(), "250"));
    vergeht(5000);
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 0 gelesene Felder");
    expect(q("begleitung-hinweis")).toBeNull();

    vergeht(10_000);
    expect(q("begleitung-grund")?.textContent).toBe(
      "Pausiert, weil der Server den Zugriff nicht rechtzeitig bestätigt hat. Nichts wurde weiter gelesen.",
    );
    expect(vorgangAbgefragt(lesen.mock.calls)).toBe(false);
    lesen.mockRestore();

    // Der Server antwortet wieder: EIN bewusster Klick holt die Bestätigung (jünger als die Pause)
    // und setzt fort — ohne Neuladen (Nacharbeit 16).
    server.antwortet = true;
    vergeht(1000);
    act(() => knopf("Fortsetzen").click());
    expect(q("begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);
    expect(q("begleitung-auskunft")?.textContent).toContain(": 2 gelesene Felder");
  });
});
