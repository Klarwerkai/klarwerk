// ================================================================================================
// JOB 557 · D7 — DIE NACHARBEIT GEHT AN DEN VERANTWORTLICHEN, NICHT AN DEN ERZEUGER.
// ================================================================================================
//
// Pedis Entscheidung zu JOB 557: „Ja, kanonisches Eigentümer-Aggregat bauen." Begründung: „der
// Erzeuger ist nicht der Verantwortliche." Genau diese Gleichsetzung vollzieht der Validierungsweg
// heute — eine `warn`/`down`-Bewertung gibt das Objekt an `ko.author` zurück.
//
// DIESE DATEI IMPORTIERT `ownership` AUSDRÜCKLICH NICHT. Der rote Lauf muss am VERHALTEN scheitern,
// nicht an einem fehlenden Modul: ein „Failed to load url" belegt nur, dass eine Datei fehlt, und
// genau diese Klasse Red-first ist in dieser Auftragskette schon einmal zurückgewiesen worden.
// Das Aggregat wird deshalb hier über den Bestand gesetzt (Repo-Write mit Feldaufsatz) und nur
// über öffentliche Dienstwege gelesen.
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import {
  type CreateKoInput,
  InMemoryKoRepo,
  type KnowledgeObject,
  KoService,
} from "../../knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";

const ERZEUGERIN = "anna-erzeugerin";
const EIGENTUEMERIN = "eva-eigentuemerin";
const PRUEFERIN = "paula-prueferin";
const ZWEITE_PRUEFERIN = "petra-prueferin";

function koInput(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Aussage",
    statement: "Inhalt.",
    type: "best_practice",
    category: "Anlage 1",
    author: ERZEUGERIN,
    neededValidations: 1,
    ...overrides,
  };
}

/** Das Aggregat am Objekt — ohne das Modul zu importieren, damit der Red-first am Verhalten hängt. */
type MitAggregat = KnowledgeObject & {
  ownership?: { owner?: string; reviewers?: string[]; validators?: string[] };
};

function aggregat(ko: KnowledgeObject | undefined): MitAggregat["ownership"] {
  return (ko as MitAggregat | undefined)?.ownership;
}

describe("JOB 557 D7 · Rückgabe an den Verantwortlichen", () => {
  let repo: InMemoryKoRepo;
  let auditRepo: InMemoryAuditRepo;
  let koService: KoService;
  let service: ValidationService;
  let assignments: InMemoryAssignmentRepo;

  beforeEach(() => {
    repo = new InMemoryKoRepo();
    auditRepo = new InMemoryAuditRepo();
    // EIN Auditdienst für beide Seiten: die Hashkette ist fortlaufend, und der Beleg der Rückgabe
    // steht in derselben Reihe wie der der Anlage. Zwei Instanzen über demselben Repo wären zwar
    // lesbar, aber die Kette wäre eine Verabredung zwischen zwei Zählern.
    const audit = new AuditService({ repo: auditRepo });
    koService = new KoService({ repo, audit });
    assignments = new InMemoryAssignmentRepo();
    service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments,
      audit,
    });
  });

  /** Legt ein Objekt an und setzt das Aggregat DIREKT im Bestand (es gibt auf der Base keinen Weg). */
  async function mitEigentuemerin(owner: string = EIGENTUEMERIN): Promise<KnowledgeObject> {
    const ko = await koService.create(koInput());
    await repo.update({
      ...ko,
      ownership: { owner, reviewers: [], validators: [] },
    } as MitAggregat);
    const gelesen = await koService.get(ko.id);
    if (!gelesen) {
      throw new Error("Vorbereitung fehlgeschlagen: das Objekt ist nach dem Aufsatz nicht lesbar.");
    }
    return gelesen;
  }

  async function offeneFuer(koId: string): Promise<string[]> {
    const alle = await assignments.all();
    return alle.filter((a) => a.koId === koId && a.status === "open").map((a) => a.userId);
  }

  // ── E1–E3: die Wirkung. Auf der unveränderten Base sind alle drei ROT. ─────────────────────────

  it("E1 · bei `warn` bekommt die EIGENTUEMERIN die offene Zuweisung, nicht die Erzeugerin", async () => {
    const ko = await mitEigentuemerin();
    await service.rate(ko.id, PRUEFERIN, "warn");
    expect(
      await offeneFuer(ko.id),
      "Die Nacharbeit geht an `ko.author` — an die Person, die das Objekt geschrieben hat, statt an die benannte Eigentuemerin. Genau diese Gleichsetzung hat Pedis Entscheidung zu JOB 557 verworfen.",
    ).toContain(EIGENTUEMERIN);
  });

  it("E2 · die Erzeugerin bekommt sie NICHT — sie ist Provenienz, nicht Verantwortung", async () => {
    const ko = await mitEigentuemerin();
    await service.rate(ko.id, PRUEFERIN, "down");
    expect(await offeneFuer(ko.id)).not.toContain(ERZEUGERIN);
  });

  it("E3 · das Auditpayload nennt eine Nicht-Autorin NICHT `author` — und benennt sie wahrheitsgemäß", async () => {
    const ko = await mitEigentuemerin();
    await service.rate(ko.id, PRUEFERIN, "warn");
    const rueckgabe = (await auditRepo.all()).filter((e) =>
      String(e.action).startsWith("ko.returned-to-"),
    );
    expect(rueckgabe.length, "es gibt gar kein Rückgabeereignis").toBeGreaterThan(0);
    const payload = (rueckgabe[rueckgabe.length - 1]?.payload ?? {}) as Record<string, unknown>;
    // Erste Hälfte: kein Feld erklärt die Eigentuemerin zur Autorin.
    expect(
      payload.author,
      "das Payloadfeld `author` transportiert eine Person, die nicht der Autor ist",
    ).not.toBe(EIGENTUEMERIN);
    // Zweite Hälfte, und die ist der eigentliche Mangel: die Wahrheit muss POSITIV drinstehen.
    // Ein Beleg, der die Verantwortliche gar nicht nennt, ist nicht ehrlich, nur wortkarg.
    expect(Object.values(payload), "die Verantwortliche wird im Beleg gar nicht benannt").toContain(
      EIGENTUEMERIN,
    );
    // Und der Autor bleibt als Provenienz ablesbar — beide Angaben, jede an ihrem Namen.
    expect(payload.author, "die Provenienz fehlt im Beleg").toBe(ERZEUGERIN);
  });

  // ── DER AKTIONSNAME, jetzt positiv geprüft statt als Grenze gepinnt ───────────────────────────
  //
  // WAS HIER VORHER STAND UND WARUM ES WEG IST. Bis D8 hielt an dieser Stelle ein Fall namens
  // `GRENZE` fest, dass die Aktion auch bei benannter Eigentümerin `ko.returned-to-author` heisst.
  // Seine Begründung war ausdrücklich keine fachliche, sondern eine Scopegrenze: der Name sei ein
  // Vertrag mit zwei Verbrauchern, „die beide außerhalb der Lease dieses Auftrags liegen"
  // (`services/audit/src/repo.ts` und `apps/web/src/lib/validationStatus.ts`).
  //
  // Diese Begründung ist entfallen: D8 hat GENAU diese zwei Verbraucher im selben Durchgang
  // mitgezogen. Damit pinnte der Fall nur noch einen Zustand, den BEN als fachlich falsch verworfen
  // hat — der Erzeuger ist nicht der Verantwortliche —, und das Urteil zu D7 sagte dazu wörtlich, er
  // „schreibt bewusst den fachlich falschen Bestand `ko.returned-to-author` fest und belegt daher
  // keine Abnahme dieser Pflicht". Ein Test, der einen verworfenen Zustand festhält, ist keine
  // Zusicherung, sondern eine Bremse.
  //
  // An seiner Stelle steht jetzt die positive Prüfung desselben Vertrags. Die Ownerfrage O-557-2 ist
  // mit `ENTSCHEIDUNGEN/JOB-557.md` beantwortet („Ja, kanonisches Eigentümer-Aggregat bauen").
  it("E3b · bei benannter Eigentümerin heisst die Aktion ehrlich `ko.returned-to-owner`", async () => {
    const ko = await mitEigentuemerin();
    await service.rate(ko.id, PRUEFERIN, "warn");
    const rueckgabe = (await auditRepo.all()).filter((e) =>
      String(e.action).startsWith("ko.returned-to-"),
    );
    expect(rueckgabe.length, "es gibt gar kein Rückgabeereignis").toBeGreaterThan(0);
    expect(
      String(rueckgabe[rueckgabe.length - 1]?.action),
      "die Rückgabe an die Eigentümerin trägt weiterhin den Autornamen — genau die Gleichsetzung, die Pedis Entscheidung zu JOB 557 verworfen hat",
    ).toBe("ko.returned-to-owner");
  });

  // ── E4–E5: Bestandsschutz. Auf der Base GRÜN — sie dürfen es bleiben. ─────────────────────────

  it("E4 · Altbestand OHNE Aggregat: die Rückgabe geht weiterhin an die Autorin", async () => {
    const ko = await koService.create(koInput());
    await service.rate(ko.id, PRUEFERIN, "warn");
    expect(await offeneFuer(ko.id)).toContain(ERZEUGERIN);
  });

  it("E4b · und der Legacy-Beleg darf dann wahrheitsgemäß `author` heissen", async () => {
    const ko = await koService.create(koInput());
    await service.rate(ko.id, PRUEFERIN, "warn");
    const rueckgabe = (await auditRepo.all()).filter((e) =>
      String(e.action).startsWith("ko.returned-to-"),
    );
    const letzte = rueckgabe[rueckgabe.length - 1];
    // Hier IST die Verantwortliche die Autorin — der alte Name ist wahr und bleibt.
    expect(String(letzte?.action)).toBe("ko.returned-to-author");
    expect((letzte?.payload as Record<string, unknown> | undefined)?.author).toBe(ERZEUGERIN);
  });

  it("E5 · Gegenkontrolle: `up` erzeugt gar keine Rückgabe", async () => {
    const ko = await mitEigentuemerin();
    await service.rate(ko.id, PRUEFERIN, "up");
    expect(await offeneFuer(ko.id)).not.toContain(EIGENTUEMERIN);
    expect(await offeneFuer(ko.id)).not.toContain(ERZEUGERIN);
  });

  // ── E6–E8: die Fortschreibung. Auf der unveränderten Base ROT. ────────────────────────────────

  it("E6 · eine TATSÄCHLICHE Prüfzuweisung schreibt die Prüferinnen im Aggregat fort", async () => {
    const ko = await koService.create(koInput());
    await service.assign(ko.id, [PRUEFERIN, ZWEITE_PRUEFERIN], "controller");
    const nachher = aggregat(await koService.get(ko.id));
    expect(
      nachher?.reviewers,
      "die Zuweisung ist erfolgt, das Aggregat weiss nichts davon — `reviewers` ist damit ein bloss normalisierbares Eingabefeld",
    ).toEqual([PRUEFERIN, ZWEITE_PRUEFERIN]);
  });

  it("E6b · zweimal dieselbe Zuweisung ändert nichts (idempotent, dedupliziert)", async () => {
    const ko = await koService.create(koInput());
    await service.assign(ko.id, [PRUEFERIN], "controller");
    await service.assign(ko.id, [PRUEFERIN, PRUEFERIN], "controller");
    expect(aggregat(await koService.get(ko.id))?.reviewers).toEqual([PRUEFERIN]);
  });

  it("E6c · die Zuweisung erzeugt KEIN Eigentum — sie weiss nur, wer prüft", async () => {
    const ko = await koService.create(koInput());
    await service.assign(ko.id, [PRUEFERIN], "controller");
    const nachher = aggregat(await koService.get(ko.id));
    expect(nachher?.owner, "aus einer Prüfzuweisung ist Eigentum entstanden").toBeUndefined();
    // Und die Verantwortung bleibt damit beim Autor-Rückfall.
    await service.rate(ko.id, PRUEFERIN, "warn");
    expect(await offeneFuer(ko.id)).toContain(ERZEUGERIN);
  });

  it("E7 · eine ABGESCHLOSSENE Validierung schreibt die Validatorinnen fort", async () => {
    const ko = await koService.create(koInput({ neededValidations: 1 }));
    const ergebnis = await service.rate(ko.id, PRUEFERIN, "up");
    expect(ergebnis.status, "Vorbedingung: die Validierung ist abgeschlossen").toBe("validiert");
    expect(
      aggregat(await koService.get(ko.id))?.validators,
      "das Objekt ist validiert, das Aggregat nennt niemanden, der es validiert hat",
    ).toContain(PRUEFERIN);
  });

  it("E7b · die Admin-Validierung schreibt die entscheidende Identität fort", async () => {
    const ko = await koService.create(koInput());
    await service.adminValidate(ko.id, "adam-admin");
    expect(aggregat(await koService.get(ko.id))?.validators).toContain("adam-admin");
  });

  it("E8 · KALIBRIERUNG: ein frisches Objekt hat KEIN Aggregat — kein stiller Autor-Default", async () => {
    const ko = await koService.create(koInput());
    expect(
      aggregat(ko),
      "es entsteht Eigentum, ohne dass jemand es benannt hat — genau die verworfene Gleichsetzung",
    ).toBeUndefined();
  });
});
