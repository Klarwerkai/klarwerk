// @vitest-environment jsdom
// ================================================================================================
// JOB 3056 Runde 4 (Codex Pflicht 2) — DIE SITZUNGSLAGEN DER RUHE: JE LAGE GENAU EINE AKTION.
// ================================================================================================
//
// CODEX' MESSUNG in Runde 3: „fehlgeschlagenes /api/auth/me → gleichzeitig sichtbar: #login-btn
// und #session-retry-btn" und „waehrend ausstehender Authentifizierung → Ruhe-Satz bereits
// sichtbar". Beides widersprach §9 des Auftrags (laden = Sendeknopf grau, sonst nichts; Fehler =
// EIN Satz + EIN Knopf).
//
// Dieser Test faehrt das VOLLSTAENDIGE Aufgabenfenster (apps/web/public/word-addin/taskpane.html,
// ueber k1-panel-lauf) in jsdom und zaehlt je Lage, was sichtbar ist: den Text der Mitte und die
// sichtbaren Knoepfe. Erwartet wird
//   pending  → kein Satz, kein Knopf, der Sendeknopf gesperrt
//   401      → GENAU „Anmelden" (sessionOff)
//   Netz     → GENAU „Erneut versuchen" (sessionError)
//   warten   → GENAU „Warten abbrechen" (loginWaiting), waehrend die Anmeldung im Fenster laeuft
//   200      → Lupe und der EINE Satz, kein Knopf
// Gegenprobe je Lage: der jeweils andere Knopf ist NICHT da.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Antwort,
  el,
  panelAbraeumen,
  panelStarten,
  ruhe,
  sichtbar,
  sichtbareKnoepfe,
  sichtbarerText,
  wortlaut,
} from "./k1-panel-lauf";

/** Der Router dieser Datei: nur /api/auth/me ist Gegenstand; alles andere antwortet ruhig. */
function router(auth: () => Antwort) {
  return (url: string, methode: string): Antwort => {
    if (url === "/api/auth/me") return auth();
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (methode === "HEAD") return { status: 200 };
    return { status: 401 };
  };
}

function mitte(): { text: string; knoepfe: string[] } {
  const ruheMitte = el("ask-ruhe");
  return { text: sichtbarerText(ruheMitte), knoepfe: sichtbareKnoepfe(ruheMitte) };
}

describe("JOB 3056 R4 · Sitzungslagen — pending, 401, Netzfehler, warten, angemeldet", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("pending: waehrend /api/auth/me noch offen ist, zeigt die Mitte NICHTS — kein Satz, kein Knopf; der Sendeknopf ist grau", async () => {
    panelStarten(router(() => "haengt"));
    await ruhe();
    expect(sichtbar(el("session-block"))).toBe(false);
    expect(sichtbar(el("ask-ruhe-satz"))).toBe(false);
    expect(sichtbar(el("ask-ruhe-lupe"))).toBe(false);
    expect(mitte()).toEqual({ text: "", knoepfe: [] });
    expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(true);
  });

  it("401: EIN Satz (sessionOff) und GENAU „Anmelden“ — kein „Erneut versuchen“, kein Ruhe-Satz", async () => {
    panelStarten(router(() => ({ status: 401 })));
    await ruhe();
    const m = mitte();
    expect(m.knoepfe).toEqual(["login-btn"]);
    expect(m.text).toBe(wortlaut("sessionOff"));
    expect(sichtbar(el("session-retry-btn"))).toBe(false);
    expect(sichtbar(el("ask-ruhe-satz"))).toBe(false);
    expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(true);
  });

  it("Netzfehler: EIN Satz (sessionError) und GENAU „Erneut versuchen“ — kein „Anmelden“ daneben; der Knopf fuehrt in die belegte Lage", async () => {
    let lage: Antwort = "netz";
    panelStarten(router(() => lage));
    await ruhe();
    const m = mitte();
    expect(m.knoepfe).toEqual(["session-retry-btn"]);
    expect(m.text).toBe(wortlaut("sessionError"));
    expect(sichtbar(el("login-btn"))).toBe(false);
    expect(sichtbar(el("login-block"))).toBe(false);

    // „Erneut versuchen" → der Server antwortet jetzt: angemeldet, Lupe und Satz, kein Knopf.
    lage = { status: 200, body: { name: "Pedi" } };
    el("session-retry-btn").click();
    await ruhe();
    expect(mitte()).toEqual({ text: wortlaut("askRuheSatz"), knoepfe: [] });
    expect(sichtbar(el("session-block"))).toBe(false);
    expect(sichtbar(el("ask-ruhe-lupe"))).toBe(true);
    expect(el<HTMLButtonElement>("ask-btn").disabled).toBe(false);
  });

  it("5xx zaehlt wie ein Netzfehler: GENAU „Erneut versuchen“ — ob eine Anmeldung fehlt, ist nicht festgestellt", async () => {
    panelStarten(router(() => ({ status: 503 })));
    await ruhe();
    expect(mitte().knoepfe).toEqual(["session-retry-btn"]);
  });

  it("warten: waehrend die Anmeldung im eigenen Fenster laeuft, GENAU „Warten abbrechen“; Abbrechen fuehrt zurueck zu GENAU „Anmelden“", async () => {
    panelStarten(router(() => ({ status: 401 })));
    await ruhe();
    expect(mitte().knoepfe).toEqual(["login-btn"]);
    el("login-btn").click();
    await ruhe();
    const m = mitte();
    expect(m.knoepfe).toEqual(["login-cancel-btn"]);
    expect(m.text).toContain(wortlaut("loginWaiting"));
    el("login-cancel-btn").click();
    await ruhe();
    expect(mitte().knoepfe).toEqual(["login-btn"]);
  });

  it("angemeldet: Lupe und der EINE Satz, kein Knopf — und ein erneuter Abruf (Sprachwechsel) leert die Mitte NICHT fuer die Dauer des Abrufs", async () => {
    let lage: Antwort = { status: 200, body: { name: "Pedi" } };
    panelStarten(router(() => lage));
    await ruhe();
    expect(mitte()).toEqual({ text: wortlaut("askRuheSatz"), knoepfe: [] });
    // Der zweite Abruf haengt: die zuletzt belegte Lage bleibt stehen (kein Flackern).
    lage = "haengt";
    el("lang-en").click();
    await ruhe();
    expect(sichtbar(el("ask-ruhe-satz"))).toBe(true);
    expect(sichtbar(el("session-block"))).toBe(false);
  });

  it("KALIBRIERUNG: die Zaehlung sieht einen zusaetzlichen Knopf — ein zweiter sichtbarer Knopf im Block wuerde die Lage rot machen", async () => {
    panelStarten(router(() => ({ status: 401 })));
    await ruhe();
    el("session-retry-btn").className = "ghost";
    expect(mitte().knoepfe).toEqual(["login-btn", "session-retry-btn"]);
  });
});
