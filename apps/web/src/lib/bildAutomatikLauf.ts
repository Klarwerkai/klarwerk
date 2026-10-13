// OCR-02 · Die Bildanalyse der Web-App: die vorhandene Texterkennung (W01, `runImageOcr`) hinter der
// Automatik aus `bildAutomatik.ts`. Je Fläche ein Exemplar (Erfassen, Editor, Office im Artikel) —
// darin werden unveränderte Bilder über alle Eingänge dieser Fläche wiedererkannt und nicht erneut
// gelesen. Die Texterkennung läuft im Browser; die Bildbeschreibung (W02) reicht die Fläche je Lauf
// mit ihrer eigenen Herkunft herein.
import { useRef } from "react";
import { useAssistenzStand } from "./assistenzProfil";
import { type BildAnalyse, createBildAnalyse } from "./bildAutomatik";
import { runImageOcr } from "./files";

/** Nur Bilder des eigenen Objektspeichers — derselbe berechtigte Lesezugriff wie die Anzeige. */
const OBJEKT_BILD_RE = /^\/api\/objects\/[\w-]+\/raw$/;

/**
 * Ein Objektspeicher-Bild als data-URL holen; alles andere (fremde Adressen) wird nicht geladen.
 * `signal` bricht Abruf UND Antwortkörper ab — die Ladefrist setzt die Analyse (`bildAutomatik.ts`).
 */
export async function ladeObjektBild(src: string, signal?: AbortSignal): Promise<string | null> {
  if (!OBJEKT_BILD_RE.test(src.trim())) {
    return null;
  }
  const antwort = await fetch(src.trim(), {
    credentials: "same-origin",
    ...(signal ? { signal } : {}),
  });
  if (!antwort.ok) {
    return null;
  }
  const blob = await antwort.blob();
  if (!blob.type.startsWith("image/")) {
    return null;
  }
  return new Promise<string | null>((resolve) => {
    const leser = new FileReader();
    leser.onload = () => resolve(typeof leser.result === "string" ? leser.result : null);
    leser.onerror = () => resolve(null);
    leser.readAsDataURL(blob);
  });
}

export function neueBildAnalyse(): BildAnalyse {
  return createBildAnalyse({ erkenne: (src) => runImageOcr(src), ladeBild: ladeObjektBild });
}

/**
 * OCR-03 · Die Analyse einer Fläche, gebunden an das angemeldete Konto. Wechselt das Konto im
 * bestätigten Browserstand (`lib/assistenzProfil.ts`), entsteht eine NEUE, leere Analyse: gemerkte
 * Ergebnisse eines anderen Menschen werden nie wiederverwendet — auch nicht für dieselben Bildbytes.
 */
export function useBildAnalyse(): BildAnalyse {
  const kontoId = useAssistenzStand().kontoId;
  const ref = useRef<{ kontoId: string | null; analyse: BildAnalyse } | null>(null);
  if (ref.current === null || ref.current.kontoId !== kontoId) {
    ref.current = { kontoId, analyse: neueBildAnalyse() };
  }
  return ref.current.analyse;
}
