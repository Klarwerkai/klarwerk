import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { FRISTEN_PRUEFSTAND } from "../../services/app/src/klara-fristen";
import { AuditService, InMemoryAuditRepo, validationDecisionPruefer } from "../../services/audit";
import * as chain from "../../services/audit/src/chain";
import type { AuditEntry } from "../../services/audit/src/types";
import { CaptureService, InMemoryDraftRepo } from "../../services/capture";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { pruefnachweiseFuer } from "../../services/output/src/pruefnachweis";
import { MAX_OUTPUT_SOURCES, OutputService } from "../../services/output/src/service";
import { htmlToPlainText } from "../../services/structure";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const app of apps.splice(0)) await app.close();
});

async function welt() {
  const services = assembleServices(inMemoryRepos());
  const app = buildApp(services, { klaraErinnerungen: () => 60_000 });
  apps.push(app);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Admin", email: "admin@p5.test", password: "secret123" },
      })
    ).statusCode,
  ).toBe(201);
  const login = async (email: string) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    expect(r.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${r.json().token}` };
    return {
      headers,
      id: (await app.inject({ url: "/api/auth/me", headers })).json().id as string,
    };
  };
  const admin = await login("admin@p5.test");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin.headers,
        payload: { name: "Anna", email: "anna@p5.test", password: "secret123", role: "experte" },
      })
    ).statusCode,
  ).toBe(201);
  return { services, app, admin, anna: await login("anna@p5.test") };
}

describe("P5 · HTML und tatsächlich gespeicherte Entwürfe", () => {
  it.each(["<p", "<", "<br"])("100000 offene %s bleiben linear und Klartext wie bisher", (tag) => {
    const html = tag.repeat(100_000);
    const t = performance.now();
    expect(htmlToPlainText(html)).toBe(html);
    expect(performance.now() - t).toBeLessThan(300);
  });
  it("Block-/br-Abstände und einmalige Entitydekodierung bleiben erhalten", () => {
    expect(htmlToPlainText("<p>A&amp; B</p><div>C<br/>D &amp;uuml; &lt;x&gt;</div>")).toBe(
      "A& B C D &uuml; <x>",
    );
  });
  it("create und continue im Dienst leiten erst aus dem gesäuberten Body ab", async () => {
    const capture = new CaptureService({ repo: new InMemoryDraftRepo() });
    const a = await capture.createDraft(
      {
        title: "Rückfall",
        statement: "",
        bodyHtml: "<script>GIFT</script><p>Sauber &amp; gut.</p>",
      },
      "anna",
    );
    expect(a.payload.statement).toBe("Sauber & gut.");
    expect(a.payload.bodyHtml).not.toContain("GIFT");
    const b = await capture.continueDraft(
      a.id,
      {
        statement: "",
        bodyHtml: "<style>GIFT</style><p>Neu.</p>",
      },
      "anna",
    );
    expect(b.payload.statement).toBe("Neu.");
    expect(b.payload.bodyHtml).not.toContain("GIFT");
  });
  it("echte Anlage-/Speicherrouten verwenden denselben sauberen Rumpf und Titelrückfall", async () => {
    const w = await welt();
    const r = await w.app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: w.anna.headers,
      payload: { title: "Titelrückfall", statement: "", bodyHtml: "<script>GIFT</script>" },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().payload.statement).toBe("Titelrückfall");
    expect(r.json().payload.bodyHtml).not.toContain("GIFT");
    const t0 = performance.now();
    const offen = await w.app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: w.anna.headers,
      payload: { title: "Offener Text", statement: "", bodyHtml: "<p".repeat(100_000) },
    });
    expect(offen.statusCode).toBe(201);
    expect(performance.now() - t0).toBeLessThan(300);
    expect(offen.json().payload.statement.length).toBeLessThanOrEqual(500);
    const saved = await w.app.inject({
      method: "PUT",
      url: `/api/drafts/${r.json().id}`,
      headers: w.anna.headers,
      payload: { statement: "", bodyHtml: "<script>GIFT</script><p>Echter Inhalt.</p>" },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().payload.statement).toBe("Echter Inhalt.");
    expect(saved.json().payload.bodyHtml).not.toContain("GIFT");
  });
});

async function outputWelt() {
  const repo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo });
  const ko = new KoService({ repo: new InMemoryKoRepo(), audit });
  const ids: string[] = [];
  for (const title of ["A", "B"]) {
    const k = await ko.create({
      title,
      statement: title,
      author: "anna",
      type: "best_practice",
      category: "C",
      confidentiality: "intern",
    });
    await ko.setValidationState(k.id, { status: "validiert", trust: 99 });
    await audit.record({
      actor: "bea",
      action: "ko.rated",
      target: k.id,
      payload: { verdict: "up", koVersion: 1 },
    });
    const e = (await repo.all()).at(-1);
    if (!e) throw new Error("Audit fehlt");
    await ko.setValidationDecisionRef(k.id, { auditSeq: e.seq, auditHash: e.hash });
    ids.push(k.id);
  }
  return { ko, repo, ids, output: new OutputService({ koService: ko, audit: repo }) };
}

describe("P5 · Output-Auswahl und gebundene Auditprüfung", () => {
  it("Dubletten verschwinden stabil; jede echte Quelle wird genau einmal gelesen/geprüft", async () => {
    const w = await outputWelt();
    const get = vi.spyOn(w.ko, "get");
    const verify = vi.spyOn(chain, "verifyChain");
    const all = vi.spyOn(w.repo, "all");
    const out = await w.output.generate(
      { kind: "checklist", koIds: [w.ids[1]!, w.ids[0]!, w.ids[1]!] },
      () => true,
    );
    expect(out.provenance.map((p) => p.koId)).toEqual([w.ids[1], w.ids[0]]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(all).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(out.provenance.every((p) => p.letztePruefungAm !== null)).toBe(true);
  });
  it("mehr als die eindeutige Grenze wird ohne stille Quellenauslassung abgewiesen", async () => {
    const w = await outputWelt();
    const get = vi.spyOn(w.ko, "get");
    await expect(
      w.output.generate(
        {
          kind: "checklist",
          koIds: Array.from({ length: MAX_OUTPUT_SOURCES + 1 }, (_, i) => `ko-${i}`),
        },
        () => true,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(get).not.toHaveBeenCalled();
    const out = await w.output.generate(
      { kind: "checklist", koIds: Array(500).fill(w.ids[0]) },
      () => true,
    );
    expect(out.provenance).toHaveLength(1);
  });
  it("Deduplizieren umgeht weder Sicht noch Validierung noch Vertraulichkeit", async () => {
    const w = await outputWelt();
    const id = w.ids[0]!;
    await expect(
      w.output.generate({ kind: "checklist", koIds: [id, id] }, () => false),
    ).rejects.toMatchObject({ code: "UNKNOWN_KO" });
    await w.ko.setValidationState(id, { status: "offen", trust: 0 });
    await expect(
      w.output.generate({ kind: "checklist", koIds: [id, id] }, () => true),
    ).rejects.toMatchObject({ code: "NOT_VALIDATED" });
    await w.ko.setValidationState(id, { status: "validiert", trust: 99 });
    await w.ko.setConfidentiality(id, "vertraulich", "anna");
    await expect(
      w.output.generate({ kind: "checklist", koIds: [id, id] }, () => true),
    ).rejects.toMatchObject({ code: "CONFIDENTIAL" });
  });
  it("manipulierte Kette bleibt im echten Output-Prüfnachweis unsicher", async () => {
    const w = await outputWelt();
    const kos = await Promise.all(
      w.ids.map(async (id) => {
        const k = await w.ko.get(id);
        if (!k) throw new Error("KO fehlt");
        return k;
      }),
    );
    const kette = structuredClone(await w.repo.all());
    kette[0]!.payload = { manipuliert: true };
    const nachweise = await pruefnachweiseFuer(
      {
        all: async () => kette,
        findBySeq: (seq) => w.repo.findBySeq(seq),
      },
      kos,
    );
    expect(nachweise.map((p) => p.zustand)).toEqual(["HASH_MISMATCH", "HASH_MISMATCH"]);
  });
});

function kleineKette() {
  const a: AuditEntry = {
    seq: 1,
    at: "2026-10-25T00:00:00Z",
    actor: "anna",
    action: "ko.created",
    target: "ko-1",
    payload: {},
    prevHash: chain.GENESIS,
    hash: "",
  };
  a.hash = chain.hashEntry(a);
  const b: AuditEntry = {
    ...a,
    seq: 2,
    action: "ko.rated",
    payload: { koVersion: 3, verdict: "up" },
    prevHash: a.hash,
  };
  b.hash = chain.hashEntry(b);
  return [a, b];
}
describe("P5 · Audit-Prüfstand lässt die Referenzprüfungen nicht aus", () => {
  it("eigene Kopie gilt nur für diese Lesung; der nächste Aufruf erkennt eine neue Manipulation", () => {
    const k = kleineKette();
    const ziel = structuredClone(k[1]!);
    const ref = { auditSeq: 2, auditHash: ziel.hash };
    const subject = { koId: "ko-1", koVersion: 3 };
    const pruefe = validationDecisionPruefer(k);
    k[0]!.payload = { manipuliert: true };
    expect(pruefe(ziel, ref, subject)).toBe("OK");
    expect(validationDecisionPruefer(k)(ziel, ref, subject)).toBe("HASH_MISMATCH");
    expect(pruefe({ ...ziel, payload: { koVersion: 3, manipuliert: true } }, ref, subject)).toBe(
      "HASH_MISMATCH",
    );
    expect(pruefe(ziel, ref, { ...subject, koVersion: 4 })).toBe("WRONG_SUBJECT");
    expect(validationDecisionPruefer([])(ziel, ref, subject)).toBe("MISSING");
  });
  it.each(["ko.assigned", "unknown-hash-version"])(
    "auch nach gültiger Kette: %s wird nicht bestätigt",
    (fall) => {
      const k = kleineKette();
      const b = k[1]!;
      if (fall === "ko.assigned") {
        b.action = fall;
        b.hash = chain.hashEntry(b);
      } else b.hashVersion = 999;
      const state = validationDecisionPruefer(k)(
        b,
        { auditSeq: 2, auditHash: b.hash },
        { koId: "ko-1", koVersion: 3 },
      );
      expect(state).toBe(fall === "ko.assigned" ? "WRONG_EVENT_TYPE" : "HASH_MISMATCH");
    },
  );
});

it("P5 · 1000 Kalenderfristen: eine Bestandslesung, identischer Stand und frischer Quellschutz", async () => {
  const w = await welt();
  const source = await w.services.ko.create({
    title: "Kalenderquelle",
    statement: Array.from(
      { length: 1000 },
      (_, i) => `Lizenz MARKE-${i} Ablauf am 31.12.2027.`,
    ).join("\n"),
    type: "best_practice",
    category: "P5",
    author: w.admin.id,
    confidentiality: "intern",
  });
  const saved = await w.app.inject({
    method: "PUT",
    url: "/api/me/klara/fristen/regel",
    headers: w.anna.headers,
    payload: {
      fassung: 0,
      regel: {
        aktiv: true,
        quellen: [{ art: "wissensobjekt", id: source.id }],
        arten: ["ablauf"],
        bereich: "persoenlich",
        zeitzone: "Europe/Berlin",
        aenderung: "aktualisieren",
        widerruf: "unzuverlaessig_ohne_vorlauf",
        wiederpruefung: "relevante_aenderung_klaeren",
        pruefstand: FRISTEN_PRUEFSTAND,
      },
    },
  });
  expect(saved.statusCode, saved.body).toBe(200);
  expect(saved.json().fristen).toHaveLength(1000);
  const hole = vi.spyOn(w.services.klaraFristen, "hole");
  const kalender = () =>
    w.app.inject({ url: "/api/me/kalender?bereich=persoenlich", headers: w.anna.headers });
  const normal = await kalender();
  expect(normal.statusCode, normal.body).toBe(200);
  expect(normal.json().eintraege).toHaveLength(1000);
  expect(hole).toHaveBeenCalledTimes(1);
  await w.services.ko.setQuellrechte(
    source.id,
    { stufe: "intern", leser: [w.admin.id] },
    w.admin.id,
  );
  hole.mockClear();
  const entzogen = await kalender();
  expect(entzogen.statusCode).toBe(200);
  expect(hole).toHaveBeenCalledTimes(1);
  expect(entzogen.body).not.toContain("MARKE-");
  expect(
    entzogen
      .json()
      .eintraege.every(
        (e: { geschuetzt: boolean; titel: string | null }) => e.geschuetzt && e.titel === null,
      ),
  ).toBe(true);
  hole.mockClear();
  const einzel = await w.app.inject({
    url: `/api/me/kalender/eintraege/${encodeURIComponent(normal.json().eintraege[0].id)}`,
    headers: w.anna.headers,
  });
  expect(einzel.statusCode).toBe(200);
  expect(einzel.json().eintrag.geschuetzt).toBe(true);
});
