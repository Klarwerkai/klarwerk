// ================================================================================================
// PETER NR. 20 (12.10.2026) · KENNZEICHNUNG MIT ORIGINALQUELLE UND FASSUNG — UND DIE MELDUNG EINES
// ÜBERSETZUNGSWIDERSPRUCHS. GEMESSEN AN DER ECHTEN APP (`buildApp(buildServices())`).
// ================================================================================================
//
// Wortlaut der Entscheidung: „Übersetzung sichtbar als maschinelle Lesehilfe mit Originalquelle und
// Fassung kennzeichnen; Original bleibt maßgeblich. Übersetzungswidersprüche melden, keine
// automatische fachliche Freigabe."
//
// Gemessen wird hier die DATENSEITE: dass jede Leseroute Originalquelle und belegte Fassung trägt
// (oder ausdrücklich `null`), und dass die Meldung genau EINEN Protokolleintrag mit Bezug auf
// Übersetzung und Original schreibt — ohne Objekt, Variante, Kandidat oder Freigabe anzufassen.
// Die sichtbare Seite misst `kennzeichnung-und-widerspruch-mounted.test.tsx`.
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { lokalisierungsPaket, mitAenderungsauskunft } from "../../services/app/src/lesevarianten";
import type { KoSource } from "../../services/knowledge-object";

/** S01 der Lieferung — Kennung und Texte AUS der Lieferung, nicht abgeschrieben. */
const S01 = (() => {
  const paket = lokalisierungsPaket("advisor-ict-en-v1");
  const record = paket?.records.find((r) => r.key === "S01");
  if (!paket || !record?.confluence_id || !record.de || !record.en) {
    throw new Error("Datensatz S01 der Lieferung advisor-ict-en-v1 fehlt.");
  }
  return {
    paketId: paket.package_id,
    confluenceId: record.confluence_id,
    titelEn: record.en.title,
    titelDe: record.de.title,
    absatzEn: record.en.paragraphs[0] ?? "",
  };
})();

function quelle(sourceVersion?: number): KoSource {
  return {
    id: S01.confluenceId,
    label: "Confluence-Seite",
    url: `https://example.invalid/${S01.confluenceId}`,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    externalId: S01.confluenceId,
    ...(sourceVersion === undefined ? {} : { sourceVersion }),
    author: "importer",
    at: "2026-09-01T00:00:00.000Z",
  } as KoSource;
}

async function anmelden(
  app: ReturnType<typeof buildApp>,
  email: string,
): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: email, email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return { authorization: `Bearer ${login.json().token}` };
}

async function aufbau(): Promise<{
  app: ReturnType<typeof buildApp>;
  services: AppServices;
  headers: Record<string, string>;
  koId: string;
  koVersion: number;
}> {
  const services = buildServices();
  const app = buildApp(services);
  const headers = await anmelden(app, "a@x.de");
  const ko = await services.ko.create({
    title: S01.titelEn,
    statement: "Harbor Field Services is a fictional customer.",
    bodyHtml: "<p>Harbor Field Services is a fictional customer.</p>",
    type: "best_practice",
    category: "Onboarding",
    author: "importer",
    sources: [quelle(7)],
  });
  const laden = await app.inject({
    method: "POST",
    url: "/api/admin/lesevarianten/laden",
    headers,
    payload: { package: S01.paketId },
  });
  expect(laden.statusCode).toBe(200);
  return { app, services, headers, koId: ko.id, koVersion: ko.version };
}

async function widerspruchsEintraege(services: AppServices) {
  return (await services.audit?.list({ action: "lesevariante.widerspruch" })) ?? [];
}

describe("Peter Nr. 20 · Originalquelle und belegte Fassung an der Variante", () => {
  it("N1 · die Detailroute trägt Originalquelle (Anker, Quellfassung) und die belegte Fassung", async () => {
    const { app, headers, koId, koVersion } = await aufbau();
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}/lesevariante/de`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const v = res.json();
    expect(v.title).toBe(S01.titelDe);
    expect(v.originalquelle).toEqual({
      titel: S01.titelEn,
      provider: "Confluence",
      kennung: S01.confluenceId,
      url: `https://example.invalid/${S01.confluenceId}`,
      quellfassung: 7,
    });
    expect(v.fassung).toEqual({
      art: "wissensobjekt",
      version: koVersion,
      abdruck: String(v.originalSha256).slice(0, 12),
    });
    // Originalvorrang und fehlende Freigabe bleiben: der Status der Lieferung reist unverändert mit.
    expect(v.originalGeaendert).toBe(false);
    expect(String(v.status)).not.toMatch(/approved|freigegeben/i);
  });

  it("N2 · die Übersicht der Liste trägt dieselben beiden Angaben", async () => {
    const { app, headers, koId, koVersion } = await aufbau();
    const res = await app.inject({ method: "GET", url: "/api/lesevarianten?lang=de", headers });
    const eintraege = res.json().eintraege as Record<string, unknown>[];
    const eintrag = eintraege.find((e) => e.koId === koId);
    expect(eintrag?.originalquelle).toMatchObject({
      provider: "Confluence",
      kennung: S01.confluenceId,
    });
    expect(eintrag?.fassung).toMatchObject({ art: "wissensobjekt", version: koVersion });
  });

  it("N3 · Original seit der Übersetzung geändert → Fassung NICHT zugeordnet (null), Quelle bleibt", async () => {
    const { services, koId } = await aufbau();
    const variante = await services.lesevarianten.get(koId, "de");
    const ko = await services.ko.get(koId);
    if (!variante || !ko) {
      throw new Error("Aufbau unvollständig");
    }
    const sicht = mitAenderungsauskunft(variante, { ...ko, statement: `${ko.statement} (neu)` });
    expect(sicht.originalGeaendert).toBe(true);
    expect(sicht.fassung).toBeNull();
    expect(sicht.originalquelle?.kennung).toBe(S01.confluenceId);
  });

  it("N4 · ohne passenden Anker am Objekt ist die Originalquelle ausdrücklich NICHT zugeordnet", async () => {
    const { services, koId } = await aufbau();
    const variante = await services.lesevarianten.get(koId, "de");
    const ko = await services.ko.get(koId);
    if (!variante || !ko) {
      throw new Error("Aufbau unvollständig");
    }
    expect(mitAenderungsauskunft(variante, { ...ko, sources: [] }).originalquelle).toBeNull();
  });

  it("N5 · Kandidat ohne KO-ID: Originalquelle aus dem echten Kandidaten, Fassung ohne Quellbeleg null", async () => {
    const { app, headers } = await aufbau();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: {
        items: [
          {
            title: S01.titelEn,
            statement: S01.absatzEn,
            type: "best_practice",
            category: "Onboarding",
            author: "importer",
            provider: "Confluence",
            externalId: S01.confluenceId,
            sourceVersion: 4,
          },
        ],
      },
    });
    const kandidat = (angelegt.json() as { id: string; koId: string | null }[])[0];
    expect(kandidat?.koId).toBeNull();
    const res = await app.inject({
      method: "GET",
      url: `/api/library/import/candidates/${kandidat?.id}/lesevariante/de`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const v = res.json();
    expect(v.originalquelle).toMatchObject({
      titel: S01.titelEn,
      provider: "Confluence",
      kennung: S01.confluenceId,
    });
    // Der Quellabgleich ist hier unbestätigt (Kernaussage ≠ gelieferter Rohkörper) — also gibt es
    // keine BELEGTE Fassung, und die Antwort sagt das, statt die Quellfassung zu übernehmen.
    expect(v.quellabgleich).toBe("unbestaetigt");
    expect(v.fassung).toBeNull();
  });
});

describe("Peter Nr. 20 · Übersetzungswiderspruch melden — keine Freigabe, keine Änderung", () => {
  it("W1 · am Wissensobjekt: 201, GENAU EIN Protokolleintrag mit Bezug auf Übersetzung und Original", async () => {
    const { app, services, headers, koId, koVersion } = await aufbau();
    const vorher = await services.ko.get(koId);
    const varianteVorher = await services.lesevarianten.get(koId, "de");
    const res = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/lesevariante/de/widerspruch`,
      headers,
      payload: { begruendung: "  Die Übersetzung nennt 20 statt 25 Nutzer.  " },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      gemeldet: true,
      gegenstand: "wissensobjekt",
      ziel: koId,
      lang: "de",
    });
    const eintraege = await widerspruchsEintraege(services);
    expect(eintraege).toHaveLength(1);
    const eintrag = eintraege[0];
    expect(eintrag?.target).toBe(koId);
    expect(eintrag?.payload).toMatchObject({
      gegenstand: "wissensobjekt",
      lang: "de",
      originalLanguage: "en",
      uebersetzungSha256: varianteVorher?.uebersetzungSha256,
      originalSha256: varianteVorher?.originalSha256,
      koVersion,
      fassung: { art: "wissensobjekt", version: koVersion },
      originalquelle: { provider: "Confluence", kennung: S01.confluenceId, quellfassung: 7 },
      begruendung: "Die Übersetzung nennt 20 statt 25 Nutzer.",
    });
    // Der übersetzte Text selbst geht NICHT ins Protokoll.
    expect(JSON.stringify(eintrag?.payload)).not.toContain(S01.titelDe);
    // Nichts wurde verändert: Objekt (Version, Status, Inhalt) und Variante sind dieselben.
    const nachher = await services.ko.get(koId);
    expect(nachher?.version).toBe(vorher?.version);
    expect(nachher?.status).toBe(vorher?.status);
    expect(nachher?.statement).toBe(vorher?.statement);
    expect(await services.lesevarianten.get(koId, "de")).toEqual(varianteVorher);
  });

  it("W2 · ohne Begründung keine Meldung (400), kein Eintrag", async () => {
    const { app, services, headers, koId } = await aufbau();
    for (const payload of [{}, { begruendung: "   " }, { begruendung: 42 }]) {
      const res = await app.inject({
        method: "POST",
        url: `/api/kos/${koId}/lesevariante/de/widerspruch`,
        headers,
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("MISSING_REASON");
    }
    const zuLang = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/lesevariante/de/widerspruch`,
      headers,
      payload: { begruendung: "x".repeat(2001) },
    });
    expect(zuLang.json().error).toBe("REASON_TOO_LONG");
    expect(await widerspruchsEintraege(services)).toHaveLength(0);
  });

  it("W3 · ohne Anmeldung 401; ohne Variante bzw. ohne Objekt 404 — jeweils kein Eintrag", async () => {
    const { app, services, headers, koId } = await aufbau();
    const anonym = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/lesevariante/de/widerspruch`,
      payload: { begruendung: "Widerspruch" },
    });
    expect(anonym.statusCode).toBe(401);
    const originalsprache = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/lesevariante/en/widerspruch`,
      headers,
      payload: { begruendung: "Widerspruch" },
    });
    expect(originalsprache.statusCode).toBe(404);
    expect(originalsprache.json().error).toBe("NO_LESEVARIANTE");
    const unbekannt = await app.inject({
      method: "POST",
      url: "/api/kos/gibt-es-nicht/lesevariante/de/widerspruch",
      headers,
      payload: { begruendung: "Widerspruch" },
    });
    expect(unbekannt.statusCode).toBe(404);
    expect(unbekannt.json().error).toBe("NOT_FOUND");
    expect(await widerspruchsEintraege(services)).toHaveLength(0);
  });

  it("W4 · am Kandidaten ohne KO-ID: 201, Ziel ist der Kandidat, Kandidat bleibt neu und ohne koId", async () => {
    const { app, services, headers } = await aufbau();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: {
        items: [
          {
            title: S01.titelEn,
            statement: S01.absatzEn,
            type: "best_practice",
            category: "Onboarding",
            author: "importer",
            provider: "Confluence",
            externalId: S01.confluenceId,
          },
        ],
      },
    });
    const kandidatId = (angelegt.json() as { id: string }[])[0]?.id ?? "";
    const res = await app.inject({
      method: "POST",
      url: `/api/library/import/candidates/${kandidatId}/lesevariante/de/widerspruch`,
      headers,
      payload: { begruendung: "Kernaussage weicht vom Original ab." },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ gemeldet: true, gegenstand: "kandidat", ziel: kandidatId });
    const eintraege = await widerspruchsEintraege(services);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.target).toBe(kandidatId);
    expect(eintraege[0]?.payload).toMatchObject({
      gegenstand: "kandidat",
      originalquelle: { provider: "Confluence", kennung: S01.confluenceId },
      begruendung: "Kernaussage weicht vom Original ab.",
    });
    const queue = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    const kandidaten = queue.json() as { id: string; status: string; koId: string | null }[];
    expect(kandidaten).toHaveLength(1);
    expect({ status: kandidaten[0]?.status, koId: kandidaten[0]?.koId }).toEqual({
      status: "neu",
      koId: null,
    });
  });
});
