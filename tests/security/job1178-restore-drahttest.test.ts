// ================================================================================================
// JOB 1178 D1 — DER DRAHT-TEST ZU `POST /api/kos/:id/restore`.
// ================================================================================================
//
// DIE FRAGE, die JOB 1174 D1 offen gelassen hat (dortige Rueckgabe, Punkt 3 unter
// „Nicht-Geprueftes"): Der Kopplungstest sichert zu, dass die Rechtematrix nicht unbemerkt kippt.
// Er sagt nichts darueber, **was passiert, wenn sie kippt**. Genau das steht hier — am Draht
// gemessen, nicht aus dem Quelltext gefolgert.
//
// DIE LEITPLANKE aus JOB 1174 D1: `ko.validate` UND `users.manage` sind nicht gleich.
// `ko.validate` IST die Sichtbarkeitsregel (`sichtbarkeit.ts:71`) — wer es bekommt, hat im selben
// Moment volle Sicht, die Deckung kann dadurch gar nicht kippen. Das echte Risiko traegt allein
// `users.manage`. **Dieser Test misst genau diesen einen Fall.**
//
// ------------------------------------------------------------------------------------------------
// DER NUTZER, DEN ES IM PRODUKT NICHT GIBT
// ------------------------------------------------------------------------------------------------
//
// Gebraucht wird jemand mit `users.manage` OHNE `ko.validate`. Die heutige Matrix
// (`services/rbac/src/policy.ts:13-18`) kennt ihn nicht: `users.manage` traegt nur `admin`, und
// `admin` traegt `ko.validate` mit.
//
// Er wird deshalb HIER gestellt — durch einen Modul-Ersatz von `services/rbac`, der `experte` um
// `users.manage` erweitert und alles andere unveraendert laesst. **`policy.ts` wird nicht
// angefasst** (Null-Diff, per Hash belegt). Der Ersatz wirkt fuer JEDEN Importeur desselben Moduls
// — also auch fuer `darfSehen`, das sein `can` aus derselben Quelle holt. Genau das ist gewollt:
// beide Seiten sehen dieselbe hypothetische Matrix, sonst maesse der Test einen Widerspruch, den es
// so nie gaebe.
//
// **Dieser Principal ist hypothetisch.** Er beschreibt keinen heutigen Betriebszustand, sondern den
// Zustand NACH einer Matrix-Aenderung, wie sie ein Kunde mit einer neuen Rolle ausloesen wuerde.
//
// ------------------------------------------------------------------------------------------------
// DAS ERGEBNIS, gemessen am 20.08.2026 — UND WAS STATTDESSEN GELTEN SOLLTE
// ------------------------------------------------------------------------------------------------
//
// GEMESSEN: `POST /api/kos/:id/restore` antwortet diesem Nutzer mit **HTTP 200** und dem
// VOLLSTAENDIGEN Wissensobjekt — `statement`, `bodyHtml`, `title`, Historie, alles. Das Objekt ist
// als `vertraulich` eingestuft und gehoert einem ANDEREN.
//
// WAS GELTEN SOLLTE: derselbe Aufruf sollte **404** liefern — dieselbe Antwort, die
// `DELETE /api/kos/:id` (`ko-routes.ts:1187-1199`) ueber `sichtbaresKoOder404` schon heute gibt.
// „Nicht sichtbar" muss aussehen wie „gibt es nicht", sonst ist schon die Existenz eine Auskunft
// (die Begruendung steht woertlich in `ko-routes.ts:436-439`).
//
// WARUM DIESER TEST TROTZDEM GRUEN IST UND KEIN DAUERHAFTES ROT: Er ist eine **Messung**, kein
// Bau. Ein dauerhaft roter Test im Baum waere Laerm, den nach zwei Tagen niemand mehr liest. Er
// haelt deshalb den HEUTIGEN Zustand fest und schlaegt in BEIDE Richtungen an: wird der Zweig
// abgesichert, wird er rot und verlangt, dass jemand die Zusicherung unten umdreht — und die
// Offenlegung verschwindet nicht still, sondern mit einem benannten Fall.
//
// **Der Verschluss ist NICHT Gegenstand dieses Durchgangs.** Kein Guard, keine Matrix, kein Zweig
// wurde angefasst; die Frage, ob und wie `restore` abgesichert wird, ist eine eigene Runde und
// womoeglich eine Ownerfrage.
import { describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// DER MODUL-ERSATZ. Er steht vor den Importen, weil `vi.mock` gehoisted wird.
// ------------------------------------------------------------------------------------------------
vi.mock("../../services/rbac", async (echt) => {
  const original = await echt<typeof import("../../services/rbac")>();
  // Nur EINE Aenderung gegenueber dem Produkt: `experte` bekommt `users.manage` dazu.
  // `ko.validate` bekommt er ausdruecklich NICHT — das ist der ganze Punkt.
  const HYPOTHETISCHE_MATRIX = {
    ...original.ROLE_PERMISSIONS,
    experte: [...original.ROLE_PERMISSIONS.experte, "users.manage" as const],
  };
  const can = (rolle: keyof typeof HYPOTHETISCHE_MATRIX, recht: string): boolean =>
    (HYPOTHETISCHE_MATRIX[rolle] as readonly string[]).includes(recht);
  return {
    ...original,
    ROLE_PERMISSIONS: HYPOTHETISCHE_MATRIX,
    can,
    canManageUsers: (rolle: keyof typeof HYPOTHETISCHE_MATRIX) => can(rolle, "users.manage"),
    canChangeRole: (
      actor: { id: string; role: keyof typeof HYPOTHETISCHE_MATRIX },
      targetUserId: string,
      newRole: string,
    ) => {
      if (!can(actor.role, "users.manage")) {
        return false;
      }
      if (actor.id === targetUserId && newRole !== "admin") {
        return false;
      }
      return true;
    },
  };
});

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { can } from "../../services/rbac";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

/** Der Text, der nicht herauskommen darf. Er steht in `statement` UND `bodyHtml`. */
const GEHEIM = "GEHEIMTEXT-JOB1178-NUR-FUER-DEN-AUTOR";

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
 * Die echte Komposition, die echten Auth-Routen, In-Memory-Bestand. Dieselbe Bauform wie
 * `mega80-kennung-ist-kein-leserecht.test.ts:83-113` und BASIC3s Drahtnachweis in JOB 1172 D1:
 * die zweite Identitaet entsteht ueber `POST /api/users` und ist damit freigegeben — ohne diesen
 * Schritt koennte eine Ablehnung das ANMELDEtor treffen statt des Rechtetors.
 */
async function aufbau() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job1178.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job1178.test", "geheim12345");

  const kennungen: Record<string, string> = {};
  for (const [email, role] of [
    ["autor@job1178.test", "experte"],
    ["heimlich@job1178.test", "experte"],
    ["betrachter@job1178.test", "viewer"],
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
    kennungen[email] = res.json().id;
  }

  return {
    app,
    admin,
    kennungen,
    autor: await login(app, "autor@job1178.test", "geheim12345"),
    heimlich: await login(app, "heimlich@job1178.test", "geheim12345"),
    betrachter: await login(app, "betrachter@job1178.test", "geheim12345"),
  };
}

/** Legt ein VERTRAULICHES Objekt im Namen des Autors an und wirft es in den Papierkorb. */
async function vertraulichesImPapierkorb(
  app: App,
  autor: Auth,
): Promise<{ id: string; autorId: string }> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Vertraulicher Beitrag JOB1178",
      type: "technik",
      statement: GEHEIM,
      bodyHtml: `<p>${GEHEIM}</p>`,
    },
  });
  if (created.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${created.statusCode} ${created.body}`);
  }
  const id: string = created.json().id;
  const autorId: string = created.json().author;

  const eingestuft = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  if (eingestuft.statusCode !== 200 || eingestuft.json().confidentiality !== "vertraulich") {
    throw new Error(`Einstufung fehlgeschlagen: ${eingestuft.statusCode} ${eingestuft.body}`);
  }

  const geloescht = await app.inject({ method: "DELETE", url: `/api/kos/${id}`, headers: autor });
  if (geloescht.statusCode !== 204) {
    throw new Error(`Papierkorb fehlgeschlagen: ${geloescht.statusCode} ${geloescht.body}`);
  }
  return { id, autorId };
}

describe("JOB 1178 · restore am Draht — was passiert, wenn die Matrix kippt", () => {
  it("VORBEDINGUNG: der hypothetische Principal steht — users.manage JA, ko.validate NEIN", () => {
    // Ohne diese zwei Zeilen misst der Test womoeglich etwas ganz anderes: einen Nutzer, der
    // gar kein `users.manage` hat (dann waere die 403 unten trivial) oder einen mit
    // `ko.validate` (dann haette er volle Sicht und die 200 waere korrekt).
    expect(can("experte", "users.manage"), "der Modul-Ersatz greift nicht").toBe(true);
    expect(can("experte", "ko.validate"), "experte darf `ko.validate` NICHT bekommen").toBe(false);
    // Und die Gegenprobe, dass der Ersatz nicht einfach alles erlaubt:
    expect(can("viewer", "users.manage"), "`viewer` bleibt unveraendert").toBe(false);
  });

  it("DAS TESTOBJEKT IST FREMD — sonst misst der Test die Autor-Ausnahme statt der Regel", async () => {
    const { app, autor, kennungen } = await aufbau();
    const { autorId } = await vertraulichesImPapierkorb(app, autor);

    // `darfSehen:76` laesst den AUTOR sein eigenes vertrauliches Objekt sehen. Waere unser
    // Aufrufer der Autor, waere jede 200 unten korrekt und der Test wertlos.
    expect(autorId).toBe(kennungen["autor@job1178.test"]);
    expect(
      autorId,
      "der Aufrufer des restore darf NICHT der Autor sein — sonst greift die Autor-Ausnahme",
    ).not.toBe(kennungen["heimlich@job1178.test"]);
  });

  // ==============================================================================================
  // DER BEFUND. Dieser Fall haelt den HEUTIGEN Zustand fest — er ist keine Zustimmung.
  // ==============================================================================================
  it("GEMESSEN HEUTE: restore gibt einem users.manage-Inhaber OHNE volle Sicht das fremde vertrauliche Objekt heraus", async () => {
    const { app, autor, heimlich } = await aufbau();
    const { id } = await vertraulichesImPapierkorb(app, autor);

    const antwort = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: heimlich,
    });

    // ------------------------------------------------------------------------------------------
    // WAS HIER STEHT, IST DER IST-ZUSTAND — NICHT DAS SOLL.
    //
    // SOLL waere `expect(antwort.statusCode).toBe(404)` und `.not.toContain(GEHEIM)`: derselbe
    // Schutz, den `DELETE /api/kos/:id` ueber `sichtbaresKoOder404` schon traegt
    // (`ko-routes.ts:1196`). Der `restore`-Zweig (`ko-routes.ts:1155-1165`) prueft nur das Recht
    // und reicht danach `await ko.restore(...)` unveraendert heraus.
    //
    // Wird der Zweig abgesichert, wird DIESER Fall rot — und das ist die erwuenschte Wirkung:
    // dann gehoeren die beiden Zusicherungen umgedreht und dieser Kommentar geloescht.
    // ------------------------------------------------------------------------------------------
    expect(antwort.statusCode, "IST-Zustand 20.08.2026 — SOLL waere 404").toBe(200);
    expect(
      antwort.body.includes(GEHEIM),
      "IST-Zustand: der Geheimtext steht im Antwortkoerper. SOLL waere: er steht nicht darin.",
    ).toBe(true);

    // Genauer als „irgendwo im Rumpf": beide Inhaltsfelder tragen ihn.
    const objekt = antwort.json();
    expect(objekt.statement).toBe(GEHEIM);
    expect(objekt.bodyHtml).toContain(GEHEIM);
    expect(objekt.confidentiality).toBe("vertraulich");
  });

  it("GEGENPROBE: mit der HEUTIGEN Matrix haengt der Befund genau an users.manage", async () => {
    const { app, autor, admin, betrachter } = await aufbau();
    const { id } = await vertraulichesImPapierkorb(app, autor);

    // (a) Der echte `admin` traegt `users.manage` UND `ko.validate` — er hat volle Sicht, seine
    //     200 ist korrekt und keine Offenlegung.
    const alsAdmin = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: admin,
    });
    expect(alsAdmin.statusCode).toBe(200);
    expect(
      can("admin", "ko.validate"),
      "admin hat volle Sicht — deshalb ist seine 200 korrekt",
    ).toBe(true);

    // (b) Der `viewer` traegt `users.manage` nicht — er scheitert am Rechtetor, nicht an der
    //     Sichtbarkeit. Damit ist belegt, dass der Befund oben WIRKLICH an `users.manage` haengt
    //     und nicht daran, dass die Route jedem alles gibt.
    const nochmalWeg = await app.inject({
      method: "DELETE",
      url: `/api/kos/${id}`,
      headers: autor,
    });
    expect(nochmalWeg.statusCode).toBe(204);
    const alsViewer = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: betrachter,
    });
    expect(alsViewer.statusCode, "ohne `users.manage` greift das Rechtetor").toBe(403);
    expect(alsViewer.body.includes(GEHEIM), "und es geht kein Inhalt heraus").toBe(false);
  });
});
