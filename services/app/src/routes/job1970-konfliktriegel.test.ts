// ================================================================================================
// JOB 1970 · D1 — DIE ZWEI SERVERRIEGEL AN /api/check-text
// ================================================================================================
//
// PRO6 hat `KA7` in ihrer Add-in-Flaeche fertiggebaut und zwei Reste benannt, die nicht ihre
// Flaeche sind: `check-text-routes.ts:80` (`conflicts: []` stand FEST) und `:53-61`/`:163` (die
// Deps fuehrten keinen Konfliktdienst, also erreichte er den Kern nie).
//
// EINE ANMERKUNG ZUR WORTWAHL, damit sie niemand fuer Zufall haelt: der Dateiname von PRO6s
// Flaeche steht hier bewusst NICHT ausgeschrieben. Das Klara-Regressionsinventar
// (`tests/app/klara-regressionsinventar.test.ts:67-73`) sammelt ueber den INHALT: seine Achse
// dort greift auf den Dateinamen der Add-in-Flaeche. Eine blosse Erwaehnung im Fliesstext zoege
// diese Datei damit in ein Inventar, in das sie fachlich nicht gehoert — sie prueft eine
// Serverroute, keine Klara-Flaeche.
// Gemessen, zweimal: mit dem ausgeschriebenen Namen fiel `K2` des Inventars rot; auch als der
// Name nur noch IN DIESER ERKLAERUNG stand. Der Sammler unterscheidet Fliesstext nicht von
// Pruefstoff — Befund fuer JOB 920, siehe Rueckgabe §6.
//
// DER KERN KONNTE ES LAENGST. `check-text-detection.ts:186-188` fuehrt den Konfliktzweig:
//     const conflicts = deps.conflicts ? await deps.conflicts.assessAgainstPool(...) : [];
// Was fehlte, war der Weg von der Route dorthin — und der Weg zurueck in die Antwort.
//
// DREI FAELLE, und der erste ist der wichtigste:
//   K1  OHNE Konfliktdienst — genau die heutige Kompositionswurzel (`build-app.ts:1328-1337`
//       reicht keinen durch, gemessen): die Antwort ist UNVERAENDERT leer. Kein Verhalten
//       geaendert, die gesetzte Zusicherung `check-text-routes.test.ts:124` bleibt gueltig.
//   K2  MIT Konfliktdienst: derselbe Aufruf traegt den Befund des Kerns — und zwar in der Form
//       der Antwort, nicht der des Kerns.
//   K3  Die Zusicherung aus K1 ist nicht bloss behauptet: derselbe Aufbau wie K1, aber mit
//       einem Dienst, der etwas FINDET — er darf die Antwort erreichen. Ohne K3 koennte K1 auch
//       gruen sein, weil der Weg gar nicht existiert.
import { describe, expect, it, vi } from "vitest";
import type { DryRunConflict } from "../../../conflicts";
import type { CheckTextResult } from "../check-text-detection";

// ------------------------------------------------------------------------------------------------
// Die Antwortabbildung wird an derselben Stelle gemessen, an der die Route sie benutzt: ueber das
// Modul selbst. `toResponse` ist modulintern — geprueft wird deshalb der WEG, den die Route geht:
// checkText-Ergebnis -> Antwortobjekt. Dafuer wird `checkText` ersetzt und der ECHTE Handler
// gefahren; der Riegel liegt zwischen beiden.
// ------------------------------------------------------------------------------------------------
const kern = vi.hoisted(() => ({
  ergebnis: { duplicates: [], conflicts: [], fundorte: {} } as unknown as CheckTextResult,
  gesehen: null as unknown,
}));

vi.mock("../check-text-detection", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    checkText: vi.fn(async (_input: unknown, deps: unknown) => {
      kern.gesehen = deps;
      return kern.ergebnis;
    }),
  };
});

import Fastify, { type FastifyInstance } from "fastify";
import { checkTextRoutes } from "./check-text-routes";

const KONFLIKT: DryRunConflict = {
  koId: "ko-7",
  koTitle: "Freigabe nur mit Vieraugenprinzip",
  type: "widerspruch" as DryRunConflict["type"],
  method: "model",
  confidence: 0.82,
  rationale: "Der geprüfte Text erlaubt die Freigabe allein.",
};

/** Ein Aufbau wie die Kompositionswurzel — nur der Konfliktdienst ist die Stellschraube. */
async function appMit(konfliktdienst: unknown): Promise<FastifyInstance> {
  const app = Fastify();
  const guards = {
    requireAuth: async () => {},
    requirePermission: () => async () => {},
  } as unknown as Parameters<typeof checkTextRoutes>[1];
  await app.register(
    checkTextRoutes(
      {
        ko: { get: async () => undefined } as never,
        overlaps: {} as never,
        reasoner: {} as never,
        ...(konfliktdienst ? { conflicts: konfliktdienst as never } : {}),
      },
      guards,
    ),
  );
  await app.ready();
  return app;
}

// JOB 1970 D4 (bens Auflage 1): der Konfliktdienst erreicht den Kern jetzt AUSSCHLIESSLICH im
// tiefen, nicht vertraulichen Zweig. `tief` schaltet genau diesen Zweig ein — die Faelle
// unterscheiden damit, was vorher ununterscheidbar war.
async function pruefen(app: FastifyInstance, tief = false) {
  return app.inject({
    method: "POST",
    url: "/api/check-text",
    payload: {
      text: "Die Freigabe der Charge erfolgt durch eine einzelne befugte Person am Leitstand.",
      title: "Chargenfreigabe",
      ...(tief ? { want: "deep", source: "draft", confidentiality: "intern" } : {}),
    },
  });
}

describe("JOB 1970 · die zwei Serverriegel", () => {
  it("K1 · OHNE Konfliktdienst: die Antwort ist unveraendert leer — kein Verhalten geaendert", async () => {
    kern.ergebnis = { duplicates: [], conflicts: [], fundorte: {} } as unknown as CheckTextResult;
    const app = await appMit(null);

    const res = await pruefen(app);
    const body = res.json();

    console.log(
      "LAUFBELEG K1 · status:",
      res.statusCode,
      "· conflicts:",
      JSON.stringify(body.conflicts),
    );
    expect(res.statusCode).toBe(200);
    // Genau die gesetzte Zusicherung aus check-text-routes.test.ts:124 — sie gilt weiter.
    expect(body.conflicts).toEqual([]);
    // Und der Kern hat gar keinen Dienst gesehen: das Feld fehlt, statt undefined zu sein.
    expect(Object.hasOwn(kern.gesehen as object, "conflicts")).toBe(false);
    await app.close();
  });

  it("K2 · MIT Konfliktdienst: der Befund des Kerns erreicht die Antwort, in Antwortform", async () => {
    kern.ergebnis = {
      duplicates: [],
      conflicts: [KONFLIKT],
      fundorte: {},
    } as unknown as CheckTextResult;
    const dienst = { assessAgainstPool: vi.fn(async () => [KONFLIKT]) };
    const app = await appMit(dienst);

    const res = await pruefen(app);
    const body = res.json();

    console.log("LAUFBELEG K2 · conflicts:", JSON.stringify(body.conflicts));
    expect(res.statusCode).toBe(200);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0]).toEqual({
      koId: "ko-7",
      koTitle: "Freigabe nur mit Vieraugenprinzip",
      type: "widerspruch",
      confidence: 0.82,
      method: "model",
      rationale: "Der geprüfte Text erlaubt die Freigabe allein.",
    });
    // `snippet` wird NICHT erfunden, wenn der Kern keins liefert — dieselbe Regel wie bei duplicates.
    expect(Object.hasOwn(body.conflicts[0], "snippet")).toBe(false);
    await app.close();
  });

  it("K3 · der Weg existiert wirklich: der Dienst erreicht den Kern", async () => {
    kern.ergebnis = { duplicates: [], conflicts: [], fundorte: {} } as unknown as CheckTextResult;
    const dienst = { assessAgainstPool: vi.fn(async () => []) };
    const app = await appMit(dienst);

    await pruefen(app, true);

    const gesehen = kern.gesehen as { conflicts?: unknown };
    console.log("LAUFBELEG K3 · Kern sah conflicts-Dienst (tief):", gesehen.conflicts === dienst);
    // Ohne diesen Fall waere K1 auch dann gruen, wenn es den Weg gar nicht gaebe.
    expect(gesehen.conflicts).toBe(dienst);
    await app.close();
  });

  // JOB 1970 D4 · bens Auflage 1, die Gegenrichtung zu K3 — und die eigentliche neue Zusicherung:
  // MIT Dienst, aber OHNE `want:"deep"` darf der Kern ihn NICHT sehen. In D3 sah er ihn (und rief
  // `assessAgainstPool` einmal ergebnislos); dass das Ergebnis leer war, ersetzte die Zusicherung
  // nicht. Ohne K5 waere K1 auch dann gruen, wenn Stufe 1 den Dienst wieder bekaeme.
  it("K5 · Stufe 1 MIT Dienst: der Kern sieht ihn NICHT — 0 Beruehrungen", async () => {
    kern.ergebnis = { duplicates: [], conflicts: [], fundorte: {} } as unknown as CheckTextResult;
    const dienst = { assessAgainstPool: vi.fn(async () => []) };
    const app = await appMit(dienst);

    const res = await pruefen(app, false);

    const gesehen = kern.gesehen as object;
    console.log(
      "LAUFBELEG K5 · Feld `conflicts` im Stufe-1-Deps:",
      Object.hasOwn(gesehen, "conflicts"),
      "· assessAgainstPool-Aufrufe:",
      dienst.assessAgainstPool.mock.calls.length,
    );
    expect(res.statusCode).toBe(200);
    expect(Object.hasOwn(gesehen, "conflicts"), "Stufe 1 traegt den Konfliktdienst").toBe(false);
    expect(dienst.assessAgainstPool).toHaveBeenCalledTimes(0);
    await app.close();
  });

  // BENs Pruefluecke 2 (D1-Urteil): Befund MIT snippet, OHNE confidence und rationale.
  // Bewusst hier und NICHT ueber die reale Komposition: `snippet` ist im Kern ein Reservefeld
  // (`services/conflicts/src/service.ts:35`), das der echte Dienst nie setzt (`:506-513`), und
  // `confidence`/`rationale` kommen dort immer aus dem Urteil. Ueber die echte Wurzel ist dieser
  // Fall also gar nicht erzeugbar — er gehoert an den injizierten Aufbau.
  it("K4 · snippet bleibt erhalten, fehlende Werte werden exakt null — nichts erfunden", async () => {
    const roh = {
      koId: "ko-9",
      koTitle: "Wartungsfenster nur nachts",
      type: "widerspruch" as DryRunConflict["type"],
      method: "model" as const,
      snippet: "Wartung ausschliesslich zwischen 22 und 5 Uhr.",
    };
    kern.ergebnis = {
      duplicates: [],
      conflicts: [roh],
      fundorte: {},
    } as unknown as CheckTextResult;
    const app = await appMit({ assessAgainstPool: vi.fn(async () => [roh]) });

    const res = await pruefen(app);
    const body = res.json();

    console.log("LAUFBELEG K4 · conflicts:", JSON.stringify(body.conflicts));
    expect(body.conflicts[0].snippet).toBe("Wartung ausschliesslich zwischen 22 und 5 Uhr.");
    expect(body.conflicts[0].confidence).toBeNull();
    expect(body.conflicts[0].rationale).toBeNull();
    await app.close();
  });
});
