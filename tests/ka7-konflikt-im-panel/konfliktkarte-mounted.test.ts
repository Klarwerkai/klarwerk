// @vitest-environment jsdom
// ================================================================================================
// JOB 3094 · KA7 — DIE KONFLIKTKARTE IM WORD-PANEL, AM LAUFENDEN FENSTER GEMESSEN.
// ================================================================================================
//
// Pedis Weg (Auftrag §1): das Memo sagt „drei Tage“, die freigegebene Regelung „zwei Tage“. Er
// markiert den Satz und fragt Klara „Passt das zur Regelung?“. Klara zeigt die Abweichung mit BEIDEN
// Stellen, nennt Titel, Version und Prüfstand der Regelung, entscheidet nichts und ändert nichts.
//
// GEMESSEN WIRD, WAS EIN MENSCH SIEHT UND WAS DAS FENSTER TUT: der Knopf, der Satz auf der Karte,
// die Zeilen je Konflikt, der Körper des Abrufs an `/api/check-text`, und dass weder Word noch der
// Entwurfsweg angefasst werden. Ausgeführt wird das AUSGELIEFERTE Inline-Skript aus
// `apps/web/public/word-addin/taskpane.html` über die Klara-Panel-Fixture — kein zweiter Quelltext.
//
// DAS ZUSTANDSMODELL (§9 des Auftrags) ist der Kern: „Keine Abweichung“ steht NUR nach einer
// erfolgreichen, frischen Prüfung mit gelaufenem Modell (`konfliktpruefung.gelaufen`), mit Uhrzeit.
// Fehlerantwort, Netz, kaputter Körper, fehlendes Modell, fehlende Einwilligung — jede dieser Lagen
// sagt „nicht möglich“ und nie „keine Abweichung“.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type FakeReplyInit,
  type KlaraPanel,
  createKlaraPanel,
  reply,
} from "../app/klara-panel-fixture";

const MEMO = "Homeoffice ist für alle Beschäftigten an drei Tagen pro Woche möglich.";
const STELLE_EIGEN = "an drei Tagen pro Woche";
const STELLE_QUELLE = "an zwei Tagen pro Woche";

// Vertragsformen wie in job2621-panel-wahrheiten.test.ts (kein erfundener Serverdialekt). Die
// Frist der Auflösung liegt in der Zukunft — eine abgelaufene verwirft das Panel ganz (JOB 3056 R8).
const IN_FUENF_MINUTEN = () => new Date(Date.now() + 5 * 60_000).toISOString();
// JOB 3174 P16: die Uhr läuft im Test wirklich weiter (drei Minutenwechsel). Eine Auflösung, die
// dabei abliefe, würde das Panel verwerfen (`ka7ExterneKi` → „gesperrt") und der Fall messe den
// Ablauf statt der Befundzeit. Deshalb dort eine Frist, die über den ganzen Lauf trägt.
const IN_EINER_STUNDE = () => new Date(Date.now() + 60 * 60_000).toISOString();
const SITZUNG = {
  sessionId: "sess-vom-server",
  tenantId: "t1",
  actorId: "a1",
  addinInstanceId: "inst-1",
  documentContextId: "doc-1",
  createdAt: "2026-09-06T12:00:00.000Z",
  lastActivityAt: "2026-09-06T12:00:00.000Z",
  expiresAt: IN_FUENF_MINUTEN(),
  policyVersion: "p1",
  configurationVersion: "c1",
  consentState: "granted",
  closed: false,
  resolution: { resolutionId: "res-1", effectiveMode: "external", executionAllowed: true },
};
function aufloesung(granted: boolean, executionAllowed = true, frist = IN_FUENF_MINUTEN()) {
  return {
    resolutionId: "res-1",
    mode: "external",
    provider: "OpenAI",
    model: "gpt-5",
    adminConfiguredMode: "external",
    effectiveMode: "external",
    deviation: false,
    deviationReason: null,
    externalConsentRequired: true,
    externalConsentGranted: granted,
    executionAllowed,
    blockedReason: executionAllowed ? null : "external_not_migrated",
    resolvedAt: "2026-09-06T12:00:00.000Z",
    expiresAt: frist,
    policyVersion: "p1",
    configurationVersion: "c1",
  };
}

/** Ein Konflikttreffer, wie die Route ihn seit diesem Auftrag liefert (Lieferung 2). */
function konflikt(
  stellen: { eigen: string | null; quelle: string | null } | null = {
    eigen: STELLE_EIGEN,
    quelle: STELLE_QUELLE,
  },
) {
  return {
    koId: "regel-1",
    koTitle: "Homeoffice-Regelung",
    type: "truth",
    confidence: 0.95,
    method: "model",
    rationale: "A erlaubt drei Tage, B zwei.",
    koStatus: "validiert",
    koCategory: "Personal",
    pruefstand: "validiert",
    version: 3,
    stellen,
  };
}

function antwort(
  conflicts: unknown[],
  konfliktpruefung: unknown = { gelaufen: true, grund: null, kandidaten: 1 },
) {
  return {
    duplicates: [],
    conflicts,
    answer: null,
    note: null,
    persisted: false,
    konfliktpruefung,
  };
}

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
  // JOB 3174 P16 stellt die Uhr (nur `Date`, nicht die Timer — die Fixture wartet auf echte).
  // Zurückgestellt wird IMMER, damit kein anderer Fall die Zeit des vorigen erbt.
  vi.useRealTimers();
});

interface Aufbau {
  checkText: FakeReplyInit | ((body: Record<string, unknown>) => FakeReplyInit);
  granted?: boolean;
  executionAllowed?: boolean;
  selection?: string;
  checkTextWirft?: boolean;
  /** Ablauf der KI-Auflösung; nur P16 braucht eine, die über echte Minutenwechsel trägt. */
  frist?: string;
  /** Eine ANDERE Antwort auf `/api/klara/ai-status` — für den Fall „Sitzungsstand nicht aufgelöst". */
  aiStatus?: FakeReplyInit;
}

function aufbauen(opt: Aufbau): KlaraPanel {
  const routes: Record<
    string,
    FakeReplyInit | ((url: string, init: Record<string, unknown> | undefined) => FakeReplyInit)
  > = {
    "/api/klara/sessions": reply(200, SITZUNG),
    "/api/klara/ai-status":
      opt.aiStatus ??
      reply(
        200,
        aufloesung(
          opt.granted ?? true,
          opt.executionAllowed ?? true,
          opt.frist ?? IN_FUENF_MINUTEN(),
        ),
      ),
    "/api/check-text": (_url, init) => {
      if (opt.checkTextWirft) {
        throw new Error("offline");
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return typeof opt.checkText === "function" ? opt.checkText(body) : opt.checkText;
    },
  };
  return createKlaraPanel({ routes, selectionText: opt.selection ?? MEMO });
}

/**
 * Runde 2 (nach dem Rebase auf main): `/api/check-text` hat im Panel ZWEI Rufer. JOB 3092 (S6)
 * ruft die Route von selbst, sobald eine Markierung von mindestens 40 Zeichen steht — flach, ohne
 * `want: "deep"`, ohne `confidentiality`, deterministischer Pfad ohne Modell (taskpane.html,
 * `captureDublettenPruefen` → `w6DublettenAusCheckText`). Der KA7-Weg ist der EINZIGE, der die tiefe
 * Stufe (`want: "deep"`, `confidentiality: "intern"`) ruft — und nur er steht hinter der
 * KA4-Einwilligung. Gezählt wird deshalb, was KA7 verantwortet: die tiefen Abrufe. Dass daneben
 * KEIN flacher Ruf die Kennzeichen der tiefen Stufe trägt, prüft `tiefeKennzeichenAusserhalb`.
 */
function checkTextRufe(p: KlaraPanel) {
  return p.calls.filter((c) => {
    if (c.url !== "/api/check-text") {
      return false;
    }
    const body = JSON.parse(String(c.body ?? "{}")) as Record<string, unknown>;
    return body.want === "deep";
  });
}

/** Rufe an `/api/check-text`, die ohne `want: "deep"` trotzdem `confidentiality` mitschicken — darf es nie geben. */
function tiefeKennzeichenAusserhalb(p: KlaraPanel) {
  return p.calls.filter((c) => {
    if (c.url !== "/api/check-text") {
      return false;
    }
    const body = JSON.parse(String(c.body ?? "{}")) as Record<string, unknown>;
    return body.want !== "deep" && "confidentiality" in body;
  });
}

async function pruefenKlicken(p: KlaraPanel): Promise<void> {
  const knopf = p.q("#ka7-btn");
  expect(knopf, "der Knopf „Passt das zur Regelung?“ fehlt im Panel").not.toBeNull();
  knopf?.click();
  await p.flush();
}

describe("KA7 · die Konfliktkarte (Lieferung 1, 3, 5)", () => {
  it("P1 · Pedis Fall: „drei Tage“ gegen „zwei Tage“ — Karte mit beiden Stellen, Quelle mit Titel/Version/Prüfstand, kein Auto-Ändern", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    expect(panel.text("#ka7-btn")).toBe("Passt das zur Regelung?");
    expect(panel.q("#ka7-block")?.className ?? "hidden").not.toContain("hidden");

    // Ein Schreibweg, der NIE gerufen werden darf — als Sonde an die Office-Attrappe gehängt.
    const office = (
      globalThis as unknown as { Office: { context: { document: Record<string, unknown> } } }
    ).Office;
    const schreibsonde = vi.fn();
    office.context.document.setSelectedDataAsync = schreibsonde;

    await pruefenKlicken(panel);

    // Der Abruf: markierter Text → check-text, tiefe Prüfung, bewusst „intern“ (Einwilligung liegt vor).
    // Genau EIN tiefer Ruf; der flache S6-Ruf daneben trägt keine Kennzeichen der tiefen Stufe.
    const rufe = checkTextRufe(panel);
    expect(rufe).toHaveLength(1);
    expect(tiefeKennzeichenAusserhalb(panel)).toHaveLength(0);
    const body = JSON.parse(String(rufe[0]?.body)) as Record<string, unknown>;
    expect(body.text).toBe(MEMO);
    expect(body.want).toBe("deep");
    expect(body.source).toBe("transient-document");
    expect(body.confidentiality).toBe("intern");
    expect(body.locale).toBe("de");

    // Die Karte: Abweichung, beide Stellen, Quelle mit Titel, Version und Prüfstand.
    expect(panel.q("#ka7-karte")?.className).not.toContain("hidden");
    const zeile = panel.q("#ka7-liste li");
    expect(zeile?.getAttribute("data-quelle")).toBe("regel-1");
    const quelle = panel.text("#ka7-liste .ka7-quelle");
    expect(quelle).toContain("Homeoffice-Regelung");
    expect(quelle).toContain("Version 3");
    // Der Prüfstand ist derselbe Wortlaut wie in der Bestandsliste (JOB 3093, `askStatusValidiert`)
    // — kein zweiter Wortlaut für dieselbe Aussage über ein Objekt.
    expect(quelle).toContain("Validiert");
    expect(panel.text("#ka7-liste .ka7-eigen")).toContain(STELLE_EIGEN);
    expect(panel.text("#ka7-liste .ka7-regel")).toContain(STELLE_QUELLE);
    expect(panel.text("#ka7-liste .ka7-grund")).toContain("A erlaubt drei Tage, B zwei.");
    // Der Link führt auf die echte Detailroute des Objekts — kein fremdes Ziel.
    expect(panel.q("#ka7-liste .ka7-quelle a")?.href).toContain("regel-1");
    // Sie entscheidet nichts …
    expect(panel.text("#ka7-entscheidung")).toBe(
      "Ich entscheide das nicht — prüfe die Regelung oder reiche den Widerspruch bewusst ein.",
    );
    // … nennt die externe KI aus dem Sitzungsstand und die Uhrzeit …
    const stand = panel.text("#ka7-stand");
    expect(stand).toContain("OpenAI");
    expect(stand).toContain("gpt-5");
    expect(stand).toMatch(/\d{2}:\d{2}/);
    // … und ändert nichts: kein Schreibweg in Word, kein Entwurf.
    expect(schreibsonde).not.toHaveBeenCalled();
    expect(panel.calls.some((c) => c.url.startsWith("/api/drafts"))).toBe(false);
    // Keine Aussage „keine Abweichung“ neben einem Konflikt.
    expect(panel.text("#ka7-satz")).not.toContain("Keine Abweichung");
  });

  it("P2 · kein Treffer NACH gelaufener Prüfung: „Keine Abweichung zu geprüften Quellen gefunden (geprüft HH:MM)“", async () => {
    panel = aufbauen({
      checkText: reply(200, antwort([], { gelaufen: true, grund: null, kandidaten: 2 })),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("Keine Abweichung zu geprüften Quellen gefunden");
    expect(satz).toMatch(/geprüft \d{2}:\d{2}/);
    expect(panel.q("#ka7-liste li")).toBeNull();
    expect(panel.q("#ka7-entscheidung")?.className).toContain("hidden");
  });

  it("P2b · null vorgelegte Quellen: „kein vergleichbarer Eintrag“ — nicht „keine Abweichung zu geprüften Quellen“", async () => {
    panel = aufbauen({
      checkText: reply(200, antwort([], { gelaufen: true, grund: null, kandidaten: 0 })),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("Kein vergleichbarer Eintrag");
    expect(satz).not.toContain("Keine Abweichung zu geprüften Quellen");
    expect(satz).toMatch(/\d{2}:\d{2}/);
  });

  it("P3 · Fehlerantwort, Netzfehler, kaputter Körper: „Prüfung nicht möglich“ — nie „keine Abweichung“", async () => {
    panel = aufbauen({ checkText: reply(503, { error: "MODEL_BUSY" }) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    expect(panel.text("#ka7-satz")).not.toContain("Keine Abweichung");
    panel.restore();

    panel = aufbauen({ checkText: reply(200, {}), checkTextWirft: true });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    panel.restore();

    // Ein Körper ohne `konfliktpruefung` ist keine Antwort dieser Route — kein Leersatz daraus.
    panel = aufbauen({ checkText: reply(200, { duplicates: [], conflicts: [] }) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    expect(panel.text("#ka7-satz")).not.toContain("Keine Abweichung");
    panel.restore();

    // Ein Treffer ohne Kennung ist eine beschädigte Liste — Fehler, nicht Leere (Lehre JOB 3092 R1).
    panel = aufbauen({
      checkText: reply(200, antwort([{ koTitle: "ohne Kennung", stellen: null }])),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    expect(panel.q("#ka7-liste li")).toBeNull();
  });

  it("P4 · Modell nicht gelaufen (kein_modell): „Prüfung nicht möglich“ mit Grund — kein Leersatz", async () => {
    panel = aufbauen({
      checkText: reply(200, antwort([], { gelaufen: false, grund: "kein_modell", kandidaten: 1 })),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("Prüfung nicht möglich");
    expect(satz).toContain("kein KI-Modell");
    expect(satz).not.toContain("Keine Abweichung");
  });

  it("P5 · ohne Einwilligung für dieses Dokument geht NICHTS an die tiefe Stufe (externe KI) — die Karte sagt, was fehlt", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])), granted: false });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(0);
    expect(tiefeKennzeichenAusserhalb(panel)).toHaveLength(0);
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("externe KI");
    expect(satz).toContain("Externe KI erlauben");
    expect(satz).not.toContain("Keine Abweichung");
  });

  it("P5b · Einwilligung erteilt, Ausführung serverseitig gesperrt: kein tiefer Abruf, „gesperrt“ statt Prüfung", async () => {
    panel = aufbauen({
      checkText: reply(200, antwort([konflikt()])),
      granted: true,
      executionAllowed: false,
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(0);
    expect(tiefeKennzeichenAusserhalb(panel)).toHaveLength(0);
    expect(panel.text("#ka7-satz")).toContain("gesperrt");
  });

  it("P6 · ohne Markierung und bei zu kurzem Text: kein Abruf, ein ehrlicher Satz", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])), selection: "" });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(0);
    expect(panel.text("#ka7-satz")).toContain("Markiere");
    panel.restore();

    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])), selection: "drei Tage" });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(0);
    expect(panel.text("#ka7-satz")).toContain("40");
  });

  it("P7 · Stellen fehlen (null): der Konflikt bleibt GENANNT, die Lücke wird gesagt — nicht kaschiert", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt(null)])) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")?.getAttribute("data-quelle")).toBe("regel-1");
    expect(panel.text("#ka7-liste .ka7-eigen")).toContain("nicht benannt");
    expect(panel.text("#ka7-liste .ka7-regel")).toContain("nicht benannt");
    expect(panel.text("#ka7-satz")).not.toContain("Keine Abweichung");
  });

  it("P8 · 401 vom Server: kein alter Konflikt bleibt stehen, die Karte nennt die Anmeldung", async () => {
    let status = 200;
    panel = aufbauen({
      checkText: () => (status === 200 ? reply(200, antwort([konflikt()])) : reply(401, {})),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")).not.toBeNull();
    status = 401;
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")).toBeNull();
    expect(panel.text("#ka7-satz")).toContain("angemeldet");
  });

  it("P9 · DE/EN gleichwertig: Sprachwechsel zeichnet die gehaltene Karte neu — Knopf, Zeilen, Entscheidung", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    await pruefenKlicken(panel);
    panel.setLang("en");
    expect(panel.text("#ka7-btn")).toBe("Does this match the rule?");
    expect(panel.text("#ka7-liste .ka7-quelle")).toContain("Version 3");
    expect(panel.text("#ka7-liste .ka7-quelle")).toContain("Validated");
    expect(panel.text("#ka7-liste .ka7-eigen")).toContain("Your text");
    expect(panel.text("#ka7-liste .ka7-regel")).toContain("The rule");
    expect(panel.text("#ka7-entscheidung")).toBe(
      "I do not decide this — check the rule or submit the contradiction deliberately.",
    );
    panel.setLang("nl");
    expect(panel.text("#ka7-btn")).toBe("Past dit bij de regeling?");
    expect(panel.text("#ka7-entscheidung")).toContain("Ik beslis dit niet");
  });
});

describe("KA7 · Einreichen mit offenem Konflikt (Lieferung 4)", () => {
  it("P10 · der Hinweis steht am Entwurf — vor und nach dem Senden; nichts wird blockiert, nichts geändert", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")).not.toBeNull();

    // Auf „Erfassen“: dieselbe Markierung steht auf der Karte → der offene Widerspruch steht dabei.
    panel.setTab("capture");
    await panel.flush();
    const hinweis = panel.q("#ka7-einreich-hinweis");
    expect(hinweis, "der Einreich-Hinweis fehlt an der Markierungskarte").not.toBeNull();
    expect(hinweis?.className).not.toContain("hidden");
    expect(panel.text("#ka7-einreich-hinweis")).toContain("Homeoffice-Regelung");
    expect(panel.text("#ka7-einreich-hinweis")).toContain("trotzdem einreichen");
    // Nichts wird blockiert: der Sendeknopf ist frei (angemeldet, Word da, Markierung da).
    expect(panel.q("#send-btn")?.disabled).toBe(false);

    panel.sendSelection();
    await panel.flush();
    expect(panel.calls.some((c) => c.url === "/api/drafts" && c.method === "POST")).toBe(true);
    // Nach dem Senden bleibt der Widerspruch sichtbar — als bewusst eingereicht.
    expect(panel.q("#ka7-einreich-hinweis")?.className).not.toContain("hidden");
    expect(panel.text("#ka7-einreich-hinweis")).toContain("Bewusst eingereicht");
    expect(panel.text("#ka7-einreich-hinweis")).toContain("Homeoffice-Regelung");
    // Und die Konfliktkarte im Fragen-Reiter steht weiter.
    expect(panel.q("#ka7-liste li")?.getAttribute("data-quelle")).toBe("regel-1");
    // Der Entwurf ist derselbe Weg wie immer — keine zweite Nutzlast, kein Zusatzfeld aus KA7.
    const entwurf = panel.calls.find((c) => c.url === "/api/drafts");
    expect(String(entwurf?.body)).not.toContain("ka7");
  });

  it("P10b · eine ANDERE Markierung trägt den Hinweis nicht — er gilt nur für den geprüften Text", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    await pruefenKlicken(panel);
    const office = (
      globalThis as unknown as {
        Office: {
          context: {
            document: {
              getSelectedDataAsync: (
                t: string,
                cb: (r: { status: string; value: string }) => void,
              ) => void;
            };
          };
        };
      }
    ).Office;
    office.context.document.getSelectedDataAsync = (_t, cb) => {
      cb({ status: "succeeded", value: "Ein ganz anderer Absatz, der nie geprüft wurde." });
    };
    panel.setTab("capture");
    await panel.flush();
    // JOB 3174 (Lieferung 2): der BEFUND wandert nicht mit — der Hinweis nennt weder die Regelung
    // noch „trotzdem einreichen". Statt der bisherigen Leere steht der Prüfstand DIESES Entwurfs,
    // als kurze Beschriftung (Runde 3), mit einem erreichbaren Weg zur Prüfung.
    const hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).not.toContain("Homeoffice-Regelung");
    expect(hinweis).not.toContain("trotzdem einreichen");
    expect(hinweis).not.toContain("Keine Abweichung");
    expect(hinweis).toBe("Keine frische Prüfung");
    expect(panel.q("#ka7-einreich-pruefen")?.className).not.toContain("hidden");
  });
});

// ================================================================================================
// Runde 6 (Codex R5): zwei Loecher im Zustandsmodell, beide am laufenden Fenster gemessen.
//   1. Ein Server, der „gelaufen: false" mit Zahlen sagt (Urteil verworfen, Teil-Ausfall), darf im
//      Panel nie zur beruhigenden Leere werden — „Prüfung nicht belastbar", mit Grund und Zahlen.
//   2. Eine Wiederholung fuer DENSELBEN Text verwirft den frueheren Befund nicht: waehrend sie laeuft
//      und nach ihrem Fehlschlag (503) steht er mit Vorbehalt weiter — auf der Karte UND am Entwurf,
//      bis zum Einreichen. Ein ANDERER Text traegt nichts weiter.
// ================================================================================================
const ANDERER_TEXT =
  "Ein ganz anderer Absatz, der nie geprüft wurde und deutlich länger als vierzig Zeichen ist.";

/** Erst ein Konflikt, dann 503 — nur fuer die TIEFEN Rufe; der flache S6-Ruf bekommt eine leere Antwort. */
function erstKonfliktDann503() {
  let tiefe = 0;
  return (body: Record<string, unknown>): FakeReplyInit => {
    if (body.want !== "deep") {
      return reply(200, antwort([]));
    }
    tiefe += 1;
    return tiefe === 1 ? reply(200, antwort([konflikt()])) : reply(503, { error: "MODEL_BUSY" });
  };
}

function markierungSetzen(text: string): void {
  const office = (
    globalThis as unknown as {
      Office: {
        context: {
          document: {
            getSelectedDataAsync: (
              t: string,
              cb: (r: { status: string; value: string }) => void,
            ) => void;
          };
        };
      };
    }
  ).Office;
  office.context.document.getSelectedDataAsync = (_t, cb) => {
    cb({ status: "succeeded", value: text });
  };
}

describe("KA7 · Runde 6 — nicht belastbare Prüfung und erhaltener Befund", () => {
  it("P11 · Konflikt → Wiederholung → Fehler (503) → Einreichen: der frühere Befund bleibt mit Vorbehalt — auf der Karte und am Entwurf", async () => {
    panel = aufbauen({ checkText: erstKonfliktDann503() });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")?.getAttribute("data-quelle")).toBe("regel-1");
    const standVorher = panel.text("#ka7-stand");
    expect(standVorher).toMatch(/\d{2}:\d{2}/);

    // Die Wiederholung fuer denselben Text scheitert (503).
    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(2);
    // Der Befund steht weiter: beide Stellen, Entscheidung, der Stand-Satz mit SEINER Uhrzeit.
    expect(panel.q("#ka7-liste li")?.getAttribute("data-quelle")).toBe("regel-1");
    expect(panel.text("#ka7-liste .ka7-eigen")).toContain(STELLE_EIGEN);
    expect(panel.text("#ka7-liste .ka7-regel")).toContain(STELLE_QUELLE);
    expect(panel.q("#ka7-entscheidung")?.className).not.toContain("hidden");
    expect(panel.text("#ka7-stand")).toBe(standVorher);
    // … aber gekennzeichnet: nicht frisch, Auffrischung fehlgeschlagen — und nie „keine Abweichung“.
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("Prüfung nicht möglich");
    expect(satz).toMatch(/Befund von \d{2}:\d{2}/);
    expect(satz).toContain("Auffrischung ist fehlgeschlagen");
    expect(satz).not.toContain("Keine Abweichung");

    // Am Entwurf: der Hinweis bleibt, mit dem Vorbehalt — und nichts ist blockiert.
    panel.setTab("capture");
    await panel.flush();
    expect(panel.q("#ka7-einreich-hinweis")?.className).not.toContain("hidden");
    let hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toContain("Homeoffice-Regelung");
    expect(hinweis).toContain("trotzdem einreichen");
    expect(hinweis).toMatch(/Befund von \d{2}:\d{2}; die erneute Prüfung ist fehlgeschlagen/);
    expect(panel.q("#send-btn")?.disabled).toBe(false);

    panel.sendSelection();
    await panel.flush();
    expect(panel.calls.some((c) => c.url === "/api/drafts" && c.method === "POST")).toBe(true);
    expect(panel.q("#ka7-einreich-hinweis")?.className).not.toContain("hidden");
    hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toContain("Bewusst eingereicht");
    expect(hinweis).toContain("Homeoffice-Regelung");
    expect(hinweis).toContain("erneute Prüfung ist fehlgeschlagen");
  });

  it("P12 · während die Wiederholung LÄUFT, bleibt der frühere Befund stehen — „bis dahin gilt der Befund von …“, auch am Entwurf", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")).not.toBeNull();

    // Der zweite tiefe Ruf bleibt haengen (kommt nie zurueck) — die Attrappe des Fensters wird
    // fuer genau diesen Ruf umgeleitet; alles andere laeuft wie zuvor.
    const g = globalThis as unknown as {
      fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown>;
      window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
    };
    const echt = g.fetch;
    const haengend = (url: string, init?: Record<string, unknown>): Promise<unknown> => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (url === "/api/check-text" && body.want === "deep") {
        return new Promise(() => {});
      }
      return echt(url, init);
    };
    g.fetch = haengend;
    g.window.fetch = haengend;
    try {
      await pruefenKlicken(panel);
      const satz = panel.text("#ka7-satz");
      expect(satz).toMatch(/Bis dahin gilt der Befund von \d{2}:\d{2}/);
      expect(satz).not.toContain("Keine Abweichung");
      expect(panel.q("#ka7-liste li")?.getAttribute("data-quelle")).toBe("regel-1");
      expect(panel.text("#ka7-liste .ka7-regel")).toContain(STELLE_QUELLE);
      expect(panel.q("#ka7-entscheidung")?.className).not.toContain("hidden");
      panel.setTab("capture");
      await panel.flush();
      expect(panel.q("#ka7-einreich-hinweis")?.className).not.toContain("hidden");
      expect(panel.text("#ka7-einreich-hinweis")).toContain("erneute Prüfung läuft");
    } finally {
      g.fetch = echt;
      g.window.fetch = echt;
    }
  });

  it("P13 · verworfenes Urteil oder Teil-Ausfall: „Prüfung nicht belastbar“ mit Grund und Zahlen — nie „Keine Abweichung“", async () => {
    panel = aufbauen({
      checkText: reply(
        200,
        antwort([], {
          gelaufen: false,
          grund: "urteil_verworfen",
          kandidaten: 1,
          ausgefallen: 0,
          verworfen: 1,
        }),
      ),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    let satz = panel.text("#ka7-satz");
    expect(satz).toContain("Prüfung nicht belastbar");
    expect(satz).toContain("nicht belegen");
    expect(satz).toContain("1 von 1");
    expect(satz).not.toContain("Keine Abweichung");
    expect(panel.q("#ka7-liste li")).toBeNull();
    expect(panel.text("#ka7-stand")).toContain("1 davon ohne belastbares Urteil");
    panel.restore();

    // Drei Quellen, eine geworfen: der Rest hatte ein Urteil — trotzdem nicht belastbar.
    panel = aufbauen({
      checkText: reply(
        200,
        antwort([], {
          gelaufen: false,
          grund: "modellfehler",
          kandidaten: 3,
          ausgefallen: 1,
          verworfen: 0,
        }),
      ),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    satz = panel.text("#ka7-satz");
    expect(satz).toContain("Prüfung nicht belastbar");
    expect(satz).toContain("1 von 3");
    expect(satz).not.toContain("Keine Abweichung");
    panel.restore();

    // Ein Konflikt UND ein Ausfall daneben: der Konflikt steht, der Stand nennt den Ausfall.
    panel = aufbauen({
      checkText: reply(
        200,
        antwort([konflikt()], {
          gelaufen: false,
          grund: "modellfehler",
          kandidaten: 2,
          ausgefallen: 1,
          verworfen: 0,
        }),
      ),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")?.getAttribute("data-quelle")).toBe("regel-1");
    expect(panel.text("#ka7-stand")).toContain(
      "2 Quellen vorgelegt, 1 davon ohne belastbares Urteil",
    );
  });

  it("P14 · eine ANDERE Markierung trägt den früheren Befund nicht weiter: nach 503 steht nur „nicht möglich“", async () => {
    panel = aufbauen({ checkText: erstKonfliktDann503() });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.q("#ka7-liste li")).not.toBeNull();

    markierungSetzen(ANDERER_TEXT);
    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(2);
    expect(panel.q("#ka7-liste li")).toBeNull();
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("Prüfung nicht möglich");
    expect(satz).not.toContain("Befund von");
    expect(panel.q("#ka7-entscheidung")?.className).toContain("hidden");
    panel.setTab("capture");
    await panel.flush();
    // JOB 3174 (Lieferung 2): kein früherer Befund an DIESEM Entwurf — statt Leere sein Prüfstand,
    // als kurze Beschriftung. Der GRUND („Prüfung nicht möglich") steht auf der Karte, nicht hier:
    // er ist ein Satz und kein Etikett (Runde 3, JOB 3057 K2 §5.7).
    const hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).not.toContain("Homeoffice-Regelung");
    expect(hinweis).not.toContain("Befund von");
    expect(hinweis).toBe("Keine frische Prüfung");
    expect(hinweis).not.toContain("Prüfung nicht möglich");
  });
});

// ================================================================================================
// Runde 7 (Codex R6): TEIL-AUSFALL MIT NEUEN TREFFERN. Bekannt sind A und B; die Wiederholung
// (HTTP 200) liefert nur B, und `gelaufen: false` sagt, dass ein Teil der Quellen ohne belastbares
// Urteil blieb. A ist damit NICHT entkraeftet — es bleibt neben B stehen, mit seinen Stellen, der
// Uhrzeit seines Befunds und dem Vorbehalt, bis einschliesslich Einreichen. Ein belastbar gelaufener
// Lauf, der A nicht mehr findet, entkraeftet es dagegen (P15b).
// ================================================================================================
const NICHT_BELASTBAR_TEIL = {
  gelaufen: false,
  grund: "modellfehler",
  kandidaten: 2,
  ausgefallen: 1,
  verworfen: 0,
};

function konfliktB() {
  return {
    ...konflikt({ eigen: STELLE_EIGEN, quelle: "höchstens zwei Tage" }),
    koId: "regel-2",
    koTitle: "Zweite Regelung",
    rationale: "B nennt höchstens zwei Tage.",
    version: 1,
  };
}

/** Erst A+B, dann nur B — mit der Lage `pruefungDanach`; nur die TIEFEN Rufe zaehlen. */
function erstAundBDannNurB(pruefungDanach: unknown) {
  let tiefe = 0;
  return (body: Record<string, unknown>): FakeReplyInit => {
    if (body.want !== "deep") {
      return reply(200, antwort([]));
    }
    tiefe += 1;
    return tiefe === 1
      ? reply(
          200,
          antwort([konflikt(), konfliktB()], { gelaufen: true, grund: null, kandidaten: 2 }),
        )
      : reply(200, antwort([konfliktB()], pruefungDanach));
  };
}

/** Die Kennungen der Zeilen auf der Karte, in Reihenfolge — am jsdom-Dokument des Fensters. */
function zeilenKennungen(): (string | null)[] {
  // Strukturell getypt: der Wurzel-tsc (tools/build) hat keine DOM-lib; das jsdom-Dokument ist da.
  interface Zeile {
    getAttribute(name: string): string | null;
  }
  const dokument = (
    globalThis as unknown as { document: { querySelectorAll(sel: string): ArrayLike<Zeile> } }
  ).document;
  return Array.from(dokument.querySelectorAll("#ka7-liste li")).map((z) =>
    z.getAttribute("data-quelle"),
  );
}

describe("KA7 · Runde 7 — Teil-Ausfall mit neuen Treffern", () => {
  it("P15 · A+B bekannt → Wiederholung liefert nur B mit Prüfausfall → Karte zeigt A (Vorbehalt) und B → Einreichen nennt A und B", async () => {
    panel = aufbauen({ checkText: erstAundBDannNurB(NICHT_BELASTBAR_TEIL) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(zeilenKennungen()).toEqual(["regel-1", "regel-2"]);
    const zeitVorher = panel.text("#ka7-stand").match(/\d{2}:\d{2}/)?.[0];
    expect(zeitVorher).toBeDefined();

    await pruefenKlicken(panel);
    expect(checkTextRufe(panel)).toHaveLength(2);
    // Beide stehen: B frisch, A uebernommen und als solches gekennzeichnet — mit seinen Stellen.
    expect(zeilenKennungen().sort()).toEqual(["regel-1", "regel-2"]);
    const a = panel.q('#ka7-liste li[data-quelle="regel-1"]');
    const b = panel.q('#ka7-liste li[data-quelle="regel-2"]');
    expect(a?.getAttribute("data-vorbehalt")).toBe("1");
    expect(b?.getAttribute("data-vorbehalt")).toBeNull();
    expect(a?.textContent).toContain(STELLE_QUELLE);
    expect(a?.textContent).toContain("Homeoffice-Regelung");
    expect(a?.textContent).toContain(`Befund von ${zeitVorher}`);
    expect(a?.textContent).toContain("weder bestätigt noch entkräftet");
    expect(b?.textContent).toContain("höchstens zwei Tage");
    expect(b?.textContent).not.toContain("weder bestätigt");
    // Der Kopf sagt, dass der Lauf nicht belastbar war — und nie „keine Abweichung“.
    const satz = panel.text("#ka7-satz");
    expect(satz).toContain("2 Einträgen");
    expect(satz).toContain("nicht belastbar");
    expect(satz).toContain("gelten weiter");
    expect(satz).not.toContain("Keine Abweichung");
    expect(panel.q("#ka7-entscheidung")?.className).not.toContain("hidden");
    expect(panel.text("#ka7-stand")).toContain(
      "2 Quellen vorgelegt, 1 davon ohne belastbares Urteil",
    );

    // Am Entwurf: beide Titel, A mit Vorbehalt — vor und nach dem Senden.
    panel.setTab("capture");
    await panel.flush();
    expect(panel.q("#ka7-einreich-hinweis")?.className).not.toContain("hidden");
    let hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toContain("Homeoffice-Regelung");
    expect(hinweis).toContain("Zweite Regelung");
    expect(hinweis).toContain("trotzdem einreichen");
    expect(hinweis).toContain(
      `Nicht aufgefrischt: „Homeoffice-Regelung“ (Befund von ${zeitVorher})`,
    );
    expect(hinweis).toContain("weder bestätigt noch entkräftet");
    expect(panel.q("#send-btn")?.disabled).toBe(false);

    panel.sendSelection();
    await panel.flush();
    expect(panel.calls.some((c) => c.url === "/api/drafts" && c.method === "POST")).toBe(true);
    hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toContain("Bewusst eingereicht");
    expect(hinweis).toContain("Homeoffice-Regelung");
    expect(hinweis).toContain("Zweite Regelung");
    expect(hinweis).toContain("Nicht aufgefrischt: „Homeoffice-Regelung“");
  });

  it("P15b · derselbe Uebergang, aber BELASTBAR gelaufen: A ist entkräftet und verschwindet — nur B bleibt, ohne Vorbehalt", async () => {
    panel = aufbauen({
      checkText: erstAundBDannNurB({
        gelaufen: true,
        grund: null,
        kandidaten: 2,
        ausgefallen: 0,
        verworfen: 0,
      }),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(zeilenKennungen()).toHaveLength(2);

    await pruefenKlicken(panel);
    expect(zeilenKennungen()).toEqual(["regel-2"]);
    expect(panel.q("#ka7-liste li[data-vorbehalt]")).toBeNull();
    expect(panel.text("#ka7-satz")).not.toContain("gelten weiter");
    panel.setTab("capture");
    await panel.flush();
    const hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toContain("Zweite Regelung");
    expect(hinweis).not.toContain("Homeoffice-Regelung");
    expect(hinweis).not.toContain("Nicht aufgefrischt");
  });
});

// ================================================================================================
// JOB 3174 · M4b — DREI LÜCKEN, DIE EIN MENSCH IM ALLTAG MERKT.
// ================================================================================================
//   P16 Die Uhr läuft zwischen den Wiederholungen WIRKLICH weiter. P15c (bis Runde 7) klickte
//       dreimal in derselben Minute — die Mutation `kopie.vorbehaltZeit = vorher.zeit` (statt
//       `alt.vorbehaltZeit || vorher.zeit`) blieb dabei grün, weil alle Zeiten gleich waren. P16
//       ERSETZT ihn (die schwache Fassung steht nicht neben der starken).
//   P17 Fenster zu, Fenster auf: der Befund lebt nur im Arbeitsspeicher dieser Panelinstanz. Statt
//       spurloser Leere trägt der Entwurf seinen Prüfstand — als kurze Beschriftung, mit dem Weg.
//   P18 Doppelung ist keine Abweichung: „das haben wir schon" und „das widerspricht" sind zwei
//       Aussagen, nicht ein Wort.
// ================================================================================================

/**
 * Runde 3: Pedis Maßstab für die Fläche „Erfassen“ (JOB 3057 K2 §5.7, gemessen in Chromium von
 * `tests/design/zielbild-k2-kein-erklaertext.test.ts`): außer Beschriftungen steht dort kein Satz,
 * und eine Beschriftung ist höchstens 40 Zeichen lang. Dieselbe Zahl steht hier, damit der gemountete
 * Lauf sie schon meldet, bevor der Browser sie misst.
 */
const GRENZE_K2 = 40;

/**
 * Runde 4 (Tor-Befund „rest=1“, zwei unbehandelte Ablehnungen): `setLang` ruft im Panel
 * `checkSession()` — also einen ECHTEN Abruf an `/api/auth/me`, dessen Promise-Kette danach
 * `renderSitzungsflaeche` ruft und dort `document.getElementById(...).className` setzt. Wird die
 * Fixture zurückgesetzt (`restore()` räumt den Rumpf ab), bevor die Kette durchgelaufen ist, findet
 * sie ihre Stellen nicht mehr und wirft in einem `.then`: „TypeError: Cannot set properties of null
 * (setting 'className')“ — ein Fehler ohne Testfall, der den ganzen Lauf rot macht, obwohl jede
 * Zusicherung hält. Deshalb wird nach JEDEM Sprachwechsel gewartet, bis das Panel zur Ruhe gekommen
 * ist; erst dann darf zurückgesetzt oder der Fall beendet werden.
 */
async function spracheWechseln(p: KlaraPanel, code: string): Promise<void> {
  p.setLang(code);
  await p.flush();
}

/** Die Minute, die auf der Karte stünde, wenn sie JETZT geschrieben würde. */
function minuteJetzt(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

describe("KA7 · JOB 3174 M4b — Zeit, Wiederöffnen, Doppelung", () => {
  it("P16 · drei Wiederholungen über echte Minutenwechsel: A behält die Uhrzeit seines URSPRÜNGLICHEN Befunds — auf der Karte und am Entwurf, DE und EN", async () => {
    // Nur `Date` wird gestellt; die Timer bleiben echt, weil `panel.flush()` auf ihnen wartet.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-07T09:00:00.000Z"));
    panel = aufbauen({
      checkText: erstAundBDannNurB(NICHT_BELASTBAR_TEIL),
      frist: IN_EINER_STUNDE(),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    const zeitDesBefunds = minuteJetzt();
    expect(panel.text("#ka7-stand")).toContain(zeitDesBefunds);
    expect(zeilenKennungen()).toEqual(["regel-1", "regel-2"]);

    // Drei Wiederholungen, jede in einer ANDEREN Minute als der Befund und als die vorige.
    const minuten: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      vi.setSystemTime(new Date(Date.now() + 61_000 + i * 1_000));
      minuten.push(minuteJetzt());
      await pruefenKlicken(panel);
      const a = panel.q('#ka7-liste li[data-quelle="regel-1"]');
      expect(a?.getAttribute("data-vorbehalt"), `Wiederholung ${i + 1}`).toBe("1");
      // DAS ist die Probe: die Zeile nennt die Zeit des ERSTEN Befunds, nicht die dieses Versuchs.
      expect(a?.textContent, `Wiederholung ${i + 1}`).toContain(`Befund von ${zeitDesBefunds}`);
      expect(a?.textContent, `Wiederholung ${i + 1}`).not.toContain(`Befund von ${minuten[i]}`);
      expect(
        panel.q('#ka7-liste li[data-quelle="regel-2"]')?.getAttribute("data-vorbehalt"),
      ).toBeNull();
    }
    expect(checkTextRufe(panel)).toHaveLength(4);
    // Drei wirklich verschiedene Minuten, alle verschieden von der Befundminute.
    expect(new Set([...minuten, zeitDesBefunds]).size).toBe(4);

    // Der Einreichhinweis am Entwurf nennt dieselbe ursprüngliche Zeit — DE …
    panel.setTab("capture");
    await panel.flush();
    expect(panel.text("#ka7-einreich-hinweis")).toContain(
      `Nicht aufgefrischt: „Homeoffice-Regelung“ (Befund von ${zeitDesBefunds})`,
    );
    // … und EN (Codex R7: „Der Originalstand muss einschließlich englischem Einreichhinweis grün
    // bleiben" — die Übersetzung darf die Zeit nicht auf den letzten Versuch kippen).
    await spracheWechseln(panel, "en");
    expect(panel.text("#ka7-einreich-hinweis")).toContain(
      `Not refreshed: “Homeoffice-Regelung” (finding from ${zeitDesBefunds})`,
    );
    expect(panel.q('#ka7-liste li[data-quelle="regel-1"]')?.textContent).toContain(
      `Finding from ${zeitDesBefunds}`,
    );
    for (const minute of minuten) {
      expect(panel.text("#ka7-einreich-hinweis")).not.toContain(`finding from ${minute}`);
    }
  });

  it("P17 · Entwurf wiederöffnen: der Befund ist fort — der Entwurf sagt es und bietet den Weg zur Prüfung (DE/EN)", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    await pruefenKlicken(panel);
    panel.setTab("capture");
    await panel.flush();
    expect(panel.text("#ka7-einreich-hinweis")).toContain("trotzdem einreichen");

    // Fenster zu, Fenster auf: eine NEUE Panelinstanz auf DERSELBEN Markierung. Der Befund lebte
    // nur im Arbeitsspeicher (taskpane.html: kein localStorage, kein sessionStorage) — er ist fort.
    panel.restore();
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    panel.setTab("capture");
    await panel.flush();
    expect(panel.q("#ka7-liste li")).toBeNull();
    // Nicht Leere, nicht „keine Abweichung": der Prüfstand dieses Entwurfs — als kurze
    // BESCHRIFTUNG unter 40 Zeichen (Runde 3, JOB 3057 K2 §5.7), nicht als Satz.
    const hinweis = panel.q("#ka7-einreich-hinweis");
    expect(hinweis?.className).not.toContain("hidden");
    expect(panel.text("#ka7-einreich-hinweis")).toBe("Keine frische Prüfung");
    expect(panel.text("#ka7-einreich-hinweis").length).toBeLessThanOrEqual(GRENZE_K2);
    // Und ein erreichbarer Weg, sie zu starten — derselbe Aufruf wie der Knopf im Fragen-Reiter.
    const knopf = panel.q("#ka7-einreich-pruefen");
    expect(knopf, "der Weg zur Prüfung fehlt am Entwurf").not.toBeNull();
    expect(knopf?.className).not.toContain("hidden");
    expect(knopf?.textContent).toBe("Jetzt gegen die Regelungen prüfen");
    await spracheWechseln(panel, "en");
    expect(panel.text("#ka7-einreich-hinweis")).toBe("No fresh check");
    expect(panel.q("#ka7-einreich-pruefen")?.textContent).toBe("Check against the rules now");
    await spracheWechseln(panel, "de");

    // Der Weg trägt: ein Klick startet die Prüfung, der Befund steht danach wieder am Entwurf.
    knopf?.click();
    await panel.flush();
    expect(checkTextRufe(panel)).toHaveLength(1);
    expect(panel.text("#ka7-einreich-hinweis")).toContain("Homeoffice-Regelung");
    expect(panel.text("#ka7-einreich-hinweis")).toContain("trotzdem einreichen");
    expect(panel.q("#ka7-einreich-pruefen")?.className).toContain("hidden");
  });

  it("P17b · nach belastbar leerem Lauf trägt der Entwurf „Kein Widerspruch · HH:MM“ — die einzige belegte Verneinung, mit Uhrzeit", async () => {
    panel = aufbauen({
      checkText: reply(200, antwort([], { gelaufen: true, grund: null, kandidaten: 2 })),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    panel.setTab("capture");
    await panel.flush();
    const hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toMatch(/^Kein Widerspruch · \d{2}:\d{2}$/);
    expect(hinweis.length).toBeLessThanOrEqual(GRENZE_K2);
    // Kein Weg mehr nötig: es liegt ein frischer Lauf vor.
    expect(panel.q("#ka7-einreich-pruefen")?.className ?? "hidden").toContain("hidden");
    // Der ausführliche Satz steht auf der Karte — genau einmal, mit Uhrzeit.
    expect(panel.text("#ka7-satz")).toContain("Keine Abweichung zu geprüften Quellen gefunden");
    await spracheWechseln(panel, "en");
    expect(panel.text("#ka7-einreich-hinweis")).toMatch(/^No contradiction · \d{2}:\d{2}$/);
  });

  // ==============================================================================================
  // Runde 5 (BEN R4, Korrekturpflicht 1). „Kein Widerspruch" ist eine SACHAUSSAGE über den
  // Bestand — sie braucht mindestens eine vorgelegte Quelle. Die Route liefert auch bei null
  // Kandidaten `gelaufen: true` (check-text-routes.ts: der Lauf FAND nur nichts zu vergleichen);
  // die Karte unterschied das seit JOB 3094 (ka7LeerOhneQuelle, taskpane.html:11176), der
  // Kurzstatus am Entwurf nicht — er machte aus „nichts zu vergleichen" eine Entwarnung.
  // ==============================================================================================
  it("P17f · null vorgelegte Quellen: der Entwurf sagt „Keine Vergleichsquelle · HH:MM“ — keine Entwarnung, auf Karte UND Entwurf, DE und EN", async () => {
    panel = aufbauen({
      checkText: reply(200, antwort([], { gelaufen: true, grund: null, kandidaten: 0 })),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    // Die Karte sagt es seit JOB 3094 — unverändert.
    expect(panel.text("#ka7-satz")).toContain("Kein vergleichbarer Eintrag im Bestand gefunden");
    panel.setTab("capture");
    await panel.flush();
    const hinweis = panel.text("#ka7-einreich-hinweis");
    expect(hinweis).toMatch(/^Keine Vergleichsquelle · \d{2}:\d{2}$/);
    expect(hinweis.length).toBeLessThanOrEqual(GRENZE_K2);
    // Die Verneinung darf nirgends stehen: kein vorgelegter Eintrag belegt sie.
    expect(hinweis).not.toContain("Kein Widerspruch");
    await spracheWechseln(panel, "en");
    const en = panel.text("#ka7-einreich-hinweis");
    expect(en).toMatch(/^No comparable source · \d{2}:\d{2}$/);
    expect(en.length).toBeLessThanOrEqual(GRENZE_K2);
    expect(en).not.toContain("No contradiction");
    await spracheWechseln(panel, "de");
  });

  it("P17g · gekürzte Markierung: der Kurzstatus trägt den eingeschränkten Prüfumfang mit — nicht „Kein Widerspruch“ für den ganzen Text", async () => {
    // Über der Grenze der Route (W6_HOECHSTZEICHEN = 8000): nur der Anfang ging in den Abgleich.
    const lang = `${MEMO} `.repeat(200);
    expect(lang.length).toBeGreaterThan(8000);
    panel = aufbauen({
      selection: lang,
      checkText: reply(200, antwort([], { gelaufen: true, grund: null, kandidaten: 2 })),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain(
      "Keine Abweichung in den ersten 8000 Zeichen gefunden",
    );
    panel.setTab("capture");
    await panel.flush();
    const hinweis = panel.text("#ka7-einreich-hinweis");
    // Runde 6: „Teilabgleich", nicht „Teil geprüft" — das Wort „geprüft" gehört auf der Word-Fläche
    // dem Einstufungshinweis (tests/i18n/mega35-word-wortliste.test.ts). Der Block hat ein eigenes
    // Wort für seinen Vorgang: „Abgleich" (ka7Label „Abgleich mit der Regelung").
    expect(hinweis).toMatch(/^Teilabgleich · kein Widerspruch · \d{2}:\d{2}$/);
    expect(hinweis).not.toMatch(/gepr(ue|ü)ft/i);
    expect(hinweis.length).toBeLessThanOrEqual(GRENZE_K2);
    await spracheWechseln(panel, "en");
    const en = panel.text("#ka7-einreich-hinweis");
    expect(en).toMatch(/^Part checked · no contradiction · \d{2}:\d{2}$/);
    expect(en.length).toBeLessThanOrEqual(GRENZE_K2);
    await spracheWechseln(panel, "de");
  });

  // ==============================================================================================
  // Runde 3 (BEN R2, Korrekturpflicht 1). Runde 1 stellte einen 72-Zeichen-Satz auf die Fläche
  // „Erfassen“ (Pedis Textmesser rot); Runde 2 versteckte die Aussage, sobald die KI-Weiche zu war
  // — und nahm dem Entwurf damit genau die Auskunft, um die es geht. Jetzt: die kurze Beschriftung
  // steht IMMER (erlaubt, verweigert, noch ungeklärt), der lange Satz wohnt im „?“-Menü, und nur
  // der KNOPF hängt an der Weiche — ein Weg, den es nicht gibt, wird nicht versprochen.
  // ==============================================================================================
  it("P17c · der Prüfstand steht bei ERLAUBTER, VERWEIGERTER und NOCH UNGEKLÄRTER KI-Freigabe — kurz, DE und EN; nur der Knopf hängt an der Weiche", async () => {
    const lagen: { name: string; opt: Partial<Aufbau>; weg: boolean }[] = [
      { name: "erlaubt", opt: {}, weg: true },
      { name: "verweigert", opt: { granted: false }, weg: false },
      { name: "ungeklärt", opt: { aiStatus: reply(503, { error: "UNAVAILABLE" }) }, weg: false },
    ];
    for (const lage of lagen) {
      panel = aufbauen({ checkText: reply(200, antwort([konflikt()])), ...lage.opt });
      await panel.flush();
      panel.setTab("capture");
      await panel.flush();
      const el = panel.q("#ka7-einreich-hinweis");
      expect(el?.className, lage.name).not.toContain("hidden");
      expect(panel.text("#ka7-einreich-hinweis"), lage.name).toBe("Keine frische Prüfung");
      expect(panel.text("#ka7-einreich-hinweis").length, lage.name).toBeLessThanOrEqual(GRENZE_K2);
      await spracheWechseln(panel, "en");
      expect(panel.text("#ka7-einreich-hinweis"), lage.name).toBe("No fresh check");
      expect(panel.text("#ka7-einreich-hinweis").length, lage.name).toBeLessThanOrEqual(GRENZE_K2);
      await spracheWechseln(panel, "de");
      const knopf = panel.q("#ka7-einreich-pruefen")?.className ?? "hidden";
      if (lage.weg) {
        expect(knopf, lage.name).not.toContain("hidden");
      } else {
        // Ohne offene Weiche gäbe es nichts zu starten — die Karte im Fragen-Reiter sagt, was fehlt.
        expect(knopf, lage.name).toContain("hidden");
      }
      // Erst zur Ruhe kommen lassen, dann abbauen: ein Abruf, der nach dem Abbau zurückkommt,
      // fände sein DOM nicht mehr (s. `spracheWechseln`).
      await panel.flush();
      panel.restore();
      panel = null;
    }
  });

  // JOB 3506 K2b (10.09.2026): der Ort der Erklärtexte der Erfassen-Fläche ist weitergezogen. Das
  // „?“-Menü IN der Fläche (#capture-mehr) ist entfallen — Pedis Mockup zeigt dort keinen
  // Erklärknopf; die vier Sätze von JOB 3057 und dieser KA7-Satz stehen jetzt hinter dem Zahnrad,
  // in der Einstellungsgruppe #einst-erfassen. Der Maßstab dieses Falls ist unverändert: der lange
  // Satz steht dort und auf der Fläche nie; die Fläche trägt nur die kurze Beschriftung.
  it("P17d · der LANGE Satz wohnt hinter dem Zahnrad — dort steht er, auf der Fläche nie (DE/EN/NL)", async () => {
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    panel.setTab("capture");
    await panel.flush();
    // Er hängt in der Einstellungsgruppe, nicht an der Markierungskarte.
    const imMenue = panel.q("#einst-erfassen #ka7-mehr-hinweis");
    expect(imMenue, "der Erklärtext fehlt hinter dem Zahnrad").not.toBeNull();
    expect(panel.q("#section-capture #ka7-mehr-hinweis"), "er steht in der Fläche").toBeNull();
    for (const sprache of ["de", "en", "nl"] as const) {
      await spracheWechseln(panel, sprache);
      const lang = panel.text("#ka7-mehr-hinweis");
      expect(lang.length, sprache).toBeGreaterThan(GRENZE_K2);
      expect(lang, sprache).toBe(panel.t("ka7EntwurfMenuText"));
      // Und auf der Fläche selbst steht davon nichts.
      expect(panel.text("#ka7-einreich-hinweis").length, sprache).toBeLessThanOrEqual(GRENZE_K2);
    }
    await spracheWechseln(panel, "de");
    // Die Einstellungen sind zu, solange niemand aufs Zahnrad tippt — der Erklärtext steht nicht
    // im Sichtfeld der Erfassen-Fläche. Ein Tipp aufs Zahnrad bringt ihn.
    expect(panel.q("#kw-einstellungen")?.className).toContain("hidden");
    expect(panel.q("#capture-mehr-btn"), "das „?“ in der Fläche lebt weiter").toBeNull();
    panel.q("#kw-zahnrad")?.click();
    expect(panel.q("#kw-einstellungen")?.className).not.toContain("hidden");
    expect(panel.text("#ka7-mehr-hinweis")).toContain("Keine frische Prüfung");
  });

  it("P17e · jede kurze Beschriftung dieses Auftrags bleibt in DE, EN und NL unter der K2-Grenze — und hält die Wortliste der Word-Fläche", async () => {
    // Runde 6 (Tor R5): die Kurzstatus stehen auf der Word-Fläche und unterliegen damit AUCH dem
    // Wortlistenvertrag aus tests/i18n/mega35-word-wortliste.test.ts — „geprüft"/„gesichert",
    // „verified"/„assured", „gecontroleerd"/„gewaarborgd" gehören dem Einstufungshinweis. Der
    // globale Wächter dort fängt jeden neuen Schlüssel; hier steht die Regel neben den Sätzen, die
    // sie betrifft, damit die nächste Runde sie nicht erst im Tor findet.
    const VERBOTEN = [
      /gepr(ue|ü)ft/i,
      /gesichert/i,
      /verified/i,
      /assured/i,
      /gecontroleerd/i,
      /gewaarborgd/i,
    ];
    panel = aufbauen({ checkText: reply(200, antwort([konflikt()])) });
    await panel.flush();
    for (const sprache of ["de", "en", "nl"] as const) {
      await spracheWechseln(panel, sprache);
      const kurz: string[] = [];
      for (const key of ["ka7EntwurfOhnePruefung", "ka7EntwurfLaeuft", "ka7EntwurfPruefenCta"]) {
        expect(panel.t(key).length, `${sprache}.${key}`).toBeLessThanOrEqual(GRENZE_K2);
        kurz.push(panel.t(key));
      }
      for (const key of [
        "ka7EntwurfOhneWiderspruch",
        // Runde 5 (BEN R4): die beiden Kurzstatus, die den Prüfumfang ehrlich halten.
        "ka7EntwurfOhneQuelle",
        "ka7EntwurfOhneWiderspruchTeil",
      ]) {
        expect(panel.t(key, { zeit: "14:32" }).length, `${sprache}.${key}`).toBeLessThanOrEqual(
          GRENZE_K2,
        );
        kurz.push(panel.t(key, { zeit: "14:32" }));
      }
      for (const satz of kurz) {
        for (const muster of VERBOTEN) {
          expect(muster.test(satz), `${sprache}: „${satz}" gegen ${muster.source}`).toBe(false);
        }
      }
    }
    panel.setLang("de");
  });
});

// ================================================================================================
// P18 · DOPPELUNG IST KEINE ABWEICHUNG.
// ================================================================================================
// Die Route führt zwei Listen: `conflicts` (Trefferverhältnis in `type`, ConflictType) und
// `duplicates` (Doppelungen, Verhältnis in `relation`). Bis JOB 3174 las das Panel nur `conflicts`
// und legte JEDEN Eintrag unter das Wort „Abweichung".
const DOPPELUNG = {
  koId: "regel-9",
  koTitle: "Urlaubsregelung",
  relation: "identisch",
  confidence: 0.9,
  method: "deterministic",
  rationale: null,
  koStatus: "validiert",
  koCategory: "Personal",
  pruefstand: "validiert",
  version: 2,
};

function antwortMit(
  duplicates: unknown[],
  conflicts: unknown[],
  konfliktpruefung: unknown = { gelaufen: true, grund: null, kandidaten: 1 },
) {
  return { duplicates, conflicts, answer: null, note: null, persisted: false, konfliktpruefung };
}

describe("KA7 · JOB 3174 — Doppelung und Konflikt sind zwei Aussagen", () => {
  it("P18 · ein Treffer, den die Route als Doppelung kennzeichnet, erzeugt KEINE Abweichung — er heißt „Das gibt es schon“", async () => {
    // Ein Eintrag in `conflicts` mit dem Verhältnis einer Doppelung (services/conflicts/src/
    // detect.ts:158-160: das Urteil nennt sie `doppelung`, der geplante eigene Typ `duplicate`).
    panel = aufbauen({
      checkText: reply(
        200,
        antwortMit(
          [],
          [{ ...konflikt(), koId: "regel-9", koTitle: "Urlaubsregelung", type: "doppelung" }],
        ),
      ),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    const satz = panel.text("#ka7-satz");
    expect(satz).not.toContain("Abweichung gefunden");
    expect(satz).not.toContain("widerspricht");
    expect(panel.q("#ka7-liste li")).toBeNull();
    expect(panel.text("#ka7-doppelung-satz")).toContain("Das gibt es schon");
    const zeile = panel.q('#ka7-doppelung-liste li[data-quelle="regel-9"]');
    expect(zeile, "die Doppelung fehlt in der Doppelungsliste").not.toBeNull();
    expect(zeile?.textContent).toContain("Urlaubsregelung");
    expect(zeile?.getAttribute("data-konflikt")).toBeNull();
  });

  it("P18b · die eigene Doppelungsliste der Route wird gelesen — Titel, Version, Prüfstand und Beziehung, DE und EN", async () => {
    panel = aufbauen({ checkText: reply(200, antwortMit([DOPPELUNG], [])) });
    await panel.flush();
    await pruefenKlicken(panel);
    // Der Leersatz bleibt richtig: eine Doppelung IST keine Abweichung.
    expect(panel.text("#ka7-satz")).toContain("Keine Abweichung zu geprüften Quellen gefunden");
    expect(panel.q("#ka7-liste li")).toBeNull();
    expect(panel.text("#ka7-doppelung-satz")).toBe(
      "Das gibt es schon — der Bestand führt dazu bereits einen Eintrag:",
    );
    const zeile = panel.q('#ka7-doppelung-liste li[data-quelle="regel-9"]');
    expect(zeile?.textContent).toContain("Urlaubsregelung");
    expect(zeile?.textContent).toContain("Version 2");
    expect(zeile?.textContent).toContain("Validiert");
    // Die Beziehung im Wortlaut der Erfassen-Fläche (W6_RELATION_KEYS) — kein zweiter Wortlaut.
    expect(zeile?.textContent).toContain(panel.t("captureDubIdentisch"));
    expect(panel.q("#ka7-doppelung-liste li a")?.href).toContain("regel-9");
    await spracheWechseln(panel, "en");
    expect(panel.text("#ka7-doppelung-satz")).toBe(
      "This already exists — the knowledge base already holds one entry on it:",
    );
    expect(panel.q('#ka7-doppelung-liste li[data-quelle="regel-9"]')?.textContent).toContain(
      "Validated",
    );
  });

  it("P18c · ein Treffer, der BEIDES ist, wird als beides genannt — in beiden Listen, mit Querverweis", async () => {
    panel = aufbauen({
      checkText: reply(
        200,
        antwortMit(
          [{ ...DOPPELUNG, koId: "regel-1", koTitle: "Homeoffice-Regelung" }],
          [konflikt()],
        ),
      ),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Abweichung gefunden");
    const alsKonflikt = panel.q('#ka7-liste li[data-quelle="regel-1"]');
    expect(alsKonflikt?.getAttribute("data-doppelung")).toBe("1");
    expect(alsKonflikt?.textContent).toContain("bei den Doppelungen");
    const alsDoppelung = panel.q('#ka7-doppelung-liste li[data-quelle="regel-1"]');
    expect(alsDoppelung, "der Treffer fehlt in der Doppelungsliste").not.toBeNull();
    expect(alsDoppelung?.getAttribute("data-konflikt")).toBe("1");
    expect(alsDoppelung?.textContent).toContain("bei den Abweichungen");
  });

  it("P18d · fehlendes oder unbekanntes Trefferverhältnis: „Prüfung nicht möglich“ — nicht geraten, weder Abweichung noch Doppelung", async () => {
    // Ohne `type` sagt die Antwort nicht, WAS der Treffer ist.
    const ohneTyp: Record<string, unknown> = { ...konflikt() };
    delete ohneTyp.type;
    panel = aufbauen({ checkText: reply(200, antwortMit([], [ohneTyp])) });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    expect(panel.q("#ka7-liste li")).toBeNull();
    expect(panel.q("#ka7-doppelung-liste li")).toBeNull();
    panel.restore();

    // Ein Verhältnis, das dieses Panel nicht kennt, wird nicht in eine der beiden Aussagen gepresst.
    panel = aufbauen({
      checkText: reply(200, antwortMit([], [{ ...konflikt(), type: "was-auch-immer" }])),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    expect(panel.q("#ka7-liste li")).toBeNull();
    panel.restore();

    // Ein Körper ohne die Doppelungsliste ist keine Antwort dieser Route — kein Leersatz daraus.
    panel = aufbauen({
      checkText: reply(200, {
        conflicts: [],
        konfliktpruefung: { gelaufen: true, grund: null, kandidaten: 1 },
      }),
    });
    await panel.flush();
    await pruefenKlicken(panel);
    expect(panel.text("#ka7-satz")).toContain("Prüfung nicht möglich");
    expect(panel.text("#ka7-satz")).not.toContain("Keine Abweichung");
  });
});
