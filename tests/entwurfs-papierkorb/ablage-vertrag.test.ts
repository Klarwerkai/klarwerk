// ==================================================================================================
// JOB 3668 — EIN GELÖSCHTER ENTWURF IST WIEDERHERSTELLBAR.
// ==================================================================================================
//
// PEDIS BEFUND, wörtlich (11.09.2026, 11:19 UTC):
//
//     „Ich habe eben alle Entwürfe gelöscht. Nicht einer befindet sich im Papierkorb."
//
// Und der zweite Satz, der den eigentlichen Fehler benennt: *„Am schlimmsten finde ich, dass wir
// gleiche Funktionen anders behandeln auf jeweiligen Seiten."* Wissensobjekte HABEN einen
// Papierkorb (`services/knowledge-object/src/service.ts:3475` `trashed`, `:3517` `restore`,
// `:3531` `purgeTrashed`); Entwürfe hatten keinen — `repo-pg.ts:162` führte `DELETE FROM drafts`
// aus, und danach war die Zeile fort.
//
// DAS MUSTER IST ÜBERNOMMEN, NICHT ERFUNDEN. Es ist zeichengleich das des Wissensobjekts:
// ein `deletedAt` IM DOKUMENT (`knowledge-object/src/types.ts:354`), das Papierkorbprädikat
// `data ? 'deletedAt'` in der Abfrage (`knowledge-object/src/repo-pg.ts:493`), und drei getrennte
// Handgriffe — weich löschen, wiederherstellen, endgültig entfernen. Wo diese Datei vom Vorbild
// abweicht, steht der Grund am jeweiligen Fall.
//
// WARUM DER VERTRAG IN DER ABLAGE GEPRÜFT WIRD UND NICHT NUR AN DER ROUTE: Weil genau dort der
// Befund saß. Eine Oberfläche, die „Papierkorb" sagt, während die Zeile weiterhin hart gelöscht
// wird, wäre die Scheinlösung, die der Auftrag in §5 ausdrücklich verbietet. Zuerst muss die
// Ablage den Entwurf behalten; alles andere baut darauf auf.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { PgDraftRepo } from "../../services/capture/src/repo-pg";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft } from "../../services/capture/src/types";

function entwurf(id: string, over: Partial<Draft> = {}): Draft {
  return {
    id,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
      confidentiality: "intern",
      origin: "studio",
      pendingSources: [{ label: "Prüfbericht", url: "https://x.invalid/p", objectId: "obj-1" }],
    },
    originalAuthor: "anna",
    lastEditor: "anna",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...over,
  };
}

/** Ein Pool-Doppel, das jede abgesetzte Anweisung mitschreibt. Vorbild: `job2684-d3`. */
function pooldoppel(antwort: { rows?: unknown[]; rowCount?: number } = {}) {
  const gesehen: { sql: string; params: unknown[] }[] = [];
  const pool = {
    query: async (sql: string, params: unknown[]) => {
      gesehen.push({ sql, params });
      return { rows: antwort.rows ?? [], rowCount: antwort.rowCount ?? 0 };
    },
  } as unknown as ConstructorParameters<typeof PgDraftRepo>[0];
  return { pool, gesehen, sql: () => gesehen.map((g) => g.sql).join("\n") };
}

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · A — Löschen ist umkehrbar", () => {
  it("nach dem Löschen ist der Entwurf aus der lebenden Sicht fort, liegt aber im Papierkorb", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));

    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    expect(await repo.findById("d-1")).toBeUndefined();
    const getrasht = await repo.findTrashed("d-1");
    expect(getrasht?.deletedAt).toBe("2026-09-12T07:00:00.000Z");
    expect(getrasht?.deletedBy).toBe("anna");
  });

  it("Wiederherstellen bringt den Entwurf VOLLSTÄNDIG zurück — Titel, Rumpf, Quelle, Zeit, Vertraulichkeit", async () => {
    const repo = new InMemoryDraftRepo();
    const vorher = entwurf("d-1");
    await repo.insert(vorher);
    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    const zurueck = await repo.restore("d-1");

    // Zeichengleich der Ausgangsstand — keine Hülle, und keine Spur des Papierkorbs mehr.
    expect(zurueck).toEqual(vorher);
    expect(await repo.findById("d-1")).toEqual(vorher);
    expect(await repo.findTrashed("d-1")).toBeUndefined();
    expect(zurueck && "deletedAt" in zurueck).toBe(false);
  });

  it("Wiederherstellen eines Entwurfs, der NICHT im Papierkorb liegt, tut nichts", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));
    expect(await repo.restore("d-1")).toBeUndefined();
    expect(await repo.restore("gibt-es-nicht")).toBeUndefined();
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · B — Der Papierkorb ist kein Schlupfloch (Auftrag §4.5)", () => {
  it("`listTrashed` zeigt nur Gelöschtes, jüngste Löschung zuerst — wie `KoService.trashed`", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-alt"));
    await repo.insert(entwurf("d-neu"));
    await repo.insert(entwurf("d-lebt"));
    await repo.delete("d-alt", "anna", "2026-09-12T07:00:00.000Z");
    await repo.delete("d-neu", "anna", "2026-09-12T08:00:00.000Z");

    expect((await repo.listTrashed()).map((d) => d.id)).toEqual(["d-neu", "d-alt"]);
  });

  it("mit Autor eingegrenzt: ein FREMDER Entwurf ist im Papierkorb NICHT sichtbar", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-anna", { originalAuthor: "anna" }));
    await repo.insert(entwurf("d-bodo", { originalAuthor: "bodo" }));
    await repo.delete("d-anna", "anna", "2026-09-12T07:00:00.000Z");
    await repo.delete("d-bodo", "bodo", "2026-09-12T07:30:00.000Z");

    // Die Eingrenzung geschieht IN DER ABLAGE (JOB 2696s Lehre) — nicht erst beim Anzeigen.
    expect((await repo.listTrashed("anna")).map((d) => d.id)).toEqual(["d-anna"]);
    expect((await repo.listTrashed("bodo")).map((d) => d.id)).toEqual(["d-bodo"]);
  });

  it("`findTrashed` liefert einen LEBENDEN Entwurf nicht — der Papierkorb ist kein zweiter Lesepfad auf den Bestand", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));
    expect(await repo.findTrashed("d-1")).toBeUndefined();
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · C — Endgültig löschen ist der ZWEITE Griff (Auftrag §4.4)", () => {
  // RUNDE 2 — DIE BEDINGUNG IST IN DIE LÖSCHENDE ANWEISUNG GEWANDERT. Im Dienst, VOR dem Löschen,
  // liess sie ein Fenster für ein gleichzeitiges `restore` offen (Abschnitt N), und im echten
  // PostgreSQL-Lauf vom 12.09. entfernte die Ablage einen lebenden Entwurf, den der Dienst zu
  // schützen behauptete. Es bleibt trotzdem EINE Mechanik — dieselbe Methode, ein Prädikat mehr
  // oder weniger, kein zweiter harter Weg an ihr vorbei (SCRUM-523 P.3). Deshalb hier BEIDE
  // Aufrufformen, und der SICHERE ist der ohne Wort.
  it("die Ablage entfernt von sich aus NUR aus dem Papierkorb — ein lebender Entwurf bleibt stehen", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));

    // Der zweite Griff kann den ersten nicht überspringen — und zwar bereits in der Ablage, nicht
    // erst in einer Prüfung davor, an der ein gleichzeitiger Aufruf vorbeikommt.
    expect(await repo.purge("d-1")).toBe(false);
    expect(await repo.findById("d-1")).toBeDefined();

    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");
    expect(await repo.purge("d-1")).toBe(true);
    expect(await repo.list()).toEqual([]);
    expect(await repo.purge("d-1")).toBe(false);
  });

  it("`auchLebende` ist das eine Wort für den VERBRAUCH — dieselbe Methode, ein Prädikat weniger", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));

    // Wäre der Verbrauch an den Papierkorb gebunden, müsste ein übernommener Entwurf erst
    // „gelöscht" werden, um gehen zu dürfen — und wäre dazwischen wiederherstellbar.
    expect(await repo.purge("d-1", true)).toBe(true);
    expect(await repo.list()).toEqual([]);
    expect(await repo.findTrashed("d-1")).toBeUndefined();
  });

  it("der DIENST lässt den zweiten Griff den ersten nicht überspringen", async () => {
    const repo = new InMemoryDraftRepo();
    const dienst = new CaptureService({ repo });
    await repo.insert(entwurf("d-1"));

    await expect(dienst.purgeTrashedDraft("d-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await repo.findById("d-1")).toBeDefined();

    await dienst.deleteDraft("d-1", "anna");
    await dienst.purgeTrashedDraft("d-1");
    expect(await repo.list()).toEqual([]);
    await expect(dienst.purgeTrashedDraft("d-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · C2 — DREI GRÜNDE, aus denen ein Entwurf verschwindet, und sie sind nicht gleich", () => {
  // Der Auftrag hat das in seiner Nachführung vom 12.09. selbst korrigiert: „die harte Löschung
  // nicht stehen lassen" war zu pauschal. Für zwei der drei Wege IST die harte Löschung richtig.
  it("1 · der Mensch löscht → Papierkorb, umkehrbar", async () => {
    const repo = new InMemoryDraftRepo();
    const dienst = new CaptureService({ repo });
    await repo.insert(entwurf("d-1"));

    await dienst.deleteDraft("d-1", "anna");

    expect((await dienst.listTrashedDrafts()).map((d) => d.id)).toEqual(["d-1"]);
    expect((await dienst.findTrashedDraft("d-1"))?.deletedBy).toBe("anna");
    expect((await dienst.restoreDraft("d-1")).id).toBe("d-1");
  });

  it("2 · ein Promote hat ihn VERBRAUCHT → hart, und NICHT in den Papierkorb", async () => {
    const repo = new InMemoryDraftRepo();
    const dienst = new CaptureService({ repo });
    await repo.insert(entwurf("d-1"));

    await dienst.entwurfVerbraucht("d-1");

    // Läge er im Papierkorb, liesse er sich wiederherstellen — und stünde als Dublette neben dem
    // Wissensobjekt, das aus ihm geworden ist. Genau das darf nicht sein.
    expect(await dienst.listTrashedDrafts()).toEqual([]);
    expect(await repo.list()).toEqual([]);
    await expect(dienst.restoreDraft("d-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("3 · endgültig aus dem Papierkorb → hart, und hier ist die harte Löschung das Gewollte", async () => {
    const repo = new InMemoryDraftRepo();
    const dienst = new CaptureService({ repo });
    await repo.insert(entwurf("d-1"));
    await dienst.deleteDraft("d-1", "anna");

    await dienst.purgeTrashedDraft("d-1");

    expect(await repo.list()).toEqual([]);
    expect(await repo.findTrashed("d-1")).toBeUndefined();
  });

  it("ein zweites Löschen verschiebt den Löschzeitpunkt nicht (sonst wäre jede Frist dehnbar)", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));
    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");
    await repo.delete("d-1", "bodo", "2026-09-12T09:00:00.000Z");

    const getrasht = await repo.findTrashed("d-1");
    expect(getrasht?.deletedAt).toBe("2026-09-12T07:00:00.000Z");
    expect(getrasht?.deletedBy).toBe("anna");
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · D — Der Anker eines getrashten Entwurfs bleibt zählbar", () => {
  // DIE ABWEICHUNG VOM WISSENSOBJEKT, ausdrücklich: `KoService.list` trimmt den Papierkorb im
  // DIENST weg, `KoRepo.list` liefert ihn. Hier gibt es keinen solchen Dienstfilter, den ich
  // ändern dürfte — deshalb trägt `repo.list()` den Papierkorb weiter, und die Sicht auf einen
  // Menschen trimmt die Route.
  //
  // WARUM DAS NICHT NUR BEQUEM, SONDERN NOTWENDIG IST: `objectReferences.drafts`
  // (`services/app/src/build-app.ts:756`) und die Anhangquellen (`:2339`) zählen über `list()`,
  // ob ein gesichertes Original noch gebraucht wird. Verschwände ein getrashter Entwurf daraus,
  // dürfte sein Originaldokument entfernt werden — und die Wiederherstellung lieferte einen
  // Entwurf mit fehlendem Anker, dessen Rumpf `withAnchorCheck` ausdünnt. Genau die Hülle, die
  // §4.3 verbietet. Das Wissensobjekt hält seinen Anker aus demselben Grund
  // (`knowledge-object/src/repo-pg.ts:161`).
  it("`list()` enthält den getrashten Entwurf, `findById` nicht", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));
    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    expect((await repo.list()).map((d) => d.id)).toEqual(["d-1"]);
    expect((await repo.listByAuthor("anna")).map((d) => d.id)).toEqual(["d-1"]);
    expect(await repo.findById("d-1")).toBeUndefined();
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · E — Ein getrashter Entwurf ist nicht beschreibbar", () => {
  it("`updateWennStand` und `update` holen ihn nicht durch die Hintertür zurück", async () => {
    const repo = new InMemoryDraftRepo();
    const vorher = entwurf("d-1");
    await repo.insert(vorher);
    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    const versuch = { ...vorher, payload: { ...vorher.payload, title: "Untergeschoben" } };
    expect(await repo.updateWennStand(versuch, vorher.updatedAt)).toBe(false);
    await repo.update(versuch);

    expect(await repo.findById("d-1")).toBeUndefined();
    expect((await repo.findTrashed("d-1"))?.payload.title).toBe("Dichtungswechsel L4");
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · F — Dienst und Route sehen den getrashten Entwurf nicht", () => {
  it("`CaptureService` behandelt ihn als nicht vorhanden — alle Wege, ein Urteil", async () => {
    const repo = new InMemoryDraftRepo();
    const dienst = new CaptureService({ repo });
    await repo.insert(entwurf("d-1"));
    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    expect(await dienst.getDraft("d-1")).toBeUndefined();
    await expect(dienst.continueDraft("d-1", { title: "X" }, "anna")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(dienst.deleteDraft("d-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(dienst.toKoInput("d-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("DELETE /api/drafts/:id nimmt ihn aus der Liste — und vernichtet ihn NICHT (der Befund von Pedi)", async () => {
    const repo = new InMemoryDraftRepo();
    const app = buildApp({ ...buildServices(), capture: new CaptureService({ repo }) });
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: "anna@x.de", password: "secret123" },
    });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${anmeldung.json().token}` };

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: { title: "Dichtungswechsel L4", bodyHtml: "<p>Text</p>", confidentiality: "intern" },
    });
    expect(angelegt.statusCode).toBeLessThan(300);
    const id = angelegt.json().id as string;

    const geloescht = await app.inject({ method: "DELETE", url: `/api/drafts/${id}`, headers });
    expect(geloescht.statusCode).toBe(204);

    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(liste.statusCode).toBe(200);
    expect((liste.json() as { id: string }[]).map((d) => d.id)).toEqual([]);

    // Und das ist der Unterschied zu vorher: er ist nicht weg, er ist im Papierkorb.
    expect((await repo.findTrashed(id))?.payload.title).toBe("Dichtungswechsel L4");
  });
});

// --------------------------------------------------------------------------------------------
describe("JOB 3668 · G — Die Postgres-Hälfte, gepinnt", () => {
  // EHRLICH: In dieser Umgebung läuft kein PostgreSQL (kein `psql`, kein Docker-Socket). Gepinnt
  // ist hier, WAS der Adapter absetzt und wie er `rowCount`/`rows` auswertet — nicht, dass
  // PostgreSQL es so ausführt. Der Verhaltensbeweis gegen eine echte Datenbank steht in
  // `papierkorb-pg.integration.test.ts` und meldet einen SICHTBAREN Skip, wenn keine da ist.
  it("`delete` setzt KEIN `DELETE FROM drafts` mehr ab, sondern markiert", async () => {
    const { pool, gesehen, sql } = pooldoppel({ rowCount: 1 });
    await new PgDraftRepo(pool).delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    expect(sql()).not.toMatch(/DELETE\s+FROM\s+drafts/i);
    expect(gesehen[0]?.sql).toMatch(/UPDATE drafts SET data = data \|\| \$2::jsonb/);
    expect(gesehen[0]?.sql).toMatch(/NOT \(data \? 'deletedAt'\)/);
    expect(gesehen[0]?.params).toEqual([
      "d-1",
      JSON.stringify({ deletedAt: "2026-09-12T07:00:00.000Z", deletedBy: "anna" }),
    ]);
  });

  it("RUNDE 2: `purge` trägt die Papierkorb-Bedingung IN DERSELBEN Anweisung", async () => {
    // DAS IST DIE UNTEILBARKEIT, und sie ist an dieser einen Zeile zu sehen: Bedingung und
    // Löschung stehen in EINEM Statement. In Runde 1 stand die Bedingung im Dienst, VOR dem
    // Löschen — ein gleichzeitiges `restore` passte dazwischen (zwei erfüllte Zusagen, Bestand 0),
    // und im echten PostgreSQL-Lauf entfernte dieselbe Anweisung einen LEBENDEN Entwurf.
    const { pool, gesehen } = pooldoppel({ rowCount: 1 });
    expect(await new PgDraftRepo(pool).purge("d-1")).toBe(true);
    expect(gesehen[0]?.sql).toBe("DELETE FROM drafts WHERE id=$1 AND data ? 'deletedAt'");
    expect(gesehen[0]?.params).toEqual(["d-1"]);

    // `rowCount 0` heisst: er lag nicht (mehr) im Papierkorb. Der Dienst macht daraus 404 statt
    // einen Vollzug zu behaupten, den die Datenbank nicht bestätigt hat.
    const verloren = pooldoppel({ rowCount: 0 });
    expect(await new PgDraftRepo(verloren.pool).purge("d-1")).toBe(false);
  });

  it("`auchLebende` lässt genau das Prädikat weg — die Anweisung, die bisher in `delete` stand", async () => {
    // Die harte Löschung ist nicht verschwunden, sie hat ihren richtigen Namen bekommen und ihre
    // eine erlaubte Stelle: den VERBRAUCH nach einem Promote. Es ist DIESELBE Methode und
    // DIESELBE Anweisung — kein zweiter harter Weg an der Bedingung vorbei (SCRUM-523 P.3).
    const { pool, gesehen } = pooldoppel({ rowCount: 1 });
    expect(await new PgDraftRepo(pool).purge("d-1", true)).toBe(true);
    expect(gesehen[0]?.sql).toBe("DELETE FROM drafts WHERE id=$1");
    expect(gesehen[0]?.params).toEqual(["d-1"]);
  });

  it("die Lesepfade tragen genau das Prädikat, das sie tragen sollen", async () => {
    const lesen = async (tue: (r: PgDraftRepo) => Promise<unknown>) => {
      const { pool, gesehen } = pooldoppel({ rows: [] });
      await tue(new PgDraftRepo(pool));
      return gesehen[0]?.sql ?? "";
    };

    expect(await lesen((r) => r.findById("d-1"))).toMatch(/NOT \(data \? 'deletedAt'\)/);
    expect(await lesen((r) => r.findTrashed("d-1"))).toMatch(/AND data \? 'deletedAt'/);
    expect(await lesen((r) => r.listTrashed())).toMatch(/WHERE data \? 'deletedAt'/);
    expect(await lesen((r) => r.listTrashed("anna"))).toMatch(/data->>'originalAuthor' = \$1/);
    // Absichtlich OHNE Papierkorbfilter (Fall D): die Referenzprüfung zählt über `list()`.
    expect(await lesen((r) => r.list())).not.toMatch(/deletedAt/);
    expect(await lesen((r) => r.listByAuthor("anna"))).not.toMatch(/deletedAt/);
  });

  it("`restore` streift beide Papierkorb-Felder ab und liefert den Stand zurück", async () => {
    const zurueck = entwurf("d-1");
    const { pool, gesehen } = pooldoppel({ rows: [{ data: zurueck }], rowCount: 1 });
    expect(await new PgDraftRepo(pool).restore("d-1")).toEqual(zurueck);
    expect(gesehen[0]?.sql).toMatch(/data - 'deletedAt' - 'deletedBy'/);
    expect(gesehen[0]?.sql).toMatch(/WHERE id=\$1 AND data \? 'deletedAt'/);
    expect(gesehen[0]?.sql).toMatch(/RETURNING data/);
  });

  it("`update`/`updateWennStand` schreiben einen getrashten Entwurf nicht zurück ins Leben", async () => {
    const { pool, gesehen } = pooldoppel({ rowCount: 0 });
    const repo = new PgDraftRepo(pool);
    await repo.update(entwurf("d-1"));
    expect(await repo.updateWennStand(entwurf("d-1"), "2026-09-01T09:00:00.000Z")).toBe(false);
    for (const g of gesehen) {
      expect(g.sql).toMatch(/NOT \(data \? 'deletedAt'\)/);
    }
  });
});
