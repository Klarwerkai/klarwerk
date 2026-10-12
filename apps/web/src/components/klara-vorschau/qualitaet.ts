// ================================================================================================
// KLARA 14 (produkt:20261008:klara-qualitaet) — WIDERSPRÜCHE, LÜCKEN UND VERBESSERUNGEN ERKLÄREN.
// ================================================================================================
//
// WAS HIER GESCHIEHT, in dieser Reihenfolge:
//   1. LESEN — nur lesend, unter den Rechten der Person: das geöffnete Wissensobjekt
//      (`GET /api/kos/:id`, mit Frische und Quellen), die offenen Konflikte (`/api/conflicts`), die
//      offenen Überschneidungen (`/api/duplicates`) und das Signal am eigenen Objekt
//      (`/api/duplicate-signal`). Die Paarlisten filtert der Server über `paarSichtbar`; was die
//      Person nicht sehen darf, erreicht diese Datei gar nicht.
//   2. ERKLÄREN — aus den VORHANDENEN Fachregeln, ohne Modell und ohne neue Regel:
//      `conflictNextStep`, `conflictEvidenceBalance`, `klaraVorschlag` (lib/conflictView.ts), die
//      Empfehlung der Duplikatprüfung (`recommendation`), die Frische des Servers (`frische`) und
//      die Quellen am Objekt. Jeder Befund nennt Quelle, Erklärung, Grundlage und Unsicherheit.
//   3. VORSCHLAGEN — ein konkreter Verbesserungsschritt. Er ändert NICHTS: entweder ein Satz für
//      den vorhandenen Ausführungsweg (Klara 05, `auftrag.ts`), der erst mit „Senden“ ausgeführt
//      wird, oder der vorhandene Arbeitsweg, in dem eine Person entscheidet.
//
// WAS HIER NICHT GESCHIEHT: Klara sperrt kein Objekt, stellt keine Pflicht auf und entscheidet
// keinen Konflikt. Persönliche Vorlieben (Profil, Arbeitsweise, Sprache der Oberfläche) gehen nicht ein —
// `befundeAus` bekommt nur die gelesenen Befunde; die Sprache ändert den Wortlaut, nie das Urteil.
//
// DOM-FREI, wie `auftrag.ts`: geprüft von einem `.ts`-Test ohne Browser.
import type { TFunction } from "i18next";
import { endpoints } from "../../api/endpoints";
import type { Conflict, EigenerBefund, KnowledgeObject, OverlapEntry } from "../../api/types";
import {
  conflictEvidenceBalance,
  conflictKoPair,
  conflictNextStep,
  klaraVorschlag,
  naechsterSchrittSchluessel,
} from "../../lib/conflictView";
import { fallHref } from "../../lib/fallAbsprung";
import { erkenneAuftrag } from "../../lib/klaraAuftragErkennung";
import { leserHref } from "../../lib/objektbezug";
import { isUnresolvedConflict } from "../../lib/taskFilters";

/** So viele Gegenseiten liest Klara höchstens nach — mehr Befunde an einem Objekt sind selten. */
const MAX_GEGENSEITEN = 8;
const MAX_QUELLEN_ZEILEN = 5;

/** `ungelesen`: ein offener Befund ist gemeldet, seine Paarliste antwortete aber nicht. */
export type BefundArt =
  | "konflikt"
  | "duplikat"
  | "quellenalter"
  | "fehlende_angabe"
  | "verdeckt"
  | "ungelesen";

/**
 * Worauf sich der Befund stützt:
 *   `belegt`           — die Daten des Befunds liegen vor (Zitate, Frische des Servers).
 *   `widerspruechlich` — beide Seiten tragen Quellen, und ihre Aussagen widersprechen sich.
 *   `einseitig`        — nur eine Seite trägt eine Quelle.
 *   `keine`            — keine Quelle und kein belegtes Zitat.
 *   `unbekannt`        — die Gegenseite ist nicht lesbar; darüber sagt Klara nichts.
 *   `zurueckgehalten`  — der Inhalt ist für diese Person zurückgehalten (Rechte).
 *   `nicht_verfuegbar` — der Prüfweg antwortete nicht; Ursache unbekannt, kein Rechteurteil.
 */
export type Grundlage =
  | "belegt"
  | "widerspruechlich"
  | "einseitig"
  | "keine"
  | "unbekannt"
  | "zurueckgehalten"
  | "nicht_verfuegbar";

export interface BefundQuelle {
  koId: string;
  /** `null`: nicht lesbar — Klara nennt dann keinen Titel. */
  titel: string | null;
  pfad: string | null;
  eigenes: boolean;
  /** Trägt das Objekt eine Quelle? `null`: unbekannt. */
  belegt: boolean | null;
  zitat: string | null;
}

/**
 * Ein konkreter Verbesserungsschritt. Keiner davon ändert etwas, solange die Person nicht selbst
 * handelt:
 *   `auftrag`    — ein Satz für den vorhandenen Ausführungsweg; er steht danach im Eingabefeld und
 *                  wird erst mit „Senden“ ausgeführt (Grenze, Rechte und Nachlesen am Server).
 *   `arbeitsweg` — der vorhandene Arbeitsort, an dem eine Person entscheidet.
 *   `hinweis`    — was nur ein Mensch tun kann; ohne Knopf.
 */
export type Verbesserung =
  | { art: "auftrag"; text: string; satz: string }
  | { art: "arbeitsweg"; text: string; pfad: string }
  | { art: "hinweis"; text: string };

export interface Befund {
  schluessel: string;
  art: BefundArt;
  titel: string;
  erklaerung: string[];
  quellen: BefundQuelle[];
  grundlage: Grundlage;
  /** Fachliche Unsicherheit in Worten — `null`, wenn nichts dazu bekannt ist. */
  unsicherheit: string | null;
  vorschlaege: Verbesserung[];
}

export type Pruefweg = "konflikte" | "duplikate" | "signale";

/** Was Klara gelesen hat — `null`: dieser Weg antwortete nicht, Klara sagt darüber nichts. */
export interface QualitaetsDaten {
  ko: KnowledgeObject;
  konflikte: readonly Conflict[] | null;
  ueberschneidungen: readonly OverlapEntry[] | null;
  signale: readonly EigenerBefund[] | null;
  /** Die Gegenseiten der Paare, unter den Rechten der Person gelesen; `null` = nicht lesbar. */
  gegenseiten: Readonly<Record<string, KnowledgeObject | null>>;
  /** Darf die Person das Objekt bearbeiten? (Anzeige des passenden Arbeitswegs.) */
  darfBearbeiten: boolean;
}

export interface Qualitaetslage {
  befunde: Befund[];
  nichtGelesen: Pruefweg[];
}

// ------------------------------------------------------------------------------------------------
// 1. Lesen.
// ------------------------------------------------------------------------------------------------

function offeneKonflikte(liste: readonly Conflict[], koId: string): Conflict[] {
  return liste.filter((c) => (c.koA === koId || c.koB === koId) && isUnresolvedConflict(c));
}

function offeneUeberschneidungen(liste: readonly OverlapEntry[], koId: string): OverlapEntry[] {
  return liste.filter((o) => (o.koA === koId || o.koB === koId) && o.status !== "geschlossen");
}

function gegenseite(paar: { koA: string; koB: string }, koId: string): string {
  return paar.koA === koId ? paar.koB : paar.koA;
}

/**
 * Liest alles, was Klara für die Erklärung braucht — AUSSCHLIESSLICH über lesende Wege. Scheitert
 * das Objekt selbst, wirft die Funktion (die Fläche zeigt den tatsächlichen Grund).
 */
export async function ladeQualitaet(
  koId: string,
  darfBearbeiten: boolean,
): Promise<QualitaetsDaten> {
  const [ko, konflikte, ueberschneidungen, signale] = await Promise.all([
    endpoints.ko.get(encodeURIComponent(koId)),
    endpoints.conflicts.list().catch(() => null),
    endpoints.duplicates.list().catch(() => null),
    endpoints.duplicateSignal.list().catch(() => null),
  ]);
  const ids = [
    ...offeneKonflikte(konflikte ?? [], ko.id).map((c) => gegenseite(c, ko.id)),
    ...offeneUeberschneidungen(ueberschneidungen ?? [], ko.id).map((o) => gegenseite(o, ko.id)),
  ];
  const eindeutig = [...new Set(ids)].filter((id) => id !== ko.id).slice(0, MAX_GEGENSEITEN);
  const gelesen = await Promise.all(
    eindeutig.map((id) =>
      endpoints.ko.get(encodeURIComponent(id)).then(
        (x) => [id, x] as const,
        () => [id, null] as const,
      ),
    ),
  );
  return {
    ko,
    konflikte,
    ueberschneidungen,
    signale,
    gegenseiten: Object.fromEntries(gelesen),
    darfBearbeiten,
  };
}

// ------------------------------------------------------------------------------------------------
// 2. Erklären.
// ------------------------------------------------------------------------------------------------

function datum(iso: string | null | undefined, sprache: string): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(sprache);
}

function hatQuelle(ko: KnowledgeObject | null): boolean | null {
  if (!ko || !Array.isArray(ko.sources)) {
    return null;
  }
  return ko.sources.length > 0;
}

function quelleAus(
  ko: KnowledgeObject | null,
  koId: string,
  eigenes: boolean,
  zitat: string | null,
): BefundQuelle {
  return {
    koId,
    titel: ko?.title ?? null,
    pfad: ko ? leserHref({ koId, fassung: null }) : null,
    eigenes,
    belegt: hatQuelle(ko),
    zitat: zitat && zitat.trim().length > 0 ? zitat.trim() : null,
  };
}

/**
 * Der Satz für den vorhandenen Ausführungsweg — nur, wenn die Erkennung von Klara 05 ihn genau so
 * versteht (Eskalation an genau dieser Aufgabe). Sonst gibt es keinen Auftragssatz, nur den
 * Arbeitsweg: Klara erfindet keine Aktion, die der Ausführungsweg nicht kennt.
 */
export function eskalationsSatz(titel: string, t: TFunction): string | null {
  const satz = t("klaraqualitaet.satz.eskalieren", { titel });
  const s = erkenneAuftrag(satz)?.schritte;
  const schritt = s?.length === 1 ? s[0] : undefined;
  return schritt?.aktion === "aufgabe_bearbeiten" &&
    schritt.aufgabenaktion?.art === "eskalieren" &&
    schritt.name === titel
    ? satz
    : null;
}

function unsicherheitDerErkennung(
  origin: "manual" | "auto" | undefined,
  methode: "model" | "deterministic" | undefined,
  sicherheit: number | undefined,
  t: TFunction,
): string {
  if (origin !== "auto") {
    return t("klaraqualitaet.unsicher.gemeldet");
  }
  if (methode === "model") {
    return typeof sicherheit === "number"
      ? t("klaraqualitaet.unsicher.modell", { prozent: Math.round(sicherheit * 100) })
      : t("klaraqualitaet.unsicher.modellOhneWert");
  }
  return t("klaraqualitaet.unsicher.regel");
}

function konfliktBefund(c: Conflict, d: QualitaetsDaten, t: TFunction): Befund {
  const { ko } = d;
  const andereId = gegenseite(c, ko.id);
  const andere = d.gegenseiten[andereId] ?? null;
  const fallPfad = fallHref("/konflikte", c.id);
  const titel = t("klaraqualitaet.konflikt.titel", {
    gegen: andere?.title ?? t("klaraqualitaet.unbekannteSeite"),
  });
  // Rechte: der Server hielt den Inhalt zurück — Klara nennt weder Beschreibung noch Zitate.
  if (c.redacted) {
    return {
      schluessel: `konflikt:${c.id}`,
      art: "konflikt",
      titel,
      erklaerung: [t("klaraqualitaet.konflikt.zurueckgehalten")],
      quellen: [quelleAus(ko, ko.id, true, null)],
      grundlage: "zurueckgehalten",
      unsicherheit: null,
      vorschlaege: [
        { art: "arbeitsweg", text: t("klaraqualitaet.vorschlag.konfliktOeffnen"), pfad: fallPfad },
      ],
    };
  }
  const eigenA = c.koA === ko.id;
  const zitate = c.detector?.quotes;
  const erklaerung: string[] = [
    t("klaraqualitaet.konflikt.beschreibung", {
      art: t(`con.type.${c.type}`),
      text: c.description,
    }),
  ];
  const streit = c.detector?.kollision?.streitpunkt?.trim();
  if (streit) {
    erklaerung.push(t("klaraqualitaet.konflikt.streitpunkt", { punkt: streit }));
  }
  const begruendung = c.detector?.rationale?.trim();
  if (begruendung) {
    erklaerung.push(t("klaraqualitaet.begruendung", { text: begruendung }));
  }
  const vorschlag = klaraVorschlag(c);
  if (vorschlag) {
    const eigeneSeite = eigenA ? "a" : "b";
    const spezTitel = vorschlag.seite === eigeneSeite ? ko.title : (andere?.title ?? "");
    erklaerung.push(
      t(vorschlag.schluessel, { title: spezTitel, bereich: vorschlag.geltungsbereich }),
    );
  }
  // Die Beweislage (`conflictEvidenceBalance`) — eine Aussage über Belege, nie über „wer recht hat“.
  const paar = conflictKoPair(c, andere ? [ko, andere] : [ko]);
  const lage = conflictEvidenceBalance(paar);
  let grundlage: Grundlage;
  if (!andere) {
    grundlage = "unbekannt";
  } else if (lage?.kind === "neither") {
    grundlage = "keine";
    erklaerung.push(t("con.evidenceBalance.neither"));
  } else if (lage?.kind === "oneSided") {
    grundlage = "einseitig";
    const belegt = lage.side === "a" ? paar.a : paar.b;
    erklaerung.push(t("con.evidenceBalance.oneSided", { title: belegt?.title ?? "" }));
  } else {
    // Beide Seiten tragen Quellen — die Quellen selbst widersprechen sich.
    grundlage = hatQuelle(ko) && hatQuelle(andere) ? "widerspruechlich" : "unbekannt";
  }
  const schritt = conflictNextStep(c);
  const vorschlaege: Verbesserung[] = [];
  if (schritt === "escalate") {
    const satz = eskalationsSatz(c.description, t);
    if (satz) {
      vorschlaege.push({ art: "auftrag", text: t("klaraqualitaet.vorschlag.eskalieren"), satz });
    }
  }
  vorschlaege.push({
    art: "arbeitsweg",
    text: t(naechsterSchrittSchluessel(schritt)),
    pfad: fallPfad,
  });
  const erkennung = c.detector;
  return {
    schluessel: `konflikt:${c.id}`,
    art: "konflikt",
    titel,
    erklaerung,
    quellen: [
      quelleAus(ko, ko.id, true, (eigenA ? zitate?.a : zitate?.b) ?? null),
      quelleAus(andere, andereId, false, (eigenA ? zitate?.b : zitate?.a) ?? null),
    ],
    grundlage,
    unsicherheit: unsicherheitDerErkennung(c.origin, erkennung?.method, erkennung?.confidence, t),
    vorschlaege,
  };
}

function duplikatBefund(o: OverlapEntry, d: QualitaetsDaten, t: TFunction): Befund {
  const { ko } = d;
  const andereId = gegenseite(o, ko.id);
  const andere = d.gegenseiten[andereId] ?? null;
  const eigenA = o.koA === ko.id;
  const erklaerung: string[] = [
    t("klaraqualitaet.duplikat.beziehung", { beziehung: t(`dup.relation.${o.relation}`) }),
  ];
  for (const a of o.aspects.slice(0, 3)) {
    if (a.beschreibung.trim()) {
      erklaerung.push(t("klaraqualitaet.duplikat.gemeinsam", { text: a.beschreibung.trim() }));
    }
  }
  const nurHier = (eigenA ? o.eigenanteilA : o.eigenanteilB).trim();
  const nurDort = (eigenA ? o.eigenanteilB : o.eigenanteilA).trim();
  if (nurHier) {
    erklaerung.push(t("klaraqualitaet.duplikat.nurHier", { text: nurHier }));
  }
  if (nurDort) {
    erklaerung.push(t("klaraqualitaet.duplikat.nurDort", { text: nurDort }));
  }
  const begruendung = o.detector?.rationale?.trim();
  if (begruendung) {
    erklaerung.push(t("klaraqualitaet.begruendung", { text: begruendung }));
  }
  const erstes = o.aspects[0];
  // Die ehrliche Rahmung des Duplikat-Boards: Ähnlichkeit ist kein Beweis (SCRUM-486 B).
  const erkennung = o.detector;
  let unsicherheit = unsicherheitDerErkennung(o.origin, erkennung?.method, undefined, t);
  if (erkennung?.method === "model" && typeof erkennung.confidence === "number") {
    const percent = Math.round(erkennung.confidence * 100);
    unsicherheit = `${t("dup.lead.modelConfidence", { percent })} — ${t("dup.leadCaptionModel")}`;
  } else if (erkennung) {
    const percent = Math.round(erkennung.lexicalScore * 100);
    unsicherheit = `${t("dup.lead.textOverlap", { percent })} — ${t("dup.leadCaptionText")}`;
  }
  let grundlage: Grundlage = "keine";
  if (!andere) {
    grundlage = "unbekannt";
  } else if (o.aspects.length > 0) {
    grundlage = "belegt";
  }
  return {
    schluessel: `duplikat:${o.id}`,
    art: "duplikat",
    titel: t("klaraqualitaet.duplikat.titel", {
      gegen: andere?.title ?? t("klaraqualitaet.unbekannteSeite"),
    }),
    erklaerung,
    quellen: [
      quelleAus(ko, ko.id, true, (eigenA ? erstes?.zitatA : erstes?.zitatB) ?? null),
      quelleAus(andere, andereId, false, (eigenA ? erstes?.zitatB : erstes?.zitatA) ?? null),
    ],
    grundlage,
    unsicherheit,
    vorschlaege: [
      {
        art: "arbeitsweg",
        text: `${t("dup.recommendation")}: ${t(`dup.rec.${o.recommendation}`)}`,
        pfad: `/duplikate/${encodeURIComponent(o.id)}/vergleich`,
      },
      { art: "hinweis", text: t("klaraqualitaet.vorschlag.duplikatEntscheidung") },
    ],
  };
}

function quellenalterBefund(d: QualitaetsDaten, t: TFunction, sprache: string): Befund | null {
  const { ko } = d;
  const f = ko.frische;
  const quellen = Array.isArray(ko.sources) ? ko.sources : [];
  const entfernt = quellen.filter((s) => Boolean(s.sourceRemovedAt));
  const stufe = f && f.stufe !== "frisch" ? f.stufe : null;
  if (stufe === null && entfernt.length === 0) {
    return null;
  }
  const erklaerung: string[] = [];
  if (f) {
    const bezug = datum(f.bezugAm, sprache);
    if (bezug) {
      erklaerung.push(t("klaraqualitaet.alter.bezug", { datum: bezug }));
    }
    const haltbar = datum(f.haltbarBis, sprache);
    erklaerung.push(
      haltbar
        ? t("klaraqualitaet.alter.haltbarBis", { datum: haltbar })
        : t("klaraqualitaet.alter.haltbarUnbekannt"),
    );
    erklaerung.push(
      t(
        f.halbwertszeitHerkunft === "gelernt"
          ? "frische.halbwertszeitGelernt"
          : "frische.halbwertszeitVorgabe",
        { tage: f.halbwertszeitTage, anzahl: f.halbwertszeitBeobachtungen },
      ),
    );
  }
  for (const s of quellen.slice(0, MAX_QUELLEN_ZEILEN)) {
    const weg = datum(s.sourceRemovedAt, sprache);
    if (weg) {
      erklaerung.push(t("klaraqualitaet.alter.quelleEntfernt", { label: s.label, datum: weg }));
    } else {
      const vom = datum(s.at, sprache);
      erklaerung.push(
        vom
          ? t("klaraqualitaet.alter.quelleVom", { label: s.label, datum: vom })
          : t("klaraqualitaet.alter.quelleOhneDatum", { label: s.label }),
      );
    }
  }
  const vorschlaege: Verbesserung[] = [];
  if (f && f.naechsterSchritt !== "keiner") {
    vorschlaege.push({
      art: "arbeitsweg",
      text: t(`frische.naechster.${f.naechsterSchritt}`),
      pfad: leserHref({ koId: ko.id, fassung: null }),
    });
    vorschlaege.push({ art: "hinweis", text: t("klaraqualitaet.vorschlag.bestaetigen") });
  }
  if (entfernt.length > 0) {
    vorschlaege.push({ art: "hinweis", text: t("klaraqualitaet.vorschlag.quelleErsetzen") });
  }
  return {
    schluessel: `quellenalter:${ko.id}`,
    art: "quellenalter",
    titel: stufe
      ? t("klaraqualitaet.alter.titel", { stufe: t(`frische.stufe.${stufe}`) })
      : t("klaraqualitaet.alter.titelEntfernt"),
    erklaerung,
    quellen: [quelleAus(ko, ko.id, true, null)],
    grundlage: "belegt",
    unsicherheit:
      f?.halbwertszeitHerkunft === "vorgabe" ? t("klaraqualitaet.unsicher.vorgabe") : null,
    vorschlaege,
  };
}

function fehlendeAngaben(d: QualitaetsDaten, t: TFunction): Befund[] {
  const { ko } = d;
  const befunde: Befund[] = [];
  const verantwortlich = ko.frische?.verantwortlich ?? ko.author;
  // Nur, wenn der Lesepfad die Quellen geliefert hat: ein fehlendes Feld ist keine fehlende Quelle.
  if (Array.isArray(ko.sources) && ko.sources.length === 0) {
    befunde.push({
      schluessel: `fehlend:quelle:${ko.id}`,
      art: "fehlende_angabe",
      titel: t("klaraqualitaet.fehlend.quelleTitel"),
      erklaerung: [t("klaraqualitaet.fehlend.quelle")],
      quellen: [quelleAus(ko, ko.id, true, null)],
      grundlage: "keine",
      unsicherheit: t("klaraqualitaet.unsicher.keinePflicht"),
      vorschlaege: d.darfBearbeiten
        ? [
            {
              art: "arbeitsweg",
              text: t("klaraqualitaet.vorschlag.quelleNachtragen"),
              pfad: leserHref({ koId: ko.id, fassung: null }),
            },
          ]
        : [
            {
              art: "hinweis",
              text: t("klaraqualitaet.vorschlag.quelleErfragen", { name: verantwortlich }),
            },
          ],
    });
  }
  if (ko.frische?.verantwortlichArt === "author-fallback") {
    befunde.push({
      schluessel: `fehlend:verantwortlich:${ko.id}`,
      art: "fehlende_angabe",
      titel: t("klaraqualitaet.fehlend.verantwortlichTitel"),
      erklaerung: [t("klaraqualitaet.fehlend.verantwortlich", { name: verantwortlich })],
      quellen: [quelleAus(ko, ko.id, true, null)],
      grundlage: "belegt",
      unsicherheit: null,
      vorschlaege: [
        {
          art: "arbeitsweg",
          text: t("klaraqualitaet.vorschlag.verantwortlichBenennen"),
          pfad: leserHref({ koId: ko.id, fassung: null }),
        },
      ],
    });
  }
  return befunde;
}

/**
 * Das Signal am eigenen Objekt meldet einen offenen Befund, der in der Paarliste nicht steht.
 *   · Die Paarliste wurde GELESEN (`gelesen`) und nennt ihn nicht: der Server hat das Paar für
 *     diese Person ausgefiltert — Klara sagt, dass es ihn gibt, ohne Gegenseite, ohne Inhalt.
 *   · Die Paarliste antwortete NICHT (`null`): ein Lesefehler belegt keine Rechtebeschränkung.
 *     Klara nennt den bekannten offenen Befund mit unbekannter Ursache und ohne Grundlage.
 */
function signalBefunde(
  d: QualitaetsDaten,
  lage: Record<"konflikt" | "duplikat", { gelesen: boolean; sichtbar: boolean }>,
  t: TFunction,
): Befund[] {
  const signal = (d.signale ?? []).find((s) => s.koId === d.ko.id);
  if (!signal) {
    return [];
  }
  const arten: ("konflikt" | "duplikat")[] = [];
  if (signal.konflikt && !lage.konflikt.sichtbar) {
    arten.push("konflikt");
  }
  if (signal.dublette && !lage.duplikat.sichtbar) {
    arten.push("duplikat");
  }
  return arten.map((art): Befund => {
    const quellen = [quelleAus(d.ko, d.ko.id, true, null)];
    if (!lage[art].gelesen) {
      return {
        schluessel: `ungelesen:${art}:${d.ko.id}`,
        art: "ungelesen",
        titel: t(`klaraqualitaet.ungelesen.titel.${art}`),
        erklaerung: [t("klaraqualitaet.ungelesen.text")],
        quellen,
        grundlage: "nicht_verfuegbar",
        unsicherheit: t("klaraqualitaet.unsicher.ursacheUnbekannt"),
        vorschlaege: [{ art: "hinweis", text: t("klaraqualitaet.vorschlag.erneutLesen") }],
      };
    }
    return {
      schluessel: `verdeckt:${art}:${d.ko.id}`,
      art: "verdeckt",
      titel: t(`klaraqualitaet.verdeckt.titel.${art}`),
      erklaerung: [t("klaraqualitaet.verdeckt.text")],
      quellen,
      grundlage: "zurueckgehalten",
      unsicherheit: null,
      vorschlaege: [{ art: "hinweis", text: t("klaraqualitaet.vorschlag.verdeckt") }],
    };
  });
}

/**
 * Was die Fläche sagt, wenn KEIN Befund dasteht: „keine offenen Befunde“ nur bei vollständig
 * gelesener Grundlage; fehlt ein Prüfweg, ist der Prüfstand unvollständig. `null`: es gibt Befunde.
 */
export function leerAussage(lage: Qualitaetslage): "keine" | "unvollstaendig" | null {
  if (lage.befunde.length > 0) {
    return null;
  }
  return lage.nichtGelesen.length === 0 ? "keine" : "unvollstaendig";
}

/**
 * Die Befunde zum geöffneten Objekt, erklärt. REIN: dieselben gelesenen Daten ergeben in jeder
 * Sprache dieselben Befunde mit derselben Grundlage und denselben Arbeitswegen.
 */
export function befundeAus(d: QualitaetsDaten, t: TFunction, sprache: string): Qualitaetslage {
  const konflikte = offeneKonflikte(d.konflikte ?? [], d.ko.id);
  const ueberschneidungen = offeneUeberschneidungen(d.ueberschneidungen ?? [], d.ko.id);
  const befunde: Befund[] = [
    ...konflikte.map((c) => konfliktBefund(c, d, t)),
    ...ueberschneidungen.map((o) => duplikatBefund(o, d, t)),
  ];
  const alter = quellenalterBefund(d, t, sprache);
  if (alter) {
    befunde.push(alter);
  }
  befunde.push(...fehlendeAngaben(d, t));
  const konfliktLage = { gelesen: d.konflikte !== null, sichtbar: konflikte.length > 0 };
  const duplikatLage = {
    gelesen: d.ueberschneidungen !== null,
    sichtbar: ueberschneidungen.length > 0,
  };
  befunde.push(...signalBefunde(d, { konflikt: konfliktLage, duplikat: duplikatLage }, t));
  const nichtGelesen: Pruefweg[] = [];
  if (d.konflikte === null) {
    nichtGelesen.push("konflikte");
  }
  if (d.ueberschneidungen === null) {
    nichtGelesen.push("duplikate");
  }
  if (d.signale === null) {
    nichtGelesen.push("signale");
  }
  return { befunde, nichtGelesen };
}
