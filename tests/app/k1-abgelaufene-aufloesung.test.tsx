// @vitest-environment jsdom
// ================================================================================================
// JOB 3056 Runde 8 (Codex Runde 7, Pflicht 9) — EINE ABGELAUFENE AUFLOESUNG IST KEIN STAND.
// ================================================================================================
//
// CODEX' GEGENPROBE in Runde 7: „gueltige Sitzung und bereits abgelaufene /api/klara/ai-status-
// Aufloesung — erwartet: KI ‚–', kein Anbieter, Fragen gesperrt; tatsaechlich: ‚Externe KI',
// ‚Anbieter srv-anbieter · Modell srv-modell', Fragen nicht gesperrt." Pflicht 9 des Auftrags (§9):
// jeder Einstellungswert erst nach FRISCHEM Abruf, bis dahin „–" — nie ein positiver Wert aus dem
// Cache ohne Kennzeichnung.
//
// Dieser Test faehrt das VOLLSTAENDIGE Aufgabenfenster (apps/web/public/word-addin/taskpane.html,
// ueber k1-panel-lauf) in jsdom: der Server liefert eine Aufloesung, deren `expiresAt` bereits
// vorbei ist; der Folgeabruf haengt (ausstehend) bzw. scheitert (5xx). Erwartet in beiden Lagen:
// KI-Zeile „–", kein Anbieter, Sendeknopf gesperrt — und erst eine FRISCHE Aufloesung bringt Modus,
// Anbieter und Freigabe zurueck. Gegenprobe: dieselbe Aufloesung mit Frist in der Zukunft steht.
//
// RUNDE 9 (Codex Runde 8, Korrekturpflichten 1+2): FAIL-CLOSED UEBER DEN FEHLSCHLAG HINWEG. Bis
// Runde 8 sperrte `klaraS4FragenGesperrt` nur in Phase „bereit"; scheiterte der Folgeabruf nach dem
// Ablauf (503, Netz), setzte `klaraS4Fehlschlag` die Phase auf „unerreichbar" — und die war fail-open:
// Codex tippte eine Frage, der Knopf war frei, `POST /api/ask` ging ab, obwohl kein frischer KI-Stand
// vorlag. Der Block „Nutzerweg" unten faehrt genau diesen Weg: Text tippen → Knopf gesperrt mit Grund
// → Klick UND Programmaufruf (Attribut entfernt, Enter) erzeugen KEIN `POST /api/ask` → erst die
// frische Aufloesung gibt den Knopf frei, und dann geht genau ein Ask ab.
//
// RUNDE 10 (Codex Runde 9, Korrekturpflichten 1+2): DAS ZEITLOCH. Die Runde-9-Faelle begannen mit
// einer BEREITS abgelaufenen Aufloesung. Codex fuhr den anderen Weg: frisch bestaetigt → Fokus-Refresh
// scheitert VOR dem Ablauf (503, Netz) → `klaraS4Fehlschlag` loescht die Sicht → beim spaeteren Ablauf
// fand `klaraS4AblaufMerken` keine Sicht mehr, die Sperre blieb aus, und `POST /api/ask` ging ab
// (`nach Ablauf ging Ask ab (disabled=false; title=""): expected 1 to be +0`). Der Block „R10 Zeitloch"
// faehrt genau diesen Weg: frische Aufloesung → 503 und Netzfehler vor `expiresAt` → Uhr ueber
// `expiresAt` → Tippen sperrt (ohne weiteren Abruf) → weiterer Fehlschlag → Klick, entferntes
// `disabled`, Enter: 0× POST /api/ask → erst das frische GET gibt frei und sendet genau einmal.
import { afterEach, describe, expect, it, vi } from "vitest";
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
  /** Die Antworten auf GET /api/klara/ai-status, in Reihenfolge; die letzte gilt weiter. Eine
   *  Funktion wird ERST beim Abruf gebaut — so traegt eine „frische" Aufloesung die Frist ab der
   *  (im Test vorgestellten) Uhr des Abrufs, nicht ab Testbeginn. */
  status: Array<Antwort | (() => Antwort)>;
  /** Die Aufloesung in der Sitzungssicht von POST /api/klara/sessions (Vorgabe: abgelaufen). */
  sitzung?: Record<string, unknown>;
}

function abgelaufen(): Record<string, unknown> {
  return aufloesung({ expiresAt: new Date(Date.now() - 1_000).toISOString() });
}

function starten(stand: Stand): Lauf {
  let abrufe = 0;
  return panelStarten((url, methode): Antwort => {
    if (url === "/api/auth/me") return { status: 200, body: { name: "Pedi" } };
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (methode === "HEAD") return { status: 200 };
    if (url === "/api/klara/sessions" && methode === "POST") {
      // Die Sitzung ist GUELTIG; die Aufloesung darin ist die abgelaufene (oder die vorgegebene).
      return { status: 200, body: sicht({ resolution: stand.sitzung ?? abgelaufen() }) };
    }
    if (url === "/api/klara/ai-status") {
      const eintrag = stand.status[Math.min(abrufe, stand.status.length - 1)] ?? "netz";
      abrufe += 1;
      return typeof eintrag === "function" ? eintrag() : eintrag;
    }
    if (url.endsWith("/close")) return { status: 200, body: {} };
    return { status: 404 };
  });
}

function kiZeile(): string {
  return el("klara-s4-mode").textContent ?? "";
}
function anbieterSichtbar(): boolean {
  return sichtbar(el("klara-s4-provider"));
}
function fragenGesperrt(): boolean {
  const knopf = el<HTMLButtonElement>("ask-btn");
  return knopf.disabled && knopf.title === wortlaut("s4FragenGesperrt");
}
function askAufrufe(lauf: Lauf): number {
  return lauf.aufrufe.filter((a) => a.url === "/api/ask" && a.methode === "POST").length;
}
function frageTippen(text: string): void {
  const feld = el<HTMLTextAreaElement>("ask-input");
  feld.value = text;
  feld.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Die Uhr des Panels (Date.now) um `ms` vorstellen — die Fokus-Drossel des Statusabrufs liegt bei
 *  WORD_ADDIN_S4_REFRESH_MIN_MS (3 s); ein zweiter Fokus-Anlass braucht diese Spanne. */
let uhrVersatzMs = 0;
const echtesJetzt = Date.now;

describe("JOB 3056 R8 · abgelaufene Aufloesung — „–“, kein Anbieter, keine veraltete Freigabe", () => {
  afterEach(() => {
    panelAbraeumen();
    uhrVersatzMs = 0;
    vi.restoreAllMocks();
  });

  it("ausstehender Folgeabruf: die abgelaufene Aufloesung zeigt „–“, keinen Anbieter, und der Sendeknopf ist gesperrt — bis die FRISCHE Antwort kommt", async () => {
    // Abruf 1: abgelaufen. Abruf 2 (der Folgeabruf): haengt.
    const lauf = starten({ status: [{ status: 200, body: abgelaufen() }, "haengt"] });
    await ruhe();
    el("kw-zahnrad").click();
    expect(kiZeile()).toBe("–");
    expect(anbieterSichtbar()).toBe(false);
    expect(el("klara-s4-session").textContent).toBe(wortlaut("s4StateVeraltet"));
    expect(fragenGesperrt()).toBe(true);

    // Der Fokus loest den Folgeabruf aus — er haengt. Waehrenddessen bleibt alles bei „–".
    const vorher = lauf.offen();
    window.dispatchEvent(new Event("focus"));
    await ruhe();
    expect(lauf.offen(), "der Folgeabruf ist nicht losgelaufen").toBe(vorher + 1);
    expect(kiZeile()).toBe("–");
    expect(anbieterSichtbar()).toBe(false);
    expect(fragenGesperrt()).toBe(true);

    // Die FRISCHE Aufloesung trifft ein: Modus, Anbieter und Freigabe sind wieder da.
    lauf.freigeben(vorher, { status: 200, body: aufloesung() });
    await ruhe();
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
    expect(anbieterSichtbar()).toBe(true);
    expect(el("klara-s4-provider").textContent).toContain("srv-anbieter");
    expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(false);
  });

  it("fehlschlagender Folgeabruf (503): „–“, kein Anbieter, keine Freigabe aus der abgelaufenen Aufloesung", async () => {
    starten({ status: [{ status: 200, body: abgelaufen() }, { status: 503 }] });
    await ruhe();
    window.dispatchEvent(new Event("focus"));
    await ruhe();
    el("kw-zahnrad").click();
    expect(kiZeile()).toBe("–");
    expect(anbieterSichtbar()).toBe(false);
    // Nicht abrufbar heisst nicht abrufbar — der Zustand steht als Satz, nicht als Wert.
    expect(el("klara-s4-session").textContent).toBe(wortlaut("s4StateUnerreichbar"));
    // Die abgelaufene Freigabe wurde nicht weiterverwendet: kein Zustimmungs-Schalter „an".
    expect(sichtbar(el("klara-consent-revoke"))).toBe(false);
  });

  it.each<[string, Antwort]>([
    ["503", { status: 503 }],
    ["Netzfehler", "netz"],
  ])(
    "R9 Nutzerweg · Folgeabruf %s: Frage tippen → Knopf gesperrt mit Grund → Klick und Programmaufruf senden KEIN POST /api/ask → erst die frische Aufloesung gibt frei",
    async (_name, fehlschlag) => {
      vi.spyOn(Date, "now").mockImplementation(() => echtesJetzt() + uhrVersatzMs);
      // Abruf 1: abgelaufen. Abruf 2 (Fokus): scheitert. Abruf 3 (zweiter Fokus): frisch.
      const lauf = starten({
        status: [
          { status: 200, body: abgelaufen() },
          fehlschlag,
          { status: 200, body: aufloesung() },
        ],
      });
      await ruhe();
      window.dispatchEvent(new Event("focus"));
      await ruhe();
      expect(el("klara-s4-session").textContent).toBe(wortlaut("s4StateUnerreichbar"));

      // 1. Text eingeben: der Knopf bleibt gesperrt und nennt den Grund.
      frageTippen("Was gilt für Lieferfristen?");
      const knopf = el<HTMLButtonElement>("ask-btn");
      expect(knopf.disabled, "der Sendeknopf ist nach dem Fehlschlag frei — fail-open").toBe(true);
      expect(knopf.title).toBe(wortlaut("s4FragenGesperrt"));

      // 2. Klick auf den gesperrten Knopf: nichts geht ab.
      expect(askAufrufe(lauf)).toBe(0);
      knopf.click();
      await ruhe();
      expect(askAufrufe(lauf)).toBe(0);

      // 3. Programmaufruf AM ATTRIBUT VORBEI (das Gate ist askKlara, nicht `disabled`): Attribut
      //    entfernen, klicken, Enter im Feld — weiterhin kein POST /api/ask.
      knopf.removeAttribute("disabled");
      knopf.click();
      await ruhe();
      knopf.removeAttribute("disabled");
      el("ask-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await ruhe();
      expect(askAufrufe(lauf), "ein Ask ging ohne frischen KI-Stand ab").toBe(0);
      expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(true);

      // 4. Die FRISCHE Aufloesung (zweiter Fokus nach der Drossel) hebt die Sperre auf …
      uhrVersatzMs = 4_000;
      window.dispatchEvent(new Event("focus"));
      await ruhe();
      el("kw-zahnrad").click();
      expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
      const frei = el<HTMLButtonElement>("ask-btn");
      expect(frei.disabled).toBe(false);
      expect(frei.title).toBe("");
      // … und jetzt geht genau EIN Ask ab.
      frei.click();
      await ruhe();
      expect(askAufrufe(lauf)).toBe(1);
    },
  );

  it.each<[string, Antwort, Antwort]>([
    ["503, dann Netzfehler", { status: 503 }, "netz"],
    ["Netzfehler, dann 503", "netz", { status: 503 }],
  ])(
    "R10 Zeitloch · frisch bestaetigt → Fokus-Refresh %s VOR Ablauf → Uhr ueber expiresAt → weiterer Fehlschlag → Klick, entferntes disabled und Enter senden KEIN POST /api/ask → erst frisches GET sendet genau einmal",
    async (_name, erster, zweiter) => {
      vi.spyOn(Date, "now").mockImplementation(() => echtesJetzt() + uhrVersatzMs);
      // Die bestaetigte Aufloesung: erlaubt, Frist in 300 s (aufloesung()).
      const frisch = aufloesung();
      const bis = Date.parse(frisch.expiresAt as string);
      const lauf = starten({
        sitzung: frisch,
        status: [
          { status: 200, body: frisch }, // Abruf 1 (Start): frisch, erlaubt
          erster, // Abruf 2 (Fokus, vor Ablauf): scheitert
          zweiter, // Abruf 3 (Fokus, vor Ablauf): scheitert
          { status: 503 }, // Abruf 4 (Fokus, NACH Ablauf): scheitert weiter
          () => ({ status: 200, body: aufloesung() }), // Abruf 5: frisch ab der Uhr des Abrufs
        ],
      });
      await ruhe();
      el("kw-zahnrad").click();
      expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
      expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(false);

      // 1. Zwei Fokus-Refreshs VOR dem Ablauf scheitern (je nach der 3-s-Drossel).
      uhrVersatzMs = 4_000;
      window.dispatchEvent(new Event("focus"));
      await ruhe();
      expect(el("klara-s4-session").textContent).toBe(wortlaut("s4StateUnerreichbar"));
      uhrVersatzMs = 8_000;
      window.dispatchEvent(new Event("focus"));
      await ruhe();
      expect(el("klara-s4-session").textContent).toBe(wortlaut("s4StateUnerreichbar"));
      expect(kiZeile()).toBe("–");
      // Die bestaetigte Freigabe gilt bis zu IHRER Frist — vorher wird nichts Ungelesenes behauptet.
      expect(Date.now()).toBeLessThan(bis);
      expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(false);

      // 2. Die Uhr verstreicht ueber `expiresAt` — OHNE weiteren Abruf. Schon das Tippen sperrt:
      //    der bewahrte Ablaufzeitpunkt zaehlt, nicht die (geloeschte) Sicht.
      uhrVersatzMs = 310_000;
      expect(Date.now()).toBeGreaterThan(bis);
      frageTippen("Was gilt für Lieferfristen?");
      const knopf = el<HTMLButtonElement>("ask-btn");
      expect(knopf.disabled, "nach Ablauf ist der Sendeknopf frei — fail-open").toBe(true);
      expect(knopf.title).toBe(wortlaut("s4FragenGesperrt"));

      // 3. Ein weiterer Fehlschlag nach dem Ablauf aendert daran nichts.
      window.dispatchEvent(new Event("focus"));
      await ruhe();
      expect(el("klara-s4-session").textContent).toBe(wortlaut("s4StateUnerreichbar"));
      expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(true);

      // 4. Klick, Attribut entfernt + Klick, Enter im Feld: kein POST /api/ask.
      expect(askAufrufe(lauf)).toBe(0);
      knopf.click();
      await ruhe();
      knopf.removeAttribute("disabled");
      knopf.click();
      await ruhe();
      knopf.removeAttribute("disabled");
      el("ask-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await ruhe();
      expect(
        askAufrufe(lauf),
        `nach Ablauf ging Ask ab (disabled=${knopf.disabled}; title="${knopf.title}")`,
      ).toBe(0);
      expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(true);

      // 5. Erst das FRISCHE GET (naechster Fokus nach der Drossel) gibt frei — und genau ein Ask geht ab.
      uhrVersatzMs = 314_000;
      window.dispatchEvent(new Event("focus"));
      await ruhe();
      el("kw-zahnrad").click();
      expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
      const frei = el<HTMLButtonElement>("ask-btn");
      expect(frei.disabled).toBe(false);
      expect(frei.title).toBe("");
      frei.click();
      await ruhe();
      expect(askAufrufe(lauf)).toBe(1);
    },
  );

  it("KALIBRIERUNG: dieselbe Aufloesung mit Frist in der Zukunft zeigt Modus, Anbieter und freien Sendeknopf", async () => {
    starten({ status: [{ status: 200, body: aufloesung() }] });
    await ruhe();
    el("kw-zahnrad").click();
    expect(kiZeile()).toBe(wortlaut("s4ModeExternal"));
    expect(anbieterSichtbar()).toBe(true);
    expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(false);
  });
});
