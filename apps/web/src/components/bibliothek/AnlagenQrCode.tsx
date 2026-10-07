import { Download } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { anlagenAdresse, anlagenKennung, anlagenPfad } from "../../lib/anlagenzugang";
import { QR_RUHEZONE, QrZuLangFehler, qrMatrix, qrSvgPfad } from "../../lib/qrCode";
import { RoleLink } from "../RoleLink";
import { Button } from "../ui";

// ================================================================================================
// R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DER QR-CODE EINER ANLAGE.
// ================================================================================================
//
// „Jede Anlage bekommt einen QR-Code. Smartphone scannen → KLARWERK öffnet die Wissens-Sicht für
// DIESE Anlage." Der Code steht dort, wo die Anlage am Wissen hängt: im Abschnitt „Kopplung und
// Anlagen" der Leseansicht. Er kodiert die Adresse aus `lib/anlagenzugang.ts` — die Bibliothek mit
// der Facette „Anlage" — unter dem Ursprung, unter dem KLARWERK gerade läuft. Ein Code für eine
// andere Installation entsteht hier also nicht.
//
// Ohne Anlage am Objekt gibt es keinen Code (keine Zeile, kein Platzhalter). Ist die Kennung für
// Version 10-M zu lang, sagt die Fläche das, statt einen abgeschnittenen Link zu drucken.
export function AnlagenQrCode({
  anlage,
}: {
  anlage: string | null | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const kennung = anlagenKennung(anlage);
  const code = useMemo(() => {
    if (!kennung) {
      return null;
    }
    const adresse = anlagenAdresse(window.location.origin, kennung);
    try {
      const matrix = qrMatrix(adresse);
      return { seite: matrix.length + 2 * QR_RUHEZONE, pfad: qrSvgPfad(matrix) };
    } catch (fehler) {
      if (fehler instanceof QrZuLangFehler) {
        return "zuLang" as const;
      }
      throw fehler;
    }
  }, [kennung]);

  if (!kennung || code === null) {
    return null;
  }
  if (code === "zuLang") {
    return (
      <p data-testid="anlagen-qr-zu-lang" className="mt-2.5 text-[12px] text-trust-warn-text">
        {t("anlagenzugang.qr.zuLang")}
      </p>
    );
  }

  const bildText = t("anlagenzugang.qr.bild", { anlage: kennung });
  const herunterladen = (): void => {
    // Dieselbe Zeichnung als eigenständige Datei: weißer Grund (das Etikett), schwarze Module.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${code.seite} ${code.seite}" width="${code.seite * 8}" height="${code.seite * 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${code.pfad}" fill="#000"/></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `klarwerk-anlage-${kennung.replace(/[^A-Za-z0-9._-]+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="anlagen-qr"
      className="mt-2.5 flex flex-wrap items-start gap-3 border-t border-hairline pt-2.5"
    >
      <svg
        data-testid="anlagen-qr-bild"
        role="img"
        aria-label={bildText}
        viewBox={`0 0 ${code.seite} ${code.seite}`}
        shapeRendering="crispEdges"
        className="h-32 w-32 shrink-0 rounded-input border border-hairline"
      >
        <title>{bildText}</title>
        {/* Weißer Grund auch im dunklen Thema: ein Scanner braucht den Kontrast des Etiketts. */}
        <rect width="100%" height="100%" fill="#fff" />
        <path d={code.pfad} fill="#000" />
      </svg>
      <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-text">
          {t("anlagenzugang.qr.titel", { anlage: kennung })}
        </span>
        <p className="text-[12px] text-muted">{t("anlagenzugang.qr.hinweis")}</p>
        <RoleLink
          to={anlagenPfad(kennung)}
          testId="anlagen-qr-oeffnen"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-ai"
          hoverClassName="hover:underline"
        >
          {(erreichbar) => (
            <>
              {t("anlagenzugang.qr.oeffnen")}
              {erreichbar ? <span aria-hidden="true">→</span> : null}
            </>
          )}
        </RoleLink>
        <span>
          <Button variant="ghost" onClick={herunterladen}>
            <Download size={14} aria-hidden="true" />
            {t("anlagenzugang.qr.herunterladen")}
          </Button>
        </span>
      </div>
    </div>
  );
}
