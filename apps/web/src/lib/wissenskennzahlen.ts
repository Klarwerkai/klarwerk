// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN — Auswahl, Anzeigeentscheid und Export, DOM-frei.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen. Zahl, Detailliste und Export entstehen aus DERSELBEN
// Antwort (`GET /api/wissenskennzahlen`, ein Abfrageschlüssel je Auswahl). Die Auswahl steht
// ausschliesslich in der Adresse (Muster `lib/qualitaetsaufgaben.ts`): sie übersteht den Rückweg
// aus einer Arbeitsliste und Neuladen, und es gibt keinen zweiten Zustandsort.
//
// NULL, UNBEKANNT, UNVOLLSTÄNDIG (Kriterium 1) werden hier EINMAL entschieden (`anzeigeVon`) und von
// Oberfläche und Export gleich gelesen: eine 0 steht nur, wo gemessen wurde.
import type { TFunction } from "i18next";
import {
  type Kennzahl,
  type KennzahlAnfrage,
  STANDARD_ZEITRAUM,
  type Wissenskennzahlen,
  ZEITRAEUME,
  type Zeitraum,
} from "../api/wissenskennzahlen";

export const AUSWAHL_PARAM = { tage: "tage", space: "space", team: "team" } as const;
export type AuswahlFeld = keyof typeof AUSWAHL_PARAM;

function wert(params: URLSearchParams, name: string): string | null {
  const roh = (params.get(name) ?? "").trim();
  return roh === "" ? null : roh;
}

/** Die Auswahl aus der Adresse. Ein unbekannter Zeitraum gilt als Standard, nie als Fehler. */
export function auswahlAusAdresse(params: URLSearchParams): KennzahlAnfrage {
  const tage = Number(wert(params, AUSWAHL_PARAM.tage));
  const gueltig = (ZEITRAEUME as readonly number[]).includes(tage);
  return {
    tage: gueltig ? (tage as Zeitraum) : STANDARD_ZEITRAUM,
    space: wert(params, AUSWAHL_PARAM.space),
    team: wert(params, AUSWAHL_PARAM.team),
  };
}

/** Ein Feld setzen oder (mit `null`) entfernen; fremde Parameter bleiben unberührt. */
export function auswahlInAdresse(
  vorher: URLSearchParams,
  feld: AuswahlFeld,
  neu: string | null,
): URLSearchParams {
  const params = new URLSearchParams(vorher);
  if (neu === null) {
    params.delete(AUSWAHL_PARAM[feld]);
  } else {
    params.set(AUSWAHL_PARAM[feld], neu);
  }
  return params;
}

/**
 * Wie eine Zahl dasteht:
 *   zahl              gemessen, mit Wert (auch 0 — dann ist es eine echte Null)
 *   nicht_berechenbar gemessen, aber Quote mit Nenner 0
 *   unvollstaendig    Wert vorhanden, Zeitraum beginnt vor dem belegten Erhebungsbeginn
 *   nicht_erhoben     die Quelle führt das Merkmal für diese Auswahl nicht
 *   unbekannt         die Quelle hat nicht geliefert
 */
export type Anzeigeart =
  | "zahl"
  | "nicht_berechenbar"
  | "unvollstaendig"
  | "nicht_erhoben"
  | "unbekannt";

export interface Anzeige {
  art: Anzeigeart;
  /** Der sichtbare Wert — „—" überall dort, wo keine Zahl belegt ist. */
  text: string;
}

export const OHNE_WERT = "—";

/** Eine Zahl in der Sprache der Oberfläche; Prozent mit Zeichen. */
export function wertText(k: Pick<Kennzahl, "wert" | "einheit">, sprache: string): string {
  if (k.wert === null) {
    return OHNE_WERT;
  }
  const zahl = k.wert.toLocaleString(sprache);
  return k.einheit === "prozent" ? `${zahl} %` : zahl;
}

export function anzeigeVon(k: Kennzahl, sprache: string): Anzeige {
  if (k.lage === "unbekannt" || k.lage === "nicht_erhoben") {
    return { art: k.lage, text: OHNE_WERT };
  }
  if (k.wert === null) {
    return { art: "nicht_berechenbar", text: OHNE_WERT };
  }
  const art = k.lage === "unvollstaendig" ? "unvollstaendig" : "zahl";
  return { art, text: wertText(k, sprache) };
}

/**
 * Die Differenz zum Vorzeitraum mit Vorzeichen — bei Quoten in Prozentpunkten; `null`, wenn es
 * keinen belegten Vergleich gibt.
 */
export function trendText(k: Kennzahl, t: TFunction, sprache: string): string | null {
  if (k.trend === null) {
    return null;
  }
  const d = k.trend.differenz;
  const betrag = Math.abs(d).toLocaleString(sprache);
  let zahl = "±0";
  if (d > 0) {
    zahl = `+${betrag}`;
  } else if (d < 0) {
    zahl = `−${betrag}`;
  }
  return k.einheit === "prozent" ? t("wkz.trend.prozentpunkte", { zahl }) : zahl;
}

/** Der Vorzeitraumwert in derselben Einheit wie die Zahl. */
export function vorherText(k: Kennzahl, sprache: string): string {
  if (k.trend === null) {
    return OHNE_WERT;
  }
  return wertText({ wert: k.trend.vorher, einheit: k.einheit }, sprache);
}

/** Ein CSV-Feld: Semikolon-getrennt, Anführungszeichen verdoppelt, Formelanfang entschärft. */
export function csvFeld(roh: string): string {
  const sicher = /^[=+\-@\t\r]/.test(roh) ? `'${roh}` : roh;
  return /[;"\n\r]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher;
}

/**
 * Der Export der GEZEIGTEN Antwort: dieselbe Auswahl, derselbe Stand, dieselbe Lage je Zahl. Er
 * enthält nur Zahlen — keine Titel, keine Fragetexte, keine Personen.
 */
export function kennzahlenCsv(d: Wissenskennzahlen, t: TFunction, sprache: string): string {
  const spaceName = d.filterwerte.spaces.find((s) => s.id === d.anfrage.space)?.name;
  const teamName = d.filterwerte.teams.find((x) => x.id === d.anfrage.team)?.name;
  const alle = t("wkz.filter.alle");
  const kopf: [string, string][] = [
    [t("wkz.export.stand"), d.stand],
    [t("wkz.export.zeitraum"), `${d.zeitraum.von} – ${d.zeitraum.bis}`],
    [t("wkz.export.tage"), String(d.anfrage.tage)],
    [t("wkz.filter.space"), d.anfrage.space === null ? alle : (spaceName ?? d.anfrage.space)],
    [t("wkz.filter.team"), d.anfrage.team === null ? alle : (teamName ?? d.anfrage.team)],
  ];
  const spalten = [
    t("wkz.export.bereich"),
    t("wkz.export.kennzahl"),
    t("wkz.export.wert"),
    t("wkz.export.lage"),
    t("wkz.export.zaehler"),
    t("wkz.export.nenner"),
    t("wkz.export.erhobenSeit"),
    t("wkz.export.trend"),
  ];
  const zeile = (bereich: string, k: Kennzahl): string[] => {
    const a = anzeigeVon(k, sprache);
    return [
      bereich,
      t(`wkz.k.${k.schluessel}.titel`),
      a.text,
      t(`wkz.anzeige.${a.art}`),
      k.zaehler === null ? "" : String(k.zaehler),
      k.nenner === null ? "" : String(k.nenner),
      k.erhobenSeit ?? "",
      trendText(k, t, sprache) ?? t(`wkz.trend.${k.trendGrund}`),
    ];
  };
  const zeilen: string[][] = [
    ...kopf,
    [],
    spalten,
    ...d.handlungsbedarf.map((k) => zeile(t("wkz.handlungsbedarf.titel"), k)),
    ...d.nutzung.map((k) => zeile(t("wkz.nutzung.titel"), k)),
  ];
  return `${zeilen.map((z) => z.map(csvFeld).join(";")).join("\r\n")}\r\n`;
}

/** Der Dateiname nennt Stand, Zeitraum und Auswahl des Exports. */
export function exportDateiname(d: Wissenskennzahlen): string {
  const teile = ["wissenskennzahlen", d.stand.slice(0, 10), `${d.anfrage.tage}t`];
  if (d.anfrage.space !== null) {
    teile.push(`space-${d.anfrage.space}`);
  }
  if (d.anfrage.team !== null) {
    teile.push(`team-${d.anfrage.team}`);
  }
  return `${teile.join("_").replace(/[^\w.-]+/g, "-")}.csv`;
}
