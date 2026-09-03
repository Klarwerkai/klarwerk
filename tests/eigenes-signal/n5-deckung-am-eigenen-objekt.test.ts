// ================================================================================================
// JOB 3032 (Pedis Zeile N5) — DAS SIGNAL SAGT, WIE WEIT DER LAUF REICHTE, DER ES FAND.
// ================================================================================================
//
// N5 verlangt drei Dinge: der Autor sieht DAUERHAFT, dass sein Beitrag kollidiert · OHNE fremden
// Inhalt zu sehen · MIT ehrlichem Satz, gegen wie viel geprueft wurde. Die ersten beiden standen
// (`services/app/src/duplicate-signal.ts`, `tests/ko/a28-signal-*.test.ts`). Das dritte hatte keine
// Datengrundlage: `EigenerBefund` trug drei Felder, keine Zahl und keine Lage — ein ehrlicher Satz
// haette also behauptet werden muessen.
//
// Diese Datei ist der Vertrag der SERVERHAELFTE. Sie prueft NICHT, dass ein Mensch etwas sieht —
// der Satz und seine Anzeige sind die zweite Haelfte (apps/web, gesperrt). Sie prueft, dass die
// Daten den Satz TRAGEN: vier unterscheidbare Lagen, zwei rohe Zahlen, `null` nie als `0`, und
// dieselbe Vollstaendigkeitsregel wie der Rest des Hauses.
//
// Jeder Fall traegt seine GEGENPROBE im Kommentar: was man im Produkt verstellen muss, damit genau
// dieser Fall rot wird. Ein Test, der eine gezielte Verstellung nicht bemerkt, zaehlt nicht.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import {
  type BefundPaar,
  type Deckung,
  type EigenerBefund,
  eigeneBefunde,
} from "../../services/app/src/duplicate-signal";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  type EigenesKoFaktum,
  conflictRoutes,
  deckungAus,
} from "../../services/app/src/routes/conflicts-routes";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
} from "../../services/conflicts";
import type { AiCheck, AiCheckCoverage } from "../../services/knowledge-object";

// ------------------------------------------------------------------------------------------------
// Aufbau
// ------------------------------------------------------------------------------------------------

const AUTORIN: SessionUser = { id: "u-autorin", role: "experte" };

const paar = (koA: string, koB: string): BefundPaar => ({ koA, koB });

/**
 * Ein Abdeckungsprotokoll. Die Vorgabe ist der GEDECKELTE Lauf aus dem Ehrlichkeitsvertrag
 * (conflicts/src/coverage.ts:5-9): „gegen 20 von 12.479 geprueft".
 */
function protokoll(over: Partial<AiCheckCoverage> = {}): AiCheckCoverage {
  return {
    available: 12479,
    selected: 20,
    alreadyOpen: 0,
    attempted: 20,
    completed: 20,
    skipped: 0,
    capped: true,
    aborted: false,
    ...over,
  };
}

/** Ein Protokoll, das die kanonische Invariante ERFUELLT: alles angesehen, alles geurteilt. */
function vollstaendigesProtokoll(over: Partial<AiCheckCoverage> = {}): AiCheckCoverage {
  return protokoll({
    available: 7,
    selected: 7,
    attempted: 7,
    completed: 7,
    skipped: 0,
    capped: false,
    aborted: false,
    ...over,
  });
}

function ko(id: string, aiCheck?: AiCheck, author: string = AUTORIN.id): EigenesKoFaktum {
  return { id, author, confidentiality: "intern", ...(aiCheck ? { aiCheck } : {}) };
}

/**
 * Der PRODUKTWEG, ohne HTTP: die Route leitet die Lage je eigenem Objekt ab (`deckungAus`) und
 * reicht sie dem Kern herein (`eigeneBefunde`). Genau diese zwei Schritte stehen in
 * `conflicts-routes.ts` — der Fall F9 misst danach denselben Weg noch einmal am echten
 * Antwortkoerper.
 */
function signal(
  bestand: readonly EigenesKoFaktum[],
  offeneDubletten: readonly BefundPaar[],
  offeneKonflikte: readonly BefundPaar[] = [],
): EigenerBefund[] {
  const deckungJeKo = new Map<string, Deckung>(bestand.map((k) => [k.id, deckungAus(k)]));
  return eigeneBefunde(
    bestand.map((k) => k.id),
    offeneDubletten,
    offeneKonflikte,
    deckungJeKo,
  );
}

/** Die Deckung genau eines eigenen Objekts, ueber den vollen Weg geholt. */
function deckungVon(bestand: readonly EigenesKoFaktum[], koId: string): Deckung | undefined {
  return signal(bestand, [paar(koId, "ko-fremd-9")]).find((b) => b.koId === koId)?.deckung;
}

// ------------------------------------------------------------------------------------------------
// F1–F3 · die drei Lagen, die KEINE Zahl haben duerfen
// ------------------------------------------------------------------------------------------------

describe("N5 · die vier Lagen entstehen aus dem Objekt, nicht aus einer Annahme", () => {
  it("F1 · kein Pruefvermerk → `kein_lauf`, und beide Zahlen sind `null`", () => {
    // GEGENPROBE: in `lageAus` (conflicts-routes.ts) den ersten Zweig auf `"ohne_protokoll"`
    // zurueckfallen lassen → F1 rot. „Ueber dieses Objekt sagt kein Lauf etwas" ist die EINZIGE
    // Lage, in der „gar kein Lauf" woertlich stimmt (knowledge-object/src/types.ts:59-60).
    expect(deckungVon([ko("ko-mein-1")], "ko-mein-1")).toEqual({
      lage: "kein_lauf",
      geprueft: null,
      bestand: null,
    });
  });

  it("F2 · ein laufender oder gescheiterter Lauf ist `unvollstaendig`", () => {
    // GEGENPROBE: die Status-Bedingung `aiCheck.status !== "done"` in `lageAus` entfernen → F2 rot
    // (beide Faelle fielen dann auf `ohne_protokoll`). Genau diese Bedingung fehlte bis mega31 in
    // der Bestandsauswertung, und ein `failed`-Lauf galt als vollstaendig (bens ROT-2).
    const laeuft = ko("ko-mein-1", { status: "pending", requestedAt: "2026-09-03T10:00:00.000Z" });
    const gescheitert = ko("ko-mein-1", {
      status: "failed",
      requestedAt: "2026-09-03T10:00:00.000Z",
      fallbackReason: "no-model",
    });

    expect(deckungVon([laeuft], "ko-mein-1")).toEqual({
      lage: "unvollstaendig",
      geprueft: null,
      bestand: null,
    });
    expect(deckungVon([gescheitert], "ko-mein-1")).toEqual({
      lage: "unvollstaendig",
      geprueft: null,
      bestand: null,
    });
  });

  it("F3 · abgeschlossen OHNE Protokoll ist `ohne_protokoll` — nicht `kein_lauf`", () => {
    // GEGENPROBE: `ohne_protokoll` und `kein_lauf` zu EINEM Wert zusammenlegen → F1 oder F3 rot.
    // Die beiden Aussagen duerfen nicht in einen Wert fallen (types.ts:62-65): hier ist ein Lauf
    // NACHWEISBAR, nur seine Reichweite nicht. Dort sagt gar kein Lauf etwas.
    const altbestand = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      finishedAt: "2026-09-03T10:00:01.000Z",
    });

    expect(deckungVon([altbestand], "ko-mein-1")).toEqual({
      lage: "ohne_protokoll",
      geprueft: null,
      bestand: null,
    });
    // Und der Unterschied zu F1 ist wirklich einer, nicht nur eine andere Schreibweise:
    expect(deckungVon([altbestand], "ko-mein-1")?.lage).not.toBe(
      deckungVon([ko("ko-mein-1")], "ko-mein-1")?.lage,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// F4–F6 · die Zahlen, und woran ein gedeckelter Lauf erkennbar bleibt
// ------------------------------------------------------------------------------------------------

describe("N5 · gedeckelt sieht nie aus wie vollstaendig, und `null` ist nie `0`", () => {
  it("F4 · `done` mit gedeckeltem Protokoll → `unvollstaendig`, mit beiden echten Zahlen", () => {
    // Der Fall, um den es Pedi geht: „gegen 20 von 12.479 geprueft" darf nicht als „geprueft"
    // durchgehen. GEGENPROBE A: `capped: false` setzen — derselbe Fall wird `vollstaendig` (unten
    // gemessen). GEGENPROBE B: in `lageAus` `isCompleteRun(...)` durch ein festes `true` ersetzen
    // → F4 rot.
    const gedeckelt = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: protokoll(),
    });

    expect(deckungVon([gedeckelt], "ko-mein-1")).toEqual({
      lage: "unvollstaendig",
      geprueft: 20,
      bestand: 12479,
    });

    // GEGENPROBE A, ausgefuehrt: dieselben Zahlen, nur der Merker faellt weg. Ohne den Aufruf der
    // kanonischen Regel koennte dieser Unterschied gar nicht entstehen.
    const ohneDeckel = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: protokoll({ selected: 12479, attempted: 12479, completed: 12479, capped: false }),
    });
    expect(deckungVon([ohneDeckel], "ko-mein-1")?.lage).toBe("vollstaendig");
  });

  it("F5 · ein belegt vollstaendiger Lauf ist `vollstaendig` — bis eine Bedingung kippt", () => {
    // GEGENPROBE: `skipped: 1` — derselbe Fall kippt auf `unvollstaendig`. Ein Urteilsausfall ist
    // eine Luecke, auch wenn kein Merker gesetzt ist (mega32 A1: die ZAHLEN tragen die Beweislast).
    const vollstaendig = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: vollstaendigesProtokoll(),
    });
    expect(deckungVon([vollstaendig], "ko-mein-1")).toEqual({
      lage: "vollstaendig",
      geprueft: 7,
      bestand: 7,
    });

    const mitAusfall = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: vollstaendigesProtokoll({ completed: 6, skipped: 1 }),
    });
    expect(deckungVon([mitAusfall], "ko-mein-1")?.lage).toBe("unvollstaendig");
  });

  it('F6 · `null` heisst „keine Auskunft", `0` heisst „gegen null geprueft"', () => {
    // GEGENPROBE: in `deckungAus` `?? 0` statt `null` einsetzen → F6 rot. Die beiden duerfen nie
    // ineinander fallen: aus einem fehlenden Protokoll entstuende sonst die Zahl „0 von 0", die
    // niemand gemessen hat.
    const leererBestand = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: vollstaendigesProtokoll({
        available: 0,
        selected: 0,
        attempted: 0,
        completed: 0,
      }),
    });
    expect(deckungVon([leererBestand], "ko-mein-1")).toEqual({
      lage: "vollstaendig",
      geprueft: 0,
      bestand: 0,
    });

    const ohneProtokoll = deckungVon([ko("ko-mein-1")], "ko-mein-1");
    expect(ohneProtokoll?.geprueft).toBeNull();
    expect(ohneProtokoll?.bestand).toBeNull();
    // Und die beiden sind unterscheidbar, nicht nur verschieden geschrieben:
    expect(ohneProtokoll?.geprueft).not.toBe(0);
  });

  it("F6b · fehlt zu einer eigenen Kennung jede Lage, gilt `kein_lauf` — nicht Entwarnung", () => {
    // Fail-honest statt fail-optimistisch: der Kern erfindet keine Deckung, wenn der Aufrufer
    // keine hereinreicht. GEGENPROBE: in `markiere` (duplicate-signal.ts) den Rueckfall auf
    // `{ lage: "vollstaendig", … }` aendern → dieser Fall rot.
    const befunde = eigeneBefunde(
      ["ko-mein-1"],
      [paar("ko-mein-1", "ko-fremd-9")],
      [],
      new Map<string, Deckung>(),
    );
    expect(befunde[0]?.deckung).toEqual({ lage: "kein_lauf", geprueft: null, bestand: null });
  });
});

// ------------------------------------------------------------------------------------------------
// F7 · die Grenze aus A28 haelt: die Deckung gehoert dem EIGENEN Objekt
// ------------------------------------------------------------------------------------------------

describe("N5 · die Deckung ist eine Aussage ueber MEINEN Lauf, nie ueber ein fremdes Objekt", () => {
  it("F7 · die gesamte Ausgabe traegt keine Kennung und keine Zahl der Gegenseite", () => {
    // Aufbau wie G-2 in `duplicate-signal.test.ts:111`: die Ausgabe wird verschriftet und nach den
    // Merkmalen des Gegenueber-Objekts durchsucht. Dessen Protokoll traegt bewusst UNVERWECHSELBARE
    // Zahlen — steht eine davon in der Antwort, ist eine fremde Reichweite durchgereicht worden.
    //
    // Die Tabelle ist hier ABSICHTLICH breiter als noetig: sie traegt auch die Lage des fremden
    // Objekts. Genau so faellt auf, wenn der Kern die Lage nicht mehr unter der EIGENEN Kennung
    // nachschlaegt. GEGENPROBE: in `markiere` (duplicate-signal.ts) `deckungJeKo.get(koId)` durch
    // einen Zugriff ersetzen, der irgendeinen Eintrag der Tabelle nimmt → F7 rot.
    const meins = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: protokoll(),
    });
    const fremd = ko("ko-fremd-9", undefined, "u-anderer");
    const fremdMitLauf: EigenesKoFaktum = {
      ...fremd,
      aiCheck: {
        status: "done",
        requestedAt: "2026-09-03T10:00:00.000Z",
        coverage: protokoll({ available: 91771, completed: 44443 }),
      },
    };

    const deckungJeKo = new Map<string, Deckung>([
      ["ko-mein-1", deckungAus(meins)],
      ["ko-fremd-9", deckungAus(fremdMitLauf)],
    ]);
    const verschriftet = JSON.stringify(
      eigeneBefunde(["ko-mein-1"], [paar("ko-mein-1", fremd.id)], [], deckungJeKo),
    );

    // Kalibrierung: die fremden Zahlen sind wirklich unverwechselbar und stehen wirklich in der
    // hereingereichten Tabelle — sonst pruefte dieser Fall nichts.
    expect(JSON.stringify([...deckungJeKo.values()])).toContain("91771");
    expect(JSON.stringify([...deckungJeKo.values()])).toContain("44443");

    expect(verschriftet).not.toContain("ko-fremd-9");
    expect(verschriftet).not.toContain("91771");
    expect(verschriftet).not.toContain("44443");
    // Die eigenen Zahlen stehen sehr wohl drin — sonst waere der Fall trivial gruen.
    expect(verschriftet).toContain("12479");
  });

  it("F7b · ohne Befund kein Eintrag — die Deckung macht aus dem Signal keine Bestandsliste", () => {
    // G-3 bleibt unangetastet. Ein vollstaendig geprueftes eigenes Objekt ohne offenen Befund
    // erzeugt keinen Eintrag; die schweigende Flaeche bleibt bei `/api/ai-check/coverage-summary`.
    const geprueft = ko("ko-mein-1", {
      status: "done",
      requestedAt: "2026-09-03T10:00:00.000Z",
      coverage: vollstaendigesProtokoll(),
    });
    expect(signal([geprueft], [], [])).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// F8 · der Driftwaechter gegen die bestehende Bestandsauswertung
// ------------------------------------------------------------------------------------------------

// Der eigentliche Zweck dieses Auftrags ist NICHT „ein Feld mehr", sondern: es soll weiterhin genau
// EINEN Begriff von „vollstaendig geprueft" geben. Dieser Fall stellt die neue Ableitung und die
// bestehende Bestandsauswertung `aiCheckCoverageSummary` (knowledge-object/src/service.ts:2796)
// ueber DENSELBEN Bestand nebeneinander. Laufen sie auseinander, gibt es zwei Wahrheiten — und
// genau das ist die Fehlerklasse, die mega31/mega32 zweimal reparieren mussten.
describe("N5 · Driftwaechter: die Lage und die Bestandsauswertung sprechen dieselbe Regel", () => {
  const gesichert: Record<string, string | undefined> = {};

  beforeEach(() => {
    gesichert.KLARWERK_SKIP_KEYCHAIN = process.env.KLARWERK_SKIP_KEYCHAIN;
    process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  });

  afterEach(() => {
    if (gesichert.KLARWERK_SKIP_KEYCHAIN === undefined) {
      delete process.env.KLARWERK_SKIP_KEYCHAIN;
    } else {
      process.env.KLARWERK_SKIP_KEYCHAIN = gesichert.KLARWERK_SKIP_KEYCHAIN;
    }
  });

  async function ko3032(services: AppServices, titel: string) {
    return services.ko.create({
      title: titel,
      statement: `${titel} — Aussage zum Betrieb.`,
      type: "best_practice",
      category: "Betrieb",
      author: AUTORIN.id,
      confidentiality: "intern",
    });
  }

  it("F8 · neun Objekte ueber alle vier Lagen: die Zaehler decken sich exakt", async () => {
    // GEGENPROBE: eine der vier Regeln in `lageAus` verstellen (etwa Schritt 3 auf `kein_lauf`
    // oder Schritt 2 streichen) → F8 rot, weil die Zaehler auseinanderlaufen.
    const services = buildServices();

    // kein_lauf ↔ unchecked (2)
    await ko3032(services, "Nie geprueft A");
    await ko3032(services, "Nie geprueft B");
    // unvollstaendig ↔ incomplete (4): pending, failed, gedeckelt, mit Urteilsausfall
    const laeuft = await ko3032(services, "Laeuft noch");
    await services.ko.markAiCheckPending(laeuft.id);
    const gescheitert = await ko3032(services, "Gescheitert");
    await services.ko.recordAiCheckOutcome(gescheitert.id, {
      ok: false,
      fallbackReason: "model-error",
    });
    const gedeckelt = await ko3032(services, "Gedeckelt");
    await services.ko.recordAiCheckOutcome(gedeckelt.id, { ok: true, coverage: protokoll() });
    const ausfall = await ko3032(services, "Mit Urteilsausfall");
    await services.ko.recordAiCheckOutcome(ausfall.id, {
      ok: true,
      coverage: vollstaendigesProtokoll({ completed: 6, skipped: 1 }),
    });
    // ohne_protokoll ↔ noCoverage (1): abgeschlossen gemeldet, Altbestand ohne Protokoll
    const altbestand = await ko3032(services, "Altbestand ohne Protokoll");
    await services.ko.recordAiCheckOutcome(altbestand.id, { ok: true });
    // vollstaendig ↔ Rest (2)
    for (const titel of ["Belegt vollstaendig A", "Belegt vollstaendig B"]) {
      const objekt = await ko3032(services, titel);
      await services.ko.recordAiCheckOutcome(objekt.id, {
        ok: true,
        coverage: vollstaendigesProtokoll(),
      });
    }

    const bestand = await services.ko.list({});
    const summary = await services.ko.aiCheckCoverageSummary({ sichtbar: () => true });

    const zaehle = (lage: string) =>
      bestand.filter((objekt) => deckungAus(objekt).lage === lage).length;

    // Kalibrierung: der Satz belegt wirklich alle vier Lagen — sonst pruefte der Vergleich weniger,
    // als er behauptet.
    expect(summary.total).toBe(9);
    expect([
      zaehle("kein_lauf"),
      zaehle("unvollstaendig"),
      zaehle("ohne_protokoll"),
      zaehle("vollstaendig"),
    ]).toEqual([2, 4, 1, 2]);

    // Und jetzt der eigentliche Vergleich, Zaehler gegen Zaehler.
    expect(zaehle("kein_lauf")).toBe(summary.unchecked);
    expect(zaehle("unvollstaendig")).toBe(summary.incomplete);
    expect(zaehle("ohne_protokoll")).toBe(summary.noCoverage);
    expect(zaehle("vollstaendig")).toBe(
      summary.total - summary.unchecked - summary.incomplete - summary.noCoverage,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// F9 · der echte Antwortkoerper
// ------------------------------------------------------------------------------------------------

const guardsFuer = (user: SessionUser | undefined): Guards =>
  ({
    requireUser: async () => user,
    requirePermission: async (
      _p: unknown,
      _req: unknown,
      reply: { code: (n: number) => { send: (b: unknown) => void } },
    ) => {
      if (!user) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
        return undefined;
      }
      return user;
    },
  }) as unknown as Guards;

const OHNE_ZUGANG = { get: async () => undefined };

let offen: FastifyInstance[] = [];

afterEach(async () => {
  for (const instance of offen) {
    await instance.close();
  }
  offen = [];
});

describe("N5 · der Routenkoerper traegt die Deckung wirklich", () => {
  it("F9 · `GET /api/duplicate-signal` liefert `deckung` je Eintrag, mit den echten Zahlen", async () => {
    // GEGENPROBE: in `conflicts-routes.ts` die Tabelle nicht durchreichen (leere Map an
    // `eigeneBefunde`) → F9 rot, weil die Antwort auf `kein_lauf`/`null` faellt.
    const bestand: EigenesKoFaktum[] = [
      ko("ko-mein-1", {
        status: "done",
        requestedAt: "2026-09-03T10:00:00.000Z",
        coverage: protokoll(),
      }),
      ko("ko-fremd-9", undefined, "u-anderer"),
    ];

    const conflicts = new ConflictService({ repo: new InMemoryConflictRepo() });
    await conflicts.create({
      koA: "ko-mein-1",
      koB: "ko-fremd-9",
      type: "truth",
      description: "Testaufbau: widersprechende Angaben.",
    });
    const overlaps = new OverlapService({ repo: new InMemoryOverlapRepo() });

    const instance = Fastify();
    instance.register(
      conflictRoutes(conflicts, guardsFuer(AUTORIN), OHNE_ZUGANG as never, overlaps, {
        list: async () => bestand,
      }),
    );
    await instance.ready();
    offen.push(instance);

    const antwort = await instance.inject({ method: "GET", url: "/api/duplicate-signal" });

    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual([
      {
        koId: "ko-mein-1",
        dublette: false,
        konflikt: true,
        deckung: { lage: "unvollstaendig", geprueft: 20, bestand: 12479 },
      },
    ]);
  });
});
