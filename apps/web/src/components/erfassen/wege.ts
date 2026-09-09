// ================================================================================================
// JOB 3062 · H3 — DIE WEGE DES MENÜS „DATEI ▾", ABGELEITET.
// ================================================================================================
// Das Blatt bietet in seinem Menü „Datei ▾" die Wege an, die NICHT auf dem Blatt selbst geschrieben
// werden: Dateiimport, geführtes Interview und das Expertenformular. Freitext und Diktat stehen
// nicht darin — der Freitext IST das Blatt, und das Diktat ist ein eigenes Werkzeug der Zeile.
//
// ABGELEITET STATT ZWEITGESCHRIEBEN, aus demselben Grund wie früher `FRONT_DOOR_OPTION_MODES`:
// ein neuer Erzählweg erscheint im Menü ohne Nacharbeit. Die Reihenfolge folgt dem Bestand.
//
// WARUM DIESE DATEI HIER LIEGT UND NICHT IN `lib/captureEntry.ts`: Runde 1 hat die Ableitung dort
// hineingeschrieben — außerhalb der Zielpfade dieses Auftrags, was der Sachprüfer zu Recht rot
// geurteilt hat. Sie gehört ohnehin hierher: sie beschreibt EIN Menü EINER Komponente, nicht den
// allgemeinen Erfassungs-Einstieg. `lib/captureEntry.ts` bleibt unangetastet und liefert nur die
// Grundmengen `NARRATE_MODES` und `EXPERT_MODE`, die es schon vor diesem Auftrag exportiert hat.
import { EXPERT_MODE, NARRATE_MODES } from "../../lib/captureEntry";
import type { CaptureMode } from "../../lib/captureEntry";

export const BLATT_WEGE: readonly CaptureMode[] = [
  ...NARRATE_MODES.filter((m) => m !== "freitext" && m !== "diktat"),
  EXPERT_MODE,
];

// Beschriftung eines Wegs im Menü — EIN Schlüsselschema, kein zweiter Textbestand.
export function blattWegLabelKey(mode: CaptureMode): string {
  return `erfassen.weg.${mode}`;
}

// ================================================================================================
// JOB 3341 · UX-18-R1 — DIE ADRESSE DARF EINEN DIESER WEGE NENNEN.
// ================================================================================================
//
// WOZU. Wer auf `/import` die Word-Kachel anklickt, wollte eine Datei einlesen. Er landete bis
// hierher auf dem leeren Blatt und musste dort noch zweimal weiter („Datei ▾" → „Datei
// importieren") — gemessen im Browser, Bens Befund an JOB 3190:
// `{"dateiauswahl":false,"dateieingang":true,"dateiwerkzeug":true}`. Diese zwei Schritte standen
// deshalb sichtbar auf der Kachel. Jetzt gibt es sie nicht mehr: die Adresse nennt den Weg, und das
// Blatt öffnet ihn beim Aufbau über GENAU dasselbe `arbeitsraumOeffnen`, das auch das Menü ruft.
//
// EIN ORT FÜR NAMEN UND WERTMENGE, und die Wertmenge ist ABGELEITET aus `BLATT_WEGE` und nicht ein
// zweites Mal getippt: ein neuer Erzählweg im Menü ist damit ohne Nacharbeit auch adressierbar, und
// ein Weg, der aus dem Menü verschwindet, verschwindet zugleich aus der Adresse. Eine zweite Liste
// wäre genau die Stelle, an der beide Auffassungen auseinanderliefen.
//
// FAIL-CLOSED. Ein unbekannter, leerer oder fehlender Wert ergibt „kein Weg": das Blatt bleibt das
// Blatt. Keine Fehlermeldung — die Adresse ist keine Eingabe des Menschen, sondern ein Angebot;
// was daran nicht verstanden wird, wird ignoriert und nicht beklagt. Und keine erfundene Ansicht:
// `Ansicht` kennt nur „blatt" und die drei Arbeitsraum-Modi, sonst nichts.
export const BLATT_WEG_PARAMETER = "weg";

/**
 * Der rohe Adresswert → ein Weg des Menüs, oder `null`. Der Vergleich läuft über `BLATT_WEGE`
 * selbst, nicht über eine getippte Aufzählung.
 */
export function blattWegAusAdresse(roh: string | null | undefined): CaptureMode | null {
  return BLATT_WEGE.find((weg) => weg === roh) ?? null;
}

/**
 * Der Weg „Datei importieren" — der, den die Dateikacheln der Import-Galerie meinen. Er wird über
 * dieselbe Abbildung geholt, die auch die Adresse liest: fällt „datei" eines Tages aus
 * `BLATT_WEGE`, steht hier `null`, die Kachel trägt dann keinen Parameter mehr und führt wie früher
 * auf das Blatt — statt auf einen Weg zu zeigen, den das Menü nicht mehr kennt.
 */
export const BLATT_WEG_DATEI: CaptureMode | null = blattWegAusAdresse("datei");
