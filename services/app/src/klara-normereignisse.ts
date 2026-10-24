import { createHash } from "node:crypto";
import type { KlaraDNormAuftragsEingabe } from "./klara-d-normauftrag-eingabe";
import { istDatum } from "./klara-erinnerung-zeit";
import type { FristenQuelle } from "./klara-fristen-erkennung";

/** Ein enger Ereignisvertrag an den bestehenden ausgewählten Fristenquellen, kein Normenkatalog. */
export const NORM_EREIGNISARTEN = [
  "angekuendigt",
  "veroeffentlicht",
  "inkrafttreten",
  "uebergangsfrist",
] as const;
export type NormEreignisArt = (typeof NORM_EREIGNISARTEN)[number];
export interface NormFundstelle {
  von: number;
  bis: number;
  wortlaut: string;
}
export interface NormBeleg {
  id: string;
  umfang: "begrenzte_bekanntmachung";
  quelle: { art: FristenQuelle["art"]; id: string; fassung: string; belegId: string };
  norm: NormFundstelle;
  ereignis: NormFundstelle;
  geltung: NormFundstelle | null;
  datum: string | null;
  klaerung: readonly string[];
  aktuell: boolean;
  widerspruch: boolean;
}
export interface NormEreignis {
  id: string;
  art: NormEreignisArt;
  datum: string | null;
  geltung: string | null;
  belege: readonly NormBeleg[];
  zuerstGelesenAm: string;
  /** Stabil je tatsächlichem Sachereignis, unabhängig von Kopie, Polling und Zustellversuch. */
  pruefVorgang: string;
  /** Nur der Verweis auf das vorhandene Auftragsjournal, kein zweiter Ausführungsstand. */
  pruefauftrag?: NormPruefauftragRef;
  /** Unveränderlicher eigener G-Eingang vor jeder Anlage; kein zweites Ausführungsjournal. */
  pruefeingang?: {
    eingabe: KlaraDNormAuftragsEingabe;
    abdruck: string;
    abhaengigkeiten: readonly { koId: string; fassung: number }[];
  };
}
export interface NormPruefauftragRef {
  gespraechId: string;
  auftragId: string;
  nr: 1;
  schluessel: string;
}
export interface NormAbloesung {
  id: string;
  geltung: string;
  begruendung: string;
  entschiedenVon: string;
  entschiedenName: string | null;
  entschiedenAm: string;
  /** Die ausdrücklich bestätigte Konfliktklärung, falls diese Annahme darauf beruht. */
  klaerungId?: string;
  bisher: { koId: string; fassung: number };
  nachfolger: { koId: string; fassung: number };
  fachfreigabe: {
    bisher: { auditSeq: number; auditHash: string; koVersion: number };
    nachfolger: { auditSeq: number; auditHash: string; koVersion: number };
  };
}
export interface NormKonfliktauswahl {
  art: NormEreignisArt;
  ereignisId: string;
}
export interface NormKonfliktklaerung {
  id: string;
  grundlage: string;
  auswahl: readonly NormKonfliktauswahl[];
  /** Damals aktuelle Originalbelege; ihre Fassungen und Wortlaute bleiben in der Geschichte. */
  belegstand: readonly { ereignisId: string; aktuell: readonly string[] }[];
  begruendung: string;
  entschiedenVon: string;
  entschiedenName: string | null;
  entschiedenAm: string;
}
export interface Normgeschichte {
  id: string;
  kennung: string;
  ausgabe: string;
  ereignisse: readonly NormEreignis[];
  annahmen: readonly NormAbloesung[];
  klaerungen?: readonly NormKonfliktklaerung[];
}
export interface NormErkennung {
  geschichten: readonly Normgeschichte[];
  ungeprueft: readonly string[];
}

const hash = (...x: unknown[]) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const normal = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
const normId = (kennung: string, ausgabe: string) =>
  `norm-${hash(normal(kennung), normal(ausgabe))}`;
/** Nur der gesonderte berechtigte Fachweg erzeugt diese Aufzeichnung, niemals die Erkennung. */
export function normAbloesungsbeleg(
  norm: string,
  entscheidung: Omit<NormAbloesung, "id">,
): NormAbloesung {
  return {
    ...entscheidung,
    id: `na-${
      entscheidung.klaerungId
        ? hash(
            norm,
            entscheidung.bisher,
            entscheidung.nachfolger,
            normal(entscheidung.geltung),
            entscheidung.klaerungId,
          )
        : hash(norm, entscheidung.bisher, entscheidung.nachfolger, normal(entscheidung.geltung))
    }`,
  };
}
const ART: Record<string, NormEreignisArt> = {
  angekündigt: "angekuendigt",
  ankündigung: "angekuendigt",
  veröffentlicht: "veroeffentlicht",
  veröffentlichung: "veroeffentlicht",
  inkrafttreten: "inkrafttreten",
  übergangsfrist: "uebergangsfrist",
};
function datum(s: string): string | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s
    : s.replace(
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
        (_m, tag: string, monat: string, jahr: string) =>
          `${jahr}-${monat.padStart(2, "0")}-${tag.padStart(2, "0")}`,
      );
  return istDatum(d) ? d : null;
}
function fundstelle(text: string, von: number, bis: number): NormFundstelle {
  return { von, bis, wortlaut: text.slice(von, bis) };
}

/**
 * Liest nur die ausdrücklich erlaubte kurze Bekanntmachung, nie einen Normvolltext/Anhang/URL.
 * Unterstützt explizite „Norm N-17 v2“-Zeilen mit getrennten Ereignis- und Geltungsangaben.
 * Geplantes, negiertes, widersprüchliches und Fehlendes bleibt offen; kein Sprachmodell rät Daten.
 */
export function erkenneNormBekanntmachung(
  quelle: FristenQuelle,
  bekanntmachungErlaubt: boolean,
  am: string,
): NormErkennung {
  if (!bekanntmachungErlaubt)
    return { geschichten: [], ungeprueft: ["Bekanntmachung nicht zur Verarbeitung beauftragt."] };
  if (quelle.text.length > 4000)
    return {
      geschichten: [],
      ungeprueft: ["Quelle ist keine begrenzte Bekanntmachung; kein Volltext verarbeitet."],
    };
  const geschichten: Normgeschichte[] = [];
  const ungeprueft: string[] = [];
  for (const zeile of quelle.text.matchAll(/[^\r\n]+/g)) {
    const text = zeile[0];
    const start = zeile.index;
    const normen = [
      ...text.matchAll(
        /\bNorm\s+([\p{L}\p{N}][\p{L}\p{N}_.\/-]{0,79})\s+(?:v|Ausgabe\s+)([\p{L}\p{N}_.\/-]{1,40})\b/giu,
      ),
    ];
    if (normen.length === 0) continue;
    if (normen.length !== 1 || text.length > 1000) {
      ungeprueft.push(
        "Norm und Ausgabe sind in dieser Bekanntmachungszeile nicht eindeutig begrenzt.",
      );
      continue;
    }
    const n = normen[0];
    if (!n?.[1] || !n[2]) continue;
    const id = normId(n[1], n[2]);
    const geltungen = [...text.matchAll(/\bGeltung(?:sbereich)?\s*:\s*([^;\r\n.]{1,200})/giu)];
    const g = geltungen.length === 1 ? geltungen[0] : undefined;
    const geltung = g?.[1]?.trim() || null;
    const marker = [
      ...text.matchAll(
        /(?<![\p{L}\p{N}_])(angekündigt|Ankündigung|veröffentlicht|Veröffentlichung|Inkrafttreten|Übergangsfrist)(?![\p{L}\p{N}_])/giu,
      ),
    ];
    const ereignisse: NormEreignis[] = [];
    for (let i = 0; i < marker.length; i++) {
      const m = marker[i];
      if (!m?.[1]) continue;
      const art = ART[normal(m[1])];
      if (!art) continue;
      const geltungDanach = geltungen.find((x) => x.index > m.index)?.index ?? text.length;
      const ende = Math.min(marker[i + 1]?.index ?? text.length, geltungDanach);
      if (ende <= m.index) continue;
      const ausschnitt = text.slice(m.index, ende);
      const vorlauf = text.slice(Math.max(0, m.index - 20), m.index);
      const fragen: string[] = [];
      const termine = [
        ...new Set(
          [...ausschnitt.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b/g)].map((d) =>
            datum(d[0]),
          ),
        ),
      ];
      const unsicher =
        /\b(?:nicht|kein|keine|geplant|voraussichtlich|vermutlich|unbekannt|offen|soll|könnte|zurückgezogen|widerrufen|aufgehoben|abgesagt)\b/iu.test(
          ausschnitt,
        ) || /\b(?:nicht|nie)\s*$/iu.test(vorlauf);
      const d = !unsicher && termine.length === 1 && termine[0] ? termine[0] : null;
      if (!d)
        fragen.push(
          termine.length > 1
            ? "Mehrere oder widersprüchliche Termine im Ereignisbeleg."
            : "Eindeutiges belegtes Ereignisdatum fehlt.",
        );
      if (unsicher)
        fragen.push(
          "Ereignis ist negiert, geplant oder unbestätigt; keine Geltung daraus abgeleitet.",
        );
      if (!geltung) fragen.push("Belegter Geltungsbereich fehlt.");
      if (geltungen.length > 1)
        fragen.push("Mehrere Geltungsangaben in derselben Bekanntmachungszeile; Zuordnung klären.");
      const ereignisId = `ne-${hash(id, art, d, geltung ? normal(geltung) : null)}`;
      const beleg: NormBeleg = {
        id: `nb-${hash(quelle.art, quelle.id, quelle.fassung, start + m.index, ausschnitt)}`,
        umfang: "begrenzte_bekanntmachung",
        quelle: {
          art: quelle.art,
          id: quelle.id,
          fassung: quelle.fassung,
          belegId: quelle.belegId,
        },
        norm: fundstelle(quelle.text, start + n.index, start + n.index + n[0].length),
        ereignis: fundstelle(quelle.text, start + m.index, start + ende),
        geltung: g ? fundstelle(quelle.text, start + g.index, start + g.index + g[0].length) : null,
        datum: d,
        klaerung: fragen,
        aktuell: true,
        widerspruch: termine.length > 1 || geltungen.length > 1,
      };
      ereignisse.push({
        id: ereignisId,
        art,
        datum: d,
        geltung,
        belege: [beleg],
        zuerstGelesenAm: am,
        pruefVorgang: `normp-${hash(ereignisId)}`,
      });
    }
    if (marker.length === 0)
      ungeprueft.push("Norm erkannt, aber kein unterstützter gesonderter Ereignisbeleg.");
    geschichten.push({ id, kennung: n[1], ausgabe: n[2], ereignisse, annahmen: [] });
  }
  return { geschichten: vereinigeNormgeschichten([], geschichten), ungeprueft };
}

/** Dieselbe Sachmeldung ergänzt Belege, niemals eine zweite Normgeschichte oder Prüfkennung. */
export function vereinigeNormgeschichten(
  bestand: readonly Normgeschichte[],
  neu: readonly Normgeschichte[],
): readonly Normgeschichte[] {
  const result = new Map(bestand.map((n) => [n.id, n]));
  for (const n of neu) {
    const alt = result.get(n.id);
    if (!alt) {
      result.set(n.id, n);
      continue;
    }
    const ereignisse = new Map(alt.ereignisse.map((e) => [e.id, e]));
    for (const e of n.ereignisse) {
      const vorher = ereignisse.get(e.id);
      if (!vorher) {
        ereignisse.set(e.id, e);
        continue;
      }
      const belege = new Map(vorher.belege.map((b) => [b.id, b]));
      for (const b of e.belege) belege.set(b.id, b);
      ereignisse.set(e.id, { ...vorher, belege: [...belege.values()] });
    }
    result.set(n.id, { ...alt, ereignisse: [...ereignisse.values()] });
  }
  return [...result.values()];
}

/** Keine Datumspriorität und keine bloß aus dem Kalender abgeleitete fachliche Annahme. */
export function normKlaerung(n: Normgeschichte): readonly string[] {
  const fragen: string[] = [];
  const klaerung = normAktuelleKonfliktklaerung(n);
  for (const art of NORM_EREIGNISARTEN) {
    const auswahl = klaerung?.auswahl.find((x) => x.art === art);
    const e = normFachereignisse(n).filter((e) => e.art === art);
    const alle = n.ereignisse.filter((e) => e.art === art);
    if (e.length === 0) fragen.push(`${art}: eigener Beleg fehlt.`);
    for (const x of e)
      for (const b of x.belege.filter((b) => b.aktuell))
        fragen.push(...b.klaerung.map((f) => `${art}: ${f}`));
    if (!auswahl && new Set(alle.map((x) => x.datum).filter(Boolean)).size > 1)
      fragen.push(`${art}: Termine widersprechen sich; fachlich klären.`);
    if (
      !auswahl &&
      new Set(alle.map((x) => (x.geltung ? normal(x.geltung) : null)).filter(Boolean)).size > 1
    )
      fragen.push(`${art}: unterschiedliche Geltungsbereiche; Zuordnung klären.`);
  }
  return [...new Set(fragen)];
}

/** Die Fachgrenze folgt den strukturierten Belegen, nicht übersetzten Hinweissätzen. */
export function normHatWiderspruch(n: Normgeschichte): boolean {
  return normKonfliktarten(n).length > 0 && !normAktuelleKonfliktklaerung(n);
}

/** Widersprechende Originale bleiben auch nach einer menschlichen Auswahl unverändert erhalten. */
export function normKonfliktarten(n: Normgeschichte): readonly NormEreignisArt[] {
  return NORM_EREIGNISARTEN.filter((art) => {
    const e = n.ereignisse.filter((e) => e.art === art);
    if (e.some((x) => x.belege.some((b) => b.widerspruch))) return true;
    if (new Set(e.map((x) => x.datum).filter(Boolean)).size > 1) return true;
    if (new Set(e.map((x) => (x.geltung ? normal(x.geltung) : null)).filter(Boolean)).size > 1)
      return true;
    return false;
  });
}

export function normEreignisKlaerbar(e: NormEreignis): boolean {
  return Boolean(
    e.datum &&
      e.geltung &&
      e.belege.some((b) => b.aktuell && !b.widerspruch && b.klaerung.length === 0),
  );
}

/** Sachstand statt Kopienzahl: neue Fakten oder zurückgezogene Auswahl öffnen die Klärung erneut. */
export function normKonfliktgrundlage(n: Normgeschichte): string {
  const arten = normKonfliktarten(n);
  return hash(
    n.id,
    arten,
    n.ereignisse
      .filter((e) => arten.includes(e.art))
      .map((e) => [
        e.id,
        e.belege.some((b) => b.aktuell),
        normEreignisKlaerbar(e),
        e.belege.some((b) => b.widerspruch),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

export function normKonfliktauswahlGueltig(
  n: Normgeschichte,
  auswahl: readonly NormKonfliktauswahl[],
): boolean {
  const arten = normKonfliktarten(n);
  return (
    arten.length > 0 &&
    auswahl.length === arten.length &&
    arten.every((art) => {
      const w = auswahl.filter((x) => x.art === art);
      return (
        w.length === 1 &&
        n.ereignisse.some(
          (e) => e.id === w[0]?.ereignisId && e.art === art && normEreignisKlaerbar(e),
        )
      );
    })
  );
}

export function normAktuelleKonfliktklaerung(n: Normgeschichte): NormKonfliktklaerung | null {
  const k = n.klaerungen?.at(-1);
  return k && k.grundlage === normKonfliktgrundlage(n) && normKonfliktauswahlGueltig(n, k.auswahl)
    ? k
    : null;
}

export function normFachereignisse(n: Normgeschichte): readonly NormEreignis[] {
  const k = normAktuelleKonfliktklaerung(n);
  return n.ereignisse.filter((e) => {
    const w = k?.auswahl.find((x) => x.art === e.art);
    return e.belege.some((b) => b.aktuell) && (!w || w.ereignisId === e.id);
  });
}

/** Nur der befugte Fachweg erstellt diese nachprüfbare Entscheidung; keine Datumskorrektur. */
export function normKonfliktbeleg(
  n: Normgeschichte,
  entscheidung: Omit<NormKonfliktklaerung, "id" | "grundlage" | "belegstand">,
): NormKonfliktklaerung {
  const grundlage = normKonfliktgrundlage(n);
  return {
    ...entscheidung,
    grundlage,
    belegstand: n.ereignisse
      .filter((e) => normKonfliktarten(n).includes(e.art))
      .map((e) => ({
        ereignisId: e.id,
        aktuell: e.belege.filter((b) => b.aktuell).map((b) => b.id),
      })),
    id: `nk-${hash(n.id, grundlage, entscheidung.auswahl, n.klaerungen?.at(-1)?.id ?? null)}`,
  };
}

/** Eine tatsächliche neue Quelle zieht alte Belege zurück, ohne ihre Geschichte zu löschen. */
export function normQuellstand(
  bestand: readonly Normgeschichte[],
  quelle: Pick<FristenQuelle, "art" | "id" | "fassung">,
): readonly Normgeschichte[] {
  return bestand.map((n) => ({
    ...n,
    ereignisse: n.ereignisse.map((e) => ({
      ...e,
      belege: e.belege.map((b) =>
        b.quelle.art === quelle.art &&
        b.quelle.id === quelle.id &&
        b.quelle.fassung !== quelle.fassung
          ? { ...b, aktuell: false }
          : b,
      ),
    })),
  }));
}
