// @vitest-environment jsdom
// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung · Nacharbeit 3 (Bens Befunde) — DER KÜRZELSPEICHER
// BEI VERSPÄTETEN ANTWORTEN UND UNKLAREM SCHREIBAUSGANG.
// ================================================================================================
//
// Der echte Speicher (`apps/web/src/lib/klaraTastenkuerzel.ts`) über den echten Drahtvertrag
// (`api/client.ts` → `fetch`). Ersetzt ist allein `fetch` durch einen steuerbaren Server, der
// GET-Antworten zurückhalten und Antworten NACH der Speicherung verlieren kann.
//
//   V1 · K7/K12  Eine verspätete GET-Antwort (angefordert vor dem Ändern) überschreibt die bestätigte
//                neue Belegung nicht.
//   V2 · K8/K13  Dasselbe nach Entfernen: die entfernte Belegung kommt nicht zurück.
//   V3          Gleichzeitige Ladevorgänge desselben Kontos (Setup und Ausführung) teilen sich eine
//                Anfrage.
//   V4 · K9     Antwort verloren, gespeichert hat der Server doch: bis zum Abgleich „unklar“, danach
//                gespeichert und wirksam — kein „Nicht gespeichert“.
//   V5 · K9     Störung VOR der Speicherung: der Abgleich zeigt den alten Stand → „nicht gespeichert“.
//   V6 · K9     Serverfehler (500) nach der Speicherung: Abgleich bestätigt die Speicherung.
//   V7 · K9     Antwort UND Abgleich verloren: Ausgang „unbekannt“/offen, angezeigt der zuletzt
//                bestätigte Stand; erneutes Laden klärt ihn.
//   V8 · K14    Eine eindeutige Ablehnung (409 doppelt) braucht keinen Abgleich.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KLARA_KUERZEL_AKTIONEN,
  type KlaraKuerzelAktion,
  type KuerzelKombination,
  ladeTastenkuerzel,
  setzeAlleKuerzelZurueck,
  setzeKuerzel,
  tastenkuerzelLage,
  verwerfeTastenkuerzel,
  wirksameEintraege,
} from "../../apps/web/src/lib/klaraTastenkuerzel";

const KONTO = "u-speicher-ada";
const E: KuerzelKombination = {
  code: "KeyE",
  taste: "E",
  strg: true,
  alt: false,
  umschalt: true,
  meta: false,
};
const U: KuerzelKombination = { ...E, code: "KeyU", taste: "U" };

type Eintrag = { belegung: KuerzelKombination | null; quelle: "standard" | "eigen" | "entfernt" };

// ------------------------------------------------------------------------------------------------
// Der steuerbare Server.
// ------------------------------------------------------------------------------------------------
let server = new Map<KlaraKuerzelAktion, Eintrag>();
let anfragen: string[] = [];
/** GET-Antworten zurückhalten: sie tragen den Stand ZUM ZEITPUNKT der Anfrage. */
let getHalten = false;
let gehalten: (() => void)[] = [];
/** So viele kommende GET-Anfragen scheitern (Verbindung gestört). */
let getFehler = 0;
type PutArt = "normal" | "verlorenVorher" | "verlorenNachher" | "fehler500Nachher";
let putArt: PutArt = "normal";
let vorherigerFetch: typeof globalThis.fetch;

function stand() {
  return {
    aktionen: KLARA_KUERZEL_AKTIONEN.map((aktion) => ({
      aktion,
      ...(server.get(aktion) ?? { belegung: null, quelle: "standard" as const }),
    })),
    geaendertAm: null,
  };
}

function antwort(status: number, rumpf: unknown) {
  const text = JSON.stringify(rumpf);
  return {
    status,
    statusText: String(status),
    ok: status >= 200 && status < 300,
    text: async () => text,
  };
}

function wende(rumpf: Record<string, unknown>): { status: number; rumpf: unknown } {
  if (rumpf.alleZuruecksetzen === true) {
    server = new Map();
    return { status: 200, rumpf: stand() };
  }
  const aktion = rumpf.aktion as KlaraKuerzelAktion;
  const belegung = rumpf.belegung as KuerzelKombination | null | "standard";
  if (belegung && belegung !== "standard") {
    for (const [andere, e] of server) {
      if (andere !== aktion && e.belegung?.code === belegung.code) {
        return { status: 409, rumpf: { error: "CONFLICT", grund: "doppelt", belegtVon: andere } };
      }
    }
  }
  if (belegung === "standard") {
    server.delete(aktion);
  } else if (belegung === null) {
    server.set(aktion, { belegung: null, quelle: "entfernt" });
  } else {
    server.set(aktion, { belegung, quelle: "eigen" });
  }
  return { status: 200, rumpf: stand() };
}

beforeEach(() => {
  verwerfeTastenkuerzel();
  server = new Map();
  anfragen = [];
  getHalten = false;
  gehalten = [];
  getFehler = 0;
  putArt = "normal";
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: { method?: string; body?: unknown }) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    anfragen.push(`${methode} ${String(eingabe)}`);
    if (methode === "GET") {
      if (getFehler > 0) {
        getFehler -= 1;
        throw new TypeError("Failed to fetch (Prüfstand: GET gestört)");
      }
      const momentaufnahme = stand();
      if (getHalten) {
        return new Promise((loese) => {
          gehalten.push(() => loese(antwort(200, momentaufnahme)));
        });
      }
      return antwort(200, momentaufnahme);
    }
    if (putArt === "verlorenVorher") {
      putArt = "normal";
      throw new TypeError("Failed to fetch (Prüfstand: vor der Speicherung gestört)");
    }
    const ergebnis = wende(JSON.parse(String(init?.body)) as Record<string, unknown>);
    if (putArt === "verlorenNachher") {
      putArt = "normal";
      throw new TypeError("Failed to fetch (Prüfstand: Antwort nach der Speicherung verloren)");
    }
    if (putArt === "fehler500Nachher") {
      putArt = "normal";
      return antwort(500, { error: "INTERNAL", message: "nach dem Speichern gescheitert" });
    }
    return antwort(ergebnis.status, ergebnis.rumpf);
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = vorherigerFetch;
  verwerfeTastenkuerzel();
});

function belegung(aktion: KlaraKuerzelAktion) {
  return wirksameEintraege(tastenkuerzelLage()).find((e) => e.aktion === aktion);
}

const gets = (): number => anfragen.filter((a) => a.startsWith("GET ")).length;

async function lassFrei(): Promise<void> {
  const liste = gehalten;
  gehalten = [];
  for (const loese of liste) {
    loese();
  }
  await new Promise((r) => setTimeout(r, 0));
}

describe("V1–V3 · verspätete Ladeantworten überschreiben keinen bestätigten Stand", () => {
  it("V1 · Ändern: die alte GET-Antwort kommt nach dem PUT und wird verworfen", async () => {
    await ladeTastenkuerzel(KONTO);
    expect(belegung("oeffnen")?.quelle).toBe("standard");
    getHalten = true;
    const spaet = ladeTastenkuerzel(KONTO); // z. B. das Setup beim direkten Einstieg
    getHalten = false;
    const r = await setzeKuerzel(KONTO, "oeffnen", E);
    expect(r).toEqual({ ok: true, abgeglichen: false });
    expect(belegung("oeffnen")?.belegung).toEqual(E);
    await lassFrei();
    await spaet;
    expect(belegung("oeffnen")).toMatchObject({ belegung: E, quelle: "eigen" });
    // Wechsel auf U: auch eine danach verspätete Antwort mit E holt E nicht zurück.
    getHalten = true;
    const nochSpaeter = ladeTastenkuerzel(KONTO);
    getHalten = false;
    await setzeKuerzel(KONTO, "oeffnen", U);
    await lassFrei();
    await nochSpaeter;
    expect(belegung("oeffnen")?.belegung).toEqual(U);
  });

  it("V2 · Entfernen: die entfernte Belegung kommt nicht zurück", async () => {
    await ladeTastenkuerzel(KONTO);
    await setzeKuerzel(KONTO, "oeffnen", E);
    getHalten = true;
    const spaet = ladeTastenkuerzel(KONTO);
    getHalten = false;
    expect((await setzeKuerzel(KONTO, "oeffnen", null)).ok).toBe(true);
    await lassFrei();
    await spaet;
    expect(belegung("oeffnen")).toMatchObject({ belegung: null, quelle: "entfernt" });
  });

  it("V3 · Setup und Ausführung laden gleichzeitig — eine Anfrage, ein Stand", async () => {
    getHalten = true;
    const a = ladeTastenkuerzel(KONTO);
    const b = ladeTastenkuerzel(KONTO);
    expect(gets()).toBe(1);
    await lassFrei();
    await Promise.all([a, b]);
    expect(tastenkuerzelLage().status).toBe("bereit");
    // Danach lädt ein neuer Aufruf wieder frisch.
    getHalten = false;
    await ladeTastenkuerzel(KONTO);
    expect(gets()).toBe(2);
  });
});

describe("V4–V8 · unklarer Schreibausgang wird am Server abgeglichen", () => {
  it("V4 · Antwort nach Speicherung verloren: „unklar“, dann gespeichert und wirksam", async () => {
    await ladeTastenkuerzel(KONTO);
    putArt = "verlorenNachher";
    getHalten = true;
    const laufend = setzeKuerzel(KONTO, "oeffnen", E);
    await new Promise((r) => setTimeout(r, 0));
    // Bis zum Abgleich ist der Ausgang unklar — weder gespeichert noch „nicht gespeichert“.
    expect(tastenkuerzelLage().ausgang).toBe("abgleich");
    expect(tastenkuerzelLage().speichert).toBe("oeffnen");
    expect(belegung("oeffnen")?.quelle).toBe("standard");
    await lassFrei();
    expect(await laufend).toEqual({ ok: true, abgeglichen: true });
    expect(tastenkuerzelLage().ausgang).toBeNull();
    expect(tastenkuerzelLage().speichert).toBeNull();
    expect(belegung("oeffnen")).toMatchObject({ belegung: E, quelle: "eigen" });
  });

  it("V4b · auch beim Entfernen und „alle zurücksetzen“", async () => {
    await ladeTastenkuerzel(KONTO);
    await setzeKuerzel(KONTO, "oeffnen", E);
    await setzeKuerzel(KONTO, "diktieren", U);
    putArt = "verlorenNachher";
    expect(await setzeKuerzel(KONTO, "oeffnen", null)).toEqual({ ok: true, abgeglichen: true });
    expect(belegung("oeffnen")?.quelle).toBe("entfernt");
    putArt = "verlorenNachher";
    expect(await setzeAlleKuerzelZurueck(KONTO)).toEqual({ ok: true, abgeglichen: true });
    expect(wirksameEintraege(tastenkuerzelLage()).every((e) => e.quelle === "standard")).toBe(true);
  });

  it("V5 · Störung vor der Speicherung: der Abgleich zeigt „nicht gespeichert“", async () => {
    await ladeTastenkuerzel(KONTO);
    await setzeKuerzel(KONTO, "oeffnen", U);
    putArt = "verlorenVorher";
    expect(await setzeKuerzel(KONTO, "oeffnen", E)).toEqual({ ok: false, art: "fehler" });
    expect(belegung("oeffnen")?.belegung).toEqual(U);
    expect(server.get("oeffnen")?.belegung).toEqual(U);
    expect(tastenkuerzelLage().ausgang).toBeNull();
  });

  it("V6 · Serverfehler 500 nach der Speicherung: der Abgleich bestätigt sie", async () => {
    await ladeTastenkuerzel(KONTO);
    putArt = "fehler500Nachher";
    expect(await setzeKuerzel(KONTO, "oeffnen", E)).toEqual({ ok: true, abgeglichen: true });
    expect(belegung("oeffnen")?.belegung).toEqual(E);
  });

  it("V7 · Antwort und Abgleich verloren: Ausgang offen, bestätigter Stand bleibt; Laden klärt", async () => {
    await ladeTastenkuerzel(KONTO);
    putArt = "verlorenNachher";
    getFehler = 1;
    expect(await setzeKuerzel(KONTO, "oeffnen", E)).toEqual({ ok: false, art: "unbekannt" });
    expect(tastenkuerzelLage().ausgang).toBe("offen");
    expect(tastenkuerzelLage().speichert).toBeNull();
    // Angezeigt und wirksam bleibt der zuletzt BESTÄTIGTE Stand — nichts wird vorgetäuscht.
    expect(belegung("oeffnen")?.quelle).toBe("standard");
    await ladeTastenkuerzel(KONTO);
    expect(tastenkuerzelLage().ausgang).toBeNull();
    expect(belegung("oeffnen")?.belegung).toEqual(E);
  });

  it("V8 · eindeutige Ablehnung (409 doppelt): kein Abgleich nötig, nichts geändert", async () => {
    await ladeTastenkuerzel(KONTO);
    await setzeKuerzel(KONTO, "oeffnen", E);
    const vorher = gets();
    expect(await setzeKuerzel(KONTO, "seitenhilfe", E)).toEqual({
      ok: false,
      art: "doppelt",
      belegtVon: "oeffnen",
    });
    expect(gets()).toBe(vorher);
    expect(belegung("seitenhilfe")?.quelle).toBe("standard");
    expect(tastenkuerzelLage().ausgang).toBeNull();
  });
});
