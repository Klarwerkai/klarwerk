// ================================================================================================
// JOB 3899 · LIEFERUNG 4 — „KEIN MENSCHLICHER ENTSCHEIDER": DER SATZ UND WAS DIE AKTE WIRKLICH TRÄGT
// ================================================================================================
//
// `services/conflicts/src/types.ts:6-11` legt für BEIDE systemischen Abschlussgründe dieselbe
// Grundbedeutung fest:
//   `:7-8`   „participant_deleted" = ein Beteiligter wurde gelöscht (systemische Beendigung, KEIN
//            MENSCHLICHER ENTSCHEIDER).
//   `:9-11`  „superseded" = systemisch gegenstandslos geworden … (KEIN MENSCHLICHER ENTSCHEIDER,
//            analog participant_deleted).
//
// Diese Datei tut zweierlei, und beides zusammen ist der Wächter:
//   A) SIE HÄLT DEN SATZ FEST. Wer die Grundbedeutung in `types.ts` umschreibt oder die Regel in
//      `repo.ts:22-29` entfernt, wird hier rot — der Satz ist die Voraussetzung, gegen die Teil B
//      überhaupt etwas bedeutet.
//   B) SIE HÄLT FEST, WAS DIE AKTE NACH JEDEM DER DREI WEGE NOCH TRÄGT. Eine spätere Änderung an
//      `service.ts:221` (Löschweg) oder `service.ts:483` (Revisions-Sweep) kann den Satz aus
//      `types.ts` stillschweigend zur Unwahrheit machen — ab hier nicht mehr still.
//
// GRENZE (wie in `aufraeumwege-vermerk.test.ts` ausgeschrieben): gemessen wird `ConflictService`
// gegen `InMemoryConflictRepo`. Die Postgres-Fassung (`repo-pg`, jsonb-Merge), der HTTP-Weg, die
// Oberfläche und EN/NL bleiben UNGEMESSEN und werden hier nicht als gedeckt behauptet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { type Conflict, ConflictService, InMemoryConflictRepo } from "../../services/conflicts";

const QUELLE = join(__dirname, "..", "..", "services", "conflicts", "src");

/**
 * Liest eine Quelldatei und legt ihre Kommentarzeilen zu EINEM Fließtext zusammen (Zeilenumbrüche
 * und Einrückung fallen weg). So trifft die Zusicherung den SATZ und nicht den Zeilenumbruch —
 * eine reine Umformatierung macht den Wächter nicht rot, eine inhaltliche Änderung schon.
 */
function satzText(datei: string): string {
  return readFileSync(join(QUELLE, datei), "utf8")
    .split("\n")
    .map((zeile) => zeile.trim().replace(/^\/\/\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

// ------------------------------------------------------------------------------------------------
// A) DER SATZ
// ------------------------------------------------------------------------------------------------
describe("JOB 3899 · die Grundbedeutung steht im Quelltext", () => {
  it("types.ts erklärt BEIDE systemischen Gründe zur systemischen Beendigung ohne Entscheider", () => {
    const roh = readFileSync(join(QUELLE, "types.ts"), "utf8");
    const text = satzText("types.ts");

    expect(text).toContain(
      '"participant_deleted" = ein Beteiligter wurde gelöscht (systemische Beendigung, kein menschlicher Entscheider).',
    );
    expect(text).toContain('"superseded" = systemisch gegenstandslos geworden');
    expect(text).toContain("(kein menschlicher Entscheider, analog participant_deleted).");

    // Beide Gründe sind auch wirklich Teil des Typs — der Satz beschreibt keine tote Bezeichnung.
    expect(roh).toContain('| "participant_deleted"');
    expect(roh).toContain('| "superseded"');
  });

  it("repo.ts schreibt die Regel aus, die den Lese-GC von menschlichen Akten fernhält", () => {
    const text = satzText("repo.ts");

    // `repo.ts:25-26` — die Regel selbst.
    expect(text).toContain("kein Lost Update — eine zwischenzeitliche MENSCHLICHE Entscheidung");
    expect(text).toContain("gewinnt das CAS und der GC überschreibt sie nie");
    // `repo.ts:28-29` — die Zusage, die die Pg-Fassung über ein jsonb-Merge einlöst und die hier
    // ausdrücklich UNGEMESSEN bleibt.
    expect(text).toContain("Pg mergt sie ins jsonb");
  });

  it("service.ts nennt onKoRevised den Haupt-Weg und den Lese-GC die Rückfall-Sicherung", () => {
    const text = satzText("service.ts");

    // `service.ts:598`
    expect(text).toContain("analog onKoRevised, das der aktive Haupt-Weg bleibt");
    // `service.ts:546-548`
    expect(text).toContain(
      "(onKoRevised) bleibt das aktive Schließen, dieser Filter die Rückfall-Sicherung.",
    );
  });
});

// ------------------------------------------------------------------------------------------------
// B) WAS DIE AKTE TRÄGT
// ------------------------------------------------------------------------------------------------

const KO_A = "ko-a";
const KO_B = "ko-b";
const MENSCH = "controller-berger";
const ZWEITMEINUNG_TEXT = "Zweitmeinung Berger: Fassung B ist die jüngere Quelle.";
const ENTSCHEIDUNG_TEXT = "Fassung B gilt; Fassung A wird zurückgezogen.";

function flushGc(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function vermerk(c: Conflict | undefined): Record<string, unknown> {
  return {
    status: c?.status,
    resolutionReason: c?.resolutionReason,
    decidedBy: c?.decidedBy,
    decision: c?.decision,
    secondOpinion: c?.secondOpinion,
  };
}

interface Aufbau {
  repo: InMemoryConflictRepo;
  svc: ConflictService;
  versionen: Map<string, number>;
}

function aufbau(): Aufbau {
  const versionen = new Map([
    [KO_A, 1],
    [KO_B, 1],
  ]);
  const repo = new InMemoryConflictRepo();
  const svc = new ConflictService({
    repo,
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    currentVersion: (koId: string) => versionen.get(koId),
  });
  return { repo, svc, versionen };
}

function neuerBefund(svc: ConflictService): Promise<Conflict> {
  return svc.createAuto(
    {
      koA: KO_A,
      koB: KO_B,
      type: "truth",
      description: "Widerspruch zur Fristenlage.",
      koAVersion: 1,
      koBVersion: 1,
    },
    { trigger: "validation", method: "model" },
  );
}

/**
 * Die Akte mit der DICHTESTEN menschlichen Spur, die ein Aufräumweg überhaupt zu Gesicht bekommen
 * kann: eskaliert, mit Zweitmeinung, mit Entscheider und Entscheidungstext. Erreichbar, weil
 * `escalate` (`service.ts:167`) über `require` (`:168`) prüft und nicht über `requireOpen` — ein
 * bereits entschiedener Wahrheitskonflikt lässt sich erneut eskalieren.
 */
async function akteMitVollerMenschenspur(svc: ConflictService): Promise<Conflict> {
  const c = await neuerBefund(svc);
  await svc.escalate(c.id, MENSCH);
  await svc.secondOpinion(c.id, ZWEITMEINUNG_TEXT, MENSCH);
  await svc.resolve(c.id, MENSCH, ENTSCHEIDUNG_TEXT);
  await svc.escalate(c.id, MENSCH);
  return c;
}

describe("JOB 3899 · was ein systemisch beendeter Befund nach jedem der drei Wege trägt", () => {
  it("ohne menschliche Spur: alle drei Wege hinterlassen eine Akte mit leeren Vermerkfeldern", async () => {
    // Weg 1 · Lese-GC
    const eins = aufbau();
    const a = await neuerBefund(eins.svc);
    eins.versionen.set(KO_B, 2);
    expect(await eins.svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    // Weg 2 · onKoRevised
    const zwei = aufbau();
    const b = await neuerBefund(zwei.svc);
    expect(await zwei.svc.onKoRevised(KO_B, 2, "system")).toBe(1);

    // Weg 3 · onKoRemoved
    const drei = aufbau();
    const c = await neuerBefund(drei.svc);
    expect(await drei.svc.onKoRemoved(KO_B, "system-loeschung")).toBe(1);

    const leer = { decidedBy: null, decision: null, secondOpinion: null };
    expect({
      leseGc: vermerk(await eins.repo.findById(a.id)),
      onKoRevised: vermerk(await zwei.repo.findById(b.id)),
      onKoRemoved: vermerk(await drei.repo.findById(c.id)),
    }).toStrictEqual({
      leseGc: { status: "geloest", resolutionReason: "superseded", ...leer },
      onKoRevised: { status: "geloest", resolutionReason: "superseded", ...leer },
      onKoRemoved: { status: "geloest", resolutionReason: "participant_deleted", ...leer },
    });
  });

  it("mit voller menschlicher Spur: der Lese-GC rührt sie nicht an, die beiden anderen beenden sie", async () => {
    const AUSGANG = {
      status: "eskaliert",
      resolutionReason: "decided",
      decidedBy: MENSCH,
      decision: ENTSCHEIDUNG_TEXT,
      secondOpinion: ZWEITMEINUNG_TEXT,
    };

    // Weg 1 · Lese-GC — läuft (der Befund ist sicher stale und offen genug für `unresolved()`),
    // verliert aber das CAS (`repo.ts:81`) und schreibt nichts.
    const eins = aufbau();
    const a = await akteMitVollerMenschenspur(eins.svc);
    expect(vermerk(await eins.repo.findById(a.id))).toStrictEqual(AUSGANG);
    eins.versionen.set(KO_B, 2);
    expect(await eins.svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    // Weg 2 · onKoRevised — `:483` setzt genau drei Felder, der Rest überlebt den Spread.
    const zwei = aufbau();
    const b = await akteMitVollerMenschenspur(zwei.svc);
    expect(await zwei.svc.onKoRevised(KO_B, 2, "system")).toBe(1);

    // Weg 3 · onKoRemoved — `service.ts:221` mergt denselben Patch mit anderem Grund.
    const drei = aufbau();
    const c = await akteMitVollerMenschenspur(drei.svc);
    expect(await drei.svc.onKoRemoved(KO_B, "system-loeschung")).toBe(1);

    // DIE TABELLE. Sie sagt für jeden Weg in einer Zeile, was aus der menschlichen Spur wird.
    expect({
      leseGc: vermerk(await eins.repo.findById(a.id)),
      onKoRevised: vermerk(await zwei.repo.findById(b.id)),
      onKoRemoved: vermerk(await drei.repo.findById(c.id)),
    }).toStrictEqual({
      // unberührt — die Regel aus `repo.ts:22-29` hält.
      leseGc: AUSGANG,
      // Grund und Entscheider werden systemisch überschrieben, Entscheidungstext und Zweitmeinung
      // bleiben stehen: eine Akte, die „kein menschlicher Entscheider" sagt, trägt weiter zwei
      // Freitexte eines Menschen. Gemessen, nicht repariert (BEN: keine Korrekturpflicht).
      onKoRevised: {
        status: "geloest",
        resolutionReason: "superseded",
        decidedBy: null,
        decision: ENTSCHEIDUNG_TEXT,
        secondOpinion: ZWEITMEINUNG_TEXT,
      },
      onKoRemoved: {
        status: "geloest",
        resolutionReason: "participant_deleted",
        decidedBy: null,
        decision: ENTSCHEIDUNG_TEXT,
        secondOpinion: ZWEITMEINUNG_TEXT,
      },
    });
  });
});
