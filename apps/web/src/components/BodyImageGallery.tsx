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
// AUFTRAG-mega69 Block A: `onEditCaption` — der Weg vom betrachteten Bild zur Bildbeschreibung.
// Pedis Befund: das Formular (mega9 Block F) existierte, war aber nur über einen Klick auf das Bild
// IM FLIESSTEXT erreichbar; die Galerie, die das Bild samt (leerer) Fußnote prominent zeigt, bot
// keinen Weg dorthin. Die Galerie bleibt Leseansicht — der Callback führt zum EINEN bestehenden
// Formular des Editors (kein zweites Formular, kein zweiter describe-Aufruf). Fehlt er (reine
// Leseansicht ohne Editierrecht), erscheint kein Knopf.
export function BodyImageGallery({
  bodyHtml,
  onEditCaption,
}: {
  bodyHtml: string;
  onEditCaption?: ((imageId: string) => void) | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const images: BodyImage[] = extractBodyImages(bodyHtml);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // JOB 1117 (schließt JOB-908-M3): der ANSAGETEXT der Fläche. Ein Zustand, eine Quelle — Öffnen,
  // Bildwechsel und Schließen schreiben hier hinein, die beiden Live-Bereiche unten lesen nur.
  const [ansage, setAnsage] = useState<string>("");
  // Der zuletzt ANGESAGTE Zustand: unterscheidet „gerade geöffnet" von „im offenen Dialog gewechselt"
  // und verhindert, dass ein bloßes Neurendern (extractBodyImages liefert je Render ein neues Feld)
  // dieselbe Lage ein zweites Mal meldet.
  const angesagterIndexRef = useRef<number | null>(null);
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

  // WP-D11b (bens GELB d): schrumpft die Bildliste bei OFFENER Lightbox (z. B. Body-Änderung),
  // wird openIndex auf das letzte Bild geklemmt; wird die Liste LEER, schließt der Dialog
  // kontrolliert über die native close()-API (→ onDialogClose → Fokus-Rückgabe) — nie ein stummes
  // Unmount eines offenen Modals. Damit das möglich ist, bleibt der Dialog unten auch dann
  // gerendert, solange openIndex gesetzt ist (siehe Render-Bedingungen).
  useEffect(() => {
    if (openIndex === null) {
      return;
    }
    if (images.length === 0) {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
      } else {
        // Dialog (noch) nicht offen → Zustand direkt aufräumen, Fokus-Rückgabe versuchen.
        setOpenIndex(null);
        triggerRef.current?.focus();
      }
      return;
    }
    if (openIndex > images.length - 1) {
      setOpenIndex(images.length - 1);
    }
  }, [openIndex, images.length]);

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

  // JOB 1117 (JOB-908-M3 als DOM-EREIGNISVERTRAG) — DIE GALERIE WAR STUMM.
  //
  // DER BEFUND (PRO4 JOB-908-D1, L4, am Produkt nachgemessen): „Keine der vier Modalflächen trägt
  // einen Ansagebereich … Öffnen, Schliessen, Filterergebnis, Bildwechsel in der Galerie — nichts
  // davon wird angesagt." Sehend ist die Lage am Zähler „Bild 2 von 3" ablesbar; ohne Sicht gab es
  // schlicht nichts, was den Wechsel mitteilt.
  //
  // DIE ANTWORT: EIN Ereignisvertrag statt vier Meldestellen. Jeder Weg, der die Großansicht
  // bewegt — Thumbnail-Klick, Vor/Zurück-Knopf, Pfeiltaste, das Klemmen bei geschrumpfter Liste,
  // X-Knopf, Escape/cancel, programmatisches close() — endet in EINEM Zustandswechsel von
  // `openIndex`. Genau der wird hier einmal in Text übersetzt. Deshalb kann kein Pfad die Ansage
  // vergessen und keiner sie doppelt absetzen.
  //
  // DIE TEXTE STAMMEN AUSSCHLIESSLICH AUS BESTEHENDEN i18n-SCHLÜSSELN (ko.gallery, ko.galleryCount,
  // ko.galleryClose) — dieser Auftrag darf `i18n.ts` nicht schreiben. Die Form ist bewusst
  // gleichförmig: „<Fläche>: <Lage>" beim Betreten und Verlassen, die nackte Lage beim Wechsel
  // im schon betretenen Dialog.
  //
  // ERFUNDEN WIRD NICHTS: die Beschreibung wird angehängt, WENN es sie wirklich gibt. Ein Bild ohne
  // Fußnote (und ein WP-D10-Altlastplatzhalter zählt als ohne, das entscheidet extractBodyImages)
  // meldet nur seine Lage — nie die Kennung, nie die Quelle, nie einen Ersatztext.
  useEffect(() => {
    const vorher = angesagterIndexRef.current;
    if (vorher === openIndex) {
      return; // kein Zustandswechsel — nur ein Neurendern
    }
    angesagterIndexRef.current = openIndex;
    if (openIndex === null) {
      if (vorher !== null) {
        setAnsage(`${t("ko.gallery")}: ${t("ko.galleryClose")}`);
      }
      return;
    }
    // Dieselbe defensive Klemmung wie in der Anzeige (GELB d) — die Meldung nennt, was zu sehen ist.
    const idx = Math.min(openIndex, Math.max(0, images.length - 1));
    const bild = images[idx];
    if (bild === undefined) {
      return; // leere Liste im Schließ-Takt: die Schließen-Meldung folgt beim Zustandswechsel
    }
    const lage = t("ko.galleryCount", { n: idx + 1, m: images.length });
    const beschreibung = bild.caption.trim();
    const kern = beschreibung ? `${lage} — ${beschreibung}` : lage;
    setAnsage(vorher === null ? `${t("ko.gallery")}: ${kern}` : kern);
  }, [openIndex, images, t]);

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

  // Kein leerer Abschnitt: ohne verankerte Bilder erscheint die Galerie gar nicht — AUSSER die
  // Lightbox ist gerade noch offen (GELB d): dann bleibt der Dialog einen Takt gerendert, damit
  // der Effekt oben ihn kontrolliert schließen kann (kein stummes Unmount des offenen Modals).
  if (images.length === 0 && openIndex === null) {
    return null;
  }
  // GELB d: Anzeige-Index defensiv klemmen — der Effekt zieht den State nach; bis dahin zeigt der
  // offene Dialog das letzte verbliebene Bild statt ins Leere zu greifen.
  const shownIndex =
    openIndex === null ? null : Math.min(openIndex, Math.max(0, images.length - 1));
  const open = shownIndex !== null ? images[shownIndex] : undefined;

  return (
    <div className="mt-3 border-t border-hairline pt-2">
      <SectionLabel>{t("ko.gallery")}</SectionLabel>
      {/* JOB 1117: der Ansagebereich für den GESCHLOSSENEN Zustand. Er steht AUSSERHALB des Dialogs
          und ist von Anfang an da — ein Live-Bereich, der erst zusammen mit seinem Text eingefügt
          wird, wird von Sprachausgaben typischerweise überhört. Solange die Großansicht offen ist,
          bleibt er leer: der modale Bereich unten spricht dann, und nur einer darf sprechen (die
          Inhalte ausserhalb eines echten Modals sind für die Sprachausgabe ohnehin unerreichbar). */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {openIndex === null ? ansage : ""}
      </p>
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

      {openIndex !== null ? (
        // Lightbox-Großansicht als ECHTES Modal (showModal → Top-Layer + native Fokusfalle); Escape läuft
        // über onCancel→close nativ, X über requestClose — beide münden in onDialogClose (kein alert/confirm).
        // GELB d: gerendert, solange openIndex gesetzt ist — auch im Leerlauf-Takt einer leeren Bildliste,
        // damit der Effekt oben kontrolliert schließen kann; der Inhalt ist dann über `open` geguardet.
        <dialog
          ref={dialogRef}
          onCancel={requestClose}
          onClose={onDialogClose}
          aria-label={t("ko.gallery")}
          className="fixed inset-0 z-50 flex h-full w-full flex-col items-center justify-center bg-ink/80 p-4"
        >
          {/* JOB 1117: der Ansagebereich INNERHALB des Modals — nur er ist erreichbar, solange
              showModal() den Rest der Seite inert macht. Er wird leer eingesetzt und erst im Effekt
              oben gefüllt; damit ist die Änderung eines bestehenden Bereichs das Ereignis. */}
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {ansage}
          </p>
          <div className="flex w-full max-w-3xl items-center justify-between gap-2 pb-2">
            <span className="font-mono text-[12px] font-semibold text-white">
              {shownIndex !== null && images.length > 0
                ? t("ko.galleryCount", { n: shownIndex + 1, m: images.length })
                : null}
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
          {open !== undefined && shownIndex !== null ? (
            <div className="flex w-full max-w-3xl items-center gap-2">
              <button
                ref={prevBtnRef}
                type="button"
                aria-label={t("ko.galleryPrev")}
                disabled={shownIndex === 0}
                onClick={() => setOpenIndex(shownIndex - 1)}
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
                {/* AUFTRAG-mega69 Block A: die sichtbare Aktion AM BILD, die zum bestehenden
                    Bildbeschreibungs-Formular führt. Schließt die Großansicht (der Fokus kehrt
                    über onDialogClose zurück) und meldet die Bild-Kennung an den Aufrufer. */}
                {onEditCaption ? (
                  <p className="mt-2 text-center">
                    <button
                      type="button"
                      data-testid="gallery-caption-edit"
                      onClick={() => {
                        const imageId = open.id;
                        requestClose();
                        onEditCaption(imageId);
                      }}
                      className="inline-flex items-center gap-1 rounded-btn border border-white/40 px-2 py-1 text-[12px] font-semibold text-white hover:bg-white/10"
                    >
                      {t("ko.galleryEditCaption")}
                    </button>
                  </p>
                ) : null}
              </div>
              <button
                ref={nextBtnRef}
                type="button"
                aria-label={t("ko.galleryNext")}
                disabled={shownIndex === images.length - 1}
                onClick={() => setOpenIndex(shownIndex + 1)}
                className="rounded-btn border border-white/40 p-1.5 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}
        </dialog>
      ) : null}
    </div>
  );
}
