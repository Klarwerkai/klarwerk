// ================================================================================================
// BPA-05 · AKTIVE BEGLEITUNG — der Kern gegen die Originalkriterien K1–K8.
// ================================================================================================
//
// Auftrag `produkt:20261011:assistenz-aktive-beobachtung` (BPA-05-AC01 … AC08 = K1 … K8). Geprüft
// wird `apps/web/src/components/klara-begleitung/kern.ts` ohne Oberfläche: Zustandswechsel,
// Filter, Dosierung, Wiederanlauf. Synthetische Daten; die „Geheimnisse" unten sind Marker, an
// denen sich ein Leck im serialisierten Zustand ablesen lässt.
import { describe, expect, it } from "vitest";
import {
  AUS,
  type Begleitung,
  type Bereich,
  type Feld,
  type KontextEreignis,
  auskunft,
  befunde,
  beschaeftigt,
  fortsetzen,
  leseAuftrag,
  naechsterHinweis,
  nimmKontext,
  pausiere,
  sicherung,
  starte,
  stoppe,
  systemereignis,
  verwirf,
  wiederherstellen,
} from "../../apps/web/src/components/klara-begleitung/kern";

const T0 = Date.parse("2026-10-11T10:00:00+02:00");
const MIN = 60_000;
const PIA = "u-pia";
const BEREICH: Bereich = {
  art: "vorgang",
  kennung: "pruefformular-netzteil",
  bezeichnung: "Prüfformular Netzteil",
};
const GEHEIM = ["KD-GEHEIM-4711", "PIN-9999", "PRIVAT-NOTIZ-XYZ", "INKOGNITO-INHALT"];

const FELDER: Feld[] = [
  {
    name: "leistung",
    bezeichnung: "Leistung",
    wert: "250",
    einheitErwartet: true,
    einheiten: ["W", "kW"],
  },
  {
    name: "spannung",
    bezeichnung: "Spannung",
    wert: "230 V",
    einheitErwartet: true,
    einheiten: ["V"],
  },
  { name: "hersteller", bezeichnung: "Hersteller", wert: "Muster GmbH" },
  {
    name: "kundennummer",
    bezeichnung: "Kundennummer",
    wert: GEHEIM[0] as string,
    ausgeschlossen: true,
  },
  { name: "pin", bezeichnung: "PIN", wert: GEHEIM[1] as string, art: "passwort" },
  { name: "intern", bezeichnung: "Interne Notiz", wert: GEHEIM[2] as string },
];

function im(felder: Feld[] = FELDER, konto = PIA): KontextEreignis {
  return { quelle: { art: "vorgang", kennung: BEREICH.kennung }, konto, felder };
}

function lage(jetzt: number, konto = PIA, darfBegleiten = true) {
  return { konto, darfBegleiten, jetzt };
}

function gestartet(dauer = "30 Minuten"): Begleitung {
  const r = starte(
    leseAuftrag(`Begleite mich ${dauer} bei der Produktrecherche`),
    BEREICH,
    { konto: PIA, jetzt: T0, id: "f-1" },
    { ausschluesse: ["intern"] },
  );
  if (!r.ok) {
    throw new Error(r.fehler);
  }
  return r.begleitung;
}

function ohneLeck(wert: unknown): void {
  const text = JSON.stringify(wert);
  for (const g of GEHEIM) {
    expect(text).not.toContain(g);
  }
}

describe("K1 · ein einfacher Auftrag schaltet Bereich und Zweck ein; Umfang und Endpunkt stehen fest", () => {
  it("ein Satz ergibt Zweck und Dauer; die Freigabe nennt Bereich und absoluten Endpunkt", () => {
    expect(leseAuftrag("Begleite mich 45 Minuten bei der Produktrecherche")).toEqual({
      zweck: "bei der Produktrecherche",
      dauerMin: 45,
      medien: [],
    });
    expect(leseAuftrag("Produktrecherche, 2 Stunden").dauerMin).toBe(120);
    expect(leseAuftrag("Produktrecherche").dauerMin).toBe(30);
    const b = gestartet("45 Minuten");
    expect(b.phase).toBe("aktiv");
    expect(b.freigabe?.modus).toBe("begleiten");
    expect(b.freigabe?.bereich).toEqual(BEREICH);
    expect(b.freigabe?.zweck).toBe("bei der Produktrecherche");
    expect(b.freigabe?.endetAm).toBe(T0 + 45 * MIN);
  });

  it("ohne Zweck oder mit unzulässiger Dauer startet nichts", () => {
    const ziel = { konto: PIA, jetzt: T0, id: "x" };
    expect(starte(leseAuftrag("Begleite mich 30 Minuten"), BEREICH, ziel)).toEqual({
      ok: false,
      fehler: "zweck_fehlt",
    });
    expect(starte(leseAuftrag("Recherche, 9 Stunden"), BEREICH, ziel)).toEqual({
      ok: false,
      fehler: "dauer_ungueltig",
    });
    expect(starte(leseAuftrag("Recherche, 0 Minuten"), BEREICH, ziel)).toEqual({
      ok: false,
      fehler: "dauer_ungueltig",
    });
  });
});

describe("K2 · nicht freigegebenes Fenster, privates Fenster, ausgeschlossenes Feld: nichts wird übernommen", () => {
  it("ausgeschlossene Felder, Passwortfelder und Ausschlüsse der Freigabe fehlen im Kontext", () => {
    const { begleitung, ergebnis } = nimmKontext(gestartet(), im(), lage(T0 + MIN));
    expect(ergebnis).toBe("uebernommen");
    expect(begleitung.kontext?.felder.map((f) => f.name)).toEqual([
      "leistung",
      "spannung",
      "hersteller",
    ]);
    ohneLeck(begleitung);
  });

  it("ein privates Fenster wird nicht gelesen — auch nicht mit der Kennung des Bereichs", () => {
    const vorher = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    const privat: KontextEreignis = {
      quelle: { art: "vorgang", kennung: BEREICH.kennung, privat: true },
      konto: PIA,
      felder: [{ name: "x", bezeichnung: "x", wert: GEHEIM[3] as string }],
    };
    const { begleitung, ergebnis } = nimmKontext(vorher, privat, lage(T0 + 2 * MIN));
    expect(ergebnis).toBe("privat");
    expect(begleitung.kontext).toBeNull();
    expect(begleitung.ausserhalb).toBe(true);
    ohneLeck(begleitung);
  });

  it("ein anderes Fenster/eine andere Domain wird nicht gelesen; der alte Kontext verfällt", () => {
    const vorher = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    const fremd: KontextEreignis = {
      quelle: { art: "domain", kennung: "privates-postfach.example" },
      konto: PIA,
      felder: [{ name: "betreff", bezeichnung: "Betreff", wert: GEHEIM[3] as string }],
    };
    const r = nimmKontext(vorher, fremd, lage(T0 + 2 * MIN));
    expect(r.ergebnis).toBe("ausserhalb");
    expect(r.begleitung.kontext).toBeNull();
    expect(r.begleitung.hinweis).toBeNull();
    ohneLeck(r.begleitung);
    const zurueck = nimmKontext(r.begleitung, im(), lage(T0 + 3 * MIN));
    expect(zurueck.ergebnis).toBe("uebernommen");
    expect(zurueck.begleitung.ausserhalb).toBe(false);
  });
});

describe("K3 · nach Stopp und während der Pause wird kein Kontext übernommen", () => {
  it("Stopp verwirft den Kontext; spätere Ereignisse bleiben draußen", () => {
    const mit = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    const aus = stoppe(mit);
    expect(aus.phase).toBe("beendet");
    expect(aus.kontext).toBeNull();
    const danach = nimmKontext(aus, im(), lage(T0 + 2 * MIN));
    expect(danach.ergebnis).toBe("nicht_aktiv");
    expect(danach.begleitung.kontext).toBeNull();
    expect(sicherung(danach.begleitung)).toBeNull();
  });

  it("Pause verwirft den Kontext; Ereignisse während der Pause bleiben draußen", () => {
    const mit = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    const pause = pausiere(mit, "nutzer");
    expect(pause.kontext).toBeNull();
    expect(nimmKontext(pause, im(), lage(T0 + 2 * MIN)).ergebnis).toBe("nicht_aktiv");
  });
});

describe("K4 · Mikrofon und Video bleiben aus; Begleiten ist keine Aufnahme und kein Lernen", () => {
  it("ein Auftrag, der Mikrofon, Video oder Aufnahme verlangt, wird abgewiesen", () => {
    const ziel = { konto: PIA, jetzt: T0, id: "x" };
    for (const satz of [
      "Begleite mich 30 Minuten bei der Recherche und nutze das Mikrofon",
      "Begleite mich bei der Recherche mit Video",
      "Begleite mich 30 Minuten und zeichne das Gespräch per Audio auf",
      "Begleite mich 30 Minuten und Meeting aufzeichnen",
    ]) {
      expect(starte(leseAuftrag(satz), BEREICH, ziel)).toEqual({
        ok: false,
        fehler: "medien_nicht_im_begleitmodus",
      });
    }
  });

  it("die Freigabe trägt alle Medien fest auf aus; die Auskunft nennt keine Aufnahme", () => {
    const b = gestartet();
    expect(b.freigabe?.medien).toEqual({ mikrofon: false, video: false, audio: false });
    const a = auskunft(b, []);
    expect(a.medien).toEqual({ mikrofon: "aus", video: "aus", audio: "aus" });
    expect(a.aufnahme).toBe("keine");
    expect(a.modus).toBe("begleiten");
  });

  it("eine Freigabe eines anderen Modus wird nicht als Begleitung wiederhergestellt", () => {
    const f = sicherung(gestartet());
    const fremd = { ...f, modus: "lernen" } as unknown as Parameters<typeof wiederherstellen>[0];
    expect(wiederherstellen(fremd, T0 + MIN)).toBe(AUS);
  });
});

describe("K5 · keine endlose Wiederholung; Ruhe und Unterbrechung zählen", () => {
  it("ein verworfener Hinweis kommt für die unveränderte Situation nie wieder", () => {
    let b = nimmKontext(gestartet("8 Stunden"), im(), lage(T0 + MIN)).begleitung;
    b = naechsterHinweis(b, T0 + MIN);
    expect(b.hinweis?.feld).toBe("leistung");
    b = verwirf(b);
    let gezeigt = 0;
    for (let i = 2; i < 400; i += 1) {
      const zeit = T0 + i * MIN;
      b = nimmKontext(b, im(), lage(zeit)).begleitung;
      b = naechsterHinweis(b, zeit);
      if (b.hinweis) {
        gezeigt += 1;
        b = verwirf(b);
      }
    }
    expect(gezeigt).toBe(0);
  });

  it("während der Nutzer tippt, und vor Ablauf der Ruhe kommt kein Hinweis", () => {
    let b = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    b = beschaeftigt(b, T0 + MIN + 1500);
    expect(naechsterHinweis(b, T0 + MIN + 1000).hinweis).toBeNull();
    b = naechsterHinweis(b, T0 + MIN + 1600);
    expect(b.hinweis?.feld).toBe("leistung");
    b = verwirf(b);
    // eine NEUE Situation (anderer Wert) — aber innerhalb der Ruhe von 2 Minuten
    const neu = FELDER.map((f) => (f.name === "leistung" ? { ...f, wert: "300" } : f));
    b = nimmKontext(b, im(neu), lage(T0 + 2 * MIN)).begleitung;
    expect(naechsterHinweis(b, T0 + 2 * MIN).hinweis).toBeNull();
    b = naechsterHinweis(b, T0 + 4 * MIN);
    expect(b.hinweis?.wert).toBe("300");
  });
});

describe("K6 · fehlende technische Einheit erkannt; nächster Schritt statt Dateneingabe", () => {
  it("nur die Zahl ohne Einheit im Einheitenfeld ist ein Befund", () => {
    const b = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    expect(befunde(b.kontext as NonNullable<Begleitung["kontext"]>)).toEqual([
      {
        signatur: "einheit_fehlt:leistung:250",
        art: "einheit_fehlt",
        feld: "leistung",
        bezeichnung: "Leistung",
        wert: "250",
        einheiten: ["W", "kW"],
      },
    ]);
  });

  it("der Hinweis trägt keine Schreibaktion, und die gelesenen Werte bleiben unverändert", () => {
    const ereignis = im();
    const kopie = JSON.parse(JSON.stringify(ereignis));
    let b = nimmKontext(gestartet(), ereignis, lage(T0 + MIN)).begleitung;
    b = naechsterHinweis(b, T0 + MIN);
    expect(Object.keys(b.hinweis ?? {}).sort()).toEqual(
      ["art", "bezeichnung", "einheiten", "feld", "signatur", "wert"].sort(),
    );
    expect(ereignis).toEqual(kopie);
    expect(b.kontext?.felder.find((f) => f.name === "leistung")?.wert).toBe("250");
  });
});

describe("K7 · Sperrbildschirm, Kontowechsel, Rechteentzug pausieren; Neustart verlängert nichts", () => {
  it("Sperrbildschirm pausiert; Fortsetzen nur durch den Nutzer, danach frischer Kontext", () => {
    let b = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    b = systemereignis(b, "sperrbildschirm");
    expect(b).toMatchObject({ phase: "pausiert", grund: "sperrbildschirm", kontext: null });
    expect(nimmKontext(b, im(), lage(T0 + 2 * MIN)).ergebnis).toBe("nicht_aktiv");
    const r = fortsetzen(b, lage(T0 + 3 * MIN));
    expect(r.ok).toBe(true);
    expect(r.begleitung.kontext).toBeNull();
  });

  it("Kontowechsel pausiert; Fortsetzen nur mit demselben Konto", () => {
    const b = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    const r = nimmKontext(b, im(FELDER, "u-ben"), lage(T0 + 2 * MIN, "u-ben"));
    expect(r.ergebnis).toBe("kontowechsel");
    expect(r.begleitung).toMatchObject({ phase: "pausiert", grund: "kontowechsel", kontext: null });
    expect(fortsetzen(r.begleitung, lage(T0 + 3 * MIN, "u-ben"))).toMatchObject({
      ok: false,
      fehler: "anderes_konto",
    });
    expect(fortsetzen(r.begleitung, lage(T0 + 3 * MIN)).ok).toBe(true);
  });

  it("Rechteentzug pausiert — auch vor einer Hintergrundaktualisierung; Fortsetzen erst mit Rechten", () => {
    const b = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    const r = nimmKontext(b, im(), lage(T0 + 2 * MIN, PIA, false));
    expect(r.ergebnis).toBe("rechteentzug");
    expect(r.begleitung.kontext).toBeNull();
    expect(fortsetzen(r.begleitung, lage(T0 + 3 * MIN, PIA, false))).toMatchObject({
      ok: false,
      fehler: "keine_rechte",
    });
    expect(fortsetzen(r.begleitung, lage(T0 + 3 * MIN)).ok).toBe(true);
  });

  it("am Endpunkt ist Schluss — auch durch Pause, Fortsetzen oder Neustart nicht verlängert", () => {
    const b = gestartet("30 Minuten");
    const ende = b.freigabe?.endetAm as number;
    const r = nimmKontext(b, im(), lage(ende));
    expect(r.ergebnis).toBe("abgelaufen");
    expect(r.begleitung).toMatchObject({ phase: "beendet", grund: "abgelaufen", kontext: null });

    const pause = pausiere(b, "nutzer");
    expect(fortsetzen(pause, lage(ende + 1))).toMatchObject({ ok: false, fehler: "abgelaufen" });

    const gesichert = sicherung(b);
    const vorEnde = wiederherstellen(gesichert, T0 + 10 * MIN);
    expect(vorEnde).toMatchObject({ phase: "pausiert", grund: "neustart", kontext: null });
    expect(vorEnde.freigabe?.endetAm).toBe(ende);
    expect(fortsetzen(vorEnde, lage(ende + MIN))).toMatchObject({
      ok: false,
      fehler: "abgelaufen",
    });
    expect(wiederherstellen(gesichert, ende + MIN)).toMatchObject({
      phase: "beendet",
      grund: "abgelaufen",
    });
  });
});

describe("K8 · keine Arbeitsplatzhistorie; Gespeichertes und Löschwirkung sind prüfbar", () => {
  it("es gibt genau einen flüchtigen Kontextstand, keinen Verlauf", () => {
    let b = gestartet();
    for (let i = 1; i <= 5; i += 1) {
      const felder = FELDER.map((f) =>
        f.name === "hersteller" ? { ...f, wert: `Firma ${i}` } : f,
      );
      b = nimmKontext(b, im(felder), lage(T0 + i * MIN)).begleitung;
    }
    expect(Object.keys(b).sort()).toEqual(
      [
        "ausserhalb",
        "beschaeftigtBis",
        "freigabe",
        "grund",
        "hinweis",
        "kontext",
        "letzterHinweisAm",
        "phase",
        "verworfen",
      ].sort(),
    );
    const text = JSON.stringify(b);
    for (let i = 1; i < 5; i += 1) {
      expect(text).not.toContain(`Firma ${i}"`);
    }
    expect(text).toContain("Firma 5");
    expect(auskunft(b, [])).toMatchObject({
      verlauf: "keiner",
      aufnahme: "keine",
      fluechtig: { felder: 3, hinweis: false },
    });
  });

  it("dauerhaft liegt nur die Freigabe ohne Inhalt; Stopp löscht auch die verworfenen Situationen", () => {
    let b = nimmKontext(gestartet(), im(), lage(T0 + MIN)).begleitung;
    b = verwirf(naechsterHinweis(b, T0 + MIN));
    const gesichert = JSON.stringify(sicherung(b));
    expect(gesichert).not.toContain('"250"');
    expect(gesichert).not.toContain("Muster GmbH");
    ohneLeck(gesichert);
    const aus = stoppe(b);
    expect(aus.verworfen).toEqual([]);
    expect(auskunft(aus, [])).toMatchObject({
      gespeichert: { freigabe: false, notizen: 0 },
      fluechtig: { felder: 0, hinweis: false },
    });
  });
});
