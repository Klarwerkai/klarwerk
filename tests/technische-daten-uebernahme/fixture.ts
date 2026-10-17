// BPA-S01 · Fiktive Ventile V-17/V-18 — synthetische Testdaten ohne Geheimniswerte.
// Die HTML-Seite und das verlinkte Datenblatt weichen für V-17 bewusst voneinander ab.
import type { ErfassterAbschnitt } from "../../services/app/src/technische-daten";

export const HTML_SEITE: ErfassterAbschnitt = {
  art: "html",
  url: "https://ventile.example.test/produkte/v-serie",
  abschnitt: "Technische Daten",
  anker: "technische-daten",
  titel: "V-Serie Absperrventile",
  abgerufenAm: "2026-10-11T14:05:00+02:00",
  kopf: ["Modell", "Variante", "Betriebsdruck", "Temperaturbereich", "Prüfbedingung"],
  zeilen: [
    ["V-17", "DN25", "16 bar ±0,5 bar", "−10 … +120 °C", "Wasser, 20 °C"],
    ["V-18", "DN40", "232 psi", "14 … 248 °F", "Wasser, 20 °C"],
    ["V-18", "DN50", "16 bar", "-10 … 120 °C", ""],
  ],
};

export const DATENBLATT: ErfassterAbschnitt = {
  art: "datenblatt",
  url: "https://ventile.example.test/downloads/v-serie-datenblatt.pdf",
  abschnitt: "Tabelle 2 · Kenndaten",
  titel: "Datenblatt V-Serie",
  abgerufenAm: "2026-10-11T14:06:00+02:00",
  stand: "2026-09-01",
  kopf: ["Modell", "Variante", "Betriebsdruck (bar)", "Temperaturbereich (°C)"],
  zeilen: [
    ["V-17", "DN25", "10 (bei 20 °C)", "-10 … 100"],
    ["V-18", "DN40", "16", "-10 … 120"],
  ],
};

/** Eine Quelle mit fehlender Einheit und widersprüchlichen Einträgen (AC04). */
export const LUECKENHAFT: ErfassterAbschnitt = {
  art: "html",
  url: "https://ventile.example.test/produkte/v-17-alt",
  abschnitt: "Kenndaten (Archiv)",
  abgerufenAm: "2026-10-11T14:07:00+02:00",
  kopf: ["Modell", "Variante", "Betriebsdruck", "Hub"],
  zeilen: [
    ["V-17", "DN25", "25 bar", "12"],
    ["V-17", "DN25", "16 bar", "12 mm"],
  ],
};

export function geaendert(b: ErfassterAbschnitt, zeile: number, spalte: number, wert: string) {
  const zeilen = b.zeilen.map((z) => [...z]);
  (zeilen[zeile] as string[])[spalte] = wert;
  return { ...b, zeilen };
}
