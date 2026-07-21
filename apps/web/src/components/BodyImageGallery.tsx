import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type BodyImage, extractBodyImages } from "../lib/bodyImages";
import { SectionLabel } from "./ui";

// WP-BILD-1d (Pedis Galerie-Feature): LESEANSICHT-Galerie der Beitrags-Bilder. Client-seitig aus dem
// sanitisierten bodyHtml abgeleitet (extractBodyImages) — keine neue Persistenz, keine neuen Routen/Rechte.
// Die Fußnote unter dem großen Bild ist die AKTUELLE figcaption des Bodys (gleiche Quelle, keine Kopie);
// bearbeitet wird weiterhin NUR im Editor — die Galerie ist ehrliche Leseansicht. Erscheint nur, wenn der
// Body mindestens ein verankertes Bild (data-image-id) enthält.
// Barrierefreiheit: echte <button>s, alt-Text aus der Caption, Escape schließt die Großansicht, der Fokus
// kehrt zum auslösenden Thumbnail zurück.
export function BodyImageGallery({ bodyHtml }: { bodyHtml: string }): JSX.Element | null {
  const { t } = useTranslation();
  const images: BodyImage[] = extractBodyImages(bodyHtml);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Das Thumbnail, das die Großansicht geöffnet hat — für die Fokus-Rückkehr beim Schließen.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevBtnRef = useRef<HTMLButtonElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);

  // WP-D9c (bens Galerie-Auflage 2): ECHTE Modal-Semantik. showModal() erzwingt Top-Layer + Fokusfalle
  // nativ (aria-modal wird nicht mehr nur behauptet); beim ÖFFNEN wandert der Fokus auf den
  // Schließen-Knopf. Escape läuft nativ über das cancel→close-Ereignispaar des Dialogs.
  // Teil C1 (bens P2-Nacharbeit): bei Vor/Zurück bleibt der Fokus SINNVOLL — vorher sprang er bei
  // JEDER Navigation auf den Schließen-Knopf; und läuft ein Navigations-Knopf am Rand auf disabled
  // (der Browser wirft den Fokus dann auf body), wandert er zum Gegenknopf statt zu verschwinden.
  useEffect(() => {
    if (openIndex === null) {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      closeBtnRef.current?.focus(); // nur beim ÖFFNEN — Navigation behält ihren Fokus
      return;
    }
    // Navigation im offenen Dialog: nur eingreifen, wenn der Fokus verloren ging (disabled-Rand).
    // Ein disabled gewordener, noch „fokussierter" Knopf zählt ebenfalls als verloren — Browser
    // werfen den Fokus dann auf body, jsdom lässt ihn stehen; beide Fälle enden am Gegenknopf.
    const active = document.activeElement;
    const focusLost =
      !active ||
      active === document.body ||
      !dialog?.contains(active) ||
      (active instanceof HTMLButtonElement && active.disabled);
    if (focusLost) {
      const fallback =
        prevBtnRef.current && !prevBtnRef.current.disabled
          ? prevBtnRef.current
          : nextBtnRef.current && !nextBtnRef.current.disabled
            ? nextBtnRef.current
            : closeBtnRef.current;
      fallback?.focus();
    }
  }, [openIndex]);

  // Pfeiltasten blättern innerhalb des offenen Dialogs (Escape übernimmt der native cancel-Pfad).
  useEffect(() => {
    if (openIndex === null) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowLeft") {
        setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      } else if (e.key === "ArrowRight") {
        setOpenIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, images.length]);

  // Schließen IMMER über die native close()-API — das close-Ereignis synchronisiert dann State + Fokus
  // (eine Austrittsstelle für X-Knopf, Escape/cancel und programmatische Schließungen).
  const requestClose = (): void => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  };

  const onDialogClose = (): void => {
    setOpenIndex(null);
    // Bestehende Fokus-Rückkehr: zurück zum auslösenden Thumbnail.
    triggerRef.current?.focus();
  };

  // Kein leerer Abschnitt: ohne verankerte Bilder erscheint die Galerie gar nicht.
  if (images.length === 0) {
    return null;
  }
  const open = openIndex !== null ? images[openIndex] : undefined;

  return (
    <div className="mt-3 border-t border-hairline pt-2">
      <SectionLabel>{t("ko.gallery")}</SectionLabel>
      <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            aria-label={t("ko.galleryOpen", { n: i + 1 })}
            title={img.caption || t("ko.galleryOpen", { n: i + 1 })}
            className="group overflow-hidden rounded-card border border-hairline bg-page hover:border-ai/50"
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setOpenIndex(i);
            }}
          >
            <img
              src={img.src}
              alt={img.caption}
              className="h-16 w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open !== undefined && openIndex !== null ? (
        // Lightbox-Großansicht als ECHTES Modal (showModal → Top-Layer + native Fokusfalle); Escape läuft
        // über onCancel→close nativ, X über requestClose — beide münden in onDialogClose (kein alert/confirm).
        <dialog
          ref={dialogRef}
          onCancel={requestClose}
          onClose={onDialogClose}
          aria-label={t("ko.gallery")}
          className="fixed inset-0 z-50 flex h-full w-full flex-col items-center justify-center bg-ink/80 p-4"
        >
          <div className="flex w-full max-w-3xl items-center justify-between gap-2 pb-2">
            <span className="font-mono text-[12px] font-semibold text-white">
              {t("ko.galleryCount", { n: openIndex + 1, m: images.length })}
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label={t("ko.galleryClose")}
              onClick={requestClose}
              className="inline-flex items-center gap-1 rounded-btn border border-white/40 px-2 py-1 text-[12px] font-semibold text-white hover:bg-white/10"
            >
              <X size={14} />
              {t("ko.galleryClose")}
            </button>
          </div>
          <div className="flex w-full max-w-3xl items-center gap-2">
            <button
              ref={prevBtnRef}
              type="button"
              aria-label={t("ko.galleryPrev")}
              disabled={openIndex === 0}
              onClick={() => setOpenIndex(openIndex - 1)}
              className="rounded-btn border border-white/40 p-1.5 text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <img
                src={open.src}
                alt={open.caption}
                className="max-h-[70vh] w-full rounded-card bg-white object-contain"
              />
              {/* Die AKTUELLE Fußnote aus dem Body — reine Anzeige, bearbeitet wird im Editor. */}
              {open.caption ? (
                <p className="mt-2 text-center text-[12.5px] italic leading-relaxed text-white">
                  {open.caption}
                </p>
              ) : null}
            </div>
            <button
              ref={nextBtnRef}
              type="button"
              aria-label={t("ko.galleryNext")}
              disabled={openIndex === images.length - 1}
              onClick={() => setOpenIndex(openIndex + 1)}
              className="rounded-btn border border-white/40 p-1.5 text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
