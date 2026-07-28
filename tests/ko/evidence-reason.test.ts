import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// AUFTRAG-mega26 Block B (Lücke 1) — DER EVIDENCE-RECORD TRÄGT SEINEN GRUND.
//
// Vor mega26 sagte ein EvidenceRecord nur, DASS eine Quelle an einem KO hängt. Das WARUM stand
// ausschliesslich mittelbar im `excerpt` der zugehörigen KoSource — einem Datensatz, den die
// append-only Evidence nicht kopierte. Der Erzeuger kennt den Grund zum Schreibzeitpunkt (die
// fertige KoSource liegt im selben Scope), also wird er mitgeschrieben.
//
// Bewiesen wird beides: dass der Grund ankommt, WO es einen gibt — und dass KEIN leeres Feld
// entsteht, wo es keinen gibt (Anhänge haben keine Belegstelle).
describe("mega26 Block B: Grund der Verknüpfung am EvidenceRecord", () => {
  type App = ReturnType<typeof buildApp>;

  async function umgebung() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    // Die Belegpflicht-Stufe steht per Default auf "search_on_click" — dort darf keine Quelle mit
    // öffentlicher Adresse angehängt werden (mega16 Block A, fail-closed). Für diesen Test geht es
    // nicht um die Stufenregel, sondern um den Grund AM Evidence-Record; also wird die Stufe über
    // die echte Admin-Route auf "open" gesetzt. Die Regel selbst bleibt unangetastet.
    const stufe = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage: "open" },
    });
    expect(stufe.statusCode).toBe(200);
    return { app, headers };
  }

  async function neuesKo(app: App, headers: Record<string, string>) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Entlüften der Pumpe",
        statement: "Vor dem Anfahren entlüften.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 1,
      },
    });
    return (res.json() as KnowledgeObject).id;
  }

  async function evidenz(app: App, headers: Record<string, string>, koId: string) {
    const res = await app.inject({ method: "GET", url: `/api/kos/${koId}/evidence`, headers });
    expect(res.statusCode).toBe(200);
    return res.json() as EvidenceRecord[];
  }

  const BELEG =
    "Abschnitt 4.2: Die Pumpe ist vor jedem Anfahren zu entlüften, andernfalls droht Trockenlauf.";

  it("Quelle MIT Belegstelle: der Grund steht wörtlich am Evidence-Record", async () => {
    const { app, headers } = await umgebung();
    const koId = await neuesKo(app, headers);

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "add-source",
        source: {
          label: "Betriebsanleitung",
          url: "https://example.org/anleitung",
          excerpt: BELEG,
        },
      },
    });
    expect(res.statusCode).toBe(200);

    const records = await evidenz(app, headers, koId);
    const quelle = records.find((r) => r.kind === "source");
    expect(quelle).toBeDefined();
    expect(quelle?.excerpt).toBe(BELEG);
    // Der Grund ist zusätzlich, nicht ersetzend — Label/Actor bleiben unverändert.
    expect(quelle?.label).toBe("Betriebsanleitung");
    expect(quelle?.createdBy).toBeTruthy();
  });

  it('Quelle OHNE Belegstelle: KEIN leeres Feld (weggelassen, nicht "")', async () => {
    const { app, headers } = await umgebung();
    const koId = await neuesKo(app, headers);

    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "add-source",
        source: { label: "Nur ein Verweis", url: "https://x.de/a" },
      },
    });

    const quelle = (await evidenz(app, headers, koId)).find((r) => r.kind === "source");
    expect(quelle).toBeDefined();
    expect(Object.hasOwn(quelle as object, "excerpt")).toBe(false);
  });

  it("nur Leerraum als Belegstelle zählt als keine Belegstelle", async () => {
    const { app, headers } = await umgebung();
    const koId = await neuesKo(app, headers);

    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "add-source", source: { label: "Leer", excerpt: "   " } },
    });

    const quelle = (await evidenz(app, headers, koId)).find((r) => r.kind === "source");
    expect(Object.hasOwn(quelle as object, "excerpt")).toBe(false);
  });

  it("die Belegstelle wird getrimmt übernommen (dieselbe Normalisierung wie die Quelle)", async () => {
    const { app, headers } = await umgebung();
    const koId = await neuesKo(app, headers);

    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "add-source", source: { label: "Getrimmt", excerpt: `\n  ${BELEG}  \n` } },
    });

    const quelle = (await evidenz(app, headers, koId)).find((r) => r.kind === "source");
    expect(quelle?.excerpt).toBe(BELEG);
    // Der Evidence-Grund und die Quelle am KO sagen dasselbe — keine zweite Wahrheit.
    const ko = (
      await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers })
    ).json() as KnowledgeObject;
    expect(ko.sources?.[0]?.excerpt).toBe(BELEG);
  });

  it("ANHANG: kein Grund-Feld — dort gibt es zum Schreibzeitpunkt keinen Grund zu kennen", async () => {
    const { app, headers } = await umgebung();
    const koId = await neuesKo(app, headers);

    const hochgeladen = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "plan.png",
        mime: "image/png",
        purpose: "attachment",
        // 1x1-PNG, kleinstmöglich — es geht nur um die Existenz eines Objekt-Anhangs.
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    });
    expect(hochgeladen.statusCode).toBe(201);

    const angehaengt = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "attach",
        attachment: { name: "plan.png", mime: "image/png", objectId: hochgeladen.json().id },
      },
    });
    expect(angehaengt.statusCode).toBe(200);

    const anhang = (await evidenz(app, headers, koId)).find((r) => r.kind === "attachment");
    expect(anhang).toBeDefined();
    expect(Object.hasOwn(anhang as object, "excerpt")).toBe(false);
  });
});
