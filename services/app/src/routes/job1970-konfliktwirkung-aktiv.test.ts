// ================================================================================================
// JOB 1970 — DIE KONFLIKTWIRKUNG IST AKTIV: die REALE buildApp-Komposition bis zur Antwort
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. `D1` hat die zwei Serverriegel in `check-text-routes.ts` gebaut und
// mit injizierten Deps belegt (`job1970-konfliktriegel.test.ts`, K1-K4). BEN hat das zu Recht als
// Scheinbeleg fuer die PRODUKTIONSVERDRAHTUNG zurueckgewiesen: eine Route, die einen von Hand
// hineingereichten Dienst verarbeitet, sagt nichts darueber, ob die ausgelieferte Anwendung ihn
// jemals hereinreicht. Diese Datei faehrt deshalb `buildApp(buildServices())` — dieselbe
// Kompositionswurzel wie der Server — und misst die WIRKUNG, nicht die Verdrahtung.
//
// DREI GLIEDER MUESSEN ZUSAMMEN STIMMEN, und `D2` hat dreistufig gemessen, dass keines reicht:
//   Stufe 0  nur die Riegel aus D1            -> assessAgainstPool:  0 Aufrufe · conflicts: []
//   Stufe 1  + Wurzelverdrahtung (build-app)  -> assessAgainstPool:  1 Aufruf  · conflicts: []
//   Stufe 2  + conflictJudge (diese Route)    -> assessAgainstPool:  1 Aufruf  · conflicts: [ … ]
// Der Grund fuer Stufe 1 steht im Kern: `services/conflicts/src/service.ts:481-483` gibt OHNE
// Judge sofort `[]` zurueck, bevor auch nur ein Kandidat betrachtet wird.
//
// GESTELLT IST NUR DAS MODELLURTEIL. Der Konfliktdienst ist der ECHTE aus der Wurzel; beobachtet
// wird er per Spion, ersetzt nicht. Kein Netz-, Datenbank- oder Modellaufruf.
//
// DIE GRENZE DES FALLS, offen benannt: er belegt den Weg `Wurzel -> Route -> Kern -> Antwort` fuer
// EINEN Befund. Er sagt NICHTS ueber die fachliche Guete echter Modellurteile — das waere ein
// anderer Gegenstand und ein anderer Fall.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../build-app";

const SAVED: Record<string, string | undefined> = {};
beforeEach(() => {
  SAVED.flag = process.env.KLARWERK_ADDON_API;
  // `/api/check-text` wird NUR bei aktivem Add-on-Flag registriert (build-app.ts:1326).
  // Der Name stammt aus addon-api.ts:7, der Wert "1" aus dem dortigen Kommentar :3 — kein
  // Umgebungswert wird gelesen.
  process.env.KLARWERK_ADDON_API = "1";
});
afterEach(() => {
  if (SAVED.flag === undefined) {
    delete process.env.KLARWERK_ADDON_API;
  } else {
    process.env.KLARWERK_ADDON_API = SAVED.flag;
  }
  vi.restoreAllMocks();
});

const KO_TITEL = "Chargenfreigabe im Leitstand";
const KO_SATZ = "Die Freigabe einer Charge erfolgt ausschliesslich im Vieraugenprinzip.";
const PRUEFTEXT = "Die Freigabe einer Charge erfolgt durch eine einzelne befugte Person.";

async function realeKompositionMitValidiertemKo() {
  const services = buildServices();
  const dienstSpion = vi.spyOn(services.conflicts, "assessAgainstPool");
  // bens Auflage 2/3: BEIDE Wege werden gezaehlt, nicht nur das Ergebnis. Eine leere Antwort
  // beweist nicht, dass der Dienst unberuehrt blieb — `assessAgainstPool` liefert ohne Judge
  // ohnehin `[]` (conflicts/src/service.ts:481-483). Erst die Aufrufzahl trennt „nicht gerufen"
  // von „gerufen und leer".
  // Das MODELLURTEIL wird gestellt — deterministisch, kein Netz. Die Zitate stammen woertlich aus
  // den uebergebenen Kerntexten, sonst verwirft `decideFromVerdict` sie als Halluzination
  // (`services/conflicts/src/detect.ts:205`, quotesVerbatim).
  const judgeSpion = vi
    .spyOn(services.reasoner, "judgeConflict")
    .mockImplementation(async (coreA: string, coreB: string) => ({
      relation: "widerspruch" as const,
      older: null,
      confidence: 0.92,
      begruendung: "Der geprüfte Text erlaubt die Freigabe allein.",
      zitat_a: (coreA.split("\n")[0] ?? "").trim(),
      zitat_b: (coreB.split("\n")[0] ?? "").trim(),
    }));
  vi.spyOn(services.reasoner, "judgeDuplicate").mockResolvedValue(null);

  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: KO_TITEL,
      statement: KO_SATZ,
      type: "best_practice",
      category: "Produktion",
      neededValidations: 1,
    },
  });
  const koId = ko.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  return { app, headers, koId, dienstSpion, judgeSpion };
}

async function pruefen(app: Awaited<ReturnType<typeof buildApp>>, headers: object, want?: string) {
  return app.inject({
    method: "POST",
    url: "/api/check-text",
    headers: headers as Record<string, string>,
    payload: {
      text: PRUEFTEXT,
      title: "Chargenfreigabe",
      ...(want !== undefined ? { want, source: "draft", confidentiality: "intern" } : {}),
    },
  });
}

describe("JOB 1970 · die Konfliktwirkung in der realen buildApp-Komposition", () => {
  it("W1 · want:deep → die ausgelieferte Anwendung liefert einen NICHTLEEREN Konfliktbefund", async () => {
    const { app, headers, koId, dienstSpion } = await realeKompositionMitValidiertemKo();

    const res = await pruefen(app, headers, "deep");
    const body = res.json();

    console.log("LAUFBELEG W1 · status:", res.statusCode);
    console.log("LAUFBELEG W1 · assessAgainstPool-Aufrufe:", dienstSpion.mock.calls.length);
    console.log("LAUFBELEG W1 · conflicts:", JSON.stringify(body.conflicts));

    expect(res.statusCode).toBe(200);
    // Der Kern wird ueber die ECHTE Wurzel erreicht — genau einmal, nicht mehrfach.
    expect(dienstSpion).toHaveBeenCalledTimes(1);
    // DIE WIRKUNG, nicht die Verdrahtung: der Befund steht in der HTTP-Antwort.
    expect(body.conflicts.length).toBeGreaterThan(0);
    expect(body.conflicts[0].koId).toBe(koId);
    expect(body.conflicts[0].type).toBe("truth");
    expect(body.conflicts[0].confidence).toBe(0.92);
    expect(body.conflicts[0].method).toBe("model");
    await app.close();
  });

  it("W2 · Stufe 1 (ohne want:deep) ruft den Konfliktdienst GAR NICHT — 0 und 0", async () => {
    const { app, headers, dienstSpion, judgeSpion } = await realeKompositionMitValidiertemKo();

    const res = await pruefen(app, headers);
    const body = res.json();

    console.log("LAUFBELEG W2 · conflicts:", JSON.stringify(body.conflicts));
    console.log("LAUFBELEG W2 · assessAgainstPool-Aufrufe:", dienstSpion.mock.calls.length);
    console.log("LAUFBELEG W2 · judgeConflict-Aufrufe:    ", judgeSpion.mock.calls.length);

    expect(res.statusCode).toBe(200);
    // bens Auflage 3: die Stufe-1-Frage ist ENTSCHIEDEN und steht als Zahl im Fall, nicht als
    // offener Rest. In D3 stand hier 1 ergebnisloser Aufruf; das ist zurueckgenommen.
    expect(dienstSpion, "Stufe 1 darf den Konfliktdienst nicht beruehren").toHaveBeenCalledTimes(0);
    expect(judgeSpion, "Stufe 1 ist modellfrei").toHaveBeenCalledTimes(0);
    // Die gesetzte Zusicherung `check-text-routes.test.ts:124` gilt unveraendert.
    expect(body.conflicts).toEqual([]);
    await app.close();
  });

  it("W3 · vertraulich + want:deep → Fail-safe haelt: 0 Dienstaufrufe, 0 Judge, kein Befund", async () => {
    const { app, headers, dienstSpion, judgeSpion } = await realeKompositionMitValidiertemKo();

    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: {
        text: PRUEFTEXT,
        title: "Chargenfreigabe",
        want: "deep",
        source: "draft",
        confidentiality: "vertraulich",
      },
    });
    const body = res.json();

    console.log("LAUFBELEG W3 · conflicts:", JSON.stringify(body.conflicts), "· note:", body.note);
    console.log("LAUFBELEG W3 · assessAgainstPool-Aufrufe:", dienstSpion.mock.calls.length);
    console.log("LAUFBELEG W3 · judgeConflict-Aufrufe:    ", judgeSpion.mock.calls.length);

    expect(res.statusCode).toBe(200);
    // bens Auflage 2, woertlich: „jeweils exakt 0 Aufrufe von reasoner.judgeConflict und
    // conflicts.assessAgainstPool sowie conflicts: []". Eine leere Antwort allein war ein
    // Scheinbeleg — der Dienst wurde in D3 sehr wohl gerufen, er lieferte nur nichts.
    expect(
      dienstSpion,
      "vertraulich: der Konfliktdienst darf nicht gerufen werden",
    ).toHaveBeenCalledTimes(0);
    expect(judgeSpion, "vertraulich: kein Cloud-Judge, kein Textabfluss").toHaveBeenCalledTimes(0);
    // `check-text-routes.ts:170-172`: deepAllowed = wantDeep && !confidential. Vertraulicher Text
    // erreicht den Cloud-Judge NIE — der neue conflictJudge aendert daran nichts, weil er IM
    // deepAllowed-Zweig steht. Ohne diesen Fall waere das eine Behauptung.
    expect(body.conflicts).toEqual([]);
    await app.close();
  });
});
