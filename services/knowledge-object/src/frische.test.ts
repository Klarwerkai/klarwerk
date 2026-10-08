// aufnahme:20260922:gesamt-wissen-frische — die reine Ableitung aus `frische.ts`, ohne Dienst und Route.
// Jede Zusage steht mit ihrer Gegenprobe daneben: ein Fall, der nur „frisch" misst, wäre auch bei
// einer Funktion grün, die immer „frisch" sagt.
import { describe, expect, it } from "vitest";
import type { Erhoben } from "./display-status";
import { HALBWERTSZEIT_TAGE, discloseFrische, frischeVon, haltbarkeitAbgelaufen } from "./frische";
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
