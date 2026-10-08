// ================================================================================================
// WISSENSPROJEKTE (SPACES) LÖSCHEN — Folgen vorab, Verknüpfungen konsistent, Filter stimmen.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensprojekte`, Originalpunkt `package:projekte`. Ein
// „Wissensprojekt" ist im heutigen Produkt ein Space (Arbeitsraum, `produkt:20261007:spaces`):
// anlegen, ändern und Artikel zuordnen gab es schon, Löschen nicht. Gemessen an der ECHTEN App
// (`buildApp`, Speicherablage). Alle Namen und Inhalte sind erfundene Testdaten.
//
//   Lea    (experte)    — Spacezuständige von „Werkstatt Nord" (Zugang: nur Mitglieder)
//   Erik   (experte)    — Mitglied mit Schreibrecht, Autor des Artikels
//   Carla  (controller) — legt die Spaces an
//   Fritz  (experte)    — kein Mitglied
//   Admin  (admin)      — verwaltet Konten, ist kein Mitglied
//
// Ordnung zu den Kriterien des Originalpunkts (K1 im Auftrag):
//   L1 · Projektlöschung funktioniert (leerer Space; danach überall weg, Verlauf bleibt).
//   L2 · Auswirkung auf Artikel wird vorab erklärt (Vorschau: sichtbar mit Titel, verborgen und
//        Papierkorb nur als Zahl; Löschen gesperrt, solange ein Artikel den Space trägt).
//   L3 · Verknüpfungen bleiben konsistent (kein Artikel mit Kennung eines gelöschten Space — auch
//        nicht bei einem gleichzeitigen Spacewechsel; Fassung und Historie unverändert).
//   L4 · Projektfilter stimmen nach der Löschung (Spaceliste, Space-Artikel, Ansicht, Tag-Filter).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const WORT = "Rundlaufpruefstand";

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
    payload: { name: "Ada Admin", email: "admin@projekte.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@projekte.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@projekte.test", "experte"],
    ["Erik Experte", "erik@projekte.test", "experte"],
    ["Carla Controller", "carla@projekte.test", "controller"],
    ["Fritz Fremd", "fritz@projekte.test", "experte"],
  ] as const) {
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
    lea: await anmelden(app, "lea@projekte.test"),
    erik: await anmelden(app, "erik@projekte.test"),
    carla: await anmelden(app, "carla@projekte.test"),
    fritz: await anmelden(app, "fritz@projekte.test"),
  };
  const kontenRes = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  const konten = kontenRes.json().konten as { id: string; name: string }[];
  const id = (name: string): string => konten.find((x) => x.name === name)?.id ?? "";
  const ids = { lea: id("Lea Leitung"), erik: id("Erik Experte"), carla: id("Carla Controller") };

  const werkstatt = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: k.carla,
    payload: {
      name: "Werkstatt Nord",
      zweck: "Prüfstände der Werkstatt Nord.",
      verantwortlich: ids.lea,
      zugang: "mitglieder",
      mitglieder: [{ nutzer: ids.erik, recht: "schreiben" }],
      ansichten: [{ name: "Prüfstände", tag: "pruefstand" }],
    },
  });
  expect(werkstatt.statusCode, werkstatt.body).toBe(201);
  const qualitaet = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: k.carla,
    payload: {
      name: "Qualität",
      zweck: "Hausweite Sicht auf Prüfstände.",
      verantwortlich: ids.carla,
      zugang: "alle",
      mitglieder: [],
      ansichten: [{ name: "Prüfstände", tag: "pruefstand" }],
    },
  });
  expect(qualitaet.statusCode, qualitaet.body).toBe(201);
  return {
    app,
    services,
    k,
    werkstatt: werkstatt.json() as { id: string; version: number },
    qualitaet: qualitaet.json() as { id: string; ansichten: { id: string }[] },
  };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function artikelAnlegen(b: Buehne): Promise<string> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: b.k.erik,
    payload: {
      confidentiality: "intern",
      title: `${WORT} an Linie 3`,
      statement: `Der ${WORT} wird vor jeder Schicht kalibriert.`,
      type: "best_practice",
      category: "Prüfmittel",
      tags: ["pruefstand"],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function verschieben(b: Buehne, koId: string, zielSpaceId: string | null) {
  const v = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: b.k.erik,
    payload: { koId, zielSpaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vj = v.json();
  return b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: b.k.erik,
    payload: {
      koId,
      zielSpaceId,
      basis: {
        quelleId: vj.quelle?.id ?? null,
        quelleVersion: vj.quelle?.version ?? null,
        zielId: vj.ziel?.id ?? null,
        zielVersion: vj.ziel?.version ?? null,
      },
    },
  });
}

async function loeschVorschau(b: Buehne, kopf: Kopf, spaceId: string) {
  return b.app.inject({
    method: "POST",
    url: `/api/spaces/${spaceId}/loeschung/vorschau`,
    headers: kopf,
  });
}

async function loeschen(b: Buehne, kopf: Kopf, spaceId: string, version: number) {
  return b.app.inject({
    method: "POST",
    url: `/api/spaces/${spaceId}/loeschung`,
    headers: kopf,
    payload: { version },
  });
}

async function lies(b: Buehne, kopf: Kopf, url: string) {
  return b.app.inject({ method: "GET", url, headers: kopf });
}

describe("L1 · Projektlöschung funktioniert", () => {
  it("ein leerer Space wird nach der Vorschau gelöscht und ist danach auf keinem Weg mehr da", async () => {
    const b = await buehne();
    const { werkstatt } = b;

    const v = await loeschVorschau(b, b.k.lea, werkstatt.id);
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json()).toMatchObject({
      space: { id: werkstatt.id, name: "Werkstatt Nord", version: 1 },
      artikel: [],
      weitereVerborgen: 0,
      imPapierkorb: 0,
      ansichten: 1,
      mitglieder: 1,
      darfLoeschen: true,
      grund: null,
    });

    const res = await loeschen(b, b.k.lea, werkstatt.id, 1);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ id: werkstatt.id, version: 2, geloescht: true });

    for (const kopf of [b.k.lea, b.k.erik, b.k.admin]) {
      const liste = (await lies(b, kopf, "/api/spaces")).json();
      expect(liste.spaces.map((s: { id: string }) => s.id)).not.toContain(werkstatt.id);
    }
    expect((await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).statusCode).toBe(404);
    expect((await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}/artikel`)).statusCode).toBe(404);
    const aendern = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${werkstatt.id}`,
      headers: b.k.lea,
      payload: { version: 2, name: "Werkstatt Nord", zweck: "Wiederbelebt?" },
    });
    expect(aendern.statusCode, "gelöscht ist nicht weiterpflegbar").toBe(404);
    expect((await loeschVorschau(b, b.k.lea, werkstatt.id)).statusCode).toBe(404);

    // Der Verlauf bleibt: Fassung 1 unverändert, Fassung 2 ist der Löschvermerk.
    const fassungen = await b.services.spaces.fassungen(werkstatt.id);
    expect(fassungen.map((f) => [f.version, typeof f.geloeschtAm])).toEqual([
      [1, "undefined"],
      [2, "string"],
    ]);
    expect(fassungen[0]?.zweck).toBe("Prüfstände der Werkstatt Nord.");
  });

  it("Rechte: nur Zuständige oder Kontoverwaltung; Nichtmitglieder erfahren nichts", async () => {
    const b = await buehne();
    const { werkstatt } = b;
    // Erik darf hineinschreiben, aber nicht den Space führen.
    expect((await loeschVorschau(b, b.k.erik, werkstatt.id)).statusCode).toBe(403);
    expect((await loeschen(b, b.k.erik, werkstatt.id, 1)).statusCode).toBe(403);
    // Fritz sieht den Space nicht: 404 statt Auskunft.
    const fremd = await loeschVorschau(b, b.k.fritz, werkstatt.id);
    expect(fremd.statusCode).toBe(404);
    expect(fremd.body).not.toContain("Werkstatt");
    expect((await loeschen(b, b.k.fritz, werkstatt.id, 1)).statusCode).toBe(404);
    // Die Kontoverwaltung darf.
    expect((await loeschen(b, b.k.admin, werkstatt.id, 1)).statusCode).toBe(200);
  });

  it("eine veraltete Vorschau löscht nicht", async () => {
    const b = await buehne();
    const v = (await loeschVorschau(b, b.k.lea, b.werkstatt.id)).json();
    const s = (await lies(b, b.k.lea, `/api/spaces/${b.werkstatt.id}`)).json().space;
    const geaendert = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${b.werkstatt.id}`,
      headers: b.k.lea,
      payload: { ...s, zweck: "Prüfstände und Lehren der Werkstatt Nord." },
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    const res = await loeschen(b, b.k.lea, b.werkstatt.id, v.space.version);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("VERSION_VERALTET");
    expect(res.json().vorschau.space.version).toBe(2);
    expect((await lies(b, b.k.lea, `/api/spaces/${b.werkstatt.id}`)).statusCode).toBe(200);
  });
});

describe("L2 · Auswirkung auf Artikel wird vorab erklärt", () => {
  it("die Vorschau nennt sichtbare Artikel mit Titel, verborgene nur als Zahl — und sperrt", async () => {
    const b = await buehne();
    const koId = await artikelAnlegen(b);
    expect((await verschieben(b, koId, b.werkstatt.id)).statusCode).toBe(200);

    const lea = await loeschVorschau(b, b.k.lea, b.werkstatt.id);
    expect(lea.statusCode, lea.body).toBe(200);
    expect(lea.json()).toMatchObject({
      artikel: [{ id: koId, title: `${WORT} an Linie 3` }],
      weitereVerborgen: 0,
      imPapierkorb: 0,
      darfLoeschen: false,
      grund: "SPACE_NICHT_LEER",
    });

    // Die Kontoverwaltung liest geschlossene Inhalte nicht: nur die Zahl, kein Titel, keine Kennung.
    const admin = await loeschVorschau(b, b.k.admin, b.werkstatt.id);
    expect(admin.statusCode, admin.body).toBe(200);
    expect(admin.json()).toMatchObject({ artikel: [], weitereVerborgen: 1, darfLoeschen: false });
    expect(admin.body).not.toContain(WORT);
    expect(admin.body).not.toContain(koId);

    // Löschen trotz Artikel: abgelehnt, nichts geschrieben.
    const res = await loeschen(b, b.k.lea, b.werkstatt.id, 1);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("SPACE_NICHT_LEER");
    expect(await b.services.spaces.fassungen(b.werkstatt.id)).toHaveLength(1);
    const artikel = (await lies(b, b.k.erik, `/api/spaces/${b.werkstatt.id}/artikel`)).json();
    expect(artikel.artikel.map((a: { id: string }) => a.id)).toEqual([koId]);
  });

  it("ein Artikel im Papierkorb zählt mit — sonst käme er beim Wiederherstellen ohne Space zurück", async () => {
    const b = await buehne();
    const koId = await artikelAnlegen(b);
    expect((await verschieben(b, koId, b.werkstatt.id)).statusCode).toBe(200);
    const weg = await b.app.inject({
      method: "DELETE",
      url: `/api/kos/${koId}`,
      headers: b.k.erik,
    });
    expect(weg.statusCode, weg.body).toBe(204);
    expect((await b.services.ko.trashed()).map((t) => t.id)).toContain(koId);

    const v = (await loeschVorschau(b, b.k.lea, b.werkstatt.id)).json();
    expect(v).toMatchObject({ artikel: [], weitereVerborgen: 0, imPapierkorb: 1 });
    expect(v.darfLoeschen).toBe(false);
    expect((await loeschen(b, b.k.lea, b.werkstatt.id, 1)).statusCode).toBe(409);
  });
});

describe("L3 · Verknüpfungen bleiben konsistent", () => {
  it("erst verschieben, dann löschen: der Artikel bleibt unverändert und sichtbar", async () => {
    const b = await buehne();
    const koId = await artikelAnlegen(b);
    expect((await verschieben(b, koId, b.werkstatt.id)).statusCode).toBe(200);
    const vorher = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();

    expect((await verschieben(b, koId, b.qualitaet.id)).statusCode).toBe(200);
    const v = (await loeschVorschau(b, b.k.lea, b.werkstatt.id)).json();
    expect(v.darfLoeschen).toBe(true);
    expect((await loeschen(b, b.k.lea, b.werkstatt.id, v.space.version)).statusCode).toBe(200);

    const nachher = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();
    expect(nachher.spaceId).toBe(b.qualitaet.id);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.history).toEqual(vorher.history);
    // Kein Artikel im ganzen Bestand trägt die Kennung des gelöschten Space.
    const bestand = await b.services.ko.listEinschliesslichPapierkorb();
    expect(bestand.filter((x) => x.spaceId === b.werkstatt.id)).toEqual([]);
    // Der Gelöschte ist kein Ziel mehr — weder in der Spacezeile noch über die Vorschau.
    const kontext = (await lies(b, b.k.erik, `/api/spaces/kontext/artikel/${koId}`)).json();
    expect(kontext.ziele.map((z: { id: string }) => z.id)).not.toContain(b.werkstatt.id);
    const zuGeloeschtem = await b.app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung/vorschau",
      headers: b.k.erik,
      payload: { koId, zielSpaceId: b.werkstatt.id },
    });
    expect(zuGeloeschtem.statusCode).toBe(404);
  });

  it("Spacewechsel und Löschung gleichzeitig: der Wechsel wird zurückgenommen, keine Waise", async () => {
    const b = await buehne();
    const koId = await artikelAnlegen(b);
    // Die Löschung landet genau zwischen Vorschau-Prüfung und Schreiben des Wechsels.
    const original = b.services.ko.setLeadingSpace.bind(b.services.ko);
    let einmal = true;
    b.services.ko.setLeadingSpace = async (id, spaceId, actor, erwartet) => {
      if (einmal) {
        einmal = false;
        const res = await loeschen(b, b.k.lea, b.werkstatt.id, 1);
        expect(res.statusCode, res.body).toBe(200);
      }
      return original(id, spaceId, actor, erwartet);
    };
    const res = await verschieben(b, koId, b.werkstatt.id);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("VORSCHAU_VERALTET");
    const ko = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();
    expect(ko.spaceId).toBeUndefined();
  });

  it("Löschung und Spacewechsel gleichzeitig: die Löschung wird zurückgenommen, der Artikel bleibt sichtbar", async () => {
    const b = await buehne();
    const koId = await artikelAnlegen(b);
    // Der Wechsel landet genau zwischen Prüfung und Löschvermerk.
    const repo = b.services.spaces;
    const lege = repo.lege.bind(repo);
    let einmal = true;
    repo.lege = async (fassung) => {
      if (einmal && fassung.geloeschtAm) {
        einmal = false;
        await b.services.ko.setLeadingSpace(koId, b.werkstatt.id, "test", null);
      }
      return lege(fassung);
    };
    const res = await loeschen(b, b.k.lea, b.werkstatt.id, 1);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("SPACE_NICHT_LEER");
    const space = await lies(b, b.k.lea, `/api/spaces/${b.werkstatt.id}`);
    expect(space.statusCode).toBe(200);
    expect(space.json().space.version).toBe(3);
    const artikel = (await lies(b, b.k.erik, `/api/spaces/${b.werkstatt.id}/artikel`)).json();
    expect(artikel.artikel.map((a: { id: string }) => a.id)).toEqual([koId]);
  });
});

describe("L4 · Projektfilter stimmen nach der Löschung", () => {
  it("Spaceliste, Space-Artikel, Ansicht eines anderen Space und Tag-Filter zeigen den richtigen Bestand", async () => {
    const b = await buehne();
    const koId = await artikelAnlegen(b);
    expect((await verschieben(b, koId, b.werkstatt.id)).statusCode).toBe(200);
    expect((await verschieben(b, koId, b.qualitaet.id)).statusCode).toBe(200);
    expect((await loeschen(b, b.k.lea, b.werkstatt.id, 1)).statusCode).toBe(200);

    const liste = (await lies(b, b.k.erik, "/api/spaces")).json() as {
      spaces: { id: string; artikelSichtbar: number }[];
    };
    const zaehler = liste.spaces.map((s) => [s.id, s.artikelSichtbar]);
    expect(zaehler).toEqual([[b.qualitaet.id, 1]]);
    const imSpace = (await lies(b, b.k.erik, `/api/spaces/${b.qualitaet.id}/artikel`)).json();
    expect(imSpace.artikel).toHaveLength(1);
    const zeile = { id: koId, spaceId: b.qualitaet.id, spaceName: "Qualität" };
    expect(imSpace.artikel[0]).toMatchObject(zeile);
    const ansichtUrl = `/api/spaces/${b.qualitaet.id}/artikel?ansicht=${b.qualitaet.ansichten[0]?.id}`;
    const ansicht = (await lies(b, b.k.fritz, ansichtUrl)).json();
    expect(ansicht.artikel.map((a: { id: string }) => a.id)).toEqual([koId]);
    const tag = await lies(b, b.k.fritz, "/api/kos?tag=pruefstand");
    expect(tag.statusCode, tag.body).toBe(200);
    expect(tag.body).toContain(koId);
  });
});
