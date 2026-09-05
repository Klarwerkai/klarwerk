import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

// ================================================================================================
// JOB 3066 R4 · F5 — EINE LÖSCHUNG, EIN AUFRÄUMWEG (bens Korrekturpflicht 1 zu R3).
// ================================================================================================
//
// ben hat gemessen, was der Pin auf `build-app.ts` allein nicht sieht: `DELETE /api/kos/:id` rief
// nach `ko.delete` beide Aufräumdienste selbst. Für ein DEMO-Seed-Objekt kippt `ko.delete` intern
// in die harte Endlöschung (services/knowledge-object/src/service.ts:3919-3927) — der
// transaktionsgebundene Haken hatte dann bereits aufgeräumt, und der Nachlauf der Route lief
// ZUSÄTZLICH. Zwei Wege, auf denen eine Löschung Befunde schliesst, und nur einer davon an die
// Transaktion gebunden; dass der zweite nichts mehr fand, war Wirkungslosigkeit, keine Ablösung.
//
// Seit R4 (ko-routes.ts ist Zielpfad, Nachtrag der Steuerung 05.09. 02:26) läuft der Nachlauf der
// Route ausschliesslich nach einem tatsächlich WEICHEN Löschen. Dieser Test misst beide Ausgänge
// derselben Route an derselben Zählung:
//   HARTER AUSGANG (Demo-Seed)  — genau EIN Ruf je Dienst, und zwar der im Haken der Transaktion.
//   WEICHER AUSGANG (Papierkorb) — genau EIN Ruf je Dienst, und zwar der Nachlauf der Route.
// Dazu jeweils die WIRKUNG: je Befund genau EIN Abschlussbeleg, nie zwei.
describe("JOB 3066 R4 · F5: DELETE /api/kos/:id räumt auf JEDEM Ausgang genau einmal auf", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token as string}` };
  }

  async function welt() {
    const services = buildServices();
    const app = buildApp(services);
    // Die Zählung sitzt auf der Dienstinstanz — beide Aufrufwege (Haken UND Route) schlagen
    // dieselbe Methode an, also sieht sie jeden von ihnen.
    const rufe = { konflikte: [] as number[], ueberschneidungen: [] as number[] };
    const echteKonflikte = services.conflicts.onKoRemoved.bind(services.conflicts);
    const echteUeberschneidungen = services.overlaps.onKoRemoved.bind(services.overlaps);
    services.conflicts.onKoRemoved = async (koId, actor, tx) => {
      const n = await echteKonflikte(koId, actor, tx);
      rufe.konflikte.push(n);
      return n;
    };
    services.overlaps.onKoRemoved = async (koId, actor, tx) => {
      const n = await echteUeberschneidungen(koId, actor, tx);
      rufe.ueberschneidungen.push(n);
      return n;
    };

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const headers = await login(app, "a@x.de", "secret123");
    return { services, app, headers, rufe };
  }

  async function befundePaar(
    services: Awaited<ReturnType<typeof welt>>["services"],
    koA: string,
    koB: string,
  ) {
    const overlap = await services.overlaps.createAuto(
      {
        koA,
        koB,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    const conflict = await services.conflicts.create(
      { koA, koB, type: "truth", description: "Widerspruch zur Frist" },
      "anna",
    );
    return { overlap, conflict };
  }

  async function belege(
    services: Awaited<ReturnType<typeof welt>>["services"],
    action: string,
    target: string,
  ) {
    return (await services.audit.list({ action })).filter((e) => e.target === target);
  }

  it("Demo-Seed-Objekt (harter Ausgang): NUR der Haken der Transaktion räumt auf, genau einmal", async () => {
    const { services, app, headers, rufe } = await welt();
    const seed = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(seed.statusCode).toBeLessThan(300);
    // Der Demo-Zugang wird nur benutzt, um sicher im geseedeten Bestand zu stehen.
    expect(demoKennwort(seed, "erik@demo.klarwerk")).toBeTruthy();

    const kos = (await app
      .inject({ method: "GET", url: "/api/kos", headers })
      .then((r) => r.json())) as Array<{ id: string; demoSeed?: boolean }>;
    const demo = kos.filter((k) => k.demoSeed === true);
    expect(demo.length).toBeGreaterThanOrEqual(2);
    const a = demo[0]?.id ?? "";
    const b = demo[1]?.id ?? "";
    const { overlap, conflict } = await befundePaar(services, a, b);

    const del = await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers });
    expect(del.statusCode).toBe(204);

    // GENAU EIN Ruf je Dienst — der im transaktionsgebundenen Haken, der je einen Befund
    // schliesst. Der Nachlauf der Route läuft hier gar nicht mehr: ein zweiter Eintrag (auch ein
    // wirkungsloser `0`) wäre ein zweiter Schliessweg und macht diesen Test rot.
    expect(rufe.ueberschneidungen).toEqual([1]);
    expect(rufe.konflikte).toEqual([1]);

    // Die Wirkung: genau EIN Löschbeleg mit Umfang …
    const purged = await belege(services, "ko.purged", a);
    expect(purged).toHaveLength(1);
    expect(purged[0]?.payload).toMatchObject({
      hard: true,
      demoSeed: true,
      ueberschneidungenGeschlossen: 1,
      konflikteGeschlossen: 1,
    });
    // … und je Befund genau EIN Abschlussbeleg, nicht zwei.
    expect(await belege(services, "overlap.participant-removed", overlap.id)).toHaveLength(1);
    expect(await belege(services, "conflict.participant-removed", conflict.id)).toHaveLength(1);
    expect(await belege(services, "conflict.auto-resolved", conflict.id)).toHaveLength(1);
    // Nur die BEIDEN Befunde dieses Beitrags dürfen zu sein — der Demo-Bestand bringt eigene mit,
    // und die gehen eine Endlöschung nichts an.
    const offeneUeberschneidungen = await services.overlaps.unresolved();
    const offeneKonflikte = await services.conflicts.unresolved();
    expect(offeneUeberschneidungen.some((e) => e.id === overlap.id)).toBe(false);
    expect(offeneKonflikte.some((c) => c.id === conflict.id)).toBe(false);
    expect(offeneKonflikte.every((c) => c.koA !== a && c.koB !== a)).toBe(true);
  });

  it("normales Löschen (weicher Ausgang): der Nachlauf der Route ist der EINE Aufräumweg", async () => {
    const { services, app, headers, rufe } = await welt();
    const anlegen = async (title: string) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: {
            title,
            statement: "Bei Überdruck zuerst Ventil V3 schließen.",
            type: "best_practice",
            category: "Anlage 1",
          },
        })
      ).json().id as string;
    const a = await anlegen("Ventil V3 zuerst");
    const b = await anlegen("Ventil V3 zuerst schliessen");
    const { overlap, conflict } = await befundePaar(services, a, b);

    const del = await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers });
    expect(del.statusCode).toBe(204);

    // Kein Purge — der Beitrag liegt im Papierkorb. Aufgeräumt hat der Nachlauf der Route, EINMAL.
    expect(await belege(services, "ko.purged", a)).toHaveLength(0);
    expect(rufe.ueberschneidungen).toEqual([1]);
    expect(rufe.konflikte).toEqual([1]);
    // JOB 3071: In DIESEM Fall legt derselbe Mensch die Beiträge an, der sie löscht — es ist also
    // eine eigene Rücknahme, und der Überschneidungs-Beleg heisst seither `overlap.withdrawn-own`
    // (services/conflicts/src/overlap-service.ts, Ableitung in `onKoRemoved`). Was dieser Fall
    // misst, ist unverändert: GENAU EIN Abschlussbeleg je Befund, nie zwei. Deshalb steht hier
    // beides — der neue Beleg einmal, der alte kein einziges Mal.
    expect(await belege(services, "overlap.withdrawn-own", overlap.id)).toHaveLength(1);
    expect(await belege(services, "overlap.participant-removed", overlap.id)).toHaveLength(0);
    // Die KONFLIKTseite bleibt bewusst beim systemischen Grund (JOB 3071 §10: `ConflictResolutionReason`
    // führt bereits ein `withdrawn` mit anderer Bedeutung). Die Asymmetrie ist gewollt, nicht vergessen.
    expect(await belege(services, "conflict.participant-removed", conflict.id)).toHaveLength(1);
  });
});
