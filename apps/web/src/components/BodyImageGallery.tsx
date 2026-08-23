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
// ================================================================================================
// D44 Teil 2, Weg (a) (JOB 1831 D4) — DER KLICK AUS DEM EDITOR ÖFFNET DIESE GROSSANSICHT.
// ================================================================================================
//
// Entschieden am 21.08. (`ENTSCHEIDUNGEN/JOB-1620.md`): Ein Klick auf ein Bild im Editor zeigt es
// gross — und zwar HIER, in der vorhandenen, ben-abgenommenen Grossansicht. Kein zweiter Weg, kein
// Attribut am `<img>`, keine neue Persistenz.
//
// DER VERTRAG IST EIN DOM-EREIGNIS, und das hat einen gemessenen Grund: Editor und Galerie sind in
// `Capture.tsx` (:5416/:5427, :5641/:5669) und `CaptureFrontDoor.tsx` (:888/:903) GESCHWISTER. Sie
// kennen einander nicht; ihre einzige Verbindung ist der gemeinsame Elternteil. Das Ereignis steigt
// vom Editor genau bis dorthin auf, und die Galerie holt es an ihrem EIGENEN Elternknoten ab —
// deshalb trifft ein Klick im ersten Editorpaar nie die Galerie des zweiten.
export const D44_BILD_EREIGNIS = "kw:d44-bild-oeffnen";

/** Was der Editor meldet. `nonce` folgt `captionFormRequest` (RichTextEditor.tsx:298). */
export interface D44BildEreignis {
  readonly imageId: string;
  readonly nonce: number;
}

export function BodyImageGallery({
  bodyHtml,
  onEditCaption,
}: {
  bodyHtml: string;
  // JOB 2084 (I50-3): die Bitte trägt die OCCURRENCE, nicht nur die Kennung. `src` und `index`
  // stammen aus genau dem Eintrag, den der Nutzer geöffnet hat — beide liegen hier ohnehin vor, es
  // wird nichts neu abgeleitet. Warum beide: `index` allein bricht, sobald das Verankern die Zahl
  // der zählbaren Bilder ändert (ein nacktes <img> zählt für die Galerie nicht und wird im Editor
  // eingehüllt); `src` allein bricht, wenn dasselbe Bild zweimal im Körper steht. Zusammen tragen
  // sie: `index` wählt, `src` bestätigt (die Auflösung steht in RichTextEditor.tsx).
  onEditCaption?: ((imageId: string, src: string, index: number) => void) | undefined;
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
  // D44 Teil 2: der eigene Wurzelknoten — an SEINEM Elternteil wird das Editor-Ereignis abgeholt.
  const wurzelRef = useRef<HTMLDivElement | null>(null);
  // D44 Teil 2: WOHER die aktuell offene Ansicht kam. Wird bei jedem Öffnen gesetzt und beim
  // Schliessen zurückgesetzt — eine blosse `triggerRef === null`-Prüfung genügt NICHT: nach einem
  // früheren Thumbnail-Klick bliebe die alte Referenz stehen, und der Fokus spränge vom Editorbild
  // zurück in die Galerie (BEN-PRUEFUNG-JOB-1831-D2, Z.10).
  const herkunftRef = useRef<"thumbnail" | "editor" | null>(null);
  // D44 Teil 2: das Editorbild, das geöffnet hat — Ziel der Fokusrückkehr.
  const editorBildRef = useRef<HTMLElement | null>(null);
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

  // D44 Teil 2, Weg (a): das Editor-Ereignis am EIGENEN Elternknoten abholen.
  //
  // Nicht an `document`: Stehen zwei Editor-Galerie-Paare im Baum (Capture.tsx hat zwei), träfe ein
  // globaler Zuhörer beide, und ein Klick im ersten Editor öffnete die zweite Galerie. Der
  // Elternknoten ist die kleinste Fläche, die Editor UND Galerie gemeinsam haben.
  //
  // Zusätzlich wird gegen die eigene Bildliste geprüft: Was diese Galerie nicht kennt, öffnet sie
  // nicht (fail-closed) — eine leere Grossansicht wäre schlimmer als keine.
  useEffect(() => {
    const eltern = wurzelRef.current?.parentElement;
    if (!eltern) {
      return;
    }
    const beiKlick = (e: Event): void => {
      const detail = (e as CustomEvent<D44BildEreignis>).detail;
      if (!detail?.imageId) {
        return;
      }
      const idx = images.findIndex((b) => b.id === detail.imageId);
      if (idx < 0) {
        return;
      }
      // Das auslösende Bild merken und für die Rückkehr fokussierbar machen. `tabindex` überlebt
      // das Speichern NICHT: jeder Weg ins bodyHtml läuft durch `sanitizeHtml` (RichTextEditor
      // `emit()`), und `services/structure/src/sanitize.ts:70` erlaubt am `<img>` genau vier
      // Attribute. Der Sanitizer ist die Zusicherung, nicht dieser Kommentar.
      const bild = e.target instanceof HTMLElement ? e.target.closest("img") : null;
      if (bild instanceof HTMLElement) {
        bild.setAttribute("tabindex", "-1");
        editorBildRef.current = bild;
      }
      triggerRef.current = null; // die alte Thumbnail-Referenz gilt für DIESES Öffnen nicht
      herkunftRef.current = "editor";
      setOpenIndex(idx);
    };
    eltern.addEventListener(D44_BILD_EREIGNIS, beiKlick);
    return () => eltern.removeEventListener(D44_BILD_EREIGNIS, beiKlick);
  }, [images]);

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
    // D44 Teil 2: die Rückkehr folgt der HERKUNFT dieses Öffnens, nicht einem Altzustand. Die
    // Rücksetzung unten ist der Kern — ohne sie wäre `herkunftRef` derselbe Altlastwert wie zuvor
    // `triggerRef`, nur mit besserem Namen.
    const woher = herkunftRef.current;
    herkunftRef.current = null;
    if (woher === "editor") {
      const bild = editorBildRef.current;
      editorBildRef.current = null;
      bild?.focus();
      // Das Hilfsattribut wieder abräumen: der Editor-DOM soll aussehen wie vorher. Der Sanitizer
      // hätte es ohnehin verworfen — sauber ist beides.
      bild?.removeAttribute("tabindex");
      return;
    }
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
    <div ref={wurzelRef} className="mt-3 border-t border-hairline pt-2">
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
            // JOB 2084 (I50-3): der Key trägt die POSITION mit. Bei doppelter `data-image-id`
            // bekämen sonst zwei Kacheln denselben React-Key; React darf solche Elemente
            // zusammenlegen, wiederverwenden und beim Neuordnen vertauschen — und meldet das nur
            // als Warnung. Die Occurrence-Treue von `setOpenIndex(i)` stünde dann auf einem Key,
            // der sie nicht trägt.
            key={`${img.id}#${i}`}
            type="button"
            aria-label={t("ko.galleryOpen", { n: i + 1 })}
            title={img.caption || t("ko.galleryOpen", { n: i + 1 })}
            className="group overflow-hidden rounded-card border border-hairline bg-page hover:border-ai/50"
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              // D44 Teil 2: dieses Öffnen kam vom Thumbnail — die Rückkehr geht dorthin.
              herkunftRef.current = "thumbnail";
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
                        // JOB 2084 (I50-3): ALLE DREI Werte VOR `requestClose()` lesen — danach ist
                        // `openIndex` null und `shownIndex` damit hinfällig. `shownIndex` ist die
                        // Position, die der Nutzer wirklich geöffnet hat (`setOpenIndex(i)` an der
                        // Kachel bzw. der occurrence-treue Weg des Körperklicks); sie ist die
                        // Identität, die eine doppelte Kennung nicht mehr hergibt.
                        const imageId = open.id;
                        const src = open.src;
                        const index = shownIndex;
                        requestClose();
                        onEditCaption(imageId, src, index);
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
