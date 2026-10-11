// ================================================================================================
// BPA-16 · DER BEDIENWEG ÜBER DIE ECHTE APP (Nacharbeit 2, Bens Befund 1).
// ================================================================================================
//
// WAS HIER ECHT IST: die ganze App (`buildServices`/`buildApp`), die Anmeldung und Freigabe von
// Konten, der vorhandene Objektweg `POST /api/objects` für PPTX und WebVTT, das Sichtbarkeitsurteil
// `beurteileAnhang`, die Ablage der Meetingbezüge (Speicherfassung; die PostgreSQL-Fassung misst
// `bedienweg-pg.integration.test.ts`) und die Routen `/api/meetings/**`. Transport `app.inject`.
//
// WAS NICHT: keine PowerPoint-Installation, kein Meetinghost, keine echte Aufnahme. Die
// Folienwechsel meldet der Test so, wie ein Hostadapter sie melden würde (Datei, Fassung, sldId).
//
// Konten: Vortragende (Eignerin, lädt hoch), Teilnehmer (eingetragen, liest Internes, nicht das
// streng vertrauliche Süd-Deck), Aussen (angemeldet, nicht eingetragen).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Aufbau,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";
import {
  type Meetinglage,
  PPTX_MIME,
  anfrage,
  hochladen,
  kontoId,
  meetingAufbauen,
} from "./app-helfer";
import { NORD, pptx } from "./vorrichtung";

adapterUmgebungSetzen();

let a: Aufbau;
let vortragende: Konto;
let teilnehmer: Konto;
let aussen: Konto;
let lage: Meetinglage;
let basis: string;
/** r1 (65 s, Süd 257, streng vertraulich) und r2 (125 s, Nord-Kopie 257). */
let r1: string;
let r2: string;

beforeAll(async () => {
  a = await appAufbauen(true);
  vortragende = await neuesKonto(a.app, "vortragende", a.admin);
  teilnehmer = await neuesKonto(a.app, "teilnehmer", a.admin);
  aussen = await neuesKonto(a.app, "aussen", a.admin);
  lage = await meetingAufbauen(a.app, vortragende, [await kontoId(a.app, teilnehmer)]);
  basis = `/api/meetings/${lage.meetingId}`;
});

afterAll(async () => {
  await a?.app.close();
});

describe("K10/K3 · Präsentationen kommen über den berechtigten Objektweg", () => {
  it("Kopie mit eigener Objektkennung wird mit ihrem Original verbunden", () => {
    expect(lage.verbunden.kopie.json).toMatchObject({
      dateiId: lage.nordKopie,
      abgleich: {
        status: "inhaltsgleich",
        originalZugriff: true,
        originalDateiId: lage.nordOriginal,
      },
    });
    expect(lage.fassungKopie).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ohne Original bleibt die Zuordnung ungeklärt — kein Originalzugriff behauptet", () => {
    expect(lage.verbunden.sued.json.abgleich).toEqual({
      status: "ungeklaert",
      originalZugriff: false,
    });
  });

  it("eine Datei ohne Leserecht kann nicht verbunden werden; Nicht-PPTX wird abgewiesen", async () => {
    const fremdes = await hochladen(
      a.app,
      vortragende,
      "privat.pptx",
      PPTX_MIME,
      await pptx(NORD, "privat"),
      "streng_vertraulich",
    );
    const ohneRecht = await anfrage(a.app, teilnehmer, "POST", `${basis}/praesentationen`, {
      objectId: fremdes,
    });
    expect(ohneRecht.status).toBe(404);
    const keinPptx = await anfrage(a.app, vortragende, "POST", `${basis}/praesentationen`, {
      objectId: lage.mitschrift,
    });
    expect(keinPptx.status).toBe(400);
  });
});

describe("K1/K9 · Rückmeldung an Datei, Fassung, Folie und Zeitstelle — ohne Dublette", () => {
  it("bindet r1 an Süd 257 und r2 an die Nord-Kopie 257 mit Änderungsziel im Original", async () => {
    const eins = await anfrage(a.app, vortragende, "POST", `${basis}/rueckmeldungen`, {
      mitschriftId: lage.mitschrift,
      stelleId: "r1",
      art: "vorschlag",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(eins.status, eins.body).toBe(201);
    expect(eins.json).toMatchObject({
      status: "gebunden",
      stelle: { id: "r1", startMs: 65_000, sprecher: "Sprecherin A" },
      folie: { lesbar: true, dateiId: lage.suedGeheim, fassung: lage.fassungSued, sldId: "257" },
      aenderung: { status: "wartet_auf_klaerung", ziel: null },
    });
    r1 = eins.json.id;

    const zwei = await anfrage(a.app, vortragende, "POST", `${basis}/rueckmeldungen`, {
      mitschriftId: lage.mitschrift,
      stelleId: "r2",
      art: "beschlossene_korrektur",
      text: "Zahlenquelle unter die Grafik",
    });
    expect(zwei.status, zwei.body).toBe(201);
    expect(zwei.json).toMatchObject({
      folie: { dateiId: lage.nordKopie, fassung: lage.fassungKopie, sldId: "257" },
      aenderung: { status: "offen", ziel: { dateiId: lage.nordOriginal, sldId: "257" } },
    });
    r2 = zwei.json.id;

    const nochmal = await anfrage(a.app, vortragende, "POST", `${basis}/rueckmeldungen`, {
      mitschriftId: lage.mitschrift,
      stelleId: "r2",
      art: "beschlossene_korrektur",
      text: "Zahlenquelle  unter die Grafik",
    });
    expect(nochmal.status).toBe(200);
    expect(nochmal.json.id).toBe(r2);
  });

  it("eine KI-Empfehlung legt dieser Weg nicht an; unbekannte Stelle ist ungültig", async () => {
    const ki = await anfrage(a.app, vortragende, "POST", `${basis}/rueckmeldungen`, {
      mitschriftId: lage.mitschrift,
      stelleId: "r3",
      art: "ki_empfehlung",
      text: "x",
    });
    expect(ki.status).toBe(400);
    const stelle = await anfrage(a.app, vortragende, "POST", `${basis}/rueckmeldungen`, {
      mitschriftId: lage.mitschrift,
      stelleId: "gibt-es-nicht",
      art: "vorschlag",
      text: "x",
    });
    expect(stelle.status).toBe(400);
  });
});

describe("K6/K7 · aus Folie und Zeitstelle erreichbar, mit den aktuellen Rechten", () => {
  it("der Teilnehmer öffnet r2 aus der Folie (Kopie und Original) und aus der Zeitstelle", async () => {
    const ausKopie = await anfrage(
      a.app,
      teilnehmer,
      "GET",
      `${basis}/folien/${lage.nordKopie}/257`,
    );
    const ausOriginal = await anfrage(
      a.app,
      teilnehmer,
      "GET",
      `${basis}/folien/${lage.nordOriginal}/257`,
    );
    const ausZeit = await anfrage(a.app, teilnehmer, "GET", `${basis}/zeitstellen/127000`);
    for (const res of [ausKopie, ausOriginal, ausZeit]) {
      expect(res.status, res.body).toBe(200);
      expect(res.json.rueckmeldungen.map((s: { id: string }) => s.id)).toEqual([r2]);
    }
    const einzeln = await anfrage(a.app, teilnehmer, "GET", `${basis}/rueckmeldungen/${r2}`);
    expect(einzeln.status).toBe(200);
    expect(einzeln.json.rueckmeldung).toMatchObject({
      id: r2,
      folie: { lesbar: true, titel: "Umsatzentwicklung" },
    });
  });

  it("das streng vertrauliche Deck bleibt dem Teilnehmer verborgen — auch über das Meeting", async () => {
    const ueberblick = await anfrage(a.app, teilnehmer, "GET", basis);
    expect(ueberblick.status).toBe(200);
    expect(ueberblick.json.praesentationen.map((p: { dateiId: string }) => p.dateiId)).toEqual([
      lage.nordKopie,
    ]);
    const eins = ueberblick.json.rueckmeldungen.find((s: { id: string }) => s.id === r1);
    expect(eins.folie).toEqual({ lesbar: false });
    expect(ueberblick.body).not.toContain(lage.suedGeheim);
    expect(ueberblick.body).not.toContain("Quartal Süd");
    expect(ueberblick.body).not.toContain("NOTIZ-SUED");
    const ausFolie = await anfrage(
      a.app,
      teilnehmer,
      "GET",
      `${basis}/folien/${lage.suedGeheim}/257`,
    );
    expect(ausFolie.json.rueckmeldungen).toEqual([]);
  });

  it("wer nicht eingetragen ist, erfährt nichts — keine Existenzauskunft", async () => {
    const liste = await anfrage(a.app, aussen, "GET", "/api/meetings");
    expect(liste.json.meetings).toEqual([]);
    for (const [method, url, payload] of [
      ["GET", basis, undefined],
      ["GET", `${basis}/rueckmeldungen/${r2}`, undefined],
      ["GET", `${basis}/folien/${lage.nordKopie}/257`, undefined],
      ["GET", `${basis}/zeitstellen/127000`, undefined],
      [
        "POST",
        `${basis}/rueckmeldungen/${r2}/klaerung`,
        { dateiId: lage.nordKopie, fassung: lage.fassungKopie, sldId: "256" },
      ],
      ["POST", `${basis}/rueckmeldungen/${r2}/verwerfen`, undefined],
    ] as const) {
      const res = await anfrage(a.app, aussen, method, url, payload);
      expect(res.status, `${method} ${url}`).toBe(404);
      expect(res.body).not.toContain("Umsatzentwicklung");
    }
    const eigene = await anfrage(a.app, teilnehmer, "GET", "/api/meetings");
    expect(eigene.json.meetings.map((m: { meetingId: string }) => m.meetingId)).toEqual([
      lage.meetingId,
    ]);
  });
});

describe("K4/K9 · Klärung über den Bedienweg", () => {
  it("ohne Leserecht am Ziel keine Klärung; mit Recht neue Version, alte in der Historie", async () => {
    const klaerung = `${basis}/rueckmeldungen/${r1}/klaerung`;
    const ohneRecht = await anfrage(a.app, teilnehmer, "POST", klaerung, {
      dateiId: lage.suedGeheim,
      fassung: lage.fassungSued,
      sldId: "256",
    });
    expect(ohneRecht.status).toBe(404);

    const geklaert = await anfrage(a.app, teilnehmer, "POST", klaerung, {
      dateiId: lage.nordKopie,
      fassung: lage.fassungKopie,
      sldId: "257",
    });
    expect(geklaert.status, geklaert.body).toBe(200);
    expect(geklaert.json).toMatchObject({
      version: 2,
      folie: { dateiId: lage.nordKopie, sldId: "257" },
      aenderung: { status: "offen", ziel: { dateiId: lage.nordOriginal, sldId: "257" } },
    });
    const gelesen = await anfrage(a.app, teilnehmer, "GET", `${basis}/rueckmeldungen/${r1}`);
    expect(gelesen.json.historie).toHaveLength(1);
    expect(gelesen.json.historie[0].folie).toEqual({ lesbar: false });
    // Die Vortragende sieht in derselben Historie die präsentierte Süd-Folie.
    const eignerin = await anfrage(a.app, vortragende, "GET", `${basis}/rueckmeldungen/${r1}`);
    expect(eignerin.json.historie[0].folie).toMatchObject({
      lesbar: true,
      dateiId: lage.suedGeheim,
    });
  });
});

describe("K8 · neue Originalfassung: Abgleich, keine Inhaltsvererbung", () => {
  it("ein geändertes Bild im Original stellt offene Änderungen zur Prüfung", async () => {
    const neu = await hochladen(
      a.app,
      vortragende,
      "nord-v2.pptx",
      PPTX_MIME,
      await pptx([NORD[0]!, { ...NORD[1]!, bild: "BALKEN-NORD-V2" }, NORD[2]!]),
      "intern",
    );
    const fremd = await anfrage(a.app, aussen, "POST", `${basis}/fassungsabgleich`, {
      originalObjectId: lage.nordOriginal,
      neueFassungObjectId: neu,
    });
    expect(fremd.status).toBe(404);

    const abgleich = await anfrage(a.app, vortragende, "POST", `${basis}/fassungsabgleich`, {
      originalObjectId: lage.nordOriginal,
      neueFassungObjectId: neu,
    });
    expect(abgleich.status, abgleich.body).toBe(200);
    expect(abgleich.json.eintraege).toContainEqual({
      rueckmeldungId: r2,
      sldId: "257",
      stand: "geaendert",
    });
    const r2jetzt = await anfrage(a.app, teilnehmer, "GET", `${basis}/rueckmeldungen/${r2}`);
    expect(r2jetzt.json.rueckmeldung).toMatchObject({
      folie: { dateiId: lage.nordKopie, fassung: lage.fassungKopie },
      aenderung: { status: "fassung_pruefen", ziel: null },
    });
  });
});
