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
import type { Guards } from "../../services/app/src/http";
import {
  InMemoryLesevariantenRepo,
  lokalisierungsPaket,
} from "../../services/app/src/lesevarianten";
import { lesevariantenRoutes } from "../../services/app/src/routes/lesevarianten-routes";
import type { KandidatenRechtequelle } from "../../services/app/src/sichtbarkeit";
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

/** Eine Rechtequelle ohne Quellrechte für diesen Eintrag — er ist Prüffläche für jeden Leser. */
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

  it("Q3 · Gegenfall: ohne Quellrechte ist der Kandidat sichtbar — die Meldung kommt an (201, ein Eintrag)", async () => {
    const { app, protokoll } = await baue(kandidat(false), OHNE_RECHTE);
    const gemeldet = await melde(app);
    expect(gemeldet.statusCode).toBe(201);
    expect(gemeldet.json()).toMatchObject({ gemeldet: true, gegenstand: "kandidat", ziel: "k-1" });
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0]).toMatchObject({ action: "lesevariante.widerspruch", target: "k-1" });
  });
});
