import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  type LinkProps,
  NavLink,
  type NavLinkProps,
  type NavigateOptions,
  type To,
  useInRouterContext,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Modal } from "../components/Modal";
import { Button } from "../components/ui";
import {
  type PopGuard,
  createPopGuard,
  readHistoryIndex,
  releasePopAuthority,
  setPopAuthority,
} from "./navHistory";

// Bug (Pedi 04.07.): Seitenwechsel während des Erfassens hat den Inhalt verloren. Der
// `beforeunload`-Schutz greift nur beim Neuladen/Schließen des Browsers, NICHT beim
// clientseitigen Seitenwechsel (React Router). Dieser Wächter fängt den In-App-Wechsel ab:
// Eine Seite meldet „ungespeicherte Eingabe" an, die Navigation fragt vorher nach
// (Bleiben · Verwerfen · Entwurf speichern). Der Router ist ein klassischer BrowserRouter,
// daher kein useBlocker — die Navigationsquellen (Sidebar, Command-Palette) rufen `guard()`.

export interface DirtyGuard {
  isDirty: () => boolean;
  save: () => Promise<void>;
  // AUFTRAG-mega5 Block A (bens Ship-Gate 1): Inhalte, die der Entwurf NICHT sichern kann, werden vor
  // dem Wechsel einzeln und verständlich benannt. Liefert die Liste dieser Inhalte (leer/fehlend =
  // alles sicherbar). Nicht leer ⇒ der Dialog bietet KEIN „Entwurf speichern und wechseln" an —
  // ein Speichern, das erfolgreich wegnavigiert und dabei Benanntes verliert, wäre eine Lüge.
  unsavableDirtyReasons?: () => string[];
}

interface NavGuardValue {
  // Eine Seite registriert (oder entfernt mit null) ihren Ungespeichert-Wächter.
  setGuard: (guard: DirtyGuard | null) => void;
  // Navigationsquellen leiten den Wechsel hier durch; bei „dirty" wird erst gefragt.
  guard: (proceed: () => void) => void;
}

const NavGuardCtx = createContext<NavGuardValue | null>(null);

export function useNavGuard(): NavGuardValue {
  const value = useContext(NavGuardCtx);
  if (!value) {
    throw new Error("useNavGuard must be used within NavGuardProvider");
  }
  return value;
}

// AUFTRAG-mega11 Block B-1 (bens SB-2): EINE Mechanik für die Warnung beim Neuladen/Tab-Schließen.
// `/erfassen` hatte sie (Capture.tsx), die Vordertür nicht — derselbe Datenverlust, zwei Seiten, und
// eine davon ungeschützt. Statt den Effekt ein zweites Mal abzuschreiben (und beim nächsten Mal ein
// drittes), steht er hier einmal; beide Seiten reichen ihr eigenes Dirty-Prädikat herein.
//
// Grenze der Vorrichtung, ehrlich benannt: der Browser zeigt seinen EIGENEN, nicht anpassbaren
// Dialog. Wir können ihn weder beschriften noch „Entwurf speichern" anbieten — das kann nur der
// In-App-Wächter unten.
export function useUnloadGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
}

// AUFTRAG-mega13 Block A: der Dialog beantwortet jetzt ZWEI Herkünfte mit EINEM Pfad — den Klick auf
// eine Navigationsquelle (`guard(...)`) und den Browser-Zurück-Knopf (POP). Beide legen hier ihre
// „was bei Weitergehen zu tun ist"/„was bei Bleiben zu tun ist" ab; es gibt genau einen Slot, also
// genau einen Dialog.
interface PendingNav {
  proceed: () => void;
  cancel: () => void;
}

/**
 * Hält den ANKER nachgeführt — den Ort, auf dem die UI steht. Eigene Komponente aus zwei Gründen:
 *
 *  1. Sie BRAUCHT den Router. Der Provider selbst darf ihn nicht brauchen: er wird an vielen Stellen
 *     (u. a. in 25 bestehenden Tests) OBERHALB des Routers gehängt, und ein `useLocation()` im
 *     Provider würde dort mit „useLocation() may be used only in the context of a <Router>" brechen.
 *  2. Als Verbraucher des Location-Kontexts läuft sie bei JEDER Navigation neu — auch dann, wenn
 *     React den Elternbaum überspringt, weil dessen `children`-Element unverändert ist (genau der
 *     Fall in main.tsx: `<BrowserRouter><App/></BrowserRouter>`). Ein `useLocation()` im Provider
 *     würde bei einer Navigation also nicht einmal zuverlässig neu laufen.
 */
function AnchorTracker({ onLocation }: { onLocation: (pathname: string) => void }): null {
  const location = useLocation();
  useEffect(() => {
    onLocation(location.pathname);
  }, [location, onLocation]);
  return null;
}

export function NavGuardProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  // Ohne Router gibt es keine POP-Semantik (MemoryRouter-Tests, Provider oberhalb des Routers) —
  // dann meldet sich der Zurück-Wächter bewusst NICHT an, statt ins Blaue zu greifen.
  const inRouter = useInRouterContext();
  const guardRef = useRef<DirtyGuard | null>(null);
  const [pending, setPending] = useState<PendingNav | null>(null);
  const [saving, setSaving] = useState(false);
  // AUFTRAG-mega5 Block A: beim Öffnen des Dialogs EINMAL eingefroren — die Liste ändert sich nicht
  // mitten im offenen Dialog (kein Knopf, der unter dem Zeiger erscheint/verschwindet).
  const [unsavable, setUnsavable] = useState<string[]>([]);

  // Der POP-Handler läuft AUSSERHALB von React (Fenster-Ereignis) und braucht den Dialog-Zustand
  // synchron — zwei schnelle Zurück-Klicks liegen in getrennten Aufgaben, aber vor dem nächsten
  // Render. Darum die Wahrheit im Ref, die Anzeige im State.
  const pendingRef = useRef<PendingNav | null>(null);
  const applyPending = useCallback((next: PendingNav | null): void => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  const setGuard = useCallback((guard: DirtyGuard | null): void => {
    guardRef.current = guard;
  }, []);

  const guard = useCallback(
    (proceed: () => void): void => {
      if (guardRef.current?.isDirty()) {
        setUnsavable(guardRef.current.unsavableDirtyReasons?.() ?? []);
        applyPending({ proceed, cancel: () => {} });
      } else {
        proceed();
      }
    },
    [applyPending],
  );

  // ── Der Zurück-Wächter (Kanten 1-10) ────────────────────────────────────────────────────────────
  //
  // Der ANKER ist der Ort, auf dem die UI steht: sein History-Index (vom Router gestempelt) und sein
  // Pfad. Beides wird bei jedem tatsächlich vollzogenen Ortswechsel neu gelesen — ein blockierter POP
  // vollzieht sich nicht, also bleibt der Anker dabei bewusst stehen.
  const anchorRef = useRef<{ index: number | null; pathname: string }>({
    index: readHistoryIndex(),
    pathname: window.location.pathname,
  });
  const trackAnchor = useCallback((pathname: string): void => {
    anchorRef.current = { index: readHistoryIndex(), pathname };
  }, []);

  const popGuardRef = useRef<PopGuard | null>(null);
  if (popGuardRef.current === null) {
    popGuardRef.current = createPopGuard({
      anchorIndex: () => anchorRef.current.index,
      currentIndex: () => readHistoryIndex(),
      currentTarget: () => ({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      }),
      // Kante 8: NUR ein echter Pfadwechsel kann Inhalt verlieren. Ein POP, der auf demselben Pfad
      // nur Query oder Hash ändert, lässt die Seite eingehängt (dieselbe Route ⇒ dieselbe Instanz) —
      // dort wäre die Warnung eine Gängelung ohne Verlust, und die Filterschiene der Bibliothek
      // (mega10) lebt genau davon.
      shouldBlock: (target) =>
        guardRef.current?.isDirty() === true && target.pathname !== anchorRef.current.pathname,
      go: (delta) => window.history.go(delta),
      showDialog: () => {
        // Es ist bereits ein Dialog offen (Klick auf eine Navigationsquelle): kein zweiter (Kante 3).
        if (pendingRef.current !== null) {
          return false;
        }
        setUnsavable(guardRef.current?.unsavableDirtyReasons?.() ?? []);
        applyPending({
          proceed: () => popGuardRef.current?.proceed(),
          cancel: () => popGuardRef.current?.stay(),
        });
        return true;
      },
      hideDialog: () => applyPending(null),
    });
  }

  useEffect(() => {
    const popGuard = popGuardRef.current;
    if (!popGuard || !inRouter) {
      return;
    }
    const authority = (): "pass" | "swallow" => popGuard.handlePop();
    setPopAuthority(authority);
    return () => {
      releasePopAuthority(authority);
      popGuard.reset();
    };
  }, [inRouter]);

  const close = (): void => {
    const active = pendingRef.current;
    applyPending(null);
    // „Hier bleiben": beim POP-Weg stellt das den Wächter zurück (die Adresszeile steht bereits
    // wieder auf dem Anker, siehe navHistory). Beim Klick-Weg ist es ein Nichts-Tun.
    active?.cancel();
  };

  const runPending = (): void => {
    const active = pendingRef.current;
    applyPending(null);
    active?.proceed();
  };

  const saveAndGo = async (): Promise<void> => {
    const active = guardRef.current;
    if (!active) {
      runPending();
      return;
    }
    setSaving(true);
    try {
      await active.save();
      runPending();
    } catch {
      // Speichern fehlgeschlagen: Dialog offen lassen — die Seite zeigt die Fehlermeldung.
      // Nicht wechseln, damit nichts verloren geht.
    } finally {
      setSaving(false);
    }
  };

  return (
    <NavGuardCtx.Provider value={{ setGuard, guard }}>
      {/* Nur MIT Router: dort hält er den Anker (Ort + History-Index) für den Zurück-Wächter nach. */}
      {inRouter ? <AnchorTracker onLocation={trackAnchor} /> : null}
      {children}
      <Modal
        open={pending !== null}
        onClose={close}
        title={unsavable.length > 0 ? t("nav.guard.unsavableTitle") : t("nav.guard.title")}
      >
        {/* AUFTRAG-mega5 Block A (bens Ship-Gate 1): sind nicht sicherbare Inhalte im Spiel, sagt der
            Dialog VOR dem Wechsel ausdrücklich und einzeln, WAS verloren ginge — und bietet nur
            „Hier bleiben" oder bewusstes Verwerfen an. Ein „Speichern", das erfolgreich wegnavigiert
            und die benannten Inhalte dabei still fallen lässt, gibt es hier nicht. */}
        {unsavable.length > 0 ? (
          <>
            <p className="text-[13px] leading-relaxed text-text">{t("nav.guard.unsavableLead")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-text">
              {unsavable.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              {t("nav.guard.unsavableHint")}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="primary" onClick={close}>
                {t("nav.guard.stay")}
              </Button>
              {/* AUFTRAG-mega14 Block F (SCRUM-412): DER Fund des Live-Tests. Im echten Browser
                  gemessen: „Verwerfen und wechseln" rendert rgb(104,112,120) — Zeichen für Zeichen
                  dieselbe Farbe wie „Hier bleiben" daneben. Unterscheidbar waren die beiden allein
                  am Text, und hinter einem davon liegt Datenverlust. Dieser Dialog ist zugleich das
                  Weggehen aus Erfassen UND aus Mobil — er erklärt beide Live-Befunde auf einmal. */}
              <Button variant="danger" onClick={runPending}>
                {t("nav.guard.discard")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-text">{t("nav.guard.body")}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                {t("nav.guard.stay")}
              </Button>
              {/* AUFTRAG-mega14 Block F (SCRUM-412): DER Fund des Live-Tests. Im echten Browser
                  gemessen: „Verwerfen und wechseln" rendert rgb(104,112,120) — Zeichen für Zeichen
                  dieselbe Farbe wie „Hier bleiben" daneben. Unterscheidbar waren die beiden allein
                  am Text, und hinter einem davon liegt Datenverlust. Dieser Dialog ist zugleich das
                  Weggehen aus Erfassen UND aus Mobil — er erklärt beide Live-Befunde auf einmal. */}
              <Button variant="danger" onClick={runPending}>
                {t("nav.guard.discard")}
              </Button>
              <Button variant="primary" disabled={saving} onClick={() => void saveAndGo()}>
                {t("nav.guard.save")}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </NavGuardCtx.Provider>
  );
}

// ── AUFTRAG-mega11 Block B-2 (bens SB-2): die GEMEINSAME geschützte Navigations-Grenze ────────────
//
// Der Wächter oben ist quellenbasiert: er greift nur, wenn die Navigationsquelle `guard()` selbst
// ruft. Genau daran ist er löchrig geworden — Sidebar-NavRow und Command-Palette taten es, das
// Profil-Link, das Logo, Topbar-Suche, -Hilfe und das Benachrichtigungsziel nicht. Das ist keine
// Reihe von fünf Einzelfehlern, sondern ein Bauartfehler: jede NEUE Navigationsquelle muss sich an
// eine ungeschriebene Regel erinnern, und irgendwann tut sie es nicht.
//
// Diese drei Bauteile sind die eine Stelle, durch die Shell-Navigation läuft. Wer künftig einen Link
// oder ein `navigate` in der Shell braucht, nimmt sie — und ist damit automatisch geschützt. Der
// Schnitt ist bewusst so gewählt, dass er die AUFRUFSEITE nicht umbaut: `GuardedNavLink` hat die
// Signatur von `NavLink`, `GuardedLink` die von `Link`, `useGuardedNavigate` die von `useNavigate`.
// Ein Austausch ist damit ein Import-Wechsel, kein Umschreiben — und genau deshalb wird er gemacht.
//
// Vorbild ist die bereits richtige `NavRow` in Sidebar.tsx: Modifikator-Klicks (neuer Tab/Fenster)
// bleiben beim Browser, denn sie verlassen die Seite gar nicht — sie zu blockieren wäre eine
// Warnung ohne Verlust. Alles andere geht durch `guard()`.

// Klicks, die der Browser selbst behandelt: neuer Tab/Fenster/Download, Mittel-/Rechtsklick, ein
// fremdes Ziel. Sie navigieren die AKTUELLE Seite nicht weg, es geht also nichts verloren.
function isBrowserOwnedClick(e: ReactMouseEvent, target?: string): boolean {
  return (
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    e.button !== 0 ||
    (target !== undefined && target !== "" && target !== "_self")
  );
}

// `navigate` mit vorgeschaltetem Wächter — gleiche Signatur wie `useNavigate`.
//
// History-Sprünge (`navigate(-1)`) laufen bewusst MIT durch den Wächter, damit ein selbst gebauter
// Zurück-Knopf nicht zur Abkürzung wird. Der ECHTE Browser-Zurück-Knopf bleibt davon unberührt —
// siehe die Analyse zu B-3 im Bericht; dafür gibt es hier bewusst keine Bastellösung.
export function useGuardedNavigate(): (to: To | number, options?: NavigateOptions) => void {
  const navigate = useNavigate();
  const { guard } = useNavGuard();
  return useCallback(
    (to: To | number, options?: NavigateOptions): void => {
      guard(() => {
        if (typeof to === "number") {
          navigate(to);
          return;
        }
        navigate(to, options);
      });
    },
    [guard, navigate],
  );
}

// `exactOptionalPropertyTypes`: ein ausgelassenes Link-Attribut darf NICHT als `undefined` in die
// Navigations-Optionen wandern — sonst überschriebe es den Router-Standard mit „nichts".
function navigateOptionsFrom(props: {
  replace?: boolean | undefined;
  state?: unknown;
  preventScrollReset?: boolean | undefined;
  relative?: NavLinkProps["relative"];
}): NavigateOptions {
  return {
    ...(props.replace === undefined ? {} : { replace: props.replace }),
    ...(props.state === undefined ? {} : { state: props.state }),
    ...(props.preventScrollReset === undefined
      ? {}
      : { preventScrollReset: props.preventScrollReset }),
    ...(props.relative === undefined ? {} : { relative: props.relative }),
  };
}

// Gemeinsame Klick-Behandlung für beide Link-Bauteile.
function useGuardedLinkClick(
  to: To,
  options: NavigateOptions,
  target: string | undefined,
  onClick: ((e: ReactMouseEvent<HTMLAnchorElement>) => void) | undefined,
): (e: ReactMouseEvent<HTMLAnchorElement>) => void {
  const guardedNavigate = useGuardedNavigate();
  return (e: ReactMouseEvent<HTMLAnchorElement>): void => {
    onClick?.(e);
    // Ein eigener Handler, der schon abgebrochen hat (z. B. ein Drawer, der sich zuerst schließt und
    // selbst navigiert), behält das letzte Wort.
    if (e.defaultPrevented || isBrowserOwnedClick(e, target)) {
      return;
    }
    e.preventDefault();
    guardedNavigate(to, options);
  };
}

export function GuardedNavLink({
  to,
  onClick,
  replace,
  state,
  preventScrollReset,
  relative,
  target,
  ...rest
}: NavLinkProps): JSX.Element {
  const handleClick = useGuardedLinkClick(
    to,
    navigateOptionsFrom({ replace, state, preventScrollReset, relative }),
    target,
    onClick,
  );
  return <NavLink {...rest} to={to} target={target} onClick={handleClick} />;
}

export function GuardedLink({
  to,
  onClick,
  replace,
  state,
  preventScrollReset,
  relative,
  target,
  ...rest
}: LinkProps): JSX.Element {
  const handleClick = useGuardedLinkClick(
    to,
    navigateOptionsFrom({ replace, state, preventScrollReset, relative }),
    target,
    onClick,
  );
  return <Link {...rest} to={to} target={target} onClick={handleClick} />;
}
