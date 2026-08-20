// ================================================================================================
// JOB 1170 D1 — DIE HERKUNFTSKETTE IST SCHARF, UND AB JETZT STEHT ES AM DRAHT.
// ================================================================================================
//
// WARUM ES DIESEN TEST GIBT. Der Kopfkommentar von `provenance-routes.ts` behauptete bis heute
// zwei Dinge, die beide nicht mehr stimmten: „diese Projektion schliesst keine bestehende Luecke"
// (`:19`) und „`GET /api/kos/:id` und `GET /api/conflicts` liefern heute JEDEM Inhaber von
// `ko.read` auch vertrauliche Objekte" (`:18-19`). mega74 Block F hat die Route scharf gemacht und
// den Widerspruch NEBEN die alte Behauptung geschrieben statt an ihre Stelle — 56 Zeilen weiter
// unten (`:73-76`). Zwei Wahrheiten in einer Datei.
//
// Ein Kommentar altert still. Ein Test nicht. Deshalb steht die Schaerfe ab hier hier und nicht
// nur in Prosa: wer `darfSehen` bei `:77` entfernt, macht GENAU DIESE Datei rot.
//
// ================================================================================================
// WAS DIESER TEST NICHT DOPPELT — nachgeschlagen, nicht vermutet.
// ================================================================================================
//
//   · `mega74-lesepfad-vertraulich.test.ts` misst `GET /api/kos/:id`, `:id/versions`,
//     `:id/evidence`, `GET /api/kos` und `/api/library/search` (`:123`, `:138`, `:152`, `:165`).
//     Die Herkunftsroute kommt dort NICHT vor.
//   · `mega74-nebenwege-vertraulich.test.ts` misst `/api/conflicts`, `/api/notifications` und
//     `/api/duplicates` (`:123`, `:178`, `:187`). Die Herkunftsroute kommt dort NICHT vor.
//   · `mega45-herkunft-rechte.test.ts` misst die GEGENSEITE eines Konflikts — und zwar auf
//     MODULEBENE ueber `projectProvenance` (`:27`, `:167`), nicht ueber die Route. Das ZENTRUM
//     ist dort nicht Gegenstand.
//   · `mega45-herkunft-schalter.test.ts` misst den Betriebsschalter und die Graphform mit EINEM
//     angemeldeten Nutzer (`:88-117`) — es gibt dort keine zweite Rolle und kein vertrauliches
//     Objekt.
//   · `mega74-lesewege-sammler.test.ts` fuehrt die Route als `PRAEDIKAT` (`:173`), prueft aber
//     ausdruecklich „die REGISTRIERUNG, nicht die Antwort" (`:68`) und zaehlt in `:69-71` die
//     Draht-Belege auf — die Herkunftsroute fehlt in dieser Aufzaehlung.
//
// Der Fall „Zentrum unsichtbar ⇒ 404 statt Projektion" war damit an keiner Stelle am Draht
// gepinnt. Das ist die Luecke, und nur sie steht hier.
//
// WARUM 404 UND NICHT 403 — dieselbe Begruendung wie am Hauptlesepfad (ko-routes.ts:436-439): bei
// einem vertraulichen Objekt ist schon seine Existenz eine Auskunft.
//
// KEIN ROTER ERSTLAUF, und das ist kein Versaeumnis: hier wird kein fehlendes Verhalten gebaut,
// sondern vorhandenes gepinnt. Der Beleg ist die Gegenmutation — `darfSehen` bei `:77` entfernen
// macht genau diese Datei rot, waehrend die Nachbardateien gruen bleiben.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const GEHEIM = "Der vertrauliche Kern des Zentrumsobjekts.";

// Der Schalter entscheidet ueber die REGISTRIERUNG (provenance-routes.ts:36-42), wird also VOR
// `buildApp` gesetzt und danach wieder entfernt — sonst faerbt dieser Test die Nachbarlaeufe ein.
beforeEach(() => {
  process.env.KLARWERK_PROVENANCE_ENABLED = "1";
});
afterEach(() => {
  delete process.env.KLARWERK_PROVENANCE_ENABLED;
});

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

// Eigener Namensraum fuer die Konten: die Nachbardateien legen ihre eigenen an, und zwei Laeufe
// duerfen sich nicht ueber eine gemeinsame Kennung ins Gehege kommen.
async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job1170.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job1170.test", "geheim12345");
  for (const [email, role] of [
    ["viewer@job1170.test", "viewer"],
    ["autor@job1170.test", "experte"],
    ["controller@job1170.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    viewer: await login(app, "viewer@job1170.test", "geheim12345"),
    autor: await login(app, "autor@job1170.test", "geheim12345"),
    controller: await login(app, "controller@job1170.test", "geheim12345"),
  };
}

async function zentrum(app: App, autor: Auth, vertraulich: boolean): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: vertraulich ? "Vertrauliches Zentrum" : "Internes Zentrum",
      statement: vertraulich ? GEHEIM : "Ganz gewoehnlicher interner Inhalt.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  if (vertraulich) {
    const up = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(up.statusCode, up.body).toBe(200);
    expect(up.json().confidentiality).toBe("vertraulich");
  }
  return id;
}

describe("JOB 1170 · die Herkunftskette schuetzt ihr ZENTRUM, nicht nur die Gegenseite", () => {
  it("GET /api/kos/:id/provenance — Betrachter bekommt 404, nicht den Graphen und nicht 403", async () => {
    const { app, autor, viewer } = await setup();
    const id = await zentrum(app, autor, true);

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/provenance`,
      headers: viewer,
    });

    expect(
      res.statusCode,
      `Ein Betrachter darf die Herkunftskette eines vertraulichen Objekts nicht sehen. Antwort war: ${res.statusCode} ${res.body}`,
    ).toBe(404);
    // Ein 403 waere schon zu viel: es bestaetigt die Existenz.
    expect(res.statusCode).not.toBe(403);
    // Und der Graph traegt den Titel des Zentrums (provenance-routes.ts:131) — er darf nicht
    // einmal in der Fehlerantwort auftauchen.
    expect(res.body).not.toContain("Vertrauliches Zentrum");
    expect(res.body).not.toContain(GEHEIM);
  });

  it("GEGENPROBE — Autor, Controller und Admin bekommen denselben Graphen weiterhin", async () => {
    const { app, admin, autor, controller } = await setup();
    const id = await zentrum(app, autor, true);

    for (const [wer, headers] of [
      ["Autor", autor],
      ["Controller", controller],
      ["Admin", admin],
    ] as const) {
      const res = await app.inject({
        method: "GET",
        url: `/api/kos/${id}/provenance`,
        headers,
      });
      expect(res.statusCode, `${wer} muss die Herkunftskette sehen: ${res.body}`).toBe(200);
      expect(res.json().root, `${wer}: der Graph muss auf das Zentrum zeigen`).toBe(`ko:${id}`);
    }
  });

  it("KALIBRIERUNG — bei einem INTERNEN Zentrum bekommt derselbe Betrachter 200", async () => {
    // Ohne diesen Fall haette der erste Fall nur bewiesen, dass die Route ueberhaupt nichts mehr
    // herausgibt — etwa weil der Schalter aus ist oder die Kennung nicht aufloest.
    const { app, autor, viewer } = await setup();
    const id = await zentrum(app, autor, false);

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/provenance`,
      headers: viewer,
    });

    expect(res.statusCode, `Ein internes Zentrum MUSS sichtbar bleiben: ${res.body}`).toBe(200);
    expect(res.json().root).toBe(`ko:${id}`);
  });
});
