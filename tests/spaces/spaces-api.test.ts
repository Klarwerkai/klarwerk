// ================================================================================================
// SPACES · DER DRAHT — Arbeitsräume, führender Space, Ansichten, Rechte, Rechtevorschau, Klara.
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Die Vorrichtung legt ihre Konten selbst
// an (erstes Konto = Admin, danach `POST /api/users`); alle Namen und Inhalte sind erfundene
// Testdaten dieses Falls.
//
//   Lea    (experte)    — Spacezuständige von „Werkstatt Nord" (Zugang: nur Mitglieder)
//   Erik   (experte)    — Mitglied mit Schreibrecht, Autor des Artikels
//   Vera   (viewer)     — Mitglied mit Leserecht
//   Carla  (controller) — Mitglied mit Leserecht; legt die Spaces an
//   Fritz  (experte)    — KEIN Mitglied: der unberechtigte Nutzer
//   Admin  (admin)      — verwaltet Konten, ist KEIN Mitglied (kein Rollen-Durchgriff)
//
// Ordnung zu den Originalkriterien des Auftrags:
//   K1 · Space mit Zweck, Mitgliedern und Zuständigkeit anlegen und bearbeiten (Fassungen, Rechte).
//   K2 · Derselbe Artikel (Kennung + Fassung) über Space, Tag und gespeicherte Ansicht.
//   K3 · Suche, Liste, Vorschau und Klara (`/api/ask`) folgen den Space- und Artikelrechten.
//   K4 · Spacewechsel: Rechtevorschau vor der Übernahme; Autorschaft, Fassung, Historie bleiben.
//   K5 · Spacezuständigkeit und Artikelverantwortung bleiben getrennt erkennbar.
//   K6 · Der Unberechtigte bekommt auch per direktem Link keinen Inhalt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
// Das Wort, das NUR im Testartikel steht — so ist jede Fundstelle eindeutig diesem Objekt zuzuordnen.
const WORT = "Quarzlehrenpruefung";
const AUSSAGE = `Die ${WORT} läuft vor jeder Schicht mit dem Referenzblock.`;

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@spaces.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@spaces.test");
  const konten = [
    ["Lea Leitung", "lea@spaces.test", "experte"],
    ["Erik Experte", "erik@spaces.test", "experte"],
    ["Vera Viewer", "vera@spaces.test", "viewer"],
    ["Carla Controller", "carla@spaces.test", "controller"],
    ["Fritz Fremd", "fritz@spaces.test", "experte"],
  ] as const;
  for (const [name, email, role] of konten) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    admin,
    lea: await anmelden(app, "lea@spaces.test"),
    erik: await anmelden(app, "erik@spaces.test"),
    vera: await anmelden(app, "vera@spaces.test"),
    carla: await anmelden(app, "carla@spaces.test"),
    fritz: await anmelden(app, "fritz@spaces.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string => {
    const konto = (liste.json().konten as { id: string; name: string }[]).find(
      (x) => x.name === name,
    );
    expect(konto, `Konto ${name}`).toBeDefined();
    return konto?.id ?? "";
  };
  const ids = {
    admin: id("Ada Admin"),
    lea: id("Lea Leitung"),
    erik: id("Erik Experte"),
    vera: id("Vera Viewer"),
    carla: id("Carla Controller"),
    fritz: id("Fritz Fremd"),
  };
  return { app, services, k, ids };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function spaceAnlegen(b: Buehne) {
  const werkstatt = await b.app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: b.k.carla,
    payload: {
      name: "Werkstatt Nord",
      zweck: "Prüfmittel und Arbeitsanweisungen der Werkstatt Nord.",
      verantwortlich: b.ids.lea,
      zugang: "mitglieder",
      mitglieder: [
        { nutzer: b.ids.erik, recht: "schreiben" },
        { nutzer: b.ids.vera, recht: "lesen" },
        { nutzer: b.ids.carla, recht: "lesen" },
      ],
      ansichten: [],
    },
  });
  expect(werkstatt.statusCode, werkstatt.body).toBe(201);
  const qualitaet = await b.app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: b.k.carla,
    payload: {
      name: "Qualität",
      zweck: "Hausweite Sicht auf Prüfmittel.",
      verantwortlich: b.ids.carla,
      zugang: "alle",
      mitglieder: [],
      ansichten: [{ name: "Prüfmittel", tag: "pruefmittel" }],
    },
  });
  expect(qualitaet.statusCode, qualitaet.body).toBe(201);
  return {
    werkstatt: werkstatt.json() as { id: string; version: number },
    qualitaet: qualitaet.json() as { id: string; ansichten: { id: string }[] },
  };
}

async function artikelAnlegen(b: Buehne): Promise<string> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: b.k.erik,
    payload: {
      confidentiality: "intern",
      title: `${WORT} am Messplatz`,
      statement: AUSSAGE,
      type: "best_practice",
      category: "Prüfmittel",
      tags: ["pruefmittel"],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function vorschau(b: Buehne, kopf: Kopf, koId: string, zielSpaceId: string | null) {
  return b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: kopf,
    payload: { koId, zielSpaceId },
  });
}

function basisAus(v: {
  quelle: { id: string; version: number } | null;
  ziel: { id: string; version: number } | null;
  grundlage: string;
}) {
  return {
    quelleId: v.quelle?.id ?? null,
    quelleVersion: v.quelle?.version ?? null,
    zielId: v.ziel?.id ?? null,
    zielVersion: v.ziel?.version ?? null,
    // ADMIN-07 Nacharbeit 3: die Bestätigung ist an die wirksame Rechtelage gebunden.
    grundlage: v.grundlage,
  };
}

/** Vorschau holen und mit genau dieser Grundlage übernehmen — der reguläre Weg der Oberfläche. */
async function verschieben(b: Buehne, kopf: Kopf, koId: string, zielSpaceId: string | null) {
  const v = await vorschau(b, kopf, koId, zielSpaceId);
  expect(v.statusCode, v.body).toBe(200);
  const res = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: kopf,
    payload: { koId, zielSpaceId, basis: basisAus(v.json()) },
  });
  return { vorschau: v.json(), res };
}

async function lies(b: Buehne, kopf: Kopf, url: string) {
  return b.app.inject({ method: "GET", url, headers: kopf });
}

describe("K1 · Space mit Zweck, Mitgliedern und Zuständigkeit anlegen und bearbeiten", () => {
  it("anlegen, wieder lesen, durch die Zuständige bearbeiten — jede Änderung ist eine Fassung", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);

    const gelesen = await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const s = gelesen.json().space;
    expect(s).toMatchObject({
      name: "Werkstatt Nord",
      zweck: "Prüfmittel und Arbeitsanweisungen der Werkstatt Nord.",
      verantwortlich: b.ids.lea,
      verantwortlichName: "Lea Leitung",
      zugang: "mitglieder",
      version: 1,
      eigenesRecht: "zustaendig",
    });
    expect(s.mitglieder).toEqual([
      { nutzer: b.ids.erik, recht: "schreiben", name: "Erik Experte" },
      { nutzer: b.ids.vera, recht: "lesen", name: "Vera Viewer" },
      { nutzer: b.ids.carla, recht: "lesen", name: "Carla Controller" },
    ]);

    // Bearbeiten durch die Spacezuständige: neuer Zweck, Vera bekommt Schreibrecht.
    const geaendert = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.lea,
      payload: {
        version: 1,
        name: "Werkstatt Nord",
        zweck: "Prüfmittel, Arbeitsanweisungen und Kalibrierung der Werkstatt Nord.",
        verantwortlich: b.ids.lea,
        zugang: "mitglieder",
        mitglieder: [
          { nutzer: b.ids.erik, recht: "schreiben" },
          { nutzer: b.ids.vera, recht: "schreiben" },
          { nutzer: b.ids.carla, recht: "lesen" },
        ],
        ansichten: [{ name: "Kalibrierung", tag: "kalibrierung" }],
      },
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    expect(geaendert.json()).toMatchObject({ version: 2, angelegtVon: b.ids.carla });

    const danach = (await lies(b, b.k.vera, `/api/spaces/${werkstatt.id}`)).json();
    expect(danach.space.zweck).toContain("Kalibrierung");
    expect(danach.space.eigenesRecht).toBe("schreiben");
    expect(danach.space.ansichten).toEqual([
      { id: "kalibrierung", name: "Kalibrierung", tag: "kalibrierung" },
    ]);
    expect(danach.fassungen.map((f: { version: number }) => f.version)).toEqual([1, 2]);
    expect(danach.fassungen[1].geaendertVonName).toBe("Lea Leitung");

    // Die Liste führt ihn für Mitglieder; ein veralteter Schreiber kommt nicht durch.
    const liste = (await lies(b, b.k.erik, "/api/spaces")).json();
    expect(liste.spaces.map((x: { id: string }) => x.id)).toContain(werkstatt.id);
    const veraltet = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.lea,
      payload: { ...danach.space, version: 1 },
    });
    expect(veraltet.statusCode).toBe(409);
  });

  it("Rechte: anlegen nur mit ko.validate, bearbeiten nur Zuständige oder Kontoverwaltung", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);
    const eingabe = {
      name: "Schattenraum",
      zweck: "Darf nicht entstehen.",
      verantwortlich: b.ids.fritz,
      zugang: "alle",
    };
    const expertin = await b.app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: b.k.lea,
      payload: eingabe,
    });
    expect(expertin.statusCode).toBe(403);
    const unbekannt = await b.app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: b.k.carla,
      payload: { ...eingabe, verantwortlich: "gibt-es-nicht" },
    });
    expect(unbekannt.statusCode).toBe(400);

    const aenderung = {
      version: 1,
      name: "Werkstatt Nord",
      zweck: "Fremd geändert.",
      verantwortlich: b.ids.lea,
      zugang: "mitglieder",
      mitglieder: [{ nutzer: b.ids.erik, recht: "schreiben" }],
    };
    // Mitglied mit Schreibrecht ist nicht zuständig: 403.
    const erik = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.erik,
      payload: aenderung,
    });
    expect(erik.statusCode).toBe(403);
    // Wer den Space nicht sehen darf, erfährt nicht einmal, dass es ihn gibt: 404.
    const fritz = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.fritz,
      payload: aenderung,
    });
    expect(fritz.statusCode).toBe(404);
    // Die Kontoverwaltung darf ihn pflegen (z. B. eine neue Zuständigkeit setzen).
    const admin = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.admin,
      payload: { ...aenderung, zweck: "Vom Admin neu zugeordnet." },
    });
    expect(admin.statusCode, admin.body).toBe(200);
    expect(admin.json().version).toBe(2);
  });
});

describe("K2 · derselbe Artikel über Space, Tag und gespeicherte Ansicht", () => {
  it("Kennung und Fassung sind auf allen drei Wegen dieselben wie am Artikel selbst", async () => {
    const b = await buehne();
    const { werkstatt, qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    const { res } = await verschieben(b, b.k.erik, koId, werkstatt.id);
    expect(res.statusCode, res.body).toBe(200);

    const artikel = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();
    const soll = { id: koId, version: artikel.version };

    const imSpace = (await lies(b, b.k.erik, `/api/spaces/${werkstatt.id}/artikel`)).json();
    expect(imSpace.artikel).toEqual([
      expect.objectContaining({ ...soll, spaceId: werkstatt.id, spaceName: "Werkstatt Nord" }),
    ]);

    const perTag = (await lies(b, b.k.erik, "/api/kos?tag=pruefmittel")).json() as {
      id: string;
      version: number;
    }[];
    expect(perTag.filter((x) => x.id === koId).map((x) => x.version)).toEqual([soll.version]);

    const ansichtId = qualitaet.ansichten[0]?.id ?? "";
    const inAnsicht = (
      await lies(b, b.k.erik, `/api/spaces/${qualitaet.id}/artikel?ansicht=${ansichtId}`)
    ).json();
    // Die Ansicht liegt in einem ANDEREN Space und zeigt doch dasselbe Objekt — keine Kopie.
    expect(inAnsicht.artikel).toEqual([
      expect.objectContaining({ ...soll, spaceId: werkstatt.id, spaceName: "Werkstatt Nord" }),
    ]);
    // Es gibt weiterhin genau ein Wissensobjekt mit diesem Titel.
    const alle = (await lies(b, b.k.erik, "/api/kos")).json() as { title: string }[];
    expect(alle.filter((x) => x.title.includes(WORT))).toHaveLength(1);
  });

  it("die zweite Ansicht respektiert die Rechte des führenden Space", async () => {
    const b = await buehne();
    const { werkstatt, qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    await verschieben(b, b.k.erik, koId, werkstatt.id);
    const ansichtId = qualitaet.ansichten[0]?.id ?? "";
    // Fritz darf den offenen Space „Qualität" sehen — den Artikel aus „Werkstatt Nord" nicht.
    const fritz = await lies(
      b,
      b.k.fritz,
      `/api/spaces/${qualitaet.id}/artikel?ansicht=${ansichtId}`,
    );
    expect(fritz.statusCode).toBe(200);
    expect(fritz.json().artikel).toEqual([]);
    expect(fritz.body).not.toContain(WORT);
  });
});

describe("K3 · Suche, Vorschau und Klara berücksichtigen Space- und Artikelrechte", () => {
  it("Suche, Liste und Vorschau: Mitglieder finden den Artikel, Nichtmitglieder nicht — auch keine Rolle", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);

    // KALIBRIERUNG: ohne Space findet auch Fritz den internen Artikel.
    const vorher = await lies(b, b.k.fritz, `/api/library/search?q=${WORT}`);
    expect(vorher.body, "ohne Space muss die Suche ihn liefern").toContain(koId);

    await verschieben(b, b.k.erik, koId, werkstatt.id);

    for (const [wer, kopf] of [
      ["Erik (Mitglied, schreiben)", b.k.erik],
      ["Vera (Mitglied, lesen)", b.k.vera],
      ["Lea (zuständig)", b.k.lea],
    ] as const) {
      const suche = await lies(b, kopf, `/api/library/search?q=${WORT}`);
      expect(suche.body, `${wer} muss ihn finden`).toContain(koId);
      const detail = await lies(b, kopf, `/api/kos/${koId}`);
      expect(detail.statusCode, wer).toBe(200);
    }
    for (const [wer, kopf] of [
      ["Fritz (kein Mitglied)", b.k.fritz],
      ["Admin (Kontoverwaltung, kein Mitglied)", b.k.admin],
    ] as const) {
      const suche = await lies(b, kopf, `/api/library/search?q=${WORT}`);
      expect(suche.statusCode).toBe(200);
      expect(suche.body, `${wer}: Suche`).not.toContain(koId);
      expect(suche.body, `${wer}: Suche`).not.toContain(WORT);
      const liste = await lies(b, kopf, "/api/kos");
      expect(liste.body, `${wer}: Liste`).not.toContain(koId);
      const perTag = await lies(b, kopf, "/api/kos?tag=pruefmittel");
      expect(perTag.body, `${wer}: Tag`).not.toContain(koId);
      const zeile = await lies(b, kopf, `/api/spaces/kontext/artikel/${koId}`);
      expect(zeile.statusCode, `${wer}: Vorschau der Spacezeile`).toBe(404);
    }
  });

  it("Klara (POST /api/ask, Weg des Aufgabenfensters): nur Mitglieder bekommen den Artikel als Grundlage", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    // Testvorbereitung über den Dienst: der Artikel gilt als geprüft, damit er im engen
    // Klara-Weg (`retrieval-only`, nur validiertes Wissen) überhaupt Grundlage sein darf.
    await b.services.ko.setValidationState(koId, { trust: 90, status: "validiert" });
    await verschieben(b, b.k.erik, koId, werkstatt.id);

    const frage = { question: `Wie läuft die ${WORT}?`, mode: "retrieval-only" };
    const mitglied = await b.app.inject({
      method: "POST",
      url: "/api/ask",
      headers: b.k.vera,
      payload: frage,
    });
    expect(mitglied.statusCode, mitglied.body).toBe(200);
    expect(mitglied.body, "KALIBRIERUNG: das Mitglied bekommt den Artikel").toContain(koId);

    for (const [wer, kopf] of [
      ["Fritz", b.k.fritz],
      ["Admin", b.k.admin],
    ] as const) {
      const res = await b.app.inject({
        method: "POST",
        url: "/api/ask",
        headers: kopf,
        payload: frage,
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.body, `${wer}: Kennung`).not.toContain(koId);
      expect(res.body, `${wer}: Aussage`).not.toContain("Referenzblock");
    }
  });

  it("Live-Check beim Schreiben (POST /api/knowledge/check): ähnliche Artikel nur aus dem Sichtbaren", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    await verschieben(b, b.k.erik, koId, werkstatt.id);
    const pruefe = (kopf: Kopf) =>
      b.app.inject({
        method: "POST",
        url: "/api/knowledge/check",
        headers: kopf,
        payload: { text: AUSSAGE, source: "manual" },
      });
    const mitglied = await pruefe(b.k.vera);
    expect(mitglied.statusCode, mitglied.body).toBe(200);
    expect(
      (mitglied.json().similar as { id: string }[]).map((s) => s.id),
      "KALIBRIERUNG: das Mitglied bekommt den ähnlichen Artikel",
    ).toContain(koId);
    const fremd = await pruefe(b.k.fritz);
    expect(fremd.statusCode, fremd.body).toBe(200);
    expect(fremd.body).not.toContain(koId);
    expect(fremd.body).not.toContain(WORT);
  });

  it("die Vertraulichkeitsstufe bleibt zusätzlich wirksam: offener Space macht Vertrauliches nicht sichtbar", async () => {
    const b = await buehne();
    const { qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    const hoch = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: b.k.erik,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    await verschieben(b, b.k.erik, koId, qualitaet.id);
    expect((await lies(b, b.k.fritz, `/api/kos/${koId}`)).statusCode).toBe(404);
    expect((await lies(b, b.k.erik, `/api/kos/${koId}`)).statusCode).toBe(200);
  });
});

describe("K4 · Spacewechsel mit Rechtevorschau; Autorschaft und Historie bleiben", () => {
  it("die Vorschau nennt die Rechtewirkung, die Übernahme ändert weder Fassung noch Historie", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    const vorher = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();

    const v = await vorschau(b, b.k.erik, koId, werkstatt.id);
    expect(v.statusCode, v.body).toBe(200);
    const p = v.json();
    expect(p.quelle).toBeNull();
    expect(p.ziel).toMatchObject({ id: werkstatt.id, name: "Werkstatt Nord", version: 1 });
    expect(p.verlieren.map((x: { name: string }) => x.name).sort()).toEqual([
      "Ada Admin",
      "Fritz Fremd",
    ]);
    expect(p.erhalten).toEqual([]);
    expect(p.autorBehaeltZugang).toBe(true);
    expect(p.bleibt).toMatchObject({
      version: vorher.version,
      author: b.ids.erik,
      historyEintraege: vorher.history.length,
    });
    expect(p.darfAusfuehren).toBe(true);

    // Die Vorschau allein schreibt nichts.
    expect((await lies(b, b.k.fritz, `/api/kos/${koId}`)).statusCode).toBe(200);

    const res = await b.app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: b.k.erik,
      payload: { koId, zielSpaceId: werkstatt.id, basis: basisAus(p) },
    });
    expect(res.statusCode, res.body).toBe(200);

    const nachher = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();
    expect(nachher.spaceId).toBe(werkstatt.id);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.author).toBe(vorher.author);
    expect(nachher.originalAuthor).toBe(vorher.originalAuthor);
    expect(nachher.history).toEqual(vorher.history);
    // Und genau die angekündigte Wirkung trat ein.
    expect((await lies(b, b.k.fritz, `/api/kos/${koId}`)).statusCode).toBe(404);
    // Der Wechsel steht im Prüfprotokoll — mit vorherigem und neuem Space.
    const belege = await b.services.audit.list({ action: "ko.space-changed", target: koId });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.payload).toMatchObject({ vorher: null, nachher: werkstatt.id });
  });

  it("ohne gültige Vorschau keine Übernahme; geänderte Rechtelage → neue Vorschau statt Wechsel", async () => {
    const b = await buehne();
    const { werkstatt, qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    await verschieben(b, b.k.erik, koId, werkstatt.id);

    const ohne = await b.app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: b.k.erik,
      payload: { koId, zielSpaceId: qualitaet.id },
    });
    expect(ohne.statusCode).toBe(400);

    const alt = (await vorschau(b, b.k.erik, koId, qualitaet.id)).json();
    // Zwischen Vorschau und Übernahme ändert die Zuständige die Mitglieder des Quellspace.
    const space = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json().space;
    const aenderung = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.lea,
      payload: {
        ...space,
        mitglieder: [...space.mitglieder, { nutzer: b.ids.fritz, recht: "lesen" }],
      },
    });
    expect(aenderung.statusCode, aenderung.body).toBe(200);

    const res = await b.app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: b.k.erik,
      payload: { koId, zielSpaceId: qualitaet.id, basis: basisAus(alt) },
    });
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("VORSCHAU_VERALTET");
    expect(res.json().vorschau.quelle.version).toBe(2);
    expect((await lies(b, b.k.erik, `/api/kos/${koId}`)).json().spaceId).toBe(werkstatt.id);
  });

  it("die Vorschau ist an ihr Ziel gebunden: gleiche Versionsnummer, anderes Ziel → 409, kein Wechsel", async () => {
    const b = await buehne();
    const { werkstatt, qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    // Beide Zielspaces stehen auf Fassung 1, haben aber verschiedene Rechte: „Qualität" ist offen,
    // „Werkstatt Nord" nur für Mitglieder.
    const offen = (await vorschau(b, b.k.erik, koId, qualitaet.id)).json();
    expect(offen.ziel).toMatchObject({ id: qualitaet.id, version: 1 });
    expect(offen.verlieren).toEqual([]);
    const geschlossen = (await vorschau(b, b.k.erik, koId, werkstatt.id)).json();
    expect(geschlossen.ziel.version).toBe(offen.ziel.version);
    expect(geschlossen.verlieren.length).toBeGreaterThan(0);

    // Angezeigt wurde die Wirkung für „Qualität", übernommen werden soll „Werkstatt Nord".
    const umgelenkt = await b.app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: b.k.erik,
      payload: { koId, zielSpaceId: werkstatt.id, basis: basisAus(offen) },
    });
    expect(umgelenkt.statusCode, umgelenkt.body).toBe(409);
    expect(umgelenkt.json().error).toBe("VORSCHAU_VERALTET");
    expect(umgelenkt.json().vorschau.ziel.id).toBe(werkstatt.id);

    // Eine Grundlage ohne Zielkennung gilt ebenfalls nicht.
    const { zielId: _ohne, ...ohneZiel } = basisAus(geschlossen);
    const ohne = await b.app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: b.k.erik,
      payload: { koId, zielSpaceId: werkstatt.id, basis: ohneZiel },
    });
    expect(ohne.statusCode, ohne.body).toBe(409);

    // Nichts ist geschehen: kein Space, Fritz sieht den Artikel weiterhin.
    expect((await lies(b, b.k.erik, `/api/kos/${koId}`)).json().spaceId).toBeUndefined();
    expect((await lies(b, b.k.fritz, `/api/kos/${koId}`)).statusCode).toBe(200);
  });

  it("ein Mitglied mit Leserecht darf nicht verschieben; der Unberechtigte bekommt keine Vorschau", async () => {
    const b = await buehne();
    const { werkstatt, qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    await verschieben(b, b.k.erik, koId, werkstatt.id);

    const { vorschau: v, res } = await verschieben(b, b.k.vera, koId, qualitaet.id);
    expect(v.darfAusfuehren).toBe(false);
    expect(res.statusCode).toBe(403);
    expect((await lies(b, b.k.erik, `/api/kos/${koId}`)).json().spaceId).toBe(werkstatt.id);

    const fritz = await vorschau(b, b.k.fritz, koId, qualitaet.id);
    expect(fritz.statusCode).toBe(404);
    expect(fritz.body).not.toContain(WORT);
  });
});

describe("K5 · Spacezuständigkeit und Artikelverantwortung bleiben getrennt", () => {
  it("die Spacezeile nennt beide getrennt; ein Spacewechsel ändert die Artikelverantwortung nicht", async () => {
    const b = await buehne();
    const { werkstatt, qualitaet } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    await verschieben(b, b.k.erik, koId, werkstatt.id);
    // Die Artikelverantwortung bekommt ausdrücklich Vera — über den bestehenden Weg (ko.validate).
    const owner = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: b.k.carla,
      payload: { action: "ownership", ownership: { owner: b.ids.vera } },
    });
    expect(owner.statusCode, owner.body).toBe(200);

    const k = (await lies(b, b.k.erik, `/api/spaces/kontext/artikel/${koId}`)).json();
    expect(k.space).toMatchObject({
      id: werkstatt.id,
      verantwortlich: b.ids.lea,
      verantwortlichName: "Lea Leitung",
    });
    expect(k.artikelVerantwortung).toEqual({
      person: b.ids.vera,
      name: "Vera Viewer",
      art: "owner",
    });
    expect(k.autor).toEqual({ person: b.ids.erik, name: "Erik Experte" });

    // Wechsel in einen Space mit ANDERER Zuständigkeit: die Artikelverantwortung bleibt Vera.
    const { res } = await verschieben(b, b.k.erik, koId, qualitaet.id);
    expect(res.statusCode, res.body).toBe(200);
    const danach = (await lies(b, b.k.erik, `/api/spaces/kontext/artikel/${koId}`)).json();
    expect(danach.space.verantwortlich).toBe(b.ids.carla);
    expect(danach.artikelVerantwortung.person).toBe(b.ids.vera);
  });
});

describe("K6 · der Unberechtigte bekommt auch per direktem Link keinen Inhalt", () => {
  it("Detail, Fassungen, Belege, Spacekontext und Space-Seite antworten 404 ohne Inhalt", async () => {
    const b = await buehne();
    const { werkstatt } = await spaceAnlegen(b);
    const koId = await artikelAnlegen(b);
    await verschieben(b, b.k.erik, koId, werkstatt.id);

    for (const url of [
      `/api/kos/${koId}`,
      `/api/kos/${koId}/versions`,
      `/api/kos/${koId}/evidence`,
      `/api/spaces/kontext/artikel/${koId}`,
      `/api/spaces/${werkstatt.id}`,
      `/api/spaces/${werkstatt.id}/artikel`,
    ]) {
      for (const [wer, kopf] of [
        ["Fritz", b.k.fritz],
        ["Admin", b.k.admin],
      ] as const) {
        const res = await lies(b, kopf, url);
        // Der Admin verwaltet Spaces: die Space-Seite selbst darf er sehen, ihre Inhalte nicht.
        if (wer === "Admin" && url === `/api/spaces/${werkstatt.id}`) {
          expect(res.statusCode).toBe(200);
          expect(res.json().space.darfInhalteLesen).toBe(false);
          continue;
        }
        if (wer === "Admin" && url === `/api/spaces/${werkstatt.id}/artikel`) {
          expect(res.statusCode).toBe(200);
          expect(res.json().artikel).toEqual([]);
          continue;
        }
        expect(res.statusCode, `${wer} ${url}: ${res.body}`).toBe(404);
        expect(res.body, `${wer} ${url}`).not.toContain(WORT);
        expect(res.body, `${wer} ${url}`).not.toContain("Referenzblock");
      }
    }
    // Auch der Schreibweg verrät nichts: eine Aktion an der Kennung endet im selben 404.
    const kommentar = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: b.k.fritz,
      payload: { action: "comment", text: "Hallo?" },
    });
    expect(kommentar.statusCode).toBe(404);
    expect(kommentar.body).not.toContain(WORT);
    // KALIBRIERUNG: der direkte Link funktioniert für ein Mitglied.
    const vera = await lies(b, b.k.vera, `/api/kos/${koId}`);
    expect(vera.statusCode).toBe(200);
    expect(vera.body).toContain("Referenzblock");
  });
});
