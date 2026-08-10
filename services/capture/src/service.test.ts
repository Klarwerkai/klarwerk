import { beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../app/src/build-app";
import { DRAFTS_BODY_LIMIT } from "../../app/src/routes/capture-routes";
import { InterviewSession } from "./interview";
import { type DraftRepo, InMemoryDraftRepo } from "./repo";
import { PgDraftRepo } from "./repo-pg";
import { CaptureService } from "./service";

describe("CaptureService", () => {
  let service: CaptureService;

  beforeEach(() => {
    service = new CaptureService({ repo: new InMemoryDraftRepo() });
  });

  it("FR-CAP-06: Entwurf landet im gemeinsamen Pool", async () => {
    await service.createDraft({ title: "Idee A" }, "anna");
    await service.createDraft({ title: "Idee B" }, "bob");
    const pool = await service.listDrafts();
    expect(pool).toHaveLength(2);
  });

  it("FR-CAP-07: beim Fortsetzen bleibt der Originalautor erhalten", async () => {
    const draft = await service.createDraft({ title: "Roh" }, "anna");
    const continued = await service.continueDraft(draft.id, { statement: "ausgearbeitet" }, "bob");
    expect(continued.originalAuthor).toBe("anna");
    expect(continued.lastEditor).toBe("bob");
    expect(continued.payload.statement).toBe("ausgearbeitet");
  });

  it("FR-CAP-07: KO-Eingabe trägt den Entwurfs-Autor, nicht den Bearbeiter", async () => {
    const draft = await service.createDraft(
      {
        title: "Ventil schließen",
        statement: "Bei Überdruck schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
      "anna",
    );
    await service.continueDraft(draft.id, { tags: ["druck"] }, "bob");
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.author).toBe("anna");
    // SCRUM-395: KEIN hartes 3 mehr im Capture-Modul — ohne Angabe bleibt das Feld leer,
    // knowledge-object löst den Default zentral auf (Admin-Standard, sonst Modul-Default).
    expect(koInput.neededValidations).toBeUndefined();
  });

  // SCRUM-509 R2: die im Entwurf gewählte Vertraulichkeit übersteht das Promote (kein Verlust →
  // sonst würde ein vertraulicher Entwurf als intern zum KO = fail-open).
  it("SCRUM-509 R2: die Vertraulichkeitsstufe des Entwurfs wandert in die KO-Eingabe (kein Verlust)", async () => {
    const draft = await service.createDraft(
      {
        title: "Geheim",
        statement: "Vertraulicher Kerntext.",
        type: "best_practice",
        category: "Anlage 1",
        confidentiality: "vertraulich",
      },
      "anna",
    );
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.confidentiality).toBe("vertraulich");
  });

  // SCRUM-524 P.1 (WP5): bodyHtml wird an der PERSISTENZ-Grenze serverseitig sanitisiert. Entwürfe sind
  // ein geteilter Pool und werden beim Fortsetzen im Editor gerendert → aktives Markup darf NIE persistiert
  // werden. Ohne die Sanitisierung in createDraft/continueDraft landete der Roh-Payload im Bestand.
  it("WP5: <script>/onerror/javascript:/<iframe> werden beim createDraft entfernt", async () => {
    const draft = await service.createDraft(
      {
        title: "XSS",
        bodyHtml:
          "<p>ok <b>fett</b></p><script>alert(1)</script>" +
          '<img src=x onerror="alert(2)">' +
          '<a href="javascript:alert(3)">klick</a>' +
          '<iframe src="https://evil.example"></iframe>',
      },
      "anna",
    );
    const stored = (await service.getDraft(draft.id))!.payload.bodyHtml ?? "";
    // Aktives Markup weg:
    expect(stored).not.toContain("<script");
    expect(stored).not.toContain("onerror");
    expect(stored).not.toContain("javascript:");
    expect(stored).not.toContain("<iframe");
    // Harmlose Formatierung überlebt (der Sanitizer normalisiert <b> → <strong>):
    expect(stored).toContain("<strong>fett</strong>");
    expect(stored).toContain("ok");
  });

  it("WP5: auch continueDraft sanitisiert einen neu gesetzten bodyHtml", async () => {
    const draft = await service.createDraft({ title: "Roh" }, "anna");
    const continued = await service.continueDraft(
      draft.id,
      { bodyHtml: "<p>hallo</p><script>steal()</script>" },
      "bob",
    );
    expect(continued.payload.bodyHtml ?? "").not.toContain("<script");
    expect(continued.payload.bodyHtml ?? "").toContain("hallo");
    // Und wirklich SO persistiert (nicht nur im Rückgabewert):
    const stored = (await service.getDraft(draft.id))!.payload.bodyHtml ?? "";
    expect(stored).not.toContain("<script");
  });

  it("WP5: leerer/kein bodyHtml bleibt unverändert (kein Zwang)", async () => {
    const a = await service.createDraft({ title: "A" }, "anna");
    expect((await service.getDraft(a.id))!.payload.bodyHtml).toBeUndefined();
    const b = await service.createDraft({ title: "B", bodyHtml: "" }, "anna");
    expect((await service.getDraft(b.id))!.payload.bodyHtml).toBe("");
  });

  it("SCRUM-395: eine im Entwurf gesetzte Prüferanzahl wandert unverändert in die KO-Eingabe", async () => {
    const draft = await service.createDraft(
      {
        title: "Ventil schließen",
        statement: "Bei Überdruck schließen.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 4,
      },
      "anna",
    );
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.neededValidations).toBe(4);
  });

  it("FR-CAP-08: ungültige Validierungsanzahl wird abgewiesen", async () => {
    await expect(service.createDraft({ neededValidations: 0 }, "anna")).rejects.toMatchObject({
      code: "INVALID_NEEDED",
    });
  });

  it("toKoInput verlangt vollständige Pflichtfelder", async () => {
    const draft = await service.createDraft({ title: "nur Titel" }, "anna");
    await expect(service.toKoInput(draft.id)).rejects.toMatchObject({ code: "INCOMPLETE" });
  });
});

// ================================================================================================
// AUFTRAG-JOB507-D4 — DIE 413-/201-PERSISTENZKANTE, REAL AUSGEFUEHRT.
// ================================================================================================
//
// Das Word-Panel schickt seinen Entwurf an POST /api/drafts. Die Route traegt einen eigenen
// bodyLimit (DRAFTS_BODY_LIMIT, 5 MiB — capture-routes.ts) und antwortet darueber mit einem
// kontrollierten 413. Bisher war NUR die Statuszeile dieses Falls getestet
// (routes/drafts-body-limit.test.ts prueft die 201-Seite) — nicht die Frage, die den Nutzer
// wirklich betrifft: LIEGT DANN EIN HALBER ENTWURF IM POOL?
//
// Hier laeuft deshalb kein Mock, sondern die reale App gegen den realen Capture-Pool, und gezaehlt
// wird der BESTAND, nicht der Statuscode:
//   · ueber dem Limit → 413 und der Pool bleibt bei 0 (Create-0),
//   · darunter        → 201 und der Pool traegt genau 1 (Create-1).
// Die Kalibrierung ist Teil der Aussage: ohne den 201-Zweig waere „0 Entwuerfe" auch dann gruen,
// wenn createDraft ueberhaupt nicht mehr funktioniert.
describe("AUFTRAG-JOB507-D4: POST /api/drafts — 413 legt NICHTS an, 201 legt genau EINEN an", () => {
  async function adminApp(): Promise<{
    app: ReturnType<typeof buildApp>;
    headers: Record<string, string>;
  }> {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "d4@klarwerk.test", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "d4@klarwerk.test", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  async function poolSize(
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
  ): Promise<number> {
    const res = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(res.statusCode).toBe(200);
    return (res.json() as unknown[]).length;
  }

  it("Body ueber DRAFTS_BODY_LIMIT → 413 und der Entwurfspool bleibt leer; danach 201 → genau ein Entwurf", async () => {
    const { app, headers } = await adminApp();
    expect(await poolSize(app, headers)).toBe(0);

    // Create-0: ein Word-Import ueber dem Transport-Cap.
    const zuGross = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Riesiges Handbuch aus Word",
        statement: "Zu grosser Import.",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: `<p>${"x".repeat(DRAFTS_BODY_LIMIT + 1024)}</p>`,
        origin: "frontdoor",
      },
    });
    expect(zuGross.statusCode).toBe(413);
    expect(await poolSize(app, headers)).toBe(0);

    // Create-1: derselbe Weg, nur im Rahmen — der Beleg, dass die 0 oben nicht am Aufbau lag.
    const passt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Ventil entlasten vor der Wartung",
        statement: "Bei Ueberdruck zuerst entlasten.",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: "<p>Ventil entlasten vor der Wartung</p>",
        origin: "frontdoor",
      },
    });
    expect(passt.statusCode).toBe(201);
    expect(await poolSize(app, headers)).toBe(1);

    // Und der EINE Entwurf ist wirklich der kleine — nicht ein Rest des abgewiesenen.
    const pool = (await app.inject({ method: "GET", url: "/api/drafts", headers })).json() as {
      payload: { title?: string; bodyHtml?: string };
    }[];
    expect(pool[0]?.payload.title).toBe("Ventil entlasten vor der Wartung");
    expect(pool[0]?.payload.bodyHtml ?? "").toContain("Ventil entlasten vor der Wartung");
  });

  it("ein zweites Uebergross-Ereignis aendert den Bestand nicht (413 ist wiederholbar folgenlos)", async () => {
    const { app, headers } = await adminApp();
    for (let i = 0; i < 2; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers,
        payload: {
          title: `Versuch ${i}`,
          statement: "x",
          type: "best_practice",
          category: "Allgemein",
          bodyHtml: `<p>${"y".repeat(DRAFTS_BODY_LIMIT + 1024)}</p>`,
          origin: "frontdoor",
        },
      });
      expect(res.statusCode, `Versuch ${i}`).toBe(413);
    }
    expect(await poolSize(app, headers)).toBe(0);
  });
});

describe("InterviewSession (FR-CAP-02)", () => {
  it("stellt eine Frage pro Schritt und schließt nach genügend Antworten ab", () => {
    const session = new InterviewSession();
    let steps = 0;
    while (!session.isComplete()) {
      const q = session.currentQuestion();
      expect(q).toBeTruthy();
      session.answer(`Antwort ${steps}`);
      steps += 1;
    }
    expect(steps).toBeGreaterThanOrEqual(4);
    expect(session.currentQuestion()).toBeUndefined();
    const result = session.result();
    expect(result.title).toBe("Antwort 0");
    expect(result.conditions).toEqual(["Antwort 1"]);
  });
});

// ================================================================================================
// JOB 510 / R10 — DIE WORD-HERKUNFT UEBERLEBT SPEICHERN UND LADEN.
// ================================================================================================
//
// Die PG-Abbildung speichert den GANZEN Draft als jsonb (repo-pg.ts: `data jsonb NOT NULL`).
// Dieser Fake bildet genau das nach: JSON.stringify beim Schreiben, JSON.parse beim Lesen. Damit
// ist der Persistenzweg ohne Datenbank und ohne Netz pruefbar, und In-Memory- und PG-Abbildung
// werden am selben Vertrag gemessen — ohne Schemaaenderung, weil die Herkunft im JSON mitreist.
class JsonRoundTripDraftRepo implements DraftRepo {
  private readonly rows = new Map<string, string>();

  insert(draft: Draft): Promise<void> {
    this.rows.set(draft.id, JSON.stringify(draft));
    return Promise.resolve();
  }

  findById(id: string): Promise<Draft | undefined> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? (JSON.parse(row) as Draft) : undefined);
  }

  update(draft: Draft): Promise<void> {
    this.rows.set(draft.id, JSON.stringify(draft));
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }

  list(): Promise<Draft[]> {
    return Promise.resolve([...this.rows.values()].map((row) => JSON.parse(row) as Draft));
  }
}

// Fremde/ungueltige Werte kommen aus einem Client-Body und nicht aus dem Typ — der Cast bildet
// genau das nach, ohne die Typwahrheit im Produktcode aufzuweichen.
const fremdeHerkunft = (wert: string): NonNullable<DraftPayload["origin"]> =>
  wert as unknown as NonNullable<DraftPayload["origin"]>;

describe("JOB 510 R10: Herkunft word_addin uebersteht Speichern und Laden", () => {
  const dienst = (repo: DraftRepo): CaptureService => new CaptureService({ repo });

  it("In-Memory: word_addin bleibt word_addin", async () => {
    const s = dienst(new InMemoryDraftRepo());
    const draft = await s.createDraft({ title: "Aus Word", origin: "word_addin" }, "anna");
    expect(draft.payload.origin).toBe("word_addin");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBe("word_addin");
  });

  it("Persistenz (PG-Abbildung, jsonb-Rundlauf): word_addin bleibt word_addin", async () => {
    const s = dienst(new JsonRoundTripDraftRepo());
    const draft = await s.createDraft({ title: "Aus Word", origin: "word_addin" }, "anna");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBe("word_addin");
  });

  it("Fortsetzen verliert die Word-Herkunft nicht", async () => {
    const s = dienst(new JsonRoundTripDraftRepo());
    const draft = await s.createDraft({ title: "Aus Word", origin: "word_addin" }, "anna");
    const weiter = await s.continueDraft(draft.id, { statement: "ergaenzt" }, "bob");
    expect(weiter.payload.origin).toBe("word_addin");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBe("word_addin");
  });

  it("nicht als Word markiert: vorhandener Wert bleibt unveraendert", async () => {
    const s = dienst(new JsonRoundTripDraftRepo());
    const draft = await s.createDraft({ title: "Vordertuer", origin: "frontdoor" }, "anna");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBe("frontdoor");
  });

  it("fehlende Herkunft bleibt fehlend — kein stiller Default", async () => {
    const s = dienst(new JsonRoundTripDraftRepo());
    const draft = await s.createDraft({ title: "Ohne Herkunft" }, "anna");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBeUndefined();
  });

  it("leere Herkunft wird verworfen, nicht zu frontdoor normalisiert", async () => {
    const s = dienst(new JsonRoundTripDraftRepo());
    const draft = await s.createDraft({ title: "Leer", origin: fremdeHerkunft("") }, "anna");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBeUndefined();
    expect(geladen?.payload.origin).not.toBe("frontdoor");
  });

  it("unbekannte Herkunft persistiert NICHT und wird nicht zu word_addin", async () => {
    const s = dienst(new JsonRoundTripDraftRepo());
    const draft = await s.createDraft({ title: "Fremd", origin: fremdeHerkunft("hacker") }, "anna");
    const geladen = await s.getDraft(draft.id);
    expect(geladen?.payload.origin).toBeUndefined();
    expect(geladen?.payload.origin).not.toBe("word_addin");
  });
});

// ================================================================================================
// JOB 510 / D3 — DER ECHTE PG-VERTRAG UND DIE VOLLSTAENDIGE HERKUNFTSMATRIX.
// ================================================================================================
//
// Warum das ueber den JSON-Rundlauf oben hinausgeht: `JsonRoundTripDraftRepo` bildet die
// jsonb-Semantik NACH, prueft aber nicht das gebundene Repository. Hier laeuft `PgDraftRepo`
// SELBST — mit einem Pool-Doppel statt einer Datenbank. Damit ist belegt, was der Fake nicht
// belegen kann: welcher SQL-Text abgesetzt wird, was im JSON-PARAMETER steht und was aus
// `DraftRow.data` zurueckkommt.

interface Abfrage {
  text: string;
  werte: unknown[];
}

/**
 * Pool-Doppel: genau die Teilmenge von `pg.Pool`, die `PgDraftRepo` benutzt (`query`).
 *
 * Es haelt den JSON-TEXT so, wie ihn das Repository als Parameter uebergibt, und liefert beim
 * Lesen ein GEPARSTES Objekt zurueck — genau die Asymmetrie des echten Treibers: hinein geht ein
 * String, aus einer jsonb-Spalte kommt ein Objekt. Wuerde das Doppel den String zurueckgeben,
 * pruefte der Test seine eigene Erfindung statt die Abbildung.
 */
class PoolDoppel {
  readonly abfragen: Abfrage[] = [];
  private readonly tabelle = new Map<string, string>();

  query<T>(text: string, werte: unknown[] = []): Promise<{ rows: T[] }> {
    this.abfragen.push({ text, werte });
    if (text.startsWith("INSERT") || text.startsWith("UPDATE")) {
      this.tabelle.set(werte[0] as string, werte[1] as string);
      return Promise.resolve({ rows: [] });
    }
    if (text.startsWith("SELECT data FROM drafts WHERE")) {
      const roh = this.tabelle.get(werte[0] as string);
      const rows = roh === undefined ? [] : [{ data: JSON.parse(roh) as Draft }];
      return Promise.resolve({ rows: rows as T[] });
    }
    if (text.startsWith("SELECT data FROM drafts ORDER BY")) {
      const rows = [...this.tabelle.values()].map((roh) => ({ data: JSON.parse(roh) as Draft }));
      return Promise.resolve({ rows: rows as T[] });
    }
    if (text.startsWith("DELETE")) {
      this.tabelle.delete(werte[0] as string);
      return Promise.resolve({ rows: [] });
    }
    throw new Error(`unerwartete Abfrage: ${text}`);
  }

  /** Der zuletzt als Parameter uebergebene JSON-Text zu dieser Id — die echte Schreibwahrheit. */
  letzterJsonParameter(id: string): string {
    const treffer = this.abfragen.filter(
      (a) => (a.text.startsWith("INSERT") || a.text.startsWith("UPDATE")) && a.werte[0] === id,
    );
    const letzte = treffer[treffer.length - 1];
    if (!letzte) {
      throw new Error(`kein Schreibparameter fuer ${id}`);
    }
    return letzte.werte[1] as string;
  }
}

// Das Doppel traegt bewusst nur `query`; der Cast bindet es an den Konstruktorvertrag, ohne den
// Produktcode aufzuweichen und ohne `any` (biome: noExplicitAny).
type PgPool = ConstructorParameters<typeof PgDraftRepo>[0];
const alsPool = (doppel: PoolDoppel): PgPool => doppel as unknown as PgPool;

describe("JOB 510 D3: PgDraftRepo selbst — Insert/Find/Update mit Pool-Doppel", () => {
  it("word_addin steht unveraendert im SQL-JSON-Parameter und in DraftRow.data", async () => {
    const doppel = new PoolDoppel();
    const repo = new PgDraftRepo(alsPool(doppel));
    const s = new CaptureService({ repo });

    const draft = await s.createDraft({ title: "Aus Word", origin: "word_addin" }, "anna");

    // (1) INSERT: der Parameter selbst traegt die Herkunft zeichengleich.
    const insert = doppel.abfragen[0];
    expect(insert?.text).toContain("INSERT INTO drafts");
    expect(insert?.werte[0]).toBe(draft.id);
    expect(doppel.letzterJsonParameter(draft.id)).toContain('"origin":"word_addin"');

    // (2) FIND: was aus `DraftRow.data` zurueckkommt, ist derselbe Wert.
    const geladen = await repo.findById(draft.id);
    expect(geladen?.payload.origin).toBe("word_addin");

    // (3) UPDATE ueber den Dienst: die Herkunft ueberlebt auch das Fortschreiben.
    const weiter = await s.continueDraft(draft.id, { statement: "ergaenzt" }, "bob");
    expect(weiter.payload.origin).toBe("word_addin");
    const update = doppel.abfragen.find((a) => a.text.startsWith("UPDATE"));
    expect(update?.text).toContain("UPDATE drafts SET data=$2 WHERE id=$1");
    expect(doppel.letzterJsonParameter(draft.id)).toContain('"origin":"word_addin"');
    const nachUpdate = await repo.findById(draft.id);
    expect(nachUpdate?.payload.origin).toBe("word_addin");
    expect(nachUpdate?.payload.statement).toBe("ergaenzt");
  });

  it("das Doppel erfindet nichts: ohne Herkunft steht kein origin im JSON-Parameter", async () => {
    const doppel = new PoolDoppel();
    const repo = new PgDraftRepo(alsPool(doppel));
    const s = new CaptureService({ repo });
    const draft = await s.createDraft({ title: "Ohne Herkunft" }, "anna");
    expect(doppel.letzterJsonParameter(draft.id)).not.toContain('"origin"');
    const geladen = await repo.findById(draft.id);
    expect(geladen?.payload.origin).toBeUndefined();
  });
});

// Die fuenf bekannten Werte des Vertrags — einzeln, nicht stellvertretend (BEN2-D2 Mangel 5).
const BEKANNTE_HERKUENFTE = ["tell", "studio", "expert", "frontdoor", "word_addin"] as const;

describe("JOB 510 D3: Herkunftsmatrix ueber Create/Read und Update/Continue", () => {
  const pgDienst = (): { s: CaptureService; doppel: PoolDoppel } => {
    const doppel = new PoolDoppel();
    return { s: new CaptureService({ repo: new PgDraftRepo(alsPool(doppel)) }), doppel };
  };

  for (const wert of BEKANNTE_HERKUENFTE) {
    it(`${wert}: Create/Read haelt den Wert zeichengleich (In-Memory und PG)`, async () => {
      const inMemory = new CaptureService({ repo: new InMemoryDraftRepo() });
      const a = await inMemory.createDraft({ title: wert, origin: wert }, "anna");
      expect((await inMemory.getDraft(a.id))?.payload.origin).toBe(wert);

      const { s, doppel } = pgDienst();
      const b = await s.createDraft({ title: wert, origin: wert }, "anna");
      expect(doppel.letzterJsonParameter(b.id)).toContain(`"origin":"${wert}"`);
      expect((await s.getDraft(b.id))?.payload.origin).toBe(wert);
    });

    it(`${wert}: Update/Continue setzt und erhaelt den Wert`, async () => {
      const { s } = pgDienst();
      // gesetzt ueber den Fortsetzungsweg (vorher gar keine Herkunft)
      const gesetzt = await s.createDraft({ title: "ohne" }, "anna");
      await s.continueDraft(gesetzt.id, { origin: wert }, "bob");
      expect((await s.getDraft(gesetzt.id))?.payload.origin).toBe(wert);

      // erhalten, wenn die Fortsetzung die Herkunft gar nicht mitschickt
      const erhalten = await s.createDraft({ title: "mit", origin: wert }, "anna");
      await s.continueDraft(erhalten.id, { statement: "ergaenzt" }, "bob");
      expect((await s.getDraft(erhalten.id))?.payload.origin).toBe(wert);
    });
  }

  it("fehlend: bleibt ueber Create/Read und Update/Continue fehlend — kein stiller Default", async () => {
    const { s, doppel } = pgDienst();
    const draft = await s.createDraft({ title: "Ohne" }, "anna");
    expect((await s.getDraft(draft.id))?.payload.origin).toBeUndefined();
    await s.continueDraft(draft.id, { statement: "ergaenzt" }, "bob");
    expect((await s.getDraft(draft.id))?.payload.origin).toBeUndefined();
    expect(doppel.letzterJsonParameter(draft.id)).not.toContain('"origin"');
  });

  it("leer: wird bei Create verworfen und bei Continue nicht nachgetragen", async () => {
    const { s, doppel } = pgDienst();
    const draft = await s.createDraft({ title: "Leer", origin: fremdeHerkunft("") }, "anna");
    expect((await s.getDraft(draft.id))?.payload.origin).toBeUndefined();
    expect(doppel.letzterJsonParameter(draft.id)).not.toContain('"origin"');

    // Und ueber den Fortsetzungsweg: eine leere Herkunft ueberschreibt eine gueltige NICHT mit
    // Muell — sie faellt weg. Eine erfundene Herkunft waere schlimmer als gar keine.
    const gueltig = await s.createDraft({ title: "Word", origin: "word_addin" }, "anna");
    await s.continueDraft(gueltig.id, { origin: fremdeHerkunft("") }, "bob");
    const geladen = await s.getDraft(gueltig.id);
    expect(geladen?.payload.origin).toBeUndefined();
    expect(geladen?.payload.origin).not.toBe("frontdoor");
  });

  it("unbekannt: wird bei Create verworfen und bei Continue nicht zu word_addin", async () => {
    const { s, doppel } = pgDienst();
    const draft = await s.createDraft({ title: "Fremd", origin: fremdeHerkunft("hacker") }, "anna");
    expect((await s.getDraft(draft.id))?.payload.origin).toBeUndefined();
    expect(doppel.letzterJsonParameter(draft.id)).not.toContain("hacker");

    const gueltig = await s.createDraft({ title: "Word", origin: "word_addin" }, "anna");
    await s.continueDraft(gueltig.id, { origin: fremdeHerkunft("hacker") }, "bob");
    const geladen = await s.getDraft(gueltig.id);
    expect(geladen?.payload.origin).toBeUndefined();
    expect(geladen?.payload.origin).not.toBe("word_addin");
    expect(doppel.letzterJsonParameter(gueltig.id)).not.toContain("hacker");
  });
});

// Typen aus dem Modulvertrag, ohne zusaetzliche Importzeile.
type Draft = import("./types").Draft;
type DraftPayload = import("./types").DraftPayload;
