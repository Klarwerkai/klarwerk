import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLibrarySearch } from "../api/hooks";
import { GrenzDialog, useModalBoundaryOptional, useModalLocked } from "../app/ModalBoundaryContext";
import { useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import {
  type Direktziel,
  direktzugangZiele,
  trefferFuer,
  trefferNachGruppen,
} from "../app/navigationGliederung";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";

// Command Palette (FE-FND-03): ⌘K / Strg+K öffnet eine Schnellnavigation über
// alle für die Rolle sichtbaren Ziele. Pfeiltasten + Enter, Esc schließt.
//
// ================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — AUS DER FLACHEN LISTE WIRD „GEHE ZU …".
// ================================================================================================
//
// Codex' Livebefund an 1.0.0-beta.1.198 (`ADMIN-NAVIGATION-AUFTRAG.md`): „Quick navigation zeigt 21
// Einträge ohne Zwischenüberschriften … Admin-Unterziele wie KI-Zugänge, Demodaten und Papierkorb
// fehlen tatsächlich als direkte Einträge dieser Liste. Der Suchkasten trägt im gelesenen Code nur
// einen Platzhalter, keine eigene zugängliche Beschriftung."
//
// SECHS ÄNDERUNGEN, und keine mehr:
//   1  Die Ziele kommen aus `app/navigationGliederung.ts` — derselben Quelle wie das Menü. Damit
//      sind die 17 Verwaltungsziele echte Ziele und nicht länger Zustände hinter EINER Route.
//   2  Sie stehen unter den vier Obergruppen, nicht mehr in einer flachen Reihe.
//   3  Über der Liste steht, wie viele Ziele gerade dastehen; das Feld hat einen eigenen Namen.
//   4  Die Tastenmarkierung wandert MIT DER LISTE (`scrollIntoView`): bis hierher konnte der aktive
//      Treffer unter den Rand der 320-px-Liste laufen und man tippte blind (Vorlage, Punkt 7).
//   5  DIE ZEILE TRÄGT NAME UND ZIELKONTEXT (Runde 2, Codex-Befund 2). Bis hierher stand rechts die
//      rohe Route und sonst nichts — „flache Liste, technische Pfade". Jetzt steht unter dem Namen
//      in Worten, WO das Ziel wohnt („Qualität", „Verwaltung › Vorführdaten"); die Route bleibt als
//      kleine Zusatzangabe für die, die sie kennen, und nur dort, wo es wirklich eine gibt.
//   6  ESCAPE GIBT DEN FOKUS ZURÜCK (Runde 2, Codex-Befund 1). Vorher schloss Escape die Fläche und
//      der Fokus fiel auf `<body>` — wer mit der Tastatur arbeitet, stand danach nirgends.
//
// FE-002 (Pedi, 26.09.2026) — ZWEI WEITERE SCHRITTE, und wieder keine neue Palette:
//   7  KEINE ROUTE MEHR IN DER ZEILE. Pedis Befund: „‚Gehe zu …' öffnet … eine Auswahl mit 46 Zielen
//      und technischen Pfaden wie `/validierung`." Die Zeile trägt jetzt nur Name und Gruppe/Ort;
//      der Pfad bleibt als Marke am Knopf (`data-cmd-pfad`) für Messungen, gesehen wird er nicht.
//      Gesucht wird unverändert über alle Namen desselben Ziels (`trefferFuer`).
//   8  DAS FELD HEISST „SEITE FINDEN" — sichtbar im Platzhalter und als Name —, und eine Zeile
//      darunter sagt, dass Inhalte über „Wissen suchen" gefunden werden. So sind die beiden Suchen
//      auch HIER auseinanderzuhalten, nicht nur im Kopfband.
//
// R-0893 / R-1669 (aufnahme:20260922:gesamt-schnellwahl) — DIREKT ZUM WISSENSOBJEKT:
//   9  Ab zwei getippten Zeichen fragt die Palette zusätzlich die vorhandene Bibliothekssuche
//      (`useLibrarySearch`, `GET /api/library/search`) und zeigt bis zu fünf Wissenseinträge unter
//      einer eigenen Überschrift „Wissen" — nach den Seiten, damit Enter auf einen Seitennamen
//      unverändert die Seite öffnet. Ein Eintrag führt direkt nach `/wissen/:id`; die letzte
//      Zeile der Gruppe ist die Schnellaktion „Alle Treffer … in der Bibliothek".
//      ROLLENGEFILTERT an zwei Stellen, keine davon neu: gefragt wird nur, wenn die Bibliothek
//      unter den Zielen DIESER Rolle steht (dieselbe `canSee`-Liste), und was zurückkommt, hat der
//      Server bereits nach `sichtbareFuer`/`sqlSichtbarkeitFuer` beschnitten (library-routes.ts).
//      Gezeigt wird nur eine Antwort auf GENAU die aktuelle Eingabe — eine verspätete Antwort auf
//      einen älteren Begriff kann weder dastehen noch per Enter geöffnet werden.
//
// WAS SICH AUSDRÜCKLICH NICHT ÄNDERT: ⌘K/Strg+K, Escape, die Modalgrenze, und `canSee` als die EINE
// Sichtbarkeitsregel. Mehr Ziele heißt nicht mehr Rechte — die Verwaltungsziele hängen sämtlich
// daran, dass die Rolle `/admin` überhaupt sieht (`direktzugangZiele`).
/**
 * Nutzlast von `open-command-palette`. `nachModalgrenze`: der Auslöser schließt im selben Zug eine
 * modale Fläche (Drawer) — die Palette öffnet, sobald die Grenze frei ist, statt abzuweisen.
 * `rueckweg`: wohin der Fokus beim Schließen der Palette geht, wenn der Auslöser selbst dann nicht
 * mehr steht (die Drawer-Zeile) — der Auslöser der geschlossenen Fläche („Menü").
 */
export interface PaletteAnfrage {
  nachModalgrenze?: boolean;
  rueckweg?: (() => HTMLElement | null) | undefined;
}

/** Eine Öffnungsanfrage, die auf die Freigabe der Modalgrenze wartet. */
interface Vormerkung {
  seit: number;
  rueckweg: (() => HTMLElement | null) | undefined;
}

/** Wie lange eine vorgemerkte Öffnung auf die Freigabe der Grenze wartet. */
const VORMERKUNG_MS = 2000;

/** Ab so vielen Zeichen fragt die Palette zusätzlich die Wissenssuche (R-0893). */
export const WISSEN_AB_ZEICHEN = 2;
/** So viele Wissenseinträge zeigt die Palette höchstens — alle weiteren stehen in der Bibliothek. */
export const WISSEN_HOECHSTENS = 5;

/** Was eine Zeile der Palette braucht — ein Seitenziel ebenso wie ein Wissenseintrag. */
type Zeilenziel = Pick<Direktziel, "id" | "label" | "path" | "kontext">;

export function CommandPalette(): JSX.Element | null {
  const { t } = useTranslation();
  // AUFTRAG-mega11 Block B-2: dieselbe geschützte Grenze wie Sidebar/Topbar/Logo.
  const navigate = useGuardedNavigate();
  const { role, stufe2 } = useRole();
  // AUFTRAG-mega48 Block A (bens Ship-Blocker 1): die Palette liegt im gesperrten Bereich, ihr
  // Tastenkürzel aber hängt am FENSTER — `inert` hält Zeiger und Fokus auf, nicht einen globalen
  // Listener. Ohne diese Abfrage wäre die Palette bei offenem Filterblatt oder Drawer die eine
  // Fläche, die die Modalgrenze durchbricht (per Cmd/Ctrl+K, also genau der Weg, den ben benennt).
  const modalOffen = useModalLocked();
  // R-0909: die offene Palette ist selbst eine modale Fläche. Sie hängt dafür an derselben einen
  // Grenze (`GrenzDialog`) — und weil sie im gesperrten Bereich der Shell STEHT, wird ihre Ebene in
  // den Portal-Anker der Grenze gehoben. Sonst sperrte ihre eigene Anmeldung sie mit.
  const grenze = useModalBoundaryOptional();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  /**
   * Das Element, das die Fläche geöffnet hat — der Weg zurück (Vorlage, Punkt 7: „Öffnen/Schließen
   * und Fokusrückgabe korrekt").
   *
   * Es wird beim ÖFFNEN gemerkt, nicht beim Schließen: dann ist es noch da und noch fokussiert.
   * Beim Wegnavigieren wird es bewusst vergessen — dort übernimmt die neue Seite den Fokus, und ein
   * Sprung zurück auf einen Knopf der alten Seite wäre ein Rückschritt statt einer Rückgabe.
   */
  const ausloeserRef = useRef<HTMLElement | null>(null);
  /** Der offene Zustand für den Fenster-Zuhörer, der ihn außerhalb von React braucht. */
  const offenRef = useRef(false);
  /** Öffnungsanfrage, die auf die Freigabe der Modalgrenze wartet (FE-002). */
  const vormerkungRef = useRef<Vormerkung | null>(null);
  /** Der Sperrzustand des letzten Renderns — für Rückrufe außerhalb eines Effekts (FE-002). */
  const modalOffenRef = useRef(modalOffen);
  modalOffenRef.current = modalOffen;

  // JOB 3105 · UX-08: BESCHRIFTET wird mit dem Namen, den die anderen Flächen zeigen; GESUCHT wird
  // über alle Namen desselben Ziels — der angezeigte plus der bisherige. Beides wohnt seit JOB 3337
  // in `direktzugangZiele`, damit Menü und Direktzugang nicht zwei Namensregeln haben.
  const ziele = useMemo(() => direktzugangZiele(t, role, stufe2), [role, stufe2, t]);
  const filtered = useMemo(() => trefferFuer(ziele, q), [ziele, q]);
  const gruppen = useMemo(() => trefferNachGruppen(filtered), [filtered]);
  // ================================================================================================
  // JOB 3337 R6 — EINE REIHENFOLGE, NICHT ZWEI (BEN-Befund der Runde 5).
  // ================================================================================================
  //
  // DER FEHLER, und er war für einen Menschen mit der Tastatur ein echter: Gezeichnet wurde nach
  // GRUPPEN (`gruppen`, unten `:281`), die laufende Nummer `data-cmd-stelle` entstand in genau
  // dieser Zeichenreihenfolge — Enter las aber `filtered[active]`, also aus der UNGRUPPIERTEN
  // Liste. Beide sind gleich LANG, deshalb fiel nichts auf; sie sind nur verschieden SORTIERT.
  // BEN hat es gemessen: Pfeiltasten bis zur Markierung „Profil", Enter → `/admin?bereich=system&
  // detail=bereitschaft`. Man landete zuverlässig woanders, als dastand, in DE wie in EN.
  //
  // DIE REPARATUR IST NICHT „Enter umbiegen", sondern die zweite Reihenfolge ABZUSCHAFFEN. Hier
  // steht ab jetzt die EINE Liste, in der die Ziele wirklich dastehen; aus ihr lesen alle drei:
  // die Trefferzahl, die Tastatur (Pfeile und Enter) und — über dieselbe Zeichenreihenfolge — die
  // Markierung. Solange es nur eine Quelle gibt, kann sie nicht mit sich selbst auseinanderlaufen.
  //
  // `filtered` bleibt die Vorstufe (Suche), ist aber ab hier für die Bedienung nicht mehr zuständig.
  const fragenErreichbar = ziele.some((z) => z.path === "/fragen");

  // R-0893: die Wissenseinträge zur Eingabe (Block „9" oben). Entprellt wie die Bibliothek selbst,
  // derselbe Hook, derselbe Cache-Schlüssel — kein zweiter Suchweg.
  const bibliothekErreichbar = ziele.some((z) => z.path === "/bibliothek");
  const eingabe = q.trim();
  const begriff = useDebouncedValue(eingabe, LIBRARY_SEARCH_DEBOUNCE_MS);
  // `begriff === eingabe`: gefragt wird erst nach der Tipp-Pause, und nie mit einem Begriff, der
  // nicht mehr im Feld steht (etwa der vom letzten Öffnen, solange die Entprellung nachläuft).
  const wissenGefragt =
    open && bibliothekErreichbar && begriff === eingabe && begriff.length >= WISSEN_AB_ZEICHEN;
  const wissenSuche = useLibrarySearch({ q: begriff }, wissenGefragt);
  const wissen = useMemo((): Zeilenziel[] => {
    const antwort = wissenSuche.data;
    if (!wissenGefragt || !Array.isArray(antwort) || antwort.length === 0) {
      return [];
    }
    const oben = t("schnellwahl.wissenGruppe");
    const eintraege: Zeilenziel[] = antwort.slice(0, WISSEN_HOECHSTENS).map((ko) => ({
      id: `ko:${ko.id}`,
      label: ko.title,
      path: `/wissen/${encodeURIComponent(ko.id)}`,
      kontext: ko.category ? `${oben} › ${ko.category}` : oben,
    }));
    // R-1669 „Schnellaktionen": der Weg zu ALLEN Treffern, wenn die Palette nur die ersten zeigt.
    eintraege.push({
      id: "aktion:bibliothek",
      label: t("schnellwahl.alleTreffer", { q: begriff }),
      path: `/bibliothek?q=${encodeURIComponent(begriff)}`,
      kontext: t("fe002.wissenSuchen"),
    });
    return eintraege;
  }, [wissenGefragt, begriff, wissenSuche.data, t]);

  const sichtbareReihenfolge = useMemo(
    (): Zeilenziel[] => [...gruppen.flatMap((g) => g.ziele), ...wissen],
    [gruppen, wissen],
  );
  // R-0893 (BEN, Nacharbeit 2): DIE AUSWAHL IST IMMER EINE ZEILE, DIE DASTEHT. Die Wissenseinträge
  // kommen ASYNCHRON — eine Pfeiltaste während der Tipp-Pause traf eine leere Liste und setzte
  // `active` auf -1; die eintreffenden Einträge korrigierten das nicht, und Enter fiel auf „als
  // Frage" statt auf das sichtbare Wissensobjekt. Markierung, Bildlauf, Pfeile und Enter lesen
  // deshalb `stelle`: der gemerkte Index, begrenzt auf die Liste, die JETZT dasteht (leer → 0).
  const stelle = Math.max(0, Math.min(active, sichtbareReihenfolge.length - 1));

  useEffect(() => {
    offenRef.current = open;
  }, [open]);

  /** Merkt sich, wer gerade den Fokus hat — das ist der Auslöser, an den er zurückgeht. */
  const merkeAusloeser = useCallback((): void => {
    const aktiv = document.activeElement;
    ausloeserRef.current = aktiv instanceof HTMLElement ? aktiv : null;
  }, []);

  // Die vorgemerkte Öffnung (s. `onCustom`). Sie greift erst, wenn die Grenze FREI ist. Der Rückweg
  // wird dabei NICHT aus `document.activeElement` gelesen: unter Last stand dort im Tor-Volllauf
  // (Prüfauftrag pa-1790494556-7615eb59, C7 Runde 1) noch `BODY` — die Drawer-Zeile war schon
  // abgebaut, der Fokus noch nicht auf „Menü" — und Escape ließ den Fokus im Leeren. Die Anfrage
  // nennt ihren Rückweg deshalb selbst; nur ohne ihn gilt weiter das fokussierte Element. Eine
  // Vormerkung, die nicht binnen `VORMERKUNG_MS` eingelöst wird, verfällt — die Palette erscheint
  // nie verspätet nach einem ganz anderen, später geschlossenen Dialog.
  // Gelesen wird der zuletzt GERENDERTE Sperrzustand (`modalOffenRef`), nicht der eines Effekts.
  const loeseVormerkungEin = useCallback((): void => {
    const vormerkung = vormerkungRef.current;
    if (modalOffenRef.current || vormerkung === null) {
      return;
    }
    vormerkungRef.current = null;
    if (Date.now() - vormerkung.seit > VORMERKUNG_MS) {
      return;
    }
    const rueckweg = vormerkung.rueckweg?.() ?? null;
    if (rueckweg) {
      ausloeserRef.current = rueckweg;
    } else {
      merkeAusloeser();
    }
    setOpen(true);
  }, [merkeAusloeser]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Solange eine modale Fläche offen ist, öffnet das Kürzel nichts — sonst erschiene über
        // dem Dialog eine zweite Bedienfläche, die er laut `aria-modal` gar nicht zulässt.
        // R-0909: ist die offene Fläche die Palette SELBST, schließt das Kürzel sie wie bisher.
        if (modalOffen && !offenRef.current) {
          return;
        }
        e.preventDefault();
        if (!offenRef.current) {
          merkeAusloeser();
        }
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onCustom = (e: Event): void => {
      // FE-002 (Ben, Lauf 2 Runde 1): „Seite finden" im schmalen Drawer schließt den Drawer und
      // ruft die Palette im SELBEN Klick — die Grenze ist dann noch gesperrt, und das Ereignis
      // verfiel. Wer ausdrücklich `nachModalgrenze` sagt, wird deshalb IMMER vorgemerkt und erst
      // eingelöst, wenn die Grenze frei ist (`loeseVormerkungEin`). Nicht nur bei `modalOffen`:
      // dieser Zuhörer trägt den Zustand seines letzten Effekts, und der kann dem gerade
      // geöffneten Drawer hinterherhinken — gemessen in Lauf 2 R3 (lokales Chromium, C7 Runde 5:
      // Ereignis mit `modal=false` bei offenem Drawer, Palette sofort offen, die Drawer-Zeile als
      // Rückweg gemerkt, beim Schließen abgebaut → Fokus auf BODY). Alle anderen Anfragen
      // bleiben, wie sie waren: bei offener Grenze abgewiesen, sonst sofort geöffnet.
      const anfrage = (e as CustomEvent<PaletteAnfrage | null>).detail;
      if (anfrage?.nachModalgrenze) {
        vormerkungRef.current = { seit: Date.now(), rueckweg: anfrage.rueckweg };
        // Nach dem nächsten Bildaufbau ist das Schließen der auslösenden Fläche verarbeitet; ist
        // die Grenze dann frei, wird eingelöst — sonst beim Wechsel der Sperre (Effekt unten).
        window.requestAnimationFrame(() => loeseVormerkungEin());
        return;
      }
      if (modalOffen) {
        return;
      }
      merkeAusloeser();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onCustom);
    };
  }, [modalOffen, merkeAusloeser, loeseVormerkungEin]);

  // Die vorgemerkte Öffnung (s. `onCustom`) — eingelöst beim Wechsel der Sperre.
  useEffect(() => {
    if (!modalOffen) {
      loeseVormerkungEin();
    }
  }, [modalOffen, loeseVormerkungEin]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    // GESCHLOSSEN: der Fokus geht dorthin zurück, wo er herkam. Die Abfrage auf `isConnected` ist
    // kein Zierrat — der Auslöser kann inzwischen abgebaut sein (eine Menüzeile, deren Menü sich
    // beim Öffnen geschlossen hat). Dann wird nichts fokussiert, statt eine Leiche anzusprechen.
    // Beim ersten Zeichnen ist die Marke leer, also passiert hier nichts.
    const ziel = ausloeserRef.current;
    ausloeserRef.current = null;
    if (ziel?.isConnected && typeof ziel.focus === "function") {
      ziel.focus();
    }
    return undefined;
  }, [open]);

  // Vorlage, Punkt 7: „Tastaturmarkierung muss beim Wandern in Sicht bleiben." Die Liste ist 320 px
  // hoch und trägt jetzt deutlich mehr Ziele — ohne diesen Zug führe die Markierung unter den Rand.
  // `block: "nearest"` scrollt nur, wenn es nötig ist; die Maus bewegt die Liste dadurch nicht.
  //
  // Die Abfrage auf die Funktion ist kein Zierrat: jsdom kennt `scrollIntoView` nicht, und ohne sie
  // stürzte JEDER gemountete Palettentest ab (tests/navigationsnamen, mega47) — ein Bedienvorteil
  // im Browser darf keine Messung anderswo umwerfen.
  useEffect(() => {
    if (!open) {
      return;
    }
    const markiert = listeRef.current?.querySelector(`[data-cmd-stelle="${stelle}"]`);
    if (markiert && typeof markiert.scrollIntoView === "function") {
      markiert.scrollIntoView({ block: "nearest" });
    }
  }, [open, stelle]);

  if (!open) {
    return null;
  }

  const go = (path: string): void => {
    // Beim Wegnavigieren KEINE Fokusrückgabe: das Ziel bekommt den Fokus, nicht der Auslöser der
    // Liste. Die Marke wird deshalb vor dem Schließen gelöscht.
    ausloeserRef.current = null;
    setOpen(false);
    navigate(path);
  };

  const springe = (richtung: 1 | -1): void => {
    // Von der SICHTBAREN Stelle aus, und nie unter 0 — auch nicht bei leerer Liste.
    setActive(Math.max(0, Math.min(stelle + richtung, sichtbareReihenfolge.length - 1)));
  };

  /** Der laufende Index über ALLE Gruppen — die Tastatur kennt eine Liste, nicht vier. */
  let laufend = -1;
  const zeile = (it: Zeilenziel): JSX.Element => {
    laufend += 1;
    const i = laufend;
    const aktiv = i === stelle;
    return (
      <li key={it.id}>
        <button
          type="button"
          data-cmd-aktiv={aktiv ? "true" : undefined}
          data-cmd-stelle={i}
          data-cmd-ziel={it.id}
          // Der WEG des Ziels, als Marke am Knopf statt als Text in der Zeile. Er ist die Wahrheit,
          // die eine Messung braucht („wohin führt diese Zeile?"), ohne dass ein Kunde sie lesen
          // muss (Vorlage, Punkt 2: der Name ist die Hauptorientierung, nicht die Route).
          data-cmd-pfad={it.path}
          onMouseEnter={() => setActive(i)}
          onClick={() => go(it.path)}
          className={`flex w-full items-start gap-3 rounded-btn px-3 py-1.5 text-left ${
            aktiv ? "bg-brand text-white" : "text-text hover:bg-hairline-soft"
          }`}
        >
          {/* Kein `truncate`: die Vorlage verlangt ausdrücklich „vollständige Texte lesbar, auch
              bei langer englischer Beschriftung". Lieber zwei Zeilen als ein abgeschnittener Name. */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span data-cmd-name className="break-words text-[13.5px] leading-snug">
              {it.label}
            </span>
            {/* Kontext und Route treten ZURÜCK, statt eine eigene Farbe zu wählen: sie erben die
                Schriftfarbe der Zeile (dunkel bzw. weiß auf der Marke) und werden nur leiser. Das
                ist nicht bloß kürzer — eine zweite zustandsabhängige Klassenkette wäre eine
                weitere unauflösbare Bindung im Sammler `mega47` (JOB 1181: „auflösbar schreiben
                statt den Pin hochsetzen"). Eine Zeile, eine Bindung. */}
            <span data-cmd-kontext className="break-words text-[11.5px] leading-snug opacity-90">
              {it.kontext}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const ebene = (
    // ============================================================================================
    // JOB 3337 R7 — DIE LISTE RECHNET MIT DEM FENSTER (BEN-Befund der Runde 6).
    // ============================================================================================
    //
    // DER BEFUND, gemessen: bei 683×384 CSS-Pixeln — das ist der Platz, den 1366×768 bei 200 %
    // Zoom übriglässt — stand die letzte Zeile bei y=395,58 bis 441,95, das Fenster endete bei 384.
    // Wer mit der Tastatur ans Ende der Liste wanderte, wählte etwas aus, das er nicht sehen
    // konnte. `scrollIntoView` half nicht: es zieht die Zeile innerhalb der Liste in Sicht, und die
    // LISTE selbst ragte aus dem Fenster.
    //
    // ZWEI feste Maße waren schuld, und beide kannten das Fenster nicht: der Abstand von oben
    // (`pt-[12vh]`, ohne jeden Gegenpart unten) und die Listenhöhe (`max-h-80` = 320 px, immer).
    // 46 + 45 + 26 + 320 ergibt genau die gemessenen 442.
    //
    // DIE REPARATUR ist keine kleinere Zahl — eine kleinere feste Zahl wäre derselbe Fehler mit
    // anderem Ausgang. Stattdessen bekommt die Fläche unten denselben Anspruch wie oben, der Kasten
    // eine Obergrenze aus der WIRKLICH verfügbaren Höhe (`max-h-full` gegen den Inhaltskasten
    // dieser Fläche), und die Liste darf darin schrumpfen (`min-h-0`, ohne das verweigert ein
    // Flex-Kind mit eigenem Überlauf jedes Schrumpfen). `max-h-80` bleibt als Obergrenze für hohe
    // Fenster: auf einem gewöhnlichen Bildschirm sieht die Liste aus wie bisher, auf einem flachen
    // wird sie kürzer und scrollt — statt aus dem Bild zu laufen.
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pb-[6vh] pt-[12vh]">
      {/* R-0909 (Ben, Nacharbeit 4): Klickfänger nur für die Maus, nicht in der Tab-Reihenfolge —
          die Tastatur schließt mit Escape (oder ⌘K). */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("cmd.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/30"
      />
      {/* R-0909: der Kasten ist ein benannter Dialog an der einen Grenze. Den Fokus setzt die
          Palette selbst ins Suchfeld (unten), und ihre Rückgabe bleibt ihre eigene — beim
          Wegnavigieren geht er bewusst NICHT zurück (`go`); deshalb gibt die Grenze hier keinen
          Auslöser zurück. `m-0 p-0 text-text` nehmen dem nativen Element seine Vorgaben. */}
      <GrenzDialog
        name={t("fe002.seiteFindenMenue")}
        anfangsfokus={false}
        ausloeser={() => null}
        className="relative m-0 flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-card border border-hairline bg-surface p-0 text-text shadow-popover"
      >
        <input
          ref={inputRef}
          value={q}
          // JOB 3337 R5 — DER GRIFF FÜR PRÜFBÜHNEN, DER KEINE ÜBERSETZUNG KENNT.
          //
          // `tests-smoke/ui-smoke.spec.ts` hat dieses Feld über ein Bruchstück seines PLATZHALTERS
          // gesucht („Zu Seite springen"). Dieser Auftrag hat den Platzhalter auf Pedis Wortlaut
          // umgestellt („Gehe zu … (⌘K)", `cmd.placeholder`) — und der Smoke ist daran zerbrochen,
          // im Tor, nicht beim Bauen. Es war schon der zweite Fall dieser Art in diesem Job (der
          // erste: der aufgelöste Reiter „Daten" in `ersteinrichtung.setup.ts`).
          //
          // Ein sichtbarer Text ist kein Anker: er gehört dem Nutzer und der Übersetzung, nicht der
          // Prüfung. Deshalb hier dieselbe Bauform, die diese Datei für ihre Trefferzeilen schon
          // benutzt (`data-cmd-name`, `data-cmd-pfad`, `data-cmd="trefferzahl"`): ein benannter
          // Griff, den keine Umbenennung und keine Sprache verschiebt. Er ändert nichts an dem, was
          // ein Mensch sieht oder hört.
          data-cmd="suchfeld"
          // Codex' Befund: „Der Suchkasten trägt im gelesenen Code nur einen Platzhalter, keine
          // eigene zugängliche Beschriftung." Ein Platzhalter verschwindet beim Tippen — ein Name
          // bleibt, auch für Vorlesewerkzeuge.
          aria-label={t("fe002.seiteFinden")}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              springe(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              springe(-1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              // Aus DERSELBEN Liste, die dasteht — siehe den Block bei `sichtbareReihenfolge`.
              const it = sichtbareReihenfolge[stelle];
              if (it) {
                go(it.path);
              } else if (fragenErreichbar && q.trim()) {
                // Kein Ziel da: Enter tut, was der Nulltreffer anbietet (R-0474).
                go(`/fragen?q=${encodeURIComponent(q.trim())}`);
              }
            }
          }}
          placeholder={`${t("fe002.seiteFindenMenue")} (⌘K)`}
          // `shrink-0`: Suchfeld und Trefferzahl behalten ihre Höhe, wenn der Kasten eng wird —
          // schrumpfen soll die LISTE (sie kann scrollen), nicht das Feld, in das man tippt.
          className="w-full shrink-0 border-b border-hairline bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div
          data-cmd="trefferzahl"
          aria-live="polite"
          className="shrink-0 border-b border-hairline px-4 py-1.5 text-[11.5px] text-muted-2"
        >
          {/* Gezählt wird, was DASTEHT und erreichbar ist — nicht, was die Suche vorsortiert hat.
              Heute ist beides gleich lang; die Zahl aus derselben Liste zu nehmen wie die Zeilen
              und die Tastatur ist trotzdem die richtige Bindung: sonst wäre es die dritte
              Reihenfolge, an der irgendwann wieder etwas auseinanderläuft. */}
          {t("cmd.treffer", { count: sichtbareReihenfolge.length })}
        </div>
        {/* FE-002: bewusst AUSSERHALB der Live-Region — der Satz ändert sich nie und soll nicht bei
            jedem Tastendruck mit der Trefferzahl erneut vorgelesen werden. */}
        <p
          data-cmd="hinweis"
          className="shrink-0 border-b border-hairline px-4 py-1.5 text-[11.5px] text-muted-2"
        >
          {t("fe002.paletteHinweis")}
        </p>
        {/* `min-h-0` ist der Schalter, ohne den nichts von alledem wirkt: ein Flex-Kind hat von
            Haus aus `min-height: auto` und weigert sich dann, unter seinen Inhalt zu schrumpfen —
            der Kasten hielte seine Obergrenze ein, die Liste liefe trotzdem darüber hinaus. */}
        <ul ref={listeRef} className="max-h-80 min-h-0 overflow-y-auto p-1.5">
          {sichtbareReihenfolge.length === 0 ? (
            // R-0474: der Nulltreffer sagt, was jetzt geht. Die Eingabe als Frage wird nur
            // angeboten, wenn „Fragen" unter den Zielen DIESER Rolle steht — dieselbe Liste, aus der
            // die Palette sonst liest, keine zweite Rechtefrage.
            <li data-cmd="nulltreffer" className="px-3 py-2 text-[13px] text-muted">
              {t("cmd.empty")}{" "}
              {fragenErreichbar && q.trim() ? (
                <button
                  type="button"
                  data-cmd="als-frage"
                  onClick={() => go(`/fragen?q=${encodeURIComponent(q.trim())}`)}
                  className="font-semibold text-ai hover:opacity-80"
                >
                  {t("erstnutzer.palette.alsFrage", { q: q.trim() })}
                </button>
              ) : (
                t("erstnutzer.palette.anderesWort")
              )}
            </li>
          ) : (
            [
              ...gruppen.map((g) => ({
                id: g.gruppe.id,
                titel: t(g.gruppe.titleKey),
                ziele: g.ziele as Zeilenziel[],
              })),
              // R-0893: die Wissenseinträge NACH den Seiten — dieselbe Reihenfolge wie
              // `sichtbareReihenfolge`, aus der Tastatur und Trefferzahl lesen.
              ...(wissen.length > 0
                ? [{ id: "wissen", titel: t("schnellwahl.wissenGruppe"), ziele: wissen }]
                : []),
            ].map((g) => (
              <li key={g.id}>
                {/* Die Überschrift ist bewusst KEIN Knopf: sie ist kein Ziel, sie ordnet nur. */}
                <div
                  data-cmd-gruppe={g.id}
                  className="px-3 pb-0.5 pt-2 text-[11px] font-semibold tracking-[0.02em] text-muted-2"
                >
                  {g.titel}
                </div>
                <ul>{g.ziele.map(zeile)}</ul>
              </li>
            ))
          )}
        </ul>
      </GrenzDialog>
    </div>
  );

  // Der Anker wird beim Öffnen gelesen (Bauform `Modal.tsx`). Ohne Grenze — gemountete Proben ohne
  // Shell — steht die Ebene an ihrem angestammten Platz.
  const anker = grenze?.host() ?? null;
  return anker ? createPortal(ebene, anker) : ebene;
}
