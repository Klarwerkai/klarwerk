import { describe, expect, it } from "vitest";
import type { AuditEntry as WebAuditEntry } from "../../apps/web/src/api/types";
import { isReturnedForRework, returnedToAuthor } from "../../apps/web/src/lib/validationStatus";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
// JOB 557 D8: die Prüfung der Entscheidungsreferenz steht nicht in der Modulfassade. Der direkte
// Pfad ist das eingeführte Hausmuster — `tests/app/w3c-ko-validierungsreferenz-traeger-134.test.ts`
// importiert sie seit W3-C genauso.
import { pruefeValidationDecisionRef } from "../../services/audit/src/repo";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryLifecycleRepo, LifecycleService } from "../../services/lifecycle";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  ValidationService,
} from "../../services/validation";

function wire() {
  // JOB 557 D8: das Repo wird herausgereicht, damit ein Fall die Entscheidungsreferenz über den
  // EINZIGEN zugelassenen Leseweg (`findBySeq` + Kette) prüfen kann statt über eine spätere Suche.
  const repo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo });
  const koService = new KoService({ repo: new InMemoryKoRepo(), audit });
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    audit,
  });
  const lifecycle = new LifecycleService({ koService, repo: new InMemoryLifecycleRepo() });
  return { audit, repo, koService, validation, lifecycle };
}

const koInput = (author = "anna") => ({
  title: "Ventil schließen",
  statement: "Bei Überdruck Ventil X schließen.",
  type: "best_practice" as const,
  category: "Anlage 1",
  author,
  neededValidations: 2,
});

describe("SCRUM-124+126: Rückgabe & Revalidierung end-to-end", () => {
  it("SCRUM-124: Gelb-Feedback gibt das Objekt als offene Aufgabe an den Autor zurück", async () => {
    const { koService, validation, audit } = wire();
    const ko = await koService.create(koInput("anna"));
    await validation.rate(ko.id, "controller", "warn");

    const overview = await validation.overview({ sichtbar: () => true });
    expect(overview).toEqual([{ userId: "anna", open: 1, done: 0 }]);
    expect(await audit.list({ action: "ko.returned-to-author" })).toHaveLength(1);
  });

  it("SCRUM-126: validiert → erneut in Prüfung (Revalidierung erzeugt neue Version, Status offen)", async () => {
    const { koService, validation, lifecycle } = wire();
    const ko = await koService.create(koInput());

    // Zwei grüne Bewertungen → validiert.
    await validation.rate(ko.id, "u1", "up");
    await validation.rate(ko.id, "u2", "up");
    const validated = await koService.get(ko.id);
    expect(validated?.status).toBe("validiert");
    expect(validated?.version).toBe(1);

    // Revalidierung über den bestehenden confirmStillValid/revise-Pfad.
    const revalidated = await lifecycle.confirmStillValid(ko.id, "controller");
    expect(revalidated.status).toBe("offen"); // sichtbar zurück in Prüfung
    expect(revalidated.version).toBe(2); // neue Version
    expect(revalidated.trust).toBe(0); // Bewertungen zurückgesetzt

    // Erscheint wieder im Validierungs-Board (nur offene KOs).
    const board = await validation.board();
    expect(board.find((k) => k.id === ko.id)).toBeDefined();
  });
});

// ================================================================================================
// JOB 557 · D8 — DIE EHRLICHE AUDITSEMANTIK (BEN-Korrekturpflicht zu D7)
// ================================================================================================
//
// DER BEFUND, wörtlich aus dem Urteil: „`ko.returned-to-author` ist bei `responsibleKind = owner`
// eine unwahre Produktbezeichnung." Wer das Protokoll liest, erfährt, der Autor müsse nacharbeiten —
// zuständig ist in Wahrheit eine benannte Eigentümerin. Ein Audit, das die falsche Rolle nennt, ist
// schlimmer als keins: es sieht aus wie eine Auskunft.
//
// WARUM DIESE FÄLLE HIER STEHEN UND NICHT IN EINER ISOLIERTEN LIB-PRÜFUNG. BEN verlangt einen
// ÜBERGREIFENDEN Vertragstest: der Owner-Fall wird durch den echten `ValidationService` ausgelöst,
// und geprüft wird, was am Ende der Kette ankommt — der Auditname, das Payload, die
// Entscheidungsreferenz über ihren zugelassenen Leseweg UND der sichtbare Nacharbeitsstatus der
// Weboberfläche. Genau die Atomarität, an der D7 gemessen wurde: Emittent und beide Verbraucher.
const OWNER_ACTION = "ko.returned-to-owner";
const AUTHOR_ACTION = "ko.returned-to-author";

/** Die Serviceeinträge in der Form, die der Web-Verbraucher liest. Zwei Sichten, dieselben Daten. */
function alsWebEintraege(entries: readonly { seq: number }[]): WebAuditEntry[] {
  return entries as unknown as WebAuditEntry[];
}

describe("JOB 557 D8: das Auditereignis nennt die Rolle, die wirklich zuständig ist", () => {
  /** Ein KO mit BENANNTER Eigentümerin — der Fall, den D7 noch falsch protokollierte. */
  async function mitOwner() {
    const teile = wire();
    const ko = await teile.koService.create(koInput("anna"));
    // Der produktive, autorisierte Schreibweg aus D7 — keine Testabkürzung am Aggregat vorbei.
    await teile.koService.setOwnership(ko.id, { owner: "eva-eigentuemerin" }, "controller");
    return { ...teile, ko };
  }

  it("V1 · Owner-Fall: das neue Ereignis heisst ehrlich und nennt beide Rollen getrennt", async () => {
    const { koService, validation, audit, ko } = await mitOwner();
    await validation.rate(ko.id, "controller", "warn");

    const owner = await audit.list({ action: OWNER_ACTION, target: ko.id });
    expect(owner, "es gibt kein ehrlich benanntes Owner-Ereignis").toHaveLength(1);
    // Die Provenienz bleibt die Provenienz: `author` ist und bleibt die wirkliche Autorin.
    expect(owner[0]?.payload.author).toBe("anna");
    // Und die Zuständigkeit steht an ihrem eigenen Namen.
    expect(owner[0]?.payload.responsible).toBe("eva-eigentuemerin");
    expect(owner[0]?.payload.responsibleKind).toBe("owner");
    // Die Nacharbeit liegt auch tatsächlich bei ihr — nicht bei der Autorin.
    const overview = await validation.overview({ sichtbar: () => true });
    expect(overview).toEqual([{ userId: "eva-eigentuemerin", open: 1, done: 0 }]);
    // Gegenkontrolle am Bestand: das KO selbst hat die Autorin nicht verloren.
    expect((await koService.get(ko.id))?.author).toBe("anna");
  });

  it("V2 · Autor-Fallback: der bisherige Name bleibt — und bedeutet NUR noch den Fallback", async () => {
    // ZWEI Vorgänge im selben Lauf, weil die Zusage eine UNTERSCHEIDUNG ist. BEN verlangt, den
    // bisherigen Namen „nur dort" zu behalten, „wo tatsächlich der Autor-Fallback gemeint ist" —
    // und genau das ist am Bestand nicht belegbar: dort tragen beide Vorgänge denselben Namen, und
    // ein Leser kann aus ihm nichts ableiten. Ein Fall, der nur den Namen des Fallbacks prüfte,
    // wäre schon vor der Korrektur grün und bewiese nichts.
    const { koService, validation, audit } = wire();
    const ohneOwner = await koService.create(koInput("anna"));
    const mitOwner = await koService.create(koInput("anna"));
    await koService.setOwnership(mitOwner.id, { owner: "eva-eigentuemerin" }, "controller");

    await validation.rate(ohneOwner.id, "controller", "warn");
    await validation.rate(mitOwner.id, "controller", "warn");

    // Der Fallback behält seinen Namen und benennt sich selbst als solcher.
    const autor = await audit.list({ action: AUTHOR_ACTION });
    expect(autor, "der Autor-Fallback wurde mit umbenannt").toHaveLength(1);
    expect(autor[0]?.target).toBe(ohneOwner.id);
    expect(autor[0]?.payload.responsible).toBe("anna");
    expect(autor[0]?.payload.responsibleKind).toBe("author-fallback");

    // DIE EIGENTLICHE ZUSAGE: der Name ist jetzt eine Auskunft. Kein einziges
    // `ko.returned-to-author` gehört zu einem Vorgang mit benannter Eigentümerin.
    for (const eintrag of autor) {
      expect(
        eintrag.payload.responsibleKind,
        "ein Owner-Vorgang trägt weiterhin den Autor-Namen",
      ).toBe("author-fallback");
    }
  });

  it("V3 · der validationDecisionRef bleibt im Owner-Fall gültig", async () => {
    const { validation, repo, ko } = await mitOwner();
    const entscheidung = await validation.rate(ko.id, "controller", "down");

    const ref = entscheidung.validationDecisionRef;
    expect(ref, "die Rückgabe trägt keine Entscheidungsreferenz").not.toBeNull();
    // Der EINZIGE zugelassene Leseweg (KW-W3-19): Punktzugriff plus vorgelegte Kette — keine Suche.
    const eintrag = await repo.findBySeq(ref?.auditSeq ?? -1);
    const kette = await repo.all();
    expect(eintrag?.action, "die Referenz zeigt nicht auf das Owner-Ereignis").toBe(OWNER_ACTION);
    // Das ist der Fall, an dem ein unbedachter Namenswechsel zerbräche: eine dem
    // Audit-Repository unbekannte Aktion ergäbe `WRONG_EVENT_TYPE`, und die festgehaltene
    // Entscheidung am Objekt gälte als ungültig.
    expect(
      pruefeValidationDecisionRef(
        eintrag,
        ref as { auditSeq: number; auditHash: string },
        { koId: ko.id, koVersion: 1 },
        kette,
      ),
    ).toBe("OK");
  });

  it("V4 · der Nacharbeitsstatus bleibt im Owner-Fall sichtbar", async () => {
    const { validation, audit, ko } = await mitOwner();
    await validation.rate(ko.id, "controller", "warn");
    const eintraege = alsWebEintraege(await audit.list({ target: ko.id }));

    // Der zweite Verbraucher: das Board leitet „Nacharbeit" aus dem Ereignisnamen ab. Kennt es den
    // neuen Namen nicht, schweigt die Oberfläche — das Objekt wäre in Nacharbeit, ohne dass es
    // jemand sieht.
    expect(isReturnedForRework(eintraege, ko.id), "das Board sieht die Nacharbeit nicht").toBe(
      true,
    );

    // Und die persönliche Aufgabenliste der AUTORIN bleibt leer: zuständig ist die Eigentümerin.
    // Ohne diese Zeile wäre der neue Name nur eine andere Art, dieselbe Rolle zu verwechseln.
    const kos = [
      { id: ko.id, author: "anna", createdAt: ko.createdAt } as Parameters<
        typeof returnedToAuthor
      >[1][number],
    ];
    expect(returnedToAuthor(eintraege, kos, "anna")).toEqual([]);
  });

  it("V5 · ausschliesslich ehrliche Neuemissionen — kein neues ko.returned-to-author bei Owner", async () => {
    const { validation, audit, ko } = await mitOwner();
    await validation.rate(ko.id, "controller", "warn");
    // Zweite Rückgabe auf derselben Fassung: auch eine Wiederholung darf nicht auf den alten
    // Namen zurückfallen.
    await validation.rate(ko.id, "controller-2", "down");

    expect(
      await audit.list({ action: AUTHOR_ACTION, target: ko.id }),
      "bei benannter Eigentümerin ist ein neues ko.returned-to-author entstanden",
    ).toHaveLength(0);
    expect((await audit.list({ action: OWNER_ACTION, target: ko.id })).length).toBeGreaterThan(0);
  });

  // ── AUFTRAG-JOB-557 D10 · V6 — DAS ACTION-FELD ÜBERLEBT DEN WIREVERTRAG UNVERÄNDERT ────────────
  //
  // BEN zu D9, Prüflücke 1, zweiter Satz: „Ergänzend muss `tests/validation/return-and-revalidate.test.ts`
  // belegen, dass das vom Service emittierte Owner-Ereignis aus dem Audit-Repository mit
  // unverändertem Action-Feld in genau diesen Wirevertrag gelangt."
  //
  // V1 belegt die Emission, V4 den Verbraucher — dazwischen lag das Glied, das niemand gemessen
  // hat: die Serialisierung. `endpoints.audit.list()` ist `api.get<AuditEntry[]>("/audit")`, und
  // `apiFetch` liefert `JSON.parse(await res.text())`. Genau diese Runde wird hier nachgestellt:
  // Was der Emittent in das Repository schreibt, wird über JSON geschickt und auf der anderen
  // Seite wieder gelesen — und erst DANN geprüft.
  //
  // Warum die JSON-Runde kein Beiwerk ist: Sie ist die Stelle, an der ein Feld umbenannt, ein
  // `undefined` verschluckt oder ein Wert in eine andere Gestalt gebracht werden kann, ohne dass
  // ein serverseitiger Test es merkt. Der gemountete Kettenvertrag
  // `apps/web/src/pages/KnowledgeDetail.owner-chain.test.tsx` prüft die andere Hälfte — vom Draht
  // bis zum Bildschirm. Zusammen ist die Kette geschlossen.
  it("V6 · das emittierte Owner-Ereignis erreicht den Wirevertrag mit unverändertem Action-Feld", async () => {
    const { validation, audit, ko } = await mitOwner();
    await validation.rate(ko.id, "controller", "warn");

    // Das, was das Audit-Repository führt — der einzige zugelassene Leseweg.
    const ausDemRepo = await audit.list({ target: ko.id });

    // DIE WIRE-RUNDE, so wie `apiFetch` sie fährt: serialisieren, übertragen, wieder lesen.
    const ueberDenDraht = JSON.parse(JSON.stringify(ausDemRepo)) as WebAuditEntry[];

    const owner = ueberDenDraht.filter((e) => e.action === OWNER_ACTION);
    expect(
      owner,
      "nach der JSON-Runde trägt kein Eintrag mehr den Aktionsnamen des Emittenten — das Feld " +
        "`action` hat den Wirevertrag nicht überlebt",
    ).toHaveLength(1);

    // Der Wiretyp `AuditEntry` (apps/web/src/api/types.ts:603) verlangt genau diese Felder. Fehlt
    // eines nach der Serialisierung, ist der Vertrag gebrochen, auch wenn `action` stimmt.
    const eintrag = owner[0] as WebAuditEntry;
    for (const feld of ["seq", "at", "actor", "action", "target", "payload", "hash"] as const) {
      expect(eintrag[feld], `das Wirefeld \`${feld}\` fehlt nach der Übertragung`).toBeDefined();
    }
    expect(eintrag.target).toBe(ko.id);

    // Und der Verbraucher, der am anderen Ende steht, erkennt die Nacharbeit AUF DIESEN DATEN —
    // nicht auf den Serviceobjekten. Ohne diese Zeile bliebe die Runde eine Formalie.
    expect(
      isReturnedForRework(ueberDenDraht, ko.id),
      "die über den Draht gelesenen Einträge ergeben keinen Nacharbeitsstatus mehr",
    ).toBe(true);

    // GEGENPROBE: derselbe Weg mit umbenanntem Aktionsfeld bricht ihn. Ohne sie wäre nicht belegt,
    // dass die Zusicherung oben überhaupt am Namen hängt.
    const verfaelscht = ueberDenDraht.map((e) =>
      e.action === OWNER_ACTION ? { ...e, action: "ko.irgendwas" } : e,
    );
    expect(
      isReturnedForRework(verfaelscht, ko.id),
      "ein umbenanntes Action-Feld ändert nichts — dann prüft die Zusicherung oben nicht den Namen",
    ).toBe(false);
  });
});
