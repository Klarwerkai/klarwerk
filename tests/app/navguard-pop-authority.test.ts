// AUFTRAG-mega13 Block A: die Anmeldung des Zurück-Wächters am Fenster — Kante 3 („genau EINE
// aktive Navigation und genau EIN Dialog") und Kante 7 („kein abgemeldeter oder veralteter Guard
// blockiert die Folgeseite") auf der Ebene, auf der sie entschieden werden: der Autoritäts-Anmeldung.
//
// Bewusst OHNE DOM: das Modul beschreibt sich strukturell (`WindowLike`), deshalb genügt hier eine
// Attrappe — und dieser Beleg läuft im schnellen Node-Lauf mit, nicht erst in jsdom.
//
// AUFTRAG-mega14 Block I (mein O-6, von ben als reine Benennung eingestuft und von Pedi ausdrücklich
// autorisiert): die Datei hieß bis hierher `zz-probe-jsdom-history.test.ts` — ein Wegwerfname für
// einen dauerhaften Beleg. Umbenannt, Inhalt unverändert.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPopAuthorityForTests,
  installPopGuardListener,
  readHistoryIndex,
  releasePopAuthority,
  setPopAuthority,
} from "../../apps/web/src/app/navHistory";

interface FakeWindow {
  history: { state: unknown };
  addEventListener: (
    type: string,
    listener: (event: { stopImmediatePropagation: () => void }) => void,
  ) => void;
}

function fakeWindow(state: unknown): FakeWindow {
  return {
    history: { state },
    addEventListener: () => {},
  };
}

afterEach(() => {
  clearPopAuthorityForTests();
});

describe("Kante 1: der Wächter liest den vom Router gestempelten Index", () => {
  it('eine Zahl wird gelesen, alles andere gilt als „kein Index"', () => {
    expect(readHistoryIndex(fakeWindow({ idx: 7 }))).toBe(7);
    expect(readHistoryIndex(fakeWindow({ idx: 0 }))).toBe(0);
    // Genau die Fälle, die Kante 9 fail-closed behandelt:
    expect(readHistoryIndex(fakeWindow(null))).toBeNull();
    expect(readHistoryIndex(fakeWindow({}))).toBeNull();
    expect(readHistoryIndex(fakeWindow({ idx: "3" }))).toBeNull();
    expect(readHistoryIndex(undefined)).toBeNull();
  });
});

describe("Kante 3: es gibt genau EINE Autorität", () => {
  it("eine zweite Anmeldung wird gemeldet und die neueste gilt — wie beim Router-Blocker", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const erste = (): "pass" => "pass";
    const zweite = (): "swallow" => "swallow";

    setPopAuthority(erste);
    expect(warn).not.toHaveBeenCalled();
    setPopAuthority(zweite);
    // `router.js:3023` macht es genauso: warnen, und der letzte Eintrag gewinnt.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("zwei Zurück-Wächter");
    warn.mockRestore();
  });

  it("dieselbe Autorität zweimal anzumelden ist kein Fehler (Effekt-Neulauf, StrictMode)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const gleiche = (): "pass" => "pass";
    setPopAuthority(gleiche);
    setPopAuthority(gleiche);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Kante 7: das Abmelden ist identitätsgebunden", () => {
  it("ein spät aufräumender Vorgänger räumt den NACHFOLGER nicht ab", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seiteA = (): "pass" => "pass";
    const seiteB = (): "swallow" => "swallow";

    setPopAuthority(seiteA);
    // Reihenfolge wie im Ernstfall verkehrt: die Folgeseite meldet sich an, DANN räumt die Vorseite auf.
    setPopAuthority(seiteB);
    warn.mockClear(); // diese Übernahme warnt erwartungsgemäß — sie ist nicht der Prüfgegenstand.

    releasePopAuthority(seiteA);

    // Der Nachweis läuft über das beobachtbare Verhalten: eine Anmeldung warnt GENAU DANN, wenn der
    // Platz noch besetzt ist. Wäre das Abmelden nicht identitätsgebunden, hätte der späte Aufräumer
    // von A gerade B mitgenommen — dann käme hier keine Warnung, und die Folgeseite stünde ohne
    // Wächter da. Genau der Fehler, den Kante 7 ausschließt.
    setPopAuthority(seiteA);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("nach dem Abmelden der AKTIVEN Autorität ist der Platz frei", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seiteA = (): "pass" => "pass";
    const seiteB = (): "swallow" => "swallow";
    setPopAuthority(seiteA);
    releasePopAuthority(seiteA);
    setPopAuthority(seiteB);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Die Registrierung am Fenster passiert genau einmal", () => {
  it("ein zweiter Aufruf hängt keinen zweiten Listener ein", () => {
    // In diesem Node-Lauf gibt es KEIN `globalThis.window`, der Einhaken beim Modul-Laden ist also
    // ins Leere gelaufen — genau so soll es serverseitig sein. Deshalb hakt hier der erste explizite
    // Aufruf ein und der zweite nicht mehr; liefe der Wächter doppelt, würde er jeden POP zweimal
    // beantworten. (Im Browser/jsdom hakt der Modul-Laden ein, dann tut schon der erste Aufruf nichts.)
    const win = fakeWindow({ idx: 0 });
    const spy = vi.fn();
    win.addEventListener = spy;
    installPopGuardListener(win);
    installPopGuardListener(win);
    installPopGuardListener(win);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe("popstate");
  });

  it("ohne Fenster (Server/Node) passiert nichts", () => {
    expect(() => installPopGuardListener(undefined)).not.toThrow();
  });
});
