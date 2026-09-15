// @vitest-environment jsdom
// ================================================================================================
// JOB 4076 · S5 — DAS SEITENFENSTER HÖRT ZU, LÖST EIN UND BEENDET DEN POLL
// ================================================================================================
//
// DIE HALBHEIT, GEGEN DIE DIESER FALL STEHT (Auftrag §8.4): den Übergabecode zu bauen und das
// Fenster weiter pollen zu lassen. Dann ändert sich für den Menschen nichts — er wartet weiter
// fünf Minuten und liest dann eine Zeitangabe. Gemessen wird deshalb nicht „die Route existiert",
// sondern: nach EINER Dialognachricht steht der angemeldete Zustand auf der Fläche, der Poll ist
// beendet, und jeder weitere Abruf trägt den Schlüssel.
//
// GEMESSEN AM AUSGELIEFERTEN FENSTER (`apps/web/public/word-addin/taskpane.html`), über die
// vorhandene Fixture: das vollständige Inline-Skript läuft im jsdom, der Anmeldeknopf wird wirklich
// geklickt, und der Office-Dialog schickt eine echte Nachricht (`tests/office-web-anmeldung/
// seitenfenster.ts`).
//
// DIE GENERATIONSPRÜFUNG IST DER ZWEITE HALBE FALL: eine Nachricht aus einem ABGEBROCHENEN Lauf
// darf nichts bewirken. Ohne sie könnte ein Mensch „Warten abbrechen" drücken, und eine Sekunde
// später risse eine verspätete Nachricht das Fenster doch noch in den angemeldeten Zustand —
// derselbe Befund, den bens ROT-1d für die Poll-Callbacks erhoben hat.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Dialoglauf,
  anmeldenDruecken,
  fahreSeitenfenster,
  uebergabeNachricht,
} from "./seitenfenster";

const CODE = "code-aus-dem-dialog";
const SCHLUESSEL = "sitzungsmerkmal-aus-der-uebergabe";

let lauf: Dialoglauf | null = null;

afterEach(() => {
  lauf?.aufraeumen();
  lauf = null;
});

/**
 * Der Grundzustand: nicht angemeldet. `angemeldet` wird umgelegt, sobald die Übergabe durch ist —
 * so verhält sich der Server wie im echten Weg (vorher 401 im Rahmen, danach 200 mit Schlüssel).
 */
function starte(): { lauf: Dialoglauf; anmelden: () => void } {
  const zustand = { angemeldet: false };
  const gefahren = fahreSeitenfenster({
    "/api/auth/me": () =>
      zustand.angemeldet
        ? { status: 200, body: { id: "u-1", name: "Testnutzer", role: "experte" } }
        : { status: 401, body: { error: "INVALID_CREDENTIALS" } },
    "/api/auth/office-handover/redeem": () => ({
      status: 200,
      body: { token: SCHLUESSEL, user: { id: "u-1", name: "Testnutzer" } },
    }),
  });
  return {
    lauf: gefahren,
    anmelden: () => {
      zustand.angemeldet = true;
    },
  };
}

describe("JOB 4076 · S5 · die Dialognachricht bringt die Anmeldung in das Seitenfenster", () => {
  it("S5a — Nachricht → Einlösen → angemeldeter Zustand, und der Poll ist beendet", async () => {
    const gestartet = starte();
    lauf = gestartet.lauf;
    const panel = lauf.panel;
    await panel.flush();
    // Ausgangslage: nicht angemeldet, der Anmeldeknopf steht da.
    expect(panel.text("#session-status")).toBe(panel.t("sessionOff"));

    anmeldenDruecken(lauf);
    await panel.flush();
    // §8.7: GENAU EINE Öffnungsstelle, und ihr Ziel ist die Dialogseite — nicht die Anwendung.
    expect(lauf.geoeffnet).toHaveLength(1);
    expect(lauf.geoeffnet[0]).toMatch(/\/word-addin\/anmeldung\.html$/);
    // Während des Wartens sagt das Fenster nichts über die Identität.
    expect(panel.text("#session-status")).toBe(panel.t("loginWaiting"));
    expect(panel.q("#login-cancel-btn")?.className).toBe("ghost");

    // Der Dialog hat sich angemeldet und schickt seinen Code.
    gestartet.anmelden();
    const vorDerNachricht = lauf.spur.length;
    expect(lauf.nachricht(uebergabeNachricht(CODE))).toBe(true);
    await panel.flush();

    // 1. Der Code wurde eingelöst — mit dem Code im Rumpf, ohne Bearer-Kopf (es gibt noch keinen).
    const einloesen = lauf.spur.filter((a) => a.url === "/api/auth/office-handover/redeem");
    expect(einloesen).toHaveLength(1);
    expect(einloesen[0]?.methode).toBe("POST");
    expect(JSON.parse(einloesen[0]?.koerper ?? "{}")).toEqual({ code: CODE });
    expect(einloesen[0]?.authorization).toBeUndefined();

    // 2. Der angemeldete Zustand steht da — und die Identität kommt aus einem FRISCHEN Abruf,
    //    nicht aus der Dialognachricht (die trug nur den Code).
    expect(panel.text("#session-status")).toBe(panel.t("sessionOk", { name: "Testnutzer" }));

    // 3. Der Poll ist beendet: der Dialog wurde geschlossen, „Warten abbrechen" ist weg, der
    //    Anmeldeknopf wieder frei.
    expect(lauf.geschlossen()).toBeGreaterThanOrEqual(1);
    expect(panel.q("#login-cancel-btn")?.className).toBe("ghost hidden");
    expect(panel.q("#login-btn")?.disabled).toBe(false);

    // 4. JEDER Abruf nach dem Einlösen trägt den Schlüssel — eine Stelle setzt den Kopf (§5).
    //    Kalibrierung: es gibt wirklich weitere Abrufe (checkSession und was daran hängt), sonst
    //    wäre die Schleife leer und die Zusage unbelegt.
    const nachher = lauf.spur
      .slice(vorDerNachricht)
      .filter((a) => a.url !== "/api/auth/office-handover/redeem");
    expect(nachher.length).toBeGreaterThan(0);
    for (const abruf of nachher) {
      expect(abruf.authorization, abruf.url).toBe(`Bearer ${SCHLUESSEL}`);
    }
  });

  it("S5b — eine Nachricht einer ALTEN Generation bewirkt nichts", async () => {
    const gestartet = starte();
    lauf = gestartet.lauf;
    const panel = lauf.panel;
    await panel.flush();

    anmeldenDruecken(lauf);
    await panel.flush();
    // Der Mensch bricht ab — das erhöht die Generation und schliesst das Dialoghandle.
    panel.q("#login-cancel-btn")?.click();
    await panel.flush();
    const vorher = panel.text("#session-status");
    const eingeloestVorher = lauf.spur.filter(
      (a) => a.url === "/api/auth/office-handover/redeem",
    ).length;

    // Die verspätete Nachricht des abgebrochenen Laufs.
    gestartet.anmelden();
    lauf.nachricht(uebergabeNachricht(CODE));
    await panel.flush();

    // NICHTS ist passiert: kein Einlösen, kein angemeldeter Zustand, kein Schlüssel.
    expect(lauf.spur.filter((a) => a.url === "/api/auth/office-handover/redeem")).toHaveLength(
      eingeloestVorher,
    );
    expect(panel.text("#session-status")).toBe(vorher);
    expect(lauf.spur.filter((a) => a.authorization !== undefined)).toEqual([]);
  });

  it("S5c — eine FREMDE Nachricht in derselben Leitung wird nicht geraten", async () => {
    // Die postMessage-Leitung des Office-Hosts gehört nicht uns allein. Was nicht genau die
    // vereinbarte Form trägt, ist keine Übergabe — und es entsteht kein halber Zustand.
    const gestartet = starte();
    lauf = gestartet.lauf;
    const panel = lauf.panel;
    await panel.flush();
    anmeldenDruecken(lauf);
    await panel.flush();

    for (const fremd of [
      "hallo",
      "{}",
      JSON.stringify({ art: "etwas-anderes", code: CODE }),
      JSON.stringify({ art: "kw-office-handover" }),
      JSON.stringify({ art: "kw-office-handover", code: "" }),
    ]) {
      lauf.nachricht(fremd);
    }
    await panel.flush();
    expect(lauf.spur.filter((a) => a.url === "/api/auth/office-handover/redeem")).toEqual([]);
    // Und das Fenster wartet weiter, statt einen Fehler oder einen Erfolg zu behaupten.
    expect(panel.text("#session-status")).toBe(panel.t("loginWaiting"));
  });

  it("S5d — eine ABGELEHNTE Übergabe sagt genau das, und behauptet keinen Anmeldefehler", async () => {
    // Zustandsmodell (§9): der Code kann unbekannt, abgelaufen oder verbraucht sein — die Anmeldung
    // selbst kann trotzdem geklappt haben. Das Fenster darf sie nicht für gescheitert erklären.
    lauf = fahreSeitenfenster({
      "/api/auth/me": () => ({ status: 401, body: { error: "INVALID_CREDENTIALS" } }),
      "/api/auth/office-handover/redeem": () => ({
        status: 401,
        body: { error: "INVALID_CREDENTIALS", message: "Nicht angemeldet." },
      }),
    });
    const panel = lauf.panel;
    await panel.flush();
    anmeldenDruecken(lauf);
    await panel.flush();
    lauf.nachricht(uebergabeNachricht(CODE));
    await panel.flush();

    expect(panel.text("#session-status")).toBe(panel.t("loginHandoverRejected"));
    // Der Knopf „Anmelden" ist wieder frei (Lage „anmelden", nicht „warten").
    expect(panel.q("#login-btn")?.className).toBe("primary");
    expect(panel.q("#login-btn")?.disabled).toBe(false);
    // Und kein Schlüssel ist entstanden.
    expect(lauf.spur.filter((a) => a.authorization !== undefined)).toEqual([]);
    // Drei Sprachen tragen den Satz, keine zeigt einen rohen Schlüssel.
    for (const sprache of ["de", "en", "nl"]) {
      panel.setLang(sprache);
      expect(panel.t("loginHandoverRejected"), sprache).not.toBe("loginHandoverRejected");
    }
  });
});
