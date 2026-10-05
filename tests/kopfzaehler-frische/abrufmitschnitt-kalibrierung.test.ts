// ================================================================================================
// R-1558 / P-H1b · BEN, Lauf 3 R1 (B2) — KALIBRIERUNG DES ABRUFMITSCHNITTS.
// ================================================================================================
//
// Die Chromium-Abnahme (`frische-im-echten-browser-chromium.test.ts`) behauptet: „in den 35 s
// startete keine Zählquelle einen Abruf". Diese Aussage ist nur so gut wie ihr Messgerät. Hier läuft
// GENAU der Text `MITSCHNITT`, den die Seite bekommt, gegen ein gestelltes `window.fetch` — und die
// Gegenfälle aus Bens Befund müssen den Vergleich ROT machen:
//   · ein zusätzlicher Abruf mit HTTP 503,
//   · ein zusätzlicher, noch laufender Abruf,
//   · ein zusätzlicher Abruf mit Netzfehler,
// und als Kontrolle ein zusätzlicher erfolgreicher Abruf sowie gar kein zusätzlicher Abruf.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type Abruf,
  type Anfrage,
  MITSCHNITT,
  ZAEHLQUELLEN,
  anfragenJeQuelle,
  herkunft,
} from "./abrufmitschnitt";

type Seitenfenster = {
  fetch: (eingabe: unknown, init?: unknown) => Promise<{ status: number }>;
  __anfragen: Anfrage[];
  __abrufe: Abruf[];
};

const g = globalThis as unknown as { window?: Seitenfenster; location?: { href: string } };
// Der vorige Zustand als Deskriptor: so wird er nach jedem Fall genau wiederhergestellt — eine
// vorher fehlende Eigenschaft wird gelöscht statt auf `undefined` gesetzt (exactOptionalPropertyTypes).
const GESTELLT = ["window", "location"] as const;
const vorher = new Map(
  GESTELLT.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const),
);

// Die gestellte Netzseite: je Pfad eine Antwort — Status, Netzfehler oder „hängt".
let antworten: Record<string, number | "netzfehler" | "haengt"> = {};

function seite(): Seitenfenster {
  const w = g.window;
  if (!w) {
    throw new Error("Seitenfenster fehlt");
  }
  return w;
}

beforeEach(() => {
  antworten = {};
  g.location = { href: "http://klarwerk.test/start" };
  g.window = {
    fetch: (eingabe: unknown) => {
      const pfad = new URL(String(eingabe), "http://klarwerk.test/").pathname;
      const a = antworten[pfad] ?? 200;
      if (a === "haengt") {
        return new Promise(() => {});
      }
      if (a === "netzfehler") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ status: a });
    },
    __anfragen: [],
    __abrufe: [],
  };
  // Derselbe Text, den `addInitScript` in die Seite legt.
  new Function(MITSCHNITT)();
});

afterEach(() => {
  for (const name of GESTELLT) {
    const deskriptor = vorher.get(name);
    if (deskriptor) {
      Object.defineProperty(globalThis, name, deskriptor);
    } else {
      delete g[name];
    }
  }
});

/** Die Seite holt einmal alle fünf Zählquellen erfolgreich — der Stand „vorher". */
async function grundstand(): Promise<{
  gestartet: Record<string, number>;
  bestaetigt: ReturnType<typeof herkunft>;
}> {
  for (const q of ZAEHLQUELLEN) {
    await seite().fetch(q);
  }
  return {
    gestartet: anfragenJeQuelle(seite().__anfragen),
    bestaetigt: herkunft(seite().__abrufe),
  };
}

const ruhe = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("Kalibrierung · der Mitschnitt sieht jeden zusätzlichen Abruf einer Zählquelle", () => {
  it("K0 · Grundstand: der Mitschnitt ersetzt `fetch` und schreibt Start und Antwort mit", async () => {
    const { gestartet, bestaetigt } = await grundstand();
    for (const q of ZAEHLQUELLEN) {
      expect(gestartet[q]).toBe(1);
      expect(bestaetigt[q]?.anzahl).toBe(1);
    }
  });

  it("K1 · zusätzlicher HTTP-503-Abruf: der Startvergleich wird rot (die 200er-Herkunft allein nicht)", async () => {
    const vorher = await grundstand();
    antworten["/api/validation/board"] = 503;
    await seite().fetch("/api/validation/board?x=1");
    expect(anfragenJeQuelle(seite().__anfragen)).not.toEqual(vorher.gestartet);
    expect(anfragenJeQuelle(seite().__anfragen)["/api/validation/board"]).toBe(2);
    // Der Grund für B2: die Herkunft zählt nur Bestätigungen und bliebe gleich.
    expect(herkunft(seite().__abrufe)).toEqual(vorher.bestaetigt);
    expect(seite().__abrufe.at(-1)?.status).toBe(503);
  });

  it("K2 · zusätzlicher, noch laufender Abruf: der Startvergleich wird rot", async () => {
    const vorher = await grundstand();
    antworten["/api/conflicts"] = "haengt";
    void seite().fetch("/api/conflicts");
    await ruhe();
    expect(anfragenJeQuelle(seite().__anfragen)["/api/conflicts"]).toBe(2);
    expect(anfragenJeQuelle(seite().__anfragen)).not.toEqual(vorher.gestartet);
    expect(seite().__abrufe, "ohne Antwort gibt es noch keinen Antworteintrag").toHaveLength(5);
  });

  it("K3 · zusätzlicher Abruf mit Netzfehler: Start gezählt, Antwort als Status 0, Fehler geht weiter", async () => {
    const vorher = await grundstand();
    antworten["/api/gaps/summary"] = "netzfehler";
    await expect(seite().fetch("/api/gaps/summary")).rejects.toThrow("Failed to fetch");
    expect(anfragenJeQuelle(seite().__anfragen)).not.toEqual(vorher.gestartet);
    expect(seite().__abrufe.at(-1)).toMatchObject({ pfad: "/api/gaps/summary", status: 0 });
  });

  it("K4 · Kontrolle: ein zusätzlicher erfolgreicher Abruf ist in beiden Listen zu sehen", async () => {
    const vorher = await grundstand();
    await seite().fetch("/api/lifecycle/pending");
    expect(anfragenJeQuelle(seite().__anfragen)).not.toEqual(vorher.gestartet);
    expect(herkunft(seite().__abrufe)).not.toEqual(vorher.bestaetigt);
  });

  it("K5 · Kontrolle: ohne Abruf einer Zählquelle bleiben beide gleich — fremde Pfade zählen nicht", async () => {
    const vorher = await grundstand();
    await seite().fetch("/api/auth/me");
    expect(anfragenJeQuelle(seite().__anfragen)).toEqual(vorher.gestartet);
    expect(herkunft(seite().__abrufe)).toEqual(vorher.bestaetigt);
  });
});
