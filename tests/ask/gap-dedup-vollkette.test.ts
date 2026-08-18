// ================================================================================================
// JOB 1111 / D1 — D-032: DIESELBE FRAGE ERZEUGT EINE LÜCKE MIT HÄUFIGKEIT, NICHT FÜNF DUBLETTEN.
// ================================================================================================
//
// DER BEFUND (Designblock `DESIGN_AN_CHEF/LIEFERUNG-20260814-BLOCK2.md`, D-032):
//
//   „Es gibt genau EINE Erzeugungsstelle (`services/ask/src/service.ts:377` → `createGap`) und
//    KEINE Dublettenprüfung auf keiner der vier Ebenen: kein `find` vor dem `insert`, kein
//    Schlüssel über den Fragetext im Speicher (`repo.ts:14–17`), KEIN Unique-Index in Postgres
//    (`repo-pg.ts:5–10`) … Die vorhandene Normalisierung macht NUR Whitespace und Kürzung,
//    ausdrücklich ‚KEINE semantische Analyse'."
//
// UND SEINE AUSDRÜCKLICHEN NICHT-ZIELE, die dieser Wächter mitträgt, weil sie sonst niemand hält:
//   · „**Keine Ähnlichkeitssuche** in dieser Scheibe (Tippfehler-Dubletten bleiben)."
//   · „Keine Mindestlängen-Regel (würde legitime Einwort-Stichworte still verschlucken)."
//   · „Bestehende Dubletten bleiben unangetastet (keine Migration in dieser Scheibe)."
//
// ================================================================================================
// WAS HIER GEMESSEN WIRD — UND WAS AUSDRÜCKLICH NICHT.
// ================================================================================================
//
// GEMESSEN wird LAUFZEITVERHALTEN: der Vergleichsschlüssel als reine Funktion, der echte
// `AskService` gegen die echte In-Memory-Ablage, und der Postgres-Adapter gegen einen Fake-Pool,
// der jede abgesetzte Anweisung mitschreibt. Quelltextzusagen stehen hier nicht.
//
// NICHT GEMESSEN wird, ob PostgreSQL die neue DDL wirklich annimmt: in dieser Umgebung läuft keine
// Datenbank. Diese Aussage trägt in der Rückgabe die Kennzeichnung `UNBEWIESENE HYPOTHESE`
// (Regelwerk „Aus BEN 494–500" Punkt 7). Belegt ist hier nur, WAS der Adapter absetzt und wie er
// sich verhält — und dass die Stufe additiv bleibt (über die echte Klassifikationsfunktion).
import { describe, expect, it } from "vitest";
import { klassifiziereStufe, markerVon } from "../../services/app/src/migrationsbeleg";
import { MAX_GAP_QUESTION_LENGTH, gapCompareKey } from "../../services/ask/src/gap-text";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { ASK_SCHEMA, PgGapRepo } from "../../services/ask/src/repo-pg";
import { AskService } from "../../services/ask/src/service";
import type { Gap } from "../../services/ask/src/types";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";

// Eine Frage, auf die der Bestand nichts hergibt — sie erzeugt zuverlässig eine Wissenslücke.
const OHNE_GRUNDLAGE = "Wie hoch ist der Wechselkurs?";

async function setup() {
  const koRepo = new InMemoryKoRepo();
  const koService = new KoService({ repo: koRepo });
  await koService.activateSearchProjectionV2();
  await koService.create({
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  const gaps = new InMemoryGapRepo();
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps,
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, gaps };
}

// ================================================================================================
describe("D-032 (1) · der Vergleichsschlüssel normalisiert Form, niemals Bedeutung", () => {
  it("Kleinschreibung, Satzzeichen und Whitespace fallen weg", () => {
    const a = gapCompareKey("Was  muss  die   Wartung beinhalten?");
    const b = gapCompareKey("was muss die wartung beinhalten");
    const c = gapCompareKey("  WAS MUSS DIE WARTUNG BEINHALTEN!!! ");
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a.length).toBeGreaterThan(0);
  });

  it("KALIBRIERUNG: ein Tippfehler bleibt eine ANDERE Frage — keine Ähnlichkeitssuche", () => {
    // Das ist der ausdrückliche Nicht-Ziel-Fall aus D-032. Ohne ihn wäre nicht zu unterscheiden,
    // ob der Schlüssel Form normalisiert oder Bedeutung rät.
    expect(gapCompareKey("Was muss die Wartung beinhaltenm?")).not.toBe(
      gapCompareKey("Was muss die Wartung beinhalten?"),
    );
  });

  it("Bindestrich und Leerzeichen sind dasselbe — zusammengeschriebene Wörter NICHT", () => {
    // Satzzeichen werden durch ein Leerzeichen ersetzt, nicht ersatzlos gestrichen. Sonst würde
    // „Ventil-X" zu „ventilx" und wäre von „Ventil X" verschieden — und „a.b" würde zu „ab".
    expect(gapCompareKey("Ventil-X prüfen")).toBe(gapCompareKey("Ventil X prüfen"));
    expect(gapCompareKey("VentilX prüfen")).not.toBe(gapCompareKey("Ventil X prüfen"));
  });

  it("eine Einwortfrage behält einen tragfähigen Schlüssel — keine Mindestlänge", () => {
    expect(gapCompareKey("BBK")).toBe("bbk");
  });

  it("eine Frage ganz ohne Buchstaben hat KEINEN Schlüssel — und ist damit nicht dedupfähig", () => {
    // Zwei verschiedene Zeichenfolgen dürfen nicht über einen leeren Schlüssel zusammenfallen.
    expect(gapCompareKey("???")).toBe("");
    expect(gapCompareKey("!!!")).toBe("");
  });

  it("der Schlüssel erbt die Längenbegrenzung des gespeicherten Textes", () => {
    const lang = `${"anlagenteil ".repeat(60)}ende`;
    expect(gapCompareKey(lang).length).toBeLessThanOrEqual(MAX_GAP_QUESTION_LENGTH + 1);
  });
});

// ================================================================================================
describe("D-032 (2) · zwei gleiche Fragen ergeben EINE offene Lücke mit Zähler 2", () => {
  it("dieselbe Frage zweimal: eine Lücke, dieselbe Id, askCount 2", async () => {
    const { ask } = await setup();

    const erste = await ask.ask(OHNE_GRUNDLAGE);
    const zweite = await ask.ask(OHNE_GRUNDLAGE);
    expect(erste.result.answered).toBe(false);
    expect(zweite.result.answered).toBe(false);

    const gaps = await ask.listGaps();
    expect(
      gaps.filter((g) => g.status === "offen"),
      "es entstanden mehrere Lücken",
    ).toHaveLength(1);
    expect(zweite.gap?.id).toBe(erste.gap?.id);
    expect(gaps[0]?.askCount, "die Häufigkeit wird nicht mitgezählt").toBe(2);
  });

  it("Groß-/Kleinschreibung und Satzzeichen führen nicht mehr zu Doppeleinträgen", async () => {
    const { ask } = await setup();

    await ask.ask("Wie hoch ist der Wechselkurs?");
    await ask.ask("   wie hoch ist der wechselkurs   ");
    await ask.ask("WIE HOCH IST DER WECHSELKURS!!!");

    const offene = (await ask.listGaps()).filter((g) => g.status === "offen");
    expect(offene).toHaveLength(1);
    expect(offene[0]?.askCount).toBe(3);
  });

  it("KALIBRIERUNG: eine andere Frage erzeugt weiterhin eine EIGENE Lücke", async () => {
    // Ohne diesen Fall könnte die Zusammenführung auch alles zusammenwerfen und wäre grün.
    const { ask } = await setup();

    await ask.ask("Wie hoch ist der Wechselkurs?");
    await ask.ask("Wann wurde der Filter zuletzt getauscht?");

    const offene = (await ask.listGaps()).filter((g) => g.status === "offen");
    expect(offene).toHaveLength(2);
    expect(offene.every((g) => g.askCount === 1)).toBe(true);
  });

  it("ein Tippfehler erzeugt weiterhin ZWEI Lücken — das Nicht-Ziel bleibt gewahrt", async () => {
    const { ask } = await setup();

    await ask.ask("Wie hoch ist der Wechselkurs?");
    await ask.ask("Wie hoch ist der Wechselkursm?");

    expect((await ask.listGaps()).filter((g) => g.status === "offen")).toHaveLength(2);
  });

  it("eine GESCHLOSSENE Lücke blockiert die Frage nicht — sie darf wieder aufkommen", async () => {
    const { ask, gaps } = await setup();

    const erste = await ask.ask(OHNE_GRUNDLAGE);
    const id = erste.gap?.id ?? "";
    const gespeichert = await gaps.findById(id);
    if (!gespeichert) {
      throw new Error("die erste Lücke wurde gar nicht gespeichert");
    }
    await gaps.update({ ...gespeichert, status: "geschlossen" });

    const zweite = await ask.ask(OHNE_GRUNDLAGE);
    expect(zweite.gap?.id, "die geschlossene Lücke wurde wiederbelebt").not.toBe(id);
    expect((await ask.listGaps()).filter((g) => g.status === "offen")).toHaveLength(1);
  });

  it("PARALLELFALL: zwei gleichzeitige Läufe ergeben zusammen eine Lücke mit Zähler 2", async () => {
    // Genau der Fall, für den eine Anwendungsprüfung allein nicht reicht: zwei Läufe, die beide
    // „gibt es noch nicht" sehen. Die Unteilbarkeit gehört deshalb in die Ablage.
    const { ask } = await setup();

    const [a, b] = await Promise.all([ask.ask(OHNE_GRUNDLAGE), ask.ask(OHNE_GRUNDLAGE)]);

    const offene = (await ask.listGaps()).filter((g) => g.status === "offen");
    expect(offene, "der Parallelfall legte zwei Lücken an").toHaveLength(1);
    expect(offene[0]?.askCount).toBe(2);
    expect(a.gap?.id).toBe(b.gap?.id);
  });
});

// ================================================================================================
describe("D-032 (3) · bestehende Dubletten werden NICHT still migriert", () => {
  it("eine Altlücke ohne Vergleichsschlüssel bleibt unangetastet", async () => {
    const { ask, gaps } = await setup();

    // So sieht der Bestand aus: angelegt, bevor es den Schlüssel gab.
    const alt: Gap = {
      id: "alt-1",
      question: "Wie hoch ist der Wechselkurs?",
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await gaps.insert(alt);

    await ask.ask(OHNE_GRUNDLAGE);

    const nachher = await gaps.findById("alt-1");
    expect(nachher, "die Altlücke ist verschwunden").toEqual(alt);
    // Und sie wird auch nicht heimlich als Treffer benutzt: die neue Frage bekommt eine eigene
    // Lücke. Das ist die bewusste Grenze — verglichen wird der GESPEICHERTE Schlüssel, nicht ein
    // im Lesen nachgerechneter. Zwei Auslegungen derselben Regel (Speicher vs. Datenbank) wären
    // genau der Fehler, den die Parität verhindern soll.
    const offene = (await ask.listGaps()).filter((g) => g.status === "offen");
    expect(offene).toHaveLength(2);
  });
});

// ================================================================================================
describe("D-032 (4) · der dauerhafte Sitz: Unique-Index und Konfliktweg in Postgres", () => {
  it("die Schemastufe trägt den partiellen Unique-Index — und bleibt ADDITIV", () => {
    // Gemessen mit der ECHTEN Klassifikationsfunktion des Migrationsbelegs, nicht mit einer
    // abgeschriebenen Regel: keine zerstörende Anweisung, also keine neue Risikoklasse.
    expect(ASK_SCHEMA).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
    expect(klassifiziereStufe(ASK_SCHEMA)).toBe("ADDITIV");
    expect(markerVon(ASK_SCHEMA)).toEqual([]);
  });

  it("der Adapter setzt ein ON-CONFLICT-Insert ab und zählt bei Konflikt hoch", async () => {
    const abgesetzt: string[] = [];
    const gap: Gap = {
      id: "g1",
      question: "Wie hoch ist der Wechselkurs?",
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: "2026-01-01T00:00:00.000Z",
      askCount: 1,
      compareKey: "wie hoch ist der wechselkurs",
    };
    const vorhanden: Gap = { ...gap, id: "g0", askCount: 4 };
    // Der Fake-Pool spielt den KONFLIKT: das Insert trifft nichts, das Hochzählen liefert die
    // bestehende Zeile. Gemessen wird, was der Adapter daraus macht.
    const pool = {
      query: async (sql: string) => {
        abgesetzt.push(sql.replace(/\s+/g, " ").trim());
        if (/^INSERT INTO gaps/i.test(sql.trim())) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [{ data: { ...vorhanden, askCount: 5 } }], rowCount: 1 };
      },
    };
    const repo = new PgGapRepo(pool as unknown as ConstructorParameters<typeof PgGapRepo>[0]);

    const ergebnis = await repo.insertOrIncrement(gap);

    expect(ergebnis.created, "der Adapter hielt den Konflikt für eine Neuanlage").toBe(false);
    expect(ergebnis.gap.id, "es kam nicht die BESTEHENDE Lücke zurück").toBe("g0");
    expect(ergebnis.gap.askCount).toBe(5);
    expect(abgesetzt[0]).toContain("ON CONFLICT");
    expect(abgesetzt[0]).toContain("DO NOTHING");
  });

  it("ohne Konflikt meldet der Adapter eine echte Neuanlage", async () => {
    // Die Gegenprobe: derselbe Weg, nur trifft das Insert diesmal. Ohne diesen Fall bewiese der
    // vorige nur, dass der Adapter IMMER „schon da" sagt.
    const gap: Gap = {
      id: "g1",
      question: "Wie hoch ist der Wechselkurs?",
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: "2026-01-01T00:00:00.000Z",
      askCount: 1,
      compareKey: "wie hoch ist der wechselkurs",
    };
    const pool = {
      query: async () => ({ rows: [{ data: gap }], rowCount: 1 }),
    };
    const repo = new PgGapRepo(pool as unknown as ConstructorParameters<typeof PgGapRepo>[0]);

    const ergebnis = await repo.insertOrIncrement(gap);
    expect(ergebnis.created).toBe(true);
    expect(ergebnis.gap.id).toBe("g1");
  });
});
