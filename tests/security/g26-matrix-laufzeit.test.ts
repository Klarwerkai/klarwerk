// ================================================================================================
// JOB 1566 · D3 · G26 Teil 3 — DIE DREI LESEWEGE AM DRAHT, NICHT IM QUELLTEXT.
// ================================================================================================
//
// WOHER DIESE DATEI KOMMT. Nicht aus einer eigenen Idee, sondern aus der einen Pruefluecke, die
// BEN dem gruen geurteilten D2 von BASIC4 mitgegeben hat (Zitat, BEN-PRUEFUNG-JOB-1566-D2, §6):
//
//   „Ort: Route-Integrationstests fuer `services/app/src/routes/ko-routes.ts`; Fall: `experte` ruft
//    `ai-check`, `restore` und `trash-delete` auf einem fremden vertraulichen Objekt tatsaechlich
//    ueber die registrierten Handler auf; erwartet: jeder Aufruf ohne sein erforderliches Recht
//    endet VOR EINER BESTANDSAUSGABE mit der vorgesehenen Ablehnung. Der vorgelegte Waechter liest
//    Rechte STATISCH AUS DEM QUELLTEXT und belegt diese Laufzeitwirkung nicht selbst."
//
// WAS HIER ALSO ANDERS IST — und warum es kein zweiter Weg neben dem vorhandenen ist:
//
//   · `tests/security/job1174-matrix-kopplung-rollenimplizite-lesewege.test.ts` liest die
//     `requirePermission`-Aufrufe aus dem Quelltext und koppelt sie an die Rechtematrix. Es bleibt
//     unangetastet — es faengt jede Aenderung an der MATRIX.
//   · Diese Datei ruft dieselben drei Wege ueber `app.inject` durch die ECHTE Komposition auf. Sie
//     faengt, was eine Quelltextlesung nicht sehen kann: eine Route, die ihr Recht zwar nennt, aber
//     erst NACH einer Bestandsausgabe prueft — oder einen Handler, der bei Ablehnung trotzdem
//     Inhalt im Rumpf mitgibt.
//
// KEIN MATRIX-MOCK. `job1178-restore-drahttest.test.ts` stellt eine HYPOTHETISCHE Matrix
// (`experte` bekommt `users.manage`) und misst den Fall MIT Recht und OHNE volle Sicht. Diese
// Datei misst das Gegenstueck an der ECHTEN Matrix: den Aufruf OHNE das erforderliche Recht.
// Beide Haelften zusammen decken die Kopplung; keine wiederholt die andere.
//
// ZU `ai-check` UND `ko.validate`: Ein Kopplungsfall „hat das Recht, aber keine volle Sicht" ist
// fuer `ko.validate` NICHT herstellbar — `darfSehen` verwendet genau dieses Recht als volle Sicht
// (BEN, D2 §4). Deshalb prueft diese Datei fuer alle drei Wege die Richtung, die herstellbar UND
// von der Pruefluecke woertlich verlangt ist: OHNE Recht keine Bestandsausgabe.
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { can } from "../../services/rbac";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

/** Der Text, der in KEINER Ablehnungsantwort auftauchen darf. */
const GEHEIM = "GEHEIMTEXT-JOB1566-NUR-FUER-DEN-AUTOR";

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

/**
 * Die echte Komposition, die echten Auth-Routen, In-Memory-Bestand — dieselbe Bauform wie
 * `job1178-restore-drahttest.test.ts:118-153`. Die zweite Identitaet entsteht ueber `POST /api/users`
 * und ist damit freigegeben; ohne diesen Schritt koennte eine Ablehnung das ANMELDEtor treffen
 * statt des Rechtetors.
 */
async function aufbau() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job1566.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job1566.test", "geheim12345");

  for (const [email, role] of [
    ["autor@job1566.test", "experte"],
    ["betrachter@job1566.test", "viewer"],
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
    autor: await login(app, "autor@job1566.test", "geheim12345"),
    betrachter: await login(app, "betrachter@job1566.test", "geheim12345"),
  };
}

/** Legt ein VERTRAULICHES Objekt im Namen des Autors an. */
async function vertraulichesObjekt(app: App, autor: Auth): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Vertraulicher Beitrag JOB1566",
      type: "technik",
      statement: GEHEIM,
      bodyHtml: `<p>${GEHEIM}</p>`,
    },
  });
  if (created.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${created.statusCode} ${created.body}`);
  }
  const id: string = created.json().id;
  const eingestuft = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  if (eingestuft.statusCode !== 200 || eingestuft.json().confidentiality !== "vertraulich") {
    throw new Error(`Einstufung fehlgeschlagen: ${eingestuft.statusCode} ${eingestuft.body}`);
  }
  return id;
}

/** Dasselbe, danach in den Papierkorb — fuer `restore` und `trash-delete`. */
async function vertraulichesImPapierkorb(app: App, autor: Auth): Promise<string> {
  const id = await vertraulichesObjekt(app, autor);
  const geloescht = await app.inject({ method: "DELETE", url: `/api/kos/${id}`, headers: autor });
  if (geloescht.statusCode !== 204) {
    throw new Error(`Papierkorb fehlgeschlagen: ${geloescht.statusCode} ${geloescht.body}`);
  }
  return id;
}

/** Eine Ablehnung ist erst dann eine, wenn sie auch nichts ausplaudert. */
function abgelehntOhneBestand(antwort: { statusCode: number; body: string }, was: string): void {
  expect([401, 403, 404], `${was}: unerwarteter Status ${antwort.statusCode}`).toContain(
    antwort.statusCode,
  );
  expect(antwort.body, `${was}: der Rumpf traegt den Geheimtext`).not.toContain(GEHEIM);
  expect(antwort.body, `${was}: der Rumpf traegt den Titel`).not.toContain("Vertraulicher Beitrag");
}

describe("G26/3 · die drei rollenimpliziten Lesewege AM DRAHT", () => {
  beforeAll(() => {
    // KALIBRIERUNG DER VORBEDINGUNG — ohne sie misst der Test womoeglich nichts:
    // haette `viewer` die Rechte, waere jede Ablehnung unten trivial falsch; haette `admin` sie
    // nicht, waere die Gegenprobe wertlos. Gelesen aus der ECHTEN Matrix, nicht gestellt.
    expect(can("viewer", "ko.validate"), "`viewer` darf `ko.validate` NICHT haben").toBe(false);
    expect(can("viewer", "users.manage"), "`viewer` darf `users.manage` NICHT haben").toBe(false);
    expect(can("admin", "ko.validate"), "`admin` muss `ko.validate` haben").toBe(true);
    expect(can("admin", "users.manage"), "`admin` muss `users.manage` haben").toBe(true);
  });

  it("R1 · ai-check OHNE `ko.validate`: Ablehnung, und nichts vom Objekt im Rumpf", async () => {
    const { app, autor, betrachter } = await aufbau();
    const id = await vertraulichesObjekt(app, autor);

    const antwort = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/ai-check`,
      headers: betrachter,
    });

    abgelehntOhneBestand(antwort, "ai-check");
  });

  it("R2 · restore OHNE `users.manage`: Ablehnung, und das Objekt bleibt im Papierkorb", async () => {
    const { app, admin, autor, betrachter } = await aufbau();
    const id = await vertraulichesImPapierkorb(app, autor);

    const antwort = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: betrachter,
    });

    abgelehntOhneBestand(antwort, "restore");
    // Die Ablehnung muss auch WIRKEN: das Objekt darf nicht zurueckgeholt worden sein.
    const papierkorb = await app.inject({ method: "GET", url: "/api/kos/trash", headers: admin });
    expect(papierkorb.body, "restore hat trotz Ablehnung wiederhergestellt").toContain(id);
  });

  it("R3 · trash-delete OHNE `users.manage`: Ablehnung, und das Objekt ist NICHT entfernt", async () => {
    const { app, admin, autor, betrachter } = await aufbau();
    const id = await vertraulichesImPapierkorb(app, autor);

    const antwort = await app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${id}`,
      headers: betrachter,
    });

    abgelehntOhneBestand(antwort, "trash-delete");
    const papierkorb = await app.inject({ method: "GET", url: "/api/kos/trash", headers: admin });
    expect(papierkorb.body, "trash-delete hat trotz Ablehnung entfernt").toContain(id);
  });

  it("KALIBRIERUNG: mit dem Recht gehen dieselben drei Wege durch — sonst waere jede Ablehnung trivial", async () => {
    const { app, admin, autor } = await aufbau();
    const aktiv = await vertraulichesObjekt(app, autor);
    const imKorb = await vertraulichesImPapierkorb(app, autor);

    // Ohne diese Zelle waere R1–R3 auch dann gruen, wenn es die Routen gar nicht gaebe (404 fuer
    // jeden) oder der Handler generell abwiese.
    const check = await app.inject({
      method: "POST",
      url: `/api/kos/${aktiv}/ai-check`,
      headers: admin,
    });
    expect([200, 202], `ai-check als admin: ${check.statusCode}`).toContain(check.statusCode);

    const zurueck = await app.inject({
      method: "POST",
      url: `/api/kos/${imKorb}/restore`,
      headers: admin,
    });
    expect([200, 204], `restore als admin: ${zurueck.statusCode}`).toContain(zurueck.statusCode);

    const nochmalImKorb = await vertraulichesImPapierkorb(app, autor);
    const weg = await app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${nochmalImKorb}`,
      headers: admin,
    });
    expect([200, 204], `trash-delete als admin: ${weg.statusCode}`).toContain(weg.statusCode);
  });
});
