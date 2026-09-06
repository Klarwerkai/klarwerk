// @vitest-environment jsdom
// ================================================================================================
// JOB 3093 · M3 „Haben wir das schon?“ — DAS WORD-PANEL ZEIGT VORHANDENE UND UNGEPRÜFTE EINTRÄGE
// MIT PRÜFSTAND, VERSION UND FUNDORT. Gemessen am AUSGELIEFERTEN Aufgabenfenster.
// ================================================================================================
//
// Pedi öffnet sein Dokument in Word und fragt „Haben wir dieses Dokument schon?“. Klara zeigt den
// vorhandenen Eintrag — auch den noch nicht validierten — mit Titel, Prüfstand, Version und Fundort,
// und ein Klick öffnet den Volltext in der Bibliothek (Pedi 05.09.2026, CODEX-POC-ENTSCHEIDUNG-1).
//
// WIE: `createKlaraPanel` (tests/app/klara-panel-fixture.ts) baut den ausgelieferten Rumpf ins
// jsdom-DOM und führt das VOLLSTÄNDIGE Inline-Skript aus — kein zweiter Quelltext. Der Server ist
// ein Fake je Pfad; die Antwort von `POST /api/check-text` trägt genau die Form, die
// `fundort-im-server.test.ts` an der echten Route misst. Word liefert die Markierung.
//
// RED-FIRST: vor dieser Runde kannte das Panel weder `#bestand-btn` noch `#bestand-liste` — jeder
// Fall unten war rot („Stelle #bestand-btn existiert nicht“).
import { afterEach, describe, expect, it } from "vitest";
import {
  type FakeReplyInit,
  type FakeRoute,
  type FetchCall,
  type KlaraPanel,
  createKlaraPanel,
  reply,
} from "../app/klara-panel-fixture";

// Ein markierter Absatz, wie er in Pedis Dokument steht — lang genug für die Route (≥ 40 Zeichen).
const ABSATZ =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschließen und der Druck im " +
  "Hydrauliksystem vollständig abzubauen. Erst danach darf die Schutzhaube geöffnet werden.";

/** Ein Treffer, wie ihn die echte Route liefert (fundort-im-server.test.ts F1). */
function treffer(over: Record<string, unknown> = {}) {
  return {
    koId: "ko-1",
    koTitle: "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abz",
    relation: "identisch",
    confidence: null,
    method: "deterministic",
    rationale: null,
    koStatus: "offen",
    koCategory: "Instandhaltung",
    pruefstand: "eingereicht",
    version: 3,
    fundort: {
      kategorie: "Instandhaltung",
      bereich: "Instandhaltung",
      bibliothekPfad: "/wissen/ko-1",
    },
    ...over,
  };
}

function antwort(duplicates: unknown[]) {
  return { duplicates, conflicts: [], answer: null, note: null, persisted: false };
}

let panel: KlaraPanel | null = null;

function starte(routen: Record<string, FakeReplyInit | FakeRoute>): KlaraPanel {
  panel = createKlaraPanel({ selectionText: ABSATZ, routes: routen });
  return panel;
}

/**
 * Die Erfassen-Fläche ruft `/api/check-text` VON SELBST, sobald Word eine Markierung liefert
 * (JOB 3092, `captureDublettenPruefen`) — derselbe Übersetzer, dieselbe Route. Gezählt werden hier
 * deshalb nur die Abrufe AB dem Klick auf den Knopf: was vorher lief, gehört der anderen Fläche.
 */
let abKlick = 0;

async function fragen(p: KlaraPanel): Promise<void> {
  // Sitzung und Office sind nach dem Laden geklärt; erst dann steht der Knopf.
  await p.flush();
  const knopf = p.q("#bestand-btn");
  expect(knopf, "der Knopf „Haben wir das schon?“ fehlt").not.toBeNull();
  expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(false);
  abKlick = p.calls.length;
  (knopf as { click(): void }).click();
  await p.flush();
}

function checkTextRufe(p: KlaraPanel): FetchCall[] {
  return p.calls.slice(abKlick).filter((c) => c.url === "/api/check-text");
}

afterEach(() => {
  panel?.restore();
  panel = null;
});

describe("JOB 3093 · „Haben wir das schon?“ im ausgelieferten Aufgabenfenster", () => {
  it("F1 · Frage → Liste mit Titel, Prüfstand „noch nicht geprüft“, Version und Fundort; der Link führt zum Volltext", async () => {
    const p = starte({ "/api/check-text": reply(200, antwort([treffer()])) });
    await fragen(p);

    // Der Rumpf ist der des Panels: Text der Markierung, Titel derselben Regel wie der
    // Erfassungsweg (erste Zeile, 60 Zeichen), Sprache, Herkunft `transient-document`.
    const rufe = checkTextRufe(p);
    expect(rufe).toHaveLength(1);
    expect(rufe[0]?.method).toBe("POST");
    const body = JSON.parse(String(rufe[0]?.body)) as Record<string, unknown>;
    expect(body.text).toBe(ABSATZ);
    expect(body.title).toBe(ABSATZ.slice(0, 60).trim());
    expect(body.locale).toBe("de");
    expect(body.source).toBe("transient-document");
    // KEIN Modellweg: die Frage geht nie mit want:"deep" ab (Dokumenttext bleibt im Haus).
    expect(body.want).toBeUndefined();

    const liste = p.text("#bestand-liste");
    expect(liste).toContain("Vor jeder Wartung an der Presse P2 ist der Hauptschalter abz");
    expect(liste).toContain("noch nicht geprüft");
    expect(liste).toContain("Version 3");
    expect(liste).toContain("Instandhaltung");
    const link = p.q("#bestand-liste a");
    expect(link, "der Weg zum Volltext fehlt").not.toBeNull();
    expect(link?.href.endsWith("/wissen/ko-1")).toBe(true);
    expect(link?.getAttribute("target")).toBe("_blank");
    // Die Standzeile nennt die Zeit der Prüfung — eine Aussage über den Bestand ist datiert.
    expect(p.text("#bestand-stand")).toMatch(/\d{2}:\d{2}/);
  });

  it("F2 · ein validierter Treffer trägt „Validiert“ — und nie „noch nicht geprüft“", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort([treffer({ koStatus: "validiert", pruefstand: "validiert", version: 7 })]),
      ),
    });
    await fragen(p);
    const liste = p.text("#bestand-liste");
    expect(liste).toContain("Validiert");
    expect(liste).not.toContain("noch nicht geprüft");
    expect(liste).toContain("Version 7");
  });

  it("F3 · leer → „Nichts Vergleichbares gefunden (geprüft <Zeit>)“ — nur nach erfolgreicher frischer Antwort", async () => {
    const p = starte({ "/api/check-text": reply(200, antwort([])) });
    await fragen(p);
    expect(p.text("#bestand-stand")).toMatch(
      /^Nichts Vergleichbares gefunden \(geprüft \d{2}:\d{2}\)\.$/,
    );
    expect(p.text("#bestand-liste")).toBe("");
  });

  it("F4 · Fehler → „Prüfung nicht möglich“ — und KEIN „nichts gefunden“", async () => {
    const p = starte({ "/api/check-text": reply(500, { error: "kaputt" }) });
    await fragen(p);
    const stand = p.text("#bestand-stand");
    expect(stand).toContain("Prüfung nicht möglich");
    expect(stand).not.toContain("Nichts Vergleichbares");
    expect(p.text("#bestand-liste")).toBe("");
  });

  it("F5 · Zustandsmodell: scheitert eine ERNEUTE Prüfung, bleibt der letzte Stand sichtbar — datiert, mit dem Hinweis", async () => {
    // Der Server antwortet, was gerade gilt — nicht nach Reihenfolge: die Erfassen-Fläche ruft
    // dieselbe Route von selbst, und ihr Abruf darf die Antwort auf die Frage nicht verbrauchen.
    let serverLage: FakeReplyInit = reply(200, antwort([treffer()]));
    const p = starte({ "/api/check-text": (): FakeReplyInit => serverLage });
    await fragen(p);
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
    // Zweite Frage: der Server fällt aus.
    serverLage = reply(503, {});
    const vorher = checkTextRufe(p).length;
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(checkTextRufe(p).length).toBe(vorher + 1);
    // Der alte Treffer bleibt stehen (niemals leeren), die Standzeile sagt, dass er alt ist.
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
    const stand = p.text("#bestand-stand");
    expect(stand).toContain("Stand ");
    expect(stand).toContain("Prüfung nicht möglich");
    expect(stand).not.toContain("Nichts Vergleichbares");
  });

  it("F6 · ohne Fundort im Bestand schweigt die Fundortzeile — kein Platzhalter, kein „unbekannt“", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort([
          treffer({
            koCategory: null,
            fundort: { kategorie: null, bereich: null, bibliothekPfad: "/wissen/ko-1" },
          }),
        ]),
      ),
    });
    await fragen(p);
    const liste = p.text("#bestand-liste");
    expect(liste).toContain("noch nicht geprüft");
    expect(liste).not.toContain("Bereich");
    expect(liste).not.toContain("unbekannt");
    expect(liste).not.toContain("—");
  });

  it("F7 · dasselbe Ergebnis in EN: Prüfstand, Version und Fundort in der Sprache des Fensters", async () => {
    const p = starte({ "/api/check-text": reply(200, antwort([treffer()])) });
    await fragen(p);
    p.setLang("en");
    const liste = p.text("#bestand-liste");
    expect(liste).toContain("not yet reviewed");
    expect(liste).toContain("Version 3");
    expect(liste).toContain("Area: Instandhaltung");
    expect(liste).not.toContain("noch nicht geprüft");
    expect(p.text("#bestand-btn")).toBe("Do we already have this?");
    // Und der Leerfall in EN — datiert.
    p.setLang("de");
  });

  it("F8 · zu kurzer Text → derselbe ehrliche Satz wie in der Erfassen-Fläche, und die Route wird gar nicht gerufen", async () => {
    panel = createKlaraPanel({
      selectionText: "Zu kurz.",
      routes: { "/api/check-text": reply(200, antwort([treffer()])) },
    });
    const p = panel;
    await fragen(p);
    expect(checkTextRufe(p)).toHaveLength(0);
    expect(p.text("#bestand-stand")).toBe(p.t("captureDubZuKurz"));
    expect(p.text("#bestand-stand")).toContain("40");
    expect(p.text("#bestand-liste")).toBe("");
  });

  it("F10 · in der Antwortlage steht der Knopf nicht im Bild — er gehört zur Ruhe; zurück in der Ruhe ist er wieder da", async () => {
    const p = starte({
      "/api/check-text": reply(200, antwort([treffer()])),
      "/api/ask": reply(200, {
        result: {
          answered: true,
          answer: "Der Hauptschalter ist abzuschließen.",
          sources: ["ko-1"],
        },
      }),
    });
    await p.flush();
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(false);
    const feld = p.q("#ask-input");
    expect(feld).not.toBeNull();
    (feld as { value: string }).value = "Was gilt vor der Wartung?";
    p.askKlara();
    await p.flush();
    expect(p.q("#ask-answer-block")?.className.includes("hidden")).toBe(false);
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(true);
  });

  it("F9 · nicht angemeldet → der Knopf steht nicht im Bild (keine Frage ohne Sitzung)", async () => {
    panel = createKlaraPanel({
      selectionText: ABSATZ,
      routes: { "/api/auth/me": reply(401) },
    });
    await panel.flush();
    expect(panel.q("#bestand-block")?.className.includes("hidden")).toBe(true);
  });
});

// ================================================================================================
// RUNDE 3 (BEN, Korrekturpflicht 1): DER STAND GEHÖRT DER SITZUNG. Was A gefunden hat, darf B nie
// sehen — auch nicht nach einer 403 auf die eigene Frage, auch nicht als verspätete Antwort.
// ================================================================================================
describe("JOB 3093 · Runde 3 — der Bestandsstand hängt an der Sitzung", () => {
  const A = { id: "u-a", name: "Anna" };
  const B = { id: "u-b", name: "Bernd" };

  /** Ein steuerbarer Sitzungsserver: wer angemeldet ist, ob der Logout bestätigt, was die Prüfung sagt. */
  function sitzungsServer() {
    const lage = {
      nutzer: A as { id: string; name: string } | null,
      logout: reply(204),
      pruefung: reply(200, antwort([treffer()])),
    };
    const routen: Record<string, FakeRoute> = {
      "/api/auth/me": () => (lage.nutzer ? reply(200, lage.nutzer) : reply(401)),
      "/api/auth/logout": () => lage.logout,
      "/api/check-text": () => lage.pruefung,
    };
    return { lage, routen };
  }

  function abmelden(p: KlaraPanel): void {
    const knopf = p.q("#logout-btn");
    expect(knopf, "der Abmelde-Knopf fehlt").not.toBeNull();
    (knopf as { click(): void }).click();
  }

  it("F11 · A fragt → Treffer · Logout 204 · B meldet sich an · Prüfung 403 → KEIN Treffer von A, der Satz nennt das fehlende Recht", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await fragen(p);
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");

    // Bestätigter Logout: Treffer weg, Knopf weg (keine Sitzung).
    lage.nutzer = null;
    abmelden(p);
    await p.flush();
    expect(p.text("#bestand-liste")).toBe("");
    expect(p.text("#bestand-stand")).toBe("");
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(true);

    // B meldet sich an (die nächste /api/auth/me-Antwort trägt eine andere Identität).
    lage.nutzer = B;
    lage.pruefung = reply(403, { error: "FORBIDDEN" });
    p.setLang("en"); // löst checkSession aus — derselbe Weg wie im Panel
    await p.flush();
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(false);
    expect(p.text("#bestand-liste")).toBe("");
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(p.text("#bestand-liste")).toBe("");
    const stand = p.text("#bestand-stand");
    expect(stand).toContain("Check not possible.");
    expect(stand).toContain("No permission for the check in this session.");
    expect(stand).not.toContain("Nothing comparable");
  });

  it("F12 · 401 nach einer erfolgreichen Prüfung (Sitzung abgelaufen) → alter Stand weg, „nicht angemeldet“, die Sitzung wird neu gelesen", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await fragen(p);
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
    lage.pruefung = reply(401, {});
    lage.nutzer = null;
    const auth = p.calls.filter((c) => c.url === "/api/auth/me").length;
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(p.text("#bestand-liste")).toBe("");
    expect(p.calls.filter((c) => c.url === "/api/auth/me").length).toBeGreaterThan(auth);
    // Die Sitzung ist neu gelesen und weg: der Knopf steht nicht mehr im Bild.
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(true);
  });

  it("F13 · eine VERSPÄTETE Antwort von A nach dem Logout belebt nichts wieder", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await p.flush();
    // Die Prüfung von A hängt: ihr fetch wird erst später aufgelöst.
    const fenster = globalThis as unknown as {
      window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
    };
    const echt = fenster.window.fetch;
    let spaet: (() => void) | null = null;
    fenster.window.fetch = (url, init) =>
      url === "/api/check-text"
        ? new Promise((aufloesen) => {
            spaet = () => aufloesen(echt(url, init));
          })
        : echt(url, init);
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(spaet, "die Prüfung von A ist nicht unterwegs").not.toBeNull();
    expect(p.text("#bestand-stand")).toBe(p.t("captureDubLaeuft"));

    // Bestätigter Logout, während die Antwort noch aussteht.
    lage.nutzer = null;
    abmelden(p);
    await p.flush();
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(true);

    // Jetzt kommt die Antwort von A — zu spät: nichts erscheint.
    (spaet as unknown as () => void)();
    await p.flush();
    expect(p.text("#bestand-liste")).toBe("");
    expect(p.text("#bestand-stand")).toBe("");
    fenster.window.fetch = echt;
  });

  it("F15 · Identitätswechsel OHNE Logout im Panel (die nächste /api/auth/me-Antwort ist B) → der Stand von A ist weg; dieselbe Identität erneut gelesen behält ihn", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await fragen(p);
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
    // Dieselbe Identität, neu gelesen (Sprachwechsel → checkSession): der Stand bleibt.
    p.setLang("en");
    await p.flush();
    expect(p.text("#bestand-liste")).toContain("not yet reviewed");
    // Eine ANDERE Identität in der nächsten Antwort (Sitzung anderswo gewechselt): der Stand fällt.
    lage.nutzer = B;
    p.setLang("de");
    await p.flush();
    expect(p.q("#bestand-block")?.className.includes("hidden")).toBe(false);
    expect(p.text("#bestand-liste")).toBe("");
    expect(p.text("#bestand-stand")).toBe("");
  });

  it("F16 · ein BESTÄTIGTER Logout (204) verwirft SOFORT — auch wenn /api/auth/me danach hängt und die Sitzungslage noch nicht neu gelesen ist", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await fragen(p);
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
    // Nach dem Logout hängt die Sitzungsabfrage: signedIn bleibt bis dahin, wie es war.
    const fenster = globalThis as unknown as {
      window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
    };
    const echt = fenster.window.fetch;
    let logoutBestaetigt = false;
    fenster.window.fetch = (url, init) => {
      if (url === "/api/auth/logout") {
        logoutBestaetigt = true;
        return echt(url, init);
      }
      return url === "/api/auth/me" && logoutBestaetigt ? new Promise(() => {}) : echt(url, init);
    };
    lage.nutzer = null;
    abmelden(p);
    await p.flush();
    expect(logoutBestaetigt).toBe(true);
    // Die Sitzungsabfrage ist noch offen — der Stand von A ist trotzdem weg.
    expect(p.text("#bestand-liste")).toBe("");
    expect(p.text("#bestand-stand")).toBe("");
    fenster.window.fetch = echt;
  });

  it("F14 · eine Störung (503) in DERSELBEN Sitzung behält den datierten Stand — die Sitzungsbindung ist keine Löschung bei jedem Fehler", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await fragen(p);
    lage.pruefung = reply(503, {});
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
    expect(p.text("#bestand-stand")).toContain("Stand ");
    // Und ein unbestätigter Logout (Netzfehler) verwirft ebenfalls nichts.
    lage.logout = reply(503);
    abmelden(p);
    await p.flush();
    expect(p.text("#bestand-liste")).toContain("noch nicht geprüft");
  });
});
