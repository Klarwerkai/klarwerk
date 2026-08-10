// ================================================================================================
// AUFTRAG-BASIC-W1-KLARA-KOPF-CONSENT-06 — DER PERMANENTE KLARA-KOPF AM ECHTEN S4-VERTRAG.
// ================================================================================================
//
// WAS DIESER TEST PRUEFT: dass der sitzungsbezogene Teil des Kopfes GENAU das anzeigt, was
// `KlaraSessionView`/`KlaraResolution` gesagt haben — und dass er bei allem, was der Server NICHT
// gesagt hat, in einen benannten Vorbehalt faellt statt in eine Behauptung.
//
// WIE ER MISST — drei Entscheidungen, die ihn vom Nacherzaehlen unterscheiden:
//
//  1. DER ZUSTANDSRAUM WIRD ERHOBEN, NICHT AUFGEZAEHLT. Modi, Abweichungsgruende und
//     Zustimmungszustaende werden aus den EINGEFRORENEN Vertragsdateien gelesen
//     (`services/reasoner/src/klara-policy.ts`, `klara-policy-store.ts`). Waechst der Vertrag um
//     einen Wert, waechst dieser Test mit und wird rot, bis das Aufgabenfenster ihn kennt.
//
//  2. GEPRUEFT WIRD DER AUSGELIEFERTE CODE, NICHT SEIN ZWILLING. `apps/web/public/word-addin/
//     taskpane.html` ist buildlos und wird von keinem tsc erfasst. Der Block zwischen
//     `KW-KLARA-S4-START/END` wird deshalb aus der Datei GESCHNITTEN und WIRKLICH AUSGEFUEHRT.
//
//  3. FAIL-CLOSED. Findet der Test einen Block, ein Woerterbuch oder einen Zustand nicht, ist er
//     rot — ein gruener Nichtlauf waere schlimmer als ein roter Lauf.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const POLICY = "services/reasoner/src/klara-policy.ts";
const STORE = "services/reasoner/src/klara-policy-store.ts";

const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
const POLICY_SRC = readFileSync(resolve(process.cwd(), POLICY), "utf8");
const STORE_SRC = readFileSync(resolve(process.cwd(), STORE), "utf8");

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

// ------------------------------------------------------------------------------------------------
// Werkzeug — der Vertrag wird gelesen, nicht behauptet
// ------------------------------------------------------------------------------------------------

/** Die Glieder einer TypeScript-Union aus dem Quelltext, mit Kommentaren dazwischen. */
function unionWerte(quelle: string, datei: string, name: string): string[] {
  const start = quelle.indexOf(`export type ${name} =`);
  expect(start, `${datei}: Union ${name} nicht gefunden`).toBeGreaterThan(-1);
  // Erst die Zeilenkommentare weg, dann das Ende suchen: die Erklaerungen zwischen den Gliedern
  // enthalten selbst Semikolons, und ein naiver Schnitt haette die Union stillschweigend gekuerzt.
  const ohneKommentar = quelle.slice(start).replace(/\/\/[^\n]*/g, "");
  const ende = ohneKommentar.indexOf(";");
  expect(ende, `${datei}: Union ${name} ohne Ende`).toBeGreaterThan(0);
  const werte = [...ohneKommentar.slice(0, ende).matchAll(/"([a-z_]+)"/g)].map(
    (m) => m[1] as string,
  );
  // Fail-closed: eine leere Union waere ein gruener Nichtlauf.
  expect(werte.length, `${datei}: ${name} liefert keinen einzigen Wert`).toBeGreaterThan(1);
  return werte;
}

const MODI = unionWerte(POLICY_SRC, POLICY, "KlaraMode");
const GRUENDE = unionWerte(POLICY_SRC, POLICY, "KlaraDeviationReason");
const CONSENT_WERTE = unionWerte(STORE_SRC, STORE, "KlaraConsentStatus");
// `consentState` des Sitzungsbildes ist die Union PLUS "none" (klara-policy-store.ts:104).
const CONSENT_ZUSTAENDE = ["none", ...CONSENT_WERTE];

interface S4Anzeige {
  stateKey: string;
  tone: string;
  modeKey: string | null;
  provider: string | null;
  model: string | null;
  deviationKey: string | null;
  adminModeKey: string | null;
  blockedKey: string | null;
  consentKey: string | null;
  consentVisible: boolean;
  revokeVisible: boolean;
  askAllowed: boolean;
  veraltet: boolean;
  // AUFTRAG-26 / KW-S4-22: die Datenklassen der Auflösung und ihre Fail-safe-Folgen.
  payloadClasses: string[] | null;
  payloadResolved: boolean;
  blockedClasses: Array<{ payloadClass: string; reasonCode: string }>;
  consentPossible: boolean;
}

/** Der WIRKLICH ausgelieferte Ableitungsblock, aus der Datei geschnitten und ausgefuehrt. */
function block(): {
  klaraS4Anzeige: (phase: string, view: unknown, nowMs: number) => S4Anzeige;
  klaraS4ModeKey: (mode: unknown) => string;
  klaraS4ReasonKey: (reason: unknown) => string;
  klaraS4ConsentKey: (state: unknown, required?: unknown, granted?: unknown) => string;
  KLARA_S4_MODES: string[];
  KLARA_S4_REASONS: string[];
  KLARA_S4_CONSENT_STATES: string[];
} {
  const start = HTML.indexOf("// KW-KLARA-S4-START");
  const ende = HTML.indexOf("// KW-KLARA-S4-END");
  expect(start, `${TASKPANE}: S4-Ableitungsblock fehlt`).toBeGreaterThan(0);
  expect(ende, `${TASKPANE}: S4-Ableitungsblock ohne Ende`).toBeGreaterThan(start);
  const factory = new Function(
    `${HTML.slice(start, ende)}
     return { klaraS4Anzeige: klaraS4Anzeige, klaraS4ModeKey: klaraS4ModeKey,
              klaraS4ReasonKey: klaraS4ReasonKey, klaraS4ConsentKey: klaraS4ConsentKey,
              KLARA_S4_MODES: KLARA_S4_MODES, KLARA_S4_REASONS: KLARA_S4_REASONS,
              KLARA_S4_CONSENT_STATES: KLARA_S4_CONSENT_STATES };`,
  );
  return factory() as ReturnType<typeof block>;
}

function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  expect(start, `${TASKPANE}: Woerterbuch ${sprache} fehlt`).toBeGreaterThan(0);
  const ende = HTML.indexOf("\n      },", start);
  expect(ende, `${TASKPANE}: Woerterbuch ${sprache} ohne Ende`).toBeGreaterThan(start);
  return HTML.slice(start, ende);
}

function text(sprache: Sprache, key: string): string {
  const treffer = new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m").exec(woerterbuch(sprache));
  expect(treffer, `${sprache}.${key} fehlt`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.trim().length, `${sprache}.${key} ist leer`).toBeGreaterThan(0);
  return wert;
}

const JETZT = Date.parse("2026-08-02T12:00:00.000Z");

/** Eine vollstaendige Auflösung im Vertragsformat — jedes Feld gesetzt, nichts geraten. */
function aufloesung(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resolutionId: "res-1",
    mode: "deterministic",
    provider: "klarwerk-retrieval",
    model: "retrieval-only",
    adminConfiguredMode: "deterministic",
    effectiveMode: "deterministic",
    deviation: false,
    deviationReason: null,
    externalConsentRequired: false,
    externalConsentGranted: false,
    executionAllowed: true,
    blockedReason: null,
    resolvedAt: new Date(JETZT - 1000).toISOString(),
    expiresAt: new Date(JETZT + 60_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    ...over,
  };
}

function sicht(
  resolutionOver: Record<string, unknown> = {},
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sessionId: "sess-1",
    tenantId: "t1",
    actorId: "a1",
    addinInstanceId: "inst-1",
    documentContextId: "doc-t-1",
    createdAt: new Date(JETZT - 5000).toISOString(),
    lastActivityAt: new Date(JETZT - 1000).toISOString(),
    expiresAt: new Date(JETZT + 900_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    consentState: "none",
    closed: false,
    resolution: aufloesung(resolutionOver),
    ...over,
  };
}

// ================================================================================================
// BLOCK A — der Kopf ist permanent und traegt beide Fragen getrennt
// ================================================================================================
describe("AUFTRAG-06 BLOCK A: der Kopf ist da, bevor irgendein Netzabruf antwortet", () => {
  it("die sitzungsbezogene Gruppe liegt IM permanenten Kopf, nicht in einem Reiter", () => {
    const kopfStart = HTML.indexOf('<div id="klara-trust-head"');
    expect(kopfStart, "Der permanente Kopf fehlt").toBeGreaterThan(0);
    const kopfEnde = HTML.indexOf("</header>", kopfStart);
    expect(kopfEnde, "Der Kopf steht nicht mehr im <header>").toBeGreaterThan(kopfStart);
    const kopf = HTML.slice(kopfStart, kopfEnde);
    for (const id of [
      "klara-s4",
      "klara-s4-label",
      "klara-s4-mode",
      "klara-s4-provider",
      "klara-s4-deviation",
      "klara-s4-session",
    ]) {
      expect(kopf, `${id} muss im permanenten Kopf stehen`).toContain(`id="${id}"`);
    }
  });

  it("es gibt GENAU EINE sitzungsbezogene Gruppe — kein zweiter Kopf mit zweiter Wahrheit", () => {
    expect(HTML.split('id="klara-s4"').length - 1).toBe(1);
    expect(HTML.split('id="klara-trust-head"').length - 1).toBe(1);
  });

  it("der Hausstand (BASIC-0) bleibt unberuehrt neben dem Sitzungsstand — zwei Etiketten", () => {
    // Beide Gruppen existieren; die BASIC-0-Pille wurde NICHT umgewidmet.
    expect(HTML).toContain('id="klara-trust-mode"');
    expect(HTML).toContain('id="klara-s4-mode"');
    // Und der Sitzungsteil traegt ein eigenes Etikett, sonst verschmelzen die beiden Fragen.
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "s4Label").length).toBeGreaterThan(0);
    }
  });

  it("der Kopf wird MIT den statischen Texten gefuellt, nicht erst durch den Statusabruf", () => {
    const start = HTML.indexOf("function renderStatics()");
    const ende = HTML.indexOf("\n    }", start);
    expect(start).toBeGreaterThan(0);
    expect(HTML.slice(start, ende), "renderStatics muss den Sitzungsteil zeichnen").toContain(
      "renderKlaraS4()",
    );
  });
});

// ================================================================================================
// BLOCK B — der Zustandsraum kommt aus dem Vertrag
// ================================================================================================
describe("AUFTRAG-06 BLOCK B: jeder Vertragswert hat einen Text — in allen drei Sprachen", () => {
  it("die Modusliste des Aufgabenfensters ist die Modusliste des Vertrags", () => {
    expect(block().KLARA_S4_MODES, `abgeglichen gegen ${POLICY}`).toEqual(MODI);
  });

  it("die Gruendeliste des Aufgabenfensters ist die Gruendeliste des Vertrags", () => {
    expect(block().KLARA_S4_REASONS, `abgeglichen gegen ${POLICY}`).toEqual(GRUENDE);
  });

  it("die Zustimmungszustaende des Aufgabenfensters sind die des Vertrags plus „none“", () => {
    expect(block().KLARA_S4_CONSENT_STATES, `abgeglichen gegen ${STORE}`).toEqual(
      CONSENT_ZUSTAENDE,
    );
  });

  it("zu JEDEM Modus, Grund und Zustimmungszustand steht ein Text in de, en und nl", () => {
    const b = block();
    const fehlend: string[] = [];
    for (const sprache of SPRACHEN) {
      for (const modus of MODI) {
        const key = b.klaraS4ModeKey(modus);
        expect(key, `${modus} faellt in den Unbekannt-Zweig`).not.toBe("s4ModeUnbekannt");
        if (!new RegExp(`^\\s*${key}:\\s*"[^"]+"`, "m").test(woerterbuch(sprache))) {
          fehlend.push(`${sprache}.${key}`);
        }
      }
      for (const grund of GRUENDE) {
        const key = b.klaraS4ReasonKey(grund);
        expect(key, `${grund} faellt in den Sammel-Zweig`).not.toBe("s4ReasonOther");
        if (!new RegExp(`^\\s*${key}:\\s*"[^"]+"`, "m").test(woerterbuch(sprache))) {
          fehlend.push(`${sprache}.${key}`);
        }
      }
      for (const zustand of CONSENT_ZUSTAENDE) {
        // FORTGESCHRIEBEN IN AUFTRAG-BASIC-W1-CONSENT-REFRESH-R4-34 (BEN-Befund 4).
        //
        // VORHERHASH dieser Datei:
        // a55e68c87991969a0c5d3cbed3eef237996b073aaa3e660b3009c5c27828790f
        //
        // EINZELBEGRUENDUNG: `klaraS4ConsentKey` bekam ein drittes Argument — die autoritative
        // Angabe `externalConsentGranted` aus der Auflösung. Ohne sie faellt „granted" jetzt
        // ausdruecklich in den Vorbehalt, weil ein Zustimmungswort ohne Deckung durch die
        // Auflösung nicht als erteilt gelten darf (genau BENs Mischsicht).
        //
        // Dieser Fall prueft den WORTSCHATZ, nicht die Autorisierung: er stellt sicher, dass zu
        // jedem Vertragswert ein Text in drei Sprachen existiert. Er wird deshalb nicht
        // abgeschwaecht, sondern bekommt den Kontext, den der Produktcode an seiner EINZIGEN
        // Aufrufstelle ohnehin immer mitgibt. Die neue Zusage selbst ist unten eigens gepinnt.
        const gedeckt = zustand === "granted";
        const key = b.klaraS4ConsentKey(zustand, false, gedeckt);
        expect(key, `${zustand} faellt in den Unbekannt-Zweig`).not.toBe("s4ConsentUnbekannt");
        if (!new RegExp(`^\\s*${key}:\\s*"[^"]+"`, "m").test(woerterbuch(sprache))) {
          fehlend.push(`${sprache}.${key}`);
        }
      }
    }
    expect(fehlend.join("\n"), "Diese Vertragswerte haetten keinen Text").toBe("");
  });

  // ----------------------------------------------------------------------------------------------
  // AUFTRAG-34 (BEN-Befund 4): die Auflösung schlaegt die Sitzungssicht.
  // ----------------------------------------------------------------------------------------------
  it("„granted“ ohne Deckung durch die Auflösung wird NIE als erteilt gezeigt", () => {
    const b = block();
    // Genau BENs Mischsicht: alte Sitzungssicht sagt granted, neue Auflösung sagt das Gegenteil.
    expect(b.klaraS4ConsentKey("granted", true, false)).toBe("s4ConsentErforderlich");
    expect(b.klaraS4ConsentKey("granted", false, false)).toBe("s4ConsentUnbekannt");
    expect(b.klaraS4ConsentKey("granted", true, undefined)).toBe("s4ConsentErforderlich");
    // Positive Kontrolle — mit Deckung bleibt es bei „erteilt", sonst waere der Riegel blind.
    expect(b.klaraS4ConsentKey("granted", true, true)).toBe("s4ConsentGranted");
  });

  it("fehlt die Sitzungssicht ganz, traegt allein die Auflösung", () => {
    const b = block();
    // Nach einem reinen Statusabruf gibt es kein `consentState` — der Vertrag liefert keines.
    for (const leer of [undefined, null, ""]) {
      expect(b.klaraS4ConsentKey(leer, true, true)).toBe("s4ConsentGranted");
      expect(b.klaraS4ConsentKey(leer, true, false)).toBe("s4ConsentErforderlich");
      expect(b.klaraS4ConsentKey(leer, false, false)).toBe("s4ConsentNone");
    }
    // Ein DA-, aber unbekanntes Wort bleibt dagegen im Vorbehalt — nicht „keine erforderlich".
    expect(b.klaraS4ConsentKey("halb_erteilt", false, false)).toBe("s4ConsentUnbekannt");
  });

  it("der Refresh baut die neue Sicht aus einer WEISSEN Liste ohne Zustimmungsstand", () => {
    // Die Ursache aus BENs Befund: `Object.assign({}, basis, {resolution})` trug `consentState`
    // weiter. Gemessen am Produktcode ohne seine Kommentare.
    const start = HTML.indexOf("function klaraS4Sitzungsidentitaet");
    expect(start, `${TASKPANE}: die Identitaets-Weissliste fehlt`).toBeGreaterThan(0);
    const liste = HTML.slice(start, HTML.indexOf("\n    }", start)).replace(/\/\/[^\n]*/g, "");
    expect(liste, "consentState darf einen reinen Statusabruf nicht ueberleben").not.toContain(
      "consentState",
    );
    expect(liste).toContain("sessionId");
    expect(liste).toContain("documentContextId");

    const refresh = HTML.slice(
      HTML.indexOf("function klaraS4Refresh"),
      HTML.indexOf("function klaraS4RefreshAnlass"),
    ).replace(/\/\/[^\n]*/g, "");
    expect(refresh, "Die alte Mischsicht ist zurueck").not.toContain("var basis = klaraS4Sicht");
    expect(refresh).toContain("klaraS4Sitzungsidentitaet(klaraS4Sicht)");
  });

  it("jeder Anzeige-Zustand hat einen Text in allen drei Sprachen", () => {
    for (const sprache of SPRACHEN) {
      for (const key of [
        "s4StateLaedt",
        "s4StateBereit",
        "s4StateAbweichung",
        "s4StateBlockiert",
        "s4StateUnerreichbar",
        "s4StateKeineSitzung",
        "s4StateVeraltet",
        "s4Anbieter",
        "s4Abweichung",
        "s4Blockiert",
        "s4Veraltet",
        "s4Sitzung",
        "s4SitzungKeine",
        "s4Unbekannt",
        "s4FragenGesperrt",
      ]) {
        expect(text(sprache, key).length).toBeGreaterThan(0);
      }
    }
  });
});

// ================================================================================================
// BLOCK C — die Ableitung: Werte WOERTLICH, Unbekanntes benannt
// ================================================================================================
describe("AUFTRAG-06 BLOCK C: die Anzeige spiegelt die Serverantwort und erfindet nichts", () => {
  it("„laedt“ behauptet keinen Modus, keinen Anbieter und kein Modell", () => {
    const a = block().klaraS4Anzeige("laedt", null, JETZT);
    expect(a.stateKey).toBe("s4StateLaedt");
    expect(a.modeKey).toBeNull();
    expect(a.provider).toBeNull();
    expect(a.model).toBeNull();
    // Und der Ladezustand ist KEIN Befund: er sperrt das Fragen nicht.
    expect(a.askAllowed).toBe(false);
    expect(a.consentVisible).toBe(false);
  });

  it("„nicht erreichbar“ und „keine Sitzung“ sind zwei verschiedene, benannte Zustaende", () => {
    const b = block();
    expect(b.klaraS4Anzeige("unerreichbar", null, JETZT).stateKey).toBe("s4StateUnerreichbar");
    expect(b.klaraS4Anzeige("keineSitzung", null, JETZT).stateKey).toBe("s4StateKeineSitzung");
    // Keiner von beiden behauptet „keine KI“ — Nichtwissen ist nicht Abwesenheit.
    expect(b.klaraS4Anzeige("unerreichbar", null, JETZT).modeKey).toBeNull();
    expect(b.klaraS4Anzeige("keineSitzung", null, JETZT).modeKey).toBeNull();
  });

  it("eine Antwort OHNE Auflösung ist nicht „bereit“, sondern nicht abrufbar", () => {
    const a = block().klaraS4Anzeige("bereit", sicht({}, { resolution: null }), JETZT);
    expect(a.stateKey).toBe("s4StateUnerreichbar");
    expect(a.askAllowed).toBe(false);
  });

  it("Anbieter und Modell werden WOERTLICH uebernommen — auch aussergewoehnliche Werte", () => {
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({ provider: "Anbieter mit Leerzeichen & Zeichen", model: "modell-x.9-preview" }),
      JETZT,
    );
    expect(a.provider).toBe("Anbieter mit Leerzeichen & Zeichen");
    expect(a.model).toBe("modell-x.9-preview");
  });

  it("ein fehlender Anbieter wird NICHT ersetzt — kein Platzhalter, der wie ein Anbieter aussieht", () => {
    const a = block().klaraS4Anzeige("bereit", sicht({ provider: "", model: undefined }), JETZT);
    expect(a.provider).toBeNull();
    expect(a.model).toBeNull();
  });

  it("der effektive Modus wird angezeigt — nicht der eingerichtete", () => {
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({
        adminConfiguredMode: "external",
        effectiveMode: "deterministic",
        deviation: true,
        deviationReason: "external_not_configured",
      }),
      JETZT,
    );
    expect(a.modeKey).toBe("s4ModeDeterministic");
    expect(a.adminModeKey).toBe("s4ModeExternal");
    expect(a.deviationKey).toBe("s4ReasonExternalNotConfigured");
    expect(a.stateKey).toBe("s4StateAbweichung");
    expect(a.tone).toBe("warn");
  });

  it("ohne Abweichung wird keine Abweichung behauptet", () => {
    const a = block().klaraS4Anzeige("bereit", sicht(), JETZT);
    expect(a.stateKey).toBe("s4StateBereit");
    expect(a.tone).toBe("ok");
    expect(a.deviationKey).toBeNull();
    expect(a.adminModeKey).toBeNull();
    expect(a.blockedKey).toBeNull();
  });

  it("gesperrt sticht Abweichung: der schwerere Zustand gewinnt, mit seinem Grund", () => {
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({
        deviation: true,
        deviationReason: "external_consent_missing",
        executionAllowed: false,
        blockedReason: "external_consent_missing",
      }),
      JETZT,
    );
    expect(a.stateKey).toBe("s4StateBlockiert");
    expect(a.blockedKey).toBe("s4ReasonExternalConsentMissing");
    expect(a.askAllowed).toBe(false);
  });

  it("eine abgelaufene Auflösung wird als abgelaufen gezeigt, nicht als aktueller Stand", () => {
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({ expiresAt: new Date(JETZT - 1).toISOString() }),
      JETZT,
    );
    expect(a.veraltet).toBe(true);
    expect(a.stateKey).toBe("s4StateVeraltet");
    expect(a.tone).toBe("warn");
  });
});

// ================================================================================================
// BLOCK D — die Gegenproben: was der Server nicht gesagt hat, wird nicht behauptet
// ================================================================================================
describe("AUFTRAG-06 BLOCK D: Gegenproben gegen erfundene Wahrheit", () => {
  it("ein unbekannter Modus wird benannt, nicht erfunden und nicht verschwiegen", () => {
    const b = block();
    expect(b.klaraS4ModeKey("quantum")).toBe("s4ModeUnbekannt");
    expect(b.klaraS4ModeKey(undefined)).toBe("s4ModeUnbekannt");
    const a = b.klaraS4Anzeige("bereit", sicht({ effectiveMode: "quantum" }), JETZT);
    expect(a.modeKey).toBe("s4ModeUnbekannt");
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "s4ModeUnbekannt").length).toBeGreaterThan(0);
    }
  });

  it("ein unbekannter Grund wird benannt — der Zustand verschwindet nicht mit ihm", () => {
    const b = block();
    expect(b.klaraS4ReasonKey("weil_es_dienstag_ist")).toBe("s4ReasonOther");
    expect(b.klaraS4ReasonKey(null)).toBe("s4ReasonOther");
    const a = b.klaraS4Anzeige(
      "bereit",
      sicht({ executionAllowed: false, blockedReason: "weil_es_dienstag_ist" }),
      JETZT,
    );
    expect(a.stateKey).toBe("s4StateBlockiert");
    expect(a.blockedKey).toBe("s4ReasonOther");
  });

  it("eine Abweichung OHNE Grund bleibt eine Abweichung — mit benanntem Nichtwissen", () => {
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({ deviation: true, deviationReason: null }),
      JETZT,
    );
    expect(a.stateKey).toBe("s4StateAbweichung");
    expect(a.deviationKey).toBe("s4ReasonOther");
  });

  it("ein fehlendes executionAllowed sperrt — nicht erlaubt ist nicht dasselbe wie erlaubt", () => {
    const b = block();
    for (const wert of [undefined, null, "true", 1]) {
      const a = b.klaraS4Anzeige("bereit", sicht({ executionAllowed: wert }), JETZT);
      expect(a.askAllowed, `executionAllowed=${String(wert)} darf nicht erlauben`).toBe(false);
      expect(a.stateKey).toBe("s4StateBlockiert");
    }
    // Und die positive Kontrolle — sonst waere die Sperre oben blind.
    expect(b.klaraS4Anzeige("bereit", sicht({ executionAllowed: true }), JETZT).askAllowed).toBe(
      true,
    );
  });

  it("der Zustimmungsbedarf wird GELESEN, nicht abgeleitet", () => {
    const b = block();
    // Externer Modus ALLEIN loest den Kasten nicht aus — nur das Serverfeld tut das.
    expect(
      b.klaraS4Anzeige(
        "bereit",
        sicht({ effectiveMode: "external", externalConsentRequired: false }),
        JETZT,
      ).consentVisible,
    ).toBe(false);
    expect(
      b.klaraS4Anzeige(
        "bereit",
        sicht({ externalConsentRequired: true, externalConsentGranted: false }),
        JETZT,
      ).consentVisible,
    ).toBe(true);
    // Erteilt: kein Kasten mehr, aber ein Widerrufsweg.
    const erteilt = b.klaraS4Anzeige(
      "bereit",
      sicht({ externalConsentRequired: true, externalConsentGranted: true }),
      JETZT,
    );
    expect(erteilt.consentVisible).toBe(false);
    expect(erteilt.revokeVisible).toBe(true);
  });

  it("ein unbekannter Zustimmungszustand wird benannt, nicht als „erteilt“ gelesen", () => {
    const b = block();
    expect(b.klaraS4ConsentKey("halb_erteilt")).toBe("s4ConsentUnbekannt");
    const a = b.klaraS4Anzeige("bereit", sicht({}, { consentState: "halb_erteilt" }), JETZT);
    expect(a.consentKey).toBe("s4ConsentUnbekannt");
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "s4ConsentUnbekannt").length).toBeGreaterThan(0);
    }
  });

  it("die Ableitung ist rein: dieselbe Eingabe, dasselbe Ergebnis, kein Seiteneffekt", () => {
    const b = block();
    const eingabe = sicht({ deviation: true, deviationReason: "policy_incomplete" });
    const gefroren = JSON.stringify(eingabe);
    const eins = b.klaraS4Anzeige("bereit", eingabe, JETZT);
    const zwei = b.klaraS4Anzeige("bereit", eingabe, JETZT);
    expect(eins).toEqual(zwei);
    expect(JSON.stringify(eingabe), "Die Eingabe wurde veraendert").toBe(gefroren);
  });
});

// ================================================================================================
// BLOCK E — keine Fixture-Wahrheit im Produktcode
// ================================================================================================
describe("AUFTRAG-06 BLOCK E: der Produktcode kennt keine erfundenen Anbieter oder Modelle", () => {
  it("im Aufgabenfenster steht kein hart verdrahteter Anbieter-/Modellname als Rueckfall", () => {
    const start = HTML.indexOf("// KW-KLARA-S4-START");
    const ende = HTML.indexOf("// KW-KLARA-S4-FETCH-END");
    expect(ende).toBeGreaterThan(start);
    const s4 = HTML.slice(start, ende);
    for (const verdaechtig of ["openai", "anthropic", "gpt-", "claude-", "llama", "mistral"]) {
      expect(s4.toLowerCase(), `„${verdaechtig}“ waere eine erfundene Wahrheit`).not.toContain(
        verdaechtig,
      );
    }
  });

  it("Anbieter und Modell werden nirgends mit einem Ersatzwert aufgefuellt", () => {
    // Der Umfangssatz des Zustimmungskastens darf „unbekannt“ sagen — aber der KOPF nicht raten.
    const a = block().klaraS4Anzeige("bereit", sicht({ provider: null, model: null }), JETZT);
    expect(a.provider).toBeNull();
    expect(a.model).toBeNull();
  });

  // FORTGESCHRIEBEN IN AUFTRAG-BASIC-W1-CONSENT-LIFECYCLE-R3-26 (KW-S4-22 kanonisch).
  //
  // VORHERHASH dieser Datei: 67654295f3377fe499428c01beea05e7ddc10ea3455fabeca7bf368ac2559917
  //
  // EINZELBEGRUENDUNG: der Fall pinnte `klaraS4Payloadklasse()` — eine Funktion, die
  // `payloadClass` und `allowedPayloadClasses` las. KW-S4-22 fuehrt beides ausdruecklich als
  // No-Go („nur eine allgemeine payloadClass ohne konkreten Resolutionbezug", „allowedPayloadClasses
  // als breiten Policy-Maximalumfang im Consent anzeigen"). Die Funktion ist deshalb entfallen;
  // der Fall wuerde eine Zusage pinnen, die der kanonische Vertrag verbietet.
  //
  // Er wird nicht gestrichen, sondern auf den JETZT geltenden Vertrag umgehaengt — und dabei
  // ausdruecklich strenger: geprueft wird, dass ausschliesslich `effectivePayloadClasses` gelesen
  // wird und dass ohne aufgeloeste Klassen keine Zustimmung moeglich ist.
  it("die Payload-Klassen kommen AUSSCHLIESSLICH aus effectivePayloadClasses", () => {
    const b = block();
    const a = b.klaraS4Anzeige(
      "bereit",
      sicht({
        effectiveMode: "external",
        externalConsentRequired: true,
        effectivePayloadClasses: ["query_text", "selected_text"],
      }),
      JETZT,
    );
    expect(a.payloadClasses).toEqual(["query_text", "selected_text"]);
    expect(a.payloadResolved).toBe(true);
    expect(a.consentPossible).toBe(true);

    // Die beiden No-Go-Felder werden NICHT gelesen — auch nicht als Rueckfall.
    const nurVerbotene = b.klaraS4Anzeige(
      "bereit",
      sicht(
        { effectiveMode: "external", externalConsentRequired: true },
        { payloadClass: "question", allowedPayloadClasses: ["query_text"] },
      ),
      JETZT,
    );
    expect(nurVerbotene.payloadClasses).toBeNull();
    expect(nurVerbotene.payloadResolved).toBe(false);
  });

  it("ohne aufgeloeste Klassen ist KEINE Zustimmung moeglich — der Bedarf bleibt sichtbar", () => {
    const b = block();
    for (const roh of [undefined, null, [], ["query_text", ""], ["query_text", 7], "query_text"]) {
      const a = b.klaraS4Anzeige(
        "bereit",
        sicht({
          effectiveMode: "external",
          externalConsentRequired: true,
          externalConsentGranted: false,
          effectivePayloadClasses: roh,
        }),
        JETZT,
      );
      expect(a.payloadResolved, `${JSON.stringify(roh)} duerfte nicht aufgeloest sein`).toBe(false);
      // Der Kasten bleibt sichtbar — der Bedarf besteht ja. Nur zustimmen kann man nicht.
      expect(a.consentVisible).toBe(true);
      expect(a.consentPossible, `${JSON.stringify(roh)} erlaubt Zustimmung`).toBe(false);
    }
  });

  it("ein einzelner unbrauchbarer Eintrag macht die GANZE Liste unbrauchbar", () => {
    // Ihn zu ueberspringen hiesse, eine gekuerzte Liste als vollstaendigen Umfang auszugeben.
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({ effectivePayloadClasses: ["query_text", "   "] }),
      JETZT,
    );
    expect(a.payloadClasses).toBeNull();
    expect(a.payloadResolved).toBe(false);
  });

  it("blockierte Klassen werden mit ihrem Grund GELESEN, nicht still entfernt", () => {
    const a = block().klaraS4Anzeige(
      "bereit",
      sicht({
        effectivePayloadClasses: ["query_text"],
        blockedPayloadClasses: [
          { payloadClass: "full_document", reasonCode: "FORBIDDEN_BY_POLICY" },
          { payloadClass: "image_content" },
          { reasonCode: "kaputt" },
        ],
      }),
      JETZT,
    );
    expect(a.blockedClasses).toEqual([
      { payloadClass: "full_document", reasonCode: "FORBIDDEN_BY_POLICY" },
      { payloadClass: "image_content", reasonCode: "" },
    ]);
  });

  it("die beiden No-Go-Felder aus KW-S4-22 stehen nicht mehr im Produktcode", () => {
    const start = HTML.indexOf("// KW-KLARA-S4-START");
    const ende = HTML.indexOf("// KW-KLARA-S4-FETCH-END");
    const s4 = HTML.slice(start, ende).replace(/\/\/[^\n]*/g, "");
    expect(s4, "allowedPayloadClasses waere der Policy-Maximalumfang").not.toContain(
      "allowedPayloadClasses",
    );
    expect(s4, "payloadClass ohne Resolutionbezug ist ein No-Go").not.toContain("s.payloadClass");
  });

  it("die drei Bindungsheader stehen mit den Namen des eingefrorenen Vertrags in der Datei", () => {
    const routen = readFileSync(
      resolve(process.cwd(), "services/app/src/routes/klara-ai-routes.ts"),
      "utf8",
    );
    for (const kopf of ["x-klara-session", "x-klara-instance", "x-klara-document"]) {
      expect(routen, `${kopf} steht nicht im Vertrag`).toContain(`"${kopf}"`);
      expect(HTML, `${kopf} fehlt im Aufgabenfenster`).toContain(`"${kopf}"`);
    }
  });
});
