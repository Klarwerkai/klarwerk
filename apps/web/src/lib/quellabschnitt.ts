// ================================================================================================
// AW03-K02 · DER QUELLABSCHNITT EINES ANKERS — SPIEGEL DER SERVERREGEL FÜR GESPEICHERTE FASSUNGEN.
// ================================================================================================
//
// Original: `services/knowledge-object/src/quellabschnitt.ts` (`quellabschnitteAus`). Der Lesestand
// einer Gesamtanweisung bringt die Quellabschnitte schon fertig vom Server; eine GESPEICHERTE Fassung
// (`GET /api/kos/:id/versions`) bringt nur ihre Anker. Damit beide Ansichten dieselbe Fundstelle und
// denselben Stand zeigen, steht die Regel hier als Spiegel.
//
// KEIN IMPORT AUS `services/`: der webbuild-Stage im Dockerfile kopiert NUR `apps/web`. Die Bindung
// an das Original leistet `tests/aw03-herkunft/gespeicherte-fassung-oeffnen.test.tsx`, der beide
// Regeln über dieselben Anker vergleicht.
import type { KoSource, Quellabschnitt } from "../api/types";

type Anker = Pick<KoSource, "id" | "label" | "url" | "excerpt" | "provider" | "sourceVersion"> & {
  readonly externalId?: string | null;
  readonly sourceRecordId?: string | null;
};

function text(wert: string | null | undefined): string | null {
  const t = typeof wert === "string" ? wert.trim() : "";
  return t.length > 0 ? t : null;
}

function fundstelle(a: Anker): string | null {
  const id = text(a.id);
  if (text(a.excerpt) && id) {
    return `beleg:${id}`;
  }
  const seite = text(a.externalId);
  if (text(a.sourceRecordId) && seite && typeof a.sourceVersion === "number") {
    return `quellseite:${seite}@${a.sourceVersion}`;
  }
  return null;
}

/** `null` = die Fassung trägt keine Ankerliste (unbekannt), `[]` = sie hat keine Anker. */
export function quellabschnitteAus(
  anker: readonly Anker[] | null | undefined,
): Quellabschnitt[] | null {
  if (!Array.isArray(anker)) {
    return null;
  }
  return anker.map((a) => {
    const stelle = fundstelle(a);
    return {
      ankerId: text(a.id),
      bezeichnung: text(a.label) ?? "",
      anbieter: text(a.provider),
      quellId: text(a.externalId),
      quellfassung: typeof a.sourceVersion === "number" ? a.sourceVersion : null,
      quellrevision: text(a.sourceRecordId),
      url: text(a.url),
      fundstelle: stelle,
      stand: stelle ? "geprueft" : "ungeprueft",
    };
  });
}
