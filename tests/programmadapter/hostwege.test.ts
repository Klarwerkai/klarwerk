// ================================================================================================
// produkt:20261011:assistenz-programmadapter (BPA-04) · DIE HOSTWEGE AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`) —
// genau die Türen, die der Klara-Begleiter (apps/desktop/klara-begleiter) und das Word-Seitenfenster
// rufen. Alle Konten, Dateien und Markierungen sind synthetisch.
//
//   H1  Verbinden: der Server stellt die Bindung aus; Mandant und Nutzer kommen aus der Sitzung.
//   H2  Zielprüfung: anderes Dokument, andere Markierung, gefälschtes Siegel → 409, kein Ja.
//   H3  Finder: genau EINE gewählte Datei in die vorhandene Objektablage, mit Herkunft und Fassung.
//   H4  Finder negativ: mehrere Dateien, entzogene Dateifreigabe, abweichende Fassung, fremde
//       Datei-Kennung, Gast ohne Anlagerecht — jeweils NICHTS abgelegt.
//   H5  Bedienungshilfe: Lesen nur mit Freigabe, nur für den eingetragenen Zweck, nur bei
//       eindeutigem Fenster und Element; sonst gestoppt bzw. Klärung.
//   H6  Kontowechsel: die Bindung eines anderen Kontos trägt nichts — weder Wirkung noch Ablage noch
//       Kontext; Kontext eines anderen Dokuments geht nicht erneut hinaus.
//   H7  Die Übersicht nennt Finder als gebaut (ohne Hostbeleg), die macOS-Fassung und Excel weiter
//       als nicht geliefert; Excel lässt sich gar nicht verbinden.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { BEGLEITER_MACOS_MINDESTENS } from "../../services/app/src/programmadapter";
import { PROGRAMME_FINDER_AUFGENOMMEN } from "../../services/app/src/routes/programmadapter-routes";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let ada = "";
let erik = "";
let vera = "";

const INHALT = Buffer.from("Synthetische Prüfdatei für BPA-04 — keine echten Daten.", "utf8");
const SHA = createHash("sha256").update(INHALT).digest("hex");
const DATEI_ID = "finder-lesezeichen-1";

const ALLE_RECHTE = { bedienungshilfe: true, dateizugriff: true, bildschirmaufnahme: true };

async function anmelden(email: string): Promise<string> {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(r.statusCode).toBe(200);
  return (r.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string): Promise<string> {
  const r = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: email, email, password: "secret123", role: rolle },
  });
  expect(r.statusCode).toBe(201);
  return anmelden(email);
}

function post(wer: string, url: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url,
    headers: { authorization: `Bearer ${wer}` },
    payload,
  });
}

function finderZiel(over: Record<string, string> = {}) {
  return {
    programm: "finder",
    sitzung: "begleiter-1",
    hostKonto: "mac-nutzer-1",
    objekt: DATEI_ID,
    auswahl: "",
    fassung: SHA,
    ...over,
  };
}

function wordZiel(over: Record<string, string> = {}) {
  return {
    programm: "word-mac",
    sitzung: "begleiter-1",
    hostKonto: "mac-nutzer-1",
    objekt: "word-fenster-a",
    auswahl: "",
    fassung: "",
    ...over,
  };
}

async function verbinden(wer: string, ziel: Record<string, string>): Promise<string> {
  const r = await post(wer, "/api/klara/programme/verbinden", { ziel });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { bindung: string }).bindung;
}

function datei(over: Record<string, unknown> = {}) {
  return {
    dateiId: DATEI_ID,
    name: "pruefung-bpa04.txt",
    groesse: INHALT.byteLength,
    geaendertAm: "2026-10-11T10:00:00.000Z",
    mime: "text/plain",
    inhalt: INHALT.toString("base64"),
    ...over,
  };
}

function beobachtung(over: Record<string, unknown> = {}) {
  return {
    bundleId: "com.microsoft.Word",
    hostVersion: "16.111",
    fensterTreffer: 1,
    elementTreffer: 1,
    rolle: "AXTextArea",
    markierung: "Der Prüfdruck von Ventil V4 beträgt 6 bar.",
    ...over,
  };
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@hostwege.test", password: "secret123" },
  });
  ada = await anmelden("ada@hostwege.test");
  erik = await konto(ada, "experte", "erik@hostwege.test");
  vera = await konto(ada, "viewer", "vera@hostwege.test");
});

describe("H1/H2 · Bindung und Zielprüfung", () => {
  it("H1 · der Server stellt die Bindung aus; ein mitgeschickter Nutzer wird nicht geglaubt", async () => {
    const bindung = await verbinden(erik, { ...wordZiel(), nutzer: "fremd", mandant: "fremd" });
    const r = await post(erik, "/api/klara/programme/wirkung", { bindung, aktuell: wordZiel() });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    // Die Bindung trägt Erik — nicht den mitgeschickten „fremd".
    const nutzlast = JSON.parse(Buffer.from(bindung.split(".")[0] ?? "", "base64url").toString());
    expect(nutzlast.nutzer).not.toBe("fremd");
    expect(nutzlast.mandant).not.toBe("fremd");
  });

  it("H2 · anderes Dokument, andere Markierung, gefälschtes Siegel: 409 mit Grund", async () => {
    const bindung = await verbinden(erik, wordZiel());
    const fokus = await post(erik, "/api/klara/programme/wirkung", {
      bindung,
      aktuell: wordZiel({ objekt: "word-fenster-b" }),
    });
    expect(fokus.statusCode).toBe(409);
    expect(fokus.json()).toMatchObject({ ok: false, grund: "anderes-dokument" });

    const markierung = await post(erik, "/api/klara/programme/wirkung", {
      bindung,
      aktuell: wordZiel({ auswahl: "anders" }),
    });
    expect(markierung.json()).toMatchObject({ grund: "auswahl-geaendert" });

    const [teil] = bindung.split(".");
    const gefaelscht = `${teil}.AAAA`;
    const falsch = await post(erik, "/api/klara/programme/wirkung", {
      bindung: gefaelscht,
      aktuell: wordZiel(),
    });
    expect(falsch.statusCode).toBe(409);
    expect(falsch.json()).toMatchObject({
      grund: "host-getrennt",
      naechsterSchritt: "neu-verbinden",
    });
  });

  it("H2b · das Word-Seitenfenster: ungesiegelte Frage-Bindung, Nutzer aus der Sitzung", async () => {
    const gleich = await post(erik, "/api/klara/programme/wirkung", {
      gebunden: wordZiel(),
      aktuell: wordZiel(),
    });
    expect(gleich.statusCode).toBe(200);
    const neueSitzung = await post(erik, "/api/klara/programme/wirkung", {
      gebunden: wordZiel(),
      aktuell: wordZiel({ sitzung: "begleiter-2" }),
    });
    expect(neueSitzung.json()).toMatchObject({ grund: "sitzung-neu" });
  });
});

describe("H3/H4 · Finder: genau die gewählte Datei, in die vorhandene Objektablage", () => {
  it("H3 · eine Datei: abgelegt mit Herkunft, Fassung, Eigentümer — Protokoll ohne Dateinamen", async () => {
    const bindung = await verbinden(erik, finderZiel());
    const r = await post(erik, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      dateien: [datei()],
    });
    expect(r.statusCode, r.body).toBe(201);
    const antwort = r.json() as {
      objektId: string;
      ocrUrl: string;
      herkunft: { sha256: string; dateiId: string; quelle: string; groesse: number };
    };
    expect(antwort.ocrUrl).toBe(
      `/erfassen?weg=datei&finder=${encodeURIComponent(antwort.objektId)}`,
    );
    expect(antwort.herkunft).toMatchObject({
      quelle: "finder-auswahl",
      dateiId: DATEI_ID,
      sha256: SHA,
      groesse: INHALT.byteLength,
    });
    const abgelegt = await services.objects.read(antwort.objektId);
    expect(abgelegt?.ref.name).toBe("pruefung-bpa04.txt");
    expect(abgelegt?.ref.lifecycle?.purpose).toBe("attachment");
    // Keine Schutzklasse aus dem Finder: ungeklärt bleibt geschützt.
    expect(abgelegt?.ref.confidentiality).toBeUndefined();
    expect(abgelegt?.data).toBe(`data:text/plain;base64,${INHALT.toString("base64")}`);

    const eintraege = await services.audit.list({ action: PROGRAMME_FINDER_AUFGENOMMEN });
    expect(eintraege).toHaveLength(1);
    expect(JSON.stringify(eintraege[0])).toContain(SHA);
    expect(JSON.stringify(eintraege[0])).not.toContain("pruefung-bpa04");

    // Die Herkunft bleibt am Objekt — dauerhaft im Protokoll, über eine eigene Tür wieder lesbar,
    // auch ohne die HTTP-Antwort der Aufnahme.
    const zurueck = await app.inject({
      method: "GET",
      url: `/api/klara/programme/finder/${antwort.objektId}`,
      headers: { authorization: `Bearer ${erik}` },
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(zurueck.json()).toMatchObject({
      objektId: antwort.objektId,
      name: "pruefung-bpa04.txt",
      herkunft: {
        quelle: "finder-auswahl",
        dateiId: DATEI_ID,
        sha256: SHA,
        groesse: INHALT.byteLength,
        geaendertAm: "2026-10-11T10:00:00.000Z",
        bindung: {
          programm: "finder",
          sitzung: "begleiter-1",
          hostKonto: "mac-nutzer-1",
          objekt: DATEI_ID,
          fassung: SHA,
        },
      },
    });
    const gelesen = (zurueck.json() as { herkunft: { aufgenommenAm: unknown } }).herkunft;
    expect(typeof gelesen.aufgenommenAm).toBe("string");

    // Ein anderes Konto und eine erfundene Kennung bekommen dieselbe 404 — keine Existenzauskunft.
    for (const [wer, id] of [
      [ada, antwort.objektId],
      [erik, "gibt-es-nicht"],
    ] as const) {
      const r = await app.inject({
        method: "GET",
        url: `/api/klara/programme/finder/${id}`,
        headers: { authorization: `Bearer ${wer}` },
      });
      expect(r.statusCode).toBe(404);
      expect(r.body).not.toContain(SHA);
    }
  });

  it("H4 · mehrere Dateien, entzogene Freigabe, andere Fassung, fremde Kennung: nichts abgelegt", async () => {
    const bindung = await verbinden(erik, finderZiel());
    const vorher = (await services.objects.list()).length;

    const mehrere = await post(erik, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      dateien: [datei(), datei({ dateiId: "nachbar-1", name: "nachbar.txt" })],
    });
    expect(mehrere.statusCode).toBe(409);
    expect(mehrere.json()).toMatchObject({ grund: "mehrere-dateien" });

    const entzogen = await post(erik, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      rechte: { ...ALLE_RECHTE, dateizugriff: false },
      dateien: [datei()],
    });
    expect(entzogen.statusCode).toBe(409);
    expect(entzogen.json()).toMatchObject({ grund: "kein-dateizugriff" });
    const stopptext = (entzogen.json() as { text: string }).text;
    expect(stopptext).toMatch(/Bildschirmbild ersetzt die Datei nicht/);

    // Fehlt die Meldung über die Rechte ganz, gilt die Freigabe als nicht erteilt.
    const ohneMeldung = await post(erik, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      dateien: [datei()],
    });
    expect(ohneMeldung.json()).toMatchObject({ grund: "kein-dateizugriff" });

    const anders = Buffer.from("Inzwischen geändert.", "utf8");
    const geaendert = await post(erik, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      dateien: [datei({ inhalt: anders.toString("base64"), groesse: anders.byteLength })],
    });
    expect(geaendert.statusCode).toBe(409);
    expect(geaendert.json()).toMatchObject({ grund: "fassung-geaendert" });

    const fremd = await post(erik, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      dateien: [datei({ dateiId: "nachbar-1" })],
    });
    expect(fremd.statusCode).toBe(409);
    expect(fremd.json()).toMatchObject({ grund: "anderes-dokument" });

    expect((await services.objects.list()).length).toBe(vorher);
  });

  it("H4b · der Gast darf lesen, nicht ablegen: 403", async () => {
    const bindung = await verbinden(vera, finderZiel());
    const r = await post(vera, "/api/klara/programme/finder", {
      bindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      dateien: [datei()],
    });
    expect(r.statusCode).toBe(403);
  });
});

describe("H5 · Bedienungshilfe: ein Lesezweck, eindeutiges Ziel, kein Umweg", () => {
  it("liest die Markierung genau des einen Elements — mit Bindung für den späteren Kontext", async () => {
    const bindung = await verbinden(erik, wordZiel());
    const r = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung,
      aktuell: wordZiel(),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung(),
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      ok: true,
      markierung: "Der Prüfdruck von Ventil V4 beträgt 6 bar.",
      kontext: [],
    });
    expect(typeof (r.json() as { kontextBindung: unknown }).kontextBindung).toBe("string");
  });

  it("entzogene Bedienungshilfe: gestoppt, auch wenn die Bildschirmaufnahme erlaubt ist", async () => {
    const bindung = await verbinden(erik, wordZiel());
    const r = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung,
      aktuell: wordZiel(),
      rechte: { ...ALLE_RECHTE, bedienungshilfe: false },
      beobachtung: beobachtung(),
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      ok: false,
      entscheidung: "gestoppt",
      grund: "bedienungshilfe",
      ersatzweg: null,
    });
    expect(JSON.stringify(r.json())).not.toContain("Ventil");
  });

  it("mehrere Fenster, kein Element, leere Markierung: Klärung statt Raten", async () => {
    const bindung = await verbinden(erik, wordZiel());
    for (const [over, grund] of [
      [{ fensterTreffer: 2 }, "fenster-mehrdeutig"],
      [{ elementTreffer: 0 }, "element-fehlt"],
      [{ elementTreffer: 3 }, "element-mehrdeutig"],
      [{ markierung: "   " }, "markierung-leer"],
    ] as const) {
      const r = await post(erik, "/api/klara/programme/bedienungshilfe", {
        bindung,
        aktuell: wordZiel(),
        rechte: ALLE_RECHTE,
        beobachtung: beobachtung(over),
      });
      expect(r.statusCode, grund).toBe(409);
      expect(r.json(), grund).toMatchObject({ entscheidung: "klaerung", grund });
    }
  });

  it("kein Lesezweck für ein anderes Programm — auch nicht über ein Finder-Ziel", async () => {
    const wordBindung = await verbinden(erik, wordZiel());
    const excel = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: wordBindung,
      aktuell: wordZiel(),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung({ bundleId: "com.microsoft.Excel" }),
    });
    expect(excel.json()).toMatchObject({ entscheidung: "gestoppt", grund: "kein-lesezweck" });

    const finderBindung = await verbinden(erik, finderZiel());
    const ueberFinder = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: finderBindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung(),
    });
    expect(ueberFinder.json()).toMatchObject({
      entscheidung: "gestoppt",
      grund: "kein-lesezweck",
    });
  });
});

describe("H6 · Host- und Kontowechsel", () => {
  it("die Bindung eines anderen Kontos trägt weder Wirkung noch Ablage noch Kontext", async () => {
    const adaBindung = await verbinden(ada, finderZiel());
    const wirkung = await post(erik, "/api/klara/programme/wirkung", {
      bindung: adaBindung,
      aktuell: finderZiel(),
    });
    expect(wirkung.json()).toMatchObject({ ok: false, grund: "konto-gewechselt" });

    const vorher = (await services.objects.list()).length;
    const ablage = await post(erik, "/api/klara/programme/finder", {
      bindung: adaBindung,
      aktuell: finderZiel(),
      rechte: ALLE_RECHTE,
      dateien: [datei()],
    });
    expect(ablage.json()).toMatchObject({ grund: "konto-gewechselt" });
    expect((await services.objects.list()).length).toBe(vorher);

    const adaWord = await verbinden(ada, wordZiel());
    const lesen = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: adaWord,
      aktuell: wordZiel(),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung(),
    });
    expect(lesen.json()).toMatchObject({ ok: false, grund: "konto-gewechselt" });
    expect(JSON.stringify(lesen.json())).not.toContain("Ventil");
  });

  it("Kontext geht nur an dieselbe Bindung — anderes Dokument, anderes Konto, Fälschung fallen weg", async () => {
    const a = await verbinden(erik, wordZiel());
    const erst = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: a,
      aktuell: wordZiel(),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung({ markierung: "Privater Entwurf aus Dokument A" }),
    });
    const eigeneBindung = (erst.json() as { kontextBindung: string }).kontextBindung;

    const b = await verbinden(erik, wordZiel({ objekt: "word-fenster-b" }));
    const zweit = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: b,
      aktuell: wordZiel({ objekt: "word-fenster-b" }),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung({ markierung: "Absatz aus Dokument B" }),
    });
    const bBindung = (zweit.json() as { kontextBindung: string }).kontextBindung;

    const adaKontext = await verbinden(ada, wordZiel());
    const kontext = [
      { bindung: eigeneBindung, privat: true, inhalt: "Privater Entwurf aus Dokument A" },
      { bindung: bBindung, privat: false, inhalt: "Absatz aus Dokument B" },
      { bindung: adaKontext, privat: true, inhalt: "Adas privater Inhalt" },
      { bindung: "gefaelscht.AAAA", privat: false, inhalt: "untergeschoben" },
    ];

    // Zurück in Dokument A: nur der eigene Kontext aus A geht mit.
    const inA = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: a,
      aktuell: wordZiel(),
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung(),
      kontext,
    });
    expect(inA.statusCode).toBe(200);
    expect((inA.json() as { kontext: unknown }).kontext).toEqual([
      { privat: true, inhalt: "Privater Entwurf aus Dokument A" },
    ]);
    expect((inA.json() as { verworfen: number }).verworfen).toBe(3);

    // Nach einem Wechsel des Mac-Kontos: nichts vom alten Kontext.
    const andererMac = wordZiel({ hostKonto: "mac-nutzer-2" });
    const c = await verbinden(erik, andererMac);
    const nachWechsel = await post(erik, "/api/klara/programme/bedienungshilfe", {
      bindung: c,
      aktuell: andererMac,
      rechte: ALLE_RECHTE,
      beobachtung: beobachtung(),
      kontext,
    });
    expect((nachWechsel.json() as { kontext: unknown }).kontext).toEqual([]);
  });
});

describe("H7 · die Übersicht und die Grenzen", () => {
  it("Finder gebaut ohne Hostbeleg, macOS-Fassung genannt, Excel nicht geliefert und nicht verbindbar", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/api/klara/programme",
      headers: { authorization: `Bearer ${erik}` },
    });
    const body = r.json() as {
      programme: Array<{
        programm: string;
        weg: string;
        geliefert: boolean;
        os: { unterstuetzt: string | null; realGeprueft: string | null };
        bedienungshilfeLesen: string | null;
        faehigkeiten: Record<string, { stand: string }>;
      }>;
    };
    const finder = body.programme.find((p) => p.programm === "finder");
    expect(finder?.faehigkeiten.lesen?.stand).toBe("gebaut-ohne-hostbeleg");
    expect(finder?.faehigkeiten.schreiben?.stand).toBe("ausgeschlossen");
    expect(finder?.os).toEqual({ unterstuetzt: BEGLEITER_MACOS_MINDESTENS, realGeprueft: null });
    expect(finder?.geliefert).toBe(false);
    const word = body.programme.find((p) => p.programm === "word-mac");
    expect(word?.os.unterstuetzt).toBe(BEGLEITER_MACOS_MINDESTENS);
    expect(word?.bedienungshilfeLesen).toBe("gebaut-ohne-hostbeleg");
    for (const name of ["excel", "outlook", "powerpoint"]) {
      const p = body.programme.find((x) => x.programm === name);
      expect(p?.weg, name).toBe("keiner");
      expect(p?.geliefert, name).toBe(false);
    }
    const excel = await post(erik, "/api/klara/programme/verbinden", {
      ziel: { ...wordZiel(), programm: "excel" },
    });
    expect(excel.statusCode).toBe(400);
  });
});
