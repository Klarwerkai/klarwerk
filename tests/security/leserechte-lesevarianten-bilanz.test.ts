// ================================================================================================
// aufnahme:20260922:gesamt-leserechte · Ben, Nacharbeit 10 — DIE LADEBILANZ DER LESEVARIANTEN.
// ================================================================================================
//
// DER BEFUND: `POST /api/admin/lesevarianten/laden` (`users.manage`) gab die Bilanz über den
// UNGEFILTERTEN Bestand aus. `textGeaendert`/`originalGeaendert` nannten Objektkennungen, die
// übrigen Felder zählten unsichtbare Objekte mit. `users.manage` ersetzt aber kein Space-Leserecht
// (`sichtbarkeit.ts`, `spaceErlaubt`): ein Admin ohne Mitgliedschaft erfuhr so Kennung und Existenz
// eines Objekts aus einem geschlossenen Space.
//
// GEMESSEN über die echten Routen (buildApp, Anwendungsspeicher). Zwei Objekte tragen Anker der
// echten Lieferung `advisor-ict-en-v1`: eines offen, eines in einem Mitglieder-Space. Für das
// geschützte liegt bereits eine ältere Übersetzung, damit der Lauf seine KENNUNG in
// `textGeaendert` nennt.
//   · Admin MIT Mitgliedschaft → die Kennung steht in der Bilanz (GEGENPROBE: der Weg trägt).
//   · Admin OHNE Mitgliedschaft → seine Bilanz ist FELD FÜR FELD die eines Bestands, in dem das
//     geschützte Objekt gar nicht existiert. Keine Kennung, kein Zählwert, kein Datensatzschlüssel
//     verrät den Unterschied.
//   · Die Zuordnung selbst bleibt bestandsweit: auch dieser Lauf legt die Variante des geschützten
//     Objekts an — der Mitglieds-Admin liest sie danach.
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { lokalisierungsPaket } from "../../services/app/src/lesevarianten";
import type { KoSource } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

const KENNWORT = "geheim12345";
const PAKET = "advisor-ict-en-v1";

const LIEFERUNG = (() => {
  const paket = lokalisierungsPaket(PAKET);
  if (!paket) {
    throw new Error(`Die Lieferung ${PAKET} fehlt — ohne sie misst dieser Test nichts.`);
  }
  const mitSeite = paket.records.filter((r) => r.confluence_id);
  const geschuetzt = mitSeite[0];
  const offen = mitSeite[1];
  if (!geschuetzt?.confluence_id || !offen?.confluence_id) {
    throw new Error("Die Lieferung trägt keine zwei Datensätze mit Seiten-Id.");
  }
  const sprache = paket.languages.find((l) => l !== geschuetzt.original_language);
  if (!sprache) {
    throw new Error("Die Lieferung trägt keine Übersetzungssprache.");
  }
  return { geschuetzt, offen, sprache };
})();

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

function quelleFuer(seitenId: string, autor: string): KoSource {
  return {
    id: `quelle-${seitenId}`,
    label: `Confluence-Seite ${seitenId}`,
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    externalId: seitenId,
    author: autor,
    at: "2026-01-01T00:00:00.000Z",
  };
}

async function objektMitAnker(
  services: AppServices,
  autor: string,
  seitenId: string,
  titel: string,
): Promise<string> {
  const ko = await services.ko.create({
    title: titel,
    statement: `${titel} — Kernaussage.`,
    type: "best_practice",
    category: "Onboarding",
    author: autor,
    sources: [quelleFuer(seitenId, autor)],
  });
  return ko.id;
}

/**
 * `mitGeschuetztem: false` baut denselben Bestand OHNE das Space-Objekt — die Vergleichsgröße für
 * „nicht sichtbar ist wie nicht vorhanden".
 */
async function buehne(opts: { mitGeschuetztem: boolean }) {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@lesevarianten.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@lesevarianten.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@lesevarianten.test", "experte"],
    ["Erik Experte", "erik@lesevarianten.test", "experte"],
    ["Carla Controller", "carla@lesevarianten.test", "controller"],
    ["Mia Mitglied", "mia@lesevarianten.test", "admin"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: ada,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    ada,
    mia: await anmelden(app, "mia@lesevarianten.test"),
    erik: await anmelden(app, "erik@lesevarianten.test"),
    carla: await anmelden(app, "carla@lesevarianten.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    lea: id("Lea Leitung"),
    erik: id("Erik Experte"),
    carla: id("Carla Controller"),
    mia: id("Mia Mitglied"),
  };
  expect(
    Object.values(ids).every((x) => x.length > 0),
    JSON.stringify(ids),
  ).toBe(true);

  // Das offene Objekt steht in jedem Aufbau.
  const offenId = await objektMitAnker(
    services,
    ids.erik,
    LIEFERUNG.offen.confluence_id as string,
    "Offenes Onboarding",
  );
  if (!opts.mitGeschuetztem) {
    return { app, k, offenId, geschuetztId: null };
  }

  // Der Space — Lea zuständig, Erik schreibt, Carla und Mia lesen; Ada ist kein Mitglied.
  const space = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: k.carla,
    payload: {
      name: "Personalakte Nord",
      zweck: "Nur für die Mitglieder dieses Bereichs.",
      verantwortlich: ids.lea,
      zugang: "mitglieder",
      ansichten: [],
      mitglieder: [
        { nutzer: ids.erik, recht: "schreiben" },
        { nutzer: ids.carla, recht: "lesen" },
        { nutzer: ids.mia, recht: "lesen" },
      ],
    },
  });
  expect(space.statusCode, space.body).toBe(201);
  const spaceId = (space.json() as { id: string }).id;

  const geschuetztId = await objektMitAnker(
    services,
    ids.erik,
    LIEFERUNG.geschuetzt.confluence_id as string,
    "Geschütztes Onboarding",
  );
  const v = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: k.erik,
    payload: { koId: geschuetztId, zielSpaceId: spaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vor = v.json() as {
    quelle: { id: string; version: number } | null;
    ziel: { id: string; version: number } | null;
  };
  const verschoben = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: k.erik,
    payload: {
      koId: geschuetztId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: vor.quelle?.id ?? null,
        quelleVersion: vor.quelle?.version ?? null,
        zielId: vor.ziel?.id ?? null,
        zielVersion: vor.ziel?.version ?? null,
      },
    },
  });
  expect(verschoben.statusCode, verschoben.body).toBe(200);

  // Eine ÄLTERE Übersetzung des geschützten Objekts — der Lauf ersetzt sie und nennt dabei
  // seine Kennung in `textGeaendert`.
  await services.lesevarianten.upsert({
    koId: geschuetztId,
    lang: LIEFERUNG.sprache,
    originalLanguage: LIEFERUNG.geschuetzt.original_language,
    title: "Veraltete Übersetzung",
    statement: "Veraltet.",
    bodyHtml: "<p>Veraltet.</p>",
    herkunft: `lokale Lieferung ${PAKET}`,
    status: LIEFERUNG.geschuetzt.translation_status,
    sourceBodySha256: null,
    originalSha256: "veraltet",
    uebersetzungSha256: "veraltet",
    quellabgleich: "unbestaetigt",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  return { app, k, offenId, geschuetztId };
}

const laden = (app: App, kopf: Kopf) =>
  app.inject({
    method: "POST",
    url: "/api/admin/lesevarianten/laden",
    headers: kopf,
    payload: { package: PAKET },
  });

describe("POST /api/admin/lesevarianten/laden — die Bilanz folgt der Lesepolicy des Aufrufers", () => {
  it("Admin mit Space-Mitgliedschaft: die Kennung des geschützten Objekts steht in der Bilanz", async () => {
    const { app, k, geschuetztId } = await buehne({ mitGeschuetztem: true });
    const res = await laden(app, k.mia);
    expect(res.statusCode, res.body).toBe(200);
    const bilanz = res.json() as { textGeaendert: string[]; nichtZugeordnet: string[] };
    // GEGENPROBE: der Weg trägt — sonst bewiese die Sperre unten nichts.
    expect(bilanz.textGeaendert).toContain(geschuetztId);
    expect(bilanz.nichtZugeordnet).not.toContain(LIEFERUNG.geschuetzt.key);
    await app.close();
  });

  it("Admin ohne Space-Leserecht: Bilanz Feld für Feld wie ohne das geschützte Objekt", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    const res = await laden(mit.app, mit.k.ada);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).not.toContain(mit.geschuetztId as string);

    const ohne = await buehne({ mitGeschuetztem: false });
    const vergleich = await laden(ohne.app, ohne.k.ada);
    expect(vergleich.statusCode, vergleich.body).toBe(200);
    // Keine Kennung, kein Zählwert, kein Datensatzschlüssel verrät das unsichtbare Objekt.
    expect(res.json()).toEqual(vergleich.json());
    expect(res.json().nichtZugeordnet).toContain(LIEFERUNG.geschuetzt.key);

    // Die Zuordnung blieb bestandsweit: Adas Lauf hat die Variante des geschützten Objekts
    // trotzdem geschrieben — das Mitglied liest sie danach in der Lieferfassung.
    const variante = await mit.app.inject({
      method: "GET",
      url: `/api/kos/${mit.geschuetztId}/lesevariante/${LIEFERUNG.sprache}`,
      headers: mit.k.mia,
    });
    expect(variante.statusCode, variante.body).toBe(200);
    expect(variante.json().title).not.toBe("Veraltete Übersetzung");
    // Und Ada selbst bekommt das Objekt auch auf diesem Weg nicht.
    const fremd = await mit.app.inject({
      method: "GET",
      url: `/api/kos/${mit.geschuetztId}/lesevariante/${LIEFERUNG.sprache}`,
      headers: mit.k.ada,
    });
    expect(fremd.statusCode).toBe(404);
    await mit.app.close();
    await ohne.app.close();
  });
});
