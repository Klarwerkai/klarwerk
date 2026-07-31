// ================================================================================================
// AUFTRAG-mega76 BLOCK D — DAS DRITTE LECK: AGGREGATE ÜBER EINEM UNGEFILTERTEN BESTAND.
// ================================================================================================
//
// BENS BEFUND (sammel72, 6 von 6 geprüft): „Alle sechs Wege berechnen ihre Antworten aus
// ungefilterten Grundmengen. Keiner der sechs Wege ruft `darfSehen`, `sichtbareFuer` oder
// `sichtbarkeitsfilterFuer` auf." Urteil je Route: ungefiltert UND mit Auskunftswert, ab n = 1.
//
// WARUM DAS EIN LECK IST UND NICHT NUR UNSAUBER. Der Vertrag seit mega74 begründet den 404 damit,
// dass schon die EXISTENZ eines vertraulichen Objekts eine Auskunft ist. Ein exakter Zähler nach
// Status, Kategorie, Woche oder Person verrät dieselbe Existenz indirekt — und bei einer nur
// vertraulich belegten Kategorie nennt die Antwort sogar deren NAMEN. Die Wirkung beginnt bei der
// kleinsten nichtleeren Gruppe, also n = 1.
//
// DIESER TEST BAUT GENAU DIESEN FALL: ein vertrauliches Objekt in einer Kategorie, die es sonst
// nicht gibt. Wer es nicht öffnen darf, darf es auch nicht zählen sehen. Die GEGENPROBE steht
// jeweils daneben — sonst bewiese der Test nur, dass die Aggregate leer sind.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

// Die Kategorie, die es NUR am vertraulichen Objekt gibt. Ihr blosses Auftauchen in einem
// Kategorie-Bucket ist die Auskunft, gegen die dieser Block gebaut ist.
const GEHEIME_KATEGORIE = "Geheimprojekt-Zeta";
const OFFENE_KATEGORIE = "Anlage-Sichtbar";

const AGGREGATE = [
  "/api/analytics",
  "/api/analytics/busfactor",
  "/api/analytics/impact",
  "/api/management/snapshot",
  "/api/ai-check/coverage-summary",
  "/api/validation/overview",
] as const;

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

async function ko(app: App, autor: Auth, titel: string, kategorie: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: titel,
      statement: "Eine Aussage, die in einem Zähler landet.",
      type: "best_practice",
      category: kategorie,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@mega76d.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@mega76d.test", "geheim12345");
  for (const [email, role] of [
    ["viewer@mega76d.test", "viewer"],
    ["autor@mega76d.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  const autor = await login(app, "autor@mega76d.test", "geheim12345");
  const viewer = await login(app, "viewer@mega76d.test", "geheim12345");

  // Ein offenes und ein vertrauliches Objekt — jedes in seiner EIGENEN Kategorie.
  const offen = await ko(app, autor, "Offenes Wissen", OFFENE_KATEGORIE);
  const geheim = await ko(app, autor, "Vertrauliches Wissen", GEHEIME_KATEGORIE);
  const stufe = await app.inject({
    method: "PUT",
    url: `/api/kos/${geheim}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(stufe.statusCode, stufe.body).toBe(200);

  // Beide validieren — damit der Wirkungs-Bericht (`validatedTotal`, `validatedByWeek`) überhaupt
  // etwas zu zählen hat.
  for (const id of [offen, geheim]) {
    const val = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "admin-validate" },
    });
    expect(val.statusCode, val.body).toBe(200);
  }

  // Eine Zuweisung auf das VERTRAULICHE Objekt. Sie nennt in `/api/validation/overview` die
  // Kennung der befassten Person — Existenz UND Person in einer Zeile.
  const users = await app.inject({ method: "GET", url: "/api/users", headers: admin });
  expect(users.statusCode, users.body).toBe(200);
  const pruefer = (users.json() as { id: string; email: string }[]).find(
    (u) => u.email === "autor@mega76d.test",
  );
  expect(pruefer, "Vorbedingung: der Prüfer muss in der Nutzerliste stehen").toBeTruthy();
  const assign = await app.inject({
    method: "PUT",
    url: `/api/kos/${geheim}`,
    headers: admin,
    payload: { action: "assign", userIds: [pruefer?.id] },
  });
  expect([200, 204], assign.body).toContain(assign.statusCode);

  return { app, admin, autor, viewer, geheim, offen, prueferId: pruefer?.id as string };
}

async function hole(app: App, wer: Auth, url: string) {
  const res = await app.inject({ method: "GET", url, headers: wer });
  expect(res.statusCode, `${url} → ${res.statusCode} ${res.body}`).toBe(200);
  return res;
}

describe("mega76 D · kein Aggregat nennt die geheime Kategorie", () => {
  it("KEINE der sechs Antworten trägt für den Betrachter den Kategorienamen", async () => {
    const { app, viewer } = await setup();
    for (const url of AGGREGATE) {
      const res = await hole(app, viewer, url);
      expect(
        res.body,
        `${url} verrät die Kategorie, die es NUR am vertraulichen Objekt gibt.
        Antwort: ${res.body}`,
      ).not.toContain(GEHEIME_KATEGORIE);
    }
  });

  it("GEGENPROBE — für den Admin steht sie in genau den Antworten, die Kategorien nennen", async () => {
    const { app, admin } = await setup();
    const treffer: string[] = [];
    for (const url of AGGREGATE) {
      const res = await hole(app, admin, url);
      if (res.body.includes(GEHEIME_KATEGORIE)) {
        treffer.push(url);
      }
    }
    expect(
      treffer,
      `Ohne diesen Fall bewiese der Test oben nur, dass die Aggregate leer sind.
      Kategorien nennen: /api/analytics, /api/analytics/busfactor, /api/management/snapshot.`,
    ).toEqual(["/api/analytics", "/api/analytics/busfactor", "/api/management/snapshot"]);
  });
});

describe("mega76 D · die Zähler rechnen über der SICHTBAREN Grundmenge", () => {
  it("/api/analytics — total zählt das vertrauliche Objekt für den Betrachter nicht mit", async () => {
    const { app, admin, viewer } = await setup();
    const alsViewer = (await hole(app, viewer, "/api/analytics")).json();
    const alsAdmin = (await hole(app, admin, "/api/analytics")).json();
    expect(alsAdmin.total, "GEGENPROBE: der Admin sieht beide").toBe(2);
    expect(
      alsViewer.total,
      `Ein vertrauliches Objekt verändert total um eins — das IST die Auskunft.
      Antwort: ${JSON.stringify(alsViewer)}`,
    ).toBe(1);
  });

  it("/api/ai-check/coverage-summary — dieselbe Zahl über derselben Grundmenge", async () => {
    const { app, admin, viewer } = await setup();
    expect((await hole(app, admin, "/api/ai-check/coverage-summary")).json().total).toBe(2);
    expect(
      (await hole(app, viewer, "/api/ai-check/coverage-summary")).json().total,
      "die vier Zähler hängen algebraisch zusammen — `total` trägt die Existenz",
    ).toBe(1);
  });

  it("/api/analytics/impact — validatedTotal und der Wochenbucket", async () => {
    const { app, admin, viewer } = await setup();
    const alsAdmin = (await hole(app, admin, "/api/analytics/impact")).json();
    const alsViewer = (await hole(app, viewer, "/api/analytics/impact")).json();
    expect(alsAdmin.validatedTotal, "GEGENPROBE").toBe(2);
    expect(
      alsViewer.validatedTotal,
      `Ein vertrauliches validiertes Objekt erhöht validatedTotal und genau seinen
      Wochenbucket. Antwort: ${JSON.stringify(alsViewer)}`,
    ).toBe(1);
    const wochen = Object.values(alsViewer.validatedByWeek as Record<string, number>);
    expect(
      wochen.reduce((a, b) => a + b, 0),
      "auch die Wochenbuckets",
    ).toBe(1);
  });

  it("/api/management/snapshot — der breiteste der sechs Pfade", async () => {
    const { app, admin, viewer } = await setup();
    const alsAdmin = (await hole(app, admin, "/api/management/snapshot")).json();
    const alsViewer = (await hole(app, viewer, "/api/management/snapshot")).json();
    expect(alsAdmin.overview.totalKos, "GEGENPROBE").toBe(2);
    expect(
      alsViewer.overview.totalKos,
      `Ein einzelnes vertrauliches Objekt erzeugt eine neue Kategoriezeile, verschiebt
      Zeitfenster und mehrere globale Scores. Antwort: ${JSON.stringify(alsViewer.overview)}`,
    ).toBe(1);
    const haus = (alsViewer.house ?? []) as { category: string }[];
    expect(
      haus.map((z) => z.category),
      "`house` nennt Kategoriename und koCount unmittelbar",
    ).not.toContain(GEHEIME_KATEGORIE);
  });

  it("/api/analytics/busfactor — keine Zeile für die nur vertraulich belegte Kategorie", async () => {
    const { app, admin, viewer } = await setup();
    const alsAdmin = (await hole(app, admin, "/api/analytics/busfactor")).json() as {
      category: string;
    }[];
    const alsViewer = (await hole(app, viewer, "/api/analytics/busfactor")).json() as {
      category: string;
    }[];
    expect(alsAdmin.map((e) => e.category).sort(), "GEGENPROBE").toEqual(
      [GEHEIME_KATEGORIE, OFFENE_KATEGORIE].sort(),
    );
    expect(
      alsViewer.map((e) => e.category),
      `Ein einzelnes vertrauliches KO in einer sonst leeren Kategorie erzeugt eine
      Zeile mit koCount: 1, authorCount: 1, singleSource: true. Antwort: ${JSON.stringify(alsViewer)}`,
    ).toEqual([OFFENE_KATEGORIE]);
  });

  it("/api/validation/overview — keine Personenzeile aus einer vertraulichen Zuweisung", async () => {
    const { app, admin, viewer, prueferId } = await setup();
    const alsAdmin = (await hole(app, admin, "/api/validation/overview")).json() as {
      userId: string;
    }[];
    const alsViewer = (await hole(app, viewer, "/api/validation/overview")).json() as {
      userId: string;
    }[];
    expect(
      alsAdmin.map((e) => e.userId),
      "GEGENPROBE",
    ).toContain(prueferId);
    expect(
      alsViewer.map((e) => e.userId),
      `Eine einzige Zuweisung auf ein vertrauliches KO macht Existenz UND die Kennung
      der befassten Person sichtbar. Antwort: ${JSON.stringify(alsViewer)}`,
    ).not.toContain(prueferId);
  });
});
