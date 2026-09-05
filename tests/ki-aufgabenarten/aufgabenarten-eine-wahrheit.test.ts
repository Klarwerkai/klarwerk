// ================================================================================================
// JOB 3069 · V9 Nebenbefund (f) — EINE AUFGABENLISTE, ACHT ARTEN, KEIN NaN.
// ================================================================================================
//
// DER BEFUND: Der Server kennt acht Aufgabenarten (`services/model-runs/src/types.ts:7-15`), die
// Oberfläche führte in `apps/web/src/api/types.ts:137` eine ZWEITE, kürzere Liste mit fünf. Aus
// dieser zweiten Wahrheit entstand `byTask.extract === NaN` (`undefined + 1`) und der rohe
// Programmschlüssel `mrun.task.extract` in der Pille der Reasoner-Karte.
//
// ── WAS DIESE DATEI BINDET, UND WARUM SIE DIE ACHT NICHT NOCH EINMAL ABSCHREIBT ────────────────
// Ein Wächter, der die acht Namen selbst aufzählt, wäre die DRITTE Liste — er würde genau den
// Fehler wiederholen, gegen den er steht. Deshalb kommen beide Seiten aus ihren echten Quellen:
//
//   SERVER  · Quelltext von `services/model-runs/src/types.ts`. Bewusst Text und nicht Import:
//             `ModelRunTask` ist ein TYP und existiert zur Laufzeit nicht — es gibt dort nichts
//             zu importieren. Ein Textvergleich sieht ausserdem auch eine Liste, die niemand mehr
//             benutzt.
//   CLIENT  · der echte Laufzeitwert `REASONER_TASKS` aus `apps/web/src/api/types.ts`, also genau
//             das Array, aus dem `ModelRunTask` und `byTask` abgeleitet werden.
//
// Warum die Oberfläche nicht einfach aus `services/` importiert, steht im Bestand und wird hier
// nicht neu entschieden: der webbuild-Stage im Dockerfile kopiert NUR `apps/web`, ein solcher
// Import bricht den Produktions-Build (`apps/web/src/api/types.ts:1360-1366`,
// `tests/reasoner/job615-public-status-task-contract.test.ts:10-16`). Dieser Wächter ist der
// Ersatz für den verbotenen Import — für die ModelRun-Seite, so wie job615 es für die
// Reasoner-Seite tut.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REASONER_TASKS } from "../../apps/web/src/api/types";
import type { ModelRunRecord, ModelRunTask } from "../../apps/web/src/api/types";
import { istBekannteAufgabenart, summarizeModelRuns } from "../../apps/web/src/lib/modelRuns";

const WURZEL = join(__dirname, "..", "..");
const SERVER_TYPES = join(WURZEL, "services/model-runs/src/types.ts");
const WEB_TYPES = join(WURZEL, "apps/web/src/api/types.ts");
const WEB_SRC = join(WURZEL, "apps/web/src");

/** Die Aufgaben-Union aus dem Quelltext des Servers — die eine Wahrheit dieses Auftrags. */
function serverAufgaben(): string[] {
  const text = readFileSync(SERVER_TYPES, "utf8");
  const treffer = /export type ModelRunTask\s*=\s*((?:\s*\|\s*"[a-z]+")+)\s*;/.exec(text);
  if (!treffer?.[1]) {
    return [];
  }
  return [...treffer[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
}

/** Jede `.ts`/`.tsx`-Quelldatei der Oberfläche. */
function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      gefunden.push(...quelldateien(pfad));
    } else if (/\.tsx?$/.test(eintrag)) {
      gefunden.push(pfad);
    }
  }
  return gefunden;
}

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "structure",
    provider: "deterministic",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: "2026-09-05T10:00:00.000Z",
    finishedAt: "2026-09-05T10:00:00.100Z",
    status: "success",
    ...over,
  };
}

/** Rekursiv: enthält irgendein Wert der Zusammenfassung ein `NaN`? */
function traegtNaN(wert: unknown): boolean {
  if (typeof wert === "number") {
    return Number.isNaN(wert);
  }
  if (wert !== null && typeof wert === "object") {
    return Object.values(wert).some(traegtNaN);
  }
  return false;
}

// ══ R3 · DER WÄCHTER GEGEN DIE RÜCKKEHR DER ZWEITEN LISTE ═══════════════════════════════════════
describe("JOB 3069 · R3 — Server und Oberfläche führen dieselben Aufgabenarten", () => {
  it("R3a · der Server trägt acht Arten, und der Quelltext ist lesbar", () => {
    // Ohne diesen Fall wäre ein leeres Leseergebnis (verschobene Datei, geänderte Schreibweise)
    // ein still bestandener Wächter: `[] === []`.
    expect(serverAufgaben(), "die Aufgaben-Union des Servers ist nicht lesbar").toHaveLength(8);
  });

  it("R3b · die Liste der Oberfläche ist Wert für Wert und in derselben Reihenfolge die des Servers", () => {
    expect([...REASONER_TASKS]).toEqual(serverAufgaben());
  });

  it("R3c · jede Art einzeln benannt — beide Richtungen", () => {
    // Schlüsselweise statt pauschal: fehlt eine, nennt die Meldung genau sie.
    const client = [...REASONER_TASKS] as string[];
    for (const art of serverAufgaben()) {
      expect(`${art} in der Oberfläche=${client.includes(art)}`).toBe(
        `${art} in der Oberfläche=true`,
      );
    }
    const server = serverAufgaben();
    for (const art of client) {
      expect(`${art} im Server=${server.includes(art)}`).toBe(`${art} im Server=true`);
    }
  });

  it("R3d · GEGENPROBE — eine Art nur im Server, eine Art nur in der Oberfläche: beides rot", () => {
    // Genau die zwei Mutationen, die der Wächter fangen soll, im Test selbst gefahren.
    const nurServer = serverAufgaben().filter((a) => a !== "group");
    expect(() => expect([...REASONER_TASKS]).toEqual(nurServer)).toThrow();
    const nurClient = [...REASONER_TASKS, "zusammenfassen"];
    expect(() => expect(nurClient).toEqual(serverAufgaben())).toThrow();
  });

  // ── LIEFERUNG 7 IST HEUTE NICHT ERFÜLLT, UND DAS STEHT HIER STATT IN EINER BEHAUPTUNG ─────────
  //
  // Der Auftrag verlangt GENAU EINE Aufzählung der Aufgabenarten unter `apps/web/src/**`. Es sind
  // ZWEI, gemessen und nicht geschätzt:
  //   · `apps/web/src/api/types.ts`    — `REASONER_TASKS`, die Quelle. Aus ihr leiten seit
  //     JOB 3069 `ModelRunTask`, `byTask` und die Beschriftung der Pille ab.
  //   · `apps/web/src/pages/AdminKiDetails.tsx` — `AI_TASKS`, eine handgeschriebene zweite
  //     Acht-Element-Liste für die KI-Zuordnung je Aufgabe. (Bis JOB 3065 stand sie in
  //     `pages/Admin.tsx`; H6 hat die Kartenwand in vier Detaildateien je Reiter zerlegt, und die
  //     KI-Karte ist mitsamt ihrer Liste dorthin gewandert — derselbe Code, neuer Ort.)
  //
  // WARUM SIE NOCH STEHT (JOB 3069 R3): BEN hat ihre Ablösung in Runde 2 zur Pflicht gemacht; Runde 2
  // hat sie gebaut, und der maschinelle Vorprüfer hat den Stand darauf abgewiesen —
  // „ZIELPFAD-VERSTOSS: apps/web/src/pages/Admin.tsx", Tor nicht einmal gestartet. `Admin.tsx` steht
  // nicht in den Zielpfaden dieses Auftrags, und die Bahn-Regel dazu ist ohne Ermessen: „Brauchst du
  // einen Pfad außerhalb, nimm ihn NICHT." Die Änderung ist deshalb zurückgenommen; sie ist EINE
  // Zeile (`const AI_TASKS = REASONER_TASKS;` plus Import) und wartet auf einen Auftrag, der
  // `Admin.tsx` als Zielpfad führt.
  //
  // WAS DIESER WÄCHTER DESHALB TUT: Er schreibt die Lücke nicht als „so ist es richtig" fest,
  // sondern hält sie an der kürzestmöglichen Leine. R3e verbietet eine DRITTE Stelle, R3g bindet die
  // zweite Wert für Wert an die Quelle, R3h zeigt beide Riegel an der Mutation. Driftet `AI_TASKS`
  // oder kommt eine weitere Liste hinzu, wird genau hier rot — mit Pfad im Klartext.
  it("R3e · die Oberfläche zählt die Aufgabenarten an genau den ZWEI belegten Stellen auf", () => {
    // Eine Datei, die ALLE acht Namen als Zeichenketten trägt, ist eine Aufzählung der
    // Aufgabenarten. Dateien mit einzelnen Namen ("structure" als Schritt-Kennung im Editor,
    // "assist" als Bearbeitungsart) sind keine Aufzählung dieser Menge und zählen hier nicht.
    const aufzaehlungen = quelldateien(WEB_SRC).filter((pfad) => {
      const text = readFileSync(pfad, "utf8");
      return REASONER_TASKS.every((art) => text.includes(`"${art}"`));
    });
    // JOB 3065 (H6) hat die Admin-Kartenwand in vier Detaildateien je Reiter zerlegt; die KI-Karte
    // und mit ihr `AI_TASKS` wohnen seither in `pages/AdminKiDetails.tsx`. Der Ort hat sich
    // geändert, die Zusage nicht: es sind weiterhin GENAU ZWEI Stellen, und eine dritte ist rot.
    expect(aufzaehlungen.map((p) => p.slice(WURZEL.length + 1)).sort()).toEqual([
      "apps/web/src/api/types.ts",
      "apps/web/src/pages/AdminKiDetails.tsx",
    ]);
  });

  it("R3g · die zweite, noch offene Liste in AdminKiDetails.tsx trägt Wert für Wert dieselben acht", () => {
    // Solange sie besteht, wird sie wenigstens gemessen: driftet `AI_TASKS` — etwa weil der Server
    // eine neunte Art bekommt und nur die Quelle nachgezogen wird —, wird dieser Fall rot und nennt
    // die Stelle. Das ersetzt die Ablösung nicht; es sorgt dafür, dass sie nicht vergessen wird.
    const text = readFileSync(join(WURZEL, "apps/web/src/pages/AdminKiDetails.tsx"), "utf8");
    const treffer = /AI_TASKS\s*=\s*\[([^\]]*)\]\s*as const/.exec(text);
    const liste = [...(treffer?.[1] ?? "").matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
    expect(liste, "AI_TASKS ist nicht mehr lesbar — dann prüft R3g nichts mehr").toHaveLength(8);
    expect(liste).toEqual([...REASONER_TASKS]);
  });

  it("R3h · GEGENPROBE — eine DRITTE Aufzählung macht R3e rot, eine driftende zweite macht R3g rot", () => {
    // Ein Wächter, der nur die heutige Lage abbildet, ist keiner. Hier laufen beide Mutationen,
    // gegen die er steht — gegen dieselbe Erkennungsregel, die R3e bzw. R3g benutzen.
    const wieR3e = (texte: readonly string[]): number =>
      texte.filter((text) => REASONER_TASKS.every((art) => text.includes(`"${art}"`))).length;
    const dritteListe = `const NOCH_EINE = [${REASONER_TASKS.map((a) => `"${a}"`).join(", ")}] as const;`;
    expect(wieR3e([dritteListe])).toBe(1);
    expect(() => expect(wieR3e([dritteListe])).toBe(0)).toThrow();

    const driftend = [...REASONER_TASKS].filter((a) => a !== "group");
    expect(() => expect(driftend).toEqual([...REASONER_TASKS])).toThrow();
  });

  it("R3f · und in dieser einen Datei steht keine handgeschriebene ModelRunTask-Union mehr", () => {
    // Die abgelöste Form: `export type ModelRunTask = "structure" | …`. Sie wandert nicht mit,
    // wenn der Server wächst — genau das war der Fehler.
    const text = readFileSync(WEB_TYPES, "utf8");
    expect(/export type ModelRunTask\s*=\s*\|?\s*"/.test(text)).toBe(false);
    // Und jeder der acht Namen steht dort genau EINMAL — in `REASONER_TASKS`.
    for (const art of REASONER_TASKS) {
      const treffer = text.match(new RegExp(`"${art}"`, "g")) ?? [];
      expect(`${art}=${treffer.length}`).toBe(`${art}=1`);
    }
  });
});

// ══ R1 · DIE ZÄHLUNG KENNT ALLE ACHT ════════════════════════════════════════════════════════════
describe("JOB 3069 · R1 — summarizeModelRuns zählt alle acht Arten", () => {
  it("R1a · je ein Lauf der acht Arten ⇒ acht Zähler mit 1, total 8, kein NaN", () => {
    const s = summarizeModelRuns(REASONER_TASKS.map((task, i) => lauf({ id: `r${i}`, task })));
    expect(s.total).toBe(8);
    expect(Object.keys(s.byTask).sort()).toEqual([...REASONER_TASKS].sort());
    for (const art of REASONER_TASKS) {
      expect(`${art}=${s.byTask[art]}`).toBe(`${art}=1`);
    }
    expect(traegtNaN(s), "kein Wert der Zusammenfassung darf NaN sein").toBe(false);
  });

  it("R1b · die drei jüngeren Arten sind einzeln benannt — sie waren der Rotpunkt", () => {
    // extract/describe/group entstehen wirklich (services/reasoner/src/service.ts:952/1009/1260)
    // und ergaben vorher `undefined + 1`.
    const s = summarizeModelRuns([
      lauf({ id: "a", task: "extract" }),
      lauf({ id: "b", task: "describe" }),
      lauf({ id: "c", task: "group" }),
      lauf({ id: "d", task: "extract" }),
    ]);
    expect(s.byTask.extract).toBe(2);
    expect(s.byTask.describe).toBe(1);
    expect(s.byTask.group).toBe(1);
    expect(s.unbekannteArten).toBe(0);
  });

  it("R1c · leere Liste ⇒ acht Nullzähler, nicht fünf", () => {
    const s = summarizeModelRuns([]);
    expect(Object.keys(s.byTask).sort()).toEqual([...REASONER_TASKS].sort());
    expect(Object.values(s.byTask).every((n) => n === 0)).toBe(true);
    expect(s.total).toBe(0);
    expect(s.unbekannteArten).toBe(0);
  });
});

// ══ R4 · EINE UNBEKANNTE ART BRINGT NICHTS DURCHEINANDER ════════════════════════════════════════
describe("JOB 3069 · R4 — eine unbekannte Aufgabenart wird gezählt, nicht zugeschlagen", () => {
  const fremd = "zusammenfassen" as unknown as ModelRunTask;

  it("R4a · kein Absturz, kein NaN, kein neuer Schlüssel in byTask", () => {
    const s = summarizeModelRuns([lauf({ id: "a", task: fremd })]);
    expect(traegtNaN(s)).toBe(false);
    expect(Object.keys(s.byTask).sort()).toEqual([...REASONER_TASKS].sort());
    expect(Object.keys(s.byTask)).not.toContain("zusammenfassen");
  });

  it("R4b · der Lauf wird KEINER bekannten Art zugeschlagen — das wäre eine erfundene Auskunft", () => {
    const s = summarizeModelRuns([lauf({ id: "a", task: fremd })]);
    expect(Object.values(s.byTask).every((n) => n === 0)).toBe(true);
    expect(s.unbekannteArten).toBe(1);
  });

  it("R4c · total bleibt die Zahl der übergebenen Datensätze, und die Rechnung geht auf", () => {
    const s = summarizeModelRuns([
      lauf({ id: "a", task: "extract" }),
      lauf({ id: "b", task: fremd }),
      lauf({ id: "c", task: fremd }),
    ]);
    expect(s.total).toBe(3);
    const summeBekannt = Object.values(s.byTask).reduce((a, b) => a + b, 0);
    expect(summeBekannt).toBe(1);
    expect(s.unbekannteArten).toBe(2);
    // Die Lücke ist beziffert, nicht verschwiegen: bekannt + unbekannt = alles.
    expect(summeBekannt + s.unbekannteArten).toBe(s.total);
  });

  it("R4d · `istBekannteAufgabenart` trennt die acht von allem anderen", () => {
    for (const art of REASONER_TASKS) {
      expect(`${art}=${istBekannteAufgabenart(art)}`).toBe(`${art}=true`);
    }
    for (const fremdwort of ["zusammenfassen", "", "Structure", "mrun.task.extract"]) {
      expect(`${fremdwort}=${istBekannteAufgabenart(fremdwort)}`).toBe(`${fremdwort}=false`);
    }
  });
});
