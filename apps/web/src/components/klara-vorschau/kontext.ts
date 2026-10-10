// ================================================================================================
// KLARA-VORSCHAU · WO BIN ICH, UND WORAN? — Seite und konkretes Objekt aus Adresse und Seite.
// ================================================================================================
//
// Klara erkennt ihren Ort an der Adresse (welche Seite) und am Inhalt der Seite (welches Objekt):
//   · fiktiver Artikel   → sein Titel (Demodaten, `artikel.ts`)
//   · Wissensobjekt      → Titel, Fassung, Prüfstatus, Lesen/Bearbeiten aus dem Appzustand der
//                          Lesefläche (`lib/leseobjekt.ts`, Klara 03); die Kennung aus der Adresse
//   · Erfassung          → der Titel des Entwurfs im Blatt (`blatt-titel`), sonst „neuer Entwurf“;
//                          die Entwurfskennung aus der Adresse (`?draft=`)
//   · Fragen             → die Frage im ECHTEN Fragefeld (nicht in der Tutorial-Demo); ein Beitrag,
//                          zu dem gefragt wird, aus der Adresse (`?ko=`/`?fassung=`)
//   · jede andere Seite  → ihr Name aus der bestehenden Hilfe-Registry (`lib/klaraRegistry.ts`)
// Gelesen wird nur, was auf dem Bildschirm steht. Nichts davon verlässt den Browser.
import type { TFunction } from "i18next";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../lib/captureFrontDoor";
import { pageEntryFor } from "../../lib/klaraRegistry";
import type { Leseobjekt } from "../../lib/leseobjekt";
import { fassungAmOrt, gelesenerStandJetzt, objektbezugAm } from "../../lib/objektbezug";
import { FRAGEN_ZIEL, ZIEL_ATTRIBUT } from "../fragen/ziele";
import { VORSCHAU_PFAD, demoArtikel } from "./artikel";
import type { Herkunft, SeitenArt } from "./zustand";

export type Uebersetzer = TFunction;

const ARTIKEL_MUSTER = new RegExp(`^${VORSCHAU_PFAD}/artikel/([^/]+)/?$`);
const WISSEN_MUSTER = /^\/wissen\/[^/]+\/?$/;

export function seiteAusPfad(pfad: string): { seite: SeitenArt; artikelId?: string } {
  if (pfad === VORSCHAU_PFAD || pfad === `${VORSCHAU_PFAD}/`) {
    return { seite: "uebersicht" };
  }
  const treffer = ARTIKEL_MUSTER.exec(pfad);
  if (treffer?.[1]) {
    return { seite: "artikel", artikelId: decodeURIComponent(treffer[1]) };
  }
  if (WISSEN_MUSTER.test(pfad)) {
    return { seite: "wissen" };
  }
  if (pfad === "/erfassen" || pfad.startsWith("/erfassen/") || pfad === CAPTURE_FRONT_DOOR_ROUTE) {
    return { seite: "erfassung" };
  }
  if (pfad === "/fragen") {
    return { seite: "fragen" };
  }
  return { seite: "andere" };
}

/** Nacharbeit 5: der Wortlaut für den Frageweg — Leerraum zusammengefasst, höchstens 300 Zeichen. */
function kontextWortlaut(text: string): string {
  return [...text.replace(/\s+/g, " ").trim()].slice(0, 300).join("");
}

function kuerze(text: string, max = 60): string {
  const sauber = text.replace(/\s+/g, " ").trim();
  return sauber.length > max ? `${sauber.slice(0, max - 1)}…` : sauber;
}

/** Das echte Fragefeld der Seite — ausdrücklich nicht das der Tutorial-Demo. */
export function echtesFragefeld(doc: Document): HTMLInputElement | HTMLTextAreaElement | null {
  const felder = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      `[${ZIEL_ATTRIBUT}="${FRAGEN_ZIEL.fragefeld}"]`,
    ),
  );
  return felder.find((el) => !el.closest("[data-tutorial-demo]")) ?? null;
}

/**
 * Das echte Wissensobjekt an diesem Ort: Kennung aus der Adresse (`/wissen/:id`, Bibliothek
 * `?eintrag=`, Fragen/Prüfen `?ko=`), Fassung aus Adresse oder Lesefläche, und — nur, wenn die
 * Lesefläche GENAU DIESES Objekt meldet — Titel, Prüfstatus und Modus. Ein zuletzt gelesenes anderes
 * Objekt liefert nichts.
 */
type Wissensbezug = Pick<
  Herkunft,
  "koId" | "fassung" | "titel" | "pruefstatus" | "modus" | "lesart" | "darfBearbeiten"
>;

function wissensbezug(pfad: string, suche: string, lese: Leseobjekt | null): Wissensbezug | null {
  const auskunft = objektbezugAm(pfad, suche);
  if (!auskunft) {
    return null;
  }
  const { koId } = auskunft.bezug;
  const passend = lese && lese.koId === koId ? lese : null;
  const fassung = fassungAmOrt(auskunft.bezug, gelesenerStandJetzt()) ?? passend?.fassung ?? null;
  return {
    koId,
    ...(fassung !== null ? { fassung } : {}),
    ...(passend
      ? {
          titel: passend.titel,
          pruefstatus: passend.pruefstatus,
          modus: passend.modus,
          lesart: passend.lesart,
          darfBearbeiten: passend.darfBearbeiten,
        }
      : {}),
  };
}

export function ermittleKontext(
  pfad: string,
  t: Uebersetzer,
  doc: Document | null,
  suche = "",
  lese: Leseobjekt | null = null,
): Herkunft {
  const { seite: ausPfad, artikelId } = seiteAusPfad(pfad);
  // Die Bibliothek mit gewähltem Eintrag ist dieselbe Lesefläche wie `/wissen/:id`.
  const bibliothekEintrag =
    pfad === "/bibliothek" && objektbezugAm(pfad, suche) !== null ? "wissen" : null;
  const seite: SeitenArt = bibliothekEintrag ?? ausPfad;
  switch (seite) {
    case "wissen": {
      const w: Wissensbezug = wissensbezug(pfad, suche, lese) ?? {};
      return {
        pfad,
        seite,
        seitenName: t("klarakontext.seite.wissen"),
        objekt: w.titel
          ? t("klaravorschau.objekt.artikel", { titel: w.titel })
          : t("klarakontext.objekt.wissenLaedt"),
        ...w,
      };
    }
    case "uebersicht":
      return {
        pfad,
        seite,
        seitenName: t("klaravorschau.seite.uebersicht"),
        objekt: t("klaravorschau.objekt.uebersicht"),
      };
    case "artikel": {
      const artikel = demoArtikel(artikelId);
      return {
        pfad,
        seite,
        seitenName: t("klaravorschau.seite.artikel"),
        objekt: artikel
          ? t("klaravorschau.objekt.artikel", { titel: artikel.titel })
          : t("klaravorschau.objekt.keins"),
        ...(artikel ? { artikelId: artikel.id } : {}),
      };
    }
    case "erfassung": {
      const feld = doc?.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]');
      const titel = feld?.value ?? "";
      const entwurfId = (new URLSearchParams(suche).get("draft") ?? "").trim();
      return {
        pfad,
        seite,
        seitenName: t("klaravorschau.seite.erfassung"),
        objekt: titel.trim()
          ? t("klaravorschau.objekt.entwurf", { titel: kuerze(titel) })
          : t("klaravorschau.objekt.neuerEntwurf"),
        // Wer erfasst, bearbeitet — der Entwurf ist immer offen zum Schreiben.
        modus: "bearbeiten",
        ...(entwurfId ? { entwurfId } : {}),
        ...(titel.trim() ? { kontextText: kontextWortlaut(titel) } : {}),
      };
    }
    case "fragen": {
      const frage = doc ? (echtesFragefeld(doc)?.value ?? "") : "";
      // „Frage zum Beitrag …“ (`?ko=`): der Beitrag gehört zum Kontext, die Frage bleibt das Objekt.
      const w = wissensbezug(pfad, suche, lese);
      return {
        pfad,
        seite,
        seitenName: t("klaravorschau.seite.fragen"),
        objekt: frage.trim()
          ? t("klaravorschau.objekt.frage", { frage: kuerze(frage) })
          : t("klaravorschau.objekt.keineFrage"),
        ...(frage.trim() ? { kontextText: kontextWortlaut(frage) } : {}),
        ...(w ?? {}),
      };
    }
    default: {
      const eintrag = pageEntryFor(pfad);
      return {
        pfad,
        seite,
        seitenName: eintrag ? t(eintrag.titleKey) : t("klaravorschau.seite.andere"),
        objekt: t("klaravorschau.objekt.keins"),
      };
    }
  }
}

/** Die Erklärung der Seite aus der bestehenden Hilfe-Registry (oder `null`). */
export function seitenErklaerung(pfad: string, t: Uebersetzer): string | null {
  const ziel = seiteAusPfad(pfad).seite === "erfassung" ? "/erfassen" : pfad;
  const eintrag = pageEntryFor(ziel);
  return eintrag ? t(eintrag.bodyKey) : null;
}

/** Absatzartige Blöcke im Lesetext — gezählt wird, wie ein Mensch Absätze zählt. */
const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, figcaption";

/**
 * Klara 03 · K2: die Herkunft einer Markierung in der ECHTEN Lesefläche. Objekt, Titel, Fassung,
 * Prüfstatus und Lesart stehen als Attribute an der Textfläche (`BibliothekLesen.tsx`, gesetzt aus
 * dem gezeichneten Objekt); der Absatz ist der wievielte Block dieser Fläche. Damit gehört die
 * Herkunft der Markierung selbst — ein späterer Seitenwechsel ändert sie nicht.
 */
function wissensHerkunft(el: Element, kontext: Herkunft, t: Uebersetzer | null): Herkunft | null {
  const flaeche = el.closest<HTMLElement>("[data-klara-objekt]");
  const koId = flaeche?.dataset.klaraObjekt;
  if (!flaeche || !koId) {
    return null;
  }
  const titel = flaeche.dataset.klaraTitel ?? "";
  const fassung = Number(flaeche.dataset.klaraFassung);
  const pruef = flaeche.dataset.klaraPruefstatus;
  const lesart = flaeche.dataset.klaraLesart;
  const block = el.closest(BLOCK);
  const bloecke = Array.from(flaeche.querySelectorAll(BLOCK));
  const nr = block && flaeche.contains(block) ? bloecke.indexOf(block) + 1 : 0;
  const herkunft: Herkunft = {
    pfad: kontext.pfad,
    seite: "wissen",
    seitenName: t ? t("klarakontext.seite.wissen") : kontext.seitenName,
    objekt: t && titel ? t("klaravorschau.objekt.artikel", { titel }) : kontext.objekt,
    koId,
    ...(titel ? { titel } : {}),
    ...(Number.isSafeInteger(fassung) && fassung >= 1 ? { fassung } : {}),
    ...(pruef === "geprueft" || pruef === "ungeprueft" ? { pruefstatus: pruef } : {}),
    ...(lesart === "original" || lesart === "uebersetzung" ? { lesart } : {}),
    ...(kontext.koId === koId && kontext.modus ? { modus: kontext.modus } : {}),
    ...(nr > 0 ? { absatz: nr } : {}),
  };
  return herkunft;
}

/** Herkunft eines Knotens: Seitenkontext plus Absatz, wenn er in einem Artikelabsatz liegt. */
export function herkunftFuer(
  knoten: Node | null,
  kontext: Herkunft,
  t: Uebersetzer | null = null,
): Herkunft {
  const el = knoten instanceof Element ? knoten : (knoten?.parentElement ?? null);
  const wissen = el ? wissensHerkunft(el, kontext, t) : null;
  if (wissen) {
    return wissen;
  }
  const absatzEl = el?.closest<HTMLElement>("[data-klara-absatz]");
  const nr = absatzEl ? Number(absatzEl.dataset.klaraAbsatz) : Number.NaN;
  if (!absatzEl || !Number.isFinite(nr)) {
    return kontext;
  }
  const artikelId =
    absatzEl.closest<HTMLElement>("[data-klara-artikel]")?.dataset.klaraArtikel ??
    kontext.artikelId;
  return { ...kontext, absatz: nr, ...(artikelId ? { artikelId } : {}) };
}
