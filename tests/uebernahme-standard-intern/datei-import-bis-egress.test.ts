// ==================================================================================================
// N11 · ÜBERNAHME OHNE EINSTUFUNG AUSSERHALB VON CONFLUENCE — BIS ZUM KI-EGRESS.
// ==================================================================================================
//
// WAS DIESE DATEI MISST (BEN-Befund K6 zu Kandidat 27c4a92d): JOB 3089 hat den Übernahme-Standard
// „intern" nur am Confluence-Mapper umgesetzt; der Import-Kern setzte eine fehlende Stufe an beiden
// Anlagewegen weiter auf „vertraulich" (`library-analytics/src/service.ts`, Accept und
// `importJson`). Seit diesem Auftrag gilt dort derselbe Standard (`UEBERNAHME_STANDARD`).
//
//   I1/I2 · Importitem OHNE `confidentiality` über die echten Routen — Kandidat + Accept, und
//           separat `POST /api/library/import` — ergibt ein Objekt mit gespeichertem „intern".
//   I3    · GEGENPROBE: ausdrücklich „vertraulich"/„streng_vertraulich" bleiben unverändert.
//   E1–E3 · Die drei echten KI-Routen (`/api/reasoner`, `/api/check-text` want:deep,
//           `/api/knowledge/check`) mit dem GESPEICHERTEN Anker an einem aufzeichnenden
//           Modelltransport: das importierte interne Objekt erreicht den Transport.
//   G1–G3 · GEGENPROBE: dasselbe mit dem Anker eines importierten VERTRAULICHEN Objekts und der
//           Client-Behauptung „intern" — der Transport sieht nichts.
//
// AUFBAU wie `tests/n11b-zustimmung-macht-intern/zustimmung.test.ts`: echte Kompositionswurzel,
// echte Anmeldung, Grundfreigabe über `erteileKiFreigabe`; ersetzt ist allein der externe
// Modelltransport, der mitschreibt. OHNE Klara-Bindung (Browserweg): die Dokumentzustimmung spielt
// hier keine Rolle, die Stufe kommt aus Rumpf und gespeichertem Anker. Keine echte Cloud.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CONFIDENTIAL_CLOUD_BLOCKED } from "../../services/app/src/routes/reasoner-routes";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const TEXT_INTERN = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";
const TEXT_VERTRAULICH = "Vor dem Öffnen des Schaltschranks die Anlage spannungsfrei schalten.";
const TEXT_STRENG = "Der Notfallcode der Leitwarte wird nur mündlich weitergegeben.";

const apps: ReturnType<typeof buildApp>[] = [];
beforeEach(() => vi.stubEnv("KLARWERK_ADDON_API", "1"));
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
});

async function aufbauen() {
  const gesehen: string[] = [];
  const services = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider({
      name: "anthropic-n11-import",
      completeVision: async () => "Ein Bild.",
      complete: async (system, prompt) => {
        gesehen.push(`${system}\n${prompt}`);
        if (system.includes('"kein_konflikt"')) {
          return JSON.stringify({
            relation: "kein_konflikt",
            older: null,
            confidence: 0.95,
            begruendung: "Die Aussagen widersprechen sich nicht.",
            zitat_a: "Pumpe entlüften",
            zitat_b: "Pumpe entlüften",
          });
        }
        return "Nach dem Anfahren zehn Sekunden warten und die Pumpe danach entlüften.";
      },
    }),
  );
  await erteileKiFreigabe(services.reasoner);
  const app = buildApp(services);
  apps.push(app);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "N11", email: "n11-import@example.test", password: "test-password-n11" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n11-import@example.test", password: "test-password-n11" },
  });
  expect(login.statusCode, login.body).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { services, app, headers, gesehen };
}
type Aufbau = Awaited<ReturnType<typeof aufbauen>>;

/** Kandidat anlegen und annehmen — der reguläre Prüfweg. Liefert die Kennung des Objekts. */
async function ueberKandidat(a: Aufbau, item: Record<string, unknown>): Promise<string> {
  const angelegt = await a.app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: a.headers,
    payload: { items: [item] },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const kandidat = (angelegt.json() as { id: string }[])[0];
  expect(kandidat?.id, angelegt.body).toBeTruthy();
  const angenommen = await a.app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${kandidat?.id}`,
    headers: a.headers,
    payload: { action: "accept" },
  });
  expect(angenommen.statusCode, angenommen.body).toBe(200);
  const koId = (angenommen.json() as { koId: string | null }).koId;
  expect(koId, angenommen.body).toBeTruthy();
  return koId as string;
}

/** Der direkte JSON-Import — ohne Warteschlange. Liefert die Kennung über den Titel. */
async function ueberJsonImport(a: Aufbau, item: Record<string, unknown>): Promise<string> {
  const res = await a.app.inject({
    method: "POST",
    url: "/api/library/import",
    headers: a.headers,
    payload: { items: [item] },
  });
  expect(res.statusCode, res.body).toBeLessThan(300);
  expect((res.json() as { imported?: number }).imported, res.body).toBe(1);
  const ko = (await a.services.ko.list()).find((k) => k.title === item.title);
  expect(ko, `das importierte Objekt „${String(item.title)}“ fehlt im Bestand`).toBeDefined();
  return ko?.id as string;
}

/** Die Stufe, wie die Detailroute sie ausliefert — gelesen, nicht aus der Eingabe abgeleitet. */
async function gespeicherteStufe(a: Aufbau, koId: string): Promise<unknown> {
  const res = await a.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: a.headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { confidentiality?: unknown }).confidentiality;
}

function item(title: string, statement: string, stufe?: string): Record<string, unknown> {
  return {
    title,
    statement,
    type: "best_practice",
    category: "Wartung",
    ...(stufe ? { confidentiality: stufe } : {}),
  };
}

describe("N11 · Übernahme ohne Einstufung ergibt „intern“ — außerhalb von Confluence", () => {
  it("I1 — Kandidat ohne Stufe, angenommen: das Objekt trägt gespeichert „intern“", async () => {
    const a = await aufbauen();
    const koId = await ueberKandidat(a, item("Pumpe entlüften", TEXT_INTERN));
    expect(await gespeicherteStufe(a, koId)).toBe("intern");
  });

  it("I2 — direkter JSON-Import ohne Stufe: das Objekt trägt gespeichert „intern“", async () => {
    const a = await aufbauen();
    const koId = await ueberJsonImport(a, item("Pumpe entlüften", TEXT_INTERN));
    expect(await gespeicherteStufe(a, koId)).toBe("intern");
  });

  it("I3 — GEGENPROBE: mitgelieferte vertrauliche Stufen bleiben an beiden Wegen unverändert", async () => {
    const a = await aufbauen();
    const kv = await ueberKandidat(a, item("Schaltschrank", TEXT_VERTRAULICH, "vertraulich"));
    const js = await ueberJsonImport(a, item("Notfallcode", TEXT_STRENG, "streng_vertraulich"));
    expect(await gespeicherteStufe(a, kv)).toBe("vertraulich");
    expect(await gespeicherteStufe(a, js)).toBe("streng_vertraulich");
  });
});

describe("N11 · die externe KI folgt der gespeicherten Stufe des übernommenen Objekts", () => {
  /** Beide Objekte im selben Bestand: das interne ist zugleich Kandidat der Widerspruchsprüfung. */
  async function bestand() {
    const a = await aufbauen();
    const intern = await ueberKandidat(a, item("Pumpe entlüften", TEXT_INTERN));
    const vertraulich = await ueberJsonImport(
      a,
      item("Schaltschrank", TEXT_VERTRAULICH, "vertraulich"),
    );
    // Kalibrierung: die Voraussetzung jedes Falls unten steht wirklich im Bestand.
    expect(await gespeicherteStufe(a, intern)).toBe("intern");
    expect(await gespeicherteStufe(a, vertraulich)).toBe("vertraulich");
    a.gesehen.length = 0;
    return { a, intern, vertraulich };
  }

  async function reasoner(a: Aufbau, koId: string) {
    return a.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: { ...a.headers, "content-type": "application/json" },
      payload: { task: "assist", text: TEXT_INTERN, ...draftProvenance("intern", koId) },
    });
  }

  async function checkText(a: Aufbau, koId: string) {
    const res = await a.app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { ...a.headers, "content-type": "application/json" },
      payload: {
        text: TEXT_INTERN,
        want: "deep",
        source: "transient-document",
        koId,
        confidentiality: "intern",
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as { konfliktpruefung: { gelaufen: boolean; grund: string | null } };
  }

  async function knowledgeCheck(a: Aufbau, koId: string) {
    const res = await a.app.inject({
      method: "POST",
      url: "/api/knowledge/check",
      headers: { ...a.headers, "content-type": "application/json" },
      payload: { text: TEXT_INTERN, source: "draft", koId, confidentiality: "intern" },
    });
    expect(res.statusCode, res.body).toBe(200);
  }

  it("E1 — Reasoner: der Anker des importierten internen Objekts öffnet den Transport", async () => {
    const { a, intern } = await bestand();
    const res = await reasoner(a, intern);
    expect(res.statusCode, res.body).toBe(200);
    expect((res.json() as { demo: boolean }).demo).toBe(false);
    expect(a.gesehen.join("\n")).toContain(TEXT_INTERN);
  });

  it("G1 — Reasoner GEGENPROBE: gespeichert vertraulich + Behauptung „intern“ → 409 backstop", async () => {
    const { a, vertraulich } = await bestand();
    const res = await reasoner(a, vertraulich);
    expect(res.statusCode, res.body).toBe(409);
    expect((res.json() as { code?: unknown }).code).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
    expect((res.json() as { reason?: unknown }).reason).toBe("backstop");
    expect(res.body).not.toContain(TEXT_INTERN);
    expect(a.gesehen).toEqual([]);
  });

  it("E2 — check-text want:deep: der interne Anker lässt die Widerspruchsprüfung laufen", async () => {
    const { a, intern } = await bestand();
    const ergebnis = await checkText(a, intern);
    expect(ergebnis.konfliktpruefung.grund).not.toBe("vertraulich");
    expect(a.gesehen.join("\n")).toContain(TEXT_INTERN);
  });

  it("G2 — check-text GEGENPROBE: vertraulicher Anker + Behauptung „intern“ → kein Egress", async () => {
    const { a, vertraulich } = await bestand();
    const ergebnis = await checkText(a, vertraulich);
    expect(ergebnis.konfliktpruefung.grund).toBe("vertraulich");
    expect(a.gesehen).toEqual([]);
  });

  it("E3 — knowledge-check: der interne Anker erreicht den Modelltransport", async () => {
    const { a, intern } = await bestand();
    await knowledgeCheck(a, intern);
    expect(a.gesehen.join("\n")).toContain("kein_konflikt");
  });

  it("G3 — knowledge-check GEGENPROBE: vertraulicher Anker + Behauptung „intern“ → kein Egress", async () => {
    const { a, vertraulich } = await bestand();
    await knowledgeCheck(a, vertraulich);
    expect(a.gesehen).toEqual([]);
  });
});
