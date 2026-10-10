// ================================================================================================
// INTERNER CHAT · DER DRAHT — Direkt-, Gruppen-, Space- und Artikelgespräche (interner-chat).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Alle Konten und Inhalte sind erfundene
// Testdaten dieses Falls.
//
//   Lea    (experte)    — Spacezuständige von „Werkstatt Nord" (Zugang: nur Mitglieder)
//   Erik   (experte)    — Mitglied mit Schreibrecht, Autor des Artikels
//   Vera   (viewer)     — Mitglied mit Leserecht
//   Carla  (controller) — legt den Space an
//   Fritz  (experte)    — kein Mitglied
//
// Ordnung zu den Originalkriterien:
//   K1 · Direktnachrichten zwischen zwei Berechtigten; Gruppe, Space- und Artikelgespräch.
//   K2 · Verlauf bleibt beim erneuten Abruf; Wiederholung derselben Sendung dupliziert nicht.
//   K3 · Erwähnung und Artikelrücklink zeigen auf das konkrete Objekt.
//   K4 · Verweis, Ausschnitt und Anhang folgen den Rechten — auch nach späterem Entzug.
//   K5 · Ein Ausschnitt aus Klara ist gekennzeichnet; ohne Artikel nur als fiktiv.
//   K6 · Wissensübernahme: persönlicher Entwurf der übernehmenden Person, passende Stufe.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TITEL = "Spindelschmierung am Bohrwerk";

let zaehler = 0;
function kennung(): string {
  zaehler += 1;
  return `sendung-${zaehler}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@chat.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@chat.test");
  const konten = [
    ["Lea Leitung", "lea@chat.test", "experte"],
    ["Erik Experte", "erik@chat.test", "experte"],
    ["Vera Viewer", "vera@chat.test", "viewer"],
    ["Carla Controller", "carla@chat.test", "controller"],
    ["Fritz Fremd", "fritz@chat.test", "experte"],
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
    lea: await anmelden(app, "lea@chat.test"),
    erik: await anmelden(app, "erik@chat.test"),
    vera: await anmelden(app, "vera@chat.test"),
    carla: await anmelden(app, "carla@chat.test"),
    fritz: await anmelden(app, "fritz@chat.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/chat/konten", headers: k.erik });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    lea: id("Lea Leitung"),
    erik: id("Erik Experte"),
    vera: id("Vera Viewer"),
    carla: id("Carla Controller"),
    fritz: id("Fritz Fremd"),
  };
  for (const wert of Object.values(ids)) {
    expect(wert).not.toBe("");
  }
  return { app, k, ids };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function lies(b: Buehne, kopf: Kopf, url: string) {
  return b.app.inject({ method: "GET", url, headers: kopf });
}

async function gespraech(b: Buehne, kopf: Kopf, payload: Record<string, unknown>) {
  return b.app.inject({ method: "POST", url: "/api/chat/gespraeche", headers: kopf, payload });
}

async function senden(
  b: Buehne,
  kopf: Kopf,
  gespraechId: string,
  payload: Record<string, unknown>,
) {
  return b.app.inject({
    method: "POST",
    url: `/api/chat/gespraeche/${gespraechId}/nachrichten`,
    headers: kopf,
    payload: { sendeKennung: kennung(), ...payload },
  });
}

async function werkstatt(b: Buehne, mitglieder: { nutzer: string; recht: string }[]) {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: b.k.carla,
    payload: {
      name: "Werkstatt Nord",
      zweck: "Bohrwerk und Prüfmittel der Werkstatt Nord.",
      verantwortlich: b.ids.lea,
      zugang: "mitglieder",
      mitglieder,
      ansichten: [],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string; version: number };
}

/** Ein interner Artikel von Erik mit einem Anhang im Object-Store. */
async function artikelMitAnhang(b: Buehne) {
  const up = await b.app.inject({
    method: "POST",
    url: "/api/objects",
    headers: b.k.erik,
    payload: {
      name: "schmierplan.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(up.statusCode, up.body).toBe(201);
  const objectId = up.json().id as string;
  const created = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: b.k.erik,
    payload: {
      confidentiality: "intern",
      title: TITEL,
      statement: "Die Spindel des Bohrwerks wird jede Woche mit Fett der Klasse 2 geschmiert.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;
  const attach = await b.app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: b.k.erik,
    payload: {
      action: "attach",
      attachment: { name: "schmierplan.png", mime: "image/png", objectId },
    },
  });
  expect(attach.statusCode, attach.body).toBe(200);
  const ko = await lies(b, b.k.erik, `/api/kos/${koId}`);
  const anhangId = (ko.json().attachments as { id: string; objectId?: string }[]).find(
    (a) => a.objectId === objectId,
  )?.id;
  expect(anhangId).toBeDefined();
  return { koId, objectId, anhangId: anhangId ?? "", version: ko.json().version as number };
}

async function inSpaceVerschieben(b: Buehne, koId: string, spaceId: string) {
  const v = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: b.k.erik,
    payload: { koId, zielSpaceId: spaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vorschau = v.json();
  const res = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: b.k.erik,
    payload: {
      koId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: vorschau.quelle?.id ?? null,
        quelleVersion: vorschau.quelle?.version ?? null,
        zielId: vorschau.ziel?.id ?? null,
        zielVersion: vorschau.ziel?.version ?? null,
        // Die bestätigte Rechtelage der Vorschau (Spaces-Verwaltung, main): ohne sie 409.
        grundlage: vorschau.grundlage,
      },
    },
  });
  expect(res.statusCode, res.body).toBe(200);
}

describe("K1 · zwei Berechtigte senden und empfangen; Gruppe, Space und Artikel", () => {
  it("Direktnachricht hin und zurück — ein Unbeteiligter sieht das Gespräch nicht", async () => {
    const b = await buehne();
    const neu = await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] });
    expect(neu.statusCode, neu.body).toBe(201);
    const g = neu.json() as { id: string; art: string; sichtbarkeit: string; titel: string };
    expect(g.art).toBe("direkt");
    expect(g.sichtbarkeit).toBe("persoenlich");
    expect(g.titel).toBe("Erik Experte");

    // Dasselbe Paar öffnet dasselbe Gespräch — auch von der anderen Seite.
    const wieder = await gespraech(b, b.k.erik, { art: "direkt", teilnehmer: [b.ids.lea] });
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json().id).toBe(g.id);
    expect(wieder.json().titel).toBe("Lea Leitung");

    const hin = await senden(b, b.k.lea, g.id, { text: "Hallo Erik, ist das Bohrwerk frei?" });
    expect(hin.statusCode, hin.body).toBe(201);
    const bei = await lies(b, b.k.erik, `/api/chat/gespraeche/${g.id}`);
    expect(bei.statusCode, bei.body).toBe(200);
    const empfangen = bei.json().nachrichten as {
      text: string;
      vonName: string;
      eigene: boolean;
    }[];
    expect(empfangen).toHaveLength(1);
    expect(empfangen[0]).toMatchObject({
      text: "Hallo Erik, ist das Bohrwerk frei?",
      vonName: "Lea Leitung",
      eigene: false,
    });

    const zurueck = await senden(b, b.k.erik, g.id, { text: "Ja, ab 14 Uhr." });
    expect(zurueck.statusCode, zurueck.body).toBe(201);
    const beiLea = await lies(b, b.k.lea, `/api/chat/gespraeche/${g.id}`);
    expect((beiLea.json().nachrichten as { text: string }[]).map((n) => n.text)).toEqual([
      "Hallo Erik, ist das Bohrwerk frei?",
      "Ja, ab 14 Uhr.",
    ]);

    // In der Liste beider steht das Gespräch mit der letzten Nachricht.
    const liste = await lies(b, b.k.lea, "/api/chat/gespraeche");
    const zeile = (liste.json().gespraeche as { id: string; letzte: { text: string } }[]).find(
      (x) => x.id === g.id,
    );
    expect(zeile?.letzte.text).toBe("Ja, ab 14 Uhr.");

    // Fritz: weder in der Liste noch per direkter Kennung, und senden kann er auch nicht.
    const fremdListe = await lies(b, b.k.fritz, "/api/chat/gespraeche");
    expect((fremdListe.json().gespraeche as { id: string }[]).map((x) => x.id)).not.toContain(g.id);
    expect((await lies(b, b.k.fritz, `/api/chat/gespraeche/${g.id}`)).statusCode).toBe(404);
    expect((await senden(b, b.k.fritz, g.id, { text: "Darf ich?" })).statusCode).toBe(404);
  });

  it("Gruppe: alle Mitglieder lesen, Außenstehende nicht", async () => {
    const b = await buehne();
    const neu = await gespraech(b, b.k.lea, {
      art: "gruppe",
      titel: "Schicht A",
      teilnehmer: [b.ids.erik, b.ids.vera],
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const g = neu.json() as { id: string; sichtbarkeit: string; titel: string };
    expect(g.sichtbarkeit).toBe("geteilt");
    expect(g.titel).toBe("Schicht A");
    expect((await senden(b, b.k.vera, g.id, { text: "Übergabe um 6 Uhr." })).statusCode).toBe(201);
    for (const kopf of [b.k.lea, b.k.erik, b.k.vera]) {
      const res = await lies(b, kopf, `/api/chat/gespraeche/${g.id}`);
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().nachrichten[0].text).toBe("Übergabe um 6 Uhr.");
    }
    expect((await lies(b, b.k.fritz, `/api/chat/gespraeche/${g.id}`)).statusCode).toBe(404);
  });

  it("Spacegespräch: Mitglieder lesen und schreiben, Nichtmitglieder bekommen 404", async () => {
    const b = await buehne();
    const space = await werkstatt(b, [
      { nutzer: b.ids.erik, recht: "schreiben" },
      { nutzer: b.ids.vera, recht: "lesen" },
    ]);
    const neu = await gespraech(b, b.k.lea, { art: "space", spaceId: space.id });
    expect(neu.statusCode, neu.body).toBe(201);
    const g = neu.json() as { id: string; titel: string; space: { id: string } };
    expect(g.titel).toBe("Werkstatt Nord");
    expect(g.space.id).toBe(space.id);
    // Ein zweiter Aufruf öffnet dasselbe Spacegespräch.
    const wieder = await gespraech(b, b.k.erik, { art: "space", spaceId: space.id });
    expect(wieder.json().id).toBe(g.id);

    expect((await senden(b, b.k.erik, g.id, { text: "Fett nachbestellt." })).statusCode).toBe(201);
    const beiVera = await lies(b, b.k.vera, `/api/chat/gespraeche/${g.id}`);
    expect(beiVera.statusCode, beiVera.body).toBe(200);
    expect(beiVera.json().nachrichten[0].text).toBe("Fett nachbestellt.");

    expect((await gespraech(b, b.k.fritz, { art: "space", spaceId: space.id })).statusCode).toBe(
      404,
    );
    expect((await lies(b, b.k.fritz, `/api/chat/gespraeche/${g.id}`)).statusCode).toBe(404);
  });

  it("Artikelgespräch: wer den Artikel sieht, spricht darüber", async () => {
    const b = await buehne();
    const { koId } = await artikelMitAnhang(b);
    const neu = await gespraech(b, b.k.erik, { art: "artikel", koId });
    expect(neu.statusCode, neu.body).toBe(201);
    const g = neu.json() as { id: string; titel: string };
    expect(g.titel).toBe(TITEL);
    expect((await senden(b, b.k.lea, g.id, { text: "Welche Fettklasse genau?" })).statusCode).toBe(
      201,
    );
    const beiErik = await lies(b, b.k.erik, `/api/chat/gespraeche/${g.id}`);
    expect(beiErik.json().nachrichten[0].text).toBe("Welche Fettklasse genau?");
    // Ein unbekannter Artikel bekommt kein Gespräch.
    expect(
      (await gespraech(b, b.k.erik, { art: "artikel", koId: "gibt-es-nicht" })).statusCode,
    ).toBe(404);
  });
});

describe("K2 · Verlauf bleibt erhalten; eine Wiederholung dupliziert nicht", () => {
  it("dieselbe Sendekennung zweimal: eine Nachricht, zweite Antwort 200 mit neu=false", async () => {
    const b = await buehne();
    const g = (await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] })).json();
    const sendung = { text: "Bitte Ölstand prüfen.", sendeKennung: "wiederholung-0001" };
    const erste = await b.app.inject({
      method: "POST",
      url: `/api/chat/gespraeche/${g.id}/nachrichten`,
      headers: b.k.lea,
      payload: sendung,
    });
    expect(erste.statusCode, erste.body).toBe(201);
    expect(erste.json().neu).toBe(true);
    // Die Antwort ging verloren — der Mensch drückt „Erneut senden".
    const zweite = await b.app.inject({
      method: "POST",
      url: `/api/chat/gespraeche/${g.id}/nachrichten`,
      headers: b.k.lea,
      payload: sendung,
    });
    expect(zweite.statusCode, zweite.body).toBe(200);
    expect(zweite.json().neu).toBe(false);
    expect(zweite.json().nachricht.id).toBe(erste.json().nachricht.id);

    // Eine ANDERE Nachricht unter derselben Kennung wird nicht still verschluckt.
    const anders = await b.app.inject({
      method: "POST",
      url: `/api/chat/gespraeche/${g.id}/nachrichten`,
      headers: b.k.lea,
      payload: { ...sendung, text: "Etwas ganz anderes." },
    });
    expect(anders.statusCode, anders.body).toBe(409);
    expect(anders.json().error).toBe("SENDEKENNUNG_BELEGT");

    // Der erneute Abruf (wie nach einem Neuladen) zeigt genau eine Nachricht.
    const verlauf = await lies(b, b.k.erik, `/api/chat/gespraeche/${g.id}`);
    const texte = (verlauf.json().nachrichten as { text: string }[]).map((n) => n.text);
    expect(texte).toEqual(["Bitte Ölstand prüfen."]);
  });

  it("eine ungültige Sendung wird abgewiesen und legt nichts an", async () => {
    const b = await buehne();
    const g = (await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] })).json();
    const leer = await b.app.inject({
      method: "POST",
      url: `/api/chat/gespraeche/${g.id}/nachrichten`,
      headers: b.k.lea,
      payload: { text: "   ", sendeKennung: "leer-00000001" },
    });
    expect(leer.statusCode).toBe(400);
    const ohneKennung = await b.app.inject({
      method: "POST",
      url: `/api/chat/gespraeche/${g.id}/nachrichten`,
      headers: b.k.lea,
      payload: { text: "Hallo" },
    });
    expect(ohneKennung.statusCode).toBe(400);
    const verlauf = await lies(b, b.k.lea, `/api/chat/gespraeche/${g.id}`);
    expect(verlauf.json().nachrichten).toEqual([]);
  });
});

describe("K3 · Erwähnung und Artikelrücklink führen zum konkreten Objekt", () => {
  it("die Erwähnte findet genau diese Nachricht in genau diesem Gespräch", async () => {
    const b = await buehne();
    const space = await werkstatt(b, [
      { nutzer: b.ids.erik, recht: "schreiben" },
      { nutzer: b.ids.vera, recht: "lesen" },
    ]);
    const g = (await gespraech(b, b.k.erik, { art: "space", spaceId: space.id })).json();
    await senden(b, b.k.erik, g.id, { text: "Vorher eine andere Nachricht." });
    const mit = await senden(b, b.k.erik, g.id, {
      text: "@Vera Viewer bitte den Prüfplan ansehen.",
      erwaehnungen: [b.ids.vera],
    });
    expect(mit.statusCode, mit.body).toBe(201);
    const nachrichtId = mit.json().nachricht.id as string;

    const erwaehnt = await lies(b, b.k.vera, "/api/chat/erwaehnungen");
    expect(erwaehnt.statusCode, erwaehnt.body).toBe(200);
    const liste = erwaehnt.json().erwaehnungen as {
      nachrichtId: string;
      gespraechId: string;
      gespraechTitel: string;
    }[];
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({
      nachrichtId,
      gespraechId: g.id,
      gespraechTitel: "Werkstatt Nord",
    });
    const ziel = await lies(b, b.k.vera, `/api/chat/gespraeche/${liste[0]?.gespraechId}`);
    expect((ziel.json().nachrichten as { id: string }[]).map((n) => n.id)).toContain(nachrichtId);
    // Erik ist nicht erwähnt.
    expect((await lies(b, b.k.erik, "/api/chat/erwaehnungen")).json().erwaehnungen).toEqual([]);

    // Wer das Gespräch nicht lesen darf, kann nicht erwähnt werden.
    const fremd = await senden(b, b.k.erik, g.id, {
      text: "@Fritz Fremd schau mal.",
      erwaehnungen: [b.ids.fritz],
    });
    expect(fremd.statusCode).toBe(400);
    expect(fremd.json().error).toBe("ERWAEHNUNG_OHNE_ZUGANG");
  });

  it("Artikelgespräch und Artikellink nennen genau den Artikel samt Fassung", async () => {
    const b = await buehne();
    const { koId, version } = await artikelMitAnhang(b);
    const g = (await gespraech(b, b.k.lea, { art: "artikel", koId })).json();
    expect(g.artikel).toMatchObject({ koId, titel: TITEL, fassung: version });

    const direkt = (
      await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] })
    ).json();
    const mitLink = await senden(b, b.k.lea, direkt.id, {
      text: `Siehe http://klarwerk.test/wissen/${koId} — passt das noch?`,
    });
    expect(mitLink.statusCode, mitLink.body).toBe(201);
    const bei = await lies(b, b.k.erik, `/api/chat/gespraeche/${direkt.id}`);
    expect(bei.json().nachrichten[0].verweise).toEqual([
      expect.objectContaining({ sichtbar: true, koId, titel: TITEL, fassung: version }),
    ]);
  });
});

describe("K4 · Verweis, Ausschnitt und Anhang folgen den Rechten — auch nach dem Entzug", () => {
  it("nach dem Wechsel in einen geschlossenen Space sieht Fritz weder Titel, Text noch Datei", async () => {
    const b = await buehne();
    const { koId, objectId, anhangId, version } = await artikelMitAnhang(b);
    const space = await werkstatt(b, [{ nutzer: b.ids.erik, recht: "schreiben" }]);
    const neu = await gespraech(b, b.k.erik, { art: "direkt", teilnehmer: [b.ids.fritz] });
    const direkt = neu.json() as { id: string };
    const ausschnitt = "wird jede Woche mit Fett der Klasse 2 geschmiert";
    const res = await senden(b, b.k.erik, direkt.id, {
      text: "Hier die Stelle und der Plan.",
      verweise: [koId],
      anhaenge: [{ koId, anhangId }],
      ausschnitt: { text: ausschnitt, quelle: TITEL, fiktiv: false, koId, fassung: version },
    });
    expect(res.statusCode, res.body).toBe(201);
    const artikelGespraech = (await gespraech(b, b.k.erik, { art: "artikel", koId })).json();

    // Vorher: Fritz darf den internen Artikel sehen — also auch Verweis, Ausschnitt und Anhang.
    const vorher = await lies(b, b.k.fritz, `/api/chat/gespraeche/${direkt.id}`);
    const nVorher = vorher.json().nachrichten[0];
    expect(nVorher.verweise[0]).toMatchObject({ sichtbar: true, koId, titel: TITEL });
    expect(nVorher.ausschnitt).toMatchObject({ sichtbar: true, text: ausschnitt, koId });
    expect(nVorher.anhaenge[0]).toMatchObject({ sichtbar: true, name: "schmierplan.png" });
    expect(nVorher.anhaenge[0].url).toBe(`/api/objects/${objectId}/raw`);
    expect((await lies(b, b.k.fritz, `/api/objects/${objectId}/raw`)).statusCode).toBe(200);
    expect(
      (await lies(b, b.k.fritz, `/api/chat/gespraeche/${artikelGespraech.id}`)).statusCode,
    ).toBe(200);

    // Der Rechteentzug: der Artikel wandert in einen Space, in dem Fritz nicht Mitglied ist.
    await inSpaceVerschieben(b, koId, space.id);

    const nachher = await lies(b, b.k.fritz, `/api/chat/gespraeche/${direkt.id}`);
    expect(nachher.statusCode, nachher.body).toBe(200);
    const nNachher = nachher.json().nachrichten[0];
    expect(nNachher.text).toBe("Hier die Stelle und der Plan.");
    expect(nNachher.verweise).toEqual([{ sichtbar: false }]);
    expect(nNachher.ausschnitt).toEqual({ sichtbar: false });
    expect(nNachher.anhaenge).toEqual([{ sichtbar: false }]);
    // Nichts vom Artikel steht noch irgendwo in der Antwort.
    expect(nachher.body).not.toContain(TITEL);
    expect(nachher.body).not.toContain(ausschnitt);
    expect(nachher.body).not.toContain("schmierplan.png");
    expect(nachher.body).not.toContain(objectId);
    // Die Datei selbst und das Artikelgespräch sind ebenfalls zu.
    expect((await lies(b, b.k.fritz, `/api/objects/${objectId}/raw`)).statusCode).toBe(404);
    expect(
      (await lies(b, b.k.fritz, `/api/chat/gespraeche/${artikelGespraech.id}`)).statusCode,
    ).toBe(404);
    const liste = await lies(b, b.k.fritz, "/api/chat/gespraeche");
    expect((liste.json().gespraeche as { id: string }[]).map((x) => x.id)).not.toContain(
      artikelGespraech.id,
    );

    // Erik (Mitglied) sieht weiterhin alles.
    const beiErik = await lies(b, b.k.erik, `/api/chat/gespraeche/${direkt.id}`);
    expect(beiErik.json().nachrichten[0].verweise[0]).toMatchObject({ sichtbar: true, koId });

    // Und senden lässt sich ein Verweis auf das, was man nicht sieht, gar nicht erst.
    const versuch = await senden(b, b.k.fritz, direkt.id, { text: "Nochmal", verweise: [koId] });
    expect(versuch.statusCode).toBe(400);
    expect(versuch.json().error).toBe("VERWEIS_UNBEKANNT");
  });

  it("wer aus dem Space genommen wird, verliert das Spacegespräch und die Erwähnung darin", async () => {
    const b = await buehne();
    const mitglieder = [
      { nutzer: b.ids.erik, recht: "schreiben" },
      { nutzer: b.ids.vera, recht: "lesen" },
    ];
    const space = await werkstatt(b, mitglieder);
    const g = (await gespraech(b, b.k.erik, { art: "space", spaceId: space.id })).json();
    await senden(b, b.k.erik, g.id, { text: "@Vera Viewer Termin?", erwaehnungen: [b.ids.vera] });
    expect((await lies(b, b.k.vera, `/api/chat/gespraeche/${g.id}`)).statusCode).toBe(200);
    expect((await lies(b, b.k.vera, "/api/chat/erwaehnungen")).json().erwaehnungen).toHaveLength(1);

    const aendern = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${space.id}`,
      headers: b.k.lea,
      payload: {
        version: space.version,
        name: "Werkstatt Nord",
        zweck: "Bohrwerk und Prüfmittel der Werkstatt Nord.",
        verantwortlich: b.ids.lea,
        zugang: "mitglieder",
        mitglieder: [{ nutzer: b.ids.erik, recht: "schreiben" }],
        ansichten: [],
      },
    });
    expect(aendern.statusCode, aendern.body).toBe(200);

    expect((await lies(b, b.k.vera, `/api/chat/gespraeche/${g.id}`)).statusCode).toBe(404);
    expect((await lies(b, b.k.vera, "/api/chat/erwaehnungen")).json().erwaehnungen).toEqual([]);
    const liste = await lies(b, b.k.vera, "/api/chat/gespraeche");
    expect((liste.json().gespraeche as { id: string }[]).map((x) => x.id)).not.toContain(g.id);
  });
});

describe("K5 · Ausschnitt aus Klara: gekennzeichnet, fiktiv nur ausdrücklich", () => {
  it("ein fiktiver Ausschnitt kommt mit Kennzeichen und Rücklink in die Vorschau an", async () => {
    const b = await buehne();
    const g = (await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] })).json();
    const ohneKennzeichen = await senden(b, b.k.lea, g.id, {
      text: "Zur Markierung:",
      ausschnitt: { text: "Die Förderbandrolle läuft auf Lagerböcken.", quelle: "Förderbandrolle" },
    });
    expect(ohneKennzeichen.statusCode).toBe(400);

    const res = await senden(b, b.k.lea, g.id, {
      text: "Zur Markierung aus „Förderbandrolle“:",
      ausKlara: true,
      ausschnitt: {
        text: "Die Förderbandrolle läuft auf Lagerböcken.",
        quelle: "Förderbandrolle",
        fiktiv: true,
        pfad: "/klara-vorschau/artikel/foerderbandrolle",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const bei = await lies(b, b.k.erik, `/api/chat/gespraeche/${g.id}`);
    const n = bei.json().nachrichten[0];
    expect(n.ausKlara).toBe(true);
    expect(n.ausschnitt).toMatchObject({
      sichtbar: true,
      fiktiv: true,
      koId: null,
      pfad: "/klara-vorschau/artikel/foerderbandrolle",
    });

    // Ein fremder Pfad wird nicht zum Rücklink.
    const fremd = await senden(b, b.k.lea, g.id, {
      text: "Noch eine.",
      ausschnitt: { text: "x", quelle: "y", fiktiv: true, pfad: "https://boese.test/" },
    });
    expect(fremd.statusCode, fremd.body).toBe(201);
    expect(fremd.json().nachricht.ausschnitt.pfad).toBeNull();
  });
});

describe("K6 · Wissensübernahme: verantwortlicher, persönlicher Entwurf in passender Stufe", () => {
  it("aus einer persönlichen Nachricht entsteht Eriks eigener, vertraulicher Entwurf — einmal", async () => {
    const b = await buehne();
    const g = (await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] })).json();
    const n = (
      await senden(b, b.k.lea, g.id, {
        text: "Spindel nur mit Fett Klasse 2 schmieren.\nNie mit Öl.",
      })
    ).json().nachricht;

    const erste = await b.app.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${n.id}/wissen`,
      headers: b.k.erik,
    });
    expect(erste.statusCode, erste.body).toBe(201);
    expect(erste.json()).toMatchObject({ neu: true, herkunft: "persoenlich" });
    const entwurfId = erste.json().entwurfId as string;

    const zweite = await b.app.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${n.id}/wissen`,
      headers: b.k.erik,
    });
    expect(zweite.statusCode, zweite.body).toBe(200);
    expect(zweite.json().entwurfId).toBe(entwurfId);

    const entwuerfe = await lies(b, b.k.erik, "/api/drafts");
    expect(entwuerfe.statusCode, entwuerfe.body).toBe(200);
    const meine = entwuerfe.json() as {
      id: string;
      originalAuthor: string;
      payload: { title?: string; confidentiality?: string; tags?: string[]; bodyHtml?: string };
    }[];
    const entwurf = meine.find((d) => d.id === entwurfId);
    expect(entwurf, "der Entwurf steht in Eriks Entwürfen").toBeDefined();
    expect(entwurf?.originalAuthor).toBe(b.ids.erik);
    expect(entwurf?.payload.title).toBe("Spindel nur mit Fett Klasse 2 schmieren.");
    expect(entwurf?.payload.confidentiality).toBe("vertraulich");
    expect(entwurf?.payload.tags).toContain("chat");
    expect(entwurf?.payload.bodyHtml).toContain("persönliche Nachricht von Lea Leitung");
    expect(meine.filter((d) => d.payload.tags?.includes("chat"))).toHaveLength(1);

    // Persönlich bleibt persönlich: Lea sieht weder den Entwurf noch Eriks Übernahmevermerk.
    const beiLea = await lies(b, b.k.lea, "/api/drafts");
    expect((beiLea.json() as { id: string }[]).map((d) => d.id)).not.toContain(entwurfId);
    const verlaufLea = await lies(b, b.k.lea, `/api/chat/gespraeche/${g.id}`);
    expect(verlaufLea.json().nachrichten[0].eigeneUebernahme).toBeNull();
    const verlaufErik = await lies(b, b.k.erik, `/api/chat/gespraeche/${g.id}`);
    expect(verlaufErik.json().nachrichten[0].eigeneUebernahme).toMatchObject({ entwurfId });
  });

  it("aus einem offenen Spacegespräch: geteilte Herkunft, Stufe intern; Betrachter darf nicht", async () => {
    const b = await buehne();
    const offen = await b.app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: b.k.carla,
      payload: {
        name: "Qualität",
        zweck: "Hausweite Sicht auf Prüfmittel.",
        verantwortlich: b.ids.carla,
        zugang: "alle",
        mitglieder: [],
        ansichten: [],
      },
    });
    expect(offen.statusCode, offen.body).toBe(201);
    const g = (await gespraech(b, b.k.lea, { art: "space", spaceId: offen.json().id })).json();
    const n = (
      await senden(b, b.k.lea, g.id, { text: "Messschieber jährlich kalibrieren." })
    ).json().nachricht;
    const res = await b.app.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${n.id}/wissen`,
      headers: b.k.erik,
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().herkunft).toBe("geteilt");
    const entwurf = (
      (await lies(b, b.k.erik, "/api/drafts")).json() as {
        id: string;
        payload: { confidentiality?: string };
      }[]
    ).find((d) => d.id === res.json().entwurfId);
    expect(entwurf?.payload.confidentiality).toBe("intern");

    const betrachter = await b.app.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${n.id}/wissen`,
      headers: b.k.vera,
    });
    expect(betrachter.statusCode).toBe(403);
    // Eine Nachricht aus einem Gespräch, das man nicht lesen darf, gibt es nicht.
    const direkt = (
      await gespraech(b, b.k.lea, { art: "direkt", teilnehmer: [b.ids.erik] })
    ).json();
    const privat = (await senden(b, b.k.lea, direkt.id, { text: "Nur für Erik." })).json()
      .nachricht;
    const fremd = await b.app.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${privat.id}/wissen`,
      headers: b.k.fritz,
    });
    expect(fremd.statusCode).toBe(404);
  });
});

// ================================================================================================
// NACHARBEIT 3 (Ben, K2/K3) — mehr als 500 neuere Nachrichten: der ältere Verlauf bleibt erreichbar,
// die Zielnachricht einer Erwähnung lässt sich eigens öffnen, und beides folgt dem Rechteentzug.
// ================================================================================================
describe("K2/K3 · Verlauf über 500 Nachrichten hinaus und Zielnachricht einer alten Erwähnung", () => {
  it("ältere Seite lückenlos nachladbar, Zielnachricht eigens abrufbar — nach Entzug 404", async () => {
    const b = await buehne();
    const space = await werkstatt(b, [
      { nutzer: b.ids.erik, recht: "schreiben" },
      { nutzer: b.ids.vera, recht: "lesen" },
    ]);
    const g = (await gespraech(b, b.k.erik, { art: "space", spaceId: space.id })).json();
    const erste = await senden(b, b.k.erik, g.id, { text: "Ganz am Anfang." });
    expect(erste.statusCode, erste.body).toBe(201);
    await new Promise((fertig) => setTimeout(fertig, 5));
    const mit = await senden(b, b.k.erik, g.id, {
      text: "@Vera Viewer bitte den alten Prüfplan ansehen.",
      erwaehnungen: [b.ids.vera],
    });
    expect(mit.statusCode, mit.body).toBe(201);
    const erwaehnteId = mit.json().nachricht.id as string;
    // Eine eigene Millisekunde, damit die Erwähnung eindeutig älter ist als alles Folgende.
    await new Promise((fertig) => setTimeout(fertig, 5));
    const NEUERE = 505;
    for (let i = 0; i < NEUERE; i += 1) {
      const res = await senden(b, b.k.erik, g.id, { text: `Laufende Meldung ${i}` });
      expect(res.statusCode).toBe(201);
    }

    // Erste Seite: die jüngsten 500, ohne die Erwähnung — und der Hinweis, dass es Älteres gibt.
    const seite1 = await lies(b, b.k.vera, `/api/chat/gespraeche/${g.id}`);
    expect(seite1.statusCode, seite1.body).toBe(200);
    const n1 = seite1.json().nachrichten as { id: string; text: string }[];
    expect(n1).toHaveLength(500);
    expect(seite1.json().aelterVorhanden).toBe(true);
    expect(n1.map((n) => n.id)).not.toContain(erwaehnteId);
    const aeltesteId = n1[0]?.id ?? "";

    // Zweite Seite: alles davor, lückenlos und ohne Doppel; danach gibt es nichts Älteres mehr.
    const seite2 = await lies(b, b.k.vera, `/api/chat/gespraeche/${g.id}?vor=${aeltesteId}`);
    expect(seite2.statusCode, seite2.body).toBe(200);
    const n2 = seite2.json().nachrichten as { id: string; text: string }[];
    expect(seite2.json().aelterVorhanden).toBe(false);
    const alle = [...n2, ...n1].map((n) => n.id);
    expect(new Set(alle).size).toBe(alle.length);
    expect(alle).toHaveLength(NEUERE + 2);
    expect(n2.map((n) => n.text).slice(0, 2)).toEqual([
      "Ganz am Anfang.",
      "@Vera Viewer bitte den alten Prüfplan ansehen.",
    ]);

    // Die Erwähnung steht in Veras Liste, und ihr Ziel ist unabhängig vom Verlauf abrufbar.
    const erwaehnt = await lies(b, b.k.vera, "/api/chat/erwaehnungen");
    expect(erwaehnt.json().erwaehnungen).toEqual([
      expect.objectContaining({ nachrichtId: erwaehnteId, gespraechId: g.id }),
    ]);
    const ziel = await lies(b, b.k.vera, `/api/chat/nachrichten/${erwaehnteId}`);
    expect(ziel.statusCode, ziel.body).toBe(200);
    expect(ziel.json().nachricht).toMatchObject({
      id: erwaehnteId,
      gespraechId: g.id,
      text: "@Vera Viewer bitte den alten Prüfplan ansehen.",
    });
    expect(ziel.json().gespraech.id).toBe(g.id);

    // Ein Nichtmitglied bekommt weder Ziel noch ältere Seite.
    const zielFremd = await lies(b, b.k.fritz, `/api/chat/nachrichten/${erwaehnteId}`);
    expect(zielFremd.statusCode).toBe(404);
    const seiteFremd = await lies(b, b.k.fritz, `/api/chat/gespraeche/${g.id}?vor=${aeltesteId}`);
    expect(seiteFremd.statusCode).toBe(404);
    // Ein Anker aus einem anderen Gespräch wird nicht angenommen.
    const neu = await gespraech(b, b.k.erik, { art: "direkt", teilnehmer: [b.ids.vera] });
    const anderes = neu.json() as { id: string };
    const fremd = await lies(b, b.k.vera, `/api/chat/gespraeche/${anderes.id}?vor=${erwaehnteId}`);
    expect(fremd.statusCode).toBe(404);

    // Rechteentzug: Vera wird aus dem Space genommen — Ziel, ältere Seite und Erwähnung sind weg.
    const aendern = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${space.id}`,
      headers: b.k.lea,
      payload: {
        version: space.version,
        name: "Werkstatt Nord",
        zweck: "Bohrwerk und Prüfmittel der Werkstatt Nord.",
        verantwortlich: b.ids.lea,
        zugang: "mitglieder",
        mitglieder: [{ nutzer: b.ids.erik, recht: "schreiben" }],
        ansichten: [],
      },
    });
    expect(aendern.statusCode, aendern.body).toBe(200);
    const zielNachher = await lies(b, b.k.vera, `/api/chat/nachrichten/${erwaehnteId}`);
    expect(zielNachher.statusCode).toBe(404);
    const seiteNachher = await lies(b, b.k.vera, `/api/chat/gespraeche/${g.id}?vor=${aeltesteId}`);
    expect(seiteNachher.statusCode).toBe(404);
    expect((await lies(b, b.k.vera, "/api/chat/erwaehnungen")).json().erwaehnungen).toEqual([]);
    // Erik (Mitglied) erreicht beides weiterhin.
    const zielErik = await lies(b, b.k.erik, `/api/chat/nachrichten/${erwaehnteId}`);
    expect(zielErik.statusCode).toBe(200);
  }, 180_000);
});
