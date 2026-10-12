// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DUBLETTENVERGLEICH — DAS ZUSAMMENFÜHREN AM ECHTEN SERVER.
// ================================================================================================
//
// `POST /api/duplicates/:id/merge` an der vollständigen App (frische Bühne der Rollenabnahme: echte
// Anmeldung je Rolle, echte Dienste, echte Ablagen, laufender Prüf-Worker). Gemessen wird, was der
// Weg ZUSICHERT — und zwar am nachgelesenen Bestand, nicht an der Antwort:
//
//   R-1107  neue, UNGEPRÜFTE Fassung am Führungsartikel aus den gewählten Feldern; Quellen
//           mitgenommen; der aufgegangene Artikel bleibt lesbar, unverändert, mit Verweis; der Befund
//           schliesst als `merged`; Belege `ko.merge-received`, `ko.merged-into`,
//           `overlap.merge-completed`; die Vorfassung bleibt als Schnappschuss erhalten.
//           Kein Ein-Klick: ohne ausdrückliche Freigabe wird nichts geschrieben.
//   R-0201  nichts Neues entsteht — eine Position, die an keiner Seite steht, wird abgewiesen.
//   R-0565  ein Autor einer Seite führt nicht zusammen — auch nicht mit Controller-Recht.
//   Nachlauf  der aufgegangene Artikel wird nicht erneut als Dublette des Führungsartikels gemeldet.
import { afterEach, describe, expect, it } from "vitest";
import {
  type FrischeBuehne,
  type Rolle,
  baueFrischeBuehne,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

interface Ko {
  id: string;
  version: number;
  title: string;
  statement: string;
  status: string;
  conditions: string[];
  measures: string[];
  sources?: { id: string; label: string }[];
  mergedInto?: { koId: string; version: number; overlapId: string; at: string; by: string };
}

function kopf(b: FrischeBuehne, rolle: Rolle): Record<string, string> {
  return { authorization: `Bearer ${b.sitzung[rolle]}` };
}

async function legeAn(
  b: FrischeBuehne,
  rolle: Rolle,
  inhalt: Record<string, unknown>,
): Promise<string> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf(b, rolle),
    payload: {
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
      ...inhalt,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

async function lies(b: FrischeBuehne, id: string): Promise<Ko> {
  const res = await b.app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: kopf(b, "admin"),
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Ko;
}

async function befund(b: FrischeBuehne, id: string) {
  const res = await b.app.inject({
    method: "GET",
    url: `/api/duplicates/${id}`,
    headers: kopf(b, "admin"),
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    status: string;
    resolution?: { reason: string; by: string; mergedIntoKoId?: string; mergedVersion?: number };
  };
}

/**
 * Zwei inhaltlich VERSCHIEDENE Artikel (die Erkennung legt dazwischen nichts an) und ein von Hand
 * angelegter Befund — so ist jede Seite mit eigenen Bedingungen, Massnahmen und Quellen bestimmbar.
 */
async function paar(b: FrischeBuehne, autorA: Rolle = "experte", autorB: Rolle = "experte") {
  const a = await legeAn(b, autorA, {
    title: "Pumpe P3 entlüften",
    statement: "Nach jedem Anfahren die Pumpe P3 zehn Sekunden entlüften.",
    conditions: ["Nur bei Stillstand"],
    measures: ["Entlüftungsventil öffnen"],
  });
  const bb = await legeAn(b, autorB, {
    title: "Dosierpumpe Luft ablassen",
    statement:
      "Beim Start der Dosiereinheit die eingeschlossene Luft ablassen, bis Medium austritt.",
    conditions: ["Nur bei Stillstand", "Mit Schutzbrille"],
    measures: ["Auffangschale unterstellen"],
  });
  await b.services.aiCheckWorker?.idle();
  await b.services.ko.addSource(a, "seed", {
    label: "Wartungshandbuch P3",
    url: "https://example.org/p3",
  });
  await b.services.ko.addSource(bb, "seed", { label: "Betriebsanweisung Dosierung" });
  const eintrag = await b.services.overlaps.createAuto(
    {
      koA: a,
      koB: bb,
      relation: "teilweise",
      aspects: [],
      eigenanteilA: "",
      eigenanteilB: "Schutzbrille tragen.",
      recommendation: "zusammenfuehren_pruefen",
    },
    { trigger: "manual", method: "deterministic", lexicalScore: 0.5 },
  );
  return { a, b: bb, id: eintrag.id };
}

async function auftrag(
  b: FrischeBuehne,
  a: string,
  bb: string,
  mehr: Record<string, unknown> = {},
) {
  const fuehrend = await lies(b, a);
  const aufgehend = await lies(b, bb);
  const quelleB = aufgehend.sources?.find((q) => q.label === "Betriebsanweisung Dosierung");
  return {
    fuehrend: { id: a, version: fuehrend.version },
    aufgehend: { id: bb, version: aufgehend.version },
    titel: "fuehrend",
    kernaussage: "aufgehend",
    bedingungen: ["Nur bei Stillstand", "Mit Schutzbrille"],
    massnahmen: ["Entlüftungsventil öffnen", "Auffangschale unterstellen"],
    quellen: quelleB ? [quelleB.id] : [],
    bestaetigt: true,
    vermerk: "Zwei Fassungen derselben Anweisung.",
    ...mehr,
  };
}

const merge = (b: FrischeBuehne, rolle: Rolle, id: string, payload: unknown) =>
  b.app.inject({
    method: "POST",
    url: `/api/duplicates/${id}/merge`,
    headers: kopf(b, rolle),
    payload: payload as Record<string, unknown>,
  });

/** Der Bestand, der sich bei einem abgewiesenen Versuch NICHT ändern darf. */
async function stand(b: FrischeBuehne, a: string, bb: string, id: string) {
  const fa = await lies(b, a);
  const fb = await lies(b, bb);
  const e = await befund(b, id);
  return {
    a: { version: fa.version, statement: fa.statement },
    b: { version: fb.version, mergedInto: fb.mergedInto ?? null },
    befund: e.status,
  };
}

describe("R-1107 / R-0201 · der gelungene Weg, am nachgelesenen Bestand", () => {
  it("Z1 · neue ungeprüfte Fassung, gewählte Felder, Quelle mitgenommen, Gegenseite bleibt lesbar mit Verweis", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b);
    // Der Führungsartikel ist GEPRÜFT — nur so zeigt die Messung, dass die zusammengeführte Fassung
    // die Prüfung nicht erbt, sondern normal neu durchläuft.
    await b.services.ko.setValidationState(p.a, { trust: 90, status: "validiert" });
    const vorherA = await lies(b, p.a);
    expect(vorherA.status).toBe("validiert");
    const vorherB = await lies(b, p.b);
    const res = await merge(b, "admin", p.id, await auftrag(b, p.a, p.b));
    expect(res.statusCode, res.body).toBe(200);

    // Führungsartikel: genau eine neue Fassung, ungeprüft, mit den gewählten Feldern.
    const nachA = await lies(b, p.a);
    expect(nachA.version).toBe(vorherA.version + 1);
    expect(nachA.status).toBe("offen");
    expect((nachA as Ko & { trust: number }).trust).toBe(0);
    expect(nachA.title).toBe(vorherA.title);
    expect(nachA.statement).toBe(vorherB.statement);
    expect(nachA.conditions).toEqual(["Nur bei Stillstand", "Mit Schutzbrille"]);
    expect(nachA.measures).toEqual(["Entlüftungsventil öffnen", "Auffangschale unterstellen"]);
    const labels = (nachA.sources ?? []).map((q) => q.label).sort();
    expect(labels).toEqual(["Betriebsanweisung Dosierung", "Wartungshandbuch P3"]);

    // Aufgegangener Artikel: nicht gelöscht, Inhalt und Quellen unverändert, Verweis gesetzt.
    const nachB = await lies(b, p.b);
    expect(nachB.version).toBe(vorherB.version);
    expect(nachB.statement).toBe(vorherB.statement);
    expect((nachB.sources ?? []).map((q) => q.label)).toEqual(["Betriebsanweisung Dosierung"]);
    expect(nachB.mergedInto?.koId).toBe(p.a);
    expect(nachB.mergedInto?.version).toBe(nachA.version);
    expect(nachB.mergedInto?.overlapId).toBe(p.id);
    expect(nachB.mergedInto?.by).toBe(b.konto.admin.id);

    // Befund: als „zusammengeführt" geschlossen, mit Führungsartikel und Fassung.
    const e = await befund(b, p.id);
    expect(e.status).toBe("geschlossen");
    expect(e.resolution?.reason).toBe("merged");
    expect(e.resolution?.mergedIntoKoId).toBe(p.a);
    expect(e.resolution?.mergedVersion).toBe(nachA.version);

    // Historie: die Vorfassung des Führungsartikels steht unverändert als Schnappschuss.
    const fassungen = await b.services.ko.versionsOf(p.a);
    const alt = fassungen.find((f) => f.version === vorherA.version);
    expect(alt?.snapshot.statement).toBe(vorherA.statement);

    // Belege: alle drei Schritte, je vom Kurator.
    const admin = b.konto.admin.id;
    for (const [action, target] of [
      ["ko.merge-received", p.a],
      ["ko.merged-into", p.b],
      ["overlap.merge-completed", p.id],
    ] as const) {
      const treffer = (await b.services.audit.list({ action, actor: admin })).filter(
        (x) => x.target === target,
      );
      expect(treffer, `${action}@${target}`).toHaveLength(1);
    }
    expect((await b.services.audit.verifyReport()).ok).toBe(true);
  });

  it("Z2 · ohne ausdrückliche Freigabe (kein Ein-Klick) wird nichts geschrieben", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b);
    const vorher = await stand(b, p.a, p.b, p.id);
    const ohne = await merge(b, "admin", p.id, await auftrag(b, p.a, p.b, { bestaetigt: false }));
    expect(ohne.statusCode, ohne.body).toBe(400);
    expect(ohne.json().error).toBe("INVALID");
    expect(await stand(b, p.a, p.b, p.id)).toEqual(vorher);
  });

  it("Z3 · eine Position, die an keiner Seite steht, wird abgewiesen — hier entsteht kein neuer Text", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b);
    const vorher = await stand(b, p.a, p.b, p.id);
    const erfunden = await merge(
      b,
      "admin",
      p.id,
      await auftrag(b, p.a, p.b, { bedingungen: ["Nur bei Stillstand", "Neu erfunden"] }),
    );
    expect(erfunden.statusCode, erfunden.body).toBe(400);
    const fremdeQuelle = await merge(
      b,
      "admin",
      p.id,
      await auftrag(b, p.a, p.b, { quellen: ["gibt-es-nicht"] }),
    );
    expect(fremdeQuelle.statusCode, fremdeQuelle.body).toBe(400);
    expect(await stand(b, p.a, p.b, p.id)).toEqual(vorher);
  });

  it("Z4 · eine seit der Vorschau geänderte Seite: 409, nichts geschrieben", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b);
    const vorher = await stand(b, p.a, p.b, p.id);
    const veraltet = await auftrag(b, p.a, p.b);
    veraltet.fuehrend = { ...veraltet.fuehrend, version: veraltet.fuehrend.version - 1 };
    const res = await merge(b, "admin", p.id, veraltet);
    expect(res.statusCode, res.body).toBe(409);
    expect(await stand(b, p.a, p.b, p.id)).toEqual(vorher);
  });

  it("Z5 · ein geschlossener Befund lässt sich nicht ein zweites Mal zusammenführen", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b);
    const erst = await merge(b, "admin", p.id, await auftrag(b, p.a, p.b));
    expect(erst.statusCode, erst.body).toBe(200);
    const zweit = await merge(b, "controller", p.id, await auftrag(b, p.a, p.b));
    expect([404, 409]).toContain(zweit.statusCode);
  });
});

describe("R-0565 · Zusammenführen bleibt kuratorisch", () => {
  it("K1 · ein Controller, der eine Seite selbst verfasst hat, bekommt 403 — der Bestand bleibt", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b, "controller", "experte");
    const vorher = await stand(b, p.a, p.b, p.id);
    const res = await merge(b, "controller", p.id, await auftrag(b, p.a, p.b));
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
    expect(await stand(b, p.a, p.b, p.id)).toEqual(vorher);
    // Dieselbe Seite, andere Richtung: auch als AUFGEHENDER Artikel ist sie seine eigene.
    const umgekehrt = await auftrag(b, p.b, p.a);
    const res2 = await merge(b, "controller", p.id, umgekehrt);
    expect(res2.statusCode, res2.body).toBe(403);
    expect(await stand(b, p.a, p.b, p.id)).toEqual(vorher);
    // Ein anderer Kurator (Admin, nicht Autor) darf.
    const admin = await merge(b, "admin", p.id, await auftrag(b, p.a, p.b));
    expect(admin.statusCode, admin.body).toBe(200);
  });

  it("K2 · Expertin und Betrachter erreichen die Tür nicht (Recht `ko.validate`)", async () => {
    const b = await baueFrischeBuehne();
    const p = await paar(b);
    const vorher = await stand(b, p.a, p.b, p.id);
    for (const rolle of ["experte", "viewer"] as const) {
      const res = await merge(b, rolle, p.id, await auftrag(b, p.a, p.b));
      expect(res.statusCode, `${rolle}: ${res.body}`).toBe(403);
    }
    expect(await stand(b, p.a, p.b, p.id)).toEqual(vorher);
  });
});

describe("R-1107 · der aufgegangene Artikel wird nicht wieder als Dublette gemeldet", () => {
  it("N1 · zwei gleichlautende Artikel: die Erkennung paart sie — nach dem Zusammenführen nicht mehr", async () => {
    const b = await baueFrischeBuehne();
    const inhalt = {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
    };
    const a = await legeAn(b, "experte", inhalt);
    const bb = await legeAn(b, "experte", {
      ...inhalt,
      title: "Dichtungswechsel L4 — zweite Fassung",
    });
    await b.services.aiCheckWorker?.idle();
    const offen = await b.services.overlaps.unresolved();
    const eintrag = offen.find((e) => [e.koA, e.koB].includes(a) && [e.koA, e.koB].includes(bb));
    expect(eintrag, "Vorbedingung: die Erkennung hat das Paar gefunden").toBeDefined();
    if (!eintrag) {
      return;
    }
    const res = await merge(b, "admin", eintrag.id, {
      fuehrend: { id: a, version: (await lies(b, a)).version },
      aufgehend: { id: bb, version: (await lies(b, bb)).version },
      titel: "fuehrend",
      kernaussage: "fuehrend",
      bedingungen: [],
      massnahmen: [],
      quellen: [],
      bestaetigt: true,
    });
    expect(res.statusCode, res.body).toBe(200);
    // Der Nachlauf hat die neue Fassung des Führungsartikels erneut geprüft.
    await b.services.aiCheckWorker?.idle();
    const danach = await b.services.overlaps.unresolved();
    expect(danach.filter((e) => e.koA === bb || e.koB === bb)).toEqual([]);
  });
});
