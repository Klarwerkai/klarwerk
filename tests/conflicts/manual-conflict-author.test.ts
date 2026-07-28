import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ConflictService, InMemoryConflictRepo } from "../../services/conflicts";

// Die Form eines Konflikt-Datensatzes VOR mega26 — ohne createdBy.
type ConflictOhneUrheber = Omit<Conflict, "createdBy" | "detector">;

// AUFTRAG-mega26 Block B (Lücke 2) — DER MANUELLE KONFLIKT NENNT SEINEN URHEBER.
//
// Der automatisch erkannte Zweig war schon auskunftsfähig (origin="auto" + detector mit Begründung,
// Zitaten, Sicherheit, promptVersion). Der manuelle war es nicht: den Actor trug ausschliesslich das
// Audit-Log, und `detector` bleibt dort systematisch leer. Wer den Konflikt las, sah eine Behauptung
// ohne Urheber — nachschlagbar nur über eine zweite, getrennt berechtigte Quelle.
//
// Der Erzeuger kennt den Actor: die Route reicht den authentifizierten `user.id` bereits an
// `create` durch. Er steht jetzt auch am Datensatz — derselbe Wert, den das Audit protokolliert.
describe("mega26 Block B: Urheber am manuell angelegten Konflikt", () => {
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
    return { app, headers, adminId: login.json().user.id as string };
  }

  async function neuesKo(app: App, headers: Record<string, string>, titel: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: titel,
        statement: `${titel} — Aussage.`,
        type: "best_practice",
        category: "Anlage 3",
        neededValidations: 1,
      },
    });
    return (res.json() as KnowledgeObject).id;
  }

  it("manuelle Anlage: createdBy ist der authentifizierte Nutzer — am Datensatz, nicht nur im Audit", async () => {
    const { app, headers, adminId } = await umgebung();
    const koA = await neuesKo(app, headers, "Ventil A");
    const koB = await neuesKo(app, headers, "Ventil B");

    const angelegt = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: {
          koA,
          koB,
          type: "truth",
          description: "Die beiden Angaben widersprechen sich.",
        },
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const erstellt = angelegt.json() as Conflict;
    expect(erstellt.origin).toBe("manual");
    expect(erstellt.createdBy).toBe(adminId);

    // Und er überlebt das Speichern — der Lesepfad (Detail) zeigt denselben Urheber.
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/conflicts/${erstellt.id}`,
      headers,
    });
    expect(gelesen.statusCode).toBe(200);
    expect((gelesen.json() as Conflict).createdBy).toBe(adminId);

    // Er ist derselbe Wert, den das Audit trägt — keine zweite Wahrheit.
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers });
    const eintrag = (audit.json() as { actor: string; action: string; target: string }[]).find(
      (a) => a.action === "conflict.created" && a.target === erstellt.id,
    );
    expect(eintrag?.actor).toBe(adminId);
  });

  it("der automatische Zweig setzt das Feld NICHT — dort weist sich der Erzeuger über detector aus", async () => {
    const { app, headers } = await umgebung();
    // Der Demo-Seed legt automatisch erkannte Konflikte an (origin="auto" mit detector).
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });

    const alle = (
      await app.inject({ method: "GET", url: "/api/conflicts", headers })
    ).json() as Conflict[];
    const automatisch = alle.filter((c) => c.origin === "auto");
    expect(automatisch.length).toBeGreaterThan(0);
    for (const c of automatisch) {
      expect(Object.hasOwn(c, "createdBy")).toBe(false);
      // Der auto-Zweig bleibt unverändert auskunftsfähig.
      expect(c.detector).toBeDefined();
    }
  });

  it("Altbestand OHNE das Feld bleibt gültig — Lesen und Lebenszyklus brechen nicht", async () => {
    // Ein Datensatz genau in der Form von vor mega26: kein createdBy. Er wird am Service vorbei
    // direkt ins Repo gelegt, damit der Altzustand echt ist und nicht nachgestellt.
    const repo = new InMemoryConflictRepo();
    const svc = new ConflictService({ repo });
    const alt: ConflictOhneUrheber = {
      id: "alt-1",
      koA: "ko-a",
      koB: "ko-b",
      type: "truth",
      description: "Altbestand aus der Zeit vor mega26.",
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      origin: "manual",
      createdAt: "2026-05-01T08:00:00.000Z",
    };
    await repo.insert(alt as never);

    const gelesen = await svc.get("alt-1");
    expect(gelesen).toBeDefined();
    expect(gelesen?.createdBy).toBeUndefined();
    expect(Object.hasOwn(gelesen as object, "createdBy")).toBe(false);
    // Der Lebenszyklus arbeitet auf dem Altdatensatz unverändert weiter.
    expect((await svc.unresolved()).some((c) => c.id === "alt-1")).toBe(true);
  });
});
