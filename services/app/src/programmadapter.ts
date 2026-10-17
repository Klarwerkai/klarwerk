// ================================================================================================
// produkt:20261011:assistenz-programmadapter (BPA-04) — GEMEINSAME ADAPTER STATT EINZELASSISTENTEN.
// ================================================================================================
//
// Klara hilft in anderen Programmen nur über EINEN Kern: dieselbe Anmeldung, dasselbe
// Assistenzprofil, derselbe Sitzungs-/Ausführungsweg, dieselbe Quellenprüfung. Diese Datei ist der
// Teil, der je Programm verschieden ist — und sie hält ihn klein:
//
//   1. DAS REGISTER (`PROGRAMM_REGISTER`): je Programm Weg, Schnittstelle, Lesen/Auswahl/Schreiben/
//      Ergebnisprüfung/Rücknahme mit ehrlichem Stand und Grenze. Was nicht drinsteht, ist nicht
//      unterstützt — es gibt kein „alle Programme".
//   2. DIE HOSTBELEGE (`HOSTBELEGE`): ein Stand „real belegt" entsteht NUR aus einem Beleg, der
//      genau diesen Host, Host- und OS-Fassung, Kandidat und Datum nennt. Ein Word-Beleg hebt kein
//      Excel, Outlook oder PowerPoint. Am Stand dieses Kandidaten ist die Liste LEER: ein realer Lauf
//      mit dem heutigen Weg ist nicht festgehalten (docs/operations/word-mac-hostabnahme/README.md).
//   3. DIE REGELN VOR JEDER WIRKUNG: Zielbindung (Fokus-/Dokument-/Kontowechsel), Kontext nach
//      Host-/Kontowechsel, OS-Rechte je Adapter ohne Bildschirm-Umweg, Bedienelement statt
//      Koordinate, Klärung bei OCR und mehrdeutigem Ziel, Aufnahme nur der gewählten Datei.
//
// Was hier NICHT steht: eine eigene Anmeldung, ein eigener Speicher, eine eigene Assistenz. Die
// Dienste, aus denen Anmeldung, Avatar, Quellenprüfung, persönlicher Speicher und Aktionen kommen,
// sind EINMAL in `GEMEINSAME_DIENSTE` benannt und gelten für jedes Programm gleich.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ProgrammKennung =
  | "word-mac"
  | "word-web"
  | "finder"
  | "excel"
  | "outlook"
  | "powerpoint";

export type Faehigkeit = "lesen" | "auswahl" | "schreiben" | "ergebnispruefung" | "ruecknahme";

export const FAEHIGKEITEN: readonly Faehigkeit[] = [
  "lesen",
  "auswahl",
  "schreiben",
  "ergebnispruefung",
  "ruecknahme",
];

/**
 * `real-belegt`            — ein Hostbeleg nennt genau diesen Host, seine Fassung und den Kandidaten.
 * `gebaut-ohne-hostbeleg`  — der Weg liegt im Kandidaten, ein realer Lauf ist nicht festgehalten.
 * `nicht-geliefert`        — es gibt diesen Weg (noch) nicht.
 * `ausgeschlossen`         — bewusst nie (z. B. Finder-Datei verschieben oder löschen).
 */
export type FaehigkeitsStand =
  | "real-belegt"
  | "gebaut-ohne-hostbeleg"
  | "nicht-geliefert"
  | "ausgeschlossen";

/** Der technische Weg in das Programm — offizielle Schnittstelle zuerst. */
export type AdapterWeg = "office-js" | "datei-auswahl" | "bedienungshilfe" | "keiner";

export interface FaehigkeitsEintrag {
  readonly stand: FaehigkeitsStand;
  /** Was genau geht und wo die Grenze liegt — in Worten, die ein Mensch versteht. */
  readonly grenze: string;
}

/** Ein ausdrücklich getesteter Bedienungshilfe-Rückfall: genau ein Host, eine Fassung, ein Zweck. */
export interface BedienungshilfeRueckfall {
  readonly bundleId: string;
  readonly hostVersion: string;
  readonly zwecke: readonly string[];
}

/**
 * Der EINE begrenzte Lesezweck über die macOS-Bedienungshilfe: die Markierung des vordersten
 * Fensters genau dieses Programms lesen. Kein Klick, keine Eingabe, keine Bedienung — eine
 * Aktion über die Bedienungshilfe braucht weiterhin einen getesteten `bedienungshilfeRueckfall`.
 */
export interface BedienungshilfeLesen {
  readonly bundleId: string;
  readonly zweck: "markierung-lesen";
  readonly stand: FaehigkeitsStand;
}

/** Die macOS-Fassung: wofür der Weg gebaut ist und welche Fassung real geprüft wurde. */
export interface OsFassung {
  /** Untergrenze, die der Weg technisch voraussetzt — `null`, wenn es keinen Weg gibt. */
  readonly unterstuetzt: string | null;
  /** Die real geprüfte Fassung — `null`, solange kein Hostbeleg sie nennt. */
  readonly realGeprueft: string | null;
}

export interface ProgrammEintrag {
  readonly programm: ProgrammKennung;
  readonly anzeigename: string;
  readonly plattform: string;
  readonly weg: AdapterWeg;
  readonly schnittstelle: string;
  /** Die Fassung, ab der der Weg gebaut ist — oder `null`, wenn es keinen Weg gibt. */
  readonly mindestfassung: string | null;
  readonly os: OsFassung;
  readonly faehigkeiten: Readonly<Record<Faehigkeit, FaehigkeitsEintrag>>;
  /** Getesteter Bedienungshilfe-Rückfall — `null`: es gibt keinen, also keine Bedienung per AX. */
  readonly bedienungshilfeRueckfall: BedienungshilfeRueckfall | null;
  /** Begrenzter Lesezweck über die Bedienungshilfe — `null`: keiner. */
  readonly bedienungshilfeLesen: BedienungshilfeLesen | null;
  readonly grenzen: readonly string[];
}

/**
 * Das Bauziel des Klara-Begleiters (`apps/desktop/klara-begleiter/Package.swift`, `.macOS(.v13)`).
 * Eine technische Untergrenze des gebauten Wegs — keine real geprüfte Fassung.
 */
export const BEGLEITER_MACOS_MINDESTENS = "macOS 13 (Ventura)";

const KEIN_OS: OsFassung = { unterstuetzt: null, realGeprueft: null };

function alle(stand: FaehigkeitsStand, grenze: string): Record<Faehigkeit, FaehigkeitsEintrag> {
  return {
    lesen: { stand, grenze },
    auswahl: { stand, grenze },
    schreiben: { stand, grenze },
    ergebnispruefung: { stand, grenze },
    ruecknahme: { stand, grenze },
  };
}

const KEIN_HOSTBELEG =
  "Kein Hostbeleg für dieses Programm. Ein Erfolg in Word zählt hier nicht; das Programm gilt bis " +
  "zu einem eigenen realen Lauf als nicht geliefert.";

const WORD_FAEHIGKEITEN: Record<Faehigkeit, FaehigkeitsEintrag> = {
  lesen: {
    stand: "gebaut-ohne-hostbeleg",
    grenze:
      "Liest Auswahl oder ganzes Dokument über Office.js (Word.run, sonst " +
      "getSelectedDataAsync).",
  },
  auswahl: {
    stand: "gebaut-ohne-hostbeleg",
    grenze:
      "Übernimmt nur die aktuelle Markierung im Dokument dieser Sitzung; der Server bindet sie an " +
      "die documentContextId.",
  },
  schreiben: {
    stand: "gebaut-ohne-hostbeleg",
    grenze:
      "Fügt nur auf ausdrücklichen Klick ein (Word.run zuerst, sonst setSelectedDataAsync) — nach " +
      "Prüfung, dass Dokument, Auswahl und Konto noch dieselben sind.",
  },
  ergebnispruefung: {
    stand: "gebaut-ohne-hostbeleg",
    grenze:
      "Sollvergleich nach Speichern, Schließen, Wiederöffnen (tools/word-host-wiederoeffnen.ts); " +
      "je Host getrennt.",
  },
  ruecknahme: {
    stand: "nicht-geliefert",
    grenze:
      "Klara bietet keine eigene Rücknahme an. Rückgängig machen geht über Word selbst " +
      "(Bearbeiten → Widerrufen), solange das Dokument offen ist.",
  },
};

export const PROGRAMM_REGISTER: readonly ProgrammEintrag[] = [
  {
    programm: "word-mac",
    anzeigename: "Word für Mac",
    plattform: "macOS",
    weg: "office-js",
    schnittstelle: "Office-Add-in (Office.js, WordApi 1.1) — der vorhandene Klara-Word-Weg",
    // Belegt ist bisher nur der Sideload in Word für Mac 16.111 am 24.07.2026 — kein Lese-/
    // Schreiblauf mit dem heutigen Weg (docs/operations/word-mac-hostabnahme/README.md).
    mindestfassung: "Word für Mac 16.111 (Sideload belegt 24.07.2026); WordApi 1.1",
    os: { unterstuetzt: BEGLEITER_MACOS_MINDESTENS, realGeprueft: null },
    faehigkeiten: WORD_FAEHIGKEITEN,
    bedienungshilfeRueckfall: null,
    bedienungshilfeLesen: {
      bundleId: "com.microsoft.Word",
      zweck: "markierung-lesen",
      stand: "gebaut-ohne-hostbeleg",
    },
    grenzen: [
      "Nur das Dokument, in dem Klara geöffnet ist; ein anderes offenes Dokument wird nicht gelesen.",
      "Ein Bildschirmbild ist kein bearbeitbares Word-Dokument und kein Schreibzugriff.",
      "Einfügen nur nach Zielprüfung am Server: dieselbe Sitzung, dasselbe Dokument, dieselbe " +
        "Markierung wie beim Fragen.",
      "Bedienungshilfe nur zum Lesen der Markierung über den Klara-Begleiter — kein Klick, keine " +
        "Eingabe. Ohne Bedienungshilfe-Freigabe stoppt dieser Weg; Word über das Add-in läuft weiter.",
      `Unterstützt ab ${BEGLEITER_MACOS_MINDESTENS}; die real geprüfte macOS-Fassung ist offen.`,
      "Realer Lauf mit diesem Kandidaten offen (M1–M10, MS1–MS4 der Word-Mac-Hostabnahme).",
    ],
  },
  {
    programm: "word-web",
    anzeigename: "Word im Browser",
    plattform: "Browser (Microsoft 365)",
    weg: "office-js",
    schnittstelle: "Office-Add-in (Office.js) — derselbe Klara-Word-Weg, eigener Host",
    mindestfassung: "WordApi 1.1",
    os: KEIN_OS,
    faehigkeiten: WORD_FAEHIGKEITEN,
    bedienungshilfeRueckfall: null,
    bedienungshilfeLesen: null,
    grenzen: [
      "Getrennt von Word für Mac abzunehmen; ein Ergebnis aus einem Host zählt nicht für den anderen.",
    ],
  },
  {
    programm: "finder",
    anzeigename: "Finder (gewählte Datei)",
    plattform: "macOS",
    weg: "datei-auswahl",
    schnittstelle:
      "Klara-Begleiter (apps/desktop/klara-begleiter): Systemdialog für genau eine Datei → " +
      "POST /api/klara/programme/finder → vorhandene Objektablage",
    mindestfassung: null,
    os: { unterstuetzt: BEGLEITER_MACOS_MINDESTENS, realGeprueft: null },
    faehigkeiten: {
      lesen: {
        stand: "gebaut-ohne-hostbeleg",
        grenze:
          "Liest nur die eine im Systemdialog gewählte Datei und legt sie mit Herkunft und Fassung " +
          "in der vorhandenen Objektablage ab (Schutzklasse ungeklärt, also geschützt).",
      },
      auswahl: {
        stand: "gebaut-ohne-hostbeleg",
        grenze: "Nur eine ausdrücklich gewählte Datei — kein Ordner, keine Nachbardateien.",
      },
      schreiben: {
        stand: "ausgeschlossen",
        grenze: "Klara verschiebt, ändert oder löscht keine Datei im Finder.",
      },
      ergebnispruefung: {
        stand: "gebaut-ohne-hostbeleg",
        grenze:
          "Fassung (SHA-256, Größe, Änderungszeit) wird bei der Aufnahme festgehalten; der Server " +
          "rechnet die Prüfsumme nach und nimmt eine abweichende Datei nicht an.",
      },
      ruecknahme: {
        stand: "ausgeschlossen",
        grenze: "Die Aufnahme ändert die Datei nicht; es gibt nichts zurückzunehmen.",
      },
    },
    bedienungshilfeRueckfall: null,
    bedienungshilfeLesen: null,
    grenzen: [
      "Ohne Dateifreigabe des Systems stoppt dieser Weg — ein Bildschirmbild ersetzt die Datei nicht.",
      `Unterstützt ab ${BEGLEITER_MACOS_MINDESTENS}; die real geprüfte macOS-Fassung ist offen.`,
    ],
  },
  {
    programm: "excel",
    anzeigename: "Excel",
    plattform: "—",
    weg: "keiner",
    schnittstelle: "—",
    mindestfassung: null,
    os: KEIN_OS,
    faehigkeiten: alle("nicht-geliefert", KEIN_HOSTBELEG),
    bedienungshilfeRueckfall: null,
    bedienungshilfeLesen: null,
    grenzen: [KEIN_HOSTBELEG],
  },
  {
    programm: "outlook",
    anzeigename: "Outlook",
    plattform: "—",
    weg: "keiner",
    schnittstelle: "—",
    mindestfassung: null,
    os: KEIN_OS,
    faehigkeiten: alle("nicht-geliefert", KEIN_HOSTBELEG),
    bedienungshilfeRueckfall: null,
    bedienungshilfeLesen: null,
    grenzen: [KEIN_HOSTBELEG],
  },
  {
    programm: "powerpoint",
    anzeigename: "PowerPoint",
    plattform: "—",
    weg: "keiner",
    schnittstelle: "—",
    mindestfassung: null,
    os: KEIN_OS,
    faehigkeiten: alle("nicht-geliefert", KEIN_HOSTBELEG),
    bedienungshilfeRueckfall: null,
    bedienungshilfeLesen: null,
    grenzen: [KEIN_HOSTBELEG],
  },
];

// ------------------------------------------------------------------------------------------------
// HOSTBELEGE — die einzige Quelle für „real belegt"
// ------------------------------------------------------------------------------------------------

export interface HostBeleg {
  readonly programm: ProgrammKennung;
  readonly hostVersion: string;
  readonly osVersion: string;
  /** Kandidat (Produktfassung bzw. Commit), an dem der Lauf stattfand. */
  readonly kandidat: string;
  /** Zeitpunkt des Laufs (ISO 8601 mit Zone). */
  readonly zeitpunkt: string;
  readonly faehigkeiten: readonly Faehigkeit[];
  /** Ablageort des Protokolls im Repository. */
  readonly protokoll: string;
}

/**
 * Am Stand dieses Kandidaten LEER: kein realer Lese-/Schreiblauf in Word für Mac, kein Finder-Lauf
 * ist festgehalten. Ein Eintrag kommt erst mit einem ausgefüllten Hostprotokoll hinzu.
 */
export const HOSTBELEGE: readonly HostBeleg[] = [];

function belegVollstaendig(b: HostBeleg): boolean {
  return [b.hostVersion, b.osVersion, b.kandidat, b.zeitpunkt, b.protokoll].every(
    (wert) => typeof wert === "string" && wert.trim() !== "",
  );
}

export interface FaehigkeitsSicht extends FaehigkeitsEintrag {
  /** Der Beleg, der „real belegt" trägt — sonst `null`. */
  readonly beleg: {
    readonly hostVersion: string;
    readonly osVersion: string;
    readonly kandidat: string;
    readonly zeitpunkt: string;
  } | null;
}

export interface ProgrammSicht {
  readonly programm: ProgrammKennung;
  readonly anzeigename: string;
  readonly plattform: string;
  readonly weg: AdapterWeg;
  readonly schnittstelle: string;
  readonly mindestfassung: string | null;
  readonly os: OsFassung;
  readonly geliefert: boolean;
  readonly faehigkeiten: Readonly<Record<Faehigkeit, FaehigkeitsSicht>>;
  /** Stand des begrenzten Bedienungshilfe-Lesezwecks — `null`, wenn es keinen gibt. */
  readonly bedienungshilfeLesen: FaehigkeitsStand | null;
  readonly grenzen: readonly string[];
}

export interface FaehigkeitsUebersicht {
  readonly programme: readonly ProgrammSicht[];
  /** Immer `false`: es gibt kein Versprechen für alle Programme. */
  readonly alleProgramme: false;
  readonly nichtAufgefuehrt: string;
  readonly verworfeneBelege: number;
}

/**
 * Die Übersicht für Mensch und Oberfläche. „Real belegt" entsteht ausschliesslich aus einem
 * vollständigen Beleg für GENAU dieses Programm und nur für einen gebauten Weg; ein Beleg hebt nie
 * einen nicht gelieferten oder ausgeschlossenen Stand. „Geliefert" heisst: mindestens Lesen ist
 * real belegt.
 */
export function faehigkeitsUebersicht(
  belege: readonly HostBeleg[] = HOSTBELEGE,
  register: readonly ProgrammEintrag[] = PROGRAMM_REGISTER,
): FaehigkeitsUebersicht {
  const gueltig = belege.filter(belegVollstaendig);
  const programme = register.map((eintrag): ProgrammSicht => {
    const eigene = gueltig.filter((b) => b.programm === eintrag.programm);
    const faehigkeiten = {} as Record<Faehigkeit, FaehigkeitsSicht>;
    for (const f of FAEHIGKEITEN) {
      const basis = eintrag.faehigkeiten[f];
      const beleg = eigene.find((b) => b.faehigkeiten.includes(f));
      faehigkeiten[f] =
        beleg && basis.stand === "gebaut-ohne-hostbeleg"
          ? {
              stand: "real-belegt",
              grenze: basis.grenze,
              beleg: {
                hostVersion: beleg.hostVersion,
                osVersion: beleg.osVersion,
                kandidat: beleg.kandidat,
                zeitpunkt: beleg.zeitpunkt,
              },
            }
          : { ...basis, beleg: null };
    }
    return {
      programm: eintrag.programm,
      anzeigename: eintrag.anzeigename,
      plattform: eintrag.plattform,
      weg: eintrag.weg,
      schnittstelle: eintrag.schnittstelle,
      mindestfassung: eintrag.mindestfassung,
      os: {
        unterstuetzt: eintrag.os.unterstuetzt,
        // Die real geprüfte macOS-Fassung kommt nur aus einem Beleg dieses Programms.
        realGeprueft: eigene[0]?.osVersion ?? eintrag.os.realGeprueft,
      },
      geliefert: faehigkeiten.lesen.stand === "real-belegt",
      faehigkeiten,
      bedienungshilfeLesen: eintrag.bedienungshilfeLesen?.stand ?? null,
      grenzen: eintrag.grenzen,
    };
  });
  return {
    programme,
    alleProgramme: false,
    nichtAufgefuehrt: "Programme, die hier nicht stehen, werden nicht unterstützt.",
    verworfeneBelege: belege.length - gueltig.length,
  };
}

// ------------------------------------------------------------------------------------------------
// GEMEINSAME DIENSTE — einmal, für jedes Programm gleich
// ------------------------------------------------------------------------------------------------

export const GEMEINSAME_DIENSTE = {
  anmeldung: "Bestehende KLARWERK-Sitzung (requireUser); im Word-Add-in die vorhandene Anmeldung.",
  avatar: "Eigenes Assistenzprofil (/api/me/assistenz) — Name und Avatar.",
  quellenpruefung: "Bestehender Frage-/Belegweg mit Fundstellen und Rechteprüfung.",
  speicher: "Persönliches Gedächtnis und Klara-Gespräche (/api/me/klara/…).",
  aktionen: "Bestehender Klara-Sitzungs- und Ausführungsweg (/api/klara/sessions/…).",
} as const;

// ------------------------------------------------------------------------------------------------
// ZIELBINDUNG — vor jeder Wirkung
// ------------------------------------------------------------------------------------------------

/** Woran ein Kontext und jede Wirkung gebunden sind (G04). Alle Werte opak, keine Klartexte. */
export interface HostBindung {
  readonly mandant: string;
  readonly nutzer: string;
  readonly sitzung: string;
  readonly programm: ProgrammKennung;
  /** Opake Kennung des im Programm angemeldeten Kontos (z. B. Microsoft-365-Konto). */
  readonly hostKonto: string;
  /** documentContextId bzw. Datei-Kennung. */
  readonly objekt: string;
  /** Prüfsumme der übernommenen Auswahl. */
  readonly auswahl: string;
  readonly fassung: string;
}

export type ZielGrund =
  | "host-getrennt"
  | "konto-gewechselt"
  | "programm-gewechselt"
  | "sitzung-neu"
  | "anderes-dokument"
  | "fassung-geaendert"
  | "auswahl-geaendert";

export type ZielPruefung =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly grund: ZielGrund;
      readonly text: string;
      readonly naechsterSchritt: "neu-verbinden" | "auswahl-neu-uebernehmen";
    };

const ZIEL_TEXTE: Record<ZielGrund, string> = {
  "host-getrennt":
    "Die Verbindung zum Programm ist weg (z. B. nach Neustart). Bitte Klara im Programm neu öffnen.",
  "konto-gewechselt":
    "Das Konto hat gewechselt. Der bisherige Inhalt wird nicht weiterverwendet; bitte neu beginnen.",
  "programm-gewechselt":
    "Das Programm hat gewechselt. Klara arbeitet nur im Programm, in dem die Auswahl übernommen wurde.",
  "sitzung-neu": "Die Sitzung ist neu. Bitte die Auswahl erneut übernehmen.",
  "anderes-dokument":
    "Im Vordergrund ist ein anderes Dokument. Klara ändert nur das Dokument, aus dem die Auswahl " +
    "stammt — bitte dorthin wechseln oder die Auswahl hier neu übernehmen.",
  "fassung-geaendert":
    "Das Dokument wurde inzwischen geändert. Bitte die Auswahl neu übernehmen, damit nichts " +
    "überschrieben wird.",
  "auswahl-geaendert": "Die Markierung ist nicht mehr dieselbe. Bitte die Auswahl neu übernehmen.",
};

export function abgelehnt(grund: ZielGrund): ZielPruefung {
  return {
    ok: false,
    grund,
    text: ZIEL_TEXTE[grund],
    naechsterSchritt:
      grund === "fassung-geaendert" || grund === "auswahl-geaendert" || grund === "sitzung-neu"
        ? "auswahl-neu-uebernehmen"
        : "neu-verbinden",
  };
}

/**
 * Darf eine Wirkung, die an `gebunden` übernommen wurde, auf dem AKTUELLEN Ziel landen? Jedes Feld
 * wird geprüft; die Reihenfolge bestimmt nur, welcher Grund zuerst genannt wird (Konto vor Dokument,
 * weil ein Kontowechsel den ganzen Kontext entwertet).
 */
export function pruefeZielVorWirkung(
  gebunden: HostBindung,
  aktuell: HostBindung | null,
): ZielPruefung {
  if (aktuell === null) {
    return abgelehnt("host-getrennt");
  }
  if (
    gebunden.mandant !== aktuell.mandant ||
    gebunden.nutzer !== aktuell.nutzer ||
    gebunden.hostKonto !== aktuell.hostKonto
  ) {
    return abgelehnt("konto-gewechselt");
  }
  if (gebunden.programm !== aktuell.programm) {
    return abgelehnt("programm-gewechselt");
  }
  if (gebunden.sitzung !== aktuell.sitzung) {
    return abgelehnt("sitzung-neu");
  }
  if (gebunden.objekt !== aktuell.objekt) {
    return abgelehnt("anderes-dokument");
  }
  if (gebunden.fassung !== aktuell.fassung) {
    return abgelehnt("fassung-geaendert");
  }
  if (gebunden.auswahl !== aktuell.auswahl) {
    return abgelehnt("auswahl-geaendert");
  }
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------
// KONTEXT NACH HOST-/KONTOWECHSEL
// ------------------------------------------------------------------------------------------------

export interface KontextEintrag {
  readonly bindung: HostBindung;
  readonly privat: boolean;
  readonly inhalt: string;
}

/**
 * Welcher gesammelte Kontext darf mit der NÄCHSTEN Anfrage hinaus? Nur Einträge desselben
 * Mandanten, Nutzers, Hostkontos, Programms und Objekts. Nach einem Host- oder Kontowechsel ist das
 * die leere Menge — der alte Kontext wird nicht neu übermittelt, private Inhalte schon gar nicht.
 */
export function uebermittelbarerKontext(
  eintraege: readonly KontextEintrag[],
  aktuell: HostBindung | null,
): KontextEintrag[] {
  if (aktuell === null) {
    return [];
  }
  return eintraege.filter(
    (e) =>
      e.bindung.mandant === aktuell.mandant &&
      e.bindung.nutzer === aktuell.nutzer &&
      e.bindung.hostKonto === aktuell.hostKonto &&
      e.bindung.programm === aktuell.programm &&
      e.bindung.objekt === aktuell.objekt,
  );
}

// ------------------------------------------------------------------------------------------------
// OS-RECHTE JE ADAPTER — ohne Umweg über den Bildschirm
// ------------------------------------------------------------------------------------------------

export interface OsRechte {
  readonly bedienungshilfe: boolean;
  readonly dateizugriff: boolean;
  readonly bildschirmaufnahme: boolean;
}

export type AdapterZustand =
  | { readonly aktiv: true; readonly weg: AdapterWeg }
  | {
      readonly aktiv: false;
      readonly weg: AdapterWeg;
      readonly fehlt: "bedienungshilfe" | "dateizugriff" | "kein-weg";
      readonly text: string;
      readonly naechsterSchritt: string;
      /** Immer `null`: ein entzogenes Recht wird nicht über Bildschirmbild oder OCR umgangen. */
      readonly ersatzweg: null;
    };

/**
 * Stoppt GENAU den Adapter, dem sein Systemrecht fehlt — die anderen laufen weiter. Office.js braucht
 * kein macOS-Recht. Die Bildschirmaufnahme spielt hier bewusst keine Rolle: sie ist kein Ersatz für
 * Bedienungshilfe oder Dateifreigabe.
 */
export function adapterZustand(weg: AdapterWeg, rechte: OsRechte): AdapterZustand {
  if (weg === "office-js") {
    return { aktiv: true, weg };
  }
  if (weg === "bedienungshilfe" && !rechte.bedienungshilfe) {
    return {
      aktiv: false,
      weg,
      fehlt: "bedienungshilfe",
      text:
        "Die Bedienungshilfe-Freigabe für Klara ist aus. Klara bedient dieses Programm deshalb " +
        "nicht — auch nicht über ein Bildschirmbild.",
      naechsterSchritt:
        "Systemeinstellungen → Datenschutz & Sicherheit → Bedienungshilfen: Klara wieder erlauben, " +
        "oder ohne diese Funktion weiterarbeiten.",
      ersatzweg: null,
    };
  }
  if (weg === "datei-auswahl" && !rechte.dateizugriff) {
    return {
      aktiv: false,
      weg,
      fehlt: "dateizugriff",
      text:
        "Klara darf diese Datei nicht mehr lesen. Die Aufnahme ist gestoppt; ein Bildschirmbild " +
        "ersetzt die Datei nicht.",
      naechsterSchritt: "Die Datei erneut ausdrücklich auswählen oder den Dateizugriff erlauben.",
      ersatzweg: null,
    };
  }
  if (weg === "keiner") {
    return {
      aktiv: false,
      weg,
      fehlt: "kein-weg",
      text: "Für dieses Programm gibt es noch keinen Klara-Weg.",
      naechsterSchritt: "Inhalt als Datei auswählen oder in ein unterstütztes Programm kopieren.",
      ersatzweg: null,
    };
  }
  return { aktiv: true, weg };
}

// ------------------------------------------------------------------------------------------------
// ZIELE IM FREMDEN PROGRAMM — Bedienelement statt Koordinate, Klärung statt Raten
// ------------------------------------------------------------------------------------------------

export type ZielAngabe =
  | {
      readonly art: "bedienelement";
      readonly bundleId: string;
      readonly hostVersion: string;
      readonly zweck: string;
      readonly rolle: string;
      readonly kennung: string | null;
      readonly titel: string | null;
      /** Wie viele Elemente auf Rolle + Kennung/Titel passen. */
      readonly treffer: number;
    }
  | { readonly art: "koordinate"; readonly x: number; readonly y: number }
  | {
      readonly art: "ocr";
      readonly text: string;
      readonly treffer: number;
    };

export type ZielEntscheidung =
  | { readonly entscheidung: "ausfuehren" }
  | { readonly entscheidung: "klaerung"; readonly grund: string; readonly text: string }
  | { readonly entscheidung: "abgelehnt"; readonly grund: string; readonly text: string };

/**
 * Darf eine Aktion auf diesem Ziel laufen?
 *
 *   · Eine feste Bildschirmkoordinate ist nie ein Ziel — sie trifft nach Fensterwechsel,
 *     Skalierung oder Update etwas anderes.
 *   · Ein Bedienelement nur über einen GETESTETEN Rückfall: genau dieser Host, diese Fassung, dieser
 *     Zweck. Ohne eindeutige Rolle und Kennung/Titel oder bei mehr/weniger als einem Treffer: Klärung.
 *   · Ein OCR-Treffer ist Bildschirmtext, kein Bedienelement. Er führt nie zu einer Aktion, sondern
 *     immer zu einer Klärung — mit Hinweis, wenn er nicht einmal eindeutig ist.
 */
export function bewerteZiel(
  ziel: ZielAngabe,
  register: readonly ProgrammEintrag[] = PROGRAMM_REGISTER,
): ZielEntscheidung {
  if (ziel.art === "koordinate") {
    return {
      entscheidung: "abgelehnt",
      grund: "koordinate",
      text:
        "Ein Klick auf eine feste Bildschirmstelle ist kein verlässliches Ziel. Klara führt ihn " +
        "nicht aus.",
    };
  }
  if (ziel.art === "ocr") {
    return {
      entscheidung: "klaerung",
      grund: ziel.treffer === 1 ? "ocr-unbestaetigt" : "ocr-mehrdeutig",
      text:
        ziel.treffer === 1
          ? "Klara hat den Text nur auf dem Bildschirm erkannt. Bitte bestätigen, was gemeint ist — " +
            "auf einer Bilderkennung allein handelt Klara nicht."
          : `Der Text passt auf ${ziel.treffer} Stellen. Bitte die richtige Stelle angeben.`,
    };
  }
  const rueckfall = register
    .map((e) => e.bedienungshilfeRueckfall)
    .find(
      (r) =>
        r !== null &&
        r.bundleId === ziel.bundleId &&
        r.hostVersion === ziel.hostVersion &&
        r.zwecke.includes(ziel.zweck),
    );
  if (!rueckfall) {
    return {
      entscheidung: "abgelehnt",
      grund: "kein-getesteter-rueckfall",
      text:
        "Für dieses Programm, diese Fassung und diesen Zweck ist keine Bedienung über die " +
        "Bedienungshilfe getestet. Klara führt die Aktion nicht aus.",
    };
  }
  if (ziel.rolle.trim() === "" || ((ziel.kennung ?? "") === "" && (ziel.titel ?? "") === "")) {
    return {
      entscheidung: "klaerung",
      grund: "bedienelement-unbestimmt",
      text: "Das Bedienelement ist nicht eindeutig benannt. Bitte zeigen, welches gemeint ist.",
    };
  }
  if (ziel.treffer !== 1) {
    return {
      entscheidung: "klaerung",
      grund: ziel.treffer === 0 ? "bedienelement-fehlt" : "bedienelement-mehrdeutig",
      text:
        ziel.treffer === 0
          ? "Das Bedienelement ist gerade nicht zu finden. Bitte das richtige Fenster öffnen."
          : `Es gibt ${ziel.treffer} passende Bedienelemente. Bitte das richtige angeben.`,
    };
  }
  return { entscheidung: "ausfuehren" };
}

// ------------------------------------------------------------------------------------------------
// BEDIENUNGSHILFE ZUM LESEN — ein Zweck, ein Programm, eindeutiges Ziel
// ------------------------------------------------------------------------------------------------

/** Was der Klara-Begleiter über die Bedienungshilfe beobachtet hat — keine Koordinate, kein Bild. */
export interface BedienungshilfeBeobachtung {
  readonly bundleId: string;
  readonly hostVersion: string;
  /** Wie viele Fenster des Programms als vorderstes in Frage kamen. */
  readonly fensterTreffer: number;
  /** Wie viele fokussierte Textelemente eine Markierung meldeten. */
  readonly elementTreffer: number;
  readonly rolle: string;
  /** `AXSelectedText` des einen Elements — `null`, wenn keiner gelesen werden konnte. */
  readonly markierung: string | null;
}

export type LeseEntscheidung =
  | { readonly entscheidung: "lesen"; readonly markierung: string }
  | { readonly entscheidung: "klaerung"; readonly grund: string; readonly text: string }
  | {
      readonly entscheidung: "gestoppt";
      readonly grund: string;
      readonly text: string;
      readonly naechsterSchritt: string;
      readonly ersatzweg: null;
    };

/**
 * Darf der Begleiter die beobachtete Markierung als Klara-Kontext übernehmen?
 *
 *   · Ohne Bedienungshilfe-Freigabe: gestoppt, mit nächstem Schritt — kein Bildschirm-Umweg.
 *   · Nur ein Programm mit eingetragenem Lesezweck (`bedienungshilfeLesen`); alles andere gestoppt.
 *   · Genau EIN vorderstes Fenster und genau EIN fokussiertes Element; sonst Klärung statt Raten.
 *   · Eine leere Markierung ist keine Markierung: Klärung.
 */
export function bewerteBedienungshilfeLesen(
  beobachtung: BedienungshilfeBeobachtung,
  rechte: OsRechte,
  register: readonly ProgrammEintrag[] = PROGRAMM_REGISTER,
): LeseEntscheidung {
  const zustand = adapterZustand("bedienungshilfe", rechte);
  if (!zustand.aktiv) {
    return {
      entscheidung: "gestoppt",
      grund: zustand.fehlt,
      text: zustand.text,
      naechsterSchritt: zustand.naechsterSchritt,
      ersatzweg: null,
    };
  }
  const zweck = register
    .map((e) => e.bedienungshilfeLesen)
    .find((l) => l !== null && l.bundleId === beobachtung.bundleId);
  if (!zweck) {
    return {
      entscheidung: "gestoppt",
      grund: "kein-lesezweck",
      text:
        "Für dieses Programm ist kein Lesen über die Bedienungshilfe freigegeben. Klara liest " +
        "dort nichts.",
      naechsterSchritt: "Inhalt im unterstützten Programm markieren oder als Datei auswählen.",
      ersatzweg: null,
    };
  }
  if (beobachtung.fensterTreffer !== 1) {
    return {
      entscheidung: "klaerung",
      grund: beobachtung.fensterTreffer === 0 ? "fenster-fehlt" : "fenster-mehrdeutig",
      text:
        beobachtung.fensterTreffer === 0
          ? "Es ist kein Fenster des Programms im Vordergrund. Bitte das Dokument nach vorn holen."
          : "Es kommen mehrere Fenster in Frage. Bitte das gemeinte Dokument nach vorn holen.",
    };
  }
  if (beobachtung.elementTreffer !== 1 || beobachtung.rolle.trim() === "") {
    return {
      entscheidung: "klaerung",
      grund: beobachtung.elementTreffer === 0 ? "element-fehlt" : "element-mehrdeutig",
      text:
        beobachtung.elementTreffer === 0
          ? "Im Dokument ist keine Textstelle ausgewählt. Bitte den Absatz markieren."
          : "Es gibt mehrere ausgewählte Stellen. Bitte genau einen Absatz markieren.",
    };
  }
  const markierung = (beobachtung.markierung ?? "").trim();
  if (markierung === "") {
    return {
      entscheidung: "klaerung",
      grund: "markierung-leer",
      text: "Die Markierung ist leer. Bitte den Absatz markieren, bei dem Klara helfen soll.",
    };
  }
  return { entscheidung: "lesen", markierung };
}

// ------------------------------------------------------------------------------------------------
// DIE GESIEGELTE BINDUNG — der Server stellt sie aus, der Adapter trägt sie nur
// ------------------------------------------------------------------------------------------------

/**
 * Eine Bindung, die der Server beim Verbinden ausstellt. Mandant und Nutzer setzt allein der
 * Server aus der Sitzung; der Adapter kann sie weder wählen noch ändern. Jede spätere Wirkung und
 * jeder mitgeschickte Kontext wird gegen die AKTUELLE Sitzung geprüft — ein Kontowechsel macht
 * damit jede alte Bindung unbrauchbar.
 *
 * Der Schlüssel lebt im Arbeitsspeicher der Instanz: nach einem Neustart des Servers ist jede
 * Bindung ungültig, und der Adapter muss neu verbinden („host-getrennt") — das ist gewollt.
 */
export class BindungsSiegel {
  private readonly schluessel: Buffer;

  constructor(schluessel: Buffer = randomBytes(32)) {
    this.schluessel = schluessel;
  }

  siegeln(bindung: HostBindung): string {
    const nutzlast = Buffer.from(JSON.stringify(bindung), "utf8").toString("base64url");
    return `${nutzlast}.${this.signatur(nutzlast)}`;
  }

  /** Die Bindung — oder `null`, wenn das Siegel fehlt, gefälscht oder unlesbar ist. */
  oeffnen(siegel: unknown): HostBindung | null {
    if (typeof siegel !== "string") {
      return null;
    }
    const teile = siegel.split(".");
    if (teile.length !== 2) {
      return null;
    }
    const [nutzlast, signatur] = teile as [string, string];
    const erwartet = Buffer.from(this.signatur(nutzlast), "utf8");
    const gegeben = Buffer.from(signatur, "utf8");
    if (erwartet.length !== gegeben.length || !timingSafeEqual(erwartet, gegeben)) {
      return null;
    }
    try {
      return leseHostBindung(JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8")));
    } catch {
      return null;
    }
  }

  private signatur(nutzlast: string): string {
    return createHmac("sha256", this.schluessel).update(nutzlast).digest("base64url");
  }
}

const PROGRAMM_KENNUNGEN: readonly ProgrammKennung[] = PROGRAMM_REGISTER.map((e) => e.programm);

export function istProgrammKennung(wert: unknown): wert is ProgrammKennung {
  return typeof wert === "string" && (PROGRAMM_KENNUNGEN as readonly string[]).includes(wert);
}

/** Höchstlänge eines Bindungsfelds — die Werte sind opake Kennungen, keine Inhalte. */
const BINDUNGSFELD_MAX = 512;

function bindungsfeld(wert: unknown): string | null {
  return typeof wert === "string" && wert.length <= BINDUNGSFELD_MAX ? wert : null;
}

/** Liest eine vollständige Bindung aus unbekannter Eingabe — sonst `null`, nie halb. */
export function leseHostBindung(roh: unknown): HostBindung | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    return null;
  }
  const r = roh as Record<string, unknown>;
  const felder = ["mandant", "nutzer", "sitzung", "hostKonto", "objekt", "auswahl", "fassung"];
  const werte = felder.map((f) => bindungsfeld(r[f]));
  if (werte.some((w) => w === null) || !istProgrammKennung(r.programm)) {
    return null;
  }
  const [mandant, nutzer, sitzung, hostKonto, objekt, auswahl, fassung] = werte as string[];
  return {
    mandant: mandant as string,
    nutzer: nutzer as string,
    sitzung: sitzung as string,
    programm: r.programm,
    hostKonto: hostKonto as string,
    objekt: objekt as string,
    auswahl: auswahl as string,
    fassung: fassung as string,
  };
}

/**
 * Das, was ein Adapter über sein aktuelles Ziel melden darf: alles AUSSER Mandant und Nutzer —
 * die setzt der Server aus der Sitzung. `null`, wenn ein Feld fehlt oder kein Text ist.
 */
export function leseAdapterZiel(roh: unknown, mandant: string, nutzer: string): HostBindung | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    return null;
  }
  return leseHostBindung({ ...(roh as Record<string, unknown>), mandant, nutzer });
}

// ------------------------------------------------------------------------------------------------
// AUFNAHME EINER GEWÄHLTEN DATEI
// ------------------------------------------------------------------------------------------------

/** Was der native Adapter über die gewählte Datei meldet. Kein Pfad geht in die Herkunft. */
export interface GewaehlteDatei {
  /** Opake, vom System vergebene Kennung (z. B. Lesezeichen-/Dateikennung). */
  readonly dateiId: string;
  readonly name: string;
  readonly groesse: number;
  readonly geaendertAm: string;
}

/** Der einzige Lesezugriff, den der Kern dem Adapter abverlangt — es gibt kein Verschieben/Löschen. */
export interface DateiLeser {
  lies(dateiId: string): Promise<Uint8Array>;
}

export interface DateiAufnahme {
  readonly inhalt: Uint8Array;
  readonly herkunft: {
    readonly quelle: "finder-auswahl";
    readonly dateiId: string;
    readonly name: string;
    readonly groesse: number;
    readonly geaendertAm: string;
    readonly sha256: string;
    readonly aufgenommenAm: string;
    readonly nutzer: string;
  };
}

export type DateiAufnahmeGrund =
  | "keine-auswahl"
  | "mehrere-dateien"
  | "kein-dateizugriff"
  | "groesse-abweichend";

export class DateiAufnahmeFehler extends Error {
  constructor(
    readonly grund: DateiAufnahmeGrund,
    message: string,
  ) {
    super(message);
    this.name = "DateiAufnahmeFehler";
  }
}

/**
 * Nimmt GENAU die eine ausdrücklich gewählte Datei auf. Der Leser wird einmal und nur mit ihrer
 * Kennung gerufen — benachbarte Dateien kennt dieser Kern gar nicht. Ohne Dateizugriff stoppt die
 * Aufnahme mit verständlichem Grund; es gibt keinen Bildschirm-Umweg.
 */
export async function nimmGewaehlteDateiAuf(
  auswahl: readonly GewaehlteDatei[],
  rechte: OsRechte,
  leser: DateiLeser,
  nutzer: string,
  jetzt: () => Date = () => new Date(),
): Promise<DateiAufnahme> {
  if (auswahl.length === 0) {
    throw new DateiAufnahmeFehler("keine-auswahl", "Es ist keine Datei ausgewählt.");
  }
  if (auswahl.length > 1) {
    throw new DateiAufnahmeFehler(
      "mehrere-dateien",
      "Bitte genau eine Datei auswählen; Klara nimmt nicht mehrere Dateien auf einmal auf.",
    );
  }
  const zustand = adapterZustand("datei-auswahl", rechte);
  if (!zustand.aktiv) {
    throw new DateiAufnahmeFehler("kein-dateizugriff", zustand.text);
  }
  const datei = auswahl[0] as GewaehlteDatei;
  const inhalt = await leser.lies(datei.dateiId);
  if (inhalt.byteLength !== datei.groesse) {
    throw new DateiAufnahmeFehler(
      "groesse-abweichend",
      "Die Datei hat sich während der Aufnahme geändert. Bitte erneut auswählen.",
    );
  }
  return {
    inhalt,
    herkunft: {
      quelle: "finder-auswahl",
      dateiId: datei.dateiId,
      name: datei.name,
      groesse: datei.groesse,
      geaendertAm: datei.geaendertAm,
      sha256: createHash("sha256").update(inhalt).digest("hex"),
      aufgenommenAm: jetzt().toISOString(),
      nutzer,
    },
  };
}
