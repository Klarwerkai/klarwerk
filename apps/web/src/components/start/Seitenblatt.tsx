import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useModalBoundaryOptional } from "../../app/ModalBoundaryContext";
import { focusFirstIn } from "../../lib/focusables";

// ================================================================================================
// JOB 3064 H5 — DAS SEITENBLATT: WO EIN MENÜPUNKT SEINEN INHALT ZEIGT.
// ================================================================================================
// Pages-Muster (canvas.json, Notiz „menues"): „Alles, was nicht ins Sichtfeld gehört, liegt in
// Untermenüs." Ein Menüpunkt ohne Wirkung wäre eine Scheinfunktion — deshalb hat JEDER Punkt ein
// Blatt, und `tests/design/h5-funktionsinventar.test.ts` klickt sie einzeln an.
//
// Breite 360 px wie im Auftrag (§5.5). Der Abfangknopf darunter schliesst beim Klick daneben —
// dasselbe Muster wie `HelpTip.tsx` und `OverflowMenu.tsx`, kein drittes Overlay-Verfahren.
//
// ================================================================================================
// JOB 3102 UX-06 (Befund N-0010) — DAS BLATT IST MIT DER TASTATUR BEDIENBAR.
// ================================================================================================
// GEMESSEN, nicht vermutet
// (`gespraech/nutzerpruefung/ergebnisse/2026-09-05T22-21-40+02-00-gegenpruefung-N-0010.json:4`,
// Chromium 149): „Direkt nach Öffnen lag der Fokus auf BODY. Tab 1 erreichte Kopieren, Tab 2 Hat
// geholfen, Tab 3 Klara öffnen in der Hauptfläche hinter der Überlagerung; erst Tab 4 erreichte
// Schließen im Panel … Escape ließ das Panel offen."
//
// Der Grund stand in dieser Datei: der Klickfänger nimmt der Fläche darunter die MAUS, nicht die
// TABULATORTASTE. Sichtbare Knöpfe blieben ansteuerbar und waren trotzdem tot — eine Bedienung,
// die es nur scheinbar gibt.
//
// ES WIRD KEINE ZWEITE MECHANIK GEBAUT. Angeschlossen ist die vorhandene Modalgrenze der Shell
// (`app/ModalBoundaryContext.tsx`), in derselben Reihenfolge wie `Modal.tsx:70-102`: Escape-Hörer,
// Auslöser aus `document.activeElement`, `enter()`, `focusFirstIn`. Warum keine eigene Fokus- oder
// Sperrlogik daneben, steht in `Modal.tsx:16-21`: eine zweite Mechanik ist keine Doppelung,
// sondern eine stille Ablösung der vorhandenen.
export function Seitenblatt({
  titel,
  testId,
  onSchliessen,
  ausloeser,
  children,
}: {
  titel: string;
  testId: string;
  onSchliessen: () => void;
  /**
   * KORREKTURPFLICHT 1 (Ben, Runde 1) — WER DEN FOKUS ZURÜCKBEKOMMT, WENN DER AUSLÖSER INZWISCHEN
   * EIN ANDERER IST.
   *
   * Gemessen: läuft beim Öffnen schon eine Auffrischung und trifft sie als Wissenslücke ein,
   * wechselt die Fragenfläche das Blatt von der Antwortkarte (`Ask.tsx:1246`) in den Lückenfall
   * (`Ask.tsx:1831`) — und mit ihm den „…"-Knopf. Der beim ersten Öffnen gemerkte Knopf ist dann
   * abgebaut; ein Fokus auf einen abgehängten Knoten ist ein Fokus auf `body`.
   *
   * Deshalb darf der Aufrufer den Auslöser BENENNEN statt ihn raten zu lassen (§5.4 des Auftrags).
   * Der Rückruf wird erst beim Schliessen gelesen und liefert damit den Knopf, der DANN dasteht.
   * ES IST GENAU EIN WEG JE AUFRUFER, nicht zwei nebeneinander: wer `ausloeser` gibt, für den gilt
   * ausschliesslich er; wer ihn weglässt (`Start.tsx`), für den gilt ausschliesslich der beim
   * Öffnen fokussierte Knoten. Die Weiche steht an genau einer Stelle, unten in `trigger`.
   */
  ausloeser?: () => HTMLElement | null;
  children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  // Die OPTIONALE Form der Grenze: dieses Blatt behauptet keine App-Modalität (kein `aria-modal`)
  // und wird auch ausserhalb der Shell gemountet (nackte Tests). „Keine Grenze vorhanden" ist dort
  // eine gültige Antwort, kein Defekt — `useModalBoundary` würde werfen
  // (`ModalBoundaryContext.tsx:76-84`, Begründung der Optional-Form ebenda `:86-96`).
  const grenze = useModalBoundaryOptional();
  // NUR die stabilen Teile der Grenze als Abhängigkeit. `enter` ist ein `useCallback` mit fester
  // Identität (`ModalBoundaryContext.tsx:140-179`); das Kontext-OBJEKT wechselt dagegen bei jedem
  // `locked`-Wechsel (`:183-186`) — den das eigene `enter()` gerade auslöst. Hinge der Effekt am
  // Objekt, liefe An- und Abmelden zweimal je Öffnung; genau diesen Fehler beschreibt
  // `Modal.tsx:108-111` („vier Fokusaufrufe statt einem").
  const anmelden = grenze?.enter;
  const blattRef = useRef<HTMLElement | null>(null);
  const gemerkterAusloeserRef = useRef<HTMLElement | null>(null);
  // Refs, damit der Effekt weder an `onSchliessen` noch an `ausloeser` hängt und keinen veralteten
  // Rückruf einfängt (Bauform `Modal.tsx:59-61`).
  const schliessenRef = useRef(onSchliessen);
  schliessenRef.current = onSchliessen;
  const ausloeserRef = useRef(ausloeser);
  ausloeserRef.current = ausloeser;

  // Das Blatt wird von seinen Aufrufern nur gerendert, wenn es offen ist (`Ask.tsx:1246`/`:1831`,
  // `Start.tsx`). „Offen" IST hier also die Montage — deshalb braucht dieser Effekt kein `open`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        schliessenRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    // OHNE `ausloeser`-Rückruf (`Start.tsx`): der Auslöser ist das, was beim Öffnen den Fokus trug.
    // `body` ist keiner (`Modal.tsx:83-87`): ein Rückgabeziel `body` wäre eine Fokusbewegung, die
    // niemand ausgelöst hat. Dass hier wirklich der „…"-Knopf steht und nicht der eben
    // verschwundene Menüpunkt, sorgt `OverflowMenu.tsx` selbst — es gibt den Fokus an seinen Griff
    // zurück, BEVOR `onWahl` wirkt.
    if (!ausloeserRef.current) {
      const aktiv = document.activeElement;
      gemerkterAusloeserRef.current =
        aktiv instanceof HTMLElement && aktiv !== document.body ? aktiv : null;
    }
    const abmelden = anmelden?.({
      panel: () => blattRef.current,
      // DIE EINE WEICHE (§5.4): benannter Auslöser ODER gemerkter, nie beides verrechnet. Gelesen
      // wird erst hier, beim Schliessen — deshalb trifft der benannte Weg auch dann, wenn der Knopf
      // inzwischen ein anderer ist.
      trigger: () => {
        const benannt = ausloeserRef.current;
        return benannt ? benannt() : gemerkterAusloeserRef.current;
      },
    });
    focusFirstIn(blattRef.current);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Erst abmelden — die Grenze entsperrt den Hintergrund und liest DANN `trigger()`, um den
      // Fokus zurückzugeben (`ModalBoundaryContext.tsx:170-176`).
      abmelden?.();
      gemerkterAusloeserRef.current = null;
    };
  }, [anmelden]);

  // KORREKTURPFLICHT 2 (Ben, Runde 3): das Blatt hängt je nach Lage TIEF im Baum — auf `/fragen`
  // innerhalb der Antwortkarte. `position: fixed` bezieht sich dann nicht mehr auf das Fenster,
  // sobald irgendein Vorfahr einen eigenen Enthaltungsblock aufspannt (`transform`, `filter`,
  // `contain`, `will-change`). Genau das war messbar: Breite und `fixed` stimmten, die rechte
  // Kante und die volle Höhe nicht (`rechtsBuendig: false`, `vollHoch: false`).
  // Ein Portal macht die Geometrie unabhängig davon, WO das Blatt gerufen wird — die Alternative
  // wäre, jedem Aufrufer zu verbieten, je einen Enthaltungsblock zu erzeugen.
  // `tests/design/zielbild-h5-fragen.test.ts` M2 misst die Kante seither.
  //
  // JOB 3102: der Anker ist jetzt der Anker DER GRENZE (`<main>`, `AppShell.tsx:102`/`:142`) und
  // nur ohne Grenze noch `document.body` — dieselbe Wahl wie `Modal.tsx:111`. Er MUSS es sein: der
  // Anker liegt ausserhalb aller gesperrten Bereiche (`ModalBoundaryContext.tsx:57-60`), und nur
  // dort steht das Blatt bedienbar, während der Rest `inert` ist. An der Geometrie ändert das
  // nichts — `<main>` spannt keinen Enthaltungsblock auf (`overflow` tut das nicht, nur
  // `transform`/`filter`/`contain`/`will-change`).
  // Gelesen wird er beim Rendern, nicht in einem Effekt (`Modal.tsx:108-111`): ein nachträglicher
  // Umzug baute den Teilbaum ab und wieder auf, und die ganze Mechanik liefe zweimal je Öffnung.
  const anker = grenze?.host() ?? document.body;
  return createPortal(
    <>
      <button
        type="button"
        aria-label={t("cmd.close")}
        tabIndex={-1}
        onClick={onSchliessen}
        // Bewusst OHNE Abdunklung: das Blatt ist eine Auskunft, kein Dialog. Es trägt kein
        // `aria-modal`, kein `role="dialog"`, verlangt keine Entscheidung — die Fläche darunter
        // bleibt LESBAR. Die Vollfläche ist ausschliesslich der Klickfänger zum Schliessen,
        // dieselbe Bauform wie in `HelpTip.tsx`.
        //
        // JOB 3102: was es seit UX-06 sehr wohl tut, und was hier bis dahin falsch stand — es HÄLT
        // DIE BEDIENUNG, solange es offen ist. Der Fokus geht beim Öffnen hinein, Escape führt
        // hinaus, und die angemeldeten Bereiche der Shell sind derweil `inert`. Ehrlich ist das,
        // weil es genau der Zustand ist, den der Klickfänger für die Maus ohnehin herstellt: es
        // wird keine Modalität behauptet, sondern eine bereits vorhandene endlich auch für die
        // Tastatur eingelöst. Im Sammler steht es deshalb weiterhin unter
        // NICHT_MODALE_VOLLFLAECHEN — mit dieser Begründung, nicht mehr mit „ohne Fokusfang"
        // (`tests/app/mega47-modale-flaechen-sammler.test.tsx:710`).
        className="fixed inset-0 z-40 cursor-default"
      />
      <aside
        ref={blattRef}
        // `tabIndex={-1}` ist das Rückfallziel von `focusFirstIn` (`lib/focusables.ts:21-25`),
        // falls im Blatt einmal nichts Bedienbares steht. Es macht das Blatt NICHT tabbar.
        tabIndex={-1}
        data-testid={testId}
        aria-label={titel}
        className="fixed right-0 top-0 z-50 flex h-full w-[360px] max-w-full flex-col border-l border-hairline bg-surface shadow-popover"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink">{titel}</h2>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={t("cmd.close")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted-2 hover:bg-hairline-soft hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </>,
    anker,
  );
}
