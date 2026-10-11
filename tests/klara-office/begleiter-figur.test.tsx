// ================================================================================================
// KLARA-OFFICE-02 · FIGUR, FENSTERWAHL UND BRÜCKE — die reinen Entscheidungen der Webfläche.
// ================================================================================================
//
//   F1  KO-02-06 · Die Figur folgt TATSÄCHLICHEN Zuständen (hört zu, liest vor, wartet, Fehler,
//       Antwort, Ruhe) — in fester Rangfolge, mit begrenztem Nachklang.
//   F2  KO-02-05 / KO-02-04 · Welches Word-Fenster gilt: das gewählte bleibt gebunden (auch still,
//       dann ohne Auswahl); sonst das zuletzt aktive; ohne aktives keines.
//   F3  KO-02-03 · Tastaturbewegung: Pfeiltasten, mit Umschalt der grosse Schritt; andere Tasten nicht.
//   F4  Die Brücke zur App: im Browser wirkungslos, in der App genau eine Nachricht; nur bekannte
//       Befehle der App kommen an; die Fassung der App wird nur gelesen, wenn sie wohlgeformt ist.
import { describe, expect, it } from "vitest";
import {
  type BegleiterAdapter,
  type BegleiterKontext,
  FIGUR_NACHKLANG_MS,
  SCHRITT_GROSS,
  SCHRITT_KLEIN,
  aktionLaeuft,
  bewegungsSchritt,
  figurZustand,
  gueltigeAuswahl,
  waehleAdapter,
} from "../../apps/web/src/lib/begleiter";
import {
  BRUECKEN_EREIGNIS,
  anNative,
  appFassung,
  hoereAufNative,
  inBegleitApp,
} from "../../apps/web/src/lib/begleiterBruecke";

const JETZT = Date.parse("2026-10-10T09:00:00.000Z");
const RUHE = {
  wartet: false,
  hoert: false,
  liest: false,
  letzteModus: null,
  letzteAm: null,
  stoerung: false,
  jetzt: JETZT,
};

function adapter(instanz: string, aktiv: boolean, text: string | null): BegleiterAdapter {
  return {
    instanz,
    host: "word-mac",
    hostFassung: "16.89",
    dokument: { titel: `${instanz}.docx`, gespeichert: true },
    aktiv,
    stilleMs: aktiv ? 1000 : 30_000,
    auswahl: text === null ? null : { text, laenge: text.length, stand: 1, gekuerzt: false },
    aktionen: [],
  };
}

function kontext(...adapterListe: BegleiterAdapter[]): BegleiterKontext {
  return { jetzt: new Date(JETZT).toISOString(), aktivMs: 12_000, adapter: adapterListe };
}

describe("F1 · KO-02-06 — tatsächliche Zustände steuern die Figur", () => {
  it("Ruhe ohne Anlass", () => {
    expect(figurZustand(RUHE)).toBe("ruhe");
  });

  it("Rangfolge: hört zu > liest vor > wartet > Fehler > Antwort", () => {
    const antwort = { ...RUHE, letzteModus: "ki", letzteAm: JETZT - 1000 };
    const alles = { ...antwort, hoert: true, liest: true, wartet: true, stoerung: true };
    expect(figurZustand(alles)).toBe("hoert");
    expect(figurZustand({ ...alles, hoert: false })).toBe("spricht");
    expect(figurZustand({ ...alles, hoert: false, liest: false })).toBe("wartet");
    expect(figurZustand({ ...antwort, stoerung: true })).toBe("fehler");
    expect(figurZustand(antwort)).toBe("antwortet");
  });

  it("eine Antwort ohne KI zählt als Antwort; Fehler und Abbruch als Fehler; Nachklang begrenzt", () => {
    expect(figurZustand({ ...RUHE, letzteModus: "ohne_ki", letzteAm: JETZT })).toBe("antwortet");
    expect(figurZustand({ ...RUHE, letzteModus: "fehler", letzteAm: JETZT })).toBe("fehler");
    expect(figurZustand({ ...RUHE, letzteModus: "abgebrochen", letzteAm: JETZT })).toBe("fehler");
    const alt = JETZT - FIGUR_NACHKLANG_MS - 1;
    expect(figurZustand({ ...RUHE, letzteModus: "ki", letzteAm: alt })).toBe("ruhe");
    // Eine Hilfeantwort ist keine Antwort des Fragewegs — die Figur bleibt ruhig.
    expect(figurZustand({ ...RUHE, letzteModus: "hilfetext", letzteAm: JETZT })).toBe("ruhe");
  });
});

describe("F2 · KO-02-05/KO-02-04 — welches Word-Fenster gilt", () => {
  it("ohne Kontext und ohne aktives Fenster: keines", () => {
    expect(waehleAdapter(null, null)).toBeNull();
    expect(waehleAdapter(kontext(adapter("still", false, "alt")), null)).toBeNull();
  });

  it("ohne Wahl das zuletzt aktive (die Reihenfolge des Kanals)", () => {
    const still = adapter("still", false, "x");
    const k = kontext(still, adapter("neu", true, "y"), adapter("alt", true, "z"));
    expect(waehleAdapter(k, null)?.instanz).toBe("neu");
  });

  it("die Wahl bleibt gebunden — auch still, dann aber OHNE Auswahl", () => {
    const k = kontext(adapter("a", true, "Text A"), adapter("b", false, "Text B"));
    const b = waehleAdapter(k, "b");
    expect(b?.instanz).toBe("b");
    expect(gueltigeAuswahl(b)).toBeNull();
    const a = waehleAdapter(k, "a");
    expect(gueltigeAuswahl(a)?.text).toBe("Text A");
    // Ein gewähltes Fenster, das der Kanal nicht mehr führt, fällt auf das aktive zurück.
    expect(waehleAdapter(k, "weg")?.instanz).toBe("a");
  });

  it("eine laufende Aktion lässt die Figur warten", () => {
    const a = adapter("a", true, null);
    expect(aktionLaeuft(a)).toBe(false);
    a.aktionen.push({ id: "1", art: "frage", stand: "uebergeben", ergebnis: null, grund: null });
    expect(aktionLaeuft(a)).toBe(true);
    a.aktionen[0] = { id: "1", art: "frage", stand: "erledigt", ergebnis: "ok", grund: null };
    expect(aktionLaeuft(a)).toBe(false);
  });
});

describe("F3 · KO-02-03 — Tastaturbewegung", () => {
  it("Pfeiltasten verschieben, Umschalt weiter; andere Tasten nicht", () => {
    expect(bewegungsSchritt("ArrowLeft", false)).toEqual({ dx: -SCHRITT_KLEIN, dy: 0 });
    expect(bewegungsSchritt("ArrowRight", true)).toEqual({ dx: SCHRITT_GROSS, dy: 0 });
    expect(bewegungsSchritt("ArrowUp", false)).toEqual({ dx: 0, dy: -SCHRITT_KLEIN });
    expect(bewegungsSchritt("ArrowDown", true)).toEqual({ dx: 0, dy: SCHRITT_GROSS });
    expect(bewegungsSchritt("Enter", false)).toBeNull();
    expect(bewegungsSchritt("a", true)).toBeNull();
  });
});

describe("F4 · die Brücke zwischen Webfläche und App", () => {
  it("im Browser: keine App, keine Wirkung", () => {
    const browser = new EventTarget() as unknown as Window;
    expect(inBegleitApp(browser)).toBe(false);
    expect(anNative({ art: "modus", modus: "figur" }, browser)).toBe(false);
    expect(appFassung(browser)).toBeNull();
  });

  it("in der App: genau die Nachricht geht an den Nachrichtenkanal", () => {
    const gesendet: unknown[] = [];
    const kanal = {
      postMessage: (n: unknown) => {
        gesendet.push(n);
      },
    };
    const app = {
      webkit: { messageHandlers: { klaraBegleiter: kanal } },
      __KLARA_BEGLEITER__: { fassung: "0.1.0", bau: "3cb8a929" },
    } as unknown as Window;
    expect(inBegleitApp(app)).toBe(true);
    expect(anNative({ art: "bewegen", dx: 12, dy: 0 }, app)).toBe(true);
    expect(gesendet).toEqual([{ art: "bewegen", dx: 12, dy: 0 }]);
    expect(appFassung(app)).toBe("0.1.0 (3cb8a929)");
  });

  it("eine nicht wohlgeformte Fassung wird nicht angezeigt", () => {
    const app = { __KLARA_BEGLEITER__: { fassung: "<b>1</b>", bau: "x" } } as unknown as Window;
    expect(appFassung(app)).toBeNull();
  });

  it("nur bekannte Befehle der App kommen an; Abmelden wirkt", () => {
    const ziel = new EventTarget();
    const w = ziel as unknown as Window;
    const angekommen: string[] = [];
    const ab = hoereAufNative((b) => angekommen.push(b), w);
    const sende = (befehl: unknown) =>
      ziel.dispatchEvent(new CustomEvent(BRUECKEN_EREIGNIS, { detail: { befehl } }));
    sende("figur-klick");
    sende("alles-loeschen");
    sende(42);
    sende("reduziert-an");
    ab();
    sende("gespraech-oeffnen");
    expect(angekommen).toEqual(["figur-klick", "reduziert-an"]);
  });
});
