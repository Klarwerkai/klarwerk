// ================================================================================================
// KLARA 03 (produkt:20261007:klara-kontext-tutorial) — WORAUF SICH EINE FRAGE BEZIEHT.
// ================================================================================================
//
// Die Person wählt sichtbar zwischen drei Bezügen: der SEITE mit ihrem Objekt („Dieser Artikel“),
// der gemerkten MARKIERUNG („Dieser Artikel · markierter Absatz“) und dem FREIEN Gespräch. Diese
// Datei sagt, wie der gewählte Bezug heisst, was davon in die Frage geht und was am Gespräch als
// Objektbezug festgehalten wird.
//
// DREI REGELN, die hier eingehalten werden:
//   1. DIE HERKUNFT EINER MARKIERUNG GEHÖRT IHR. Beim Bezug „Markierung“ gilt ihre Herkunft (Objekt,
//      Fassung, Absatz zum Zeitpunkt des Markierens) — nie die der Seite, auf der man gerade steht.
//   2. RECHTE GELTEN JETZT, NICHT DAMALS. Bevor eine Markierung aus einem Wissensobjekt an den
//      Frageweg geht, liest Klara das Objekt über denselben Leseweg wie die Lesefläche
//      (`GET /api/kos/:id`, Sichtbarkeit am Server). Unsichtbar, vertraulich oder nicht mehr im Text:
//      dann geht nichts los, und Klara sagt warum (`pruefeAuswahl`).
//   3. MARKIERTER INHALT IST MATERIAL, KEINE ANWEISUNG. Er steht in der Frage nur in Anführungszeichen
//      als Zitat. Klara führt nichts aus, was in ihm oder in einer Antwort steht: es gibt keinen Weg
//      von einem Text zu einer Handlung — jede Handlung ist ein Knopf, den die Person drückt.
//
// WARUM DIE FRAGE-RAHMEN SO KARG SIND: Der Frageweg bindet seit R-0473 jeden Inhaltsbegriff der
// Frage an die Quelle (`services/reasoner/src/provider.ts`, `FRAGEGERUEST`). Ein Rahmen wie
// „Erkläre den markierten Absatz …“ machte JEDE Markierungsfrage zur Wissenslücke, weil keine
// Quelle „erkläre“ oder „markiert“ sagt. Die Rahmen benutzen deshalb nur Stoppwörter und das
// deklarierte Fragegerüst („Was gilt für …“, „Was steht zu …“, „What is …“); die Liste des
// Fragewegs bleibt unangetastet.
import type { TFunction } from "i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type {
  KlaraAskAntwort,
  KlaraObjektbezug,
  KlaraQuellenAngabe,
} from "../../api/klaraGespraech";
import type { KnowledgeObject } from "../../api/types";
import type { Auswahl, Bezug, Herkunft } from "./zustand";

type Uebersetzer = TFunction;

/** So viel vom markierten Text hält der Objektbezug am Gespräch fest (Server: höchstens 300). */
export const AUSWAHL_IM_BEZUG_MAX = 300;
/** So viel vom markierten Text geht höchstens in eine Frage (die Markierung selbst ist ≤ 1200). */
export const AUSWAHL_IN_FRAGE_MAX = 1200;

export type Zielsprache = "de" | "en" | "nl";
export const ZIELSPRACHEN: readonly Zielsprache[] = ["de", "en", "nl"];

function eng(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Wie Klara das Objekt einer Seite nennt: „Dieser Artikel“, „Dieser Entwurf“, … */
export function kontextName(h: Herkunft, t: Uebersetzer): string {
  switch (h.seite) {
    case "wissen":
    case "artikel":
      return t("klarakontext.bezug.artikel");
    case "erfassung":
      return t("klarakontext.bezug.entwurf");
    case "fragen":
      return h.koId ? t("klarakontext.bezug.frageZumBeitrag") : t("klarakontext.bezug.frage");
    default:
      return t("klarakontext.bezug.seite");
  }
}

/** Stammt die Markierung vom Objekt, das jetzt zu sehen ist? */
export function auswahlHier(a: Auswahl, kontext: Herkunft): boolean {
  if (a.herkunft.seite !== kontext.seite) {
    return false;
  }
  if (a.herkunft.koId || kontext.koId) {
    return a.herkunft.koId === kontext.koId;
  }
  return a.herkunft.pfad === kontext.pfad && a.herkunft.artikelId === kontext.artikelId;
}

/** Der wirksame Bezug: „Markierung“ ohne gemerkte Markierung ist die Seite. */
export function wirksamerBezug(bezug: Bezug, auswahl: Auswahl | null): Bezug {
  return bezug === "markierung" && !auswahl ? "seite" : bezug;
}

/** Die sichtbare Zeile über dem Gespräch — z. B. „Dieser Artikel · markierter Absatz“. */
export function bezugZeile(
  bezug: Bezug,
  kontext: Herkunft,
  auswahl: Auswahl | null,
  t: Uebersetzer,
): string {
  const b = wirksamerBezug(bezug, auswahl);
  if (b === "frei") {
    return t("klarakontext.bezug.frei");
  }
  if (b === "markierung" && auswahl) {
    if (auswahlHier(auswahl, kontext)) {
      const teil = auswahl.herkunft.absatz
        ? t("klarakontext.bezug.markierterAbsatz")
        : t("klarakontext.bezug.markierung");
      return `${kontextName(kontext, t)} · ${teil}`;
    }
    return t("klarakontext.bezug.markierungAus", { objekt: auswahl.herkunft.objekt });
  }
  return kontextName(kontext, t);
}

/** Herkunft samt Fassung, Prüfstatus, Absatz, Lesart und Modus — so viel, wie bekannt ist. */
export function herkunftTeile(h: Herkunft, t: Uebersetzer): string[] {
  const teile = [t("klaravorschau.auswahl.herkunft", { seite: h.seitenName, objekt: h.objekt })];
  if (h.fassung) {
    teile.push(t("klarakontext.fassung", { nr: h.fassung }));
  }
  if (h.pruefstatus) {
    teile.push(t(`klarakontext.pruefstatus.${h.pruefstatus}`));
  }
  if (h.absatz) {
    teile.push(t("klaravorschau.auswahl.absatz", { nr: h.absatz }));
  }
  if (h.lesart === "uebersetzung") {
    teile.push(t("klarakontext.lesart.uebersetzung"));
  }
  return teile;
}

/**
 * Der Objektbezug, den das Gespräch für einen Schritt festhält. Beim Bezug „Markierung“ ist es die
 * Herkunft der MARKIERUNG (Regel 1), beim freien Gespräch nur der Ort — ohne ein Objekt zu behaupten.
 */
export function objektbezugFuer(
  bezug: Bezug,
  kontext: Herkunft,
  auswahl: Auswahl | null,
): KlaraObjektbezug {
  const b = wirksamerBezug(bezug, auswahl);
  if (b === "frei") {
    return {
      pfad: kontext.pfad,
      seitenName: kontext.seitenName,
      objekt: kontext.objekt,
      bezug: "frei",
    };
  }
  const h = b === "markierung" && auswahl ? auswahl.herkunft : kontext;
  return {
    pfad: h.pfad,
    seitenName: h.seitenName,
    objekt: h.objekt,
    ...(h.artikelId ? { artikelId: h.artikelId } : {}),
    ...(h.absatz ? { absatz: h.absatz } : {}),
    ...(h.koId ? { koId: h.koId } : {}),
    ...(h.fassung ? { fassung: h.fassung } : {}),
    ...(h.modus ? { modus: h.modus } : {}),
    ...(h.pruefstatus ? { pruefstatus: h.pruefstatus } : {}),
    ...(h.lesart ? { lesart: h.lesart } : {}),
    bezug: b,
    ...(b === "markierung" && auswahl
      ? { auswahl: [...eng(auswahl.text)].slice(0, AUSWAHL_IM_BEZUG_MAX).join("") }
      : {}),
  };
}

/** Der markierte Text als Zitat — Anführungszeichen darin werden neutralisiert (Regel 3). */
export function zitat(text: string): string {
  return [...eng(text).replace(/[„“”«»"]/g, "'")].slice(0, AUSWAHL_IN_FRAGE_MAX).join("");
}

export type KontextAktion = "erklaeren" | "zusammenfassen";

/**
 * Was an den Frageweg geht. Die getippte Frage bleibt wörtlich; der Bezug kommt als Zitat dazu —
 * die Markierung oder der Titel des Artikels. Frei: nur die Frage.
 */
export function frageText(
  art: KontextAktion | "frage",
  eingabe: string,
  bezug: Bezug,
  kontext: Herkunft,
  auswahl: Auswahl | null,
  t: Uebersetzer,
): string {
  if ((art === "erklaeren" || art === "zusammenfassen") && auswahl) {
    return t(`klarakontext.frage.${art}`, { auswahl: zitat(auswahl.text) });
  }
  const frage = eng(eingabe);
  const b = wirksamerBezug(bezug, auswahl);
  if (b === "markierung" && auswahl) {
    return t("klarakontext.frage.mitMarkierung", { frage, auswahl: zitat(auswahl.text) });
  }
  if (b === "seite" && kontext.seite === "wissen" && kontext.titel) {
    return t("klarakontext.frage.mitArtikel", { frage, titel: zitat(kontext.titel) });
  }
  return frage;
}

// ------------------------------------------------------------------------------------------------
// Regel 2 — die Markierung gegen den heutigen Stand und die heutigen Rechte prüfen.
// ------------------------------------------------------------------------------------------------

export type AuswahlLage =
  /** Die Markierung stammt aus keinem Wissensobjekt (eigene Eingabe, Entwurf, Vorschau-Artikel). */
  | { art: "ohne_objekt" }
  | {
      art: "ok";
      titel: string;
      aktuelleFassung: number | null;
      /** Die Fassung hat sich seit dem Markieren geändert — der Wortlaut steht aber noch da. */
      geaendert: boolean;
      vertraulich: boolean;
      geprueft: boolean;
    }
  /** Das Objekt ist für diese Person (jetzt) nicht sichtbar — 404/403 vom Leseweg. */
  | { art: "kein_zugriff" }
  /** Der markierte Wortlaut steht im aktuellen Original nicht mehr. */
  | { art: "nicht_im_text"; aktuelleFassung: number | null }
  | { art: "fehler"; status: number | null };

function ohneLeerraum(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function textVon(ko: KnowledgeObject): string {
  let inhalt = "";
  if (ko.bodyHtml) {
    inhalt =
      typeof DOMParser === "function"
        ? (new DOMParser().parseFromString(ko.bodyHtml, "text/html").body.textContent ?? "")
        : ko.bodyHtml.replace(/<[^>]*>/g, " ");
  }
  return [ko.title, ko.statement, inhalt, ...ko.conditions, ...ko.measures].join(" ");
}

/** Steht der markierte Wortlaut im Objekt? Leerraum zählt nicht (Absatzgrenzen im Lesebild). */
export function wortlautEnthalten(ko: KnowledgeObject, auswahl: string): boolean {
  const gesucht = ohneLeerraum(auswahl);
  return gesucht.length > 0 && ohneLeerraum(textVon(ko)).includes(gesucht);
}

export async function pruefeAuswahl(a: Auswahl): Promise<AuswahlLage> {
  const koId = a.herkunft.koId;
  if (!koId) {
    return { art: "ohne_objekt" };
  }
  let ko: KnowledgeObject;
  try {
    ko = await endpoints.ko.get(encodeURIComponent(koId));
  } catch (fehler) {
    if (fehler instanceof ApiError && (fehler.status === 404 || fehler.status === 403)) {
      return { art: "kein_zugriff" };
    }
    return { art: "fehler", status: fehler instanceof ApiError ? fehler.status : null };
  }
  const aktuelleFassung = typeof ko.version === "number" ? ko.version : null;
  // Aus einer Leseübersetzung markiert: der Wortlaut ist am Original nicht prüfbar — er wird
  // dann nicht verglichen, die Lesart steht an der Herkunft.
  if (a.herkunft.lesart !== "uebersetzung" && !wortlautEnthalten(ko, a.text)) {
    return { art: "nicht_im_text", aktuelleFassung };
  }
  return {
    art: "ok",
    titel: ko.title,
    aktuelleFassung,
    geaendert:
      aktuelleFassung !== null &&
      a.herkunft.fassung !== undefined &&
      a.herkunft.fassung !== aktuelleFassung,
    vertraulich:
      ko.confidentiality === "vertraulich" || ko.confidentiality === "streng_vertraulich",
    geprueft: ko.status === "validiert",
  };
}

/** Darf die Markierung an den Frageweg? Wenn nicht: der Satz, der sagt warum. */
export function sperrgrund(lage: AuswahlLage, t: Uebersetzer): string | null {
  switch (lage.art) {
    case "ohne_objekt":
      return null;
    case "ok":
      return lage.vertraulich ? t("klarakontext.gesperrt.vertraulich") : null;
    case "kein_zugriff":
      return t("klarakontext.gesperrt.keinZugriff");
    case "nicht_im_text":
      return t("klarakontext.gesperrt.nichtImText", {
        aktuell: lage.aktuelleFassung ?? "?",
      });
    case "fehler":
      return t("klarakontext.gesperrt.fehler", { status: lage.status ?? "?" });
  }
}

// ------------------------------------------------------------------------------------------------
// Antworten: Quellen mit Fassung und Prüfstatus, fehlende Grundlage in Worten.
// ------------------------------------------------------------------------------------------------

/**
 * Titel, Fassung und Prüfstatus je Quelle — aus DIESER Antwort des Fragewegs (`belastbarkeit`,
 * `quellenStand`). Was der Frageweg nicht sagt, bleibt `null`; eine Quelle ohne Titel bekommt
 * keine Angabe (die Fläche zeigt dann nur den Verweis).
 */
export function quellenAngabenAus(
  antwort: KlaraAskAntwort,
  quellen: readonly string[],
): KlaraQuellenAngabe[] {
  const jeId = new Map((antwort.result.belastbarkeit?.quellen ?? []).map((q) => [q.koId, q]));
  const angaben: KlaraQuellenAngabe[] = [];
  for (const koId of quellen) {
    const b = jeId.get(koId);
    if (!b?.titel) {
      continue;
    }
    const stand = antwort.quellenStand?.[koId];
    angaben.push({
      koId,
      titel: [...b.titel].slice(0, 300).join(""),
      fassung: typeof stand === "number" ? stand : typeof b.version === "number" ? b.version : null,
      geprueft: typeof b.validiert === "boolean" ? b.validiert : null,
    });
  }
  return angaben;
}

/** Ohne Antwort: verständlich sagen, welche Grundlage fehlt — bezogen auf den gewählten Bezug. */
export function fehlendeGrundlage(
  antwort: KlaraAskAntwort,
  bezug: KlaraObjektbezug,
  t: Uebersetzer,
): string {
  const satz =
    bezug.bezug === "markierung"
      ? t("klarakontext.grundlage.markierung", { objekt: bezug.objekt })
      : bezug.bezug === "seite" && bezug.koId
        ? t("klarakontext.grundlage.artikel", { objekt: bezug.objekt })
        : t("klaragespraech.antwort.keine");
  const verschlossen = antwort.verschlossen?.length ?? 0;
  return verschlossen > 0
    ? `${satz} ${t("klarakontext.grundlage.verschlossen", { anzahl: verschlossen })}`
    : `${satz} ${t("klarakontext.grundlage.weiter")}`;
}

// ------------------------------------------------------------------------------------------------
// Übersetzen — über die vorhandenen Leseübersetzungen (kein Modell, keine freie Übersetzung).
// ------------------------------------------------------------------------------------------------

/**
 * Klara übersetzt nicht frei. Sie zeigt die vorhandene Leseübersetzung des Beitrags, aus dem die
 * Markierung stammt (`GET /api/kos/:id/lesevariante/:lang`, dieselbe Sichtbarkeit wie das Objekt),
 * und sagt, wenn es keine gibt. Der Satz nennt Sprache, Herkunft und Vorbehalte der Übersetzung.
 */
export async function uebersetzung(
  a: Auswahl,
  sprache: Zielsprache,
  t: Uebersetzer,
): Promise<string> {
  const spracheName = t(`klarakontext.sprache.${sprache}`);
  const koId = a.herkunft.koId;
  if (!koId) {
    return t("klarakontext.uebersetzen.ohneQuelle", { sprache: spracheName });
  }
  const lage = await pruefeAuswahl(a);
  if (lage.art === "kein_zugriff" || lage.art === "fehler") {
    return sperrgrund(lage, t) ?? t("klarakontext.gesperrt.keinZugriff");
  }
  const titel = a.herkunft.titel ?? a.herkunft.objekt;
  try {
    const v = await endpoints.lesevarianten.fuerKo(koId, sprache);
    const teile = [
      t("klarakontext.uebersetzen.lesevariante", {
        sprache: spracheName,
        titel: v.title,
        aussage: v.statement,
        herkunft: v.herkunft,
      }),
    ];
    if (v.originalGeaendert) {
      teile.push(t("klarakontext.uebersetzen.originalGeaendert"));
    }
    if (v.quellabgleich === "unbestaetigt") {
      teile.push(t("klarakontext.uebersetzen.unbestaetigt"));
    }
    teile.push(t("klarakontext.uebersetzen.ganzerBeitrag"));
    return teile.join(" ");
  } catch (fehler) {
    if (fehler instanceof ApiError && fehler.status === 404) {
      return t("klarakontext.uebersetzen.keine", { titel, sprache: spracheName });
    }
    return t("klarakontext.gesperrt.fehler", {
      status: fehler instanceof ApiError ? fehler.status : "?",
    });
  }
}

// ------------------------------------------------------------------------------------------------
// Was hier möglich ist — aus dem Appzustand, nicht aus einer festen Liste.
// ------------------------------------------------------------------------------------------------

export type MoeglicheAktion =
  | "fragen"
  | "erklaeren"
  | "zusammenfassen"
  | "uebersetzen"
  | "tutorial"
  | "bearbeiten";

export function moeglicheAktionen(lage: {
  kontext: Herkunft;
  auswahl: Auswahl | null;
  echt: boolean;
  sendebereit: boolean;
  tutorialVorhanden: boolean;
}): MoeglicheAktion[] {
  const aktionen: MoeglicheAktion[] = [];
  const fragenGeht = !lage.echt || lage.sendebereit;
  if (fragenGeht) {
    aktionen.push("fragen");
    if (lage.auswahl) {
      aktionen.push("erklaeren", "zusammenfassen");
    }
  }
  if (lage.echt && lage.auswahl?.herkunft.koId) {
    aktionen.push("uebersetzen");
  }
  if (lage.tutorialVorhanden) {
    aktionen.push("tutorial");
  }
  if (lage.kontext.seite === "wissen" && lage.kontext.darfBearbeiten) {
    aktionen.push("bearbeiten");
  }
  return aktionen;
}
