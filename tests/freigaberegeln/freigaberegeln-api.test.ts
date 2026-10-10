// ================================================================================================
// ADMIN-09 · FREIGABEREGELN AM DRAHT (produkt:20261009:admin-freigaberegeln).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Alle Konten, Spaces und Inhalte sind
// erfundene Testdaten dieses Falls; es gibt kein Kennwort ausser dem Testkennwort der Bühne.
//
// LIEFERBELEG (Auftrag): zwei unabhängige Testnutzer, ein nicht berechtigter Nutzer, laufender
// Regelwechsel und parallele Inhaltsänderung; datierte Regel- und Entscheidungsbelege.
//
//   Ada    (admin)      — Kontoverwaltung und Spacezuständige von „Werkstatt"
//   Carla  (controller) — Prüferin 1 der Gruppe; Mitglied (schreiben)
//   Paul   (controller) — Prüfer 2 der Gruppe; Mitglied (lesen)
//   Ulli   (controller) — Mitglied (lesen), NICHT in der Prüfergruppe; nur Vertretung für Paul
//   Erik   (experte)    — Autor; Mitglied (schreiben)
//   Fritz  (experte)    — in keinem Space
//
// Zuordnung zu den Originalkriterien:
//   K1 · Übersicht: berechtigte Prüfer, Schritte, fehlende Voraussetzungen; kein Freigabeweg dort.
//   K2 · Vorschau alt/neu samt Wirkung auf laufende Vorgänge; Freigaben nicht erfunden/aufgehoben.
//   K3 · Selbstprüfung abgewiesen; fehlende aktive Prüfer; Ausnahme erkennbar und protokolliert.
//   K4 · Eine Zustimmung ist keine Freigabe; Freigabe und Veröffentlichung getrennt.
//   K5 · Person, Zeitpunkt, Fassung je Entscheidung; Entscheidung zur alten Fassung gibt nicht frei.
//   K6 · Frist/Vertretung → sichtbare Aufgabe; Wiederholung ohne doppelte Aufgabe oder Meldung.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { FreigabeRegelDienst } from "../../services/app/src/freigaberegel-dienst";
import type { ConsoleMailer } from "../../services/notifications";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
/** Ein Ablauf weit in der Vergangenheit: das Konto ist sicher nicht mehr aktiv. */
const ABGELAUFEN = "2020-01-01T00:00:00.000Z";

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
    payload: { name: "Ada Admin", email: "ada@admin09.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@admin09.test");
  for (const [name, email, role] of [
    ["Carla Controller", "carla@admin09.test", "controller"],
    ["Paul Prüfer", "paul@admin09.test", "controller"],
    ["Ulli Unbefugt", "ulli@admin09.test", "controller"],
    ["Erik Experte", "erik@admin09.test", "experte"],
    ["Fritz Fremd", "fritz@admin09.test", "experte"],
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
    carla: await anmelden(app, "carla@admin09.test"),
    paul: await anmelden(app, "paul@admin09.test"),
    ulli: await anmelden(app, "ulli@admin09.test"),
    erik: await anmelden(app, "erik@admin09.test"),
    fritz: await anmelden(app, "fritz@admin09.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: ada });
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    ada: id("Ada Admin"),
    carla: id("Carla Controller"),
    paul: id("Paul Prüfer"),
    ulli: id("Ulli Unbefugt"),
    erik: id("Erik Experte"),
    fritz: id("Fritz Fremd"),
  };
  for (const [name, wert] of Object.entries(ids)) {
    expect(wert, `Konto ${name}`).not.toBe("");
  }
  // Ohne eigene Regel braucht ein neuer Beitrag hier EINE Zustimmung — so wird sichtbar, was die
  // Regel ändert.
  const standard = await app.inject({
    method: "PUT",
    url: "/api/validation/settings",
    headers: ada,
    payload: { defaultNeededValidations: 1 },
  });
  expect(standard.statusCode, standard.body).toBe(200);
  const space = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: ada,
    payload: {
      name: "Werkstatt",
      zweck: "Prüfmittel der Werkstatt (fiktiv).",
      verantwortlich: ids.ada,
      zugang: "mitglieder",
      mitglieder: [
        { nutzer: ids.carla, recht: "schreiben" },
        { nutzer: ids.paul, recht: "lesen" },
        { nutzer: ids.ulli, recht: "lesen" },
        { nutzer: ids.erik, recht: "schreiben" },
      ],
      ansichten: [],
    },
  });
  expect(space.statusCode, space.body).toBe(201);
  const spaceId = space.json().id as string;
  return { app, services, k, ids, spaceId, regelUrl: `/api/spaces/${spaceId}/freigaberegel` };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function lies(b: Buehne, kopf: Kopf, url: string) {
  return b.app.inject({ method: "GET", url, headers: kopf });
}

async function schicke(b: Buehne, kopf: Kopf, url: string, payload: unknown, method = "POST") {
  return b.app.inject({ method: method as "POST", url, headers: kopf, payload: payload as object });
}

/**
 * Je Beitrag eine eigene, deutlich verschiedene Aussage — ähnliche Texte könnten die vorhandene
 * Dublettenerkennung auslösen, und die verlangt dann eine eigene Bestätigung vor jeder Zustimmung.
 */
const AUSSAGEN: Record<string, string> = {
  Drehmomentschlüssel: "Der Drehmomentschlüssel geht jährlich zum externen Kalibrierdienst.",
  Messschieber: "Nach einem Sturz wird der Nullpunkt am Messschieber sofort kontrolliert.",
  Lehrdorn: "Lehrdorne lagern trocken in der gepolsterten Holzschatulle.",
  Rachenlehre: "An Rachenlehren zeigt sich Verschleiss zuerst an den Messbacken.",
  Kalibrierschein: "Jeder Kalibrierschein nennt Prüfdatum, Normal und die prüfende Stelle.",
  Gewindelehre: "Gewindelehren werden vor Gebrauch mit Pinsel gereinigt und leicht gefettet.",
  Endmass: "Endmasse fasst man nur mit Handschuhen an, sonst setzt Korrosion an.",
};

/** Ein Beitrag im Space „Werkstatt" — angelegt und hineingelegt von `kopf`. */
async function beitrag(b: Buehne, kopf: Kopf, titel: string): Promise<string> {
  const res = await schicke(b, kopf, "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: AUSSAGEN[titel] ?? `${titel} (fiktiv).`,
    type: "best_practice",
    category: "Prüfmittel",
  });
  expect(res.statusCode, res.body).toBe(201);
  const koId = res.json().id as string;
  const v = await schicke(b, kopf, "/api/spaces/verschiebung/vorschau", {
    koId,
    zielSpaceId: b.spaceId,
  });
  expect(v.statusCode, v.body).toBe(200);
  const p = v.json() as { ziel: { version: number }; grundlage: string };
  const w = await schicke(b, kopf, "/api/spaces/verschiebung", {
    koId,
    zielSpaceId: b.spaceId,
    basis: {
      quelleId: null,
      quelleVersion: null,
      zielId: b.spaceId,
      zielVersion: p.ziel.version,
      grundlage: p.grundlage,
    },
  });
  expect(w.statusCode, w.body).toBe(200);
  return koId;
}

function bewerte(b: Buehne, kopf: Kopf, koId: string, verdict: string, fassung?: number) {
  const bindung = fassung === undefined ? {} : { expectedVersion: fassung };
  return schicke(b, kopf, `/api/kos/${koId}`, { action: "rate", verdict, ...bindung }, "PUT");
}

function handle(b: Buehne, kopf: Kopf, koId: string, payload: Record<string, unknown>) {
  return schicke(b, kopf, `/api/kos/${koId}`, payload, "PUT");
}

async function ko(b: Buehne, koId: string) {
  const res = await lies(b, b.k.ada, `/api/kos/${koId}`);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { version: number; status: string; neededValidations: number };
}

interface Uebersicht {
  space: { version: number };
  regel: { zustimmungen: number; fristTage: number | null } | null;
  schritte: { art: string; anzahl?: number }[];
  selbstpruefung: string;
  ausnahmewege: { art: string }[];
  pruefer: { id: string; berechtigt: boolean; hindernis: string | null; wege: string[] }[];
  voraussetzungen: { art: string; personen?: { id: string; name: string; hindernis: string }[] }[];
  vorgaenge: {
    id: string;
    zustand: string;
    zustimmungen: { gruen: number; erforderlich: number; veraltet: number };
    aufgaben: { person: string; vertretungFuer: string | null; ueberfaellig: boolean }[];
    entscheidungen: {
      art: string;
      person: string;
      am: string;
      fassung: number | null;
      aktuell: boolean;
      ausnahme: boolean;
    }[];
    luecken: { art: string; anzahl?: number; person?: string }[];
  }[];
  verlauf: { version: number; vonName: string | null; regel: { zustimmungen: number } | null }[];
  darfAendern: boolean;
}

async function uebersicht(b: Buehne, kopf: Kopf = b.k.ada): Promise<Uebersicht> {
  const res = await lies(b, kopf, b.regelUrl);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Uebersicht;
}

async function vorgang(b: Buehne, koId: string) {
  return (await uebersicht(b)).vorgaenge.find((v) => v.id === koId);
}

const GRUPPE = (b: Buehne, teil: Record<string, unknown> = {}) => ({
  zustimmungen: 2,
  pruefer: [b.ids.carla, b.ids.paul],
  prueferTeams: [],
  fristTage: 3,
  vertretungen: [{ fuer: b.ids.paul, durch: b.ids.ulli }],
  ...teil,
});

/** Die Regel über Vorschau und Bestätigung setzen — wie die Fläche es tut. */
async function regelSetzen(b: Buehne, regel: Record<string, unknown>) {
  const vorschau = await schicke(b, b.k.ada, `${b.regelUrl}/vorschau`, { regel });
  expect(vorschau.statusCode, vorschau.body).toBe(200);
  const v = vorschau.json() as { spaceVersion: number; grundlage: string };
  const bestaetigt = { version: v.spaceVersion, regel, grundlage: v.grundlage };
  const res = await schicke(b, b.k.ada, b.regelUrl, bestaetigt, "PUT");
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { angehoben: number };
}

async function audit(b: Buehne, action: string) {
  return (await b.services.audit.list({ action })) as {
    actor: string;
    at: string;
    target: string;
    payload: Record<string, unknown>;
  }[];
}

describe("ADMIN-09 · K1/K2 · Übersicht, Vorschau und Regelwechsel bei laufendem Vorgang", () => {
  it("nennt Prüfer, Schritte und Lücken; die Vorschau zeigt alt/neu und die Wirkung; Freigaben bleiben", async () => {
    const b = await buehne();
    const laufend = await beitrag(b, b.k.erik, "Drehmomentschlüssel");
    const freigegeben = await beitrag(b, b.k.erik, "Messschieber");
    // Ohne Regel genügt EINE Zustimmung: der zweite Beitrag ist freigegeben, bevor die Regel kommt.
    const eins = await bewerte(b, b.k.carla, freigegeben, "up");
    expect(eins.statusCode, eins.body).toBe(200);
    expect((await ko(b, freigegeben)).status).toBe("validiert");

    // --- K1 · Übersicht ohne eigene Regel --------------------------------------------------------
    const vorher = await uebersicht(b);
    expect(vorher.regel).toBeNull();
    expect(vorher.schritte.map((s) => s.art)).toEqual([
      "einreichen",
      "zustimmungen",
      "keine_ablehnung",
      "freigabe",
      "veroeffentlichen",
    ]);
    expect(vorher.selbstpruefung).toBe("ausgeschlossen");
    expect(vorher.ausnahmewege.map((a) => a.art)).toEqual([
      "admin_kennzeichnung",
      "eigentuemerfreigabe",
    ]);
    expect(vorher.voraussetzungen.map((v) => v.art)).toContain("keine_regel");
    const berechtigt = vorher.pruefer.filter((p) => p.berechtigt).map((p) => p.id);
    expect(berechtigt.sort()).toEqual([b.ids.ada, b.ids.carla, b.ids.paul, b.ids.ulli].sort());
    const mitPruefrecht = vorher.pruefer.map((p) => p.id);
    expect(mitPruefrecht, "ohne Prüfrecht kein Prüfer").not.toContain(b.ids.erik);
    const zustaende = Object.fromEntries(vorher.vorgaenge.map((v) => [v.id, v.zustand]));
    expect(zustaende).toEqual({ [laufend]: "eingereicht", [freigegeben]: "freigegeben" });
    const beleg = vorher.vorgaenge.find((v) => v.id === freigegeben)?.entscheidungen ?? [];
    expect(beleg).toHaveLength(1);
    expect(beleg[0]).toMatchObject({
      art: "zustimmung",
      person: b.ids.carla,
      fassung: 1,
      aktuell: true,
      ausnahme: false,
    });
    expect(Number.isNaN(Date.parse(beleg[0]?.am ?? ""))).toBe(false);

    // Wer den Space nicht sehen darf, erfährt nichts; ändern darf nur die Kontoverwaltung.
    expect((await lies(b, b.k.fritz, b.regelUrl)).statusCode).toBe(404);
    const fremd = await schicke(b, b.k.carla, `${b.regelUrl}/vorschau`, { regel: GRUPPE(b) });
    expect(fremd.statusCode).toBe(403);
    expect((await uebersicht(b, b.k.carla)).darfAendern).toBe(false);

    // --- K2 · Vorschau: alt/neu und Wirkung, schreibt nichts --------------------------------------
    const unzulaessig = await schicke(b, b.k.ada, `${b.regelUrl}/vorschau`, {
      regel: GRUPPE(b, { zustimmungen: 7 }),
    });
    expect(unzulaessig.statusCode).toBe(400);
    expect(unzulaessig.json().error).toBe("FREIGABEREGEL_UNGUELTIG");
    const vorschau = await schicke(b, b.k.ada, `${b.regelUrl}/vorschau`, { regel: GRUPPE(b) });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    const v = vorschau.json() as {
      spaceVersion: number;
      grundlage: string;
      alt: unknown;
      neu: { zustimmungen: number; fristTage: number };
      aenderungen: string[];
      laufend: {
        gesamt: number;
        angehoben: number;
        eintraege: { id: string; bisher: number; danach: number }[];
      };
      freigegeben: { gesamt: number };
      pruefer: { entfaellt: { id: string }[] };
    };
    expect(v.alt).toBeNull();
    expect(v.neu).toMatchObject({ zustimmungen: 2, fristTage: 3 });
    expect(v.aenderungen).toEqual(["neu"]);
    expect(v.laufend).toMatchObject({ gesamt: 1, angehoben: 1 });
    expect(v.laufend.eintraege).toEqual([
      expect.objectContaining({ id: laufend, bisher: 1, danach: 2 }),
    ]);
    expect(v.freigegeben.gesamt).toBe(1);
    expect(v.pruefer.entfaellt.map((p) => p.id)).toEqual([b.ids.ada]);
    expect((await ko(b, laufend)).neededValidations, "die Vorschau schreibt nichts").toBe(1);

    // --- K2 · Bestätigung nur mit der Grundlage der gezeigten Vorschau ----------------------------
    const bestaetigt = { version: v.spaceVersion, regel: GRUPPE(b), grundlage: v.grundlage };
    const falsch = await schicke(
      b,
      b.k.ada,
      b.regelUrl,
      { ...bestaetigt, grundlage: "veraltet" },
      "PUT",
    );
    expect(falsch.statusCode).toBe(409);
    expect(falsch.json().error).toBe("VORSCHAU_VERALTET");
    expect((await schicke(b, b.k.carla, b.regelUrl, bestaetigt, "PUT")).statusCode).toBe(403);
    const echt = await schicke(b, b.k.ada, b.regelUrl, bestaetigt, "PUT");
    expect(echt.statusCode, echt.body).toBe(200);
    expect(echt.json().angehoben).toBe(1);
    // Der laufende Vorgang braucht jetzt zwei Zustimmungen; die erteilte Freigabe bleibt, wie sie war.
    expect(await ko(b, laufend)).toMatchObject({ status: "offen", neededValidations: 2 });
    expect(await ko(b, freigegeben)).toMatchObject({ status: "validiert", neededValidations: 1 });
    // Wiederholt: diese Fassung ist schon vergeben — keine zweite Regelfassung.
    expect((await schicke(b, b.k.ada, b.regelUrl, bestaetigt, "PUT")).statusCode).toBe(409);

    // --- Nach Reload: Regel, Verlauf, Space-Fassung und Belege ------------------------------------
    const nachher = await uebersicht(b);
    expect(nachher.regel).toMatchObject({ zustimmungen: 2, fristTage: 3 });
    expect(nachher.space.version).toBe(v.spaceVersion + 1);
    expect(nachher.verlauf).toEqual([
      expect.objectContaining({
        version: v.spaceVersion + 1,
        vonName: "Ada Admin",
        regel: expect.objectContaining({ zustimmungen: 2 }),
      }),
    ]);
    const space = await lies(b, b.k.ada, `/api/spaces/${b.spaceId}`);
    expect(space.json().fassungen.at(-1)).toMatchObject({ vorgang: "freigaberegel" });
    const lage = nachher.vorgaenge.find((x) => x.id === laufend);
    expect(lage?.zustimmungen.erforderlich).toBe(2);
    const geaendert = await audit(b, "space.freigaberegel-geaendert");
    expect(geaendert).toHaveLength(1);
    expect(geaendert[0]).toMatchObject({
      actor: b.ids.ada,
      target: b.spaceId,
      payload: expect.objectContaining({ laufendAngehoben: 1, freigegebenUnveraendert: 1 }),
    });
    expect(await audit(b, "ko.needed-validations-raised")).toEqual([
      expect.objectContaining({
        target: laufend,
        payload: expect.objectContaining({ vorher: 1, nachher: 2 }),
      }),
    ]);
  });
});

describe("ADMIN-09 · K3/K4/K5 · Prüfpunkt am Server: Prüferkreis, Selbstprüfung, Fassung", () => {
  it("zwei unabhängige Prüfer, ein Unberechtigter und eine parallele Inhaltsänderung", async () => {
    const b = await buehne();
    await regelSetzen(b, GRUPPE(b));
    const koId = await beitrag(b, b.k.erik, "Lehrdorn");
    // Neu in den Space gekommen: die Mindestzahl gilt sofort.
    expect((await ko(b, koId)).neededValidations).toBe(2);

    // Nicht berechtigt: Ulli hat Prüfrecht und Zugang, gehört aber nicht zur Prüfergruppe — und
    // als Vertretung greift er erst, wenn ihm eine Aufgabe übergeben ist.
    const ulli = await bewerte(b, b.k.ulli, koId, "up", 1);
    expect(ulli.statusCode).toBe(403);
    expect(ulli.json().error).toBe("NICHT_PRUEFBERECHTIGT");
    expect((await bewerte(b, b.k.fritz, koId, "up", 1)).statusCode).toBe(403);
    // Ohne genannte Fassung keine Zustimmung.
    const ohne = await bewerte(b, b.k.carla, koId, "up");
    expect(ohne.statusCode).toBe(400);
    expect(ohne.json().error).toBe("FASSUNG_FEHLT");

    // K4 · Paul stimmt zu — eine von zwei, keine Freigabe.
    const paul = await bewerte(b, b.k.paul, koId, "up", 1);
    expect(paul.statusCode, paul.body).toBe(200);
    expect(paul.json().status).toBe("offen");
    let lage = await vorgang(b, koId);
    expect(lage?.zustand).toBe("eingereicht");
    expect(lage?.zustimmungen).toMatchObject({ gruen: 1, erforderlich: 2 });
    expect(lage?.luecken).toContainEqual({ art: "zustimmungen_fehlen", anzahl: 1 });
    const brett = (await lies(b, b.k.carla, "/api/validation/board")).json() as {
      id: string;
      neededValidations: number;
      freigaberegel?: { zustimmungen: number };
    }[];
    expect(brett.find((z) => z.id === koId)).toMatchObject({
      neededValidations: 2,
      freigaberegel: { zustimmungen: 2 },
    });

    // K5 · parallele Inhaltsänderung: Erik überarbeitet, während Carla die alte Fassung liest.
    const revise = await handle(b, b.k.erik, koId, {
      action: "revise",
      changes: { statement: "Lehrdorne lagern trocken; vor jeder Messung den Grat abtasten." },
    });
    expect(revise.statusCode, revise.body).toBe(200);
    expect((await ko(b, koId)).version).toBe(2);
    const alt = await bewerte(b, b.k.carla, koId, "up", 1);
    expect(alt.statusCode).toBe(409);
    expect(alt.json()).toMatchObject({ error: "KO_STALE", currentVersion: 2 });
    lage = await vorgang(b, koId);
    const vonCarla = lage?.entscheidungen.filter((e) => e.person === b.ids.carla);
    expect(vonCarla, "zur alten Fassung wurde nichts entschieden").toEqual([]);
    const neu = await bewerte(b, b.k.carla, koId, "up", 2);
    expect(neu.statusCode, neu.body).toBe(200);
    expect(neu.json().status, "Pauls Zustimmung galt Fassung 1 und zählt nicht").toBe("offen");
    lage = await vorgang(b, koId);
    expect(lage?.zustimmungen).toMatchObject({ gruen: 1, veraltet: 1, erforderlich: 2 });
    const spur = lage?.entscheidungen.map((e) => [e.person, e.fassung, e.aktuell]);
    expect(spur).toEqual([
      [b.ids.paul, 1, false],
      [b.ids.carla, 2, true],
    ]);

    // Pauls Zustimmung zur aktuellen Fassung gibt frei; eine Wiederholung zählt nicht doppelt.
    expect((await bewerte(b, b.k.paul, koId, "up", 2)).json().status).toBe("validiert");
    expect((await bewerte(b, b.k.paul, koId, "up", 2)).json()).toMatchObject({
      status: "validiert",
      up: 2,
    });
    lage = await vorgang(b, koId);
    expect(lage?.zustand, "freigegeben ist nicht veröffentlicht").toBe("freigegeben");
    const veroeffentlicht = await schicke(b, b.k.carla, `/api/kos/${koId}/veroeffentlichung`, {
      fassung: 2,
      meldung: "still",
    });
    expect(veroeffentlicht.statusCode, veroeffentlicht.body).toBe(201);
    expect((await vorgang(b, koId))?.zustand).toBe("veroeffentlicht");
  });

  it("Selbstprüfung abgewiesen — auch am Ausnahmeweg; die Ausnahme ist erkennbar und protokolliert", async () => {
    const b = await buehne();
    await regelSetzen(b, GRUPPE(b));
    const vonCarla = await beitrag(b, b.k.carla, "Rachenlehre");
    const selbst = await bewerte(b, b.k.carla, vonCarla, "up", 1);
    expect(selbst.statusCode).toBe(403);
    expect(selbst.json().error).toBe("SELBSTPRUEFUNG");
    // Ada ist nicht in der Gruppe: kein Peer-Weg …
    const peer = await bewerte(b, b.k.ada, vonCarla, "up", 1);
    expect(peer.json().error).toBe("NICHT_PRUEFBERECHTIGT");
    // … aber die bestehende Admin-Kennzeichnung bleibt der Ausnahmeweg — mit eigenem Beleg.
    const ausnahme = await handle(b, b.k.ada, vonCarla, {
      action: "admin-validate",
      expectedVersion: 1,
    });
    expect(ausnahme.statusCode, ausnahme.body).toBe(200);
    expect(ausnahme.json().status).toBe("validiert");
    expect(await audit(b, "freigaberegel.ausnahme")).toEqual([
      expect.objectContaining({
        actor: b.ids.ada,
        target: vonCarla,
        payload: expect.objectContaining({
          weg: "admin-validate",
          koVersion: 1,
          spaceId: b.spaceId,
          zustimmungen: 0,
          erforderlich: 2,
        }),
      }),
    ]);
    expect((await vorgang(b, vonCarla))?.entscheidungen).toEqual([
      expect.objectContaining({
        art: "admin_kennzeichnung",
        person: b.ids.ada,
        fassung: 1,
        ausnahme: true,
      }),
    ]);
    // Den eigenen Beitrag gibt auch der Administrator nicht selbst frei.
    const vonAda = await beitrag(b, b.k.ada, "Kalibrierschein");
    const eigen = await handle(b, b.k.ada, vonAda, {
      action: "admin-validate",
      expectedVersion: 1,
    });
    expect(eigen.statusCode).toBe(403);
    expect(eigen.json().error).toBe("SELBSTPRUEFUNG");
    expect((await ko(b, vonAda)).status).toBe("offen");
  });
});

describe("ADMIN-09 · K3/K6 · fehlende aktive Prüfer, Frist und Vertretung", () => {
  it("ein verwaister Prüfer bekommt eine Vertretung — sichtbar, einmal, mit genau einer Meldung", async () => {
    const b = await buehne();
    await regelSetzen(b, GRUPPE(b));
    const koId = await beitrag(b, b.k.erik, "Gewindelehre");
    const zuweisen = await handle(b, b.k.carla, koId, { action: "assign", userIds: [b.ids.paul] });
    expect(zuweisen.statusCode, zuweisen.body).toBe(204);
    // Pauls Zugang ist abgelaufen: er ist kein aktiver Prüfer mehr.
    await b.services.auth.setAccessExpiry(b.ids.paul, ABGELAUFEN, b.ids.ada);
    const vorher = await uebersicht(b);
    const ohneWirkung = vorher.voraussetzungen.find((v) => v.art === "pruefer_ohne_wirkung");
    expect(ohneWirkung?.personen).toEqual([
      { id: b.ids.paul, name: "Paul Prüfer", hindernis: "inaktiv" },
    ]);
    expect(vorher.vorgaenge.find((v) => v.id === koId)?.luecken).toContainEqual(
      expect.objectContaining({ art: "aufgabe_ueberfaellig", person: b.ids.paul }),
    );

    // Fristlauf: nicht für Unbeteiligte, nicht für Mitglieder ohne Zuständigkeit.
    const url = `${b.regelUrl}/fristlauf`;
    expect((await schicke(b, b.k.fritz, url, {})).statusCode).toBe(404);
    expect((await schicke(b, b.k.carla, url, {})).statusCode).toBe(403);

    const mails = (b.services.mailer as ConsoleMailer).sent;
    const anUlli = () => mails.filter((m) => m.to === "ulli@admin09.test").length;
    const erster = await schicke(b, b.k.ada, url, {});
    expect(erster.statusCode, erster.body).toBe(200);
    expect(erster.json()).toMatchObject({
      regel: true,
      neu: [{ koId, durch: b.ids.ulli, fuer: b.ids.paul, title: "Gewindelehre" }],
      bestehend: 0,
    });
    expect(anUlli()).toBe(1);
    // Wiederholt: keine zweite Aufgabe, keine zweite Meldung, kein zweiter Beleg.
    expect((await schicke(b, b.k.ada, url, {})).json()).toMatchObject({ neu: [], bestehend: 1 });
    expect(anUlli()).toBe(1);
    expect(await audit(b, "freigaberegel.fristlauf")).toHaveLength(1);
    const vertretungen = (await audit(b, "ko.assigned")).filter(
      (e) => e.target === koId && e.payload.quelle === "vertretung",
    );
    expect(vertretungen).toHaveLength(1);

    // Sichtbar: im Prüfbrett als Ullis Aufgabe und in der Übersicht als Vertretung für Paul.
    const brett = (await lies(b, b.k.ulli, "/api/validation/board")).json() as {
      id: string;
      assignments: string[];
    }[];
    expect(brett.find((z) => z.id === koId)?.assignments).toContain(b.ids.ulli);
    expect((await vorgang(b, koId))?.aufgaben).toContainEqual(
      expect.objectContaining({ person: b.ids.ulli, vertretungFuer: b.ids.paul }),
    );
    // Als Vertretung darf Ulli jetzt prüfen.
    const ulli = await bewerte(b, b.k.ulli, koId, "up", 1);
    expect(ulli.statusCode, ulli.body).toBe(200);
  });

  it("die überfällige Aufgabe eines AKTIVEN Prüfers geht nach Ablauf der Frist an die Vertretung", async () => {
    const b = await buehne();
    await regelSetzen(b, GRUPPE(b, { fristTage: 2 }));
    const koId = await beitrag(b, b.k.erik, "Endmass");
    const zuweisen = await handle(b, b.k.carla, koId, { action: "assign", userIds: [b.ids.paul] });
    expect(zuweisen.statusCode).toBe(204);
    // Heute ist nichts fällig …
    const heute = await schicke(b, b.k.ada, `${b.regelUrl}/fristlauf`, {});
    expect(heute.json()).toMatchObject({ neu: [], faellig: [] });
    // … drei Tage später ist Pauls Aufgabe überfällig: derselbe Dienst mit gestellter Uhr.
    const spaeter = new FreigabeRegelDienst({
      spaces: b.services.spaces,
      teams: b.services.teams,
      auth: b.services.auth,
      ko: b.services.ko,
      validation: b.services.validation,
      audit: b.services.audit,
      jetzt: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    const space = await spaeter.aktuellerSpace(b.spaceId);
    if (!space) {
      throw new Error("Space fehlt");
    }
    const ada = { id: b.ids.ada, role: "admin" as const };
    expect(await spaeter.fristlauf(space, ada, () => true)).toMatchObject({
      neu: [{ koId, durch: b.ids.ulli, fuer: b.ids.paul }],
      faellig: [{ koId, person: b.ids.paul, grund: "ueberfaellig" }],
    });
    expect(await spaeter.fristlauf(space, ada, () => true)).toMatchObject({
      neu: [],
      bestehend: 1,
    });
  });
});
