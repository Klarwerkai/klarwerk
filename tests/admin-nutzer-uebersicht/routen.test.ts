// ================================================================================================
// ADMIN-04 · DIE WEGE DER KONTENVERWALTUNG AM DRAHT (buildApp, Speicherbetrieb, fiktive Konten).
// ================================================================================================
//
// produkt:20261009:admin-nutzer-uebersicht. Isolierter Testbestand: jede Prüfung baut ihre eigene
// Anwendung im Speicher; kein Konto, keine Rolle und kein Inhalt ist echt.
//
//   K3  `GET /api/verantwortung/uebersicht` zählt je Konto Beiträge (Hauptverantwortung) und ANDERE
//       offene Vorgänge (Entwürfe, Lücken, Prüfaufgaben) getrennt — ein Beitrag, den die Person
//       verfasst UND verantwortet, zählt einmal; einer, den sie verfasst, aber jemand anders
//       verantwortet, zählt bei dem anderen. Die Zahl ist dieselbe Menge wie der Bestand, den der
//       Zähler öffnet (`GET /api/verantwortung/person/:id`, `…/vorgaenge`).
//   K4  Rolle und Befristung: die Antwort trägt den gespeicherten Stand, `GET /api/users` liefert
//       danach denselben, und das Prüfprotokoll hält genau diesen Wert fest. Eine Befristung an
//       einem Konto mit Beiträgen lehnt der Server ab und ändert nichts — das sagt die Karte vorher.
//   K6  Ein nicht berechtigter Testnutzer (Betrachter, Expertin, Controller) erreicht weder die
//       Nutzerliste noch eine Kontoänderung — auch nicht über direkte Aufrufe; danach ist der
//       Bestand unverändert und das Protokoll trägt keinen Vermerk von ihm.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

// Fiktives Testkennwort des isolierten Speicherbestands — kein Zugang zu irgendeinem echten System.
const KENNWORT = "testkonto-123";

async function login(app: App, email: string): Promise<{ headers: Kopf; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, res.body).toBe(200);
  const headers = { authorization: `Bearer ${res.json().token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: me.json().id as string };
}

async function aufbau() {
  const app = buildApp(buildServices());
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@verwaltung.test", password: KENNWORT },
  });
  expect(erst.statusCode, erst.body).toBe(201);
  const admin = await login(app, "ada@verwaltung.test");
  const anlegen = async (name: string, email: string, role: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, res.body).toBe(201);
    return login(app, email);
  };
  const carl = await anlegen("Carl Controller", "carl@verwaltung.test", "controller");
  const erik = await anlegen("Erik Experte", "erik@verwaltung.test", "experte");
  const vera = await anlegen("Vera Betrachterin", "vera@verwaltung.test", "viewer");
  return { app, admin, carl, erik, vera };
}

async function beitrag(app: App, headers: Kopf, title: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title,
      statement: `${title} — Aussage.`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

interface Person {
  id: string;
  zugang: string;
  beitraege: number;
  vorgaenge: { entwuerfe: number; luecken: number; pruefaufgaben: number } | null;
}

async function uebersicht(app: App, headers: Kopf): Promise<Map<string, Person>> {
  const res = await app.inject({ method: "GET", url: "/api/verantwortung/uebersicht", headers });
  expect(res.statusCode, res.body).toBe(200);
  return new Map((res.json().personen as Person[]).map((p) => [p.id, p]));
}

async function konten(app: App, headers: Kopf) {
  const res = await app.inject({ method: "GET", url: "/api/users", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    id: string;
    role: string;
    approved: boolean;
    accessExpiresAt?: string;
  }[];
}

async function protokoll(app: App, headers: Kopf) {
  const res = await app.inject({ method: "GET", url: "/api/audit", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    actor: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
  }[];
}

describe("ADMIN-04 · K2 Zugangsstand aus vorhandenen Feldern", () => {
  it("aktiv, befristet, abgelaufen und gesperrt kommen aus Freigabe und Ablauf — sonst nichts", async () => {
    const { app, admin, carl, erik, vera } = await aufbau();
    // Gesperrt: eine Selbstregistrierung wartet auf Freigabe (`approved: false`).
    const neu = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Nina Neu", email: "nina@verwaltung.test", password: KENNWORT },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const setze = async (id: string, accessExpiresAt: string) => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/users/${id}`,
        headers: admin.headers,
        payload: { accessExpiresAt },
      });
      expect(res.statusCode, res.body).toBe(200);
    };
    await setze(vera.id, "2099-12-31T22:59:59.999Z");
    await setze(erik.id, "2020-01-31T22:59:59.999Z");
    const zahlen = await uebersicht(app, admin.headers);
    expect(zahlen.get(carl.id)?.zugang).toBe("aktiv");
    expect(zahlen.get(vera.id)?.zugang).toBe("befristet");
    expect(zahlen.get(erik.id)?.zugang).toBe("abgelaufen");
    expect(zahlen.get(neu.json().id as string)?.zugang).toBe("gesperrt");
    // Das Konto trägt weder letzte Anmeldung noch Einladung — die Liste bekommt nichts davon.
    const feld = Object.keys((await konten(app, admin.headers))[0] ?? {});
    expect(feld.filter((f) => /login|seen|besuch|invit|einlad/i.test(f))).toEqual([]);
  });
});

describe("ADMIN-04 · K3 Verantwortungszahlen am Draht", () => {
  it("Beiträge und andere offene Vorgänge getrennt, ohne Doppelzählung — und gleich dem geöffneten Bestand", async () => {
    const { app, admin, carl, erik } = await aufbau();
    // (1) von Carl verfasst, niemand benannt → Carl verantwortet.
    const eigen = await beitrag(app, carl.headers, "Lehrring vor Schichtbeginn prüfen");
    // (2) von Carl verfasst UND Carl benannt → derselbe Beitrag, zählt EINMAL.
    const doppelt = await beitrag(app, carl.headers, "Messschieber nullen");
    const benenne = async (koId: string, owner: string) => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: admin.headers,
        payload: { action: "ownership", ownership: { owner } },
      });
      expect(res.statusCode, res.body).toBe(200);
    };
    await benenne(doppelt, carl.id);
    // (3) von Carl verfasst, Erik benannt → zählt bei Erik, nicht bei Carl.
    const fremd = await beitrag(app, carl.headers, "Prüfstift ablegen");
    await benenne(fremd, erik.id);
    // (4) Prüfaufgabe für Carl an einem Beitrag der Verwaltung — ein ANDERER Vorgang.
    const zuPruefen = await beitrag(app, admin.headers, "Kalibrierschein ablegen");
    const zuweisen = await app.inject({
      method: "PUT",
      url: `/api/kos/${zuPruefen}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [carl.id] },
    });
    expect(zuweisen.statusCode, zuweisen.body).toBe(204);
    // (5) ein Entwurf von Carl.
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: carl.headers,
      payload: {
        title: "Neue Prüfanweisung Linie 3",
        statement: "Vor dem Anfahren die Lehre prüfen.",
        type: "best_practice",
        category: "Prüfmittel",
        confidentiality: "intern",
      },
    });
    expect(entwurf.statusCode, entwurf.body).toBe(201);

    const zahlen = await uebersicht(app, admin.headers);
    expect(zahlen.get(carl.id)).toEqual({
      id: carl.id,
      zugang: "aktiv",
      beitraege: 2,
      vorgaenge: { entwuerfe: 1, luecken: 0, pruefaufgaben: 1 },
    });
    expect(zahlen.get(erik.id)?.beitraege).toBe(1);
    expect(zahlen.get(erik.id)?.vorgaenge).toEqual({ entwuerfe: 0, luecken: 0, pruefaufgaben: 0 });

    // Der Zähler „Beiträge" öffnet den Bestand der Übergabe — dieselbe Menge, Beitrag für Beitrag.
    const bestand = await app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${carl.id}`,
      headers: admin.headers,
    });
    expect(bestand.statusCode, bestand.body).toBe(200);
    expect(bestand.json().anzahl).toBe(zahlen.get(carl.id)?.beitraege);
    expect((bestand.json().beitraege as { koId: string }[]).map((b) => b.koId).sort()).toEqual(
      [eigen, doppelt].sort(),
    );

    // Der Zähler „offene Vorgänge" öffnet genau diese Vorgänge — und keinen Beitrag dazu.
    const vorgaenge = await app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${carl.id}/vorgaenge`,
      headers: admin.headers,
    });
    expect(vorgaenge.statusCode, vorgaenge.body).toBe(200);
    expect(vorgaenge.json().entwuerfe).toEqual([{ id: entwurf.json().id }]);
    expect(vorgaenge.json().luecken).toEqual([]);
    expect(vorgaenge.json().pruefaufgaben).toEqual([
      { koId: zuPruefen, titel: "Kalibrierschein ablegen" },
    ]);
  });
});

describe("ADMIN-04 · K4 Rolle und Befristung: Antwort, Bestand und Protokoll stimmen überein", () => {
  it("Rollenwechsel: die Antwort, die Liste danach und der Vermerk tragen dieselbe Rolle", async () => {
    const { app, admin, erik } = await aufbau();
    const res = await app.inject({
      method: "PUT",
      url: `/api/users/${erik.id}`,
      headers: admin.headers,
      payload: { role: "controller" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().role).toBe("controller");
    // „Nach dem Neuladen": ein frischer Abruf liefert denselben Stand.
    expect((await konten(app, admin.headers)).find((k) => k.id === erik.id)?.role).toBe(
      "controller",
    );
    const vermerk = (await protokoll(app, admin.headers)).filter(
      (e) => e.action === "user.role-change" && e.target === erik.id,
    );
    expect(vermerk).toHaveLength(1);
    expect(vermerk[0]?.actor).toBe(admin.id);
    expect(vermerk[0]?.payload).toMatchObject({ previousRole: "experte", role: "controller" });
  });

  it("Befristung: ohne Beiträge gespeichert und protokolliert; mit Beiträgen abgelehnt und unverändert", async () => {
    const { app, admin, erik, vera } = await aufbau();
    // Weit in der Zukunft, damit „befristet" nicht mit dem Kalender verfällt.
    const bis = "2099-10-31T22:59:59.999Z";
    const ok = await app.inject({
      method: "PUT",
      url: `/api/users/${vera.id}`,
      headers: admin.headers,
      payload: { accessExpiresAt: bis },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().accessExpiresAt).toBe(bis);
    expect((await konten(app, admin.headers)).find((k) => k.id === vera.id)?.accessExpiresAt).toBe(
      bis,
    );
    expect((await uebersicht(app, admin.headers)).get(vera.id)?.zugang).toBe("befristet");
    const vermerk = (await protokoll(app, admin.headers)).filter(
      (e) => e.action === "user.access-expiry-set" && e.target === vera.id,
    );
    expect(vermerk.map((e) => e.payload)).toEqual([{ expiresAt: bis }]);

    // Erik verantwortet einen Beitrag → die Befristung wird abgelehnt, nichts ändert sich.
    await beitrag(app, erik.headers, "Spannzange reinigen");
    const abgelehnt = await app.inject({
      method: "PUT",
      url: `/api/users/${erik.id}`,
      headers: admin.headers,
      payload: { accessExpiresAt: bis },
    });
    expect(abgelehnt.statusCode, abgelehnt.body).toBe(409);
    expect(abgelehnt.json().error).toBe("BESTAND_OFFEN");
    expect(
      (await konten(app, admin.headers)).find((k) => k.id === erik.id)?.accessExpiresAt,
    ).toBeUndefined();
    expect(
      (await protokoll(app, admin.headers)).some(
        (e) => e.action === "user.access-expiry-set" && e.target === erik.id,
      ),
    ).toBe(false);
  });
});

describe("ADMIN-04 · K6 Rechteprobe: nicht berechtigte Testnutzer an den direkten Serverwegen", () => {
  it("Betrachter, Expertin und Controller bekommen 403 — und der Bestand bleibt unverändert", async () => {
    const { app, admin, carl, erik, vera } = await aufbau();
    const vorher = await konten(app, admin.headers);
    const vermerkeVorher = (await protokoll(app, admin.headers)).length;

    for (const [name, wer] of [
      ["Betrachter", vera],
      ["Experte", erik],
      ["Controller", carl],
    ] as const) {
      const ziel = wer === erik ? vera.id : erik.id;
      const rufe: { method: "GET" | "POST" | "PUT" | "DELETE"; url: string; payload?: object }[] = [
        { method: "GET", url: "/api/users" },
        {
          method: "POST",
          url: "/api/users",
          payload: {
            name: "Fremd Angelegt",
            email: `fremd-${wer.id}@verwaltung.test`,
            password: KENNWORT,
            role: "admin",
          },
        },
        { method: "PUT", url: `/api/users/${ziel}`, payload: { role: "admin" } },
        { method: "PUT", url: `/api/users/${wer.id}`, payload: { role: "admin" } },
        {
          method: "PUT",
          url: `/api/users/${ziel}`,
          payload: { accessExpiresAt: "2026-10-01T00:00:00.000Z" },
        },
        { method: "POST", url: `/api/auth/users/${ziel}/approve` },
        { method: "DELETE", url: `/api/users/${ziel}` },
        { method: "GET", url: "/api/verantwortung/uebersicht" },
        { method: "GET", url: `/api/verantwortung/person/${ziel}` },
        { method: "GET", url: `/api/verantwortung/person/${ziel}/vorgaenge` },
        { method: "POST", url: "/api/verantwortung/deaktivierung", payload: { person: ziel } },
      ];
      for (const ruf of rufe) {
        const res = await app.inject({ ...ruf, headers: wer.headers });
        expect(res.statusCode, `${name}: ${ruf.method} ${ruf.url} → ${res.body}`).toBe(403);
      }
    }

    // Ohne Anmeldung: 401, nicht die Liste.
    for (const url of ["/api/users", "/api/verantwortung/uebersicht"]) {
      expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(401);
    }

    // Nichts hat sich geändert, und seit dem ersten abgewiesenen Ruf ist kein Vermerk hinzugekommen
    // (ihre Anmeldungen davor stehen zu Recht im Protokoll).
    expect(await konten(app, admin.headers)).toEqual(vorher);
    const neu = (await protokoll(app, admin.headers)).slice(vermerkeVorher);
    expect(neu.filter((e) => [carl.id, erik.id, vera.id].includes(e.actor))).toEqual([]);
    expect(neu.filter((e) => e.action.startsWith("user."))).toEqual([]);
  });

  it("das allgemeine Personenverzeichnis nennt nur Kennung und Name — keine Kontodaten", async () => {
    const { app, vera } = await aufbau();
    const res = await app.inject({ method: "GET", url: "/api/directory", headers: vera.headers });
    expect(res.statusCode).toBe(200);
    for (const eintrag of res.json() as Record<string, unknown>[]) {
      expect(Object.keys(eintrag).sort()).toEqual(["id", "name"]);
    }
  });
});
