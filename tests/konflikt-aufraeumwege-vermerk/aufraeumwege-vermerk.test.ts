// ================================================================================================
// JOB 3899 — DREI AUFRÄUMWEGE BEENDEN DENSELBEN KONFLIKT. WAS WIRD AUS DEM MENSCHLICHEN VERMERK?
// ================================================================================================
//
// DIE BESTELLUNG. BEN, JOB 3887 Runde 1 (`jobs/3887/runde-1/ben.md:28`): „Für die Aufräumwege
// (`service.ts:610`) wären ergänzende Fälle zum Erhalt menschlicher Vermerke sinnvoll. Keine
// Korrekturpflicht dieses Auftrags." JOB 3887 hat den Vermerk am Dienst vermessen und genau diese
// drei Wege ausdrücklich ausgeschlossen (`jobs/3887/AUFTRAG.md:167`). Diese Datei misst sie — und
// ändert NICHTS am Produkt.
//
// DIE SPUR EINES MENSCHEN entsteht an vier Stellen (`services/conflicts/src/service.ts`):
//   escalate `:167`        → status "eskaliert"
//   secondOpinion `:181`   → status "zweitmeinung" + Freitext in `secondOpinion`
//   dismiss `:153`         → status "geloest" + `decidedBy` + `decision` + reason "dismissed"
//   resolve `:189`         → status "geloest" + `decidedBy` + `decision` + reason "decided"
//
// DIE DREI WEGE, die Konflikte automatisch beenden, gehen damit UNTERSCHIEDLICH um:
//   1. Lese-GC `service.ts:610-633` → `repo.supersedeIfOpen` (`repo.ts:79-86`): STATUS-CAS, schließt
//      nur einen Befund, der JETZT noch `offen` ist. Alles andere gewinnt das CAS — der GC rührt es
//      nie an. Die Regel steht ausgeschrieben in `repo.ts:22-29`.
//   2. Revisions-Sweep `onKoRevised` `service.ts:472-492`: der Filter `:474` schließt NUR bereits
//      gelöste Befunde aus — `eskaliert` und `zweitmeinung` bleiben drin und werden mit
//      `{ status:"geloest", decidedBy:null, resolutionReason:"superseded" }` beendet (`:483`).
//   3. Löschweg `onKoRemoved` `service.ts:218-223` → `repo.closeOpenForKo` (`repo.ts:104-115`):
//      wählt jeden Befund dieses Beitrags, dessen Status nicht `geloest` ist (`:107`), und mergt
//      `{ status:"geloest", decidedBy:null, resolutionReason:"participant_deleted" }` per Spread.
//
// WARUM DAS ZÄHLT: `types.ts:6-11` definiert BEIDE Gründe ausdrücklich als systemische Beendigung
// „kein menschlicher Entscheider". Die Wege 2 und 3 setzen diesen Grund auch auf Akten, an denen ein
// Mensch nachweislich gearbeitet hat. Was dabei aus `decision` und `secondOpinion` wird, entscheidet
// heute allein die Reihenfolge des Spread — zugesichert ist es nirgends. Ab hier ist es festgenagelt.
//
// ------------------------------------------------------------------------------------------------
// GEMESSENE GRENZEN — was diese Datei NICHT belegt (Auftrag §5 Lieferung 6)
// ------------------------------------------------------------------------------------------------
// Gemessen wird ausschließlich `ConflictService` gegen `InMemoryConflictRepo`. NICHT gemessen:
//   · POSTGRES. `repo-pg` löst dieselbe Zusage über ein `jsonb`-Merge ein (so ausgeschrieben in
//     `repo.ts:28-29`: „Pg mergt sie ins jsonb; nur dieser Aufruf, der die offene Zeile flippt,
//     gewinnt."). Diese Fassung bleibt hier UNGEMESSEN — sie läuft nur unter `test:integration`
//     (Testcontainers). Ob das jsonb-Merge `decision`/`secondOpinion` gleich behandelt wie der
//     Spread der In-Memory-Ablage, ist hier weder geprüft noch behauptet.
//   · DER HTTP-WEG (`services/app/src/routes/conflicts-routes.ts`) — eigener Auftrag (JOB 3888).
//   · DIE OBERFLÄCHE (Board, Badge, Detailseite) und EN/NL.
// Die sichtbare Wirkung hängt an `unresolved()` und `get()`; hier geht es um den INHALT der
// beendeten Akte, nicht um ihre Sichtbarkeit.
//
// NICHT GEDOPPELT: `tests/app/aistate-fix6.test.ts` misst den Lese-GC am WETTLAUF (zwei GC-Läufe
// am Barrier `:53`, Mensch im CAS-Fenster `:109`, Audit-Ausfall nach gewinnendem CAS `:165`) und
// prüft dort `status`, `resolutionReason`, `decidedBy` und die Auditzahl. `decision` und
// `secondOpinion` kommen dort nicht vor, die Wege 2 und 3 gar nicht. Diese Datei baut den Wettlauf
// NICHT nach; sie misst den Akteninhalt über alle vier Zustände und alle drei Wege.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { type Conflict, ConflictService, InMemoryConflictRepo } from "../../services/conflicts";

// ------------------------------------------------------------------------------------------------
// Rüstzeug
// ------------------------------------------------------------------------------------------------

const KO_A = "ko-a";
const KO_B = "ko-b";
const MENSCH = "controller-berger";
const LOESCH_AKTEUR = "system-loeschung";
const SWEEP_AKTEUR = "system";
const ZWEITMEINUNG_TEXT = "Zweitmeinung Berger: Fassung B ist die jüngere Quelle.";
const ENTSCHEIDUNG_TEXT = "Fassung B gilt; Fassung A wird zurückgezogen.";

/** Ein Timer-Durchlauf (Makrotask) lässt die angestoßenen GC-Ketten abschließen — wie in
 * `tests/app/aistate-fix6.test.ts:21`. Zweifach, damit auch die Audit-Fortsetzung durchläuft. */
function flushGc(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Der VOLLSTÄNDIGE Vermerk-Datensatz — genau die fünf Felder, um die es geht. */
function vermerk(c: Conflict | undefined): Record<string, unknown> {
  return {
    status: c?.status,
    resolutionReason: c?.resolutionReason,
    decidedBy: c?.decidedBy,
    decision: c?.decision,
    secondOpinion: c?.secondOpinion,
  };
}

/**
 * Zweite, UNABHÄNGIGE Spur für Weg 1: jeder `supersedeIfOpen`-Aufruf wird mit seinem Ergebnis
 * protokolliert. Damit belegt ein Fall, dass der Lese-GC wirklich ANGELAUFEN ist und das CAS
 * verloren hat — statt bloß „es hat sich nichts geändert" zu behaupten (Auftrag §5 Lieferung 2).
 */
class ProtokollConflictRepo extends InMemoryConflictRepo {
  readonly casRufe: { id: string; gewonnen: boolean }[] = [];
  readonly closeRufe: { koId: string; beendet: string[] }[] = [];

  override async supersedeIfOpen(
    id: string,
    patch: Parameters<InMemoryConflictRepo["supersedeIfOpen"]>[1],
  ): Promise<boolean> {
    const gewonnen = await super.supersedeIfOpen(id, patch);
    this.casRufe.push({ id, gewonnen });
    return gewonnen;
  }

  override async closeOpenForKo(
    koId: string,
    patch: Parameters<InMemoryConflictRepo["closeOpenForKo"]>[1],
    tx?: Parameters<InMemoryConflictRepo["closeOpenForKo"]>[2],
  ): Promise<Conflict[]> {
    const beendet = await super.closeOpenForKo(koId, patch, tx);
    this.closeRufe.push({ koId, beendet: beendet.map((c) => c.id) });
    return beendet;
  }
}

interface Aufbau {
  repo: ProtokollConflictRepo;
  audit: AuditService;
  svc: ConflictService;
  versionen: Map<string, number>;
  fehler: { context: string; error: unknown }[];
}

/**
 * `mitVersionsautoritaet` entscheidet, ob die Lese-Pfade versionsgebunden filtern (und damit den
 * Lese-GC überhaupt anstoßen können). Weg 2 und Weg 3 brauchen sie nicht: `onKoRevised` bekommt die
 * aktuelle Version als Parameter, `onKoRemoved` fragt gar nicht danach.
 */
function aufbau(mitVersionsautoritaet: boolean): Aufbau {
  const versionen = new Map([
    [KO_A, 1],
    [KO_B, 1],
  ]);
  const repo = new ProtokollConflictRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const fehler: { context: string; error: unknown }[] = [];
  const svc = new ConflictService({
    repo,
    audit,
    onError: (context, error) => fehler.push({ context, error }),
    ...(mitVersionsautoritaet ? { currentVersion: (koId: string) => versionen.get(koId) } : {}),
  });
  return { repo, audit, svc, versionen, fehler };
}

/** Ein versionsgebundener automatischer Befund über dasselbe Paar — die Ausgangsakte aller Fälle. */
function neuerBefund(svc: ConflictService, beschreibung: string): Promise<Conflict> {
  return svc.createAuto(
    {
      koA: KO_A,
      koB: KO_B,
      type: "truth",
      description: beschreibung,
      koAVersion: 1,
      koBVersion: 1,
    },
    { trigger: "validation", method: "model" },
  );
}

type Zustand = "offen" | "eskaliert" | "zweitmeinung" | "geloest";

/** Der ERWARTETE Ausgangsvermerk je Zustand. Jeder Fall belegt ihn, BEVOR der Aufräumweg läuft —
 * ohne das wäre „der Vermerk blieb erhalten" eine Aussage über nichts (Auftrag §9). */
const AUSGANG: Record<Zustand, Record<string, unknown>> = {
  offen: {
    status: "offen",
    resolutionReason: undefined,
    decidedBy: null,
    decision: null,
    secondOpinion: null,
  },
  eskaliert: {
    status: "eskaliert",
    resolutionReason: undefined,
    decidedBy: null,
    decision: null,
    secondOpinion: null,
  },
  zweitmeinung: {
    status: "zweitmeinung",
    resolutionReason: undefined,
    decidedBy: null,
    decision: null,
    secondOpinion: ZWEITMEINUNG_TEXT,
  },
  geloest: {
    status: "geloest",
    resolutionReason: "decided",
    decidedBy: MENSCH,
    decision: ENTSCHEIDUNG_TEXT,
    secondOpinion: ZWEITMEINUNG_TEXT,
  },
};

/** Bringt einen frischen Befund über die ECHTEN Dienstwege in den gewünschten Zustand. */
async function befundIm(svc: ConflictService, zustand: Zustand): Promise<Conflict> {
  const c = await neuerBefund(svc, `Widerspruch zur Fristenlage (${zustand}).`);
  if (zustand === "eskaliert") {
    await svc.escalate(c.id, MENSCH);
  } else if (zustand === "zweitmeinung") {
    await svc.secondOpinion(c.id, ZWEITMEINUNG_TEXT, MENSCH);
  } else if (zustand === "geloest") {
    await svc.escalate(c.id, MENSCH);
    await svc.secondOpinion(c.id, ZWEITMEINUNG_TEXT, MENSCH);
    await svc.resolve(c.id, MENSCH, ENTSCHEIDUNG_TEXT);
  }
  return c;
}

const ZUSTAENDE: Zustand[] = ["offen", "eskaliert", "zweitmeinung", "geloest"];

/** Was ein systemisch beendeter Befund trägt, wenn der Ausgangsvermerk `basis` war. */
function beendetMit(
  basis: Record<string, unknown>,
  grund: "superseded" | "participant_deleted",
): Record<string, unknown> {
  return { ...basis, status: "geloest", resolutionReason: grund, decidedBy: null };
}

// ================================================================================================
// WEG 1 · LESE-GC (`service.ts:610-633` über `repo.supersedeIfOpen`, `repo.ts:79-86`)
// ================================================================================================
//
// Jeder Fall stellt NEBEN den Zielbefund einen KONTROLLBEFUND im Zustand `offen` auf dasselbe Paar.
// Beide sind nach `versionen.set(KO_B, 2)` sicher stale gebunden. Der Kontrollbefund ist der Beweis,
// dass der Weg in genau diesem Lauf wirklich gearbeitet hat: er wird geschlossen und auditiert.
describe("JOB 3899 · Weg 1 — der Lese-GC und der menschliche Vermerk", () => {
  for (const zustand of ZUSTAENDE) {
    it(`Zustand ${zustand}: der Lese-GC läuft — und was er mit dem Vermerk macht, steht fest`, async () => {
      const { repo, audit, svc, versionen, fehler } = aufbau(true);
      const ziel = await befundIm(svc, zustand);
      const kontrolle = await neuerBefund(svc, "Kontrollbefund, bleibt offen.");

      // (a) Der Vermerk ist WIRKLICH geschrieben, bevor irgendetwas aufräumt.
      expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG[zustand]);

      // (b) Ab hier ist die gebundene Version von KO_B sicher veraltet ⇒ beide Befunde sind stale.
      versionen.set(KO_B, 2);
      expect(await svc.unresolved()).toHaveLength(0);
      await flushGc();
      await flushGc();

      // (c) DER NACHWEIS, DASS DER WEG LIEF: der Kontrollbefund ist geschlossen und auditiert —
      //     gegen eine Literalliste erwarteter Kennungen samt Anzahl, nicht gegen die Ist-Liste.
      expect(vermerk(await repo.findById(kontrolle.id))).toStrictEqual(
        beendetMit(AUSGANG.offen, "superseded"),
      );
      const erwarteteBelege = zustand === "offen" ? [ziel.id, kontrolle.id] : [kontrolle.id];
      const superseded = await audit.list({ action: "conflict.superseded" });
      expect(superseded).toHaveLength(erwarteteBelege.length);
      expect(new Set(superseded.map((e) => e.target))).toEqual(new Set(erwarteteBelege));
      expect(superseded.map((e) => ({ actor: e.actor, payload: e.payload }))).toEqual(
        // wirklich der Lese-GC, nicht der Sweep — `via: "read-gc"` steht nur in `service.ts:625`.
        erwarteteBelege.map(() => ({
          actor: "system",
          payload: { koId: KO_B, currentVersion: 2, via: "read-gc" },
        })),
      );
      expect(fehler).toEqual([]);

      if (zustand === "offen") {
        // Beide offen ⇒ beide CAS gewonnen, beide geschlossen, zwei superseded-Audits.
        expect(repo.casRufe).toEqual([
          { id: ziel.id, gewonnen: true },
          { id: kontrolle.id, gewonnen: true },
        ]);
        expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(
          beendetMit(AUSGANG.offen, "superseded"),
        );
        return;
      }

      if (zustand === "geloest") {
        // Der Weg ERREICHT diesen Zustand gar nicht: `unresolved()` filtert `geloest` schon vor der
        // Versionsprüfung heraus (`service.ts:550`), es wird kein GC angestoßen. Belegt durch das
        // CAS-Protokoll: NUR der Kontrollbefund taucht darin auf.
        expect(repo.casRufe).toEqual([{ id: kontrolle.id, gewonnen: true }]);
      } else {
        // eskaliert/zweitmeinung: der GC LÄUFT für den Zielbefund und VERLIERT das CAS
        // (`repo.ts:81`) — kein Update, kein Audit (`service.ts:618-619`).
        expect(repo.casRufe).toContainEqual({ id: ziel.id, gewonnen: false });
        expect(repo.casRufe).toContainEqual({ id: kontrolle.id, gewonnen: true });
      }

      // (d) Der menschliche Vermerk ist BYTEGLEICH unverändert — alle fünf Felder.
      expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG[zustand]);
      expect(superseded.map((e) => e.target)).toEqual([kontrolle.id]);
    });
  }

  it("der gelöste Befund bleibt als menschlicher Grabstein vollständig lesbar", async () => {
    const { svc, versionen } = aufbau(true);
    const ziel = await befundIm(svc, "geloest");
    versionen.set(KO_B, 2);

    // `get()` reicht gelöste Befunde ohne Versionsprüfung durch (`service.ts:582`) — der Vermerk
    // eines Menschen verschwindet nicht hinter dem fail-closed Filter.
    expect(vermerk(await svc.get(ziel.id))).toStrictEqual(AUSGANG.geloest);
  });
});

// ================================================================================================
// WEG 2 · REVISIONS-SWEEP `onKoRevised` (`service.ts:472-492`)
// ================================================================================================
describe("JOB 3899 · Weg 2 — der Revisions-Sweep und der menschliche Vermerk", () => {
  for (const zustand of ZUSTAENDE) {
    it(`Zustand ${zustand}: onKoRevised läuft — und was er mit dem Vermerk macht, steht fest`, async () => {
      const { repo, audit, svc } = aufbau(false);
      const ziel = await befundIm(svc, zustand);
      const kontrolle = await neuerBefund(svc, "Kontrollbefund, bleibt offen.");
      expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG[zustand]);

      // KO_B wurde auf Version 2 revidiert; beide Befunde binden Version 1.
      const anzahl = await svc.onKoRevised(KO_B, 2, SWEEP_AKTEUR);

      // DER NACHWEIS, DASS DER WEG LIEF (zwei unabhängige Spuren): Rückgabewert (`:491`) und Audit
      // — gegen eine Literalliste erwarteter Kennungen, nicht gegen die Ist-Liste selbst.
      const erwarteteBelege = zustand === "geloest" ? [kontrolle.id] : [ziel.id, kontrolle.id];
      const superseded = await audit.list({ action: "conflict.superseded" });
      expect(vermerk(await repo.findById(kontrolle.id))).toStrictEqual(
        beendetMit(AUSGANG.offen, "superseded"),
      );
      expect(superseded).toHaveLength(erwarteteBelege.length);
      expect(superseded.map((e) => e.target)).toEqual(erwarteteBelege);
      expect(superseded.map((e) => ({ actor: e.actor, payload: e.payload }))).toEqual(
        erwarteteBelege.map(() => ({
          actor: SWEEP_AKTEUR,
          payload: { koId: KO_B, currentVersion: 2 },
        })),
      );

      if (zustand === "geloest") {
        // Der Filter `:474` schließt NUR bereits gelöste Befunde aus. Der menschliche Abschluss
        // bleibt vollständig stehen — inklusive Entscheider, Entscheidungstext und Grund „decided".
        expect(anzahl).toBe(1);
        expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG.geloest);
        return;
      }

      // offen/eskaliert/zweitmeinung gehen ALLE durch den Filter und werden systemisch beendet.
      expect(anzahl).toBe(2);
      expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(
        beendetMit(AUSGANG[zustand], "superseded"),
      );
      // Der Freitext des Menschen ÜBERLEBT den Spread (`:483` setzt nur drei Felder) …
      const nachher = await repo.findById(ziel.id);
      expect(nachher?.secondOpinion).toBe(zustand === "zweitmeinung" ? ZWEITMEINUNG_TEXT : null);
      // … während der Grund jetzt „kein menschlicher Entscheider" sagt (`types.ts:9-11`).
      expect(nachher?.resolutionReason).toBe("superseded");
      expect(nachher?.decidedBy).toBeNull();
    });
  }
});

// ================================================================================================
// WEG 3 · LÖSCHWEG `onKoRemoved` (`service.ts:218-223` über `repo.closeOpenForKo`, `repo.ts:104-115`)
// ================================================================================================
describe("JOB 3899 · Weg 3 — der Löschweg und der menschliche Vermerk", () => {
  for (const zustand of ZUSTAENDE) {
    it(`Zustand ${zustand}: onKoRemoved läuft — und was er mit dem Vermerk macht, steht fest`, async () => {
      const { repo, audit, svc } = aufbau(false);
      const ziel = await befundIm(svc, zustand);
      const kontrolle = await neuerBefund(svc, "Kontrollbefund, bleibt offen.");
      expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG[zustand]);

      const anzahl = await svc.onKoRemoved(KO_B, LOESCH_AKTEUR);

      // DER NACHWEIS, DASS DER WEG LIEF (drei unabhängige Spuren): Rückgabewert (`:244`), die
      // Rückgabeliste von `closeOpenForKo` (`repo.ts:114`) und BEIDE Audit-Belege je beendetem
      // Befund (`service.ts:225` und `:234`).
      //
      // GEGEN KONKRETE KENNUNGEN UND ANZAHLEN, nicht zwei Ist-Listen gegeneinander. BEN, Runde 1:
      // die frühere Fassung verglich `entfernt` mit `autoResolved` — beide Vergleiche bestanden
      // auch mit `[]`. Eine Produktmutation vor `service.ts:224`, die bei genau einem beendeten
      // Befund beide Belege überspringt, blieb dadurch unentdeckt. `erwarteteBelege` ist eine
      // Literalliste aus dem Fall selbst; ihre Länge kann keine unterdrückte Schreibung mitschrumpfen.
      const erwarteteBelege = zustand === "geloest" ? [kontrolle.id] : [ziel.id, kontrolle.id];
      const entfernt = await audit.list({ action: "conflict.participant-removed" });
      const autoResolved = await audit.list({ action: "conflict.auto-resolved" });
      expect(vermerk(await repo.findById(kontrolle.id))).toStrictEqual(
        beendetMit(AUSGANG.offen, "participant_deleted"),
      );
      expect(entfernt).toHaveLength(erwarteteBelege.length);
      expect(autoResolved).toHaveLength(erwarteteBelege.length);
      expect(entfernt.map((e) => e.target)).toEqual(erwarteteBelege);
      expect(autoResolved.map((e) => e.target)).toEqual(erwarteteBelege);
      expect(entfernt.map((e) => ({ actor: e.actor, payload: e.payload }))).toEqual(
        erwarteteBelege.map(() => ({ actor: LOESCH_AKTEUR, payload: { koId: KO_B } })),
      );
      expect(autoResolved.map((e) => ({ actor: e.actor, payload: e.payload }))).toEqual(
        erwarteteBelege.map(() => ({
          actor: LOESCH_AKTEUR,
          payload: { reason: "participant_deleted" },
        })),
      );

      if (zustand === "geloest") {
        // `repo.ts:107` überspringt jeden bereits gelösten Befund — der menschliche Abschluss bleibt.
        expect(anzahl).toBe(1);
        expect(repo.closeRufe).toEqual([{ koId: KO_B, beendet: [kontrolle.id] }]);
        expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG.geloest);
        return;
      }

      expect(anzahl).toBe(2);
      expect(repo.closeRufe).toEqual([{ koId: KO_B, beendet: [ziel.id, kontrolle.id] }]);
      expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(
        beendetMit(AUSGANG[zustand], "participant_deleted"),
      );
      const nachher = await repo.findById(ziel.id);
      expect(nachher?.secondOpinion).toBe(zustand === "zweitmeinung" ? ZWEITMEINUNG_TEXT : null);
      expect(nachher?.decidedBy).toBeNull();
    });
  }
});

// ================================================================================================
// LIEFERUNG 3 · HAUPT-WEG GEGEN RÜCKFALL — DERSELBE BEFUND, ZWEI ERGEBNISSE
// ================================================================================================
describe("JOB 3899 · derselbe zweitmeinung-Befund: Lese-GC verweigert, onKoRevised nicht", () => {
  it("der Rückfall (Lese-GC) lässt den Freitext stehen, der Haupt-Weg (onKoRevised) beendet ihn", async () => {
    const { repo, audit, svc, versionen } = aufbau(true);
    const ziel = await befundIm(svc, "zweitmeinung");
    expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(AUSGANG.zweitmeinung);

    // ---- Erstens: der RÜCKFALL. `service.ts:546-548` nennt den Lese-GC ausdrücklich die
    // „Rückfall-Sicherung", `repo.ts:22-29` verbietet ihm das Überschreiben menschlicher Akten.
    versionen.set(KO_B, 2);
    expect(await svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    expect(repo.casRufe).toEqual([{ id: ziel.id, gewonnen: false }]); // gelaufen UND verloren
    const nachGc = vermerk(await repo.findById(ziel.id));
    expect(nachGc).toStrictEqual(AUSGANG.zweitmeinung);
    expect(await audit.list({ action: "conflict.superseded" })).toEqual([]);

    // ---- Zweitens: der HAUPT-WEG. `service.ts:598` nennt `onKoRevised` „den aktiven Haupt-Weg";
    // sein Filter `:474` lässt `zweitmeinung` durch.
    const anzahl = await svc.onKoRevised(KO_B, 2, "system");
    expect(anzahl).toBe(1);
    const nachSweep = vermerk(await repo.findById(ziel.id));

    // ---- Beide Ergebnisse NEBENEINANDER, im selben Fall:
    expect({ rueckfall: nachGc, hauptweg: nachSweep }).toStrictEqual({
      rueckfall: {
        status: "zweitmeinung",
        resolutionReason: undefined,
        decidedBy: null,
        decision: null,
        secondOpinion: ZWEITMEINUNG_TEXT,
      },
      hauptweg: {
        status: "geloest",
        resolutionReason: "superseded",
        decidedBy: null,
        decision: null,
        // Der Freitext des Menschen steht weiter in einer Akte, die „kein menschlicher
        // Entscheider" als Grund trägt. Gemessen, nicht repariert (BEN: keine Korrekturpflicht).
        secondOpinion: ZWEITMEINUNG_TEXT,
      },
    });
    expect((await audit.list({ action: "conflict.superseded" })).map((e) => e.target)).toEqual([
      ziel.id,
    ]);
  });
});

// ================================================================================================
// LIEFERUNG 5 · `closeOpenForKo` MIT GEMISCHTEM BESTAND — EIN AUFRUF, VIER ZUSTÄNDE
// ================================================================================================
describe("JOB 3899 · closeOpenForKo mit gemischtem Bestand (repo.ts:104-115)", () => {
  it("beendet genau die nicht gelösten Befunde DIESES Beitrags und gibt exakt sie zurück", async () => {
    const { repo, audit, svc } = aufbau(false);
    const offen = await befundIm(svc, "offen");
    const eskaliert = await befundIm(svc, "eskaliert");
    const zweitmeinung = await befundIm(svc, "zweitmeinung");
    const entschieden = await befundIm(svc, "geloest");
    // Der Fehlalarm-Weg (`dismiss`, `service.ts:153`) erzeugt denselben Terminalzustand mit einem
    // anderen Grund — auch er muss unberührt bleiben.
    const fehlalarm = await befundIm(svc, "offen");
    await svc.dismiss(fehlalarm.id, MENSCH, "Kein Widerspruch, andere Anlage.");
    // Ein Befund eines FREMDEN Paares: er darf von diesem Aufruf nicht berührt werden.
    const fremd = await svc.createAuto(
      { koA: "ko-x", koB: "ko-y", type: "truth", description: "Fremdes Paar." },
      { trigger: "validation", method: "model" },
    );

    const anzahl = await svc.onKoRemoved(KO_B, "system-loeschung");

    // (a) WELCHE BEENDET WERDEN — und dass die Rückgabeliste GENAU sie enthält, in einem Aufruf.
    expect(anzahl).toBe(3);
    expect(repo.closeRufe).toEqual([
      { koId: KO_B, beendet: [offen.id, eskaliert.id, zweitmeinung.id] },
    ]);

    // (b) Die Rückgabeliste ist laut `repo.ts:36-38` die Grundlage für Belege und Löschbeleg —
    //     gemessen an den tatsächlich geschriebenen Belegen.
    const entfernt = await audit.list({ action: "conflict.participant-removed" });
    expect(entfernt.map((e) => e.target)).toEqual([offen.id, eskaliert.id, zweitmeinung.id]);
    expect((await audit.list({ action: "conflict.auto-resolved" })).map((e) => e.target)).toEqual([
      offen.id,
      eskaliert.id,
      zweitmeinung.id,
    ]);

    // (c) Was aus den drei Beendeten wurde — vollständig, Feld für Feld.
    expect(vermerk(await repo.findById(offen.id))).toStrictEqual(
      beendetMit(AUSGANG.offen, "participant_deleted"),
    );
    expect(vermerk(await repo.findById(eskaliert.id))).toStrictEqual(
      beendetMit(AUSGANG.eskaliert, "participant_deleted"),
    );
    expect(vermerk(await repo.findById(zweitmeinung.id))).toStrictEqual(
      beendetMit(AUSGANG.zweitmeinung, "participant_deleted"),
    );

    // (d) WELCHE UNBERÜHRT BLEIBEN: beide menschlichen Abschlüsse und das fremde Paar.
    expect(vermerk(await repo.findById(entschieden.id))).toStrictEqual(AUSGANG.geloest);
    expect(vermerk(await repo.findById(fehlalarm.id))).toStrictEqual({
      status: "geloest",
      resolutionReason: "dismissed",
      decidedBy: MENSCH,
      decision: "Kein Widerspruch, andere Anlage.",
      secondOpinion: null,
    });
    expect(vermerk(await repo.findById(fremd.id))).toStrictEqual(AUSGANG.offen);
  });
});

// ================================================================================================
// DER EINZIGE WEG, AUF DEM `decidedBy: null` ÜBERHAUPT ETWAS LÖSCHT — UND EIN GEMESSENER WIDERSPRUCH
// ================================================================================================
//
// `escalate` (`service.ts:167`) prüft über `require` (`:168`), NICHT über `requireOpen`. Ein bereits
// menschlich entschiedener Wahrheitskonflikt lässt sich also erneut eskalieren. Danach trägt die
// Akte einen Status ≠ „geloest" UND einen menschlichen Entscheider samt Entscheidungstext — der
// einzige erreichbare Zustand, in dem `decidedBy: null` in `service.ts:221`/`:483` wirklich etwas
// entfernt. Auf jedem anderen Weg ist diese Zuweisung ein Nullgriff, weil `decidedBy` nur zusammen
// mit dem Terminalzustand gesetzt wird.
//
// KEINE REPARATUR: BEN hat „keine Korrekturpflicht" geschrieben; der Befund steht im REST-Abschnitt
// der Rückgabe. Hier wird er nur festgenagelt.
describe("JOB 3899 · der wieder eskalierte Befund — dort löscht `decidedBy: null` wirklich", () => {
  async function wiederEskaliert(svc: ConflictService): Promise<Conflict> {
    const c = await befundIm(svc, "geloest");
    await svc.escalate(c.id, MENSCH);
    return c;
  }

  const NACH_WIEDERESKALATION = {
    status: "eskaliert",
    resolutionReason: "decided",
    decidedBy: MENSCH,
    decision: ENTSCHEIDUNG_TEXT,
    secondOpinion: ZWEITMEINUNG_TEXT,
  };

  it("Weg 2 (onKoRevised) nullt den menschlichen Entscheider und dreht den Grund auf superseded", async () => {
    const { repo, svc } = aufbau(false);
    const ziel = await wiederEskaliert(svc);
    expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(NACH_WIEDERESKALATION);

    expect(await svc.onKoRevised(KO_B, 2, "system")).toBe(1);

    expect(vermerk(await repo.findById(ziel.id))).toStrictEqual({
      status: "geloest",
      resolutionReason: "superseded", // war „decided" — der menschliche Grund ist weg
      decidedBy: null, // war „controller-berger" — der Entscheider ist weg
      decision: ENTSCHEIDUNG_TEXT, // der Entscheidungstext bleibt stehen
      secondOpinion: ZWEITMEINUNG_TEXT, // die Zweitmeinung bleibt stehen
    });
  });

  it("Weg 3 (onKoRemoved) tut dasselbe mit dem Grund participant_deleted", async () => {
    const { repo, svc } = aufbau(false);
    const ziel = await wiederEskaliert(svc);
    expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(NACH_WIEDERESKALATION);

    expect(await svc.onKoRemoved(KO_B, "system-loeschung")).toBe(1);

    expect(vermerk(await repo.findById(ziel.id))).toStrictEqual({
      status: "geloest",
      resolutionReason: "participant_deleted",
      decidedBy: null,
      decision: ENTSCHEIDUNG_TEXT,
      secondOpinion: ZWEITMEINUNG_TEXT,
    });
  });

  it("Weg 1 (Lese-GC) verliert auch hier das CAS und lässt alle fünf Felder stehen", async () => {
    const { repo, audit, svc, versionen } = aufbau(true);
    const ziel = await wiederEskaliert(svc);
    versionen.set(KO_B, 2);

    expect(await svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    expect(repo.casRufe).toEqual([{ id: ziel.id, gewonnen: false }]);
    expect(vermerk(await repo.findById(ziel.id))).toStrictEqual(NACH_WIEDERESKALATION);
    expect(await audit.list({ action: "conflict.superseded" })).toEqual([]);
  });
});
