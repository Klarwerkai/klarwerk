// @vitest-environment jsdom
// ================================================================================================
// JOB 4076 · S6 — WAS DER MENSCH LIEST, WENN KEINE ÜBERGABE ANKOMMT
// ================================================================================================
//
// DER BEFUND AM BASISSTAND: `apps/web/public/word-addin/taskpane.html` pollte fünf Minuten auf
// `/api/auth/me` und meldete danach „Keine Anmeldung erkannt. Bitte erneut versuchen." — auch dann,
// wenn die Anmeldung im Dialog längst geklappt hatte. In Word für das Web KANN dieser Poll nicht
// grün werden: das Fenster liegt in einem Rahmen fremder Herkunft, das Cookie reist nicht mit.
// Der Mensch las also eine ZEITANGABE, wo eine URSACHE stünde — und einen Rat („erneut
// versuchen"), der dieselbe Wand ein zweites Mal trifft.
//
// DIESER FALL MISST BEIDE AUSGÄNGE GEGENEINANDER:
//   S6a  im Rahmen fremder Herkunft steht der Ursachensatz — NICHT `loginTimeout`
//   S6b  OHNE Rahmenlage bleibt es beim bisherigen `loginTimeout` (der hat seinen echten Fall:
//        der Mensch hat den Dialog nicht zu Ende geführt)
// Ohne S6b wäre S6a auch von einem Fenster erfüllt, das den neuen Satz immer zeigt — und dann wäre
// die alte Unwahrheit nur durch eine neue ersetzt.
//
// DIE RAHMENLAGE WIRD GESTELLT, NICHT BEHAUPTET: `window.parent` wird auf ein Fenster gesetzt,
// dessen Adresse eine andere Herkunft trägt. Genau das liest `loginImFremdenRahmen`.
//
// DIE FÜNF MINUTEN WERDEN NICHT ABGEWARTET: die harte Frist (`WORD_ADDIN_LOGIN_POLL_MAX_MS`) hängt
// an einem eigenen Zeitgeber, und der wird vorgestellt. Die Zeitgeber müssen dafür VOR dem Bauen
// des Fensters gefälscht sein — die Fixture merkt sich beim Bauen, welche sie vorfand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Dialoglauf, anmeldenDruecken, fahreSeitenfenster } from "./seitenfenster";

let lauf: Dialoglauf | null = null;
let rahmenGestellt = false;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  lauf?.aufraeumen();
  lauf = null;
  if (rahmenGestellt) {
    Reflect.deleteProperty(window, "parent");
    rahmenGestellt = false;
  }
  vi.useRealTimers();
});

/**
 * Das Fenster in einen Rahmen FREMDER Herkunft stellen. `window.parent` ist laut HTML-Standard
 * `[Replaceable]` — eine eigene Eigenschaft darf es überschreiben. Der gestellte Elternrahmen
 * antwortet mit einer anderen Herkunft; im echten Office-Web-Host wirft der Zugriff stattdessen,
 * und `loginImFremdenRahmen` behandelt beide Fälle gleich (der Wurf ist der `catch`-Zweig dort).
 */
function stelleFremdenRahmen(): void {
  Object.defineProperty(window, "parent", {
    value: { location: { origin: "https://word-edit.officeapps.live.com" } },
    configurable: true,
    writable: true,
  });
  rahmenGestellt = true;
}

/** Nicht angemeldet, und es bleibt dabei: der Poll findet nichts, keine Übergabe kommt an. */
function starte(): Dialoglauf {
  return fahreSeitenfenster({
    "/api/auth/me": () => ({ status: 401, body: { error: "INVALID_CREDENTIALS" } }),
  });
}

/** Anmelden drücken und die harte Frist überschreiten, ohne eine Nachricht zu schicken. */
async function bisZurFrist(gefahren: Dialoglauf): Promise<void> {
  await gefahren.panel.flush();
  anmeldenDruecken(gefahren);
  await gefahren.panel.flush();
  expect(gefahren.panel.text("#session-status")).toBe(gefahren.panel.t("loginWaiting"));
  // WORD_ADDIN_LOGIN_POLL_MAX_MS ist 300 s; der Deadline-Zeitgeber feuert synchron beim Vorstellen.
  vi.advanceTimersByTime(300_001);
  await gefahren.panel.flush();
}

describe("JOB 4076 · S6 · der Ausgang nennt die Ursache, nicht die Uhrzeit", () => {
  it("S6a — im Rahmen fremder Herkunft steht der Ursachensatz, nicht loginTimeout", async () => {
    stelleFremdenRahmen();
    lauf = starte();
    await bisZurFrist(lauf);
    const panel = lauf.panel;

    const gelesen = panel.text("#session-status");
    expect(gelesen).toBe(panel.t("loginHandoverBlocked"));
    expect(gelesen).not.toBe(panel.t("loginTimeout"));
    // Der Satz nennt die Lage und einen Weg — und behauptet NICHT, es liege am Menschen.
    expect(gelesen.length).toBeGreaterThan(40);
    // Kein erfundener Umgehungstipp: „Cookies erlauben" hat niemand gemessen.
    expect(gelesen.toLowerCase()).not.toContain("cookie");
    // Und der Anmeldeweg bleibt offen (Lage „anmelden"), statt das Fenster zu verriegeln.
    expect(panel.q("#login-btn")?.className).toBe("primary");
    expect(panel.q("#login-btn")?.disabled).toBe(false);
  });

  it("S6b — GEGENPROBE: ohne Rahmenlage bleibt es beim bisherigen loginTimeout", async () => {
    lauf = starte();
    await bisZurFrist(lauf);
    const panel = lauf.panel;
    expect(panel.text("#session-status")).toBe(panel.t("loginTimeout"));
    expect(panel.text("#session-status")).not.toBe(panel.t("loginHandoverBlocked"));
  });

  it("S6c — der Ursachensatz steht in allen drei Sprachen und ist je Sprache eigen", async () => {
    stelleFremdenRahmen();
    lauf = starte();
    await bisZurFrist(lauf);
    const panel = lauf.panel;
    const gesehen = new Set<string>();
    for (const sprache of ["de", "en", "nl"]) {
      panel.setLang(sprache);
      const satz = panel.t("loginHandoverBlocked");
      expect(satz, sprache).not.toBe("loginHandoverBlocked"); // kein roher Schlüssel
      expect(satz.length, sprache).toBeGreaterThan(40);
      gesehen.add(satz);
    }
    expect(gesehen.size, "zwei Sprachen tragen denselben Satz").toBe(3);
  });
});
