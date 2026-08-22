import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { focusFirstIn } from "../lib/focusables";

// AUFTRAG-mega48 Block A — EINE MODALGRENZE FÜR DIE GANZE APP.
//
// DER VORFALL (ben, sammel45, GESAMTVERDIKT ROT): bis mega47 reichte jede Seite ihren EIGENEN
// Seiten-Root als Hintergrund herein. Das Filterblatt sperrte damit den Seiteninhalt — und
// behauptete mit `aria-modal="true"` App-Modalität, die es nicht hatte: Klara (z-40), die
// Toast-Aktionen (z-[60]) und die per Cmd/Ctrl+K global öffenbare Command Palette (z-50) liegen
// als Geschwister DANEBEN und blieben erreichbar. Ein dritter Aufrufer (ImportSelect) reichte gar
// keinen Hintergrund herein: dort war die Modalität reine Behauptung. Optional verdrahtete
// Modalität ist genau deshalb falsch — sie wird vergessen, und der Fehler ist unsichtbar.
//
// DIE BAUFORM (übernommen, nicht erfunden): dieselbe wie RoleContext, ToastContext, NavGuardContext
// und AuthContext — ein Kontext in `app/`, montiert dort, wo die Wahrheit entsteht. Die Wahrheit
// ist hier der Hintergrund, und der entsteht in der Shell (AppShell). Eine modale Fläche HOLT sich
// die Grenze, sie bekommt sie nicht mehr von ihrem Aufrufer gereicht. Damit hängt jeder Aufrufer
// automatisch daran — auch der, der nie etwas davon gehört hat.
//
// DREI EIGENSCHAFTEN, die diese Grenze von der alten unterscheidet:
//
//  1. SIE UMFASST DIE SHELL, nicht die Seite. Gesperrt werden die angemeldeten BEREICHE
//     (`ModalRegion`): Topbar, Seiteninhalt, Command Palette, Toasts und Klara. Was nicht in einem
//     Bereich liegt, ist die modale Fläche selbst — und der Portal-Anker.
//
//  2. SIE WIRD GEZÄHLT, nicht gesetzt und gelöscht. Zwei gleichzeitig offene Flächen (Filterblatt
//     und Navigations-Drawer) nahmen sich vorher gegenseitig das `inert` weg: wer zuletzt aufräumte,
//     entsperrte den Hintergrund für die noch offene Fläche und zog den Fokus auf seinen eigenen
//     Auslöser. Hier meldet Öffnen an und Schließen ab; erst die LETZTE Abmeldung hebt die Sperre
//     auf. Solange noch etwas offen ist, kehrt der Fokus in die darunterliegende Fläche zurück.
//
//  3. SIE IST FAIL-CLOSED. `useModalBoundary()` wirft ohne Provider (Bauform von `useRole`/
//     `useNavGuard`), und der Portal-Anker ist Pflicht. Eine Fläche, die Modalität behauptet, kann
//     ohne echte Grenze gar nicht erst entstehen.
//
// Der Wächter dazu ist `tests/app/mega47-modale-flaechen-sammler.test.tsx` — er erhebt die
// tatsächlichen Aufrufer aus dem Quellbaum, nicht eine Liste der heutigen Fälle.

export interface ModalSurface {
  // Das Panel dieser Fläche — dorthin kehrt der Fokus zurück, wenn eine DARÜBER liegende Fläche
  // schließt und diese hier wieder die oberste ist.
  panel: () => HTMLElement | null;
  // Der Auslöser — dorthin kehrt der Fokus zurück, wenn dies die LETZTE offene Fläche war.
  trigger: () => HTMLElement | null;
}

interface ModalBoundaryValue {
  // Portal-Anker für modale Flächen: ein Knoten AUSSERHALB aller gesperrten Bereiche und
  // innerhalb der Shell. Wird beim Öffnen gelesen, nicht während des Renderns.
  host: () => HTMLElement | null;
  // Meldet eine modale Fläche an; das Ergebnis ist ihre Abmeldung (Cleanup des Öffnen-Effekts).
  enter: (surface: ModalSurface) => () => void;
  // Ein zu sperrender Bereich meldet sich an; das Ergebnis ist seine Abmeldung.
  registerRegion: (node: HTMLElement) => () => void;
  // Liegt gerade eine modale Fläche über der App?
  locked: boolean;
}

const ModalBoundaryCtx = createContext<ModalBoundaryValue | null>(null);

/**
 * Für Flächen, die App-Modalität BEHAUPTEN (`aria-modal`). Fehlt die Grenze, ist das ein Defekt und
 * kein Zustand, um den herum gerendert wird — deshalb wirft der Zugriff, statt still fail-open zu
 * rendern.
 */
export function useModalBoundary(): ModalBoundaryValue {
  const value = useContext(ModalBoundaryCtx);
  if (!value) {
    throw new Error(
      "useModalBoundary muss innerhalb von <ModalBoundaryProvider> verwendet werden — eine Fläche mit aria-modal ohne echte Modalgrenze darf es nicht geben.",
    );
  }
  return value;
}

/**
 * JOB 1900 (Chef-Entscheidung 22.08., Variante (b)): für Flächen, die die Grenze NUTZEN, ohne
 * `aria-modal` zu behaupten — das gemeinsame `Modal`. Es ist dieselbe eine Mechanik wie oben, nur
 * ohne den fail-closed Wurf: `Modal` wird auch ausserhalb der Shell gerendert (Anmeldeweg,
 * Absturzfall, gemountete Tests ohne Provider), und dort ist „keine Grenze vorhanden" eine
 * gueltige Antwort, kein Defekt. Der Wurf oben bleibt unveraendert für alles, was Modalität
 * BEHAUPTET — es wird nichts gelockert, nur ein zweiter, ehrlicher Zugang danebengestellt.
 */
export function useModalBoundaryOptional(): ModalBoundaryValue | null {
  return useContext(ModalBoundaryCtx);
}

/**
 * Für UMSTEHENDE, die nur wissen müssen, ob gerade eine modale Fläche offen ist (z. B. die
 * Command Palette, deren globales Tastenkürzel sonst durch die Grenze hindurchgriffe). Sie
 * behaupten keine Modalität, deshalb ist „keine Grenze vorhanden" hier eine gültige Antwort.
 */
export function useModalLocked(): boolean {
  return useContext(ModalBoundaryCtx)?.locked ?? false;
}

export function ModalBoundaryProvider({
  hostRef,
  children,
}: {
  hostRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}): JSX.Element {
  const regionsRef = useRef<Set<HTMLElement>>(new Set());
  const stackRef = useRef<ModalSurface[]>([]);
  const [locked, setLocked] = useState(false);

  const setzeSperre = useCallback((an: boolean): void => {
    for (const node of regionsRef.current) {
      if (an) {
        node.setAttribute("inert", "");
      } else {
        node.removeAttribute("inert");
      }
    }
  }, []);

  const registerRegion = useCallback((node: HTMLElement): (() => void) => {
    regionsRef.current.add(node);
    // Ein Bereich, der WÄHREND einer offenen Fläche montiert (Route-Wechsel, nachgeladener
    // Seitenteil), kommt bereits gesperrt zur Welt — sonst risse er ein Loch in die Grenze.
    if (stackRef.current.length > 0) {
      node.setAttribute("inert", "");
    }
    return () => {
      regionsRef.current.delete(node);
    };
  }, []);

  const enter = useCallback(
    (surface: ModalSurface): (() => void) => {
      // Die bisher oberste Fläche rückt nach unten: sie wird selbst gesperrt, solange etwas über
      // ihr liegt. Ohne das wäre die neue Fläche zwar modal gegenüber der App, aber nicht
      // gegenüber ihrer Vorgängerin.
      stackRef.current[stackRef.current.length - 1]?.panel()?.setAttribute("inert", "");
      stackRef.current.push(surface);
      setzeSperre(true);
      setLocked(true);
      let abgemeldet = false;
      return () => {
        if (abgemeldet) {
          return;
        }
        abgemeldet = true;
        const i = stackRef.current.lastIndexOf(surface);
        if (i >= 0) {
          stackRef.current.splice(i, 1);
        }
        const darunter = stackRef.current[stackRef.current.length - 1];
        if (darunter) {
          // Es ist noch eine Fläche offen: die Sperre BLEIBT. Erst den Bereich wieder aktivieren,
          // DANN hineinfokussieren — dieselbe Reihenfolge wie unten, sonst liefe der Fokus ins
          // inerte Element. Der Auslöser dieser Fläche liegt im gesperrten Bereich und ist
          // bewusst NICHT das Ziel.
          const panel = darunter.panel();
          panel?.removeAttribute("inert");
          focusFirstIn(panel);
          return;
        }
        // Letzte Abmeldung: erst Hintergrund wieder aktiv, DANN Fokus zurück auf den Auslöser.
        // Reihenfolge aus MobileNavDrawer (dort abgenommen) — andersherum liefe der Restore ins
        // inerte und damit nicht fokussierbare Element.
        setzeSperre(false);
        setLocked(false);
        surface.trigger()?.focus();
      };
    },
    [setzeSperre],
  );

  const host = useCallback((): HTMLElement | null => hostRef.current, [hostRef]);

  const value = useMemo<ModalBoundaryValue>(
    () => ({ host, enter, registerRegion, locked }),
    [host, enter, registerRegion, locked],
  );

  return <ModalBoundaryCtx.Provider value={value}>{children}</ModalBoundaryCtx.Provider>;
}

/**
 * Ein Bereich, der gesperrt wird, solange eine modale Fläche offen ist.
 *
 * `display: contents` als Vorgabe ist Absicht: der Bereich ist eine reine BEDIENGRENZE und soll am
 * Layout nichts ändern — sonst wäre jede Grenze zugleich ein Layout-Eingriff, und niemand zöge sie
 * eng genug. `inert` hängt nicht am Layout, sondern am Knotenbaum; die Wirkung belegt der
 * Browserfall in `tests-smoke/ui-smoke.spec.ts`.
 */
export function ModalRegion({
  children,
  className = "contents",
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const { registerRegion } = useModalBoundary();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    return registerRegion(node);
  }, [registerRegion]);
  return (
    <div ref={ref} data-modal-region="" className={className}>
      {children}
    </div>
  );
}
