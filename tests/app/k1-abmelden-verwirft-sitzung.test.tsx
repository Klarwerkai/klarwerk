// @vitest-environment jsdom
// ================================================================================================
// JOB 3056 Runde 4 (Codex Pflicht 3) — NACH DEM ABMELDEN GILT KEIN SITZUNGSWERT MEHR.
// ================================================================================================
//
// CODEX' MESSUNG in Runde 3: „Logout 200 → 204 → 401 → KI-Anzeige bleibt danach faelschlich
// `Externe KI`". Der Sitzungsteil fiel erst „mit der naechsten Anfrage" — und die kam nicht.
//
// Dieser Test faehrt das VOLLSTAENDIGE Aufgabenfenster (apps/web/public/word-addin/taskpane.html,
// ueber k1-panel-lauf) in jsdom durch genau diese Folge:
//   auth 200 → Klara-Sitzung (POST /api/klara/sessions, GET /api/klara/ai-status: „Externe KI")
//   → eine Auffrischung, deren Antwort NOCH AUSSTEHT
//   → Abmelden (POST /api/auth/logout 204) → auth 401
//   → die verspaetete Antwort trifft ein.
// Erwartet: sofort nach dem bestaetigten Logout steht die KI-Zeile auf „–", die Sitzungszeile sagt
// „nicht angemeldet", Konto und Abmelden sind weg; die verspaetete Antwort aendert NICHTS; und
// erst eine erneute Anmeldung fuehrt zu einem FRISCHEN Abruf, der wieder einen Wert belegt.
// Gegenprobe: ein NICHT bestaetigter Logout (5xx) verwirft nichts.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Antwort,
  type Lauf,
  aufloesung,
  el,
  panelAbraeumen,
  panelStarten,
  ruhe,
  sicht,
  sichtbar,
  wortlaut,
} from "./k1-panel-lauf";

interface Stand {
  angemeldet: boolean;
  logout: Antwort;
  /** true: die naechste Statusantwort bleibt offen (verspaetete Antwort). */
  statusHaelt: boolean;
}

function starten(stand: Stand): Lauf {
  return panelStarten((url, methode) => {
    if (url === "/api/auth/me") {
      return stand.angemeldet ? { status: 200, body: { name: "Pedi" } } : { status: 401 };
    }
    if (url === "/api/auth/logout") {
      if (stand.logout !== "netz" && stand.logout !== "haengt" && stand.logout.status < 300) {
        stand.angemeldet = false;
      }
      return stand.logout;
    }
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (methode === "HEAD") return { status: 200 };
    if (!stand.angemeldet && url.startsWith("/api/klara/")) return { status: 401 };
    if (url === "/api/klara/sessions" && methode === "POST") return { status: 200, body: sicht() };
    if (url === "/api/klara/ai-status") {
      return stand.statusHaelt ? "haengt" : { status: 200, body: aufloesung() };
    }
    if (url.endsWith("/close")) return { status: 200, body: {} };
    return { status: 404 };
  });
}

function kiZeile(): string {
  return el("klara-s4-mode").textContent ?? "";
}

/** Die Einstellungen liegen hinter dem Zahnrad — sichtbar sind ihre Zeilen nur dort. */
function einstellungenOeffnen(): void {
  el("kw-zahnrad").click();
  expect(sichtbar(el("kw-einstellungen"))).toBe(true);
}

describe("JOB 3056 R4 · Abmelden verwirft KI-/S4-Werte und laufende Auffrischungen", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("auth 200 → logout 204 → auth 401: die KI-Zeile faellt SOFORT auf „–“, die Sitzungszeile sagt „nicht angemeldet“, Konto und Abmelden sind weg", async () => {
    const stand: Stand = { angemeldet: true, logout: { status: 204 }, statusHaelt: false };
    const lauf = starten(stand);
    await ruhe();
    // Vorher: die Sitzung steht, der Wert ist belegt (in den Einstellungen sichtbar).
    einstellungenOeffnen();
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
    expect(sichtbar(el("klara-s4-provider"))).toBe(true);
    expect(el("einst-konto-name").textContent).toBe("Pedi");
    expect(sichtbar(el("logout-btn"))).toBe(true);

    el("logout-btn").click();
    await ruhe();

    const folge = lauf.aufrufe.map((a) => `${a.methode} ${a.url}`);
    const logoutIdx = folge.indexOf("POST /api/auth/logout");
    expect(logoutIdx).toBeGreaterThan(0);
    expect(folge.slice(logoutIdx + 1)).toContain("GET /api/auth/me");
    // Das Abmelden fuehrt in die Fragen-Flaeche: die Ruhe zeigt die Anmeldelage, Fragen gesperrt.
    expect(sichtbar(el("section-ask"))).toBe(true);
    expect(sichtbar(el("login-btn"))).toBe(true);
    expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(true);
    // Und hinter dem Zahnrad: „–", „nicht angemeldet", kein Anbieter, kein Konto, kein Abmelden.
    einstellungenOeffnen();
    expect(kiZeile()).toBe("–");
    expect(el("klara-s4-session").textContent).toBe(wortlaut("s4SitzungNichtAngemeldet"));
    expect(sichtbar(el("klara-s4-provider"))).toBe(false);
    expect(el("einst-konto-name").textContent).toBe("–");
    expect(sichtbar(el("logout-btn"))).toBe(false);
    // Und nach dem Logout geht KEIN sitzungsbezogener Abruf mehr hinaus.
    expect(folge.slice(logoutIdx + 1).filter((f) => f.includes("/api/klara/"))).toEqual([]);
  });

  it("eine Auffrischung, die VOR dem Abmelden gestartet wurde und DANACH antwortet, aendert nichts mehr — „–“ bleibt", async () => {
    const stand: Stand = { angemeldet: true, logout: { status: 204 }, statusHaelt: false };
    const lauf = starten(stand);
    await ruhe();
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));

    // Der Fokus loest eine Auffrischung aus (Lebenszyklus-Anker des Panels); ihre Antwort haengt.
    stand.statusHaelt = true;
    const vorher = lauf.offen();
    window.dispatchEvent(new Event("focus"));
    await ruhe();
    expect(lauf.offen(), "die Auffrischung ist nicht losgelaufen").toBe(vorher + 1);

    el("logout-btn").click();
    await ruhe();
    expect(kiZeile()).toBe("–");

    // Jetzt trifft die verspaetete Antwort ein — mit einem POSITIVEN Wert.
    lauf.freigeben(vorher, { status: 200, body: aufloesung() });
    await ruhe();
    einstellungenOeffnen();
    expect(kiZeile()).toBe("–");
    expect(el("klara-s4-session").textContent).toBe(wortlaut("s4SitzungNichtAngemeldet"));
    expect(sichtbar(el("klara-s4-provider"))).toBe(false);
  });

  it("erst eine ERNEUTE Anmeldung fuehrt zu einem frischen Abruf, der wieder einen Wert belegt", async () => {
    const stand: Stand = { angemeldet: true, logout: { status: 204 }, statusHaelt: false };
    const lauf = starten(stand);
    await ruhe();
    el("logout-btn").click();
    await ruhe();
    expect(kiZeile()).toBe("–");
    const vorher = lauf.aufrufe.length;

    // Der Server kennt die Anmeldung wieder; der naechste Sitzungsabruf (Sprachwechsel) belegt sie.
    stand.angemeldet = true;
    el("lang-de").click();
    await ruhe();
    const danach = lauf.aufrufe.slice(vorher).map((a) => `${a.methode} ${a.url}`);
    expect(danach).toContain("POST /api/klara/sessions");
    expect(danach).toContain("GET /api/klara/ai-status");
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
    expect(el("einst-konto-name").textContent).toBe("Pedi");
  });

  it("GEGENPROBE: ein NICHT bestaetigter Logout (503) verwirft nichts — die Sitzung besteht, der Wert bleibt", async () => {
    const stand: Stand = { angemeldet: true, logout: { status: 503 }, statusHaelt: false };
    starten(stand);
    await ruhe();
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
    el("logout-btn").click();
    await ruhe();
    expect(stand.angemeldet).toBe(true);
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
    expect(el("einst-konto-name").textContent).toBe("Pedi");
  });
});
