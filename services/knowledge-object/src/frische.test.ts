// aufnahme:20260922:gesamt-wissen-frische — die reine Ableitung aus `frische.ts`, ohne Dienst und Route.
// Jede Zusage steht mit ihrer Gegenprobe daneben: ein Fall, der nur „frisch" misst, wäre auch bei
// einer Funktion grün, die immer „frisch" sagt.
import { describe, expect, it } from "vitest";
import type { Erhoben } from "./display-status";
import {
  HALBWERTSZEIT_GRENZEN_TAGE,
  HALBWERTSZEIT_TAGE,
  aeltesteVorlageFuer,
  beobachtungenAus,
  discloseFrische,
  frischeVon,
  fristHinweiseFuer,
  halbwertszeitenAusVerlauf,
  haltbarkeitAbgelaufen,
} from "./frische";

/**
 * Lernstand über eine feste Objektmenge — jede Beobachtung gilt als zum Ende ihres Stands erfasst
 * (der Betrieb erfasst sie beim Lernen, `KoService.gelernteHalbwertszeiten`).
 */
function lerneHalbwertszeiten(kos: readonly KnowledgeObject[]) {
  const mitKennung = kos.map((k, i) => ({ ...k, id: `objekt-${i}` }));
  return halbwertszeitenAusVerlauf(
    beobachtungenAus(mitKennung).map((b) => ({ ...b, erfasst: b.ende })),
  );
}
import type { KnowledgeObject } from "./types";

const TAG = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-01-01T00:00:00.000Z");

function ko(teil: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "k1",
    title: "Ventil schließen",
    statement: "Bei Überdruck schließen.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 1,
    trust: 90,
    status: "validiert",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: new Date(START).toISOString(),
    history: [{ version: 1, at: new Date(START).toISOString(), author: "anna", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
    ...teil,
  };
}

const NEIN: Erhoben<boolean> = { wert: false };
const JA: Erhoben<boolean> = { wert: true };
const erhoben = { revalidierung: NEIN, konflikt: NEIN };
const H = HALBWERTSZEIT_TAGE.best_practice;

describe("Frische-Stufen (R-0652 / FR-EXT-06)", () => {
  it("frisch → altert → fällig → veraltet, gemessen an der Halbwertszeit der Wissensart", () => {
    expect(frischeVon(ko(), START + 10 * TAG, erhoben).stufe).toBe("frisch");
    expect(frischeVon(ko(), START + (H / 2 + 1) * TAG, erhoben).stufe).toBe("altert");
    expect(frischeVon(ko(), START + (H + 1) * TAG, erhoben).stufe).toBe("faellig");
    expect(frischeVon(ko(), START + (2 * H + 1) * TAG, erhoben).stufe).toBe("veraltet");
  });

  it("R-1636: dieselbe Zeitspanne ist für Technik fällig und für Bauchgefühl noch frisch", () => {
    const jetzt = START + (HALBWERTSZEIT_TAGE.technik + 1) * TAG;
    expect(frischeVon(ko({ type: "technik" }), jetzt, erhoben).stufe).toBe("faellig");
    expect(frischeVon(ko({ type: "bauchgefuehl" }), jetzt, erhoben).stufe).toBe("frisch");
    expect(frischeVon(ko({ type: "technik" }), jetzt, erhoben).halbwertszeitTage).toBe(180);
  });

  it("eine angeforderte erneute Prüfung macht auch frisches Wissen fällig", () => {
    const auskunft = frischeVon(ko(), START + TAG, { revalidierung: JA, konflikt: NEIN });
    expect(auskunft.stufe).toBe("faellig");
    expect(auskunft.gesichert).toBe(false);
    expect(auskunft.aktuellerStand).toBe(false);
    expect(auskunft.naechsterSchritt).toBe("erneut_bestaetigen");
  });

  it("ohne lesbares Datum wird nichts geraten: fällig und nicht gesichert", () => {
    const ohne = ko({ createdAt: "kein-datum", history: [] });
    const auskunft = frischeVon(ohne, START, erhoben);
    expect(auskunft.stufe).toBe("faellig");
    expect(auskunft.haltbarBis).toBeNull();
    expect(auskunft.gesichert).toBe(false);
    expect(haltbarkeitAbgelaufen(ohne, START)).toBe(true);
  });
});

describe("Haltbarkeit, Verantwortlicher, Erinnerung (R-0248)", () => {
  it("gesichert bis zum Fristende, danach nicht mehr", () => {
    const vorher = frischeVon(ko(), START + (H - 1) * TAG, erhoben);
    const nachher = frischeVon(ko(), START + (H + 1) * TAG, erhoben);
    expect(vorher.gesichert).toBe(true);
    expect(nachher.gesichert).toBe(false);
    expect(vorher.haltbarBis).toBe(new Date(START + H * TAG).toISOString());
    expect(haltbarkeitAbgelaufen(ko(), START + (H - 1) * TAG)).toBe(false);
    expect(haltbarkeitAbgelaufen(ko(), START + (H + 1) * TAG)).toBe(true);
  });

  it("der Verantwortliche wird vor Fristende erinnert — vorher nicht", () => {
    const frueh = frischeVon(ko(), START + (H - 30) * TAG, erhoben);
    const knapp = frischeVon(ko(), START + (H - 5) * TAG, erhoben);
    expect(frueh.erinnern).toBe(false);
    expect(knapp.erinnern).toBe(true);
    expect(knapp.naechsterSchritt).toBe("bald_bestaetigen");
  });

  it("Verantwortlich ist der benannte Eigentümer, sonst ausgewiesen der Autor", () => {
    const benannt = ko({ ownership: { owner: "bert", reviewers: [], validators: [] } });
    expect(frischeVon(benannt, START, erhoben).verantwortlich).toBe("bert");
    expect(frischeVon(benannt, START, erhoben).verantwortlichArt).toBe("owner");
    expect(frischeVon(ko(), START, erhoben).verantwortlich).toBe("anna");
    expect(frischeVon(ko(), START, erhoben).verantwortlichArt).toBe("author-fallback");
  });

  it("nur die Bestätigung des Verantwortlichen verlängert die Haltbarkeit", () => {
    const spaeter = new Date(START + (H - 10) * TAG).toISOString();
    const jetzt = START + (H + 5) * TAG;
    const fremd = ko({ frischeSignal: { at: spaeter, by: "carla" } });
    const eigen = ko({
      frischeSignal: { at: spaeter, by: "anna" },
      fristBestaetigung: { at: spaeter, by: "anna" },
    });
    // Das fremde Signal macht frischer (Stufe), aber die Frist bleibt abgelaufen.
    expect(frischeVon(fremd, jetzt, erhoben).stufe).toBe("faellig");
    expect(frischeVon(fremd, jetzt, erhoben).gesichert).toBe(false);
    expect(frischeVon(fremd, jetzt, erhoben).letztesSignal?.by).toBe("carla");
    // Die Bestätigung des Verantwortlichen setzt die Frist neu.
    expect(frischeVon(eigen, jetzt, erhoben).gesichert).toBe(true);
    expect(frischeVon(eigen, jetzt, erhoben).stufe).toBe("frisch");
  });

  it("eine neue Fassung (Bestätigung „Noch gültig“) setzt Frische und Frist neu", () => {
    const neu = new Date(START + (H + 1) * TAG).toISOString();
    const bestaetigt = ko({
      version: 2,
      history: [
        { version: 1, at: new Date(START).toISOString(), author: "anna", note: "erstellt" },
        { version: 2, at: neu, author: "bert", note: "überarbeitet" },
      ],
    });
    const auskunft = frischeVon(bestaetigt, START + (H + 2) * TAG, erhoben);
    expect(auskunft.stufe).toBe("frisch");
    expect(auskunft.gesichert).toBe(true);
  });
});

describe("Schutzbedarf, Betriebsmodell, Dokumente, aktueller Stand (R-0207 / R-0236 / R-0652)", () => {
  it("zwei Sichten: Schutzstufe und daraus die Empfehlung des Betriebsmodells", () => {
    expect(frischeVon(ko(), START, erhoben).schutz).toBe("intern");
    expect(frischeVon(ko(), START, erhoben).betriebsmodell).toBe("freigegebene_ki");
    const vertraulich = frischeVon(ko({ confidentiality: "vertraulich" }), START, erhoben);
    expect(vertraulich.betriebsmodell).toBe("lokales_modell");
    const streng = frischeVon(ko({ confidentiality: "streng_vertraulich" }), START, erhoben);
    expect(streng.betriebsmodell).toBe("ohne_ki");
    const kaputt = frischeVon(ko({ confidentiality: "quatsch" as never }), START, erhoben);
    expect(kaputt.schutz).toBeNull();
    expect(kaputt.betriebsmodell).toBe("ohne_ki");
  });

  it("in Dokumente nur geprüft, aktuell, ohne Konflikt und nicht vertraulich", () => {
    expect(frischeVon(ko(), START, erhoben).inDokumente).toBe(true);
    expect(frischeVon(ko({ status: "offen" }), START, erhoben).inDokumente).toBe(false);
    expect(frischeVon(ko(), START + (H + 1) * TAG, erhoben).inDokumente).toBe(false);
    expect(frischeVon(ko(), START, { revalidierung: NEIN, konflikt: JA }).inDokumente).toBe(false);
    expect(frischeVon(ko({ confidentiality: "vertraulich" }), START, erhoben).inDokumente).toBe(
      false,
    );
  });

  it("ein nicht erhobener Eingang sperrt die Freigabe und steht mit Grund da", () => {
    const auskunft = frischeVon(ko(), START, {
      revalidierung: { ungeprueft: "Merkerablage nicht erreichbar." },
      konflikt: NEIN,
    });
    expect(auskunft.inDokumente).toBe(false);
    expect(auskunft.gesichert).toBe(false);
    expect(auskunft.ungeprueft.revalidierung).toBe("Merkerablage nicht erreichbar.");
    expect(auskunft.ungeprueft.konflikt).toBeUndefined();
  });

  it("aktueller Stand und nächster Schritt folgen dem Zustand", () => {
    expect(frischeVon(ko(), START, erhoben).aktuellerStand).toBe(true);
    expect(frischeVon(ko(), START, erhoben).naechsterSchritt).toBe("keiner");
    expect(frischeVon(ko({ status: "offen" }), START, erhoben).aktuellerStand).toBe(false);
    expect(frischeVon(ko({ status: "offen" }), START, erhoben).naechsterSchritt).toBe(
      "validierung_abschliessen",
    );
    expect(frischeVon(ko(), START, { revalidierung: NEIN, konflikt: JA }).naechsterSchritt).toBe(
      "konflikt_klaeren",
    );
  });

  it("discloseFrische liefert genau ein Feld `frische`", () => {
    expect(Object.keys(discloseFrische(ko(), START, erhoben))).toEqual(["frische"]);
  });
});

// ================================================================================================
// Nacharbeit 2 (Bens Befunde zu R-0652, R-1636, R-0248, R-0266).
// ================================================================================================

/** Ein Objekt mit Fassungen im Abstand von `abstand` Tagen (erste Fassung bei START). */
function mitFassungen(id: string, kategorie: string, abstaende: number[]): KnowledgeObject {
  let t = START;
  const history = [{ version: 1, at: new Date(t).toISOString(), author: "anna", note: "erstellt" }];
  abstaende.forEach((tage, i) => {
    t += tage * TAG;
    history.push({
      version: i + 2,
      at: new Date(t).toISOString(),
      author: "anna",
      note: "überarbeitet",
    });
  });
  return ko({ id, category: kategorie, history, version: history.length });
}

/** Ein Objekt, dessen einzige Fassung `tage` Tage nach START entstand. */
function standAb(tage: number): KnowledgeObject {
  const beginn = new Date(START + tage * TAG).toISOString();
  return ko({
    createdAt: beginn,
    history: [{ version: 1, at: beginn, author: "anna", note: "erstellt" }],
  });
}

describe("R-0652 · Schutzbedarf „öffentlich“", () => {
  it("öffentlich ist eine eigene Stufe der Schutzsicht mit eigener Empfehlung", () => {
    const offen = frischeVon(ko({ oeffentlich: true }), START, erhoben);
    expect(offen.schutz).toBe("oeffentlich");
    expect(offen.betriebsmodell).toBe("oeffentliche_ki");
    expect(offen.inDokumente).toBe(true);
    // Die vier Stufen der Quelle sind alle darstellbar und unterscheidbar.
    const stufen = [
      frischeVon(ko({ oeffentlich: true }), START, erhoben).schutz,
      frischeVon(ko(), START, erhoben).schutz,
      frischeVon(ko({ confidentiality: "vertraulich" }), START, erhoben).schutz,
      frischeVon(ko({ confidentiality: "streng_vertraulich" }), START, erhoben).schutz,
    ];
    expect(stufen).toEqual(["oeffentlich", "intern", "vertraulich", "streng_vertraulich"]);
  });

  it("GEGENPROBE: an einem vertraulichen Objekt gewinnt die strengere Stufe", () => {
    const widerspruch = frischeVon(
      ko({ oeffentlich: true, confidentiality: "vertraulich" }),
      START,
      erhoben,
    );
    expect(widerspruch.schutz).toBe("vertraulich");
    expect(widerspruch.betriebsmodell).toBe("lokales_modell");
  });
});

describe("R-1636 · aus der Bewährungs-Historie gelernte Halbwertszeit je Kategorie", () => {
  it("der Median der Fassungsabstände einer Kategorie wird ihre Halbwertszeit", () => {
    const tabelle = lerneHalbwertszeiten([
      mitFassungen("a", "Hydraulik", [40, 60]),
      mitFassungen("b", " hydraulik ", [50]),
      mitFassungen("c", "Elektrik", [300]),
    ]);
    // Hydraulik: Abstände 40, 60, 50 → Median 50, drei Beobachtungen (Schreibweise egal).
    expect(tabelle.get("hydraulik")).toEqual({ tage: 50, beobachtungen: 3 });
    // Elektrik: nur eine Beobachtung — zu wenig, keine gelernte Zeit.
    expect(tabelle.has("elektrik")).toBe(false);
  });

  it("die gelernte Zeit steuert Stufe und Frist; ohne Lernstand gilt ausgewiesen die Vorgabe", () => {
    // Beobachtungen enden bei START+40/80/120 — der Stand des Objekts beginnt danach (START+130).
    const gelernt = lerneHalbwertszeiten([mitFassungen("a", "Anlage 1", [40, 40, 40])]);
    const stand = standAb(130);
    const jetzt = START + 190 * TAG;
    const mit = frischeVon(stand, jetzt, erhoben, gelernt);
    expect(mit.halbwertszeitHerkunft).toBe("gelernt");
    expect(mit.halbwertszeitTage).toBe(40);
    expect(mit.halbwertszeitBeobachtungen).toBe(3);
    expect(mit.stufe).toBe("faellig");
    expect(mit.gesichert).toBe(false);
    expect(haltbarkeitAbgelaufen(stand, jetzt, gelernt)).toBe(true);
    // GEGENPROBE: dasselbe Objekt ohne Lernstand — Vorgabe der Wissensart (365 Tage), noch frisch.
    const ohne = frischeVon(stand, jetzt, erhoben);
    expect(ohne.halbwertszeitHerkunft).toBe("vorgabe");
    expect(ohne.halbwertszeitTage).toBe(H);
    expect(ohne.halbwertszeitBeobachtungen).toBe(0);
    expect(ohne.stufe).toBe("frisch");
    expect(haltbarkeitAbgelaufen(stand, jetzt)).toBe(false);
  });

  it("Nacharbeit 4 · eine später verlängerte Kategoriezeit gibt abgelaufenes Wissen nicht frei", () => {
    // Lernstand 40 Tage bis START+120; der Stand des Objekts beginnt bei START+130.
    const frueh = [mitFassungen("a", "Anlage 1", [40, 40, 40])];
    const beginn = new Date(START + 130 * TAG).toISOString();
    const stand = standAb(130);
    const jetzt = START + 190 * TAG; // 60 Tage unverändert → nach 40 Tagen abgelaufen
    const vorher = lerneHalbwertszeiten(frueh);
    expect(haltbarkeitAbgelaufen(stand, jetzt, vorher)).toBe(true);

    // Danach lernen ANDERE Objekte derselben Kategorie lange Abstände — ihre Beobachtungen enden
    // NACH dem Beginn des Stands (START+150/160/170) und vor `jetzt`.
    const lang = (id: string, endeTage: number): KnowledgeObject => {
      const von = new Date(START - 300 * TAG).toISOString();
      const bis = new Date(START + endeTage * TAG).toISOString();
      return ko({
        id,
        history: [
          { version: 1, at: von, author: "anna", note: "erstellt" },
          { version: 2, at: bis, author: "anna", note: "überarbeitet" },
        ],
      });
    };
    const verlaengert = lerneHalbwertszeiten([
      ...frueh,
      lang("b", 150),
      lang("c", 160),
      lang("d", 170),
    ]);
    expect(verlaengert.get("anlage 1")?.tage, "der Lernstand JETZT ist länger").toBeGreaterThan(
      100,
    );

    // Das abgelaufene Objekt bleibt abgelaufen — in der Auskunft UND im Antwortpfad.
    const auskunft = frischeVon(stand, jetzt, erhoben, verlaengert);
    expect(auskunft.halbwertszeitTage).toBe(40);
    expect(auskunft.gesichert).toBe(false);
    expect(auskunft.stufe).toBe("faellig");
    expect(haltbarkeitAbgelaufen(stand, jetzt, verlaengert)).toBe(true);

    // Erst die Bestätigung des Verantwortlichen beginnt einen neuen Stand — mit dem neuen Lernstand.
    const bestaetigt = ko({
      createdAt: beginn,
      history: [{ version: 1, at: beginn, author: "anna", note: "erstellt" }],
      fristBestaetigung: { at: new Date(jetzt).toISOString(), by: "anna" },
    });
    const danach = frischeVon(bestaetigt, jetzt, erhoben, verlaengert);
    expect(danach.gesichert).toBe(true);
    expect(danach.halbwertszeitTage).toBe(verlaengert.get("anlage 1")?.tage);
    expect(haltbarkeitAbgelaufen(bestaetigt, jetzt, verlaengert)).toBe(false);
    // GEGENPROBE: ein fremdes Frische-Signal beginnt keinen neuen Stand.
    const fremd = ko({
      createdAt: beginn,
      history: [{ version: 1, at: beginn, author: "anna", note: "erstellt" }],
      frischeSignal: { at: new Date(jetzt).toISOString(), by: "carla" },
    });
    expect(haltbarkeitAbgelaufen(fremd, jetzt, verlaengert)).toBe(true);
  });

  it("eine gelernte Zeit bleibt in ihren Grenzen", () => {
    const kurz = lerneHalbwertszeiten([mitFassungen("a", "Takt", [1, 2, 3])]);
    expect(kurz.get("takt")?.tage).toBe(HALBWERTSZEIT_GRENZEN_TAGE.min);
  });
});

describe("R-0248 / R-0266 · was der verantwortlichen Person vorgelegt wird", () => {
  it("Fristhinweis im Erinnerungsfenster und nach Ablauf — vorher und für Fremde nicht", () => {
    const eigen = ko({ id: "eigen", title: "Eigenes" });
    const fremd = ko({ id: "fremd", title: "Fremdes", author: "bert", originalAuthor: "bert" });
    expect(fristHinweiseFuer([eigen, fremd], "anna", START + (H - 30) * TAG)).toEqual([]);
    const knapp = fristHinweiseFuer([eigen, fremd], "anna", START + (H - 5) * TAG);
    expect(knapp.map((h) => [h.koId, h.abgelaufen])).toEqual([["eigen", false]]);
    const danach = fristHinweiseFuer([eigen, fremd], "anna", START + (H + 5) * TAG);
    expect(danach.map((h) => [h.koId, h.abgelaufen])).toEqual([["eigen", true]]);
    // Ungeprüftes Wissen hat keine Frist, an die erinnert würde.
    expect(fristHinweiseFuer([ko({ status: "offen" })], "anna", START + (H - 5) * TAG)).toEqual([]);
  });

  it("Vorlage: die ältesten geprüften Beiträge der Person, ältester zuerst, gedeckelt", () => {
    const kos = [
      mitFassungen("neu", "A", [100]),
      mitFassungen("alt", "A", []),
      ko({ id: "fremd", author: "bert", originalAuthor: "bert" }),
      ko({ id: "offen", status: "offen" }),
      mitFassungen("mitte", "A", [50]),
    ];
    const jetzt = START + 120 * TAG;
    expect(aeltesteVorlageFuer(kos, "anna", jetzt, 5).map((v) => v.koId)).toEqual([
      "alt",
      "mitte",
      "neu",
    ]);
    expect(aeltesteVorlageFuer(kos, "anna", jetzt, 1).map((v) => v.koId)).toEqual(["alt"]);
    expect(aeltesteVorlageFuer(kos, "carla", jetzt, 5)).toEqual([]);
  });
});
