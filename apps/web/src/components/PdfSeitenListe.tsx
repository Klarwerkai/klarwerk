// OCR-E04 · Der Lesestand einer PDF Seite für Seite — Textebene und gescannte Seite, mit
// Seitenzahl und ehrlichem Gesamtstatus (Logik in `lib/pdfScanSeiten.ts`). Laufende, fehlerhafte,
// nicht gelesene und fehlende Seiten stehen als solche da; die gelesenen bleiben daneben sichtbar.
import { useTranslation } from "react-i18next";
import type { BildBefund, QuellenBefund, QuellenStatus } from "../lib/bildAutomatik";
import { MAX_PDF_PAGES } from "../lib/pdf";
import { bildStatusSchluessel } from "./BildBefundListe";

const QUELLEN_SCHLUESSEL: Record<Exclude<QuellenStatus, "ohne-bilder">, string> = {
  laeuft: "pdfscan.quelle.laeuft",
  vollstaendig: "pdfscan.quelle.vollstaendig",
  teilweise: "pdfscan.quelle.teilweise",
  fehlgeschlagen: "pdfscan.quelle.fehlgeschlagen",
  "nicht-verfuegbar": "pdfscan.quelle.nichtVerfuegbar",
  aus: "pdfscan.quelle.aus",
};

function gelesen(b: BildBefund): boolean {
  return b.status === "gelesen" || b.status === "kein-text";
}

/** Gelesene Seiten (jeder Teil der Seite gelesen) und alle Seiten einschliesslich der fehlenden. */
export function seitenZaehlung(befund: QuellenBefund): { fertig: number; gesamt: number } {
  const jeSeite = new Map<number, boolean>();
  for (const b of befund.befunde) {
    const seite = b.fundstelle.seite ?? 0;
    jeSeite.set(seite, (jeSeite.get(seite) ?? true) && gelesen(b));
  }
  const fertig = [...jeSeite.values()].filter(Boolean).length;
  return { fertig, gesamt: jeSeite.size + (befund.fehlendeSeiten ?? 0) };
}

export function PdfSeitenListe({ befund, lauf }: { befund: QuellenBefund; lauf?: number }) {
  const { t } = useTranslation();
  if (befund.status === "ohne-bilder") {
    return null;
  }
  const { fertig, gesamt } = seitenZaehlung(befund);
  return (
    <section
      data-testid="pdf-seiten"
      data-status={befund.status}
      data-lauf={lauf}
      className="rounded-card border border-hairline px-3 py-2 text-[12px] leading-relaxed"
    >
      <div className="font-mono text-klein uppercase tracking-wider text-muted-2">
        {t("pdfscan.titel")}
      </div>
      <output aria-live="polite" className="mt-1 block font-semibold text-text">
        {t(QUELLEN_SCHLUESSEL[befund.status], { name: befund.quelle, fertig, gesamt })}
      </output>
      {befund.hinweise.length > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-trust-warn-text">
          {befund.hinweise.map((h) => (
            <li key={h} data-testid="pdf-seiten-hinweis" data-hinweis={h}>
              {h === "pdf-seiten-fehlen"
                ? t("pdfscan.hinweis.seitenFehlen", {
                    seiten: MAX_PDF_PAGES,
                    fehlend: befund.fehlendeSeiten ?? 0,
                  })
                : t("klarabildkontext.hinweis.einstellungUnbekannt")}
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="mt-2 space-y-1.5">
        {befund.befunde.map((b) => {
          const seite = b.fundstelle.seite ?? 0;
          const teil = b.fundstelle.seitenteil ?? "bild";
          return (
            <li
              key={`${seite}-${teil}`}
              data-testid="pdf-seite"
              data-seite={seite}
              data-seitenteil={teil}
              data-status={b.status}
            >
              <span className="font-semibold text-text">
                {t("pdfscan.fundstelle.seite", { seite })}
              </span>
              {" · "}
              <span className="text-muted">
                {teil === "bild" ? t("pdfscan.teil.bild") : t("pdfscan.teil.textebene")}
              </span>
              {teil === "bild" ? (
                <span className="text-muted"> · {t(bildStatusSchluessel(b.status))}</span>
              ) : null}
              {b.grund === "automatik-aus" ? (
                <span className="text-muted-2"> · {t("klarabildkontext.grund.automatikAus")}</span>
              ) : null}
              {b.textGekennzeichnet ? (
                <pre
                  data-testid="pdf-seite-text"
                  className="mt-0.5 whitespace-pre-wrap break-words font-sans text-text"
                >
                  {b.textGekennzeichnet}
                </pre>
              ) : null}
              {(b.doppelt ?? 0) > 0 ? (
                <p data-testid="pdf-seite-doppelt" className="text-muted">
                  {t("pdfscan.doppelt", { anzahl: b.doppelt ?? 0 })}
                </p>
              ) : null}
              {b.unsicher.length > 0 ? (
                <p className="text-trust-warn-text">
                  {t("bildautomatik.unsicher", { n: b.unsicher.length })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
