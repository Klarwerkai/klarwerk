// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC01 — NATÜRLICHER LERNAUFTRAG → P06.
// ================================================================================================
//
// Am echten Server (`buildApp(buildServices())`): `POST /api/me/vormachen` mit `auftrag` statt
// Formularfeldern. Der Server bestimmt den begrenzten Lernbereich oder fragt gezielt nach; danach
// gilt der vorhandene P06-Lernweg (sichtbarer Lernzustand, sofortige Pause, Mitschreiben nur der
// gewählten Vorgänge). Fiktive Konten und Daten, kein Modell.
import { beforeEach, describe, expect, it } from "vitest";
import { istLernauftrag } from "../../apps/web/src/lib/lernauftrag";
import { leiteLernbereichAb } from "../../services/app/src/assistenz-lernen-lernauftrag";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

let app: App;
let token = "";
const VORMACHEN = "/api/me/vormachen";
const WEB = "http://localhost/erfassen";

const auf = (methode: "GET" | "POST" | "PUT", url: string, payload?: unknown, herkunft?: string) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${token}`, ...(herkunft ? { referer: herkunft } : {}) },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

type Sitzung = { id: string; host: string; vorgaenge: string[]; zweck: string; zustand: string };
type Klaerung = { art: string; frage: string; optionen: { host: string; vorgaenge: string[] }[] };

async function sitzungen(): Promise<Sitzung[]> {
  const r = await auf("GET", VORMACHEN);
  return (r.json() as { sitzungen: Sitzung[] }).sitzungen;
}

beforeEach(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Ada", email: "ada@lernauftrag.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ada@lernauftrag.test", password: "secret123" },
  });
  token = (login.json() as { token: string }).token;
});

describe("BPA-06 AC01 · Lernbereich aus dem Satz (rein)", () => {
  it("Anwendung und Vorgänge aus dem Lernauftrag; ohne Lernabsicht nichts", () => {
    const bericht = leiteLernbereichAb("Verfolge, wie ich diesen Bericht erstelle.", null);
    expect(bericht).toMatchObject({
      art: "bereich",
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
    });
    const einreichen = leiteLernbereichAb(
      "Schau mir zu, wie ich den Bericht anlege und zur Prüfung einreiche.",
      null,
    );
    expect(einreichen).toMatchObject({
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern", "zur_pruefung_einreichen"],
    });
    const word = leiteLernbereichAb("Verfolge, wie ich in Word einen Bericht übernehme.", null);
    expect(word).toMatchObject({
      host: "word",
      vorgaenge: ["word_auswahl_uebernehmen", "word_dokument_uebernehmen"],
    });
    expect(leiteLernbereichAb("Wie lerne ich schneller?", null)).toMatchObject({
      art: "klaerung",
      grund: "kein_lernauftrag",
    });
    // Nacharbeit 38 (G09): eine genannte Anwendung, die weder Klarwerk noch Word ist, wird nicht
    // durch die Herkunft ersetzt — auch nicht, wenn der Satz gültige Vorgänge nennt.
    const libre = leiteLernbereichAb(
      "Verfolge, wie ich diesen Bericht in LibreOffice erstelle.",
      "klarwerk_web",
    );
    expect(libre).toMatchObject({ art: "klaerung", grund: "anwendung_unklar" });
    if (libre.art === "klaerung") {
      expect(libre.frage).toContain("LibreOffice");
      expect(libre.optionen.map((o) => o.host)).toEqual(["klarwerk_web", "word"]);
    }
    const unklar = { art: "klaerung", grund: "anwendung_unklar" };
    const notizblock = "Beobachte, wie ich mit dem Programm Notizblock einen Bericht schreibe.";
    expect(leiteLernbereichAb(notizblock, null)).toMatchObject(unklar);
    const beide = "Verfolge, wie ich den Bericht in Word und in Klarwerk anlege.";
    expect(leiteLernbereichAb(beide, null)).toMatchObject(unklar);
    // Ausdrücklich genannt und eindeutig: genau diese Anwendung, auch gegen die Herkunft.
    const browser = "Verfolge, wie ich im Browser diesen Bericht erstelle.";
    expect(leiteLernbereichAb(browser, "word")).toMatchObject({ host: "klarwerk_web" });
    const msWord = "Verfolge, wie ich in MS Word einen Bericht übernehme.";
    expect(leiteLernbereichAb(msWord, "klarwerk_web")).toMatchObject({ host: "word" });
    // Nacharbeit 39: unabhängig von der Schreibweise und von jeder Herkunft.
    for (const libre of [
      "Verfolge, wie ich diesen Bericht in libreoffice erstelle.",
      "Verfolge, wie ich diesen Bericht in LIBREOFFICE erstelle.",
      "verfolge, wie ich diesen bericht in libreoffice erstelle.",
      "Verfolge, wie ich in der app notizblock einen Bericht schreibe.",
      // Nacharbeit 40: ein Artikel oder Possessivwort macht aus der Anwendung keinen Gegenstand.
      "Verfolge, wie ich diesen Bericht in meinem LibreOffice erstelle.",
      "Verfolge, wie ich diesen Bericht in der libreoffice erstelle.",
      // Ein Name, der wie ein Gegenstand endet, bleibt eine Anwendungsangabe.
      "Verfolge, wie ich diesen Bericht in Gmail entwerfe.",
    ]) {
      for (const herkunft of ["klarwerk_web", "word", null] as const) {
        expect(leiteLernbereichAb(libre, herkunft), `${libre} / ${herkunft}`).toMatchObject(unklar);
      }
    }
    const klein = "verfolge, wie ich in word einen bericht übernehme.";
    expect(leiteLernbereichAb(klein, null)).toMatchObject({ art: "bereich", host: "word" });
    const gross = "Verfolge, wie ich in KLARWERK den Bericht anlege.";
    expect(leiteLernbereichAb(gross, "word")).toMatchObject({ host: "klarwerk_web" });
    // Ein Gegenstand nach Begleitwort ist keine Anwendung: dann gilt die Herkunft.
    const gegenstand = "Verfolge, wie ich in diesem Bericht die Zahlen ergänze.";
    expect(leiteLernbereichAb(gegenstand, "klarwerk_web")).toMatchObject({
      art: "bereich",
      host: "klarwerk_web",
    });
    // Erkennbare Arbeitsgegenstände, auch gebeugt und zusammengesetzt, auch ohne Begleitwort.
    for (const satz of [
      "Verfolge, wie ich im Wochenbericht die Zahlen ergänze.",
      "Verfolge, wie ich den Bericht in den Tabellen ergänze.",
      "Verfolge, wie ich in meinem Dokument den Bericht anlege.",
    ]) {
      expect(leiteLernbereichAb(satz, "word"), satz).toMatchObject({
        art: "bereich",
        host: "word",
      });
    }
    // Dieselbe Grenze im Klara-Eingabefeld: eine Frage geht nicht an den Lernstart.
    expect(istLernauftrag("Wie lerne ich schneller?")).toBe(false);
    expect(istLernauftrag("Verfolge, wie ich diesen Bericht erstelle.")).toBe(true);
  });
});

describe("BPA-06 AC01 · natürlicher Lernauftrag am vorhandenen P06-Lernstart", () => {
  it("startet den begrenzten Lernmodus; sichtbar, sofort pausierbar, nur gewählte Vorgänge", async () => {
    const satz = "Verfolge, wie ich diesen Bericht erstelle.";
    const r = await auf("POST", VORMACHEN, { auftrag: satz }, WEB);
    expect(r.statusCode, r.body).toBe(201);
    const s = (r.json() as { sitzung: Sitzung }).sitzung;
    expect(s).toMatchObject({
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
      zweck: satz,
      zustand: "lernt",
    });
    // Die Lernanzeige meldet sich sichtbar — erst dann wird mitgeschrieben (P06).
    const anzeige = await auf("GET", `${VORMACHEN}?anzeige=klarwerk_web`);
    expect((anzeige.json() as { sichtbar: boolean }).sichtbar).toBe(true);
    const demo = { title: "Wochenbericht KW41", statement: "Umsatz stabil" };
    expect((await auf("POST", "/api/drafts", demo, WEB)).statusCode).toBeLessThan(300);
    expect((await sitzungen())[0]?.vorgaenge).toEqual(["entwurf_anlegen", "entwurf_speichern"]);
    const lernnotiz = (await auf("GET", VORMACHEN)).json() as {
      sitzungen: { beobachtet: number }[];
    };
    expect(lernnotiz.sitzungen[0]?.beobachtet).toBe(1);

    // Sofortige Pause: danach wird nichts mehr mitgeschrieben.
    const pause = await auf("PUT", `${VORMACHEN}/${s.id}/zustand`, { zustand: "pausiert" });
    expect(pause.statusCode, pause.body).toBe(200);
    expect((await auf("POST", "/api/drafts", demo, WEB)).statusCode).toBeLessThan(300);
    const nachPause = (await auf("GET", VORMACHEN)).json() as {
      sitzungen: { beobachtet: number; zustand: string }[];
    };
    expect(nachPause.sitzungen[0]).toMatchObject({ beobachtet: 1, zustand: "pausiert" });
  });

  it("Vorgang unklar: gezielte Rückfrage mit Optionen; die Wahl startet genau diesen Bereich", async () => {
    const satz = "Lerne, wie ich das mache.";
    const r = await auf("POST", VORMACHEN, { auftrag: satz }, WEB);
    expect(r.statusCode, r.body).toBe(422);
    const k = (r.json() as { klaerung: Klaerung }).klaerung;
    expect(k.art).toBe("vorgang_unklar");
    expect(k.frage).toContain("Klarwerk");
    expect(k.optionen.length).toBeGreaterThan(1);
    expect(await sitzungen()).toEqual([]);
    const wahl = k.optionen[0] as { host: string; vorgaenge: string[] };
    const gestartet = await auf("POST", VORMACHEN, { auftrag: satz, ...wahl }, WEB);
    expect(gestartet.statusCode, gestartet.body).toBe(201);
    expect((gestartet.json() as { sitzung: Sitzung }).sitzung).toMatchObject({
      host: wahl.host,
      vorgaenge: wahl.vorgaenge,
      zweck: satz,
    });
  });

  it("unbekannte genannte Anwendung: keine Sitzung vor der Klärung; Wahl startet genau sie", async () => {
    const satz = "Verfolge, wie ich diesen Bericht in LibreOffice erstelle.";
    // Aus Klarwerk heraus (Herkunft Klarwerk-Web) — trotzdem keine Klarwerk-Lernsitzung.
    const r = await auf("POST", VORMACHEN, { auftrag: satz }, WEB);
    expect(r.statusCode, r.body).toBe(422);
    const k = (r.json() as { klaerung: Klaerung }).klaerung;
    expect(k.art).toBe("anwendung_unklar");
    expect(k.frage).toContain("LibreOffice");
    expect(await sitzungen()).toEqual([]);
    // Auch das Mitschreiben findet nichts: ohne Sitzung wird ein Entwurf nicht beobachtet.
    const demo = { title: "Wochenbericht KW41", statement: "Umsatz stabil" };
    expect((await auf("POST", "/api/drafts", demo, WEB)).statusCode).toBeLessThan(300);
    expect(await sitzungen()).toEqual([]);
    // Die Person klärt: in Klarwerk. Erst jetzt beginnt der Lernmodus — mit genau dieser Wahl.
    const wahl = k.optionen.find((o) => o.host === "klarwerk_web");
    expect(wahl).toBeDefined();
    const gestartet = await auf("POST", VORMACHEN, { auftrag: satz, ...wahl }, WEB);
    expect(gestartet.statusCode, gestartet.body).toBe(201);
    expect((gestartet.json() as { sitzung: Sitzung }).sitzung).toMatchObject({
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
    });
  });

  it("klein geschriebene unbekannte Anwendung aus Klarwerk und aus Word: keine Sitzung", async () => {
    const wordPanel = "http://localhost/word-addin/taskpane.html";
    for (const [satz, name] of [
      ["Verfolge, wie ich diesen Bericht in libreoffice erstelle.", "libreoffice"],
      // Nacharbeit 40: nach Possessivwort ebenso geklärt.
      ["Verfolge, wie ich diesen Bericht in meinem LibreOffice erstelle.", "LibreOffice"],
    ] as const) {
      for (const herkunft of [WEB, wordPanel]) {
        const r = await auf("POST", VORMACHEN, { auftrag: satz }, herkunft);
        expect(r.statusCode, `${herkunft}: ${r.body}`).toBe(422);
        const k = (r.json() as { klaerung: Klaerung }).klaerung;
        expect(k.art).toBe("anwendung_unklar");
        expect(k.frage).toContain(name);
        expect(await sitzungen()).toEqual([]);
      }
    }
  });

  it("nicht freigegebene Anwendung und Satz ohne Lernabsicht: nichts wird beobachtet", async () => {
    const excel = await auf("POST", VORMACHEN, {
      auftrag: "Schau mir zu, wie ich in Excel rechne.",
    });
    expect(excel.statusCode, excel.body).toBe(422);
    const k = (excel.json() as { klaerung: Klaerung }).klaerung;
    expect(k).toMatchObject({ art: "anwendung_nicht_freigegeben", optionen: [] });
    // Auch eine mitgeschickte Wahl hebt das nicht auf.
    const erzwungen = await auf("POST", VORMACHEN, {
      auftrag: "Schau mir zu, wie ich in Excel rechne.",
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen"],
    });
    expect(erzwungen.statusCode).toBe(422);
    const frage = await auf("POST", VORMACHEN, { auftrag: "Wie lerne ich schneller?" });
    expect(frage.statusCode).toBe(422);
    expect(await sitzungen()).toEqual([]);
  });
});
