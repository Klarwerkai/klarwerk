// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender) · EIN STRENGES VERTRAGSDOUBLE DES KALENDERANBIETERS.
// ================================================================================================
//
// Für den Servertest (`kalender-am-server.test.ts`) und den Postgres-Test
// (`kalender-pg.integration.test.ts`): ein Kalender im Speicher mit Fassungen. STRENG wie `If-Match`
// — eine leere oder abweichende Fassung wird beim Ändern und Löschen abgewiesen und als
// `ohneFassung` vermerkt, falls sie leer war. Kein Netz, ausschließlich fiktive Daten. Es ersetzt
// keinen echten Microsoft-365-Testkalender.
import {
  type AnbieterFehlerlage,
  type AnbieterKalender,
  type AnbieterKonto,
  type AnbieterTermin,
  type KalenderAnbieter,
  KalenderAnbieterFehler,
  type KalenderInhalt,
} from "../../services/app/src/klara-kalender-anbindung";

export const DOUBLE_KONTO: AnbieterKonto = {
  kennung: "obj-testkalender-0001",
  anzeige: "Testkalender Klarwerk",
  adresse: "testkalender@klarwerk-test.example",
};

export const DOUBLE_KALENDER: AnbieterKalender = {
  id: "kal-test",
  name: "Testkalender",
  art: "eigen",
  besitzer: DOUBLE_KONTO.adresse,
  rechte: { lesen: true, eigeneSchreiben: true, geteiltBearbeiten: false, einladen: true },
};

export class StrengerTestkalender implements KalenderAnbieter {
  readonly art = "microsoft365" as const;
  readonly termine = new Map<string, AnbieterTermin>();
  readonly aufrufe: string[] = [];
  readonly ohneFassung: string[] = [];
  /** Lässt das nächste `hole` mit dieser Lage scheitern (z. B. Zugang nach dem Anlegen abgelaufen). */
  holeStoerung: AnbieterFehlerlage | null = null;
  private nr = 0;
  private ids = 0;

  private fassung(): string {
    this.nr += 1;
    return `W/"d${this.nr}"`;
  }

  async konto(): Promise<AnbieterKonto> {
    this.aufrufe.push("konto");
    return DOUBLE_KONTO;
  }

  async kalender(): Promise<AnbieterKalender[]> {
    this.aufrufe.push("kalender");
    return [DOUBLE_KALENDER];
  }

  async liesZeitraum(kalenderId: string, von: string, bis: string): Promise<AnbieterTermin[]> {
    this.aufrufe.push("liesZeitraum");
    return [...this.termine.values()].filter(
      (t) => t.kalenderId === kalenderId && t.beginn < bis && t.ende > von,
    );
  }

  async hole(kalenderId: string, id: string): Promise<AnbieterTermin | null> {
    this.aufrufe.push("hole");
    // Eine einmalige Störung NACH dem Schreiben: die Wirkung ist da, ihr Nachlesen scheitert.
    if (this.holeStoerung) {
      const lage = this.holeStoerung;
      this.holeStoerung = null;
      throw new KalenderAnbieterFehler(lage);
    }
    const t = this.termine.get(id);
    return t && t.kalenderId === kalenderId ? t : null;
  }

  async sucheVorgang(kalenderId: string, vorgang: string): Promise<AnbieterTermin | null> {
    this.aufrufe.push("sucheVorgang");
    for (const t of this.termine.values()) {
      if (t.kalenderId === kalenderId && t.vorgang === vorgang) {
        return t;
      }
    }
    return null;
  }

  async lege(
    kalenderId: string,
    inhalt: Partial<KalenderInhalt>,
    vorgang: string,
  ): Promise<AnbieterTermin> {
    this.aufrufe.push("lege");
    this.ids += 1;
    const t: AnbieterTermin = {
      id: `dbl-${this.ids}`,
      kalenderId,
      version: this.fassung(),
      titel: inhalt.titel ?? "",
      beginn: inhalt.beginn ?? "",
      ende: inhalt.ende ?? "",
      zeitzone: inhalt.zeitzone ?? "",
      ort: inhalt.ort ?? "",
      beschreibung: inhalt.beschreibung ?? "",
      teilnehmer: inhalt.teilnehmer ?? [],
      serienart: "einzel",
      serienId: null,
      abgesagt: false,
      organisator: DOUBLE_KONTO.adresse,
      vorgang,
    };
    this.termine.set(t.id, t);
    return t;
  }

  private pruefeFassung(methode: string, id: string, version: string): AnbieterTermin {
    const alt = this.termine.get(id);
    if (!alt) {
      throw new KalenderAnbieterFehler("nicht_gefunden");
    }
    if (version !== alt.version) {
      if (!version) {
        this.ohneFassung.push(`${methode}:${id}`);
      }
      throw new KalenderAnbieterFehler("version_geaendert");
    }
    return alt;
  }

  async aendere(
    _kalenderId: string,
    id: string,
    inhalt: Partial<KalenderInhalt>,
    version: string,
  ): Promise<AnbieterTermin> {
    this.aufrufe.push("aendere");
    const alt = this.pruefeFassung("aendere", id, version);
    const neu = { ...alt, ...inhalt, version: this.fassung() };
    this.termine.set(id, neu);
    return neu;
  }

  async loesche(_kalenderId: string, id: string, version: string): Promise<void> {
    this.aufrufe.push("loesche");
    this.pruefeFassung("loesche", id, version);
    this.termine.delete(id);
  }

  /** Eine Änderung durch eine andere Person direkt im Kalender. */
  aendereExtern(id: string, inhalt: Partial<AnbieterTermin>): void {
    const alt = this.termine.get(id);
    if (!alt) {
      throw new Error(`unbekannt: ${id}`);
    }
    this.termine.set(id, { ...alt, ...inhalt, version: this.fassung() });
  }
}

/** Ein fiktiver interner Termin in der Form, die die Anwendungstür erwartet. */
export function testTermin(ereignisId = "ereignis-1", titel = "Zertifikat TÜV verlängern") {
  return {
    auftragId: "auftrag-zertifikat-3",
    ereignisId,
    fassung: 1,
    privat: false,
    serienart: "einzel",
    abgesagt: false,
    inhalt: {
      titel,
      beginn: "2026-10-26T09:00:00",
      ende: "2026-10-26T09:30:00",
      zeitzone: "Europe/Berlin",
      ort: "Büro 2",
      beschreibung: "Unterlagen bereitlegen",
      teilnehmer: [],
    },
  };
}
