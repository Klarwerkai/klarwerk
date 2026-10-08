// ================================================================================================
// KLARA-VORSCHAU · WO BIN ICH, UND WORAN? — Seite und konkretes Objekt aus Adresse und Seite.
// ================================================================================================
//
// Klara erkennt ihren Ort an der Adresse (welche Seite) und am Inhalt der Seite (welches Objekt):
//   · fiktiver Artikel   → sein Titel (Demodaten, `artikel.ts`)
//   · Erfassung          → der Titel des Entwurfs im Blatt (`blatt-titel`), sonst „neuer Entwurf“
//   · Fragen             → die Frage im ECHTEN Fragefeld (nicht in der Tutorial-Demo)
//   · jede andere Seite  → ihr Name aus der bestehenden Hilfe-Registry (`lib/klaraRegistry.ts`)
// Gelesen wird nur, was auf dem Bildschirm steht. Nichts davon verlässt den Browser.
import type { TFunction } from "i18next";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../lib/captureFrontDoor";
import { pageEntryFor } from "../../lib/klaraRegistry";
import { FRAGEN_ZIEL, ZIEL_ATTRIBUT } from "../fragen/ziele";
import { VORSCHAU_PFAD, demoArtikel } from "./artikel";
import type { Herkunft, SeitenArt } from "./zustand";

export type Uebersetzer = TFunction;

const ARTIKEL_MUSTER = new RegExp(`^${VORSCHAU_PFAD}/artikel/([^/]+)/?$`);

export function seiteAusPfad(pfad: string): { seite: SeitenArt; artikelId?: string } {
  if (pfad === VORSCHAU_PFAD || pfad === `${VORSCHAU_PFAD}/`) {
    return { seite: "uebersicht" };
  }
  const treffer = ARTIKEL_MUSTER.exec(pfad);
  if (treffer?.[1]) {
    return { seite: "artikel", artikelId: decodeURIComponent(treffer[1]) };
  }
  if (pfad === "/erfassen" || pfad.startsWith("/erfassen/") || pfad === CAPTURE_FRONT_DOOR_ROUTE) {
    return { seite: "erfassung" };
  }
  if (pfad === "/fragen") {
    return { seite: "fragen" };
  }
  return { seite: "andere" };
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

export function ermittleKontext(pfad: string, t: Uebersetzer, doc: Document | null): Herkunft {
  const { seite, artikelId } = seiteAusPfad(pfad);
  switch (seite) {
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
      return {
        pfad,
        seite,
        seitenName: t("klaravorschau.seite.erfassung"),
        objekt: titel.trim()
          ? t("klaravorschau.objekt.entwurf", { titel: kuerze(titel) })
          : t("klaravorschau.objekt.neuerEntwurf"),
      };
    }
    case "fragen": {
      const frage = doc ? (echtesFragefeld(doc)?.value ?? "") : "";
      return {
        pfad,
        seite,
        seitenName: t("klaravorschau.seite.fragen"),
        objekt: frage.trim()
          ? t("klaravorschau.objekt.frage", { frage: kuerze(frage) })
          : t("klaravorschau.objekt.keineFrage"),
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

/** Herkunft eines Knotens: Seitenkontext plus Absatz, wenn er in einem Artikelabsatz liegt. */
export function herkunftFuer(knoten: Node | null, kontext: Herkunft): Herkunft {
  const el = knoten instanceof Element ? knoten : (knoten?.parentElement ?? null);
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
