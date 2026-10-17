// ================================================================================================
// produkt:20261011:assistenz-programmadapter (BPA-04) · GEMEINSAME ADAPTER STATT EINZELASSISTENTEN.
// ================================================================================================
//
// Gemessen werden der gemeinsame Adapterkern (`services/app/src/programmadapter.ts`) und die
// Fähigkeitsübersicht am echten Server (`buildApp(assembleServices(inMemoryRepos()))`,
// `app.inject`). Alle Konten, Dateien und Dokumente sind synthetisch.
//
// WAS DIESE DATEI NICHT BELEGT: einen realen Lauf in Word für Mac, im Finder oder mit entzogener
// macOS-Bedienungshilfe. Sie misst die Regeln, die ein solcher Lauf durchlaufen muss — der Hostbeleg
// selbst bleibt ein eigener, menschlicher Lauf (docs/operations/klara/programmadapter.md).
//
//   A1  Übersicht: je Programm Fassung, fünf Fähigkeiten mit Stand und Grenze; kein „alle Programme".
//   A2  Zielbindung: zwei Dokumente und Fokuswechsel — keine Wirkung auf dem falschen Ziel.
//   A3  Gewählte Datei: genau eine, mit Herkunft und Fassung; Nachbardateien werden nicht gelesen.
//   A4  Entzogenes Systemrecht stoppt genau diesen Adapter, verständlich und ohne Bildschirm-Umweg.
//   A5  Bedienungshilfe nur über getesteten Host/Fassung/Zweck; Koordinate ist nie ein Ziel.
//   A6  OCR und mehrdeutige Bedienelemente führen zu Klärung, nie zur Aktion.
//   A7  Ein Word-Beleg hebt kein anderes Programm; unvollständige Belege zählen nicht.
//   A8  Host-/Kontowechsel: der alte Kontext geht nicht erneut hinaus.
//   A9  Anmeldung und Avatar aus den vorhandenen Diensten; keine Ablage je Programm.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  type DateiLeser,
  type FaehigkeitsUebersicht,
  GEMEINSAME_DIENSTE,
  type GewaehlteDatei,
  HOSTBELEGE,
  type HostBeleg,
  type HostBindung,
  type KontextEintrag,
  type OsRechte,
  PROGRAMM_REGISTER,
  type ProgrammEintrag,
  adapterZustand,
  bewerteZiel,
  faehigkeitsUebersicht,
  nimmGewaehlteDateiAuf,
  pruefeZielVorWirkung,
  uebermittelbarerKontext,
} from "../../services/app/src/programmadapter";

const ALLE_RECHTE: OsRechte = {
  bedienungshilfe: true,
  dateizugriff: true,
  bildschirmaufnahme: true,
};

const DOKUMENT_A: HostBindung = {
  mandant: "klarwerk-single-tenant",
  nutzer: "konto-ada",
  sitzung: "sitzung-1",
  programm: "word-mac",
  hostKonto: "m365-konto-1",
  objekt: "dokument-a",
  auswahl: "auswahl-a-1",
  fassung: "fassung-a-1",
};

function sicht(u: FaehigkeitsUebersicht, programm: string) {
  const p = u.programme.find((x) => x.programm === programm);
  expect(p, programm).toBeDefined();
  return p as NonNullable<typeof p>;
}

describe("A1 · die Fähigkeitsübersicht nennt Fassung, Fähigkeiten und Grenzen", () => {
  it("jedes Programm führt alle fünf Fähigkeiten mit Stand und Grenze", () => {
    const u = faehigkeitsUebersicht();
    expect(u.programme.map((p) => p.programm)).toEqual([
      "word-mac",
      "word-web",
      "finder",
      "excel",
      "outlook",
      "powerpoint",
    ]);
    for (const p of u.programme) {
      expect(Object.keys(p.faehigkeiten).sort()).toEqual(
        ["auswahl", "ergebnispruefung", "lesen", "ruecknahme", "schreiben"].sort(),
      );
      for (const f of Object.values(p.faehigkeiten)) {
        expect(f.grenze.trim().length, `${p.programm}: Grenze`).toBeGreaterThan(10);
      }
      expect(p.grenzen.length, `${p.programm}: Grenzen`).toBeGreaterThan(0);
    }
  });

  it("Word für Mac nennt die belegte Hostfassung und Plattform; Rücknahme wird nicht behauptet", () => {
    const word = sicht(faehigkeitsUebersicht(), "word-mac");
    expect(word.plattform).toBe("macOS");
    expect(word.weg).toBe("office-js");
    expect(word.mindestfassung).toContain("16.111");
    expect(word.faehigkeiten.ruecknahme.stand).toBe("nicht-geliefert");
  });

  it("kein Versprechen für alle Programme; nicht aufgeführte gelten als nicht unterstützt", () => {
    const u = faehigkeitsUebersicht();
    expect(u.alleProgramme).toBe(false);
    expect(u.nichtAufgefuehrt).toMatch(/nicht unterstützt/);
  });

  it("am Stand dieses Kandidaten ist kein Programm real belegt — nichts wird als geliefert gezeigt", () => {
    expect(HOSTBELEGE).toEqual([]);
    const u = faehigkeitsUebersicht();
    for (const p of u.programme) {
      expect(p.geliefert, p.programm).toBe(false);
      for (const f of Object.values(p.faehigkeiten)) {
        expect(f.stand).not.toBe("real-belegt");
      }
    }
  });

  it("Finder verschiebt, ändert und löscht nie", () => {
    const finder = sicht(faehigkeitsUebersicht(), "finder");
    expect(finder.faehigkeiten.schreiben.stand).toBe("ausgeschlossen");
    expect(finder.faehigkeiten.schreiben.grenze).toMatch(/verschiebt, ändert oder löscht keine/);
  });
});

describe("A2 · zwei Word-Dokumente und Fokuswechsel verhindern falschen Zielbezug", () => {
  it("dasselbe Ziel: die Wirkung darf laufen", () => {
    expect(pruefeZielVorWirkung(DOKUMENT_A, { ...DOKUMENT_A })).toEqual({ ok: true });
  });

  it("Fokus auf Dokument B: abgelehnt mit verständlichem Grund und nächstem Schritt", () => {
    const dokumentB: HostBindung = {
      ...DOKUMENT_A,
      objekt: "dokument-b",
      auswahl: "auswahl-b-1",
      fassung: "fassung-b-1",
    };
    const r = pruefeZielVorWirkung(DOKUMENT_A, dokumentB);
    expect(r).toMatchObject({
      ok: false,
      grund: "anderes-dokument",
      naechsterSchritt: "neu-verbinden",
    });
    expect(r.ok === false && r.text).toMatch(/anderes Dokument/);
  });

  it("geänderte Fassung oder Markierung: neu übernehmen statt überschreiben", () => {
    const fassung = pruefeZielVorWirkung(DOKUMENT_A, { ...DOKUMENT_A, fassung: "fassung-a-2" });
    expect(fassung).toMatchObject({
      ok: false,
      grund: "fassung-geaendert",
      naechsterSchritt: "auswahl-neu-uebernehmen",
    });
    const auswahl = pruefeZielVorWirkung(DOKUMENT_A, { ...DOKUMENT_A, auswahl: "auswahl-a-2" });
    expect(auswahl).toMatchObject({ ok: false, grund: "auswahl-geaendert" });
  });

  it("Hostneustart (keine Verbindung) und neue Sitzung: neu verbinden bzw. neu übernehmen", () => {
    expect(pruefeZielVorWirkung(DOKUMENT_A, null)).toMatchObject({
      ok: false,
      grund: "host-getrennt",
      naechsterSchritt: "neu-verbinden",
    });
    const neu = pruefeZielVorWirkung(DOKUMENT_A, { ...DOKUMENT_A, sitzung: "sitzung-2" });
    expect(neu).toMatchObject({ ok: false, grund: "sitzung-neu" });
  });
});

describe("A3 · eine gewählte synthetische Datei — mit Herkunft und Fassung, ohne Nachbarn", () => {
  const ORDNER = new Map<string, Uint8Array>([
    ["datei-nachbar-1", new TextEncoder().encode("Nachbar eins — nicht freigegeben")],
    ["datei-gewaehlt", new TextEncoder().encode("Synthetischer Prüftext für BPA-04.")],
    ["datei-nachbar-2", new TextEncoder().encode("Nachbar zwei — nicht freigegeben")],
  ]);

  function protokollLeser(): DateiLeser & { gelesen: string[] } {
    const gelesen: string[] = [];
    return {
      gelesen,
      lies(dateiId: string) {
        gelesen.push(dateiId);
        const inhalt = ORDNER.get(dateiId);
        return inhalt ? Promise.resolve(inhalt) : Promise.reject(new Error("unbekannt"));
      },
    };
  }

  const gewaehlt: GewaehlteDatei = {
    dateiId: "datei-gewaehlt",
    name: "pruefung-bpa04.txt",
    groesse: (ORDNER.get("datei-gewaehlt") as Uint8Array).byteLength,
    geaendertAm: "2026-10-11T10:00:00.000Z",
  };

  it("liest nur die gewählte Datei und hält Herkunft samt SHA-256 fest", async () => {
    const leser = protokollLeser();
    const jetzt = new Date("2026-10-11T12:00:00.000Z");
    const inhalt = ORDNER.get("datei-gewaehlt") as Uint8Array;
    const erwartet = createHash("sha256").update(inhalt).digest("hex");
    const a = await nimmGewaehlteDateiAuf([gewaehlt], ALLE_RECHTE, leser, "konto-ada", () => jetzt);
    expect(leser.gelesen).toEqual(["datei-gewaehlt"]);
    expect(a.inhalt).toEqual(inhalt);
    expect(a.herkunft).toEqual({
      quelle: "finder-auswahl",
      dateiId: "datei-gewaehlt",
      name: "pruefung-bpa04.txt",
      groesse: gewaehlt.groesse,
      geaendertAm: "2026-10-11T10:00:00.000Z",
      sha256: erwartet,
      aufgenommenAm: "2026-10-11T12:00:00.000Z",
      nutzer: "konto-ada",
    });
  });

  it("keine oder mehrere Dateien: keine Aufnahme, kein einziger Lesezugriff", async () => {
    const leser = protokollLeser();
    const keine = nimmGewaehlteDateiAuf([], ALLE_RECHTE, leser, "konto-ada");
    await expect(keine).rejects.toMatchObject({ grund: "keine-auswahl" });
    const zwei: GewaehlteDatei = { ...gewaehlt, dateiId: "datei-nachbar-1" };
    const mehrere = nimmGewaehlteDateiAuf([gewaehlt, zwei], ALLE_RECHTE, leser, "konto-ada");
    await expect(mehrere).rejects.toMatchObject({ grund: "mehrere-dateien" });
    expect(leser.gelesen).toEqual([]);
  });

  it("während der Aufnahme geänderte Datei wird nicht als diese Fassung übernommen", async () => {
    const leser = protokollLeser();
    const anders: GewaehlteDatei = { ...gewaehlt, groesse: 3 };
    const aufnahme = nimmGewaehlteDateiAuf([anders], ALLE_RECHTE, leser, "konto-ada");
    await expect(aufnahme).rejects.toMatchObject({ grund: "groesse-abweichend" });
  });
});

describe("A4 · entzogenes Systemrecht stoppt genau diesen Adapter — ohne Bildschirm-Umweg", () => {
  it("Bedienungshilfe entzogen: gestoppt, auch wenn Bildschirmaufnahme erlaubt ist", () => {
    const z = adapterZustand("bedienungshilfe", { ...ALLE_RECHTE, bedienungshilfe: false });
    expect(z).toMatchObject({ aktiv: false, fehlt: "bedienungshilfe", ersatzweg: null });
    expect(z.aktiv === false && z.text).toMatch(/auch nicht über ein Bildschirmbild/);
    expect(z.aktiv === false && z.naechsterSchritt).toMatch(/Bedienungshilfen/);
  });

  it("Dateifreigabe entzogen: Aufnahme stoppt vor jedem Lesezugriff", async () => {
    const rechte = { ...ALLE_RECHTE, dateizugriff: false };
    expect(adapterZustand("datei-auswahl", rechte)).toMatchObject({
      aktiv: false,
      fehlt: "dateizugriff",
      ersatzweg: null,
    });
    const gelesen: string[] = [];
    const leser: DateiLeser = {
      lies: (id) => {
        gelesen.push(id);
        return Promise.resolve(new Uint8Array());
      },
    };
    const datei: GewaehlteDatei = {
      dateiId: "d",
      name: "d.txt",
      groesse: 0,
      geaendertAm: "2026-10-11T10:00:00Z",
    };
    const aufnahme = nimmGewaehlteDateiAuf([datei], rechte, leser, "konto-ada");
    await expect(aufnahme).rejects.toMatchObject({
      grund: "kein-dateizugriff",
      message: expect.stringMatching(/Bildschirmbild ersetzt die Datei nicht/),
    });
    expect(gelesen).toEqual([]);
  });

  it("nur der betroffene Adapter stoppt: Word über Office.js braucht kein macOS-Recht", () => {
    const keine: OsRechte = {
      bedienungshilfe: false,
      dateizugriff: false,
      bildschirmaufnahme: false,
    };
    expect(adapterZustand("office-js", keine)).toEqual({ aktiv: true, weg: "office-js" });
    expect(adapterZustand("datei-auswahl", { ...keine, dateizugriff: true })).toEqual({
      aktiv: true,
      weg: "datei-auswahl",
    });
  });
});

/**
 * Ein Register MIT einem (hier nur angenommenen) getesteten Rückfall — für die Regelprüfung. Das
 * ausgelieferte Register trägt keinen; das misst A5 ausdrücklich.
 */
const MIT_RUECKFALL: ProgrammEintrag[] = PROGRAMM_REGISTER.map((e) =>
  e.programm === "word-mac"
    ? {
        ...e,
        bedienungshilfeRueckfall: {
          bundleId: "com.microsoft.Word",
          hostVersion: "16.111",
          zwecke: ["seitenfenster-oeffnen"],
        },
      }
    : e,
);

const element = {
  art: "bedienelement" as const,
  bundleId: "com.microsoft.Word",
  hostVersion: "16.111",
  zweck: "seitenfenster-oeffnen",
  rolle: "AXButton",
  kennung: "klara-add-in",
  titel: null,
  treffer: 1,
};

describe("A5 · Bedienungshilfe-Rückfall nur für getesteten Host und Zweck; keine Koordinate", () => {
  it("eine feste Bildschirmkoordinate wird nie ausgeführt", () => {
    expect(bewerteZiel({ art: "koordinate", x: 412, y: 88 }, MIT_RUECKFALL)).toMatchObject({
      entscheidung: "abgelehnt",
      grund: "koordinate",
    });
  });

  it("im ausgelieferten Register gibt es keinen getesteten Rückfall — also keine AX-Bedienung", () => {
    expect(PROGRAMM_REGISTER.every((e) => e.bedienungshilfeRueckfall === null)).toBe(true);
    expect(bewerteZiel(element)).toMatchObject({
      entscheidung: "abgelehnt",
      grund: "kein-getesteter-rueckfall",
    });
  });

  it("nur genau der getestete Host, dessen Fassung und Zweck tragen", () => {
    expect(bewerteZiel(element, MIT_RUECKFALL)).toEqual({ entscheidung: "ausfuehren" });
    expect(bewerteZiel({ ...element, hostVersion: "16.112" }, MIT_RUECKFALL)).toMatchObject({
      entscheidung: "abgelehnt",
    });
    expect(bewerteZiel({ ...element, zweck: "dokument-loeschen" }, MIT_RUECKFALL)).toMatchObject({
      entscheidung: "abgelehnt",
    });
    const excel = bewerteZiel({ ...element, bundleId: "com.microsoft.Excel" }, MIT_RUECKFALL);
    expect(excel).toMatchObject({ entscheidung: "abgelehnt" });
  });
});

describe("A6 · unsicherer OCR-Treffer oder mehrdeutiges Bedienelement erzeugt Klärung", () => {
  it("OCR führt nie zur Aktion — eindeutig: Bestätigung, mehrdeutig: Stelle angeben", () => {
    expect(bewerteZiel({ art: "ocr", text: "Senden", treffer: 1 })).toMatchObject({
      entscheidung: "klaerung",
      grund: "ocr-unbestaetigt",
    });
    expect(bewerteZiel({ art: "ocr", text: "Senden", treffer: 3 })).toMatchObject({
      entscheidung: "klaerung",
      grund: "ocr-mehrdeutig",
    });
  });

  it("mehrere, kein oder unbenanntes Bedienelement: Klärung statt Raten", () => {
    expect(bewerteZiel({ ...element, treffer: 2 }, MIT_RUECKFALL)).toMatchObject({
      entscheidung: "klaerung",
      grund: "bedienelement-mehrdeutig",
    });
    expect(bewerteZiel({ ...element, treffer: 0 }, MIT_RUECKFALL)).toMatchObject({
      entscheidung: "klaerung",
      grund: "bedienelement-fehlt",
    });
    expect(bewerteZiel({ ...element, kennung: null, titel: null }, MIT_RUECKFALL)).toMatchObject({
      entscheidung: "klaerung",
      grund: "bedienelement-unbestimmt",
    });
  });
});

describe("A7 · ein Word-Beleg wird keinem anderen Programm zugerechnet", () => {
  const wordBeleg: HostBeleg = {
    programm: "word-mac",
    hostVersion: "16.111",
    osVersion: "macOS 15.6",
    kandidat: "1.0.0-beta.1.999",
    zeitpunkt: "2026-10-11T14:00:00+02:00",
    faehigkeiten: ["lesen", "auswahl", "schreiben", "ruecknahme"],
    protokoll: "docs/operations/klara/programmadapter.md",
  };

  it("Word wird real belegt mit gebundener Fassung; Excel/Outlook/PowerPoint bleiben offen", () => {
    const u = faehigkeitsUebersicht([wordBeleg]);
    const word = sicht(u, "word-mac");
    expect(word.geliefert).toBe(true);
    expect(word.faehigkeiten.lesen).toMatchObject({
      stand: "real-belegt",
      beleg: { hostVersion: "16.111", osVersion: "macOS 15.6", kandidat: "1.0.0-beta.1.999" },
    });
    // Ein Beleg hebt keinen nicht gebauten Weg: die Rücknahme bleibt „nicht geliefert".
    expect(word.faehigkeiten.ruecknahme.stand).toBe("nicht-geliefert");
    // Word im Browser ist ein eigener Host.
    expect(sicht(u, "word-web").geliefert).toBe(false);
    for (const anderes of ["excel", "outlook", "powerpoint", "finder"]) {
      const p = sicht(u, anderes);
      expect(p.geliefert, anderes).toBe(false);
      expect(
        Object.values(p.faehigkeiten).every((f) => f.beleg === null),
        anderes,
      ).toBe(true);
    }
  });

  it("ein Beleg für ein nicht gebautes Programm hebt nichts; ein unvollständiger zählt nicht", () => {
    const excelBeleg: HostBeleg = { ...wordBeleg, programm: "excel" };
    const ohneFassung: HostBeleg = { ...wordBeleg, hostVersion: " " };
    const u = faehigkeitsUebersicht([excelBeleg, ohneFassung]);
    expect(sicht(u, "excel").faehigkeiten.lesen.stand).toBe("nicht-geliefert");
    expect(sicht(u, "word-mac").geliefert).toBe(false);
    expect(u.verworfeneBelege).toBe(1);
  });
});

describe("A8 · Host-/Kontowechsel trennt private Inhalte und übermittelt den alten Kontext nicht", () => {
  const eintraege: KontextEintrag[] = [
    { bindung: DOKUMENT_A, privat: true, inhalt: "privater Entwurf aus Dokument A" },
    { bindung: DOKUMENT_A, privat: false, inhalt: "markierter Absatz aus Dokument A" },
  ];

  it("dasselbe Konto, derselbe Host, dasselbe Dokument: der Kontext bleibt", () => {
    expect(uebermittelbarerKontext(eintraege, { ...DOKUMENT_A })).toHaveLength(2);
  });

  it("anderes Hostkonto, anderer Nutzer, anderes Programm, getrennt: nichts geht hinaus", () => {
    for (const aktuell of [
      { ...DOKUMENT_A, hostKonto: "m365-konto-2" },
      { ...DOKUMENT_A, nutzer: "konto-erik" },
      { ...DOKUMENT_A, programm: "word-web" as const },
      { ...DOKUMENT_A, objekt: "dokument-b" },
      null,
    ]) {
      expect(uebermittelbarerKontext(eintraege, aktuell)).toEqual([]);
    }
  });

  it("eine Wirkung nach Kontowechsel wird abgelehnt — Konto vor Dokument", () => {
    const r = pruefeZielVorWirkung(DOKUMENT_A, {
      ...DOKUMENT_A,
      hostKonto: "m365-konto-2",
      objekt: "dokument-b",
    });
    expect(r).toMatchObject({ ok: false, grund: "konto-gewechselt" });
  });
});

describe("A9 · Anmeldung, Avatar und Dienste kommen aus dem Bestand — am echten Server", () => {
  let app: ReturnType<typeof buildApp>;
  let token = "";

  beforeEach(async () => {
    app = buildApp(assembleServices(inMemoryRepos()));
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@programme.test", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@programme.test", password: "secret123" },
    });
    expect(login.statusCode).toBe(200);
    token = (login.json() as { token: string }).token;
  });

  it("ohne Anmeldung 401 — es gibt keine eigene Anmeldung für die Programmübersicht", async () => {
    const r = await app.inject({ method: "GET", url: "/api/klara/programme" });
    expect(r.statusCode).toBe(401);
  });

  it("dieselbe Sitzung liefert die Übersicht samt Name/Avatar aus dem eigenen Assistenzprofil", async () => {
    const auth = { authorization: `Bearer ${token}` };
    const leer = await app.inject({ method: "GET", url: "/api/klara/programme", headers: auth });
    expect(leer.statusCode, leer.body).toBe(200);
    expect(leer.headers["cache-control"]).toBe("no-store");
    expect(leer.json()).toMatchObject({ assistenz: { name: null, avatar: null } });

    const profil = await app.inject({
      method: "PUT",
      url: "/api/me/assistenz",
      headers: auth,
      payload: {
        name: "Mia",
        avatar: "eule",
        bewegung: "standard",
        einrichtungAbschliessen: true,
        fassung: 0,
      },
    });
    expect(profil.statusCode, profil.body).toBe(200);

    const r = await app.inject({ method: "GET", url: "/api/klara/programme", headers: auth });
    expect(r.statusCode).toBe(200);
    const body = r.json() as FaehigkeitsUebersicht & {
      assistenz: { name: string | null; avatar: string | null };
      dienste: Record<string, string>;
    };
    expect(body.assistenz).toEqual({ name: "Mia", avatar: "eule" });
    expect(body.dienste).toEqual(GEMEINSAME_DIENSTE);
    expect(body.alleProgramme).toBe(false);
    expect(body.programme).toEqual(JSON.parse(JSON.stringify(faehigkeitsUebersicht().programme)));
  });

  it("kein Programm bringt eine eigene Anmeldung, Ablage oder Assistenz mit", () => {
    const EIGENE = /anmeldung|login|speicher|ablage|assistenz|avatar|token/i;
    for (const e of PROGRAMM_REGISTER) {
      expect(
        Object.keys(e).filter((k) => EIGENE.test(k)),
        e.programm,
      ).toEqual([]);
    }
    expect(Object.keys(GEMEINSAME_DIENSTE).sort()).toEqual(
      ["aktionen", "anmeldung", "avatar", "quellenpruefung", "speicher"].sort(),
    );
  });
});
