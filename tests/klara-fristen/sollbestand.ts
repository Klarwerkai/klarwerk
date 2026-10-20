import type { FristArt } from "../../services/app/src/klara-fristen-erkennung";

/** Vor der Aktivierung festgelegte Grenzen für diesen synthetischen deutschen Sollbestand. */
export const AKZEPTANZGRENZEN = {
  richtigeErkennung: 1,
  richtigeNichtErkennung: 1,
  datumszuordnung: 1,
  objektzuordnung: 1,
  konfliktklaerung: 1,
} as const;
type Erwartung = { objekt: string; art: FristArt; datum: string | null };
interface Fall {
  id: string;
  klasse: "positiv" | "negativ" | "klaerung";
  text: string;
  erwartet: Erwartung[];
}
export const SOLLBESTAND: readonly Fall[] = [
  {
    id: "S13-L17",
    klasse: "positiv",
    text: "Lizenz L-17 ist gültig bis 2027-04-30.",
    erwartet: [{ objekt: "L-17", art: "ablauf", datum: "2027-04-30" }],
  },
  {
    id: "S13-Z8",
    klasse: "positiv",
    text: "Zertifikat Z-8: Ablaufdatum 31.12.2027.",
    erwartet: [{ objekt: "Z-8", art: "ablauf", datum: "2027-12-31" }],
  },
  {
    id: "Vertragsarten-getrennt",
    klasse: "positiv",
    text: "Vertrag V-5: Kündigungsfenster bis 2027-02-28; Vertrag V-5: Vertragsende 2027-05-31.",
    erwartet: [
      { objekt: "V-5", art: "kuendigungsfenster", datum: "2027-02-28" },
      { objekt: "V-5", art: "vertragsende", datum: "2027-05-31" },
    ],
  },
  {
    id: "Verlaengerung-keine-Ausfuehrung",
    klasse: "positiv",
    text: "Vertrag V-5: automatische Verlängerung am 2027-06-01.",
    erwartet: [{ objekt: "V-5", art: "automatische_verlaengerung", datum: "2027-06-01" }],
  },
  {
    id: "Erneuerung",
    klasse: "positiv",
    text: "Zertifikat Z-8: Erneuerungstermin 2027-11-30.",
    erwartet: [{ objekt: "Z-8", art: "erneuerung", datum: "2027-11-30" }],
  },
  {
    id: "Normankuendigung",
    klasse: "positiv",
    text: "Norm N-17: Normankündigung für 2027-04-30.",
    erwartet: [{ objekt: "N-17", art: "normankuendigung", datum: "2027-04-30" }],
  },
  {
    id: "Wartung",
    klasse: "positiv",
    text: "Anlage P-7: Wartung fällig am 2027-04-30.",
    erwartet: [{ objekt: "P-7", art: "wartung", datum: "2027-04-30" }],
  },
  {
    id: "Anleitungspflege",
    klasse: "positiv",
    text: "Anleitung A-4: Anleitungspflege bis 2027-04-30.",
    erwartet: [{ objekt: "A-4", art: "anleitungspflege", datum: "2027-04-30" }],
  },
  {
    id: "Einarbeitung",
    klasse: "positiv",
    text: "Einarbeitung E-2: Einarbeitungstermin 2027-04-30.",
    erwartet: [{ objekt: "E-2", art: "einarbeitung", datum: "2027-04-30" }],
  },
  {
    id: "Expertenuebergabe",
    klasse: "positiv",
    text: "Anlage P-7: Expertenübergabe bis 2027-04-30.",
    erwartet: [{ objekt: "P-7", art: "expertenuebergabe", datum: "2027-04-30" }],
  },
  {
    id: "Objektkennung-fehlt",
    klasse: "negativ",
    text: "Zertifikat mit Ablaufdatum 2027-04-30.",
    erwartet: [],
  },
  {
    id: "Allgemeiner-Text-ist-keine-Kennung",
    klasse: "negativ",
    text: "Eine Lizenz ist gültig bis 2027-04-30.",
    erwartet: [],
  },
  {
    id: "Dokumentdatum",
    klasse: "negativ",
    text: "Dokumentdatum 2027-04-30. Ein Zertifikat wird erwähnt.",
    erwartet: [],
  },
  {
    id: "Scan-ist-kein-Ablauf",
    klasse: "negativ",
    text: "Zertifikat Z-8 wurde am 2027-04-30 eingescannt.",
    erwartet: [],
  },
  {
    id: "Beilaeufiges-Objekt-andere-Aussage",
    klasse: "negativ",
    text: "Zertifikat Z-8 ist im Archiv. Die Lizenz läuft am 2027-04-30 ab.",
    erwartet: [],
  },
  {
    id: "Zwei-Objekte-keine-Zuordnung",
    klasse: "klaerung",
    text: "Zertifikat Z-8 und Lizenz L-17: Ablaufdatum 2027-04-30.",
    erwartet: [{ objekt: "Z-8", art: "ablauf", datum: null }],
  },
  {
    id: "Relativ-ohne-Start",
    klasse: "klaerung",
    text: "Lizenz L-17: Ablauf nach zwei Jahren.",
    erwartet: [{ objekt: "L-17", art: "ablauf", datum: null }],
  },
  {
    id: "Mehrdeutige-Zahl",
    klasse: "klaerung",
    text: "Lizenz L-17: Ablaufdatum 04/05/2027.",
    erwartet: [{ objekt: "L-17", art: "ablauf", datum: null }],
  },
  {
    id: "Fehlende-Zone",
    klasse: "klaerung",
    text: "Lizenz L-17: Ablaufdatum 2027-04-30 um 09:00.",
    erwartet: [{ objekt: "L-17", art: "ablauf", datum: null }],
  },
  {
    id: "Widerspruch",
    klasse: "klaerung",
    text: "Lizenz L-17: Ablaufdatum 2027-04-30, abweichend 2027-05-31.",
    erwartet: [{ objekt: "L-17", art: "ablauf", datum: null }],
  },
  {
    id: "Frage-ist-kein-Beleg",
    klasse: "klaerung",
    text: "Ist Zertifikat Z-8 gültig bis 2027-04-30?",
    erwartet: [{ objekt: "Z-8", art: "ablauf", datum: null }],
  },
];
