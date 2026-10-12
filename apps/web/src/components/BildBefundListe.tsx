// OCR-02 · Der Befund des automatischen Bildlesens einer Quelle — sichtbar, mit Fundstelle je Bild
// und ehrlichem Gesamtstatus. Laufende, teilweise und fehlgeschlagene Analysen erscheinen nie als
// „vollständig gelesen" (Logik in `lib/bildAutomatik.ts`, `quellenStatus`).
import { useTranslation } from "react-i18next";
import {
  BILD_HOECHSTZAHL_JE_QUELLE,
  type BildBefund,
  type BildBefundStatus,
  type BildFundstelle,
  type QuellenBefund,
  type QuellenStatus,
} from "../lib/bildAutomatik";

const STATUS_SCHLUESSEL: Record<BildBefundStatus, string> = {
  wartet: "bildautomatik.status.wartet",
  laeuft: "bildautomatik.status.laeuft",
  gelesen: "bildautomatik.status.gelesen",
  "kein-text": "bildautomatik.status.keinText",
  fehlgeschlagen: "bildautomatik.status.fehlgeschlagen",
  "nicht-verfuegbar": "bildautomatik.status.nichtVerfuegbar",
  "kein-zugriff": "bildautomatik.status.keinZugriff",
  zeitueberschreitung: "bildautomatik.status.zeitueberschreitung",
  "nicht-analysiert": "bildautomatik.status.nichtAnalysiert",
};

const QUELLEN_SCHLUESSEL: Record<Exclude<QuellenStatus, "ohne-bilder">, string> = {
  laeuft: "bildautomatik.quelle.laeuft",
  vollstaendig: "bildautomatik.quelle.vollstaendig",
  teilweise: "bildautomatik.quelle.teilweise",
  fehlgeschlagen: "bildautomatik.quelle.fehlgeschlagen",
  "nicht-verfuegbar": "bildautomatik.quelle.nichtVerfuegbar",
  aus: "bildautomatik.quelle.aus",
};

export function bildStatusSchluessel(status: BildBefundStatus): string {
  return STATUS_SCHLUESSEL[status];
}

/** Schlüssel und Werte der sichtbaren Fundstelle („Folie 2, Bild 1"). */
export function fundstelleBaustein(f: BildFundstelle): {
  key: string;
  params: Record<string, number>;
} {
  if (f.folie !== undefined && f.folienansicht) {
    return { key: "bildautomatik.fundstelle.folienansicht", params: { folie: f.folie } };
  }
  if (f.folie !== undefined) {
    return {
      key: "bildautomatik.fundstelle.folie",
      params: { folie: f.folie, bild: f.bildAufFolie ?? 1 },
    };
  }
  return { key: "bildautomatik.fundstelle.bild", params: { bild: f.bild } };
}

function istFertig(b: BildBefund): boolean {
  return b.status === "gelesen" || b.status === "kein-text";
}

/** `lauf` zählt die Eingänge dieser Fläche — ein neuer Eingang derselben Datei ist ein neuer Lauf. */
export function BildBefundListe({ befund, lauf }: { befund: QuellenBefund; lauf?: number }) {
  const { t } = useTranslation();
  if (befund.status === "ohne-bilder") {
    return null;
  }
  const fertig = befund.befunde.filter(istFertig).length;
  const verloren = befund.nichtGelesen.reduce((n, x) => n + x.anzahl, 0);
  const gesamt = befund.befunde.length + verloren;
  return (
    <section
      data-testid="bild-befunde"
      data-status={befund.status}
      data-lauf={lauf}
      className="rounded-card border border-hairline px-3 py-2 text-[12px] leading-relaxed"
    >
      <div className="font-mono text-klein uppercase tracking-wider text-muted-2">
        {t("bildautomatik.titel")}
      </div>
      {/* `<output>` trägt implizit `role="status"` (biome useSemanticElements, Hausmuster wie in
          `CaptureFileImport.tsx`); `block`, weil `<output>` sonst inline steht. */}
      <output aria-live="polite" className="mt-1 block font-semibold text-text">
        {t(QUELLEN_SCHLUESSEL[befund.status], { name: befund.quelle, fertig, gesamt })}
      </output>
      {befund.nichtGelesen.length > 0 || befund.hinweise.length > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-muted">
          {befund.nichtGelesen.map((x) => (
            <li key={`verloren-${x.folie ?? "ohne"}`} data-testid="bild-befund-verloren">
              {x.folie !== undefined
                ? t("bildautomatik.hinweis.nichtGelesenFolie", {
                    folie: x.folie,
                    anzahl: x.anzahl,
                  })
                : t("bildautomatik.hinweis.nichtGelesen", { anzahl: x.anzahl })}
            </li>
          ))}
          {befund.hinweise.map((h) => (
            <li key={h} data-testid="bild-befund-hinweis">
              {h === "pptx-layout-nicht-erfasst"
                ? t("bildautomatik.hinweis.pptxLayout")
                : t("bildautomatik.hinweis.grenze", { max: BILD_HOECHSTZAHL_JE_QUELLE })}
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="mt-2 space-y-1.5">
        {befund.befunde.map((b) => (
          <li
            key={`${b.fundstelle.bild}-${b.fundstelle.imageId ?? ""}`}
            data-testid="bild-befund"
            data-status={b.status}
            data-folie={b.fundstelle.folie ?? ""}
          >
            <span className="font-semibold text-text">
              {t(fundstelleBaustein(b.fundstelle).key, fundstelleBaustein(b.fundstelle).params)}
            </span>
            {" · "}
            <span className="text-muted">{t(STATUS_SCHLUESSEL[b.status])}</span>
            {b.wiederverwendet ? (
              <span className="text-muted-2"> · {t("bildautomatik.wiederverwendet")}</span>
            ) : null}
            {b.textGekennzeichnet ? (
              <pre
                data-testid="bild-befund-text"
                className="mt-0.5 whitespace-pre-wrap break-words font-sans text-text"
              >
                {b.textGekennzeichnet}
              </pre>
            ) : null}
            {b.unsicher.length > 0 ? (
              <p className="text-trust-warn-text">
                {t("bildautomatik.unsicher", { n: b.unsicher.length })}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
