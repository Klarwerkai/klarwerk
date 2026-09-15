// @vitest-environment jsdom
// ================================================================================================
// JOB 4076 · S7 — ENDET DIE SITZUNG, FÄLLT DER SCHLÜSSEL. SOFORT UND ÜBERALL.
// ================================================================================================
//
// WARUM DAS EIN EIGENER FALL IST. Der übergebene Zugangsschlüssel liegt im Arbeitsspeicher des
// Aufgabenfensters (`apps/web/public/word-addin/taskpane.html`) und hängt an JEDEM Abruf. Bliebe er
// nach einer Abmeldung stehen, trüge das Fenster weiter einen Sitzungsnachweis, den der Mensch
// gerade zurückgezogen hat — und bei einem Kontowechsel wäre es der Nachweis des FALSCHEN Kontos.
//
// ZWEI ENDEN, ZWEI FÄLLE:
//   S7a  „Abmelden" (bestätigter Logout) — der Schlüssel fällt im selben Augenblick.
//   S7b  ein echter 401 an einem beliebigen Abruf — die Sitzung gilt nicht mehr, also fällt er.
// UND DIE GRENZE (§9): ein NETZFEHLER verwirft ihn NICHT. Das wäre eine Abmeldung, die niemand
// ausgesprochen hat — S7c misst genau das.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Dialoglauf,
  anmeldenDruecken,
  fahreSeitenfenster,
  uebergabeNachricht,
} from "./seitenfenster";

const SCHLUESSEL = "sitzungsmerkmal-aus-der-uebergabe";
const KOPF = `Bearer ${SCHLUESSEL}`;

let lauf: Dialoglauf | null = null;

afterEach(() => {
  lauf?.aufraeumen();
  lauf = null;
});

interface Stand {
  /** Was `/api/auth/me` antworten soll. `"netzfehler"` wirft, wie ein abgerissenes Netz. */
  me: "an" | "ab" | "netzfehler";
  logout: number;
}

/**
 * Das Fenster bis in den ÜBERGEBENEN Zustand fahren: Anmelden drücken, Dialognachricht schicken,
 * Code einlösen. Danach hält das Fenster den Schlüssel, und jeder Abruf trägt ihn.
 */
async function bisUebergeben(): Promise<{ lauf: Dialoglauf; stand: Stand }> {
  const stand: Stand = { me: "an", logout: 204 };
  const gefahren = fahreSeitenfenster({
    "/api/auth/me": () => {
      if (stand.me === "netzfehler") {
        throw new Error("Netz abgerissen");
      }
      return stand.me === "an"
        ? { status: 200, body: { id: "u-1", name: "Testnutzer", role: "experte" } }
        : { status: 401, body: { error: "INVALID_CREDENTIALS" } };
    },
    "/api/auth/logout": () => ({ status: stand.logout }),
    "/api/auth/office-handover/redeem": () => ({
      status: 200,
      body: { token: SCHLUESSEL, user: { id: "u-1", name: "Testnutzer" } },
    }),
  });
  await gefahren.panel.flush();
  anmeldenDruecken(gefahren);
  await gefahren.panel.flush();
  gefahren.nachricht(uebergabeNachricht("code-aus-dem-dialog"));
  await gefahren.panel.flush();
  // Kalibrierung: der Schlüssel ist wirklich in Gebrauch — sonst misst alles darunter nichts.
  expect(gefahren.spur.filter((a) => a.authorization === KOPF).length).toBeGreaterThan(0);
  return { lauf: gefahren, stand };
}

/** Einen weiteren Abruf auslösen, ohne einen neuen Weg zu erfinden: der Sprachwechsel liest die
 *  Sitzung neu (`setLang` → `checkSession`, so steht es im Fenster). */
async function nochEinAbruf(gefahren: Dialoglauf): Promise<number> {
  const vorher = gefahren.spur.length;
  gefahren.panel.setLang("en");
  await gefahren.panel.flush();
  expect(gefahren.spur.length, "der Sprachwechsel hat keinen Abruf ausgelöst").toBeGreaterThan(
    vorher,
  );
  return vorher;
}

describe("JOB 4076 · S7 · der übergebene Schlüssel überlebt das Ende der Sitzung nicht", () => {
  it("S7a — nach bestätigtem Abmelden trägt kein Abruf mehr den alten Schlüssel", async () => {
    const { lauf: gefahren, stand } = await bisUebergeben();
    lauf = gefahren;
    const panel = gefahren.panel;
    expect(panel.text("#session-status")).toBe(panel.t("sessionOk", { name: "Testnutzer" }));

    // „Abmelden" steht in den Einstellungen und ist nur mit Anmeldung sichtbar.
    expect(panel.q("#logout-btn")?.className).toBe("einst-link");
    stand.me = "ab";
    const vorher = gefahren.spur.length;
    panel.q("#logout-btn")?.click();
    await panel.flush();

    // Der Logout selbst reist NOCH mit dem Schlüssel — sonst beendete er die falsche Sitzung
    // (im Office-Web-Rahmen gibt es kein Cookie, mit dem der Server sie fände).
    const logout = gefahren.spur.filter((a) => a.url === "/api/auth/logout");
    expect(logout).toHaveLength(1);
    expect(logout[0]?.authorization).toBe(KOPF);

    // DANACH trägt kein Abruf ihn mehr — weder der checkSession direkt hinter dem Logout …
    const danach = gefahren.spur.slice(vorher).filter((a) => a.url !== "/api/auth/logout");
    expect(danach.length).toBeGreaterThan(0);
    for (const abruf of danach) {
      expect(abruf.authorization, abruf.url).toBeUndefined();
    }
    // … noch ein späterer.
    const grenze = await nochEinAbruf(gefahren);
    for (const abruf of gefahren.spur.slice(grenze)) {
      expect(abruf.authorization, abruf.url).toBeUndefined();
    }
    expect(panel.text("#session-status")).toBe(panel.t("sessionOff"));
  });

  it("S7b — ein echter 401 an einem Abruf verwirft den Schlüssel sofort", async () => {
    const { lauf: gefahren, stand } = await bisUebergeben();
    lauf = gefahren;
    // Die Sitzung endet serverseitig (abgelaufen, fremd beendet, Zugang befristet) — niemand hat
    // hier „Abmelden" gedrückt. Der nächste Abruf bekommt 401.
    stand.me = "ab";
    await nochEinAbruf(gefahren);
    // Der Abruf, der die 401 kassiert hat, trug ihn noch; jeder danach nicht mehr.
    const grenze = gefahren.spur.length;
    await nochEinAbruf(gefahren);
    const danach = gefahren.spur.slice(grenze);
    expect(danach.length).toBeGreaterThan(0);
    for (const abruf of danach) {
      expect(abruf.authorization, abruf.url).toBeUndefined();
    }
  });

  it("S7c — ein NETZFEHLER verwirft ihn NICHT (das wäre eine Abmeldung, die niemand sagte)", async () => {
    const { lauf: gefahren, stand } = await bisUebergeben();
    lauf = gefahren;
    const panel = gefahren.panel;
    stand.me = "netzfehler";
    await nochEinAbruf(gefahren);
    // Die Sitzungszeile nennt die Ursache und behauptet weder „angemeldet" noch „abgemeldet".
    expect(panel.text("#session-status")).toBe(panel.t("sessionError"));

    // Das Netz ist wieder da — und der Schlüssel war noch da, also trägt der Abruf ihn.
    stand.me = "an";
    const grenze = gefahren.spur.length;
    await nochEinAbruf(gefahren);
    const danach = gefahren.spur.slice(grenze);
    expect(danach.length).toBeGreaterThan(0);
    for (const abruf of danach) {
      expect(abruf.authorization, abruf.url).toBe(KOPF);
    }
    expect(panel.text("#session-status")).toBe(panel.t("sessionOk", { name: "Testnutzer" }));
  });
});
