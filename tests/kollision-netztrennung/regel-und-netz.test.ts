// ================================================================================================
// JOB 3084 (Q6) — DER RUHENDE FRISCHE ZWISCHENSPEICHER DARF OFFLINE KEINE ENTWARNUNG GEBEN.
// ================================================================================================
//
// DER GEMESSENE BEFUND (R-1585, Codex am 05.09.2026 gegen https://app.klarwerk.ai, 1.0.0-beta.1.92):
// „/wissen/… frisch laden; Netz trennen; Start; Browser zurück; 2s warten. navigator.onLine=false
// und echter /health-Abruf scheitert, dennoch ‚Keine offene Kollision an diesem Objekt‘ ohne
// Aktualitätshinweis. Zweimal reproduziert."
//
// WARUM DAS PASSIERTE — und warum es KEIN Denkfehler in der Regel von JOB 3025 war:
// `main.tsx:21` setzt `staleTime: 30_000`. Innerhalb dieser 30 Sekunden gilt ein vorhandener Stand
// als frisch, also wird beim Zurückkommen auf die Seite gar kein Abruf GEWOLLT. Damit ist
// `fetchStatus` `idle` — NICHT `paused`, denn `paused` entsteht nur an einem gewollten Abruf.
// `quellenlage()` sah `status: "success"`, `fetchStatus: "idle"`, `dataUpdatedAt > 0` und antwortete
// `frisch`; `bestandsaussageErlaubt` gab `true`; `schluss` setzte die Verneinung. Die zwei Sekunden
// des Befunds liegen innerhalb der 30 — Messung und Code sagen dasselbe.
//
// DIE ÄNDERUNG: der Onlinezustand wird ein EINGANG der Regel, und offline wirkt wie `paused`.
// Beides ist derselbe Sachverhalt („es kann gerade nicht geprüft werden"); dass TanStack Query den
// einen meldet und den anderen nicht, ist eine Eigenschaft seiner Frist, keine Aussage über den
// Bestand.
//
// DIESE DATEI IST DIE TABELLENPROBE — ohne Mount, ohne React, ohne DOM, aus demselben Grund wie
// `tests/ko/job3025-quellenlage.test.ts`: jede Kombination ist eine Zeile, und ein neuer Eingang der
// Regel muss hier eine Zeile bekommen, bevor er eine Fläche erreicht.
import { describe, expect, it } from "vitest";
import type {
  Conflict,
  Deckung,
  EigenerBefund,
  KnowledgeObject,
} from "../../apps/web/src/api/types";
import {
  LAGE_VON_SCHWACH_NACH_STARK,
  type Lage,
  type Quelle,
  type Quellenzustand,
  bestandsaussageErlaubt,
  eigeneKollisionDetail,
  eigeneKollisionStart,
  quellenlage,
} from "../../apps/web/src/lib/eigeneKollision";

// ------------------------------------------------------------------------------------------------
// Aufbau — derselbe wie in der Tabellenprobe von JOB 3025: der Vorgabewert ist die FRISCHE Lage,
// jeder Fall verstellt nur das, worum es ihm geht.
// ------------------------------------------------------------------------------------------------
function quelle<T>(over: Partial<Quellenzustand<T>> & { data?: T }): Quellenzustand<T> {
  return {
    status: "success",
    fetchStatus: "idle",
    isError: false,
    dataUpdatedAt: 1,
    data: undefined,
    ...over,
  };
}

const QUELLE_FUER: Record<Lage, Quellenzustand<never[]>> = {
  laedt: quelle<never[]>({ status: "pending", fetchStatus: "fetching" }),
  frisch: quelle<never[]>({ data: [] }),
  erstfehler: quelle<never[]>({ status: "error", isError: true, dataUpdatedAt: 0 }),
  auffrischung_laeuft: quelle<never[]>({ data: [], fetchStatus: "fetching" }),
  auffrischung_gescheitert: quelle<never[]>({ data: [], status: "error", isError: true }),
  pausiert: quelle<never[]>({ data: [], fetchStatus: "paused" }),
};

/**
 * DER FALL AUS DEM BEFUND, wörtlich: erfolgreich geladen, nichts offen, ein Zeitstempel liegt vor.
 * Das ist genau das, was TanStack Query nach „frisch laden, Netz trennen, zurückkommen" innerhalb
 * der `staleTime` meldet — kein `paused`, weil kein Abruf gewollt ist.
 */
const RUHEND_FRISCH = quelle<readonly string[]>({
  status: "success",
  fetchStatus: "idle",
  dataUpdatedAt: 1_757_000_000_000,
  data: [],
});

describe("JOB 3084 · quellenlage(): der Onlinezustand ist ein Eingang der Regel", () => {
  it("N-1 · DER BEFUND R-1585: ruhender frischer Stand + offline → pausiert, nicht frisch", () => {
    // Kalibrierung in derselben Zeile: online ergibt dieselbe Eingabe weiterhin `frisch`. Ohne diese
    // Gegenprüfung wäre N-1 auch dann grün, wenn `quellenlage` gar nichts mehr nach `frisch` ließe.
    expect(quellenlage(RUHEND_FRISCH, true)).toBe<Lage>("frisch");
    expect(quellenlage(RUHEND_FRISCH, false)).toBe<Lage>("pausiert");
  });

  it("N-2 · offline zieht ALLE sechs Lagen auf pausiert — offline wirkt wie `paused`", () => {
    for (const lage of LAGE_VON_SCHWACH_NACH_STARK) {
      expect(quellenlage(QUELLE_FUER[lage], false), `Lage ${lage} offline`).toBe<Lage>("pausiert");
    }
  });

  it("N-3 · online bleibt jede der sechs Lagen, was sie war (die Regel von JOB 3025 ist unberührt)", () => {
    for (const lage of LAGE_VON_SCHWACH_NACH_STARK) {
      expect(quellenlage(QUELLE_FUER[lage], true), `Lage ${lage} online`).toBe<Lage>(lage);
    }
  });

  it("N-4 · offline erlaubt keine Bestandsaussage — die harte Regel bleibt die von JOB 3025", () => {
    expect(bestandsaussageErlaubt(quellenlage(RUHEND_FRISCH, false))).toBe(false);
    // Und die Gegenprobe: online trägt genau diese Eingabe die Aussage sehr wohl.
    expect(bestandsaussageErlaubt(quellenlage(RUHEND_FRISCH, true))).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// Die Auskunft selbst — dieselbe Regel, einmal je Fläche, weiterhin ohne Mount.
// ------------------------------------------------------------------------------------------------

const OHNE_DECKUNG: Deckung = { lage: "kein_lauf", geprueft: null, bestand: null };

const BEFUND_BEIDES: EigenerBefund = {
  koId: "ko-1",
  dublette: true,
  konflikt: true,
  deckung: OHNE_DECKUNG,
};

function auffrischbar<T>(z: Quellenzustand<T>): Quelle<T> {
  return { ...z, refetch: () => {} };
}

/** Drei Quellen, alle ruhend und formal frisch — der Zustand aus dem Befund. */
const RUHEND = {
  befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [] })),
  konflikte: auffrischbar(quelle<readonly Conflict[]>({ data: [] })),
  kos: auffrischbar(quelle<readonly KnowledgeObject[]>({ data: [] })),
};

/** Dieselben drei Quellen, aber ohne je eine Antwort — der kalte Einstieg. */
const KALT = {
  befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ status: "pending", dataUpdatedAt: 0 })),
  konflikte: auffrischbar(quelle<readonly Conflict[]>({ status: "pending", dataUpdatedAt: 0 })),
  kos: auffrischbar(quelle<readonly KnowledgeObject[]>({ status: "pending", dataUpdatedAt: 0 })),
};

describe("JOB 3084 · die Detail-Auskunft offline", () => {
  it("N-5 · offline und ohne Befund → der Datenlagesatz statt der Verneinung", () => {
    const a = eigeneKollisionDetail({ koId: "ko-1", ...RUHEND }, false);
    expect(a.lage).toBe<Lage>("pausiert");
    expect(a.satzKey).toBe("kollision.lage.pausiert");
    expect(a.satzKey).not.toBe("kollision.detail.keine");
    expect(a.bestandGesichert).toBe(false);
    expect(a.wiederholenMoeglich).toBe(false);
    // Die Deckungsangabe hängt an `bestandsaussageErlaubt` (eigeneKollision.ts) und entfällt hier
    // von selbst — eine Reichweite von gestern über einen Bestand von heute wäre dieselbe Erfindung.
    expect(a.deckung).toBeNull();
  });

  it("N-6 · online und ohne Befund → die Verneinung bleibt erlaubt (Kalibrierung zu N-5)", () => {
    const a = eigeneKollisionDetail({ koId: "ko-1", ...RUHEND }, true);
    expect(a.lage).toBe<Lage>("frisch");
    expect(a.satzKey).toBe("kollision.detail.keine");
    expect(a.datenlageKey).toBeNull();
  });

  it("N-7 · ein vorliegender Befund wird auch offline GENANNT, mit Vorbehalt daneben (A27)", () => {
    const a = eigeneKollisionDetail(
      {
        koId: "ko-1",
        ...RUHEND,
        befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [BEFUND_BEIDES] })),
      },
      false,
    );
    // Verschwiegen wird nie etwas — nur die Verneinung verstummt.
    expect(a.art).toBe("beides");
    expect(a.satzKey).toBe("kollision.detail.beides");
    expect(a.datenlageKey).toBe("kollision.lage.pausiert");
    expect(a.weg?.to).toBe("/konflikte");
  });

  it("N-8 · offline OHNE jeden früheren Stand → kein behaupteter „Stand von zuletzt“", () => {
    const a = eigeneKollisionDetail({ koId: "ko-1", ...KALT }, false);
    expect(a.datenlageKey).toBe("kollision.lage.pausiertOhneStand");
    expect(a.satzKey).toBe("kollision.lage.pausiertOhneStand");
    expect(a.anzahl).toBe(0);
  });
});

describe("JOB 3084 · die Start-Auskunft folgt DERSELBEN Regel", () => {
  it("N-9 · offline und ohne Befund → der Datenlagesatz statt der Verneinung", () => {
    const a = eigeneKollisionStart(RUHEND, false);
    expect(a.lage).toBe<Lage>("pausiert");
    expect(a.satzKey).toBe("kollision.lage.pausiert");
    expect(a.satzKey).not.toBe("kollision.start.keine");
    expect(a.wiederholenMoeglich).toBe(false);
  });

  it("N-10 · online bleibt es bei der Verneinung (Kalibrierung zu N-9)", () => {
    expect(eigeneKollisionStart(RUHEND, true).satzKey).toBe("kollision.start.keine");
  });

  it("N-11 · ein Befund wird auch hier offline genannt, samt Vorbehalt", () => {
    const a = eigeneKollisionStart(
      {
        ...RUHEND,
        befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [BEFUND_BEIDES] })),
      },
      false,
    );
    expect(a.art).toBe("beides");
    expect(a.anzahl).toBe(1);
    expect(a.datenlageKey).toBe("kollision.lage.pausiert");
  });

  it("N-12 · kalt und offline → der Satz ohne Stand, und keine Zahl", () => {
    const a = eigeneKollisionStart(KALT, false);
    expect(a.satzKey).toBe("kollision.lage.pausiertOhneStand");
    expect(a.anzahl).toBe(0);
  });
});
