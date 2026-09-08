// ================================================================================================
// JOB 3277 · C — ENTFERNEN HEISST: GENAU DIESES PAKET, UND SONST NICHTS.
// ================================================================================================
//
// DIE GEFAHR, gegen die diese Datei steht, ist der stille Kollateralschaden. Bis JOB 3277 gab es
// zum Entfernen von Beispielen NUR den Gesamt-Purge (DELETE /api/admin/demo-seed) — er nimmt jedes
// Objekt mit `demoSeed`. Wer nach der Vorführung „das Advisor-Paket" wegräumen wollte, räumte
// zwangsläufig auch die WP-B6-Pakete und den Demo-Seed mit weg. Ein paketbezogenes Entfernen, das
// diesen Fehler wiederholt, wäre schlimmer als keines: es verspräche Genauigkeit und hätte keine.
//
// GEPRÜFT WIRD DESHALB AN EINEM VOLLEN TISCH: Advisor-Paket + WP-B6-Paket „konflikte" (mit seinen
// drei echten Konflikten) + ein ECHTES Nutzerobjekt ohne Demo-Merker. Danach fällt genau eine
// Auswahl weg. Und weil ein Konflikt, der auf ein gelöschtes Objekt zeigt, ein Rest wäre, prüft C2
// zusätzlich: die Folgeeinträge DIESES Pakets werden geschlossen, die der anderen nicht.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { EXAMPLE_TITLE_PREFIX } from "../../services/app/src/example-packages";
import { ADVISOR_ICT_EN_V1 } from "../../services/app/src/example-packages/advisor-ict-en-v1";

const PAKET = ADVISOR_ICT_EN_V1.id;

async function adminApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

type App = Awaited<ReturnType<typeof adminApp>>["app"];
type Kopf = Record<string, string>;

const ladeAdvisor = (app: App, headers: Kopf) =>
  app.inject({ method: "POST", url: `/api/admin/demo-packages/${PAKET}/load`, headers });
const entferneAdvisor = (app: App, headers: Kopf, id = PAKET) =>
  app.inject({ method: "DELETE", url: `/api/admin/demo-packages/${id}`, headers });

interface Bilanz {
  package: string;
  removed: number;
  closedConflicts: number;
  closedDuplicates: number;
  created: number;
  updated: number;
  skipped: number;
  failures: { key: string; grund: string }[];
}

/** Der volle Tisch: Advisor-Paket, WP-B6-Paket „konflikte", ein echtes Nutzerobjekt. */
async function vollerTisch() {
  const { app, services, headers } = await adminApp();
  await ladeAdvisor(app, headers);
  await app.inject({
    method: "POST",
    url: "/api/admin/examples/load",
    headers,
    payload: { package: "konflikte" },
  });
  const echt = await services.ko.create({
    title: "Drehmoment der Spannpratze am Rundtisch",
    statement: "Die Spannpratze am Rundtisch wird mit 45 Nm angezogen und danach gekontert.",
    type: "technik",
    category: "Montage",
    author: "admin",
    tags: ["echt"],
  });
  return { app, services, headers, echt };
}

const advisorIds = (kos: { id: string; sources?: { externalId?: string }[] }[]): string[] =>
  kos
    .filter((k) => (k.sources ?? []).some((s) => (s.externalId ?? "").startsWith(`${PAKET}/`)))
    .map((k) => k.id);

describe("JOB 3277 C1 · das paketbezogene Entfernen trifft nur sein Paket", () => {
  it("6 entfernt; WP-B6-Beispiele, deren Konflikte und das echte Nutzerobjekt bleiben", async () => {
    const { app, services, headers, echt } = await vollerTisch();
    expect((await services.ko.list()).length).toBe(6 + 6 + 1);
    expect((await services.conflicts.unresolved()).length).toBe(3);

    const res = await entferneAdvisor(app, headers);
    expect(res.statusCode).toBe(200);
    const bilanz = res.json() as Bilanz;
    expect(bilanz.package).toBe(PAKET);
    expect(bilanz.removed).toBe(6);
    expect(bilanz.failures).toEqual([]);

    const rest = await services.ko.list();
    expect(rest.length).toBe(7);
    // Kein einziger Advisor-Baustein mehr da …
    expect(advisorIds(rest)).toEqual([]);
    // … die sechs WP-B6-Beispiele schon, mitsamt ihren drei Konflikten …
    expect(rest.filter((k) => k.title.startsWith(EXAMPLE_TITLE_PREFIX)).length).toBe(6);
    expect((await services.conflicts.unresolved()).length).toBe(3);
    // … und das echte Nutzerobjekt ist unangetastet, Zeichen für Zeichen.
    const nachher = await services.ko.get(echt.id);
    expect(nachher?.title).toBe(echt.title);
    expect(nachher?.statement).toBe(echt.statement);
    expect(nachher?.version).toBe(echt.version);
  });

  it("zweimal entfernen: der zweite Lauf entfernt 0 und meldet keinen Fehler", async () => {
    const { app, headers } = await vollerTisch();
    expect(((await entferneAdvisor(app, headers)).json() as Bilanz).removed).toBe(6);
    const zweiter = (await entferneAdvisor(app, headers)).json() as Bilanz;
    expect(zweiter.removed).toBe(0);
    expect(zweiter.failures).toEqual([]);
  });

  it("unbekanntes Paket: 404, und nichts ist weg", async () => {
    const { app, services, headers } = await vollerTisch();
    expect((await entferneAdvisor(app, headers, "gibt-es-nicht")).statusCode).toBe(404);
    expect((await services.ko.list()).length).toBe(13);
  });

  it("nach dem Entfernen ist das Paket wieder ladbar (der Kreis schließt sich)", async () => {
    const { app, services, headers } = await adminApp();
    await ladeAdvisor(app, headers);
    await entferneAdvisor(app, headers);
    expect((await services.ko.list()).length).toBe(0);
    const wieder = (await ladeAdvisor(app, headers)).json() as Bilanz;
    expect(wieder.created).toBe(6);
    expect((await services.ko.list()).length).toBe(6);
  });
});

describe("JOB 3277 C2 · Folgeeinträge dieses Pakets werden geschlossen, fremde nicht", () => {
  it("Konflikt und Doppelung am Advisor-Objekt gehen mit; die drei WP-B6-Konflikte bleiben offen", async () => {
    const { app, services, headers, echt } = await vollerTisch();
    const advisor = advisorIds(await services.ko.list());
    expect(advisor.length).toBe(6);

    // Ein Konflikt, wie ihn der Confluence-Import am Freitag erzeugt: Advisor-Baustein gegen ein
    // anderes Objekt.
    await services.conflicts.createAuto(
      {
        koA: advisor[0] as string,
        koB: echt.id,
        type: "truth",
        description: "Widersprüchliche Angaben (Prüffall)",
      },
      { trigger: "background", method: "deterministic", rationale: "Prüffall" },
      "admin",
    );
    // Und eine Doppelung zwischen zwei Advisor-Bausteinen.
    await services.overlaps.createAuto(
      {
        koA: advisor[1] as string,
        koB: advisor[2] as string,
        relation: "teilweise",
        aspects: [{ beschreibung: "Prüffall", zitatA: "a", zitatB: "b" }],
        eigenanteilA: "a",
        eigenanteilB: "b",
        recommendation: "getrennt_lassen",
      },
      { trigger: "background", method: "deterministic", lexicalScore: 0.5 },
      "admin",
    );
    expect((await services.conflicts.unresolved()).length).toBe(4);
    expect((await services.overlaps.unresolved()).length).toBe(1);

    const bilanz = (await entferneAdvisor(app, headers)).json() as Bilanz;
    expect(bilanz.closedConflicts).toBe(1);
    expect(bilanz.closedDuplicates).toBe(1);
    expect(bilanz.failures).toEqual([]);
    // Die drei fremden Konflikte des WP-B6-Pakets stehen unverändert offen.
    const offen = await services.conflicts.unresolved();
    expect(offen.length).toBe(3);
    const weg = new Set(advisor);
    expect(offen.some((c) => weg.has(c.koA) || weg.has(c.koB))).toBe(false);
    expect((await services.overlaps.unresolved()).length).toBe(0);
  });
});

describe("JOB 3277 C3 · der bestehende Gesamt-Purge nimmt das Paket weiter mit", () => {
  it("DELETE /api/admin/demo-seed räumt Advisor-Paket UND WP-B6-Beispiele ab", async () => {
    const { app, services, headers, echt } = await vollerTisch();
    const purge = await app.inject({ method: "DELETE", url: "/api/admin/demo-seed", headers });
    expect(purge.statusCode).toBe(200);
    const rest = await services.ko.list();
    // Nur das echte Nutzerobjekt bleibt — es trägt keinen Demo-Merker.
    expect(rest.map((k) => k.id)).toEqual([echt.id]);
  });
});
