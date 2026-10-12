// ================================================================================================
// KLARA 06 (produkt:20261007:klara-notizen-aufgaben) · PRIVATE NOTIZEN AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`,
// `app.inject`). Jeder Schritt geht über HTTP. „Erneute Anmeldung" ist eine neue Sitzung über
// `POST /api/auth/login`; dass eine Notiz auch einen Neustart der Datenbankablage übersteht, misst
// `notiz-pg.integration.test.ts`.
//
//   N1  (K1) Geschrieben, diktiert, aus dem Gespräch, aus dem Ausschnitt: gespeichert und nach
//            erneuter Anmeldung mit identischem Inhalt und Rücklink wieder geöffnet.
//   N2  (K2) Bearbeiten mit Fassung, Wiederfinden über die Suche, offene Fragen als Arbeitszettel.
//   N3  (K3) Andere Personen (auch Administratoren) und die Suche im Wissensbestand sehen weder
//            Notizen noch Gespräche; das Prüfprotokoll trägt keinen Inhalt.
//   N4  (K4) Eine scheiternde Ablage antwortet sichtbar mit Fehler; die Wiederholung desselben
//            Vorgangs legt keine zweite Notiz an — auch nicht, wenn der erste Versuch ankam.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { InMemoryKlaraNotizRepo, type KlaraNotiz } from "../../services/app/src/klara-notiz";
import {
  KLARA_NOTIZ_ANGELEGT,
  KLARA_NOTIZ_GEAENDERT,
  KLARA_NOTIZ_GELOESCHT,
} from "../../services/app/src/routes/klara-notiz-routes";

type App = ReturnType<typeof buildApp>;
type Sicht = Omit<KlaraNotiz, "kontoId">;

const BASIS = "/api/me/klara/notizen";
const KENNWORT = "secret123";
/** Unverwechselbare Messmarken — ein Treffer kann aus nichts anderem stammen. */
const NOTIZWORT = "Zirbelkiefer";
const GESPRAECHSWORT = "Lindenblatt";
const KO_WORT = "Ahornsirup";

/** Ein Wissensobjekt-Absatz als Rücklink — Objekt, Fassung, Absatz und Markierung von damals. */
const BEZUG_ARTIKEL = {
  pfad: "/wissen/ko-presse-4",
  seitenName: "Lesen",
  objekt: "Ölwechsel Presse 4",
  koId: "ko-presse-4",
  fassung: 3,
  absatz: 2,
  modus: "lesen",
  pruefstatus: "geprueft",
};
const BEZUG_SEITE = { pfad: "/erfassen", seitenName: "Erfassung", objekt: "Neuer Entwurf" };

let services: AppServices;
let notizRepo: StoerbaresRepo;
let app: App;
let ada = { id: "", token: "", email: "" };
let erik = { id: "", token: "", email: "" };
let vera = { id: "", token: "", email: "" };

/**
 * Die echte In-Memory-Ablage, die auf Kommando scheitert: `vorher` wirft, BEVOR geschrieben wird
 * (Datenbank nicht erreichbar); `nachher` wirft, NACHDEM geschrieben wurde (die Antwort geht
 * verloren — der gefährliche Fall für Doppelnotizen).
 */
class StoerbaresRepo extends InMemoryKlaraNotizRepo {
  stoerung: "keine" | "vorher" | "nachher" = "keine";

  override async lege(n: KlaraNotiz): Promise<boolean> {
    const s = this.stoerung;
    this.stoerung = "keine";
    if (s === "vorher") {
      throw new Error("Datenbank nicht erreichbar");
    }
    const ok = await super.lege(n);
    if (s === "nachher") {
      throw new Error("Verbindung nach dem Schreiben abgerissen");
    }
    return ok;
  }
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: KENNWORT, role: rolle },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email), email };
}

const auf = (
  wer: string,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

let vorgaenge = 0;
function vorgang(): string {
  vorgaenge += 1;
  return `test-vorgang-${String(vorgaenge).padStart(4, "0")}`;
}

async function lege(wer: string, rumpf: Record<string, unknown>): Promise<Sicht> {
  const r = await auf(wer, "POST", BASIS, { vorgang: vorgang(), ...rumpf });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { notiz: Sicht }).notiz;
}

async function oeffne(wer: string, id: string): Promise<Sicht> {
  const r = await auf(wer, "GET", `${BASIS}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { notiz: Sicht }).notiz;
}

async function liste(wer: string, q = ""): Promise<Sicht[]> {
  const r = await auf(wer, "GET", q ? `${BASIS}?q=${encodeURIComponent(q)}` : BASIS);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { notizen: Sicht[] }).notizen;
}

async function anzahlImRepo(kontoId: string): Promise<number> {
  return notizRepo.anzahl(kontoId);
}

beforeEach(async () => {
  notizRepo = new StoerbaresRepo();
  services = assembleServices(inMemoryRepos(), { klaraNotizen: notizRepo });
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@klara-notizen.test", password: KENNWORT },
  });
  const adminToken = await anmelden("ada@klara-notizen.test");
  ada = { id: "", token: adminToken, email: "ada@klara-notizen.test" };
  erik = await konto(adminToken, "experte", "erik@klara-notizen.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@klara-notizen.test", "Vera Viewer");
});

describe("N1 · K1 — gespeichert und nach erneuter Anmeldung identisch mit Rücklink geöffnet", () => {
  it("eine geschriebene und eine diktierte Notiz: gleicher Inhalt, gleicher Rücklink, neue Sitzung", async () => {
    const inhalt = "Ölwechsel erst nach dem Abkühlen.\nZweite Zeile mit  doppeltem Leerraum. ";
    const geschrieben = await lege(erik.token, {
      weg: "geschrieben",
      inhalt,
      objektbezug: BEZUG_ARTIKEL,
    });
    const diktiert = await lege(erik.token, {
      weg: "diktiert",
      inhalt: "Filter für Presse vier nachbestellen",
      objektbezug: BEZUG_SEITE,
    });
    expect(geschrieben).toMatchObject({ weg: "geschrieben", art: "notiz", fassung: 1, inhalt });
    expect(diktiert.weg).toBe("diktiert");
    // Ohne Titel trägt die Notiz den Anfang ihrer ersten Zeile — nicht erfunden.
    expect(geschrieben.titel).toBe("Ölwechsel erst nach dem Abkühlen.");
    // Die Kontokennung geht nicht hinaus.
    expect(JSON.stringify(geschrieben)).not.toContain(erik.id);

    // Erneute Anmeldung: eine NEUE Sitzung, dieselben Notizen — Wort für Wort, Rücklink für Rücklink.
    const neu = await anmelden(erik.email);
    expect(neu).not.toBe(erik.token);
    const wieder = await oeffne(neu, geschrieben.id);
    expect(wieder).toEqual(geschrieben);
    expect(wieder.inhalt).toBe(inhalt);
    expect(wieder.objektbezug).toEqual(BEZUG_ARTIKEL);
    expect((await oeffne(neu, diktiert.id)).objektbezug).toEqual(BEZUG_SEITE);
    expect((await liste(neu)).map((n) => n.id).sort()).toEqual(
      [geschrieben.id, diktiert.id].sort(),
    );
  });

  it("aus dem Gespräch: der Server übernimmt Wortlaut und Ort der EIGENEN Nachricht", async () => {
    const g = await auf(erik.token, "POST", "/api/me/klara/gespraeche", {
      objektbezug: BEZUG_SEITE,
    });
    expect(g.statusCode, g.body).toBe(201);
    const gespraechId = (g.json() as { gespraech: { id: string } }).gespraech.id;
    const nachrichten = `/api/me/klara/gespraeche/${gespraechId}/nachrichten`;
    const n = await auf(erik.token, "POST", nachrichten, {
      von: "klara",
      modus: "hilfetext",
      text: `Diese Seite erfasst Wissen. ${GESPRAECHSWORT}`,
      objektbezug: BEZUG_ARTIKEL,
    });
    expect(n.statusCode, n.body).toBe(201);
    const nachrichtId = (n.json() as { nachricht: { id: string } }).nachricht.id;

    const notiz = await lege(erik.token, {
      weg: "gespraech",
      quelle: { gespraechId, nachrichtId },
    });
    expect(notiz.inhalt).toBe(`Diese Seite erfasst Wissen. ${GESPRAECHSWORT}`);
    expect(notiz.objektbezug).toEqual(BEZUG_ARTIKEL);
    expect(notiz.quelle).toEqual({ gespraechId, nachrichtId });
    const neu = await anmelden(erik.email);
    expect(await oeffne(neu, notiz.id)).toEqual(notiz);

    // Ein eigener Wortlaut neben der Quelle wäre eine erfundene Gesprächsnotiz.
    const mitText = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      weg: "gespraech",
      quelle: { gespraechId, nachrichtId },
      inhalt: "anderer Text",
    });
    expect(mitText.statusCode).toBe(400);
    // Fremdes Gespräch: Vera kann Eriks Nachricht nicht zur eigenen Notiz machen.
    const fremd = await auf(vera.token, "POST", BASIS, {
      vorgang: vorgang(),
      weg: "gespraech",
      quelle: { gespraechId, nachrichtId },
    });
    expect(fremd.statusCode).toBe(404);
    expect(fremd.json()).toMatchObject({ grund: "quelle_unbekannt" });
    expect(await anzahlImRepo(vera.id)).toBe(0);
  });

  it("aus dem markierten Ausschnitt: Bezug Markierung mit Anfang der Stelle als Rücklink", async () => {
    const markierung = {
      ...BEZUG_ARTIKEL,
      bezug: "markierung",
      auswahl: "Den Ölstand nur bei stehender Presse prüfen.",
    };
    const notiz = await lege(erik.token, {
      weg: "ausschnitt",
      inhalt: "Ölstand nur bei Stillstand prüfen — gilt auch für Presse 5?",
      objektbezug: markierung,
    });
    const neu = await anmelden(erik.email);
    const wieder = await oeffne(neu, notiz.id);
    expect(wieder.objektbezug).toEqual(markierung);
    expect(wieder.weg).toBe("ausschnitt");
    // Ein Ausschnitt ohne Markierung ist keiner.
    const ohne = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      weg: "ausschnitt",
      inhalt: "x",
      objektbezug: BEZUG_ARTIKEL,
    });
    expect(ohne.statusCode).toBe(400);
  });

  it("ungültige Eingaben legen nichts an: kein Vorgang, kein Inhalt, fremde Adresse als Rücklink", async () => {
    const ohneVorgang = { weg: "geschrieben", inhalt: "a", objektbezug: BEZUG_SEITE };
    const versuche = await Promise.all([
      auf(erik.token, "POST", BASIS, ohneVorgang),
      auf(erik.token, "POST", BASIS, {
        vorgang: vorgang(),
        weg: "geschrieben",
        inhalt: "   ",
        objektbezug: BEZUG_SEITE,
      }),
      auf(erik.token, "POST", BASIS, {
        vorgang: vorgang(),
        weg: "geschrieben",
        inhalt: "a",
        objektbezug: { ...BEZUG_SEITE, pfad: "//boese.example/x" },
      }),
    ]);
    expect(versuche.map((v) => v.statusCode)).toEqual([400, 400, 400]);
    expect(await anzahlImRepo(erik.id)).toBe(0);
  });
});

describe("N2 · K2 — bearbeiten, wiederfinden, offene Fragen als Arbeitszettel", () => {
  it("Bearbeiten mit Fassung; Rücklink bleibt; Suche findet Inhalt, Titel und offene Fragen", async () => {
    const notiz = await lege(erik.token, {
      weg: "geschrieben",
      inhalt: "Dichtung prüfen",
      objektbezug: BEZUG_ARTIKEL,
    });
    const r = await auf(erik.token, "PUT", `${BASIS}/${notiz.id}`, {
      fassung: 1,
      titel: "Dichtung Presse 4",
      inhalt: `Dichtung prüfen, ${NOTIZWORT} als Merkwort`,
      offeneFragen: ["Wer liefert die Dichtung?", "  ", "Wann ist Stillstand?"],
      art: "arbeitszettel",
    });
    expect(r.statusCode, r.body).toBe(200);
    const geaendert = (r.json() as { notiz: Sicht; wiederholt: boolean }).notiz;
    expect(geaendert).toMatchObject({
      fassung: 2,
      titel: "Dichtung Presse 4",
      art: "arbeitszettel",
      offeneFragen: ["Wer liefert die Dichtung?", "Wann ist Stillstand?"],
      objektbezug: BEZUG_ARTIKEL,
      angelegtAm: notiz.angelegtAm,
    });

    // Wiederfinden: über ein Wort des Inhalts, des Titels, einer offenen Frage, des Ortes —
    // gross/klein egal, mehrere Wörter UND-verknüpft.
    const neu = await anmelden(erik.email);
    for (const q of [NOTIZWORT.toLowerCase(), "presse 4", "liefert", "Stillstand Dichtung"]) {
      expect(
        (await liste(neu, q)).map((n) => n.id),
        q,
      ).toEqual([notiz.id]);
    }
    expect(await liste(neu, "Dichtung Getriebe")).toEqual([]);
    // Ein Platzhalterzeichen ist ein Zeichen, kein Joker.
    expect(await liste(neu, "%")).toEqual([]);
    // Der Arbeitszettel bleibt nach erneuter Anmeldung mit seinen Fragen erhalten.
    const wieder = await oeffne(neu, notiz.id);
    expect(wieder.offeneFragen).toEqual(["Wer liefert die Dichtung?", "Wann ist Stillstand?"]);
    expect(wieder.art).toBe("arbeitszettel");
    const nurZettel = await auf(neu, "GET", `${BASIS}?art=arbeitszettel`);
    expect((nurZettel.json() as { notizen: Sicht[] }).notizen.map((n) => n.id)).toEqual([notiz.id]);
  });

  it("mit offenen Fragen angelegt ist die Notiz ein Arbeitszettel; zuletzt geänderte zuerst", async () => {
    const zettel = await lege(erik.token, {
      weg: "geschrieben",
      inhalt: "Fragen zur Schicht",
      offeneFragen: ["Wer übernimmt Montag?"],
      objektbezug: BEZUG_SEITE,
    });
    expect(zettel.art).toBe("arbeitszettel");
    const zweite = await lege(erik.token, {
      weg: "geschrieben",
      inhalt: "Zweite",
      objektbezug: BEZUG_SEITE,
    });
    expect((await liste(erik.token)).map((n) => n.id)).toEqual([zweite.id, zettel.id]);
    const ergaenzt = { fassung: 1, inhalt: "Fragen, ergänzt" };
    expect((await auf(erik.token, "PUT", `${BASIS}/${zettel.id}`, ergaenzt)).statusCode).toBe(200);
    expect((await liste(erik.token)).map((n) => n.id)).toEqual([zettel.id, zweite.id]);
  });

  it("veraltete Fassung: 409, nichts überschrieben; dieselbe Änderung nochmal: keine dritte Fassung", async () => {
    const notiz = await lege(erik.token, {
      weg: "geschrieben",
      inhalt: "Erste Fassung",
      objektbezug: BEZUG_SEITE,
    });
    const aenderung = { fassung: 1, inhalt: "Aus Tab A" };
    expect((await auf(erik.token, "PUT", `${BASIS}/${notiz.id}`, aenderung)).statusCode).toBe(200);
    // Die Antwort ging verloren, der Browser schickt dieselbe Änderung noch einmal.
    const nochmal = await auf(erik.token, "PUT", `${BASIS}/${notiz.id}`, aenderung);
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect(nochmal.json()).toMatchObject({ wiederholt: true, notiz: { fassung: 2 } });
    // Ein zweiter Tab mit der alten Fassung und anderem Inhalt überschreibt nicht still.
    const tabB = await auf(erik.token, "PUT", `${BASIS}/${notiz.id}`, {
      fassung: 1,
      inhalt: "Aus Tab B",
    });
    expect(tabB.statusCode).toBe(409);
    expect(tabB.json()).toMatchObject({ grund: "konflikt" });
    expect(await oeffne(erik.token, notiz.id)).toMatchObject({ fassung: 2, inhalt: "Aus Tab A" });
  });
});

describe("N3 · K3 — andere Personen und die Suche im Wissen sehen Notizen und Gespräche nicht", () => {
  it("fremd und unbekannt antworten gleich; auch die Verwaltung liest, ändert, löscht nichts", async () => {
    const notiz = await lege(erik.token, {
      weg: "geschrieben",
      inhalt: `Persönlich: ${NOTIZWORT}`,
      objektbezug: BEZUG_ARTIKEL,
    });
    for (const fremd of [vera, ada]) {
      expect(await liste(fremd.token)).toEqual([]);
      expect(await liste(fremd.token, NOTIZWORT)).toEqual([]);
      const lesen = await auf(fremd.token, "GET", `${BASIS}/${notiz.id}`);
      const unbekannt = await auf(fremd.token, "GET", `${BASIS}/gibt-es-nicht`);
      expect([lesen.statusCode, unbekannt.statusCode]).toEqual([404, 404]);
      expect(lesen.body).toBe(unbekannt.body);
      const aendern = await auf(fremd.token, "PUT", `${BASIS}/${notiz.id}`, {
        fassung: 1,
        inhalt: "übernommen",
      });
      expect(aendern.statusCode).toBe(404);
      expect((await auf(fremd.token, "DELETE", `${BASIS}/${notiz.id}`)).statusCode).toBe(404);
    }
    // Die Notiz der Person ist unverändert da.
    expect(await oeffne(erik.token, notiz.id)).toEqual(notiz);
  });

  it("weder Bibliothekssuche noch Space-Artikel führen Notiz oder Gespräch — die Suche selbst findet", async () => {
    // Notiz und Gespräch der Verwaltung selbst — der Mensch mit den weitesten Rechten.
    await lege(ada.token, {
      weg: "geschrieben",
      inhalt: `Privat: ${NOTIZWORT} am Lager`,
      titel: `${NOTIZWORT} Titel`,
      objektbezug: BEZUG_SEITE,
    });
    const beginn = { objektbezug: BEZUG_SEITE };
    const g = await auf(ada.token, "POST", "/api/me/klara/gespraeche", beginn);
    const gespraechId = (g.json() as { gespraech: { id: string } }).gespraech.id;
    const nachrichten = `/api/me/klara/gespraeche/${gespraechId}/nachrichten`;
    const hilfe = await auf(ada.token, "POST", nachrichten, {
      von: "du",
      modus: "hilfe",
      text: `Was ist ${GESPRAECHSWORT}?`,
      objektbezug: BEZUG_SEITE,
    });
    expect(hilfe.statusCode, hilfe.body).toBe(201);
    // KALIBRIERUNG: ein echtes Wissensobjekt mit eigenem Wort wird von derselben Suche gefunden.
    const ko = await auf(ada.token, "POST", "/api/kos", {
      confidentiality: "intern",
      title: `${KO_WORT} Wartung`,
      statement: `Wissen zum ${KO_WORT} im Lager.`,
      type: "best_practice",
      category: "Lager",
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const koId = (ko.json() as { id: string }).id;
    const kalibrierung = await auf(ada.token, "GET", `/api/library/search?q=${KO_WORT}`);
    expect(kalibrierung.statusCode, kalibrierung.body).toBe(200);
    expect((kalibrierung.json() as { id: string }[]).map((t) => t.id)).toContain(koId);

    for (const wer of [ada, erik, vera]) {
      for (const wort of [NOTIZWORT, GESPRAECHSWORT]) {
        const suche = await auf(wer.token, "GET", `/api/library/search?q=${wort}`);
        expect(suche.statusCode, suche.body).toBe(200);
        expect(suche.json(), `${wer.email} · ${wort}`).toEqual([]);
        expect(suche.body).not.toContain(wort);
      }
      const spaces = await auf(wer.token, "GET", "/api/spaces/artikel?kontext=firma");
      if (spaces.statusCode === 200) {
        expect(spaces.body).not.toContain(NOTIZWORT);
        expect(spaces.body).not.toContain(GESPRAECHSWORT);
      }
    }
    // Und die Person selbst findet ihre Notiz in IHRER Notizsuche.
    expect((await liste(ada.token, NOTIZWORT)).length).toBe(1);
  });

  it("das Prüfprotokoll trägt Ereignisse mit Kennung, Weg und Art — nie Titel, Inhalt oder Ort", async () => {
    const notiz = await lege(erik.token, {
      weg: "diktiert",
      inhalt: `Geheim: ${NOTIZWORT}`,
      offeneFragen: ["Geheime Frage?"],
      objektbezug: BEZUG_ARTIKEL,
    });
    await auf(erik.token, "PUT", `${BASIS}/${notiz.id}`, { fassung: 1, titel: "Geheimer Titel" });
    await auf(erik.token, "DELETE", `${BASIS}/${notiz.id}`);
    const ereignisse = [
      ...(await services.audit.list({ action: KLARA_NOTIZ_ANGELEGT })),
      ...(await services.audit.list({ action: KLARA_NOTIZ_GEAENDERT })),
      ...(await services.audit.list({ action: KLARA_NOTIZ_GELOESCHT })),
    ];
    expect(ereignisse).toHaveLength(3);
    for (const e of ereignisse) {
      expect(e.actor).toBe(erik.id);
      expect(e.target).toBe(`klara-notiz:${notiz.id}`);
    }
    expect(ereignisse[0]?.payload).toEqual({ weg: "diktiert", art: "arbeitszettel" });
    const protokoll = JSON.stringify(ereignisse);
    for (const inhalt of [NOTIZWORT, "Geheime Frage", "Geheimer Titel", "Ölwechsel", "/wissen/"]) {
      expect(protokoll).not.toContain(inhalt);
    }
    expect(await anzahlImRepo(erik.id)).toBe(0);
  });

  it("ohne Anmeldung ist jede der fünf Türen zu", async () => {
    const versuche = await Promise.all([
      auf("", "GET", BASIS),
      auf("", "POST", BASIS, { vorgang: vorgang(), weg: "geschrieben", inhalt: "x" }),
      auf("", "GET", `${BASIS}/x`),
      auf("", "PUT", `${BASIS}/x`, { fassung: 1 }),
      auf("", "DELETE", `${BASIS}/x`),
    ]);
    expect(versuche.map((v) => v.statusCode)).toEqual([401, 401, 401, 401, 401]);
  });
});

describe("N4 · K4 — fehlgeschlagene Speicherung ist sichtbar; Wiederholung ohne Doppelnotiz", () => {
  const rumpf = {
    weg: "geschrieben",
    inhalt: "Notiz, die beim ersten Mal scheitert",
    objektbezug: BEZUG_ARTIKEL,
  };

  it("Ablage nicht erreichbar: Fehlerantwort, nichts gespeichert; die Wiederholung legt genau eine an", async () => {
    const v = vorgang();
    notizRepo.stoerung = "vorher";
    const erster = await auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf });
    expect(erster.statusCode).toBeGreaterThanOrEqual(500);
    expect(await anzahlImRepo(erik.id)).toBe(0);
    const zweiter = await auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf });
    expect(zweiter.statusCode, zweiter.body).toBe(201);
    const dritter = await auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf });
    expect(dritter.statusCode).toBe(200);
    expect(dritter.json()).toMatchObject({ wiederholt: true });
    expect((dritter.json() as { notiz: Sicht }).notiz.id).toBe(
      (zweiter.json() as { notiz: Sicht }).notiz.id,
    );
    expect(await anzahlImRepo(erik.id)).toBe(1);
  });

  it("die Antwort ging verloren, obwohl gespeichert war: die Wiederholung liefert DIESELBE Notiz", async () => {
    const v = vorgang();
    notizRepo.stoerung = "nachher";
    const erster = await auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf });
    expect(erster.statusCode).toBeGreaterThanOrEqual(500);
    expect(await anzahlImRepo(erik.id)).toBe(1);
    const wiederholung = await auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf });
    expect(wiederholung.statusCode, wiederholung.body).toBe(200);
    const antwort = wiederholung.json() as { wiederholt: boolean; notiz: Sicht };
    expect(antwort.wiederholt).toBe(true);
    expect(antwort.notiz.inhalt).toBe(rumpf.inhalt);
    expect(await anzahlImRepo(erik.id)).toBe(1);
    expect(await liste(erik.token)).toHaveLength(1);
    // Die Wiederholung ist kein zweites Anlegen — sie schreibt auch kein zweites Ereignis.
    const angelegt = await services.audit.list({ action: KLARA_NOTIZ_ANGELEGT });
    expect(angelegt.length).toBeLessThanOrEqual(1);
  });

  it("zwei gleichzeitige Versuche desselben Vorgangs ergeben eine Notiz; anderer Inhalt: 409", async () => {
    const v = vorgang();
    const [a, b] = await Promise.all([
      auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf }),
      auf(erik.token, "POST", BASIS, { vorgang: v, ...rumpf }),
    ]);
    expect([a?.statusCode, b?.statusCode].sort()).toEqual([200, 201]);
    expect(await anzahlImRepo(erik.id)).toBe(1);
    const anders = await auf(erik.token, "POST", BASIS, {
      vorgang: v,
      ...rumpf,
      inhalt: "ein ganz anderer Inhalt",
    });
    expect(anders.statusCode).toBe(409);
    expect(anders.json()).toMatchObject({ grund: "vorgang_belegt" });
    expect(await anzahlImRepo(erik.id)).toBe(1);
    // Derselbe Vorgang eines ANDEREN Kontos ist ein anderer Vorgang.
    expect((await auf(vera.token, "POST", BASIS, { vorgang: v, ...rumpf })).statusCode).toBe(201);
  });

  it("der Postgres-Betrieb hängt die haltbare Ablage ein, und `migrate()` legt die Tabelle an", () => {
    const wurzel = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    expect(wurzel).toMatch(/klaraNotizen: new PgKlaraNotizRepo\(pool\)/);
    const db = readFileSync(new URL("../../services/app/src/db.ts", import.meta.url), "utf8");
    expect(db).toMatch(/^\s+KLARA_NOTIZ_SCHEMA,$/m);
  });
});
