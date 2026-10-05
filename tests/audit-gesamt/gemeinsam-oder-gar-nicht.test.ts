// Aufnahme gesamt-auditprotokoll · Lauf 3 — Bens zwei Befunde aus Lauf 2, im SPEICHERBETRIEB.
//
// B1 (beleg:6818bd52, Commit 758e76c1): zwei gleichzeitige `GET /api/audit/export` lasen denselben
//    Vorgänger und hängten beide `audit.exported` mit derselben `seq` an — die Kette war danach
//    gebrochen (`linkageBreaks=1`). Hier: dieselben parallelen Exporte über HTTP; danach sind die
//    Folgenummern lückenlos und eindeutig, jeder Eintrag verweist auf die Prüfsumme seines
//    tatsächlichen Vorgängers, die Kettenprüfung meldet keinen Bruch. Eine Kalibrierung zeigt, dass
//    derselbe Ablauf über den alten Weg (Vorgänger lesen, dann anhängen) scheitert.
//
// BEN-B1 (Lauf 3, Runde 1): dasselbe für die Validierung — Peer-Bewertung (`ko.rated`, bei
//    Gelb/Rot `ko.returned-to-*`) und Admin-Validierung (`ko.admin-validated`). Fällt der
//    Entscheidungsbeleg aus, bleibt das Objekt offen, ohne Bewertung und ohne Verweis.
//
// B2 (beleg:1ea197ac, Commit d3c1bc09): `POST /api/kos` antwortete 500, das Objekt stand trotzdem
//    im Bestand, ohne `ko.created`. Hier: fällt der Auditeintrag beim Erfassen oder Ändern aus, wird
//    auch die Änderung nicht wirksam; fällt das Speichern der Änderung aus, entsteht kein Beleg.
//
// Der PostgreSQL-Weg derselben Fälle steht in `kette-und-beleg-atomar.integration.test.ts`.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  type AuditEntry,
  type AuditRepo,
  AuditService,
  InMemoryAuditRepo,
  inspectChain,
} from "../../services/audit";
import type { KoRepo } from "../../services/knowledge-object";

const offen: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

/** Welche Aktionen die Probe beim Anhängen abweist, und ob das Speichern am Objekt scheitert. */
interface Probe {
  auditAus: Set<string>;
  updateAus: boolean;
}

function mitProbe(inner: InMemoryAuditRepo, probe: Probe): AuditRepo {
  const pruefe = (entry: AuditEntry): void => {
    if (probe.auditAus.has(entry.action)) {
      throw new Error(`Probe: Auditeintrag ${entry.action} abgewiesen`);
    }
  };
  return {
    append: async (entry, tx) => {
      pruefe(entry);
      return inner.append(entry, tx);
    },
    appendOnce: async (entry, tx) => {
      pruefe(entry);
      return inner.appendOnce(entry, tx);
    },
    appendNext: (build, tx) =>
      inner.appendNext((last) => {
        const entry = build(last);
        pruefe(entry);
        return entry;
      }, tx),
    all: () => inner.all(),
    last: (tx) => inner.last(tx),
    findBy: (f) => inner.findBy(f),
    existsBy: (f) => inner.existsBy(f),
    findBySeq: (seq, tx) => inner.findBySeq(seq, tx),
  };
}

async function buehne() {
  const probe: Probe = { auditAus: new Set(), updateAus: false };
  const repos = inMemoryRepos();
  const auditInner = new InMemoryAuditRepo();
  repos.auditRepo = mitProbe(auditInner, probe);
  const koInner = repos.koRepo;
  repos.koRepo = new Proxy(koInner, {
    get(ziel, name, empfaenger) {
      if (name === "update") {
        return (ko: Parameters<KoRepo["update"]>[0], tx?: Parameters<KoRepo["update"]>[1]) =>
          probe.updateAus
            ? Promise.reject(new Error("Probe: Speichern der Änderung abgewiesen"))
            : ziel.update(ko, tx);
      }
      const wert = Reflect.get(ziel, name, empfaenger);
      return typeof wert === "function" ? wert.bind(ziel) : wert;
    },
  });
  const services = assembleServices(repos);
  const app = buildApp(services);
  await app.ready();
  offen.push(app);
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "l3@x.de", password: "secret123" },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "l3@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const adminId =
    (reg.json() as { id?: string; user?: { id: string } }).user?.id ??
    (reg.json() as { id: string }).id;
  return { app, services, repos, headers, adminId, probe, auditInner, koInner };
}

const KO = {
  confidentiality: "intern",
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
};

/** Lückenlos, eindeutig, jeder Eintrag verweist auf die Prüfsumme seines tatsächlichen Vorgängers. */
function pruefeKette(eintraege: readonly AuditEntry[]): void {
  expect(eintraege.map((e) => e.seq)).toEqual(eintraege.map((_, i) => i + 1));
  eintraege.forEach((e, i) => {
    if (i > 0) {
      expect(e.prevHash, `seq ${e.seq}`).toBe(eintraege[i - 1]?.hash);
    }
  });
  const bericht = inspectChain([...eintraege]);
  expect(bericht.linkageBreaks).toBe(0);
  expect(bericht.ok).toBe(true);
}

describe("B1 · gleichzeitige Schreiber (Speicher)", () => {
  it("acht gleichzeitige GET /api/audit/export: lückenlose, eindeutige Folge, kein Kettenbruch", async () => {
    const b = await buehne();
    const vorher = (await b.auditInner.all()).length;
    const antworten = await Promise.all(
      Array.from({ length: 8 }, () =>
        b.app.inject({ method: "GET", url: "/api/audit/export", headers: b.headers }),
      ),
    );
    expect(antworten.map((r) => r.statusCode)).toEqual(Array(8).fill(200));
    const alle = await b.auditInner.all();
    expect(alle.filter((e) => e.action === "audit.exported")).toHaveLength(8);
    expect(alle.length).toBe(vorher + 8);
    pruefeKette(alle);
    const http = await b.app.inject({
      method: "GET",
      url: "/api/audit/verify",
      headers: b.headers,
    });
    expect(http.json()).toMatchObject({ ok: true, linkageBreaks: 0 });
  });

  it("zwanzig gleichzeitige record/recordOnce am Dienst: jede Nummer einmal, gleiche Ereigniskennung nur einmal", async () => {
    const repo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo });
    const e = (i: number) => ({ actor: "l3", action: "probe.parallel", target: `t${i}` });
    const ergebnisse = await Promise.all([
      ...Array.from({ length: 20 }, (_, i) => audit.record(e(i))),
      audit.recordOnce("l3:einmal", e(99)),
      audit.recordOnce("l3:einmal", e(99)),
    ]);
    const alle = await repo.all();
    expect(alle).toHaveLength(21);
    expect(ergebnisse.slice(20)).toEqual(expect.arrayContaining([true, false]));
    pruefeKette(alle);
  });

  it("Kalibrierung: derselbe Ablauf über den alten Weg (Vorgänger lesen, dann anhängen) scheitert", async () => {
    // Eine Ablage OHNE `appendNext` zwingt den Dienst auf den Weg bis Lauf 2. Der Spiegel des
    // Primärschlüssels weist die doppelt berechnete `seq` jetzt ab (vorher stand sie zweimal in der
    // Kette) — der Test würde den Befund also sehen, wenn der gemeinsame Schritt fehlte.
    const inner = new InMemoryAuditRepo();
    const alt: AuditRepo = {
      append: (entry, tx) => inner.append(entry, tx),
      appendOnce: (entry, tx) => inner.appendOnce(entry, tx),
      all: () => inner.all(),
      last: (tx) => inner.last(tx),
    };
    const audit = new AuditService({ repo: alt });
    const ausgaenge = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        audit.record({ actor: "l3", action: "probe.alt", target: `t${i}` }),
      ),
    );
    const abgewiesen = ausgaenge.filter((a) => a.status === "rejected");
    expect(abgewiesen.length).toBeGreaterThan(0);
    expect(String((abgewiesen[0] as PromiseRejectedResult).reason)).toContain("AUDIT_SEQ_BELEGT");
  });
});

describe("B2 · Wissensobjekt und Auditeintrag gemeinsam oder gar nicht (Speicher)", () => {
  it("Erfassen: fällt ko.created aus, bleibt kein Objekt im Bestand (500, kein halber Stand)", async () => {
    const b = await buehne();
    const kosVorher = (await b.koInner.list({})).length;
    const auditVorher = (await b.auditInner.all()).length;
    b.probe.auditAus.add("ko.created");
    const res = await b.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: b.headers,
      payload: KO,
    });
    expect(res.statusCode, res.body).toBe(500);
    expect(await b.koInner.list({})).toHaveLength(kosVorher);
    const nachher = await b.auditInner.all();
    expect(nachher.filter((e) => e.action === "ko.created")).toHaveLength(0);
    expect(nachher.length).toBe(auditVorher);

    // Gegenprobe: ohne Ausfall entsteht das Objekt mit genau einem ko.created.
    b.probe.auditAus.clear();
    const ok = await b.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: b.headers,
      payload: KO,
    });
    expect(ok.statusCode, ok.body).toBe(201);
    const id = ok.json().id as string;
    expect(
      (await b.auditInner.all()).filter((e) => e.action === "ko.created" && e.target === id),
    ).toHaveLength(1);
    pruefeKette(await b.auditInner.all());
  });

  it("Ändern: fällt der Beleg aus, wird die Änderung nicht wirksam (Kommentar, Vertraulichkeit)", async () => {
    const b = await buehne();
    const id = (
      await b.app.inject({ method: "POST", url: "/api/kos", headers: b.headers, payload: KO })
    ).json().id as string;

    b.probe.auditAus.add("ko.commented");
    const kommentar = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "comment", text: "Gilt das auch für L5?" },
    });
    expect(kommentar.statusCode).toBeGreaterThanOrEqual(500);
    expect((await b.koInner.findById(id))?.comments ?? []).toHaveLength(0);

    b.probe.auditAus.add("ko.confidentiality");
    const stufe = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode).toBeGreaterThanOrEqual(500);
    expect((await b.koInner.findById(id))?.confidentiality).toBe("intern");
    pruefeKette(await b.auditInner.all());
  });

  it("umgekehrt: scheitert das Speichern der Änderung, entsteht kein Beleg", async () => {
    const b = await buehne();
    const id = (
      await b.app.inject({ method: "POST", url: "/api/kos", headers: b.headers, payload: KO })
    ).json().id as string;
    const vorher = await b.auditInner.all();
    b.probe.updateAus = true;
    const stufe = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode).toBeGreaterThanOrEqual(500);
    const nachher = await b.auditInner.all();
    // Bis Lauf 3 lief der Beleg in `mutateKo` VOR dem Speichern — hier stand danach
    // `ko.confidentiality` für eine Stufe, die nie gespeichert wurde.
    expect(nachher.filter((e) => e.action === "ko.confidentiality")).toHaveLength(0);
    expect(nachher).toEqual(vorher);
    expect((await b.koInner.findById(id))?.confidentiality).toBe("intern");
  });
});

describe("BEN-B1 · Validierung und Entscheidungsbeleg gemeinsam oder gar nicht (Speicher)", () => {
  async function offenesObjekt(b: Awaited<ReturnType<typeof buehne>>) {
    // Eine Stimme genügt — so validiert schon die erste grüne Bewertung (Bens Gegenprobe).
    await b.services.validation.setDefaultNeededValidations(1, "l3");
    const id = (
      await b.app.inject({ method: "POST", url: "/api/kos", headers: b.headers, payload: KO })
    ).json().id as string;
    const vorher = await b.koInner.findById(id);
    expect(vorher?.status).toBe("offen");
    return { id, vorher };
  }

  async function unveraendert(b: Awaited<ReturnType<typeof buehne>>, id: string, vorher: unknown) {
    const nachher = await b.koInner.findById(id);
    const v = vorher as { status: string; trust: number };
    expect(nachher?.status).toBe(v.status);
    expect(nachher?.trust).toBe(v.trust);
    expect(nachher?.validationDecisionRef).toBeUndefined();
    expect(await b.repos.ratings.listByKo(id)).toEqual([]);
    pruefeKette(await b.auditInner.all());
  }

  it("Peer-Bewertung (Grün): fällt ko.rated aus, bleibt das Objekt offen — ohne Bewertung, ohne Verweis", async () => {
    const b = await buehne();
    const { id, vorher } = await offenesObjekt(b);
    b.probe.auditAus.add("ko.rated");
    const res = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    await unveraendert(b, id, vorher);
    expect((await b.auditInner.all()).filter((e) => e.action === "ko.rated")).toHaveLength(0);

    // Gegenprobe: ohne Ausfall validiert dieselbe Stimme — mit Beleg und Verweis darauf.
    b.probe.auditAus.clear();
    const ok = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const validiert = await b.koInner.findById(id);
    expect(validiert?.status).toBe("validiert");
    const beleg = (await b.auditInner.all()).find((e) => e.action === "ko.rated");
    expect(validiert?.validationDecisionRef).toEqual({
      auditSeq: beleg?.seq,
      auditHash: beleg?.hash,
    });
  });

  it("Peer-Bewertung (Rot): fällt die Rückgabe an die Verantwortliche aus, bleibt nichts — keine Bewertung, keine offene Zuweisung", async () => {
    const b = await buehne();
    const { id, vorher } = await offenesObjekt(b);
    const zuweisungenVorher = await b.repos.assignments.all();
    const auditVorher = (await b.auditInner.all()).length;
    b.probe.auditAus.add("ko.returned-to-author");
    b.probe.auditAus.add("ko.returned-to-owner");
    const res = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "rate", verdict: "down" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    await unveraendert(b, id, vorher);
    // Runde 3 (BEN-R2-B2): Zuweisungen VOLLSTÄNDIG wie vorher — auch keine neue „erledigte".
    expect(await b.repos.assignments.all()).toEqual(zuweisungenVorher);
    // Der schon angehängte `ko.rated` bleibt stehen (append-only) — aber nicht unkommentiert:
    // direkt danach nennt `ko.change-rolled-back` ihn als zurückgenommen.
    const neu = (await b.auditInner.all()).slice(auditVorher);
    expect(neu.map((e) => e.action)).toEqual(["ko.rated", "ko.change-rolled-back"]);
    expect(neu[1]?.target).toBe(id);
    expect(neu[1]?.payload).toMatchObject({
      grund: "validation",
      rolledBackSeqs: [neu[0]?.seq],
      restoredStatus: "offen",
    });
  });

  it("Admin-Validierung: fällt ko.admin-validated aus, bleibt das Objekt offen — Vertrauen unverändert, kein Verweis", async () => {
    const b = await buehne();
    const { id, vorher } = await offenesObjekt(b);
    b.probe.auditAus.add("ko.admin-validated");
    const res = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: b.headers,
      payload: { action: "admin-validate" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    await unveraendert(b, id, vorher);
    expect(
      (await b.auditInner.all()).filter((e) => e.action === "ko.admin-validated"),
    ).toHaveLength(0);
  });
});

describe("BEN-R2-B1 · gleichzeitige Peer-Bewertungen erhalten die Validierungsregeln (Speicher)", () => {
  async function zweiPruefer(needed: number) {
    const b = await buehne();
    await b.services.validation.setDefaultNeededValidations(needed, "l3");
    const zweite = await b.services.auth.register({
      name: "Prüferin",
      email: "l3-zwei@x.de",
      password: "secret123",
    });
    await b.services.auth.approveUser(zweite.id, b.adminId);
    await b.services.auth.changeRole(zweite.id, "controller", b.adminId);
    const login = await b.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "l3-zwei@x.de", password: "secret123" },
    });
    const zweiteKopf = { authorization: `Bearer ${login.json().token}` };
    const id = (
      await b.app.inject({ method: "POST", url: "/api/kos", headers: b.headers, payload: KO })
    ).json().id as string;
    return { b, id, zweiteKopf, zweiteId: zweite.id };
  }

  const bewerte = (
    b: Awaited<ReturnType<typeof buehne>>,
    id: string,
    kopf: Record<string, string>,
    verdict: string,
  ) =>
    b.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: kopf,
      payload: { action: "rate", verdict },
    });

  it("up + up gleichzeitig, Quorum 2: validiert mit Vertrauen 99, beide Stimmen, beide Belege", async () => {
    const { b, id, zweiteKopf } = await zweiPruefer(2);
    const antworten = await Promise.all([
      bewerte(b, id, b.headers, "up"),
      bewerte(b, id, zweiteKopf, "up"),
    ]);
    expect(antworten.map((r) => r.statusCode)).toEqual([200, 200]);
    const ko = await b.koInner.findById(id);
    expect(ko?.status).toBe("validiert");
    expect(ko?.trust).toBe(99);
    expect(await b.repos.ratings.listByKo(id)).toHaveLength(2);
    expect((await b.auditInner.all()).filter((e) => e.action === "ko.rated")).toHaveLength(2);
    pruefeKette(await b.auditInner.all());
  });

  it("down + up gleichzeitig, Quorum 1: eine rote Stimme verhindert die Freigabe — offen, Vertrauen 0", async () => {
    const { b, id, zweiteKopf } = await zweiPruefer(1);
    const antworten = await Promise.all([
      bewerte(b, id, b.headers, "down"),
      bewerte(b, id, zweiteKopf, "up"),
    ]);
    expect(antworten.map((r) => r.statusCode)).toEqual([200, 200]);
    const ko = await b.koInner.findById(id);
    expect(ko?.status).toBe("offen");
    expect(ko?.trust).toBe(0);
    expect(await b.repos.ratings.listByKo(id)).toHaveLength(2);
    pruefeKette(await b.auditInner.all());
  });

  // Dieselben beiden Fälle direkt am Dienst — ohne die Wartezeiten des HTTP-Wegs verschränken sich
  // beide Aufrufe sicher (so lief Bens Gegenbeleg). Die HTTP-Fälle oben sind der Nutzerweg.
  it("am Dienst: up + up (Quorum 2) → validiert/99; down + up (Quorum 1) → offen/0", async () => {
    for (const fall of [
      { needed: 2, stimmen: ["up", "up"] as const, status: "validiert", trust: 99 },
      { needed: 1, stimmen: ["down", "up"] as const, status: "offen", trust: 0 },
    ]) {
      const { b, id, zweiteId } = await zweiPruefer(fall.needed);
      const ids = [b.adminId, zweiteId];
      await Promise.all(
        fall.stimmen.map((v, i) => b.services.validation.rate(id, ids[i] as string, v)),
      );
      const ko = await b.koInner.findById(id);
      expect({ status: ko?.status, trust: ko?.trust }).toEqual({
        status: fall.status,
        trust: fall.trust,
      });
      expect(await b.repos.ratings.listByKo(id)).toHaveLength(2);
      pruefeKette(await b.auditInner.all());
    }
  });
});
