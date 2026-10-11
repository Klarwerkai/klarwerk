// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:assistenz-name-avatar · ZUHÖREN UND SPRECHEN NUR BEI BESTÄTIGTER AKTIVITÄT.
// ================================================================================================
//
// ANIMATIONSZUSTAENDE.json: „Zuhören“ erst, wenn das Mikrofon nach erteilter Berechtigung tatsächlich
// aktiv ist; „Sprechen“ erst, wenn die Sprachausgabe tatsächlich abspielt. Eine Startanforderung
// (`rec.start()`, `speechSynthesis.speak()`) ist noch keine Aktivität.
//
// Attrappen sind allein die beiden Browser-Schnittstellen; ihre Ereignisse (`audiostart`,
// `audioend`, `error`, `end` bzw. `start`, `pause`, `resume`, `end`, `error`) löst der Test einzeln
// und verzögert aus — so wie ein Browser, der erst nach der Berechtigungsabfrage aufnimmt.
//
//   S1  Aufnahme angefordert, Berechtigung steht aus → läuft (Stoppknopf), aber hört NICHT zu.
//   S2  `audiostart` → hört zu; `audioend` → hört nicht mehr zu.
//   S3  Berechtigung verweigert („not-allowed“) → hört nie zu, Aufnahme beendet, Hinweis steht da.
//   S4  Stoppen und Abbrechen setzen zurück; späte Ereignisse einer abgelösten Aufnahme sind wirkungslos.
//   P1  Vorlesen angefordert → `liest` (Stoppknopf), aber `spielt` erst ab `start`.
//   P2  `pause` → spielt nicht; `resume` → spielt; `end` → alles zurück.
//   P3  Fehler vor dem Start → spielt nie; Stoppen einer nur wartenden Ausgabe bleibt möglich.
//   P4  Späte `start`/`end` einer abgelösten Ausgabe ändern die neue nicht.
//   F1  Die Figur liest genau diese bestätigten Werte (Quelle `KlaraVorschau.tsx`).
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type KlaraSprachSteuerung,
  type SprachZiel,
  useKlaraSprache,
} from "../../apps/web/src/components/klara-vorschau/KlaraSprache";
import {
  leseVorlesen,
  stoppeVorlesen,
  vorlesen,
} from "../../apps/web/src/components/klara-vorschau/vorlesen";
import i18n from "../../apps/web/src/i18n";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// Attrappen der Browser-Schnittstellen.
// ------------------------------------------------------------------------------------------------
class RekorderDoppel {
  static alle: RekorderDoppel[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e?: { error?: string }) => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onaudioend: (() => void) | null = null;
  constructor() {
    RekorderDoppel.alle.push(this);
  }
  /** Nur die Anforderung — der Browser fragt jetzt erst nach der Berechtigung. */
  start(): void {}
  stop(): void {
    this.onaudioend?.();
    this.onend?.();
  }
}

class AeusserungDoppel {
  static alle: AeusserungDoppel[] = [];
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
    AeusserungDoppel.alle.push(this);
  }
}

const ausgabe = { abgebrochen: 0 };
type Fenster = Record<string, unknown>;
const fenster = window as unknown as Fenster;

function mitSprache(): void {
  fenster.SpeechRecognition = RekorderDoppel;
  fenster.SpeechSynthesisUtterance = AeusserungDoppel;
  fenster.speechSynthesis = {
    // `speak` reiht nur ein — begonnen wird erst mit dem `start`-Ereignis.
    speak: () => {},
    cancel: () => {
      ausgabe.abgebrochen += 1;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function ohneSprache(): void {
  fenster.SpeechRecognition = undefined;
  Reflect.deleteProperty(fenster, "speechSynthesis");
  Reflect.deleteProperty(fenster, "SpeechSynthesisUtterance");
}

// ------------------------------------------------------------------------------------------------
// Eine Sonde mit dem echten Hook der Assistenzfläche.
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let s: KlaraSprachSteuerung | null = null;

const ZIEL = { seitenName: "Test", objekt: "—", bekannt: false } as unknown as SprachZiel;

function Sonde(): null {
  s = useKlaraSprache({ setzeEingabe: () => {}, ziel: () => ZIEL });
  return null;
}

function steuerung(): KlaraSprachSteuerung {
  if (!s) {
    throw new Error("Sonde nicht montiert");
  }
  return s;
}

async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  await act(async () => {
    r.render(createElement(Sonde));
  });
}

/** Ein Browserereignis zustellen — außerhalb von React, wie im Browser. */
async function ereignis(f: () => void): Promise<void> {
  await act(async () => {
    f();
  });
}

function rekorder(i: number): RekorderDoppel {
  const r = RekorderDoppel.alle[i];
  if (!r) {
    throw new Error(`Rekorder ${i} fehlt`);
  }
  return r;
}

function aeusserung(i: number): AeusserungDoppel {
  const a = AeusserungDoppel.alle[i];
  if (!a) {
    throw new Error(`Äußerung ${i} fehlt`);
  }
  return a;
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
});

beforeEach(() => {
  RekorderDoppel.alle = [];
  AeusserungDoppel.alle = [];
  ausgabe.abgebrochen = 0;
  mitSprache();
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  s = null;
  stoppeVorlesen();
  ohneSprache();
});

describe("Zuhören — erst bei bestätigter Tonaufnahme", () => {
  it("S1/S2 · Anforderung ist kein Zuhören; audiostart aktiviert, audioend beendet", async () => {
    await montiere();
    await act(async () => steuerung().starten("diktat"));
    // Berechtigung steht aus: der Stoppweg ist da, die Figur hört aber noch NICHT zu.
    expect(steuerung().laeuft).toBe("diktat");
    expect(steuerung().hoert).toBe(false);

    await ereignis(() => rekorder(0).onaudiostart?.());
    expect(steuerung().hoert).toBe(true);

    await ereignis(() => rekorder(0).onaudioend?.());
    expect(steuerung().hoert).toBe(false);
  });

  it("S3 · verweigerte Berechtigung: nie Zuhören, Aufnahme beendet, Hinweis", async () => {
    await montiere();
    await act(async () => steuerung().starten("diktat"));
    await ereignis(() => rekorder(0).onerror?.({ error: "not-allowed" }));
    expect(steuerung().hoert).toBe(false);
    expect(steuerung().laeuft).toBeNull();
    expect(steuerung().hinweis).toBeTruthy();
  });

  it("S4 · Stoppen und Abbrechen setzen zurück", async () => {
    await montiere();
    await act(async () => steuerung().starten("diktat"));
    await ereignis(() => rekorder(0).onaudiostart?.());
    expect(steuerung().hoert).toBe(true);
    await act(async () => steuerung().stoppen());
    expect(steuerung().hoert).toBe(false);
    expect(steuerung().laeuft).toBeNull();

    await act(async () => steuerung().starten("diktat"));
    await ereignis(() => rekorder(1).onaudiostart?.());
    expect(steuerung().hoert).toBe(true);
    await act(async () => steuerung().abbrechen());
    expect(steuerung().hoert).toBe(false);
    expect(steuerung().laeuft).toBeNull();
  });

  it("S4 · späte Ereignisse einer abgelösten Aufnahme ändern die neue nicht", async () => {
    await montiere();
    await act(async () => steuerung().starten("diktat"));
    const alt = rekorder(0);
    // A scheitert (Spezifikation: `error`, dann `end`), B startet.
    await ereignis(() => alt.onerror?.({ error: "network" }));
    await act(async () => steuerung().starten("diktat"));
    expect(steuerung().laeuft).toBe("diktat");
    // A meldet SPÄT `audiostart` — B hat noch keine Tonaufnahme bestätigt.
    await ereignis(() => alt.onaudiostart?.());
    expect(steuerung().hoert).toBe(false);
    await ereignis(() => rekorder(1).onaudiostart?.());
    expect(steuerung().hoert).toBe(true);
    // A meldet SPÄT `audioend` und `end` — B hört weiter zu.
    await ereignis(() => alt.onaudioend?.());
    await ereignis(() => alt.onend?.());
    expect(steuerung().hoert).toBe(true);
    expect(steuerung().laeuft).toBe("diktat");
  });
});

describe("Sprechen — erst bei bestätigter Wiedergabe", () => {
  it("P1/P2 · Anforderung ist kein Sprechen; start, pause, resume, end", () => {
    expect(vorlesen("a", "Hallo", "de")).toBe(true);
    // Eingereiht, noch nicht begonnen: Stoppknopf ja, Sprechen nein.
    expect(leseVorlesen().liest).toBe("a");
    expect(leseVorlesen().spielt).toBeNull();

    aeusserung(0).onstart?.();
    expect(leseVorlesen().spielt).toBe("a");
    aeusserung(0).onpause?.();
    expect(leseVorlesen().spielt).toBeNull();
    expect(leseVorlesen().liest).toBe("a");
    aeusserung(0).onresume?.();
    expect(leseVorlesen().spielt).toBe("a");
    aeusserung(0).onend?.();
    expect(leseVorlesen()).toMatchObject({ liest: null, spielt: null });
  });

  it("P3 · Fehler vor dem Start: nie Sprechen; Stoppen einer wartenden Ausgabe", () => {
    vorlesen("a", "Hallo", "de");
    aeusserung(0).onerror?.();
    expect(leseVorlesen()).toMatchObject({ liest: null, spielt: null });

    vorlesen("b", "Noch einmal", "de");
    const vorher = ausgabe.abgebrochen;
    stoppeVorlesen();
    expect(ausgabe.abgebrochen).toBeGreaterThan(vorher);
    expect(leseVorlesen()).toMatchObject({ liest: null, spielt: null });
    // Der Browser meldet den Start der gestoppten Ausgabe zu spät — kein Sprechen.
    aeusserung(1).onstart?.();
    expect(leseVorlesen().spielt).toBeNull();
  });

  it("P4 · späte Ereignisse einer abgelösten Ausgabe ändern die neue nicht", () => {
    vorlesen("a", "Erste", "de");
    vorlesen("b", "Zweite", "de");
    aeusserung(0).onstart?.();
    expect(leseVorlesen().spielt).toBeNull();
    aeusserung(1).onstart?.();
    expect(leseVorlesen().spielt).toBe("b");
    aeusserung(0).onend?.();
    expect(leseVorlesen()).toMatchObject({ liest: "b", spielt: "b" });
  });
});

describe("F1 · die Figur folgt der bestätigten Aktivität", () => {
  it("KlaraVorschau leitet Zuhören und Sprechen aus `hoert` und `spielt` ab", () => {
    const quelle = readFileSync(
      repoPfad("apps/web/src/components/klara-vorschau/KlaraVorschau.tsx"),
      "utf8",
    );
    expect(quelle).toContain("hoertZu: sprechen.hoert,");
    expect(quelle).toContain("spricht: vorleseLage.spielt !== null,");
    expect(quelle).not.toContain("hoertZu: sprechen.laeuft");
    expect(quelle).not.toContain("spricht: vorleseLage.liest");
  });
});
