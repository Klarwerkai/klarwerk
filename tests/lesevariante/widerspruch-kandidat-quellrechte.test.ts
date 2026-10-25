// ================================================================================================
// PETER NR. 20 × confluence-import-rechte — DIE MELDUNG AM KANDIDATEN FÄHRT DIESELBE GRENZE WIE DER
// ABRUF.
// ================================================================================================
//
// Seit der Zusammenführung mit `main` prüft `GET /api/library/import/candidates/:id/lesevariante/:lang`
// die Quellrechte des Kandidaten (`darfKandidatSehen`). Die Widerspruchsmeldung an derselben
// Prüfkarte darf kein Umweg darum sein: ein Kandidat, den die Quelle diesem Menschen nicht zeigt,
// ist auch hier 404 — ohne Protokolleintrag. Gemessen an der echten Routenfunktion mit schmalen
// Aussenkanten (Guards, Kandidatenzugriff, Rechtequelle, Protokoll); der Kandidatentext ist der
// echte Datensatz S01 der Lieferung, damit der sichtbare Gegenfall wirklich bis zur Meldung kommt.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  InMemoryLesevariantenRepo,
  lokalisierungsPaket,
} from "../../services/app/src/lesevarianten";
import { lesevariantenRoutes } from "../../services/app/src/routes/lesevarianten-routes";
import {
  type KandidatenRechtequelle,
  darfKandidatSehen,
} from "../../services/app/src/sichtbarkeit";
import type { AuditService } from "../../services/audit";
import type { KoService } from "../../services/knowledge-object";
import type { ImportCandidate } from "../../services/library-analytics";

const S01 = (() => {
  const record = lokalisierungsPaket("advisor-ict-en-v1")?.records.find((r) => r.key === "S01");
  if (!record?.confluence_id || !record.en) {
    throw new Error("Datensatz S01 der Lieferung advisor-ict-en-v1 fehlt.");
  }
  return { confluenceId: record.confluence_id, titel: record.en.title };
})();

const LESER = { id: "u-leser", role: "admin", name: "Leser", email: "leser@x.de" };

function kandidat(mitQuellrechten: boolean): ImportCandidate {
  return {
    id: "k-1",
    status: "neu",
    koId: null,
    item: {
      title: S01.titel,
      statement: "Harbor Field Services is a fictional customer.",
      type: "best_practice",
      category: "Onboarding",
      provider: "Confluence",
      externalId: S01.confluenceId,
      ...(mitQuellrechten ? { quellrechte: { stufe: "intern", emails: ["fremd@x.de"] } } : {}),
    },
  } as unknown as ImportCandidate;
}

async function baue(
  eintrag: ImportCandidate,
  kandidatenRechte: KandidatenRechtequelle | undefined,
): Promise<{ app: ReturnType<typeof Fastify>; protokoll: unknown[] }> {
  const protokoll: unknown[] = [];
  const audit = {
    record: async (eingabe: unknown) => {
      protokoll.push(eingabe);
      return { seq: protokoll.length };
    },
  } as unknown as AuditService;
  const guards = {
    requireUser: async () => LESER,
    requirePermission: async () => LESER,
  } as unknown as Guards;
  const app = Fastify();
  await app.register(
    lesevariantenRoutes(
      {
        ko: {} as KoService,
        lesevarianten: new InMemoryLesevariantenRepo(),
        kandidaten: { findById: async (id: string) => (id === eintrag.id ? eintrag : undefined) },
        audit,
        ...(kandidatenRechte ? { kandidatenRechte } : {}),
      },
      guards,
    ),
  );
  return { app, protokoll };
}

function melde(app: ReturnType<typeof Fastify>) {
  return app.inject({
    method: "POST",
    url: "/api/library/import/candidates/k-1/lesevariante/de/widerspruch",
    payload: { begruendung: "Kernaussage weicht vom Original ab." },
  });
}

function hole(app: ReturnType<typeof Fastify>) {
  return app.inject({
    method: "GET",
    url: "/api/library/import/candidates/k-1/lesevariante/de",
  });
}

/** Eine Rechtequelle, deren Leserliste den Aufrufer NICHT enthält. */
const FREMDE_LESER: KandidatenRechtequelle = {
  quellrechteFuerKandidat: async () => ({ leser: ["u-jemand-anders"] }),
  wissensobjektFuerSicht: async () => undefined,
};

/** Eine Rechtequelle ohne Quellrechte; die Einstufung bleibt für die berechtigte Admin-Fixture maßgeblich. */
const OHNE_RECHTE: KandidatenRechtequelle = {
  quellrechteFuerKandidat: async () => undefined,
  wissensobjektFuerSicht: async () => undefined,
};

describe("Peter Nr. 20 · Widerspruch am Kandidaten nur, wo der Kandidat sichtbar ist", () => {
  it("Q1 · Leserliste ohne den Aufrufer: Meldung 404 wie der Abruf, KEIN Protokolleintrag", async () => {
    const { app, protokoll } = await baue(kandidat(true), FREMDE_LESER);
    const gemeldet = await melde(app);
    const geholt = await hole(app);
    expect({ meldung: gemeldet.statusCode, abruf: geholt.statusCode }).toEqual({
      meldung: 404,
      abruf: 404,
    });
    expect(gemeldet.json().error).toBe("NOT_FOUND");
    expect(protokoll).toEqual([]);
  });

  it("Q2 · ohne Rechtequelle bleibt ein Eintrag MIT Quellrechten verschlossen — auch für die Meldung", async () => {
    const { app, protokoll } = await baue(kandidat(true), undefined);
    expect((await melde(app)).statusCode).toBe(404);
    expect((await hole(app)).statusCode).toBe(404);
    expect(protokoll).toEqual([]);
  });

  it("Q3 · Gegenfall: ohne Quellrechte bleibt der berechtigte Prüfer handlungsfähig (201, ein Eintrag)", async () => {
    const { app, protokoll } = await baue(kandidat(false), OHNE_RECHTE);
    const gemeldet = await melde(app);
    expect(gemeldet.statusCode).toBe(201);
    expect(gemeldet.json()).toMatchObject({ gemeldet: true, gegenstand: "kandidat", ziel: "k-1" });
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0]).toMatchObject({ action: "lesevariante.widerspruch", target: "k-1" });
  });
});

// P2: Kandidateneinstufung, Quellleser und aktuelles angenommenes KO wirken gemeinsam.
async function p2Aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  try {
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "P2 Admin", email: "admin@p2.test", password: "geheim12345" },
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const login = async (email: string) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "geheim12345" },
      });
      expect(res.statusCode, res.body).toBe(200);
      return { authorization: `Bearer ${res.json().token}` };
    };
    const admin = await login("admin@p2.test");
    const ids: Record<string, string> = {};
    for (const [email, role] of [
      ["leser@p2.test", "viewer"],
      ["pruefer@p2.test", "controller"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name: email, email, role, password: "geheim12345" },
      });
      expect(res.statusCode, res.body).toBe(201);
      ids[email] = res.json().id;
    }
    const leser = await login("leser@p2.test");
    const pruefer = await login("pruefer@p2.test");
    const einreihen = async (extra: Record<string, unknown> = {}) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/library/import/candidates",
        headers: admin,
        payload: {
          items: [
            {
              title: S01.titel,
              statement: "P2-VERTRAULICHE-AUSSAGE",
              bodyHtml: "<p>P2-VERTRAULICHER-KOERPER</p>",
              type: "best_practice",
              category: "Import",
              provider: "Confluence",
              externalId: S01.confluenceId,
              ...extra,
            },
          ],
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toHaveLength(1);
      return res.json()[0].id as string;
    };
    return { app, services, admin, leser, pruefer, ids, einreihen };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function p2Liste(app: ReturnType<typeof buildApp>, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res;
}

describe("P2 · Importkandidat am echten HTTP-Weg", () => {
  it("vertrauliche Aussage und Körper fehlen für Leser vor UND nach erfolgreicher Annahme; berechtigte Prüfer sehen und übernehmen sie", async () => {
    const f = await p2Aufbau();
    try {
      const id = await f.einreihen({ confidentiality: "vertraulich" });
      const vor = await p2Liste(f.app, f.leser);
      expect(vor.json()).toEqual([]);
      expect(vor.body).not.toContain("P2-VERTRAULICHE-AUSSAGE");
      expect(vor.body).not.toContain("P2-VERTRAULICHER-KOERPER");
      const erlaubt = await p2Liste(f.app, f.pruefer);
      expect(erlaubt.body).toContain("P2-VERTRAULICHE-AUSSAGE");
      expect(erlaubt.body).toContain("P2-VERTRAULICHER-KOERPER");
      const befunde = await f.app.inject({
        method: "GET",
        url: "/api/library/import/candidates/befunde",
        headers: f.leser,
      });
      expect(befunde.statusCode, befunde.body).toBe(200);
      expect(befunde.json()).toEqual([]);
      const accept = await f.app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${id}`,
        headers: f.pruefer,
        payload: { action: "accept" },
      });
      expect(accept.statusCode, accept.body).toBe(200);
      const koId = accept.json().koId as string;
      expect(koId).toBeTruthy();
      const ko = await f.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: f.admin });
      expect(ko.statusCode, ko.body).toBe(200);
      expect(ko.json().confidentiality).toBe("vertraulich");
      expect(ko.body).toContain("P2-VERTRAULICHE-AUSSAGE");
      expect(
        (await f.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: f.leser }))
          .statusCode,
      ).toBe(404);
      const nach = await p2Liste(f.app, f.leser);
      expect(nach.json()).toEqual([]);
      expect(nach.body).not.toContain("P2-VERTRAULICHE-AUSSAGE");
      expect(nach.body).not.toContain("P2-VERTRAULICHER-KOERPER");
    } finally {
      await f.app.close();
    }
  });

  it("ein interner Kandidat und seine Lesevariante bleiben erlaubt; nach KO-Höherstufung sperrt dessen aktuelle Sicht auch Queue und Widerspruch", async () => {
    const f = await p2Aufbau();
    try {
      const id = await f.einreihen({ confidentiality: "intern" });
      expect((await p2Liste(f.app, f.leser)).body).toContain(id);
      const url = `/api/library/import/candidates/${id}/lesevariante/de`;
      const vorher = await f.app.inject({ method: "GET", url, headers: f.leser });
      expect(vorher.statusCode, vorher.body).toBe(200);
      const accept = await f.app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${id}`,
        headers: f.pruefer,
        payload: { action: "accept" },
      });
      expect(accept.statusCode, accept.body).toBe(200);
      const koId = accept.json().koId as string;
      const stufe = await f.app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: f.admin,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(stufe.statusCode, stufe.body).toBe(200);
      expect((await p2Liste(f.app, f.leser)).json()).toEqual([]);
      const nicht = await f.app.inject({ method: "GET", url, headers: f.leser });
      expect(nicht.statusCode, nicht.body).toBe(404);
      const vorAudit = await f.services.audit.list({ action: "lesevariante.widerspruch" });
      const widerspruch = await f.app.inject({
        method: "POST",
        url: `${url}/widerspruch`,
        headers: f.leser,
        payload: { begruendung: "Nicht zugänglich" },
      });
      expect(widerspruch.statusCode, widerspruch.body).toBe(404);
      expect(await f.services.audit.list({ action: "lesevariante.widerspruch" })).toEqual(vorAudit);
      expect((await p2Liste(f.app, f.pruefer)).body).toContain(id);
      expect((await f.app.inject({ method: "GET", url, headers: f.pruefer })).statusCode).toBe(200);
    } finally {
      await f.app.close();
    }
  });

  it("fehlende Einstufung und ein ungebundener author-Text erzeugen kein Leserrecht", async () => {
    const f = await p2Aufbau();
    try {
      const id = await f.einreihen({ author: f.ids["leser@p2.test"] });
      expect((await p2Liste(f.app, f.leser)).json()).toEqual([]);
      expect((await p2Liste(f.app, f.pruefer)).body).toContain(id);
      const variante = await f.app.inject({
        method: "GET",
        url: `/api/library/import/candidates/${id}/lesevariante/de`,
        headers: f.leser,
      });
      expect(variante.statusCode, variante.body).toBe(404);
    } finally {
      await f.app.close();
    }
  });
});

describe("P2 · dieselbe zentrale Kandidatenentscheidung an schmalen Rechteports", () => {
  const viewer: SessionUser = { id: "p2-leser", role: "viewer" };
  const pruefer: SessionUser = { id: "p2-pruefer", role: "controller" };
  const offen: KandidatenRechtequelle = {
    quellrechteFuerKandidat: async () => undefined,
    wissensobjektFuerSicht: async () => undefined,
  };
  it("verwendet Schutzrang statt intern-Default oder Importtext-Autorschaft, auch ohne optionalen Abbildungszugang", async () => {
    for (const stufe of ["vertraulich", "streng_vertraulich", undefined, null, "unbekannt"]) {
      const k = { item: { confidentiality: stufe, author: viewer.id }, koId: null };
      expect(await darfKandidatSehen(viewer, k, offen)).toBe(false);
      expect(await darfKandidatSehen(viewer, k, undefined)).toBe(false);
    }
    expect(
      await darfKandidatSehen(
        viewer,
        { item: { confidentiality: "intern" }, koId: null },
        undefined,
      ),
    ).toBe(true);
    expect(
      await darfKandidatSehen(
        pruefer,
        { item: { confidentiality: "vertraulich" }, koId: null },
        offen,
      ),
    ).toBe(true);
    expect(
      await darfKandidatSehen(
        pruefer,
        { item: { confidentiality: "streng_vertraulich" }, koId: null },
        offen,
      ),
    ).toBe(false);
    expect(
      await darfKandidatSehen(
        { ...pruefer, freigabe: "streng_vertraulich" },
        { item: { confidentiality: "streng_vertraulich" }, koId: null },
        offen,
      ),
    ).toBe(true);
  });
  it("behält die Quellleserliste zusätzlich zur Kandidatenstufe", async () => {
    const quelle: KandidatenRechtequelle = {
      ...offen,
      quellrechteFuerKandidat: async () => ({ leser: [viewer.id] }),
    };
    expect(
      await darfKandidatSehen(viewer, { item: { confidentiality: "intern" }, koId: null }, quelle),
    ).toBe(true);
    expect(
      await darfKandidatSehen(pruefer, { item: { confidentiality: "intern" }, koId: null }, quelle),
    ).toBe(false);
    expect(
      await darfKandidatSehen(
        viewer,
        { item: { confidentiality: "vertraulich" }, koId: null },
        quelle,
      ),
    ).toBe(false);
    expect(
      await darfKandidatSehen(
        viewer,
        { item: { confidentiality: "intern", quellrechte: {} }, koId: null },
        undefined,
      ),
    ).toBe(false);
  });
  it("beachtet nach Annahme aktuelle KO-Stufe, Quellleser und Space sowie fehlende aktuelle Sichtdaten", async () => {
    const k = { item: { confidentiality: "intern" }, koId: "ko-p2" };
    for (const ko of [
      { confidentiality: "vertraulich" as const },
      { confidentiality: "intern" as const, quellrechte: { leser: ["jemand-anders"] } },
      { confidentiality: "intern" as const, spaceId: "geschlossener-space" },
    ]) {
      expect(
        await darfKandidatSehen(viewer, k, { ...offen, wissensobjektFuerSicht: async () => ko }),
      ).toBe(false);
    }
    expect(await darfKandidatSehen(viewer, k, offen)).toBe(false);
    expect(await darfKandidatSehen(viewer, k, undefined)).toBe(false);
    expect(
      await darfKandidatSehen(viewer, k, {
        ...offen,
        wissensobjektFuerSicht: async () => ({ confidentiality: "intern" }),
      }),
    ).toBe(true);
    expect(
      await darfKandidatSehen(
        viewer,
        { ...k, item: { confidentiality: "vertraulich" } },
        { ...offen, wissensobjektFuerSicht: async () => ({ confidentiality: "intern" }) },
      ),
    ).toBe(false);
  });
});
