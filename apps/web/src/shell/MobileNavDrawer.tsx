import { X } from "lucide-react";
import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useModalBoundary } from "../app/ModalBoundaryContext";
import { focusFirstIn, focusablesIn } from "../lib/focusables";
import { DrawerMenue } from "./DrawerMenue";

// ================================================================================================
// JOB 1103 — DIE ANSAGETEXTE.
// ================================================================================================
//
// Sie stehen hier und nicht in `i18n.ts`, weil diese Datei fuer JOB 1103 nicht im Schreibscope
// liegt; passende Schluessel existieren nicht (geprueft: `topbar.*` traegt `openMenu`, `closeMenu`
// und `menuLabel`, aber keine Zustandsansage). Der GEGENSTAND kommt trotzdem uebersetzt — er wird
// unten aus `t("topbar.menuLabel")` zusammengesetzt; nur das Zustandswort ist deutschfest. Die
// Rueckgabe weist das als offenen Rest aus.
//
// WARUM DER GEGENSTAND IM TEXT STEHT: „Geoeffnet" allein ist fuer jemanden, der die Seite nicht
// sieht, nicht zuordenbar — auf einer Seite koennen mehrere Flaechen aufgehen. Die Ansage nennt
// deshalb, WAS sich geoeffnet hat.
const ZUSTAND_GEOEFFNET = "geöffnet";
const ZUSTAND_GESCHLOSSEN = "geschlossen";

/** Der angesagte Satz. Exportiert, damit der Test die ZUSAMMENSETZUNG prüft und nicht eine Kopie. */
export function menueAnsage(menuename: string, offen: boolean): string {
  return `${menuename} ${offen ? ZUSTAND_GEOEFFNET : ZUSTAND_GESCHLOSSEN}`;
}

// E2E-017 (bens Sammel-Review 2, Block F): der Off-Canvas-Navigations-Drawer ist ein ECHTES modales
// Panel — Dialogsemantik + aria-modal, initialer Fokus beim Öffnen, Escape schließt, eine Fokusfalle
// hält Tab im Panel, der Hintergrund ist währenddessen nicht fokussierbar (inert), und beim Schließen
// kehrt der Fokus auf den auslösenden Hamburger zurück. Das bisherige Maus-Verhalten (Hamburger,
// Backdrop-Klick, X) bleibt unverändert. Das Desktop-Layout (>899px) rendert diesen Drawer nie.
//
// AUFTRAG-mega48 Block A: den Hintergrund bekommt der Drawer NICHT mehr als Prop gereicht — er holt
// sich die Modalgrenze der Shell (`useModalBoundary`), dieselbe, an der auch das Filterblatt hängt.
// Damit können sich die beiden ihr `inert` nicht mehr gegenseitig wegnehmen.
export function MobileNavDrawer({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  // Auslöser (Hamburger) — Fokus kehrt beim Schließen genau hierher zurück.
  triggerRef: RefObject<HTMLButtonElement | null>;
}): JSX.Element | null {
  const { t } = useTranslation();
  const { enter } = useModalBoundary();
  const panelRef = useRef<HTMLDialogElement | null>(null);
  // ==============================================================================================
  // JOB 1103 — DER ANSAGEKANAL (JOB 908, Lücke L4 / Folgevertrag F3).
  // ==============================================================================================
  //
  // Bis hierher meldete der Drawer sein Öffnen und Schließen NUR über Dialogsemantik und Fokus
  // (`aria-modal` + `.focus()`) — im A18-Register als `kanalart: "nicht-live"` verzeichnet. Beides
  // beschreibt einen ZUSTAND, keines meldet ein EREIGNIS.
  //
  // DIE ANSAGE STARTET LEER, und das ist keine Nachlässigkeit: Stünde der Text schon beim ersten
  // Rendern da, sagte jeder Seitenaufruf „Navigationsmenü geschlossen" an — eine Ansage für ein
  // Ereignis, das nie stattgefunden hat. Gefüllt wird erst bei einem echten Wechsel.
  const [ansage, setAnsage] = useState("");
  // Der zuletzt angesagte Zustand, mit dem Montagezustand als Startwert. Damit ist die Montage
  // selbst nie ein Ereignis — angesagt wird ausschließlich ein WECHSEL.
  const zuletztAngesagt = useRef<boolean>(open);
  useEffect(() => {
    if (zuletztAngesagt.current === open) {
      return;
    }
    zuletztAngesagt.current = open;
    setAnsage(menueAnsage(t("topbar.menuLabel"), open));
  }, [open, t]);

  // Öffnen: Hintergrund gesperrt, Fokus ins Panel. Schließen (Cleanup): die Abmeldung gibt den
  // Hintergrund frei und den Fokus zurück — erst das eine, dann das andere, sonst liefe der Restore
  // ins inerte (nicht fokussierbare) Element. Ist noch eine Fläche offen, bleibt die Sperre stehen
  // und der Fokus kehrt dorthin zurück statt auf den Hamburger; das entscheidet die Grenze.
  useEffect(() => {
    if (!open) {
      return;
    }
    const release = enter({
      panel: () => panelRef.current,
      trigger: () => triggerRef.current,
    });
    focusFirstIn(panelRef.current);
    return release;
  }, [open, triggerRef, enter]);

  // ==============================================================================================
  // JOB 1103 — WARUM DIE REGION AUSSERHALB VON `if (!open) return null` LEBT.
  // ==============================================================================================
  //
  // Das ist der eigentliche Bau dieses Auftrags, und er ist keine Stilfrage. Eine Ansage entsteht
  // aus einer ÄNDERUNG in einer VORHANDENEN Live-Region — nicht daraus, dass die Region
  // verschwindet. Läge sie im Panel, wäre sie beim Schließen im selben Moment aus dem Baum wie der
  // Text, den sie tragen soll: das Öffnen wäre meldbar, das Schließen nie.
  //
  // Sie liegt zugleich AUSSERHALB des `<dialog>`, und damit ist der Kanal von der Dialogrolle
  // getrennt — genau die Trennung, die dieser Auftrag verlangt. `aria-modal` sagt „hier ist ein
  // modaler Bereich"; die Region sagt „gerade ist etwas passiert". Zwei Aussagen, zwei Träger.
  //
  // DER TRÄGER IST EIN `<output>`, kein `<div role="status">`. Das ist die Bauform, die dieses
  // Projekt für Live-Regionen bereits führt — der A18-Registertest hält sie als eigenen Fall fest
  // (B1: „der Träger ist ein `<output>` — der Kanal, den ein aria-live-Raster übersieht"). Ein
  // `<output>` trägt die Statusrolle nativ; sie hängt damit nicht an einem Attribut, das ein
  // späterer Umbau unbemerkt entfernen könnte.
  //
  // `aria-live="polite"` steht trotzdem ausdrücklich da: es sagt die Höflichkeitsstufe, statt sie
  // der Rollenableitung zu überlassen. `aria-atomic="true"` lässt die Region als GANZES vortragen
  // statt nur den geänderten Teilknoten.
  const ansagebereich = (
    <output
      data-testid="drawer-live-status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {ansage}
    </output>
  );

  if (!open) {
    return ansagebereich;
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") {
      return;
    }
    // ============================================================================================
    // AUFTRAG-smoketor BLOCK B (Registerpunkt A20) — DIE FALLE, DIE NUR AN DEN RÄNDERN ZUGRIFF.
    // ============================================================================================
    //
    // GEMESSEN, nicht gelesen (`_relay/messung/smoketor-B-rot-webkit.log`, WebKit, 390×844 und
    // 768×1024): der Fokus startet korrekt auf „Menü schließen" {im Dialog}, und schon Tab 1 landet
    // auf `body` — 25× von 25 außerhalb. Kein anderes Element, sondern GAR KEINES.
    //
    // DIE URSACHE: WebKit nimmt Links und Knöpfe standardmäßig nicht in die Tab-Reihenfolge auf
    // (macOS-Voreinstellung „Tab bewegt den Fokus nur zwischen Textfeldern und Listen"). Von den 23
    // fokussierbaren Elementen, die `focusablesIn` im Panel findet, ist dort genau EINES nativ
    // tabbar. Die alte Falle griff aber nur an den RÄNDERN — sie verlangte `active === last` bzw.
    // `=== first`. Der X-Knopf ist `first`, also passierte beim ersten Tab nichts, WebKit fand im
    // Panel kein nächstes tabbares Element, der Hintergrund war inert, und der Fokus fiel auf
    // `body`. Ab da liegt er AUSSERHALB des Dialogs, dieser Handler hängt am `<dialog>` und feuert
    // nie wieder: es gibt kein Zurück. In Chromium blieb das unsichtbar, weil dort jeder Link und
    // Knopf nativ tabbar ist und die Ränder deshalb überhaupt erreicht wurden.
    //
    // DAS IST KEIN TESTARTEFAKT. Dieselbe Voreinstellung ist in echtem Safari die Werkseinstellung
    // — das Menü war dort per Tastatur unbedienbar. Der Smoke hat einen echten Barrierefreiheits-
    // defekt gefunden, keinen Messfehler.
    //
    // DIE REPARATUR pinnt das VERHALTEN und nicht ein Attribut: die Falle verlässt sich nicht mehr
    // darauf, dass der Browser innerhalb des Panels weitertabbt, sondern setzt den nächsten Fokus
    // bei JEDEM Tab selbst. Damit ist die Reihenfolge in allen Engines dieselbe und der Fokus kann
    // das Panel gar nicht erst verlassen. In Chromium ist das verhaltensgleich zu vorher: die Liste
    // steht in DOM-Reihenfolge und es gibt im Baum keinen positiven `tabIndex` (geprüft), also
    // genau die Reihenfolge, die der Browser ohnehin genommen hätte.
    //
    // EHRLICHE GRENZE: `focusablesIn` filtert bewusst nicht auf Sichtbarkeit (jsdom rechnet kein
    // Layout). Ein unsichtbares, aber fokussierbares Element im Panel würde jetzt angesteuert, wo
    // der Browser es übersprungen hätte. Im Drawer gibt es keines (23 gemessene Stationen, alle
    // sichtbar); für den Fall, dass sich das ändert, ist die Sonde die Wache.
    const focusables = focusablesIn(panelRef.current);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    const stelle = active ? focusables.indexOf(active) : -1;
    // Fokus (noch) nicht auf einer Station — z. B. auf dem Panel selbst (`tabIndex={-1}`): vorwärts
    // an den Anfang, rückwärts ans Ende.
    const ziel =
      stelle === -1
        ? e.shiftKey
          ? focusables.length - 1
          : 0
        : (stelle + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
    focusables[ziel]?.focus();
  };

  return (
    <>
      {ansagebereich}
      <div className="fixed inset-0 z-40 flex">
        {/* AUFTRAG-mega4 Block C (bens Sammel-Review 4): der Backdrop ist eine NICHT fokussierbare, rein
          präsentierende Fläche (aria-hidden, kein Button, kein Tab-Stop) — er liegt bewusst außerhalb des
          inerten Hintergrunds UND außerhalb des Dialogs, darf aber deshalb keine erreichbare Nicht-Drawer-
          Fläche sein. Vorher war er ein <button> und damit programmatisch/assistiv fokussierbar (bens
          Blocker). Die zugängliche Schließen-Aktion bleibt der X-Knopf im Dialog + Escape; der Backdrop-
          Klick bleibt reine Maus-Bequemlichkeit. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Tastatur-Schließen läuft über Escape/X im Dialog, nicht über diese aria-hidden Fläche. */}
        <div
          aria-hidden="true"
          data-testid="drawer-backdrop"
          onClick={onClose}
          className="absolute inset-0 bg-ink/40"
        />
        {/* Natives <dialog> (implizite Dialog-Rolle) als Off-Canvas-Panel. Bewusst OHNE showModal() —
          der Drawer verwaltet Fokus/Inert/Escape selbst und behält so das bestehende Backdrop-/
          Slide-in-Verhalten; `open` hält es sichtbar, die Positionierung kommt aus den Klassen. */}
        <dialog
          ref={panelRef}
          open
          aria-modal="true"
          aria-label={t("topbar.menuLabel")}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="relative z-10 m-0 h-full w-[252px] max-w-[85vw] bg-transparent p-0 text-text shadow-popover outline-none"
        >
          <button
            type="button"
            aria-label={t("topbar.closeMenu")}
            onClick={onClose}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
          >
            <X size={18} />
          </button>
          {/* JOB 3060 · H1: statt der Seitenleiste die Bausteine des Kopfbands und seiner Menüs. */}
          <DrawerMenue onClose={onClose} />
        </dialog>
      </div>
    </>
  );
}
