// ================================================================================================
// KLARA 04 (produkt:20261008:klara-vorschlaege) — FORMULIERUNGSVORSCHLAG UND BEWUSSTE ÜBERNAHME.
// ================================================================================================
//
// DER WEG, in dieser Reihenfolge:
//   1. FORMULIEREN. Die Markierung wird gegen den heutigen Stand und die heutigen Rechte geprüft
//      (`pruefeAuswahl`, dieselbe Sperre wie bei Erklären/Zusammenfassen) und geht dann über den
//      VORHANDENEN Formulierungsweg des Editors (`POST /api/reasoner`, Aufgabe `assist`, Anweisung
//      „klarer formulieren“) — keine eigene KI. Ob ein Modell formuliert hat, sagt die Antwort
//      (`demo`); Klara erfindet kein Etikett. Am Objekt ändert sich dabei nichts.
//   2. ÜBERNEHMEN — nur auf Knopfdruck. Vorher wird das Ziel geprüft: Gehört der Vorschlag zu einem
//      Wissensobjekt? Ist GENAU dieses Objekt geöffnet? Darf die Rolle es bearbeiten? Ist es noch
//      sichtbar und steht der Wortlaut noch da? Erst dann geht der Vorschlag in den Editor des
//      Objekts (`lib/klaraUebernahme.ts`). Mehrere Fundstellen: Rückfrage, nichts geändert.
//   3. NACHLESEN. Hat die Person im Editor gespeichert oder eingereicht, liest Klara das Objekt am
//      Server nach und sagt, was dort WIRKLICH steht — keine Erfolgsmeldung aus dem Browser.
//
// Klara führt nichts aus, was im markierten Text oder im Vorschlag steht: der Vorschlag ist Text,
// er wird als Text in den Editor gesetzt (`ersetzeStelle`), nie als Auszeichnung.
import type { TFunction } from "i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { KnowledgeObject } from "../../api/types";
import {
  type UebergabeErgebnis,
  letzteRueckmeldung,
  uebergebe,
  zieheUebergabeZurueck,
} from "../../lib/klaraUebernahme";
import type { Leseobjekt } from "../../lib/leseobjekt";
import type { ReasonerLocale } from "../../lib/reasonerLocale";
import { draftProvenance } from "../../lib/reasonerProvenance";
import { pruefeAuswahl, sperrgrund, wortlautEnthalten } from "./bezug";
import { fehlerBild } from "./echt";
import { type Auswahl, type Textvorschlag, aendere, leseZustand, neueId } from "./zustand";

/** So lange wartet Klara auf den Editor des Objekts, bevor sie sagt, dass keiner da ist. */
export const UEBERGABE_WARTEN_MS = 1500;

/** Ändert den Vorschlag mit dieser Kennung — ein inzwischen ersetzter bleibt unberührt. */
export function setzeVorschlag(id: string, teil: Partial<Textvorschlag>): void {
  aendere((z) =>
    z.textvorschlag?.id === id ? { ...z, textvorschlag: { ...z.textvorschlag, ...teil } } : z,
  );
}

function bleibt(id: string): boolean {
  return leseZustand().textvorschlag?.id === id;
}

/** Schritt 1: Klara formuliert den markierten Text um — oder sagt, warum die Markierung gesperrt ist. */
export async function formuliere(
  a: Auswahl,
  locale: ReasonerLocale,
  t: TFunction,
): Promise<{ gesperrt: string } | { vorschlag: Textvorschlag }> {
  const grund = sperrgrund(await pruefeAuswahl(a), t);
  if (grund) {
    return { gesperrt: grund };
  }
  const basis = {
    id: neueId("vorschlag"),
    original: a.text,
    herkunft: a.herkunft,
  };
  try {
    const r = await endpoints.reasoner.assist(
      a.text,
      locale,
      t("capture.ai.instr.clarify"),
      draftProvenance(undefined, a.herkunft.koId),
    );
    const neu = r.text.trim();
    if (neu.length === 0) {
      return {
        vorschlag: {
          ...basis,
          neu: "",
          ki: "ohne_ki",
          stand: "fehler",
          meldung: t("klaravorschlag.fehler.leer"),
        },
      };
    }
    return {
      vorschlag: { ...basis, neu, ki: r.demo ? "ohne_ki" : "ki", stand: "offen" },
    };
  } catch (fehler) {
    return {
      vorschlag: {
        ...basis,
        neu: "",
        ki: "ohne_ki",
        stand: "fehler",
        meldung: t("klaravorschlag.fehler.formulieren", { grund: fehlerBild(fehler, t).text }),
      },
    };
  }
}

/** Was vor der Übergabe feststeht — oder `null`, wenn übergeben werden darf. */
export function zielVorab(
  v: Textvorschlag,
  lese: Leseobjekt | null,
  t: TFunction,
): Partial<Textvorschlag> | null {
  const h = v.herkunft;
  const titel = h.titel ?? h.objekt;
  if (h.lesart === "uebersetzung") {
    return { stand: "fehler", meldung: t("klaravorschlag.fehler.uebersetzung", { titel }) };
  }
  if (!h.koId) {
    return {
      stand: "rueckfrage",
      rueckfrage: "kein_objekt",
      meldung: t("klaravorschlag.rueckfrage.keinObjekt", { seite: h.seitenName }),
    };
  }
  if (!lese || lese.koId !== h.koId) {
    return {
      stand: "rueckfrage",
      rueckfrage: "anderes_objekt",
      meldung: lese
        ? t("klaravorschlag.rueckfrage.anderesObjekt", { titel, offen: lese.titel })
        : t("klaravorschlag.rueckfrage.nichtOffen", { titel }),
    };
  }
  if (!lese.darfBearbeiten) {
    return { stand: "fehler", meldung: t("klaravorschlag.fehler.keinRecht", { titel }) };
  }
  return null;
}

function ergebnisFolge(e: UebergabeErgebnis, t: TFunction, titel: string): Partial<Textvorschlag> {
  switch (e.art) {
    case "uebernommen":
      return { stand: "in_bearbeitung", feld: e.feld, bearbeitungGesehen: false };
    case "mehrdeutig":
      return {
        stand: "rueckfrage",
        rueckfrage: "stellen",
        stellen: e.stellen.map((s) => ({ ...s })),
        meldung: t("klaravorschlag.rueckfrage.stellen", { anzahl: e.stellen.length }),
      };
    case "nicht_gefunden":
      return { stand: "fehler", meldung: t("klaravorschlag.fehler.nichtGefunden", { titel }) };
    case "ueber_formatierung":
      return { stand: "fehler", meldung: t("klaravorschlag.fehler.formatierung") };
    case "kein_recht":
      return { stand: "fehler", meldung: t("klaravorschlag.fehler.keinRecht", { titel }) };
  }
}

/**
 * Schritt 2: bewusst übernehmen. `wahl` ist die in der Rückfrage gewählte Stelle. Das Ergebnis steht
 * danach am Vorschlag (`stand`, `meldung`).
 */
export async function uebernehme(
  v: Textvorschlag,
  lese: Leseobjekt | null,
  t: TFunction,
  wahl?: { nr: number; anzahl: number },
): Promise<void> {
  const vorab = zielVorab(v, lese, t);
  if (vorab) {
    setzeVorschlag(v.id, vorab);
    return;
  }
  const titel = v.herkunft.titel ?? v.herkunft.objekt;
  setzeVorschlag(v.id, { stand: "wartet", meldung: undefined });
  // Rechte und Wortlaut JETZT, am Server — dieselbe Prüfung wie vor dem Frageweg.
  const lage = await pruefeAuswahl({ id: v.id, text: v.original, herkunft: v.herkunft });
  if (!bleibt(v.id)) {
    return;
  }
  if (lage.art === "kein_zugriff" || lage.art === "fehler") {
    setzeVorschlag(v.id, { stand: "fehler", meldung: sperrgrund(lage, t) ?? undefined });
    return;
  }
  if (lage.art === "nicht_im_text") {
    setzeVorschlag(v.id, {
      stand: "fehler",
      meldung: t("klaravorschlag.fehler.nichtGefunden", { titel }),
    });
    return;
  }
  const uebergabeId = neueId("uebergabe");
  const ergebnis = await new Promise<UebergabeErgebnis | null>((fertig) => {
    const start = Date.now();
    const sehen = (): void => {
      const r = letzteRueckmeldung();
      if (r?.id === uebergabeId) {
        fertig(r.ergebnis);
        return;
      }
      if (Date.now() - start > UEBERGABE_WARTEN_MS) {
        zieheUebergabeZurueck(uebergabeId);
        fertig(null);
        return;
      }
      setTimeout(sehen, 40);
    };
    uebergebe({
      id: uebergabeId,
      koId: v.herkunft.koId as string,
      original: v.original,
      neu: v.neu,
      ...(wahl ? { wahl } : {}),
    });
    sehen();
  });
  if (!bleibt(v.id)) {
    return;
  }
  if (!ergebnis) {
    setzeVorschlag(v.id, { stand: "fehler", meldung: t("klaravorschlag.fehler.keinEditor") });
    return;
  }
  setzeVorschlag(v.id, {
    ...ergebnisFolge(ergebnis, t, titel),
    basisFassung: lese?.fassung ?? null,
  });
}

function textVonVorschlag(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  return typeof DOMParser === "function"
    ? (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "")
    : html.replace(/<[^>]*>/g, " ");
}

function inVorschlag(ko: KnowledgeObject, neu: string): boolean {
  const gesucht = neu.replace(/\s+/g, "").toLowerCase();
  return (ko.proposals ?? []).some(
    (p) =>
      p.status === "offen" &&
      `${p.statement} ${textVonVorschlag(p.bodyHtml)}`
        .replace(/\s+/g, "")
        .toLowerCase()
        .includes(gesucht),
  );
}

/**
 * Schritt 3: die Bearbeitung ist zu (gespeichert, eingereicht oder abgebrochen). Klara liest das
 * Objekt am Server nach und hält fest, was dort steht.
 */
export async function liesNach(v: Textvorschlag, t: TFunction): Promise<void> {
  const koId = v.herkunft.koId;
  if (!koId) {
    return;
  }
  let ko: KnowledgeObject;
  try {
    ko = await endpoints.ko.get(encodeURIComponent(koId));
  } catch (fehler) {
    if (!bleibt(v.id)) {
      return;
    }
    setzeVorschlag(v.id, {
      stand: "fehler",
      meldung: t("klarakontext.gesperrt.fehler", {
        status: fehler instanceof ApiError ? fehler.status : "?",
      }),
    });
    return;
  }
  if (!bleibt(v.id)) {
    return;
  }
  const fassung = typeof ko.version === "number" ? ko.version : null;
  const neuer = fassung !== null && (v.basisFassung == null || fassung > v.basisFassung);
  if (neuer && wortlautEnthalten(ko, v.neu)) {
    setzeVorschlag(v.id, { stand: "gespeichert", gespeichertFassung: fassung ?? undefined });
    return;
  }
  if (inVorschlag(ko, v.neu)) {
    setzeVorschlag(v.id, { stand: "eingereicht" });
    return;
  }
  setzeVorschlag(v.id, { stand: "nicht_gespeichert" });
}
