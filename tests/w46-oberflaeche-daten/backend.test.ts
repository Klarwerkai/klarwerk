import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import {
  MUTATING_METHODS,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";
import { speicherVorgang } from "../../services/app/src/speicher-vorgang";
import { mapJiraIssueToImportItem } from "../../services/jira/src/mapper";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const daten = {
  type: "best_practice" as const,
  category: "Wartung",
  confidentiality: "intern" as const,
  title: "Eigenes Wissen",
  statement: "Ventil nach dem Anfahren prüfen.",
  tags: [],
};
const leser: Record<string, readonly string[]> = {
  koRepo: [
    "anhangSchreibstand",
    "findByCreateOperation",
    "findById",
    "findByImportCandidateId",
    "findCandidates",
    "list",
    "listByIds",
    "listForSearch",
    "missingBildInhalte",
    "missingImageNames",
  ],
  koVersions: ["findKoIdsInFassungen", "listByKo"],
  drafts: [
    "entwuerfeMitInhalt",
    "entwurfsIndexVon",
    "findById",
    "findTrashed",
    "list",
    "listByAuthor",
    "listPool",
    "listTrashed",
    "offeneEntwurfsIndizes",
  ],
  objects: ["findById", "list"],
  assignments: ["all", "find", "listByKos"],
  ratings: ["fruehereBewertungen", "listByKo", "listByKos"],
  conflictsRepo: ["all", "findById"],
  overlapRepo: ["all", "findById"],
};
describe("W4.6 tatsächliche Datenwege", () => {
  it("ordnet jeden öffentlichen Prototypport der betroffenen Ablagen explizit als Leser, Mutator oder Rollback ein", () => {
    const repos = inMemoryRepos();
    for (const [key, reads] of Object.entries(leser)) {
      const repo = repos[key as keyof typeof repos];
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(repo)).filter(
        (k) => k !== "constructor",
      );
      const writes = MUTATING_METHODS[key as keyof typeof repos];
      const known = [...reads, ...writes, "zuruecksetzen"];
      expect(
        methods.filter((k) => !known.includes(k)),
        key,
      ).toEqual([]);
      expect(
        reads.filter((k) => writes.includes(k)),
        key,
      ).toEqual([]);
      expect(
        writes.filter((k) => !methods.includes(k)),
        key,
      ).toEqual([]);
    }
  });

  it("Scratchjournal erhält echte Draft-CAS/Restore/Purge, Objektlöschung, Zuweisungs-CAS, Trust und Befund-CAS über Neustart", async () => {
    const { buildDevPersistServices } = await import("../../services/app/src/dev-persist");
    const journal = join(mkdtempSync(join(tmpdir(), "kw-w46-journal-")), "journal.jsonl");
    const a = await buildDevPersistServices(journal);
    const konsumiert = await a.capture.createDraft({ title: "Verbraucht" }, "autor");
    await a.capture.entwurfVerbraucht(konsumiert.id);
    const wieder = await a.capture.createDraft({ title: "Wiederhergestellt" }, "autor");
    await a.capture.deleteDraft(wieder.id, "autor");
    await a.capture.restoreDraft(wieder.id);
    const weg = await a.capture.createDraft({ title: "Weg" }, "autor");
    await a.capture.deleteDraft(weg.id, "autor");
    await a.capture.purgeTrashedDraft(weg.id);
    const ref = await a.objects.put({
      name: "synthetisch.txt",
      mime: "text/plain",
      data: "data:text/plain;base64,eA==",
    });
    expect(await a.objects.delete(ref.id)).toBe(true);
    const b = await buildDevPersistServices(journal);
    expect(await b.capture.getDraft(konsumiert.id)).toBeUndefined();
    expect(await b.capture.findTrashedDraft(konsumiert.id)).toBeUndefined();
    expect((await b.capture.getDraft(wieder.id))?.payload.title).toBe("Wiederhergestellt");
    expect(await b.capture.findTrashedDraft(weg.id)).toBeUndefined();
    expect(await b.objects.read(ref.id)).toBeUndefined();

    // Public repo contracts on real journaled repos, replayed from the actual JSONL bytes.
    const raw = inMemoryRepos();
    const zeilen: string[] = [];
    const file = join(mkdtempSync(join(tmpdir(), "kw-w46-repopruefung-")), "journal.jsonl");
    const r = journaledRepos(raw, (e) => {
      const line = JSON.stringify(e);
      appendFileSync(file, `${line}\n`);
      zeilen.push(line);
    });
    const svc = assembleServices(r);
    const ko = await svc.ko.create({ ...daten, author: "autor" });
    await r.koRepo.bumpTrust(ko.id, 12, 100);
    await svc.validation.assign(ko.id, ["pruefer"], "kurator");
    const z = await r.assignments.find(ko.id, "pruefer");
    if (!z) throw new Error("Zuweisung fehlt");
    expect(
      await r.assignments.replaceIf?.(z, { ...z, zugewiesenAm: "2026-10-26T10:12:00.000Z" }),
    ).toBe(true);
    const ov = await svc.overlaps.createAuto(
      {
        koA: ko.id,
        koB: "zweite-seite",
        koAVersion: ko.version,
        koBVersion: 1,
        relation: "teilweise",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren_pruefen",
      },
      { method: "deterministic", trigger: "manual", lexicalScore: 0.8 },
    );
    expect(await r.overlapRepo.supersedeIfOpen(ov.id, { status: "geschlossen" })).toBe(true);
    const fresh = inMemoryRepos();
    await replayJournal(
      fresh,
      readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map((line, i) => ({ lineNumber: i + 1, entry: JSON.parse(line) })),
    );
    expect((await fresh.koRepo.findById(ko.id))?.trust).toBe(12);
    expect((await fresh.assignments.find(ko.id, "pruefer"))?.zugewiesenAm).toBe(
      "2026-10-26T10:12:00.000Z",
    );
    expect((await fresh.overlapRepo.findById(ov.id))?.status).toBe("geschlossen");
    expect(readFileSync(journal, "utf8")).toContain('"method":"purge"');
  });

  it("journalisiert einen erfolgreichen bedingten Befundinsert ohne flüchtigen Prüffunktionsport und lässt einen abgewiesenen ohne Spur", async () => {
    const raw = inMemoryRepos();
    const zeilen: string[] = [];
    const file = join(mkdtempSync(join(tmpdir(), "kw-w46-repopruefung-")), "journal.jsonl");
    const r = journaledRepos(raw, (e) => {
      const line = JSON.stringify(e);
      appendFileSync(file, `${line}\n`);
      zeilen.push(line);
    });
    const services = assembleServices(r);
    const ov = await services.overlaps.createAuto(
      {
        koA: "a",
        koB: "b",
        koAVersion: 1,
        koBVersion: 1,
        relation: "teilweise",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren_pruefen",
      },
      { method: "deterministic", trigger: "manual", lexicalScore: 0.8 },
    );
    const candidate = { ...ov, id: "bedingter-befund" };
    expect(await r.overlapRepo.insertIfVersionsCurrent(candidate, () => true)).toBe(true);
    const vorher = zeilen.length;
    expect(
      await r.overlapRepo.insertIfVersionsCurrent({ ...candidate, id: "abgewiesen" }, () => false),
    ).toBe(false);
    expect(zeilen).toHaveLength(vorher);
    expect(JSON.parse(zeilen.at(-1) ?? "{}")).toMatchObject({
      method: "insert",
      args: [{ id: candidate.id }],
    });
    expect(JSON.parse(zeilen.at(-1) ?? "{}").args).toHaveLength(1);
    const fresh = inMemoryRepos();
    await replayJournal(
      fresh,
      readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map((line, i) => ({ lineNumber: i + 1, entry: JSON.parse(line) })),
    );
    expect(await fresh.overlapRepo.findById(candidate.id)).toEqual(candidate);
    expect(await fresh.overlapRepo.findById("abgewiesen")).toBeUndefined();
  });

  it("echter Scratchjournal-Schreibfehler stellt die gemeinsame Speichertransaktion zurück und startet ohne halben Stand neu", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "kw-w46-sharedtx-")), "journal.jsonl");
    let fail = false;
    const raw = inMemoryRepos();
    const repos = journaledRepos(raw, (e) => {
      if (fail && e.repo === "ruecknahmeVorgang" && e.method === "abschluss") {
        fail = false;
        throw new Error("synthetischer Journal-Schreibfehler");
      }
      appendFileSync(file, `${JSON.stringify(e)}\n`);
    });
    const svc = assembleServices(repos);
    const ko = await svc.ko.create({ ...daten, author: "autor" });
    const v = speicherVorgang(repos);
    if (!v) throw new Error("Gemeinsame Transaktion fehlt");
    fail = true;
    await expect(
      v.klammer(async (tx) => {
        await v.repos.koRepo.update({ ...ko, title: "HALBER-STAND" }, tx);
      }),
    ).rejects.toThrow("synthetischer Journal-Schreibfehler");
    expect((await raw.koRepo.findById(ko.id))?.title).toBe(daten.title);
    const fresh = inMemoryRepos();
    await replayJournal(
      fresh,
      readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map((line, i) => ({ lineNumber: i + 1, entry: JSON.parse(line) })),
    );
    expect((await fresh.koRepo.findById(ko.id))?.title).toBe(daten.title);
  });

  it("Demo-Purge lässt eigenes pilot-demo-Wissen stehen und entfernt nur echte Systemmarker mit wahren Zählern", async () => {
    const w = await baueFrischeBuehne();
    const eigen = await w.services.ko.create({
      ...daten,
      tags: ["pilot-demo"],
      author: w.konto.experte.id,
    });
    const demo = await w.services.ko.create({
      ...daten,
      title: "Umbenannte Demo",
      author: "system",
    });
    const row = await w.repos.koRepo.findById(demo.id);
    if (!row) throw new Error("Demo fehlt");
    await w.repos.koRepo.update({ ...row, demoSeed: true });
    const res = await w.app.inject({
      method: "DELETE",
      url: "/api/admin/demo-seed",
      headers: { authorization: `Bearer ${w.sitzung.admin}` },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().kos).toBe(1);
    expect(await w.services.ko.get(eigen.id)).toBeDefined();
    expect(await w.services.ko.get(demo.id)).toBeUndefined();
  });

  it.each(["quarantaene", "quellleser", "quellenanker"] as const)(
    "alle freien Ausgaben sperren geschützte Quellen und lassen die legitime Quelle weiter zu: %s",
    async (art) => {
      const w = await baueFrischeBuehne();
      const admin = { authorization: `Bearer ${w.sitzung.admin}` };
      const offen = await w.services.ko.create({
        ...daten,
        title: "OFFENER-KONTROLLTEXT",
        author: w.konto.admin.id,
      });
      const sperre = await w.services.ko.create({
        ...daten,
        title: "GESPERRTER-MARKERTEXT",
        author: w.konto.admin.id,
        statement:
          art === "quarantaene"
            ? "Personalnummer: 4711081"
            : "Quellinhalt nur im ursprünglichen Leserkreis",
        ...(art === "quellenanker"
          ? {
              sources: [
                {
                  id: "s",
                  author: "system",
                  at: "2026-10-26T10:00:00.000Z",
                  label: "Jira",
                  kind: "external" as const,
                  url: null,
                  excerpt: null,
                  peerValidated: false,
                  sourceRestrictions: { users: [], groups: ["hr-only"] },
                },
              ],
            }
          : {}),
      });
      if (art === "quellleser")
        await w.services.ko.setQuellrechte(
          sperre.id,
          { stufe: "intern", leser: [w.konto.admin.id] },
          "system",
        );
      for (const ko of [offen, sperre])
        await w.services.ko.setValidationState(ko.id, { status: "validiert", trust: 99 });
      const source = await w.app.inject({
        method: "GET",
        url: "/api/output/sources",
        headers: admin,
      });
      expect(source.body).toContain(offen.id);
      expect(source.body).not.toContain(sperre.id);
      const post = (id: string) =>
        w.app.inject({
          method: "POST",
          url: "/api/output/generate",
          headers: admin,
          payload: { kind: "faq", koIds: [id] },
        });
      expect((await post(offen.id)).statusCode).toBe(200);
      expect((await post(sperre.id)).statusCode).toBe(400);
      for (const url of [
        "/api/output/wochenupdate",
        "/api/library/export?format=markdown",
        `/api/verantwortung/person/${w.konto.admin.id}/vermaechtnis`,
      ]) {
        const r = await w.app.inject({ method: "GET", url, headers: admin });
        expect(r.statusCode, r.body).toBe(200);
        expect(r.body, url).not.toContain("GESPERRTER-MARKERTEXT");
        expect(r.body, url).toContain("OFFENER-KONTROLLTEXT");
      }
    },
  );

  it("Jira: echte Rollen-E-Mails reisen durch Import, Kandidat und Annahme in wirksame Quellenleser; fremdes Konto erhält 404", async () => {
    vi.stubEnv("KLARWERK_JIRA_IMPORT", "1");
    vi.stubEnv("KLARWERK_JIRA_BASE_URL", "https://jira.example.test");
    vi.stubEnv("KLARWERK_JIRA_USER", "synthetisch@example.test");
    vi.stubEnv("KLARWERK_JIRA_TOKEN", "fiktiv");
    vi.stubEnv("KLARWERK_JIRA_PROJECT", "HR");
    let emails: string[] = [];
    vi.stubGlobal("fetch", async (input: unknown) => {
      const u = new URL(String(input));
      if (u.hostname !== "jira.example.test") throw new Error("Fremdnetz ist gesperrt");
      const data = u.pathname.endsWith("/role")
        ? { Leser: "https://jira.example.test/rest/api/2/project/HR/role/1" }
        : u.pathname.endsWith("/role/1")
          ? {
              actors: emails.map((email, i) => ({
                type: "atlassian-user-role-actor",
                actorUser: { accountId: `source-${i}`, emailAddress: email },
              })),
            }
          : {
              id: "HR-1",
              key: "HR-1",
              fields: {
                project: { key: "HR" },
                summary: "JIRA-LESERECHT",
                description: "Nur für benannte Leser.",
                issuetype: { name: "Story" },
                updated: "2026-10-26T10:00:00Z",
              },
            };
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const w = await baueFrischeBuehne();
    emails = [w.konto.admin.email, w.konto.experte.email];
    const admin = { authorization: `Bearer ${w.sitzung.admin}` };
    const imported = await w.app.inject({
      method: "POST",
      url: "/api/admin/import/jira/apply",
      headers: admin,
      payload: { keys: ["HR-1"] },
    });
    expect(imported.statusCode, imported.body).toBe(200);
    const cand = await w.app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: admin,
    });
    const list = cand.json().candidates ?? cand.json();
    expect(list).toHaveLength(1);
    const accepted = await w.app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${list[0].id}`,
      headers: admin,
      payload: { action: "accept" },
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    const ko = (await w.services.ko.list()).find((k) => k.title === "JIRA-LESERECHT");
    if (!ko) throw new Error("Angenommener Beitrag fehlt");
    expect(ko.quellrechte?.leser?.sort()).toEqual([w.konto.admin.id, w.konto.experte.id].sort());
    for (const [role, status] of [
      ["experte", 200],
      ["viewer", 404],
    ] as const) {
      const res = await w.app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}`,
        headers: { authorization: `Bearer ${w.sitzung[role]}` },
      });
      expect(res.statusCode, res.body).toBe(status);
    }
    const unknown = mapJiraIssueToImportItem(
      { key: "HR-X", fields: { summary: "Ungeklärte Rollen" } },
      { baseUrl: "https://jira.example.test", projectKey: "HR" },
    );
    expect((await w.services.library.quellrechteFuerKandidat(unknown))?.leser).toEqual([]);
  });
});
