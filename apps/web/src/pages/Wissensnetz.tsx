// ================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE.   JOB 3052 · D6 — DAS NETZ DES ZIELBILDS MIT SEITENLEISTE.
// JOB 3067 · V4 — DIE ABLESEKARTE UNTER DEM NETZ (s. `Sichtzahlen`/`Themenzeilen` weiter unten).
// ================================================================================================
//
// DIE ABNAHME (JOB 2600), woertlich: „Auf der bestehenden Klara-Oberflaeche erscheint eine
// Themenkarte mit hoechstens 40 Themen. Knotengroesse entspricht der Menge zugeordneten Wissens.
// Die Farbe zeigt den vorhandenen Freigabe- und Quellenstatus. Eine Kante erscheint nur, wenn zwei
// Themen in demselben freigegebenen Wissensobjekt vorkommen. Beim Anklicken eines Knotens oeffnet
// sich die Liste der belegenden Wissensobjekte."
//
// WAS DIESE DATEI NICHT TUT — und das ist der Grund, warum sie ueberschaubar bleibt:
//   · Sie rechnet NICHTS aus. Groesse, Farbe, Ubiquitaet und Kantenauswahl entstehen im Server
//     (`services/wissensnetz/src/themenkarte.ts`), hinter der Rechte-Naht. Hier wird gezeichnet.
//     Auch die Ablesekarte (JOB 3067) rechnet nicht: sie ORDNET die schon erhobenen Zahlen fuer das
//     Auge (`Themenzeilen`) und stellt keine einzige davon selbst auf.
//   · Sie holt KEINE zweite Zaehlung. Die Seitenleiste (D6) speist sich aus der BESTEHENDEN
//     Bibliothekssuche (`useLibrarySearch`, Facette `tag` — dieselben Parameter wie
//     `Library.tsx`): ein Hook, kein neuer Server-Weg. Was sie zeigt, ist die Antwort dieser Suche
//     fuer DIESE Nutzerin — sichtbar getrimmt an der Route (`library-routes.ts`).
//   · Der Weg in die Bibliothek bleibt: `themenHref` → `/bibliothek?tag=…` (`Library.tsx`,
//     `facetSelectionFromParams`) — jetzt als Link „Alle N Objekte oeffnen" in der Leiste statt
//     als einziger Klickweg am Knoten.
//
// DAS LAYOUT (D6, Auftrag §2a) BLEIBT DETERMINISTISCH — kein Kraefte-Layout, keine Optimierung,
// keine Animation (JOB 2600 §3: gleiche Daten ⇒ gleiches Bild, testbar). Das Zielbild
// (Wissensnetz.dc.html) zeigt von Hand gesetzte Positionen: der groesste Knoten mittig, die
// uebrigen darum. Genau dieses Muster ohne Zufall: das groesste Thema in der Mitte der 880×660-
// Flaeche, die uebrigen auf einer Ellipse darum (beginnend oben, im Uhrzeigersinn). Radius 22…46
// nach der Wurzel der Traegerzahl, der Name IM Kreis, Kanten als eine ruhige helle Linie.
//
// ABGELOEST (nicht daneben belassen): der 720×520-Ring mit gleich grossen Kreisen, der Name UNTER
// dem Kreis, die Inline-Legende in einer Zeile, der Direktsprung als einziger Klickweg.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLibrarySearch, useWissensnetz } from "../api/hooks";
import type {
  KnowledgeObject,
  Sichtmetrik,
  ThemenMetrik,
  Themenfarbe,
  Themenkarte,
  Themenknoten,
} from "../api/types";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";

// ------------------------------------------------------------------------------------------------
// DIE FARBEN: Palette des Zielbilds, Wahrheit des Produkts (Auftrag §2b).
// ------------------------------------------------------------------------------------------------
// Drei Produktzustaende (`themenkarte-typen.ts:33-43`): `belegt` = validiert UND mit Quelle,
// `freigegeben` = validiert, aber ohne Quelle, `offen` = kein validierter Traeger. Sie werden auf
// die drei Zielbild-Farben abgebildet — gruen, weiss, gelb — und die Legende sagt, was der Zustand
// IST (Schluessel `wissensnetz.farbe.*`). Prozentanzeigen gibt es keine (JOB 2600 §3).
//
// Farben sind TOKENS des Themas (`styles/themes.css`), als Stil am Element — kein zweites
// Hex-Literal (mega40-token-disziplin) und keine zusammengesetzte Klasse (der Klassenzaehler in
// tests/app/mega47-modale-flaechen-sammler.test.tsx zaehlt unaufloesbare Bindungen; ein
// `FARBKLASSE[farbe]` waere eine). Im modernen Thema sind das genau die Werte des Zielbilds:
// pos-bg #E0F1E7 / pos-text #116B3C · warn-bg #FDF1D7 / warn-text #8A5A00 · surface #FFFFFF /
// muted #525B6B · brand #E8630A / funke-deep #C2500A / brand-text #9C5009.
interface Knotenfarbe {
  fuellung: string;
  rand: string;
  randBreite: number;
  text: string;
}
const FARBE: Record<Themenfarbe, Knotenfarbe> = {
  belegt: {
    fuellung: "rgb(var(--kw-trust-pos-bg))",
    rand: "rgb(var(--kw-trust-pos-text))",
    randBreite: 2,
    text: "rgb(var(--kw-trust-pos-text))",
  },
  offen: {
    fuellung: "rgb(var(--kw-trust-warn-bg))",
    rand: "rgb(var(--kw-trust-warn-text))",
    randBreite: 2,
    text: "rgb(var(--kw-trust-warn-text))",
  },
  freigegeben: {
    fuellung: "rgb(var(--kw-surface))",
    rand: "rgb(var(--kw-muted))",
    randBreite: 1.5,
    text: "rgb(var(--kw-muted))",
  },
};
/** Das GEWAEHLTE Thema (Zielbild Z.37–39): Funke mit 14 % Deckung, dunkler Funke als Rand. */
const GEWAEHLT: Knotenfarbe = {
  fuellung: "rgb(var(--kw-brand))",
  rand: "rgb(var(--kw-funke-deep))",
  randBreite: 2.5,
  text: "rgb(var(--kw-brand-text))",
};
const GEWAEHLT_DECKUNG = 0.14;
const HAARLINIE = "1px solid rgb(var(--kw-hairline))";
const MUTED = "rgb(var(--kw-muted))";
const SURFACE = "rgb(var(--kw-surface))";

/** Reihenfolge der Legende wie im Zielbild: gruen, gelb, weiss. */
const FARB_REIHENFOLGE: Themenfarbe[] = ["belegt", "offen", "freigegeben"];

// ------------------------------------------------------------------------------------------------
// DIE ZEICHENFLAECHE: 880×660 (Zielbild Z.24) — IN CSS-PIXELN, NICHT SKALIERT (Runde 6, BEN).
// ------------------------------------------------------------------------------------------------
// Bis Runde 5 hatte das SVG feste Koordinaten 880×660 und skalierte ueber `viewBox` in die Flaeche,
// die die Huelle laesst — bei 1280×800 sind das 582 px, Faktor 0,66: aus 10,5 px Schrift wurden
// sichtbare 6,9 px, aus einem Kreis mit Radius 22 einer mit 15 px. Das Zielbild meint seine Werte
// aber in Pixeln. Deshalb ist das Koordinatensystem jetzt das der Seite: `viewBox` = sichtbare
// Groesse, Radien 22…46 und Schriftgrade 10,5…13 sind echte Pixel in jedem Fenster. Die Flaeche ist
// so breit, wie die Huelle laesst (hoechstens 880 — das Zielbild), im Seitenverhaeltnis 880:660 —
// und QUADRATISCH, sobald mehr als eine Bahn noetig ist: dann waechst das Bild in die Hoehe (die
// Seite scrollt), statt die Knoten zu verkleinern. Gemessen in Chromium: G (1280×800: 582 px breit,
// Skalierung 1), G5 (1600×900: genau 880×660 px).
const BREITE = 880;
const HOEHE = 660;
/** Polster zwischen dem aeussersten Knoten (R_MAX) und dem Rand der Flaeche. */
const RAND = 16;
/**
 * Die Bahnen fuer die uebrigen Themen, als Anteil der groessten Ellipse, die einen Knoten mit R_MAX
 * noch in der Flaeche haelt (rx = Breite/2 − R_MAX − RAND, ry = Hoehe/2 − R_MAX − RAND): aussen,
 * mittig, innen. Die innerste laesst dem Mittelknoten Luft. Die Legenden-Karte (Z.62) liegt NICHT
 * ueber dem Bild: Runde 3 reserviert unter dem SVG ihre gemessene Hoehe (`Legendenreserve`).
 *
 * Passen die uebrigen Themen nicht mehr beruehrungsfrei auf EINE Bahn (mehr als BAHN_FASST), kommen
 * deterministisch weitere Bahnen hinzu — die Knoten der Groesse nach blockweise verteilt (die
 * groessten aussen), jede Bahn um einen halben Schritt gegen die naechste versetzt. Kein Kraefte-
 * Layout, gleiche Daten ⇒ gleiches Bild.
 */
/** Ab so vielen uebrigen Themen gilt die Karte als dicht: die Flaeche wird quadratisch. */
const BAHN_FASST = 13;
/** Luft zwischen zwei Bahnen (zusaetzlich zu den Radien) und zwischen Nachbarn auf einer Bahn. */
const BAHN_LUFT = 8;
/**
 * Runde 7 (BEN): die Bahnen werden nach FASSUNGSVERMOEGEN gefuellt, nicht nach fester Zahl. Zwei
 * Kreis-Rechtecke sind disjunkt, wenn sie sich in x ODER y um r1 + r2 unterscheiden; auf einem
 * Bogen ist der schlechteste Fall die Diagonale — Nachbarn brauchen deshalb die Bogenlaenge
 * (r1 + r2) · √2. So viele Knoten, wie die aeussere Bahn davon fasst, kommen darauf (die groessten
 * zuerst), der Rest auf die naechste Bahn weiter innen, um 2r + Luft naeher an der Mitte — bis die
 * Mitte erreicht ist. 40 gleiche Themen mit Radius 22 finden so bei 582 px Breite auf ZWEI Bahnen
 * Platz, ohne Verkleinerung (K10, G4).
 */
const BAHN_DIAGONALE = Math.SQRT2 * 1.02;

/** Wie hoch die Flaeche fuer `anzahl` Themen bei dieser Breite ist: Zielbild-Verhaeltnis, bei Dichte quadratisch. */
export function zeichenhoehe(anzahl: number, breite: number): number {
  const dicht = anzahl - 1 > BAHN_FASST;
  return dicht ? breite : Math.round((breite * HOEHE) / BREITE);
}
/** Radius 22…46 (Zielbild Z.34–59): Groesse = sichtbares Wissen. */
const R_MIN = 22;
const R_MAX = 46;
/** Hoechstens drei Objektkarten in der Leiste (Zielbild Z.77–88). */
const LEISTE_KARTEN = 3;

interface Platz {
  knoten: Themenknoten;
  x: number;
  y: number;
  r: number;
}

/**
 * Das Netz: das groesste Thema (erstes der absteigend sortierten Liste — `Themenkarte.themen` ist
 * „absteigend nach Groesse, Name als Stichentscheid", themenkarte-typen.ts:65) in der Mitte, die
 * uebrigen auf der Ellipse darum, Knoten `i` von `n−1` beginnend oben, im Uhrzeigersinn.
 *
 * Der Radius waechst mit der WURZEL der Traegerzahl, nicht linear: die FLAECHE soll die Menge
 * tragen. Linear waere ein Thema mit vierfachem Bestand sechzehnfach so gross und erschluege die
 * Karte. Bei nur einem vorkommenden Wert bekommen alle denselben Radius — seit Runde 7 R_MIN, das
 * Zielbild-Mass des kleinsten Knotens (s. `radius`); eine Division durch null gibt es nicht.
 *
 * DER PLATZFAKTOR (Runde 5, BEN) ist seit Runde 7 nur noch die letzte Sicherung: Erst wenn auch die
 * innerste Bahn die uebrigen Knoten nicht mehr fasst (Flaechengrenze), werden die Radien NACH der
 * Platzierung proportional verkleinert, bis kein Kreis-Rechteck (2r × 2r) ein anderes schneidet:
 * fuer jedes Paar muss der groessere Achsabstand mindestens r1 + r2 betragen; der Faktor ist das
 * kleinste Verhaeltnis darueber (mit 2 % Luft), hoechstens 1. Deterministisch, ohne Iteration; die
 * Ordnung der Groessen bleibt. Fuer jeden in K10 und G4 gemessenen Bestand bis 40 Themen — auch 40
 * gleiche bei 582 px — ist der Faktor 1: Radius 22…46 wie im Zielbild.
 */
export function netzplaetze(
  themen: readonly Themenknoten[],
  breite: number = BREITE,
  hoehe: number = zeichenhoehe(themen.length, breite),
): Platz[] {
  const n = themen.length;
  if (n === 0) {
    return [];
  }
  const MITTE_X = breite / 2;
  const MITTE_Y = hoehe / 2;
  const werte = themen.map((k) => Math.max(k.objekte, 0));
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const spanne = max - min;
  const radius = (objekte: number): number => {
    // Runde 7: bei nur EINEM vorkommenden Wert bekommen alle R_MIN — nicht R_MAX. 40 gleich haeufige
    // Themen mit Radius 46 passen auf keine Flaeche (BEN, Runde 4/5); mit 22 (dem Zielbild-Mass des
    // kleinsten Knotens) passen sie bei 582 px auf zwei Bahnen. Ein Bild mit einem einzigen Thema
    // zeigt ohnehin keinen Groessenvergleich.
    const anteil =
      spanne === 0
        ? 0
        : (Math.sqrt(Math.max(objekte, 0)) - Math.sqrt(min)) /
          (Math.sqrt(max) - Math.sqrt(min) || 1);
    return R_MIN + (R_MAX - R_MIN) * anteil;
  };
  // Das groesste Thema in die Mitte — nach der Traegerzahl, nicht nach der Listenposition, damit
  // das Bild auch dann stimmt, wenn eine Karte einmal nicht sortiert ankommt (erstes bei Gleichstand).
  const groesstes = werte.indexOf(max);
  const erstes = themen[groesstes];
  if (!erstes) {
    return [];
  }
  const rest = themen.filter((_, i) => i !== groesstes);
  const mitte: Platz = { knoten: erstes, x: MITTE_X, y: MITTE_Y, r: radius(erstes.objekte) };
  // Die groessten zuerst — stabil, damit gleiche Traegerzahlen ihre Serverreihenfolge behalten.
  const sortiert = rest
    .map((knoten, i) => ({ knoten, i, r: radius(knoten.objekte) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  // Die groesste Ellipse, die den groessten Knoten des Bildes noch in der Flaeche haelt.
  const rGrenze = Math.max(mitte.r, ...sortiert.map((e) => e.r));
  const RX_MAX = Math.max(1, breite / 2 - rGrenze - RAND);
  const RY_MAX = Math.max(1, hoehe / 2 - rGrenze - RAND);
  const roh: Platz[] = [mitte];
  let ry = RY_MAX;
  let bahn = 0;
  let i = 0;
  while (i < sortiert.length) {
    const rx = (RX_MAX * ry) / RY_MAX;
    const rTop = sortiert[i]?.r ?? R_MIN;
    // Was diese Bahn fasst: ihr Umfang (konservativ: der Kreis mit dem kleineren Halbmesser) geteilt
    // durch die Bogenlaenge, die zwei Nachbarn mit dem groessten Radius dieser Bahn brauchen.
    const bogen = 2 * rTop * BAHN_DIAGONALE + BAHN_LUFT;
    const fasst = Math.max(1, Math.floor((2 * Math.PI * Math.min(rx, ry)) / bogen));
    // Passt die NAECHSTE Bahn nicht mehr zwischen diese und die Mitte, nimmt diese alle uebrigen —
    // dann greift der Platzfaktor. Das ist die Flaechengrenze, nicht die Regel.
    // Auch nach innen gilt die Diagonale: ein innerer Knoten kann schraeg hinter einem aeusseren
    // liegen, also braucht der Bahnabstand (r1 + r2) · √2 + Luft — nicht nur r1 + r2.
    const naechsteRy = ry - (2 * rTop * BAHN_DIAGONALE + BAHN_LUFT);
    const letzte = naechsteRy < (mitte.r + rTop) * BAHN_DIAGONALE + BAHN_LUFT;
    const anzahl = letzte ? sortiert.length - i : Math.min(fasst, sortiert.length - i);
    for (let platz = 0; platz < anzahl; platz++) {
      const eintrag = sortiert[i + platz];
      if (!eintrag) {
        break;
      }
      // Auf jeder Bahn beginnt die Zaehlung oben und laeuft im Uhrzeigersinn, um `bahn/2` Schritte
      // gegen die Nachbarbahn versetzt — kein innerer Knoten liegt radial hinter einem aeusseren.
      const winkel = -Math.PI / 2 + (2 * Math.PI * (platz + bahn / 2)) / anzahl;
      roh.push({
        knoten: eintrag.knoten,
        x: MITTE_X + rx * Math.cos(winkel),
        y: MITTE_Y + ry * Math.sin(winkel),
        r: eintrag.r,
      });
    }
    i += anzahl;
    ry = naechsteRy;
    bahn += 1;
  }
  // Die Mitte bleibt an erster Stelle (`plaetze[0]` = das groesste Thema, die Vorgabe-Auswahl); die
  // uebrigen zurueck in die Reihenfolge der Karte, damit Aufrufer eine feste Ordnung sehen.
  const reihenfolge = new Map(themen.map((k, idx) => [k.thema, idx]));
  const uebrige = roh
    .slice(1)
    .sort(
      (a, b) => (reihenfolge.get(a.knoten.thema) ?? 0) - (reihenfolge.get(b.knoten.thema) ?? 0),
    );
  roh.splice(1, roh.length - 1, ...uebrige);
  const faktor = platzfaktor(roh);
  return faktor >= 1 ? roh : roh.map((p) => ({ ...p, r: p.r * faktor }));
}

/** Das kleinste Verhaeltnis aus Achsabstand und Radiensumme ueber alle Paare, mit 2 % Luft, ≤ 1. */
function platzfaktor(plaetze: readonly Platz[]): number {
  let faktor = 1;
  for (let i = 0; i < plaetze.length; i++) {
    for (let j = i + 1; j < plaetze.length; j++) {
      const a = plaetze[i] as Platz;
      const b = plaetze[j] as Platz;
      const abstand = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      const bedarf = a.r + b.r;
      if (bedarf > 0 && abstand < bedarf) {
        faktor = Math.min(faktor, (0.98 * abstand) / bedarf);
      }
    }
  }
  return faktor;
}

/** Der Klickweg: die BESTEHENDE Bibliothek, gefiltert auf dieses Schlagwort. */
export function themenHref(thema: string): string {
  return `/bibliothek?tag=${encodeURIComponent(thema)}`;
}

// ------------------------------------------------------------------------------------------------
// DER NAME IM KREIS (Zielbild Z.34–59): Schriftgrad nach Radius, Umbruch auf zwei Zeilen.
// ------------------------------------------------------------------------------------------------
/** Schriftgrad nach Radius — die Stufen der Vorlage (r46→13, r38/36/34→12, r30→11.5, r26/24→11, r22→10.5). */
function schriftgrad(r: number): number {
  if (r >= 40) {
    return 13;
  }
  if (r >= 34) {
    return 12;
  }
  if (r >= 30) {
    return 11.5;
  }
  if (r >= 24) {
    return 11;
  }
  return 10.5;
}
/**
 * Die geschaetzte Breite eines Textes in Pixeln — ohne Messen im Browser (deterministisch,
 * testbar). Runde 2 (BEN): „Name im Kreis" heisst, das ganze Text-Rechteck liegt links, rechts, oben
 * und unten im Kreis-Rechteck. Eine feste Zeichenzahl × 0.6 war dafuer zu grob („Dichtungen" ragte
 * bei r 22 seitlich heraus). Deshalb Zeichenklassen der Schrift (IBM Plex Sans, 600/700):
 * schmal (i l j t f r I . , - ' Leerzeichen) ≈ 0,32 em · breit (m w M W) ≈ 0,9 em · Grossbuchstaben
 * und Ziffern ≈ 0,66 em · sonst ≈ 0,58 em — plus 8 % Sicherheit fuer den fetten Schnitt und die
 * Rundung des Renderers. Kalibriert in Chromium (tests/design/zielbild-wissensnetz.test.ts, N3/R):
 * jeder Name des Bestands liegt mit seinem echten DOMRect im Kreis.
 */
const ZEICHEN_SCHMAL = /[iljtfrI.,\-' ]/;
const ZEICHEN_BREIT = /[mwMW]/;
const ZEICHEN_GROSS = /[A-ZÄÖÜ0-9]/;
export function textbreite(text: string, grad: number): number {
  let em = 0;
  for (const z of text) {
    em += ZEICHEN_SCHMAL.test(z)
      ? 0.32
      : ZEICHEN_BREIT.test(z)
        ? 0.9
        : ZEICHEN_GROSS.test(z)
          ? 0.66
          : 0.58;
  }
  return em * grad * 1.08;
}

/** Wie der Name im Kreis steht: die Zeilen, ihr Schriftgrad, und ob gekuerzt werden musste. */
export interface Beschriftung {
  zeilen: string[];
  grad: number;
  gekuerzt: boolean;
}
/**
 * Runde 7 (BEN): die Schrift schrumpft nie unter das kleinste Zielbild-Mass (r 22 → 10,5 px). Ein
 * grosser Knoten darf fuer einen langen Namen von 13 auf 10,5 gehen; darunter wird gekuerzt.
 */
const GRAD_MIN = 10.5;
const AUSLASSUNG = "…";

/** Zwei Zeilen am Leerzeichen oder Bindestrich, das der Mitte am naechsten liegt („Hygienic"/„Design"). */
function amTrennzeichen(name: string): [string, string] | null {
  const stellen: number[] = [];
  for (let i = 1; i < name.length - 1; i++) {
    if (name[i] === " ") {
      stellen.push(i);
    } else if (name[i] === "-") {
      stellen.push(i + 1);
    }
  }
  if (stellen.length === 0) {
    return null;
  }
  const mitte = name.length / 2;
  const beste = stellen.reduce((a, b) => (Math.abs(b - mitte) < Math.abs(a - mitte) ? b : a));
  const links = name.slice(0, beste).trim();
  const rechts = name.slice(beste).trim();
  return links.length > 0 && rechts.length > 0 ? [links, rechts] : null;
}

/** Zwei Zeilen mit Trennstrich mitten im Wort („Spritz-"/„zonen", Zielbild Z.49–50): der laengste passende Kopf. */
function mitTrennstrich(name: string, grad: number, maxBreite: number): [string, string] | null {
  for (let k = name.length - 2; k >= 2; k--) {
    const kopf = `${name.slice(0, k)}-`;
    const rest = name.slice(k);
    if (textbreite(kopf, grad) <= maxBreite && textbreite(rest, grad) <= maxBreite) {
      return [kopf, rest];
    }
  }
  return null;
}

/** Eine Zeile auf die Breite kuerzen — mit Auslassungszeichen, so lang wie moeglich. */
function gekuerzt(text: string, grad: number, maxBreite: number): string {
  for (let k = text.length; k >= 1; k--) {
    const probe = `${text.slice(0, k)}${AUSLASSUNG}`;
    if (textbreite(probe, grad) <= maxBreite) {
      return probe;
    }
  }
  return AUSLASSUNG;
}

/**
 * Der Name im Kreis — deterministisch, in dieser Reihenfolge, beim Schriftgrad des Radius und dann
 * in halben Schritten kleiner bis GRAD_MIN:
 *   1. eine Zeile, wenn sie passt
 *   2. zwei Zeilen am Leerzeichen/Bindestrich
 *   3. zwei Zeilen mit Trennstrich im Wort
 * Passt es auch bei GRAD_MIN nicht, wird EHRLICH gekuerzt (zwei Zeilen, Auslassungszeichen am
 * Ende) — der volle Name steht im `aria-label` und im `<title>` des Knotens. Erfunden wird nichts,
 * und nichts ragt aus dem Kreis: das Kreis-Rechteck ist 2r breit, jede Zeile bekommt 2r − 4.
 */
/**
 * Das laengste gemeinsame Praefix aller gezeichneten Namen — die Stelle, ab der sie sich
 * unterscheiden. Runde 7 (BEN): 40 Themen „Ventilanlage Produktionsbereich Segment01…40" wurden
 * alle zu „Ventil- anlag…"; das Unterscheidende liegt hinter dem gemeinsamen Anfang, und den kennt
 * nur, wer ALLE Namen sieht. Ein einzelner Name hat kein Praefix (0).
 */
/**
 * DIE BESCHRIFTUNGEN EINES GANZEN BILDES (Runde 8, BEN) — kollisionsfrei ueber alle Labels, nicht
 * nur ein globales Praefix. Ein globales Praefix scheitert, sobald EIN Name frueh abweicht und die
 * uebrigen sich erst tief unten unterscheiden („…Sektor Sonderzweig" neben 39 „…SegmentGemeinsamer-
 * Unterscheidungsblock01…39": alle 39 wurden „…gme…"). Deshalb:
 *   1. Jeder Name gehoert zur FAMILIE der Namen, die hinter dem gemeinsamen Anfang aller Namen
 *      dasselbe Zeichen tragen. Seine zweite Zeile beginnt am gemeinsamen Anfang SEINER Familie —
 *      ein Einzelkind am globalen Anfang. So zeigt „…Sonderzweig" „…ktor…" und jedes Segment „…NN".
 *   2. Sind danach zwei sichtbare Labels gleich, wird verfeinert, bis keines mehr doppelt ist:
 *      gleiche Familie → der Start rueckt auf den gemeinsamen Anfang der Kollisionsgruppe (hinter
 *      ihm unterscheiden sie sich); verschiedene Familien → das Familienzeichen wird eingeblendet
 *      („…g…01" / „…k…01"). Jeder Schritt bewegt sich nur vorwaerts, also endet es. Deterministisch.
 * Namen, die ganz (oder mit Trennstrich) in den Kreis passen, bleiben, wie sie sind — sie sind als
 * volle Namen ohnehin verschieden. Bleibt trotz Verfeinerung ein Doppel (nur bei Namen, die sich
 * ausschliesslich in einem Mittelstueck unterscheiden, das nicht in die Zeile passt), steht der
 * volle Name im aria-label und im Tooltip — geprueft wird die Eindeutigkeit in K10 und G4.
 */
export function beschriftungen(eintraege: readonly { name: string; r: number }[]): Beschriftung[] {
  const namen = eintraege.map((e) => e.name);
  const global = gemeinsamesPraefix(namen);
  // Passt der ganze Rest hinter dem gemeinsamen Anfang in die Zeile („…01"), bleibt es dabei —
  // das ist die lesbarste Form. Sonst beginnt die Zeile am gemeinsamen Anfang der FAMILIE.
  const passtAb = (name: string, r: number, von: number): boolean =>
    textbreite(`${AUSLASSUNG}${name.slice(von)}`, GRAD_MIN) <= 2 * r - 4;
  const start = namen.map((name, i) => {
    if (global === 0 || passtAb(name, eintraege[i]?.r ?? 0, global)) {
      return global;
    }
    const familie = namen.filter((n) => n[global] !== undefined && n[global] === name[global]);
    return familie.length > 1 ? gemeinsamesPraefix(familie) : global;
  });
  const zweig = namen.map(() => "");
  const sichtbar = (b: Beschriftung): string => b.zeilen.join(" ");
  let labels = eintraege.map((e, i) => beschriftung(e.name, e.r, start[i] ?? 0, zweig[i] ?? ""));
  // Runde 9: hoechstens 64 Verfeinerungsrunden — jede bewegt einen Start nur vorwaerts oder blendet
  // ein Familienzeichen ein; ohne Aenderung endet die Schleife frueher.
  const VERFEINERUNGSRUNDEN = 64;
  for (let runde = 0; runde < VERFEINERUNGSRUNDEN; runde++) {
    const gruppen = new Map<string, number[]>();
    labels.forEach((b, i) => {
      if (!b.gekuerzt) {
        return;
      }
      const schluessel = sichtbar(b);
      gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), i]);
    });
    let geaendert = false;
    for (const indizes of gruppen.values()) {
      if (indizes.length < 2) {
        continue;
      }
      // Teilen die Kollidierenden mehr als den globalen Anfang, beginnt ihre Zeile dort — da
      // unterscheiden sie sich mit dem ersten Zeichen. Teilen sie NUR den globalen Anfang (andere
      // Familien), wird das Familienzeichen eingeblendet.
      const tiefer = gemeinsamesPraefix(indizes.map((i) => namen[i] ?? ""));
      if (tiefer > global) {
        for (const i of indizes) {
          if (start[i] !== tiefer && tiefer < (namen[i]?.length ?? 0)) {
            start[i] = tiefer;
            geaendert = true;
          }
        }
      } else {
        for (const i of indizes) {
          const zeichen = namen[i]?.[global] ?? "";
          if (zweig[i] === "" && zeichen !== "") {
            zweig[i] = zeichen;
            geaendert = true;
          }
        }
      }
    }
    if (!geaendert) {
      break;
    }
    labels = eintraege.map((e, i) => beschriftung(e.name, e.r, start[i] ?? 0, zweig[i] ?? ""));
  }
  return labels;
}

export function gemeinsamesPraefix(namen: readonly string[]): number {
  if (namen.length < 2) {
    return 0;
  }
  const erster = namen[0] ?? "";
  let n = erster.length;
  for (const name of namen) {
    let k = 0;
    while (k < n && k < name.length && name[k] === erster[k]) {
      k++;
    }
    n = k;
  }
  return n;
}

export function beschriftung(name: string, r: number, praefixLaenge = 0, zweig = ""): Beschriftung {
  const maxBreite = 2 * r - 4;
  for (let grad = schriftgrad(r); grad >= GRAD_MIN; grad -= 0.5) {
    if (textbreite(name, grad) <= maxBreite) {
      return { zeilen: [name], grad, gekuerzt: false };
    }
    const zwei = amTrennzeichen(name);
    if (zwei && textbreite(zwei[0], grad) <= maxBreite && textbreite(zwei[1], grad) <= maxBreite) {
      return { zeilen: zwei, grad, gekuerzt: false };
    }
    const getrennt = mitTrennstrich(name, grad, maxBreite);
    if (getrennt) {
      return { zeilen: getrennt, grad, gekuerzt: false };
    }
  }
  // Kuerzen bei GRAD_MIN. Runde 7 (BEN): teilt der Name mit den anderen Namen des Bildes einen
  // Anfang, steht in der zweiten Zeile die Stelle, AB DER er sich unterscheidet — vorne mit
  // Auslassung, wenn sie mitten im Wort liegt („Ventil…" / „…01"), sonst ohne („Ventil…" / „07").
  // Reicht der Platz nicht fuer den ganzen Rest, wird er hinten gekuerzt: sein Anfang ist das
  // Unterscheidende. Der Kopf darueber ist der gemeinsame Anfang, mit Auslassung gekuerzt. Keine
  // Sonderregel fuer kurze Woerter — die Regel gilt fuer jedes Praefix.
  const grad = GRAD_MIN;
  if (praefixLaenge > 0 && praefixLaenge < name.length) {
    const kopfText = name.slice(0, praefixLaenge).trimEnd();
    const rest = name.slice(praefixLaenge).trimStart();
    const mittenImWort = name[praefixLaenge - 1] !== " " && name[praefixLaenge] !== " ";
    const restZeile = (() => {
      // `zweig`: das Zeichen, an dem sich die Familie dieses Namens von den anderen Familien trennt —
      // steht nur da, wenn zwei Familien sonst dieselbe zweite Zeile zeigten („…g…01" / „…k…01").
      const vorne =
        zweig.length > 0 ? `${AUSLASSUNG}${zweig}${AUSLASSUNG}` : mittenImWort ? AUSLASSUNG : "";
      if (textbreite(`${vorne}${rest}`, grad) <= maxBreite) {
        return `${vorne}${rest}`;
      }
      for (let k = rest.length - 1; k >= 1; k--) {
        const probe = `${vorne}${rest.slice(0, k).trimEnd()}${AUSLASSUNG}`;
        if (textbreite(probe, grad) <= maxBreite) {
          return probe;
        }
      }
      return `${vorne}${rest.slice(0, 1)}`;
    })();
    if (rest.length > 0 && kopfText.length > 0) {
      return { zeilen: [gekuerzt(kopfText, grad, maxBreite), restZeile], grad, gekuerzt: true };
    }
  }
  // Ohne gemeinsamen Anfang: der laengste Kopf mit Trennstrich, der Rest mit Auslassung.
  let kopf = "";
  for (let k = name.length - 1; k >= 1; k--) {
    if (textbreite(`${name.slice(0, k)}-`, grad) <= maxBreite) {
      kopf = `${name.slice(0, k)}-`;
      break;
    }
  }
  if (kopf.length === 0) {
    return { zeilen: [gekuerzt(name, grad, maxBreite)], grad, gekuerzt: true };
  }
  const rest = name.slice(kopf.length - 1);
  return { zeilen: [kopf, gekuerzt(rest, grad, maxBreite)], grad, gekuerzt: true };
}

// ------------------------------------------------------------------------------------------------
// DAS DATUM der Objektkarte (Zielbild Z.79: „freigegeben · 27.08.2026") — nur Datum, kein Erfinden:
// fehlt `createdAt` oder ist es unlesbar, steht das Statuswort allein (wie lib/koDates.ts:5-6).
// ------------------------------------------------------------------------------------------------
function datumVon(iso: string | undefined, locale: string): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}
function uhrzeitVon(ms: number, locale: string): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------------------------------------------
// DIE SEITENLEISTE (Zielbild Z.70–91): Kopf mit Farbpunkt und Titel, Zaehlsatz, bis zu drei
// Objektkarten, Link „Alle N Objekte oeffnen".
// ------------------------------------------------------------------------------------------------
// ZUSTANDSMODELL (Auftrag §9; Lehre JOB 3037 R2–R4): laden → drei Platzhalterkarten ohne Text ·
// leer → Leersatz · Fehler ohne Daten → Fehlersatz · Fehler MIT Daten (gescheiterte Auffrischung)
// → die alten Karten bleiben, dazu „Stand von <Zeit> · Auffrischung fehlgeschlagen". Nie „nichts
// sichtbar" ohne eine erfolgreiche frische Antwort.
//
// DIE ANTWORT IST AN DIE AUSWAHL GEBUNDEN (Lehre JOB 3046 R1): der Query-Key von `useLibrarySearch`
// traegt die Parameter, also das gewaehlte Thema. Ein verspaeteter Ruecklauf der ALTEN Auswahl
// landet unter dem alten Schluessel und ueberschreibt die neue Leiste nicht — React Query liefert
// fuer den neuen Schluessel nur dessen eigene Antwort (kein `placeholderData`, kein `keepPrevious`).
const KARTE_STIL = {
  padding: "10px 12px",
  background: "rgb(var(--kw-page))",
  border: HAARLINIE,
  borderRadius: 9,
} as const;

function Seitenleiste({ thema }: { thema: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  // Dieselben Parameter wie die Facette `tag` der Bibliothek (Library.tsx, buildLibraryQuery).
  const suche = useLibrarySearch({ tag: thema });
  const objekte: KnowledgeObject[] | undefined = suche.data;
  const frei = objekte?.filter((o) => o.status === "validiert").length ?? 0;
  const pruefung = objekte === undefined ? 0 : objekte.length - frei;
  const statusWort = (o: KnowledgeObject): string =>
    o.status === "validiert"
      ? t("wissensnetz.leiste.status.validiert")
      : t("wissensnetz.leiste.status.offen");

  return (
    <aside
      data-testid="netz-seitenleiste"
      aria-label={t("wissensnetz.leiste.alt", { thema })}
      style={{
        width: 340,
        flexShrink: 0,
        borderLeft: HAARLINIE,
        background: SURFACE,
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div data-testid="leiste-kopf" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          data-testid="leiste-punkt"
          aria-hidden="true"
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "rgb(var(--kw-brand))",
            flexShrink: 0,
          }}
        />
        <h2
          data-testid="leiste-titel"
          className="text-text"
          style={{ fontSize: 16, fontWeight: 650 }}
        >
          {thema}
        </h2>
      </div>
      {objekte !== undefined && objekte.length > 0 ? (
        <p data-testid="leiste-zaehlung" style={{ fontSize: 12.5, color: MUTED }}>
          {t("wissensnetz.leiste.zaehlung", { frei, pruefung })}
        </p>
      ) : null}
      {objekte !== undefined && suche.isError ? (
        <p data-testid="leiste-hinweis" style={{ fontSize: 12.5, color: MUTED }}>
          {t("wissensnetz.stand.fehlgeschlagen", {
            stand: uhrzeitVon(suche.dataUpdatedAt, i18n.language),
          })}
        </p>
      ) : null}
      <div
        data-testid="leiste-objekte"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
        aria-busy={objekte === undefined && suche.isFetching}
      >
        {objekte === undefined && !suche.isError
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                data-testid="leiste-platzhalter"
                aria-hidden="true"
                style={{ ...KARTE_STIL, height: 48, background: "rgb(var(--kw-hairline))" }}
              />
            ))
          : null}
        {objekte === undefined && suche.isError ? (
          <p data-testid="leiste-fehler" className="text-sm text-muted">
            {t("wissensnetz.leiste.fehler")}
          </p>
        ) : null}
        {objekte !== undefined && objekte.length === 0 ? (
          <p data-testid="leiste-leer" className="text-sm text-muted">
            {t("wissensnetz.leiste.leer")}
          </p>
        ) : null}
        {(objekte ?? []).slice(0, LEISTE_KARTEN).map((o) => {
          const datum = datumVon(o.createdAt, i18n.language);
          return (
            <div key={o.id} data-testid="leiste-objekt" style={KARTE_STIL}>
              <div
                data-testid="leiste-objekt-titel"
                className="text-text"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {o.title}
              </div>
              <div data-testid="leiste-objekt-unterzeile" style={{ fontSize: 11.5, color: MUTED }}>
                {datum === null ? statusWort(o) : `${statusWort(o)} · ${datum}`}
              </div>
            </div>
          );
        })}
      </div>
      <Link
        data-testid="leiste-alle"
        to={themenHref(thema)}
        style={{ fontSize: 12.5, fontWeight: 600, color: "rgb(var(--kw-brand-text))" }}
      >
        {objekte !== undefined && objekte.length > 0
          ? t("wissensnetz.leiste.alle", { count: objekte.length })
          : t("wissensnetz.leiste.oeffnen")}
      </Link>
    </aside>
  );
}

// ------------------------------------------------------------------------------------------------
// DIE KARTE: Netz, Legenden-Karte und Seitenleiste in einem Rahmen (Zielbild Z.23–91).
// ------------------------------------------------------------------------------------------------
function Karte({ karte }: { karte: Themenkarte }): JSX.Element {
  const { t } = useTranslation();
  // DIE BREITE DER FLAECHE (Runde 6, BEN): gemessen am Inhaltskasten der Zeichenflaeche, hoechstens
  // 880 (Zielbild). Das SVG bekommt genau diese Breite als `viewBox` UND als Groesse — Skalierung 1,
  // jede Zahl im Bild ist ein Pixel. Ohne ResizeObserver (jsdom) bleibt es bei 880×660.
  const flaecheRef = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(BREITE);
  useEffect(() => {
    const el = flaecheRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const messen = (): void => {
      const stil = getComputedStyle(el);
      const innen =
        el.getBoundingClientRect().width -
        Number.parseFloat(stil.paddingLeft) -
        Number.parseFloat(stil.paddingRight);
      setBreite(Math.max(200, Math.min(BREITE, Math.floor(innen))));
    };
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);
  const hoehe = zeichenhoehe(karte.themen.length, breite);
  const plaetze = netzplaetze(karte.themen, breite, hoehe);
  // Runde 7: wo sich die Namen dieses Bildes unterscheiden — fuer die Kuerzung (beschriftung).
  // Runde 8: die Beschriftungen des ganzen Bildes, kollisionsfrei ueber alle Labels (beschriftungen).
  const labels = beschriftungen(plaetze.map((p) => ({ name: p.knoten.thema, r: p.r })));
  // Vorgabe = das groesste Thema (Auftrag §2c), damit die Leiste nie leer ist. Faellt das gewaehlte
  // Thema bei einer Auffrischung aus der Karte, greift wieder die Vorgabe.
  const [gewaehltRoh, setGewaehlt] = useState<string | null>(null);
  const [fokus, setFokus] = useState<string | null>(null);
  const gewaehlt =
    gewaehltRoh !== null && plaetze.some((p) => p.knoten.thema === gewaehltRoh)
      ? gewaehltRoh
      : (plaetze[0]?.knoten.thema ?? null);
  const nachThema = new Map(plaetze.map((p) => [p.knoten.thema, p]));
  // Was das Bild TATSAECHLICH zeigt — die Legende haengt daran, nicht an einer Annahme.
  const vorhandeneFarben = new Set(karte.themen.map((k) => k.farbe));
  const hatUbiquitaere = karte.themen.some((k) => k.ohneKanten);
  // DIE LEGENDENRESERVE (Runde 3, BEN): die Karte ist absolut gesetzt (Zielbild Z.62) und ihre Hoehe
  // haengt vom Zustand ab — drei Farbmarken, der feste Satz, dazu Ubiquitaets- und Kantensatz. Statt
  // sie zu raten, wird sie GEMESSEN (ResizeObserver) und unter dem SVG als Leerraum reserviert:
  // Reserve = Hoehe + 16, damit die Karte (bottom 24 im Container mit 16 Polster) mindestens 8px
  // unter der Unterkante des Bildes beginnt. Kein Knoten und kein Name kann sie schneiden — in
  // JEDEM Zustand, nicht nur im kurzen. Ohne ResizeObserver (jsdom) bleibt die Reserve 0.
  const legendeRef = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState(0);
  useEffect(() => {
    const el = legendeRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const messen = (): void => setReserve(Math.ceil(el.getBoundingClientRect().height) + 16);
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  return (
    <section
      aria-label={t("wissensnetz.karte.label")}
      className="flex overflow-hidden rounded-[14px] border border-hairline bg-surface"
    >
      {/* Zielbild Z.24: `flex-grow: 1; position: relative; padding: 16px` — die Flaeche waechst in
          den Raum, den die Huelle laesst (Lehre JOB 3046 R1: echte Flex-Geometrie, gemessen in
          tests/design/zielbild-wissensnetz.test.ts, Fall G), und traegt die Legenden-Karte absolut. */}
      <div
        ref={flaecheRef}
        data-testid="netz-zeichenflaeche"
        style={{ flexGrow: 1, position: "relative", padding: 16, minWidth: 0 }}
      >
        <svg
          viewBox={`0 0 ${breite} ${hoehe}`}
          // Runde 6 (BEN): `viewBox` = sichtbare Groesse, Skalierung 1 — bei 1600×900 genau 880×660px
          // (G5), bei 1280×800 so breit, wie die Huelle laesst (G), Schrift und Radien in Pixeln.
          style={{ display: "block", width: breite, height: hoehe }}
          data-breite={breite}
          data-hoehe={hoehe}
          aria-label={t("wissensnetz.karte.alt", { count: karte.themen.length })}
          data-testid="themenkarte"
        >
          <title>{t("wissensnetz.karte.alt", { count: karte.themen.length })}</title>
          {/* Kanten zuerst, damit die Knoten darauf liegen. Eine Breite (Z.25–32); das Gewicht
              bleibt als `data-gewicht` messbar. */}
          <g>
            {karte.kanten.map((kante) => {
              const a = nachThema.get(kante.a);
              const b = nachThema.get(kante.b);
              if (!a || !b) {
                return null;
              }
              return (
                <line
                  key={`${kante.a}—${kante.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={2}
                  style={{ stroke: "rgb(var(--kw-hairline))" }}
                  data-testid="themenkante"
                  data-a={kante.a}
                  data-b={kante.b}
                  data-gewicht={kante.gewicht}
                />
              );
            })}
          </g>
          <g>
            {plaetze.map((p) => {
              const thema = p.knoten.thema;
              const istGewaehlt = gewaehlt === thema;
              const farbe = istGewaehlt ? GEWAEHLT : FARBE[p.knoten.farbe];
              const {
                zeilen,
                grad,
                gekuerzt: istGekuerzt,
              } = labels[plaetze.indexOf(p)] ?? beschriftung(thema, p.r);
              const waehlen = (): void => setGewaehlt(thema);
              return (
                // Auswahl statt Sprung (Auftrag §2c): Klick oder Enter/Leertaste WAEHLT das Thema
                // und fuellt die Leiste; der Weg in die Bibliothek ist der Link dort.
                <g
                  key={thema}
                  data-testid="themenknoten"
                  data-thema={thema}
                  data-farbe={p.knoten.farbe}
                  data-objekte={p.knoten.objekte}
                  // biome-ignore lint/a11y/useSemanticElements: ein Knoten im SVG — dort gibt es kein <button>; Rolle, Fokus, Enter/Leertaste und aria-pressed machen ihn zum Schalter.
                  role="button"
                  tabIndex={0}
                  aria-pressed={istGewaehlt}
                  aria-label={t("wissensnetz.knoten.alt", { thema, count: p.knoten.objekte })}
                  style={{ cursor: "pointer", outline: "none" }}
                  onClick={waehlen}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      waehlen();
                    }
                  }}
                  onFocus={() => setFokus(thema)}
                  onBlur={() => setFokus((f) => (f === thema ? null : f))}
                >
                  {/* Musste der Name gekuerzt werden, steht der volle als Tooltip — zusaetzlich zum
                      aria-label, das ihn immer traegt. */}
                  {istGekuerzt ? <title>{thema}</title> : null}
                  {/* Fokusring fuer die Tastatur — nur am fokussierten, nicht gewaehlten Knoten;
                      der gewaehlte zeigt seinen Zustand selbst. */}
                  {fokus === thema && !istGewaehlt ? (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.r + 4}
                      fill="none"
                      strokeWidth={1.5}
                      style={{ stroke: "rgb(var(--kw-funke-deep))" }}
                      data-testid="themenknoten-fokus"
                    />
                  ) : null}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    // Runde 2 (BEN): der gewaehlte Zustand hat Vorrang — Orange, 2.5 — auch am
                    // ubiquitaeren Knoten; nur die Strichelung bleibt zusaetzlich erhalten.
                    strokeWidth={
                      istGewaehlt ? GEWAEHLT.randBreite : p.knoten.ohneKanten ? 3 : farbe.randBreite
                    }
                    strokeDasharray={p.knoten.ohneKanten ? "4 3" : undefined}
                    fillOpacity={istGewaehlt ? GEWAEHLT_DECKUNG : undefined}
                    style={{ fill: farbe.fuellung, stroke: farbe.rand }}
                  />
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    style={{
                      fill: farbe.text,
                      fontWeight: istGewaehlt ? 700 : 600,
                      fontSize: grad,
                      pointerEvents: "none",
                    }}
                  >
                    {zeilen.length === 1 ? (
                      <tspan x={p.x} y={p.y + grad * 0.35}>
                        {zeilen[0]}
                      </tspan>
                    ) : (
                      zeilen.map((z, i) => (
                        <tspan key={z} x={p.x} y={p.y + (i === 0 ? -grad * 0.3 : grad * 0.95)}>
                          {z}
                        </tspan>
                      ))
                    )}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {/* Der reservierte Leerraum fuer die Legenden-Karte — so hoch wie sie selbst (s. oben). */}
        <div data-testid="netz-legende-reserve" aria-hidden="true" style={{ height: reserve }} />

        {/* DIE LEGENDEN-KARTE (Zielbild Z.62–67). Jeder Satz erscheint genau in dem Zustand, fuer den
            er wahr ist (JOB 2600 D4 · BENs Auflage zu D3: „Fassung A ist nicht fuer alle Zustaende
            wahr."):
              · eine Farbmarke nur, wenn ein Knoten sie traegt
              · der feste Satz „Groesse = sichtbares Wissen · Kante = gemeinsam freigegeben" immer —
                er beschreibt die Kodierung, nicht den Bestand
              · der Ubiquitaetssatz nur, wenn ein Knoten gestrichelt ist
              · der Kantensatz nur, wenn die Karte gar keine Kante hat — und dann der RICHTIGE der
                beiden Gruende (JOB 2600 D7): `unterdruecktDurchUbiquitaet` entscheidet, nicht
                `hatUbiquitaere`; gemessen ueber 97.227 kantenlose Zustaende, die Knotenfrage laege
                in 6.984 daneben. */}
        <div
          ref={legendeRef}
          data-testid="netz-legende"
          style={{
            position: "absolute",
            left: 32,
            bottom: 24,
            display: "flex",
            flexWrap: "wrap",
            // Zielbild Z.62: `gap: 16px` in EINER Zeile. In der schmaleren Produktflaeche bricht
            // die Karte um; der Zeilenabstand ist dann 6px, damit sie flach bleibt. Der
            // Spaltenabstand ist der des Zielbilds.
            columnGap: 16,
            rowGap: 6,
            padding: "10px 14px",
            background: SURFACE,
            border: HAARLINIE,
            borderRadius: 10,
            maxWidth: "calc(100% - 64px)",
          }}
        >
          {FARB_REIHENFOLGE.filter((f) => vorhandeneFarben.has(f)).map((f) => (
            <span
              key={f}
              data-testid="netz-legende-eintrag"
              data-farbe={f}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: MUTED,
              }}
            >
              <span
                data-testid="netz-legende-punkt"
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: FARBE[f].fuellung,
                  border: `1.5px solid ${FARBE[f].rand}`,
                  flexShrink: 0,
                }}
              />
              {t(`wissensnetz.farbe.${f}`)}
            </span>
          ))}
          <span
            data-testid="netz-legende-eintrag"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: MUTED }}
          >
            {t("wissensnetz.legende.groesse")}
          </span>
          {hatUbiquitaere ? (
            <span
              data-testid="legende-ubiquitaer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: MUTED,
              }}
            >
              {t("wissensnetz.legende.ubiquitaer")}
            </span>
          ) : null}
          {karte.kanten.length === 0 ? (
            karte.unterdruecktDurchUbiquitaet > 0 ? (
              <span
                data-testid="legende-kanten-unterdrueckt"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  color: MUTED,
                }}
              >
                {t("wissensnetz.legende.kantenUnterdrueckt")}
              </span>
            ) : (
              <span
                data-testid="legende-keine-kanten"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  color: MUTED,
                }}
              >
                {t("wissensnetz.legende.keineKanten")}
              </span>
            )
          ) : null}
        </div>
      </div>
      {gewaehlt !== null ? <Seitenleiste thema={gewaehlt} /> : null}
    </section>
  );
}

function AlleThemen({ karte }: { karte: Themenkarte }): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  if (karte.weitere.length === 0) {
    return null;
  }
  return (
    <Card interactive={false}>
      <button
        type="button"
        className="text-sm font-medium underline"
        onClick={() => setOffen((v) => !v)}
        data-testid="alle-themen-schalter"
      >
        {t("wissensnetz.alle.schalter", { count: karte.weitere.length })}
      </button>
      {offen ? (
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="alle-themen-liste">
          {karte.weitere.map((thema) => (
            <li key={thema}>
              <Link className="rounded-full bg-page px-2 py-0.5 text-micro" to={themenHref(thema)}>
                {thema}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {karte.weitereAbgeschnitten ? (
        <p className="mt-2 text-micro text-muted">{t("wissensnetz.alle.abgeschnitten")}</p>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// JOB 3067 · V4 — DIE ABLESEKARTE: DIE VIER ERHOBENEN FELDER BEKOMMEN EINE FLAECHE.
// ------------------------------------------------------------------------------------------------
// Der Server erhebt fuenf Felder (`services/wissensnetz/src/luecken.ts:47-64`); bis hierher nahm
// diese Datei genau eines (`themenkarte`) und warf `objekteGesamt`, `ohneThema`,
// `sichtbareBeitragendeGesamt` und `themen[]` weg. Sie werden jetzt ABGELESEN.
//
// SIE URTEILT NICHT, und das ist keine Zurueckhaltung, sondern die Bauart des Servers
// (`luecken.ts:13-16`): die Sicht ist VOR der Auswertung getrimmt — „ein Thema, dessen Beitragende
// saemtlich vertraulich sind, sieht danach exakt aus wie ein Thema ohne Beitragende." Deshalb steht
// hier keine „Luecke", kein „fehlt", kein „leer" und keine Rangfolge von Maengeln; jede
// Beitragendenzahl sagt im Wort, dass sie das SICHTBARE zaehlt, und die Bewertung bleibt bei dem
// Menschen, der die Zahlen liest. Gemessen an der gerenderten Flaeche in
// `tests/wissensnetz-sichtmetrik/flaeche.test.tsx`, Fall F4.
//
// KEIN ZWEITER WEG: der Sprung in die Bibliothek ist `themenHref` — derselbe, den die Seitenleiste
// und „Alle Themen" schon gehen. Fuer `ohneThema` gibt es KEINEN Link, weil es keinen
// Bibliotheksfilter gibt, der genau diese Menge trifft; dort steht eine Zahl und ein Satz statt
// eines toten Knopfes.

/** Hoechstens so viele Themenzeilen stehen offen; der Rest liegt hinter dem Aufklapper. */
const ZEILEN_SICHTBAR = 40;

/** Eine abgelesene Zahl mit ihrer Beschriftung — und, wo noetig, dem Satz, warum kein Weg dranhaengt. */
function Zahl({
  anker,
  wert,
  label,
  hinweis,
}: {
  anker: string;
  wert: number;
  label: string;
  hinweis?: string;
}): JSX.Element {
  return (
    <div data-testid={`metrik-${anker}-block`}>
      <div data-testid={`metrik-${anker}`} className="text-2xl font-semibold text-ink">
        {wert}
      </div>
      <div data-testid={`metrik-${anker}-label`} className="mt-0.5 text-sm text-muted">
        {label}
      </div>
      {hinweis !== undefined ? (
        <p data-testid={`metrik-${anker}-hinweis`} className="mt-1 text-micro text-muted-2">
          {hinweis}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Die drei Gesamtzahlen des sichtbaren Bestands. Sie stehen, sobald eine Antwort da ist — auch dann,
 * wenn kein einziges Schlagwort vergeben ist: ein Bestand mit 900 Objekten ohne Schlagwort ist etwas
 * anderes als gar kein Bestand, und bis hierher sah beides gleich aus (F5).
 */
function Sichtzahlen({ metrik }: { metrik: Sichtmetrik }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card interactive={false} data-testid="netz-metrik">
      <SectionLabel>{t("wissensnetz.metrik.titel")}</SectionLabel>
      <div className="flex flex-wrap gap-8">
        <Zahl
          anker="objekte-gesamt"
          wert={metrik.objekteGesamt}
          label={t("wissensnetz.metrik.objekte")}
        />
        <Zahl
          anker="ohne-thema"
          wert={metrik.ohneThema}
          label={t("wissensnetz.metrik.ohneThema")}
          hinweis={t("wissensnetz.metrik.ohneThemaHinweis")}
        />
        <Zahl
          anker="beitragende-gesamt"
          wert={metrik.sichtbareBeitragendeGesamt}
          label={t("wissensnetz.metrik.beitragende")}
        />
      </div>
      <p className="mt-4 text-micro text-muted-2">{t("wissensnetz.metrik.hinweis")}</p>
    </Card>
  );
}

/**
 * Je Thema: sichtbare Objekte, sichtbare Beitragende, der Weg in die Bibliothek.
 *
 * DIE REIHENFOLGE ist eine LESEREIHENFOLGE, keine Rangliste von Maengeln — aufsteigend nach
 * sichtbaren Beitragenden, bei Gleichstand aufsteigend nach Objekten, bei Gleichstand nach Namen
 * (`localeCompare` wie `lesemodell.ts:265`). Die Ueberschrift sagt genau das.
 *
 * `beitragendeAbgeschnitten` macht aus „N" ein „mindestens N": der Server nennt den Wert dann
 * ausdruecklich eine Untergrenze (`luecken.ts:34-38`), und eine glatte Zahl waere dort eine
 * Behauptung.
 */
function Themenzeilen({ themen }: { themen: readonly ThemenMetrik[] }): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  if (themen.length === 0) {
    return null;
  }
  const gelesen = [...themen].sort(
    (a, b) =>
      a.sichtbareBeitragende - b.sichtbareBeitragende ||
      a.objekte - b.objekte ||
      a.thema.localeCompare(b.thema),
  );
  const verborgen = Math.max(0, gelesen.length - ZEILEN_SICHTBAR);
  const gezeigt = offen ? gelesen : gelesen.slice(0, ZEILEN_SICHTBAR);
  return (
    <Card interactive={false} data-testid="netz-metrik-themen">
      <h2 data-testid="metrik-themen-titel" className="text-sm font-semibold text-text">
        {t("wissensnetz.metrik.themenTitel")}
      </h2>
      <ul data-testid="metrik-themen" className="mt-3 flex flex-col">
        {gezeigt.map((m) => (
          <li
            key={m.thema}
            data-testid="metrik-thema"
            data-thema={m.thema}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline py-2 last:border-b-0"
          >
            <Link
              className="text-sm font-medium"
              style={{ color: "rgb(var(--kw-brand-text))" }}
              to={themenHref(m.thema)}
            >
              {m.thema}
            </Link>
            <span className="flex flex-wrap gap-x-4" style={{ fontSize: 12.5, color: MUTED }}>
              <span data-testid="metrik-thema-objekte">
                {t("wissensnetz.metrik.zeile.objekte", { count: m.objekte })}
              </span>
              <span data-testid="metrik-thema-beitragende">
                {t(
                  m.beitragendeAbgeschnitten
                    ? "wissensnetz.metrik.zeile.beitragendeMindestens"
                    : "wissensnetz.metrik.zeile.beitragende",
                  { count: m.sichtbareBeitragende },
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {verborgen > 0 ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium underline"
          onClick={() => setOffen((v) => !v)}
          data-testid="metrik-mehr-schalter"
        >
          {offen
            ? t("wissensnetz.metrik.weniger")
            : t("wissensnetz.metrik.mehr", { count: verborgen })}
        </button>
      ) : null}
    </Card>
  );
}

/** Der gemeinsame Renderer fuer vorhandene Daten — frisch oder aus dem Cache. */
function Inhalt({ metrik, hinweis }: { metrik: Sichtmetrik; hinweis: string | null }): JSX.Element {
  const { t } = useTranslation();
  const karte = metrik.themenkarte;
  // Ehrlich statt leer: eine Karte ohne Knoten ist kein leerer Bestand, sondern ein Bestand ohne
  // Schlagworte. Beides sagt der Text, keines behauptet das andere — und seit JOB 3067 stehen
  // GENAU HIER auch die Zahlen, die das belegen (`objekteGesamt`/`ohneThema`).
  if (!karte || karte.themen.length === 0) {
    return (
      <>
        <Card interactive={false}>
          <p className="text-sm text-muted">{t("wissensnetz.leer")}</p>
          {hinweis !== null ? (
            <p data-testid="netz-auffrischung-hinweis" className="mt-2 text-micro text-muted">
              {hinweis}
            </p>
          ) : null}
        </Card>
        <Sichtzahlen metrik={metrik} />
        <Themenzeilen themen={metrik.themen} />
      </>
    );
  }
  return (
    <>
      <Karte karte={karte} />
      {/* Zustandsmodell (Auftrag §9, Lehre JOB 3037 R2/R3): scheitert eine Auffrischung, bleibt die
          zuletzt geholte Karte SICHTBAR — mit dem Stand und dem Wort, dass die Auffrischung
          fehlschlug. Nie Karte oder Auswahl leeren. Dasselbe gilt fuer die Zahlen darunter: sie
          haengen an derselben Bedingung wie die Karte, nicht an einer eigenen (F6). */}
      {hinweis !== null ? (
        <p
          data-testid="netz-auffrischung-hinweis"
          style={{ fontSize: 12.5, color: MUTED }}
          aria-live="polite"
        >
          {hinweis}
        </p>
      ) : null}
      <Sichtzahlen metrik={metrik} />
      <Themenzeilen themen={metrik.themen} />
      <AlleThemen karte={karte} />
    </>
  );
}

export function Wissensnetz(): JSX.Element {
  const { t, i18n } = useTranslation();
  const netz = useWissensnetz();
  const metrik = netz.data;
  return (
    <div className="space-y-4">
      <PageHeader kicker={t("wissensnetz.kicker")} title={t("wissensnetz.title")} />
      {metrik === undefined ? (
        netz.isLoading || netz.isError ? (
          <QueryState query={netz} />
        ) : (
          // Weder laedt noch Fehler noch Daten (z. B. eine pausierte erste Anfrage): das ist KEIN
          // leerer Bestand — die Seite sagt, dass noch keine Antwort da ist (Lehre JOB 3037 R4/R5:
          // kein „Nichts vorhanden." und kein Offline-Urteil ohne Beleg).
          <Card interactive={false}>
            <p className="text-sm text-muted" data-testid="netz-keine-antwort">
              {t("wissensnetz.keineAntwort")}
            </p>
          </Card>
        )
      ) : (
        <Inhalt
          metrik={metrik}
          hinweis={
            netz.isError
              ? t("wissensnetz.stand.fehlgeschlagen", {
                  stand: uhrzeitVon(netz.dataUpdatedAt, i18n.language),
                })
              : null
          }
        />
      )}
    </div>
  );
}
