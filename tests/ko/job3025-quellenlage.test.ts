// JOB 3025 (A27, OFFEN.md:81) — DAS ZUSTANDSMODELL ALS TABELLE, OHNE MOUNT.
//
// WARUM DIESE DATEI EXISTIERT, und zwar getrennt von den gemounteten Fällen:
// JOB 3002 ist fünfmal an genau EINER Stelle gescheitert — an der Frage, was eine Abfrage gerade
// wirklich weiß. Vier der fünf Korrekturpflichten von Codex (R2, R3, R4, R5) hängen an dieser einen
// Ableitung. Solange sie in einer Seite steckt, ist sie nur über einen DOM-Umweg prüfbar, und ein
// vergessener Fall (in Runde 5: `fetchStatus === "paused"`) fällt erst im Betrieb auf.
//
// Deshalb nimmt `quellenlage()` AUSSCHLIESSLICH die skalaren Felder entgegen (`status`,
// `fetchStatus`, `isError`, `dataUpdatedAt`) plus die Daten — kein Query-Objekt, keine React-
// Abhängigkeit. Damit ist jede Kombination hier als Zeile einer Tabelle prüfbar, und ein neuer
// Abrufzustand von TanStack Query muss hier eine Zeile bekommen, bevor er eine Seite erreicht.
import { describe, expect, it } from "vitest";
import type { Conflict, EigenerBefund, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  LAGE_VON_SCHWACH_NACH_STARK,
  type Lage,
  type Quelle,
  type Quellenzustand,
  bestandsaussageErlaubt,
  eigeneKollisionDetail,
  eigeneKollisionStart,
  gesamtlage,
  quellenlage,
} from "../../apps/web/src/lib/eigeneKollision";

// ------------------------------------------------------------------------------------------------
// Aufbau: eine Quelle wird über ihre vier Skalare beschrieben. Der Vorgabewert ist die FRISCHE Lage;
// jeder Fall verstellt nur das, worum es ihm geht — so steht in jeder Zeile die Ursache und nicht
// eine Wand aus Feldern.
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

/** Die sechs Lagen, jeweils als das, was TanStack Query in dieser Situation wirklich meldet. */
const LADEND = quelle<readonly string[]>({ status: "pending", fetchStatus: "fetching" });
const FRISCH = quelle<readonly string[]>({ data: [] });
const ERSTFEHLER = quelle<readonly string[]>({ status: "error", isError: true, dataUpdatedAt: 0 });
const AUFFRISCHUNG_LAEUFT = quelle<readonly string[]>({ data: [], fetchStatus: "fetching" });
const AUFFRISCHUNG_GESCHEITERT = quelle<readonly string[]>({
  data: [],
  status: "error",
  isError: true,
});
const PAUSIERT = quelle<readonly string[]>({ data: [], fetchStatus: "paused" });

// Dieselben sechs Lagen noch einmal, nach Lage adressierbar — die Kreuzproben weiter unten fahren
// sie der Reihe nach durch, statt sie einzeln abzuschreiben.
const QUELLE_FUER: Record<Lage, Quellenzustand<never[]>> = {
  laedt: quelle<never[]>({ status: "pending", fetchStatus: "fetching" }),
  frisch: quelle<never[]>({ data: [] }),
  erstfehler: quelle<never[]>({ status: "error", isError: true, dataUpdatedAt: 0 }),
  auffrischung_laeuft: quelle<never[]>({ data: [], fetchStatus: "fetching" }),
  auffrischung_gescheitert: quelle<never[]>({ data: [], status: "error", isError: true }),
  pausiert: quelle<never[]>({ data: [], fetchStatus: "paused" }),
};

const DATENLAGE_KEY: Record<Lage, string | null> = {
  laedt: "kollision.lage.laedt",
  frisch: null,
  erstfehler: "kollision.lage.erstfehler",
  auffrischung_laeuft: "kollision.lage.auffrischungLaeuft",
  auffrischung_gescheitert: "kollision.lage.auffrischungGescheitert",
  pausiert: "kollision.lage.pausiert",
};

describe("JOB 3025 · quellenlage(): sechs Lagen, je eine Zeile", () => {
  it("Q-1 · Erstabruf offen (keine Daten, kein Fehler) → laedt", () => {
    expect(quellenlage(LADEND)).toBe<Lage>("laedt");
  });

  it("Q-2 · erfolgreich geladen, nichts offen → frisch", () => {
    expect(quellenlage(FRISCH)).toBe<Lage>("frisch");
  });

  it("Q-3 · Fehler, nie Daten gehabt → erstfehler", () => {
    expect(quellenlage(ERSTFEHLER)).toBe<Lage>("erstfehler");
  });

  it("Q-4 · Cache-Daten, Auffrischung läuft → auffrischung_laeuft", () => {
    expect(quellenlage(AUFFRISCHUNG_LAEUFT)).toBe<Lage>("auffrischung_laeuft");
  });

  it("Q-5 · Cache-Daten, Auffrischung abgelehnt → auffrischung_gescheitert", () => {
    expect(quellenlage(AUFFRISCHUNG_GESCHEITERT)).toBe<Lage>("auffrischung_gescheitert");
  });

  it("Q-6 · Cache-Daten, offline pausiert → pausiert (der Rotpunkt aus JOB 3002 R5)", () => {
    expect(quellenlage(PAUSIERT)).toBe<Lage>("pausiert");
  });
});

describe("JOB 3025 · quellenlage(): die Ränder, an denen Runde 4 und 5 fielen", () => {
  it("Q-7 · pausiert schlägt „lädt“ — ein pausierter Erstabruf ist kein laufender", () => {
    // Ohne diese Zeile hieße „offline, noch nie Daten“ genauso wie „lädt gerade“ — eine Auskunft,
    // die fortgesetzte Arbeit behauptet, wo gar keine läuft.
    expect(
      quellenlage(quelle<readonly string[]>({ status: "pending", fetchStatus: "paused" })),
    ).toBe<Lage>("pausiert");
  });

  it("Q-8 · pausiert schlägt „Auffrischung gescheitert“ — offline ist der aktuellere Grund", () => {
    expect(
      quellenlage(
        quelle<readonly string[]>({
          data: [],
          status: "error",
          isError: true,
          fetchStatus: "paused",
        }),
      ),
    ).toBe<Lage>("pausiert");
  });

  it("Q-9 · Fehler MIT Daten ist nie erstfehler — der Cache bleibt zeigbar", () => {
    expect(quellenlage(AUFFRISCHUNG_GESCHEITERT)).not.toBe<Lage>("erstfehler");
  });

  it("Q-10 · Daten ohne Zeitstempel gelten NICHT als geladen (dataUpdatedAt === 0)", () => {
    // `dataUpdatedAt === 0` heißt: dieser Wert kam nie aus einer Antwort (Platzhalter/Initialwert).
    // Ihn als geladen zu führen wäre die Verneinung aus dem Nichts.
    expect(
      quellenlage(quelle<readonly string[]>({ data: [], dataUpdatedAt: 0, status: "pending" })),
    ).toBe<Lage>("laedt");
  });

  it("Q-11 · frisch verlangt einen ruhenden Abruf — laufend ist nicht frisch", () => {
    expect(quellenlage(AUFFRISCHUNG_LAEUFT)).not.toBe<Lage>("frisch");
  });
});

describe("JOB 3025 · bestandsaussageErlaubt(): genau eine Lage trägt eine Verneinung", () => {
  it("Q-12 · nur `frisch` erlaubt eine Aussage über den Bestand", () => {
    const erlaubt = LAGE_VON_SCHWACH_NACH_STARK.filter((l) => bestandsaussageErlaubt(l));
    expect(erlaubt).toEqual<Lage[]>(["frisch"]);
  });

  it("Q-13 · die Rangliste führt alle sechs Lagen, ohne Doppelung", () => {
    expect([...LAGE_VON_SCHWACH_NACH_STARK].sort()).toEqual<Lage[]>([
      "auffrischung_gescheitert",
      "auffrischung_laeuft",
      "erstfehler",
      "frisch",
      "laedt",
      "pausiert",
    ]);
  });
});

describe("JOB 3025 · gesamtlage(): die schwächste Quelle zieht das Ganze", () => {
  it("Q-14 · drei frische Quellen ergeben frisch", () => {
    expect(gesamtlage("frisch", "frisch", "frisch")).toBe<Lage>("frisch");
  });

  it("Q-15 · Kreuzprobe: jede einzelne schwache Quelle zieht das Ganze herunter", () => {
    for (const schwach of LAGE_VON_SCHWACH_NACH_STARK) {
      if (schwach === "frisch") {
        continue;
      }
      expect(gesamtlage(schwach, "frisch", "frisch"), `Position 1 mit ${schwach}`).toBe(schwach);
      expect(gesamtlage("frisch", schwach, "frisch"), `Position 2 mit ${schwach}`).toBe(schwach);
      expect(gesamtlage("frisch", "frisch", schwach), `Position 3 mit ${schwach}`).toBe(schwach);
    }
  });

  it("Q-16 · unter zwei schwachen gewinnt die schwächere (Rangfolge, nicht Reihenfolge)", () => {
    expect(gesamtlage("auffrischung_laeuft", "erstfehler")).toBe<Lage>("erstfehler");
    expect(gesamtlage("erstfehler", "auffrischung_laeuft")).toBe<Lage>("erstfehler");
    expect(gesamtlage("pausiert", "auffrischung_gescheitert")).toBe<Lage>("pausiert");
  });
});

// ------------------------------------------------------------------------------------------------
// Die Auskunft selbst — dieselbe Regel, einmal je Fläche. Auch das ohne Mount, damit „welcher Satz
// bei welcher Lage" nicht erst über den DOM sichtbar wird.
// ------------------------------------------------------------------------------------------------

const BEFUND_DUBLETTE: EigenerBefund = { koId: "ko-1", dublette: true, konflikt: false };
const BEFUND_KONFLIKT: EigenerBefund = { koId: "ko-1", dublette: false, konflikt: true };

/**
 * Dieselbe Quelle, um `refetch` ergänzt. Die Trennung bleibt auch hier sichtbar: die Tabelle oben
 * läuft rein auf Skalaren, erst die AUSKUNFT braucht den neuen Versuch — und nur, weil sie ihn
 * anbietet (`erneutPruefen`).
 */
function auffrischbar<T>(z: Quellenzustand<T>, beiAufruf: () => void = () => {}): Quelle<T> {
  return { ...z, refetch: beiAufruf };
}

const leer = {
  befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [] })),
  konflikte: auffrischbar(quelle<readonly Conflict[]>({ data: [] })),
  kos: auffrischbar(quelle<readonly KnowledgeObject[]>({ data: [] })),
};

type Quellenname = "befunde" | "konflikte" | "kos";

/** Drei frische Quellen, EINE davon in der angegebenen Lage — die Kreuzprobe je Quelle. */
function nurEineVerstellt(name: Quellenname, lage: Lage): typeof leer {
  const q = auffrischbar(QUELLE_FUER[lage]);
  return {
    befunde: name === "befunde" ? q : leer.befunde,
    konflikte: name === "konflikte" ? q : leer.konflikte,
    kos: name === "kos" ? q : leer.kos,
  };
}

const QUELLENNAMEN: readonly Quellenname[] = ["befunde", "konflikte", "kos"];

describe("JOB 3025 · die Detail-Auskunft folgt der Regel", () => {
  it("A-1 · frisch mit Dublette → Befund, kein Datenlage-Vorbehalt", () => {
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [BEFUND_DUBLETTE] })),
    });
    expect(a.art).toBe("dublette");
    expect(a.lage).toBe<Lage>("frisch");
    expect(a.datenlageKey).toBeNull();
    expect(a.weg?.to).toBe("/duplikate");
  });

  it("A-2 · frisch ohne Befund → die EINZIGE erlaubte Verneinung", () => {
    const a = eigeneKollisionDetail({ koId: "ko-1", ...leer });
    expect(a.art).toBe("keine");
    expect(a.satzKey).toBe("kollision.detail.keine");
    expect(a.datenlageKey).toBeNull();
    expect(a.weg).toBeNull();
  });

  it("A-3 · jede der fünf anderen Lagen nimmt die Verneinung zurück — je Quelle einzeln", () => {
    for (const lage of LAGE_VON_SCHWACH_NACH_STARK) {
      if (lage === "frisch") {
        continue;
      }
      for (const name of QUELLENNAMEN) {
        const a = eigeneKollisionDetail({ koId: "ko-1", ...nurEineVerstellt(name, lage) });
        expect(a.satzKey, `${name} in ${lage}`).not.toBe("kollision.detail.keine");
        expect(a.datenlageKey, `${name} in ${lage}`).toBe(DATENLAGE_KEY[lage]);
      }
    }
  });

  it("A-4 · ein Cache-Befund verschwindet nicht, er bekommt den Vorbehalt", () => {
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      befunde: auffrischbar(
        quelle<readonly EigenerBefund[]>({ data: [BEFUND_KONFLIKT], fetchStatus: "paused" }),
      ),
    });
    expect(a.art).toBe("konflikt");
    expect(a.datenlageKey).toBe("kollision.lage.pausiert");
    expect(a.weg?.to).toBe("/konflikte");
  });

  it("A-5 · die Auskunft trägt nichts über die Gegenseite (A28, OFFEN.md:165)", () => {
    const gegenseite: Conflict = {
      id: "c-1",
      koA: "ko-1",
      koB: "ko-geheim-9",
      type: "truth",
      status: "offen",
      description: "Der Kessel läuft mit 6 bar.",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      createdAt: "2026-09-01T00:00:00Z",
    };
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      konflikte: auffrischbar(quelle<readonly Conflict[]>({ data: [gegenseite] })),
    });
    // Kalibrierung: die Eingabe trägt den fremden Inhalt wirklich — sonst prüfte A-5 nichts.
    expect(JSON.stringify([gegenseite])).toContain("ko-geheim-9");
    const verschriftet = JSON.stringify(a);
    expect(verschriftet).not.toContain("ko-geheim-9");
    expect(verschriftet).not.toContain("6 bar");
    expect(a.art).toBe("konflikt");
  });
});

describe("JOB 3025 · die Start-Auskunft folgt DERSELBEN Regel", () => {
  it("A-6 · frisch mit zwei betroffenen Objekten → Zahl und Art", () => {
    const a = eigeneKollisionStart({
      ...leer,
      befunde: auffrischbar(
        quelle<readonly EigenerBefund[]>({
          data: [BEFUND_DUBLETTE, { koId: "ko-2", dublette: false, konflikt: true }],
        }),
      ),
    });
    expect(a.anzahl).toBe(2);
    expect(a.art).toBe("beides");
    expect(a.datenlageKey).toBeNull();
  });

  it("A-7 · frisch ohne Befund → Verneinung; jede andere Lage nimmt sie zurück", () => {
    expect(eigeneKollisionStart(leer).satzKey).toBe("kollision.start.keine");
    for (const lage of LAGE_VON_SCHWACH_NACH_STARK) {
      if (lage === "frisch") {
        continue;
      }
      for (const name of QUELLENNAMEN) {
        const a = eigeneKollisionStart(nurEineVerstellt(name, lage));
        expect(a.satzKey, `${name} in ${lage}`).not.toBe("kollision.start.keine");
      }
    }
  });

  it("A-8 · ohne Daten wird auch keine Zahl behauptet", () => {
    const a = eigeneKollisionStart(nurEineVerstellt("befunde", "erstfehler"));
    expect(a.anzahl).toBe(0);
    expect(a.art).toBe("keine");
    expect(a.satzKey).toBe("kollision.lage.erstfehler");
  });
});

describe("JOB 3025 · pausiert OHNE früheren Stand sagt nichts über einen Stand", () => {
  // Ben, Runde 2, Korrekturpflicht 2. `pausiert` ist die EINZIGE Gesamtlage, die ohne Daten
  // eintreten kann — `quellenlage()` beantwortet `paused` vor der Datenfrage, jede stärkere Lage
  // setzt Daten voraus. Deshalb genügt hier `pausiert`; die übrigen fünf können den Fall nicht
  // erzeugen, und A-13 misst genau das, statt es zu behaupten.
  // `quelle()` setzt `data` von sich aus auf `undefined` — hier bleibt es dabei, und der
  // Zeitstempel 0 sagt dasselbe noch einmal: dieser Wert kam nie aus einer Antwort.
  const OHNE_DATEN = quelle<never[]>({
    status: "pending",
    fetchStatus: "paused",
    dataUpdatedAt: 0,
  });

  it("A-11 · kalt und offline → der Satz ohne Stand, und keine Verneinung", () => {
    const a = eigeneKollisionStart({
      befunde: auffrischbar(OHNE_DATEN),
      konflikte: auffrischbar(OHNE_DATEN),
      kos: auffrischbar(OHNE_DATEN),
    });
    expect(a.lage).toBe<Lage>("pausiert");
    expect(a.datenlageKey).toBe("kollision.lage.pausiertOhneStand");
    expect(a.satzKey).toBe("kollision.lage.pausiertOhneStand");
    expect(a.bestandGesichert).toBe(false);
    expect(a.anzahl).toBe(0);
  });

  it("A-12 · mit vollem Zwischenspeicher bleibt es beim Stand-Satz", () => {
    const a = eigeneKollisionStart(nurEineVerstellt("kos", "pausiert"));
    expect(a.lage).toBe<Lage>("pausiert");
    expect(a.datenlageKey).toBe("kollision.lage.pausiert");
  });

  it("A-13 · EIN Teil-Stand reicht nicht — eine Quelle ohne Daten nimmt den Stand-Satz zurück", () => {
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      befunde: auffrischbar(
        quelle<readonly EigenerBefund[]>({ data: [BEFUND_DUBLETTE], fetchStatus: "paused" }),
      ),
      kos: auffrischbar(OHNE_DATEN),
    });
    // Der Befund aus dem Zwischenspeicher bleibt — er wird eingeordnet, nicht kassiert …
    expect(a.art).toBe("dublette");
    // … aber über den Gesamtstand wird nichts mehr behauptet.
    expect(a.datenlageKey).toBe("kollision.lage.pausiertOhneStand");
  });
});

describe("JOB 3025 · der neue Versuch frischt ALLE drei Quellen auf", () => {
  // Der Wiederholknopf lag in Runde 1 als eigene Funktion in BEIDEN Seiten — zwei Listen derselben
  // drei Quellen, die getrennt hätten altern können. Jetzt trägt ihn die Auskunft; dieser Fall ist
  // die Zusicherung, dass er keine Quelle auslässt.
  function spurProbe(): { auskunft: ReturnType<typeof eigeneKollisionStart>; spur: string[] } {
    const spur: string[] = [];
    const merke = (name: string) => (): void => {
      spur.push(name);
    };
    return {
      auskunft: eigeneKollisionStart({
        befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [] }), merke("befunde")),
        konflikte: auffrischbar(quelle<readonly Conflict[]>({ data: [] }), merke("konflikte")),
        kos: auffrischbar(quelle<readonly KnowledgeObject[]>({ data: [] }), merke("kos")),
      }),
      spur,
    };
  }

  it("A-9 · `erneutPruefen()` ruft `refetch` auf befunde, konflikte UND kos", () => {
    const { auskunft, spur } = spurProbe();
    expect(spur, "vor dem Aufruf darf nichts aufgefrischt worden sein").toEqual([]);
    auskunft.erneutPruefen();
    expect([...spur].sort()).toEqual(["befunde", "konflikte", "kos"]);
  });

  it("A-10 · angeboten wird er nur, wo ein Versuch etwas ändern kann", () => {
    // Keine Scheinfunktion: bei laufendem Abruf und offline bleibt der Knopf weg (REGELN.md §7).
    const erwartet: Record<Lage, boolean> = {
      erstfehler: true,
      auffrischung_gescheitert: true,
      laedt: false,
      auffrischung_laeuft: false,
      pausiert: false,
      frisch: false,
    };
    for (const lage of LAGE_VON_SCHWACH_NACH_STARK) {
      const a = eigeneKollisionStart(nurEineVerstellt("konflikte", lage));
      expect(a.wiederholenMoeglich, `Lage ${lage}`).toBe(erwartet[lage]);
    }
  });
});
