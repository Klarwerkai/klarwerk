import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
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
import { useModalBoundary } from "./ModalBoundaryContext";
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

// ── JOB 3572 RUNDE 2 (bens Korrekturpflicht 1): DER GRUND GEHÖRT IN DEN DIALOG ────────────────────
//
// DER BEFUND. Scheitert das Speichern aus dem Dialog heraus, bleibt der Dialog offen — richtig, damit
// nichts verloren geht. Der GRUND stand bis hierher aber ausschliesslich im Fehlerkasten der SEITE
// (`Capture.tsx` `err`). Sobald der Dialog offen ist, sperrt die Modalgrenze den Hintergrund per
// `inert` (`ModalBoundaryContext.tsx:121`) — für Tastatur und Screenreader ist dieser Kasten dann
// nicht vorhanden. Der Mensch stand also vor einem Dialog, der beim Klicken nichts tut und nichts
// sagt. Gemessen von Ben in Runde 1 mit echter Grenze: `{"gefunden":true,"inert":true,"imDialog":false}`.
//
// DIE BAUFORM. Der Grund reist MIT DEM FEHLER. Die Seite formuliert ihn weiterhin an genau einer
// Stelle (sie schreibt denselben Satz in ihren Fehlerkasten) und wirft ihn in dieser Hülle; die Wache
// zeigt ihn, solange ihr Dialog offen ist. KEIN neuer Text und keine zweite Formulierung: es ist
// Zeichen für Zeichen derselbe Satz.
//
// Warum eine eigene Fehlerklasse und nicht `e.message` von allem: ein unerwarteter Fehler (ein Bug im
// Rückruf, ein TypeError) trägt eine technische Meldung, die niemandem hilft und Innenleben ausplaudert.
// Nur ein AUSDRÜCKLICH formulierter Grund wird gezeigt; alles andere fällt auf `state.error` zurück.
export class NavGuardSaveError extends Error {
  constructor(grund: string) {
    super(grund);
    this.name = "NavGuardSaveError";
  }
}

export interface DirtyGuard {
  isDirty: () => boolean;
  save: () => Promise<void>;
  // AUFTRAG-mega5 Block A (bens Ship-Gate 1): Inhalte, die der Entwurf NICHT sichern kann, werden vor
  // dem Wechsel einzeln und verständlich benannt. Liefert die Liste dieser Inhalte (leer/fehlend =
  // alles sicherbar). Nicht leer ⇒ der Dialog bietet KEIN „Entwurf speichern und wechseln" an —
  // ein Speichern, das erfolgreich wegnavigiert und dabei Benanntes verliert, wäre eine Lüge.
  unsavableDirtyReasons?: () => string[];
  // JOB 4335 R4: WO IN DER FLÄCHE DIESE WACHE SITZT — und damit, wann sie speichert. Kleiner heisst
  // früher, also weiter aussen (`WACHE_FLAECHE` vor `WACHE_ARBEITSRAUM`). Fehlt die Angabe, gilt
  // `WACHE_FLAECHE`; für eine Seite mit nur einer Wache (`pages/Mobile.tsx:481`) ändert sich damit
  // nichts, und ihre `setGuard`-Signatur bleibt unberührt. Begründung am Verzeichnis unten.
  reihe?: number;
}

/** Die äussere Wache einer Fläche — sie speichert zuerst. Vorgabe für Anmelder ohne Angabe. */
export const WACHE_FLAECHE = 0;
/** Die innere Wache einer Fläche (der Arbeitsraum in der Fläche) — sie speichert zuletzt. */
export const WACHE_ARBEITSRAUM = 1;

interface NavGuardValue {
  // Eine Seite registriert (oder entfernt mit null) ihren Ungespeichert-Wächter.
  setGuard: (guard: DirtyGuard | null) => void;
  // Navigationsquellen leiten den Wechsel hier durch; bei „dirty" wird erst gefragt.
  guard: (proceed: () => void) => void;
}

// ==================================================================================================
// JOB 4335 RUNDE 2 — EIN PLATZ FÜR ZWEI ANMELDER WAR EIN VERLUSTPFAD.
// ==================================================================================================
//
// DER BEFUND (BEN, JOB 4335 Runde 1, Prüfpunkte 4 und 5; im echten Browser gegen echtes PostgreSQL
// gemessen). Bis hierher hielt dieser Anbieter GENAU EINEN `DirtyGuard` in einem Ref, und `setGuard`
// überschrieb ihn. Auf `/erfassen` melden sich aber ZWEI an — das Blatt (`Blatt.tsx:1526`) und der
// Arbeitsraum (`pages/Capture.tsx:3199`) —, beide in einem Effekt, der an ihrer jeweiligen Mutation
// hängt und deshalb bei JEDEM Render ihres Bauteils neu läuft. Wer zuletzt lief, gewann; weil der
// Arbeitsraum im Baum UNTER dem Blatt hängt, gewann bei jedem gemeinsamen Render das Blatt.
//
// WAS DAS DEN MENSCHEN KOSTETE: Er lud eine Datei, drückte „Entwurf speichern und wechseln" — und
// gespeichert wurde der Blattstand, nicht seine Datei. Die Quittung sagte danach „verworfen", und
// die Datei war weg. Ein Knopf, der eine Sicherung zusagt und eine andere leistet, ist schlimmer als
// gar kein Knopf: er erzeugt Vertrauen, das nicht gedeckt ist.
//
// DIE REGEL AB HIER: der Anbieter führt ein VERZEICHNIS angemeldeter Wachen, nicht einen Platz.
// Jede Anmeldung hat ihre eigene Kennung (s. `useNavGuard` unten) und überschreibt nur sich selbst;
// eine Abmeldung nimmt nur die eigene heraus. Gefragt wird, wenn IRGENDEINE etwas zu verlieren hat;
// benannt werden die nicht sicherbaren Inhalte ALLER; gespeichert wird bei ALLEN, die etwas zu
// sichern haben.
//
// WARUM `isDirty()` VOR DEM SPEICHERN GEFRAGT WIRD — der Unterschied zu vorher, und er ist tragend:
// bis hierher rief `saveAndGo` den einen Rückruf BEDINGUNGSLOS. Für eine einzelne Wache war das
// dasselbe (der Dialog geht nur auf, wenn sie schmutzig ist). Bei zweien wäre es ein neuer Schaden:
// die nicht geänderte Wache schriebe ihren Stand über den gespeicherten Entwurf, den sie gar nicht
// angefasst hat — genau das tat die Blatt-Wache im gemessenen Browserlauf mit dem offenen Entwurf.
// Wer nichts zu sichern hat, sichert nichts.
//
// DIE REIHENFOLGE IST VON AUSSEN NACH INNEN, und sie ist keine Geschmacksfrage: React meldet die
// Effekte von innen nach aussen ab, die ZULETZT angemeldete Wache ist also die ÄUSSERE (das Blatt).
// Gespeichert wird in umgekehrter Anmeldereihenfolge, damit der speziellere Stand des inneren
// Bauteils zuletzt schreibt und nicht vom allgemeineren des äusseren überschrieben wird.
// ==================================================================================================
// JOB 4335 RUNDE 4 — DIE REIHENFOLGE DARF NICHT AM RENDERVERLAUF HÄNGEN.
// ==================================================================================================
//
// DER BEFUND (BEN, Runde 3, Korrekturpflicht 1; eigene Sonde, Cloud-Lauf `eaf7aa00a5747669c72f4073`:
// `expected ['Arbeitsraum','Blatt'] to deeply equal ['Blatt','Arbeitsraum']`). Runde 2 las die
// Reihenfolge aus der EINFÜGEREIHENFOLGE der Map und drehte sie um. Das stimmte beim ersten Aufbau
// und nur dort: jede Anmeldung läuft in einem Effekt, der an einer Mutation hängt und deshalb bei
// jedem Render seines Bauteils neu läuft — und ihr Aufräumer meldet zuerst ab. `delete` + `set`
// schiebt den Eintrag ans ENDE der Map. Ein Render, den NUR das innere Bauteil macht, stellte es
// damit hinter das äussere, und die umgedrehte Liste begann plötzlich innen.
//
// DIE ANTWORT: die Position gehört der KENNUNG, nicht ihrem letzten Eintrag. Jede Kennung bekommt
// bei ihrer ERSTEN Anmeldung eine Ordnungszahl, und die behält sie — auch über Abmeldung und
// Neuanmeldung hinweg. Damit ist die Reihenfolge eine Eigenschaft des BAUMS (wer zuerst anmeldet,
// sitzt weiter innen, weil React die Effekte von innen nach aussen abarbeitet) und nicht mehr eine
// Eigenschaft des Renderverlaufs.
//
// GESPEICHERT WIRD VON AUSSEN NACH INNEN — also in FALLENDER Ordnungszahl. Begründung unverändert:
// der speziellere Stand des inneren Bauteils soll zuletzt schreiben und nicht vom allgemeineren des
// äusseren überschrieben werden. Auf `/erfassen` heisst das: Blatt vor Arbeitsraum.
//
// WAS DAS VERZEICHNIS NICHT VERGISST: die Ordnungszahl einer abgemeldeten Kennung bleibt stehen.
// Das ist Absicht und kein Leck — `useId` vergibt je Baumstelle EINE Kennung, ein Bauteil bekommt
// beim Wiedereinhängen an derselben Stelle dieselbe zurück und damit auch seine alte Position. Die
// Zahl der je Sitzung möglichen Kennungen ist die Zahl der Baumstellen, nicht die der Renders.
interface AngemeldeteWache {
  wache: DirtyGuard;
  /** Vergeben bei der ERSTEN Anmeldung dieser Kennung; überlebt Ab- und Neuanmeldung. */
  ordnung: number;
}

type WachenVerzeichnis = {
  angemeldet: Map<string, AngemeldeteWache>;
  /** Die einmal vergebenen Ordnungszahlen — auch für gerade abgemeldete Kennungen. */
  ordnungen: Map<string, number>;
  naechsteOrdnung: number;
};

function leeresVerzeichnis(): WachenVerzeichnis {
  return { angemeldet: new Map(), ordnungen: new Map(), naechsteOrdnung: 0 };
}

interface NavGuardIntern {
  // Jede Anmeldung trägt ihre eigene Kennung — `null` meldet genau diese wieder ab.
  registriereWache: (kennung: string, wache: DirtyGuard | null) => void;
  guard: (proceed: () => void) => void;
}

const NavGuardCtx = createContext<NavGuardIntern | null>(null);

/**
 * Die angemeldeten Wachen in Speicherreihenfolge: von aussen nach innen.
 *
 * ZWEI SCHLÜSSEL, und der erste ist der belastbare: die ANGEMELDETE REIHE (`WACHE_FLAECHE` vor
 * `WACHE_ARBEITSRAUM`). Sie steht im Quelltext des Anmelders und kann von keinem Renderverlauf und
 * keinem Aus- und Wiedereinhängen bewegt werden — genau das verlangt BENs Korrekturpflicht 1 aus
 * Runde 3. Auf `/erfassen` ist damit festgeschrieben: das Blatt (`Blatt.tsx`) speichert vor dem
 * Arbeitsraum (`pages/Capture.tsx`).
 *
 * DER ZWEITE SCHLÜSSEL gilt Anmeldern in DERSELBEN Reihe (und damit allen, die keine angeben): die
 * Ordnungszahl der Kennung, absteigend. React arbeitet die Effekte von innen nach aussen ab, die
 * zuerst vergebene Ordnungszahl gehört also dem inneren Bauteil — absteigend sortiert steht das
 * äussere vorn. Weil die Zahl der KENNUNG gehört und nicht ihrem letzten Eintrag, überlebt sie Ab-
 * und Neuanmeldung (`registriereWache` unten).
 */
function wachenVonAussen(verzeichnis: WachenVerzeichnis): DirtyGuard[] {
  return [...verzeichnis.angemeldet.values()]
    .sort(
      (a, b) =>
        (a.wache.reihe ?? WACHE_FLAECHE) - (b.wache.reihe ?? WACHE_FLAECHE) ||
        b.ordnung - a.ordnung,
    )
    .map((eintrag) => eintrag.wache);
}

/**
 * Die nicht sicherbaren Inhalte ALLER angemeldeten Wachen, ohne Dubletten. Ohne die Vereinigung
 * verschwiege der Dialog die Grenze der einen Wache, sobald eine zweite angemeldet ist — und die
 * Verlustsperre (`unsavable.length > 0` ⇒ kein Speicherknopf) hinge daran, wer zuletzt gerendert
 * hat. Genau diese Abhängigkeit ist der Befund, den dieser Block abstellt.
 */
function alleUnsicherbaren(verzeichnis: WachenVerzeichnis): string[] {
  const gesehen = new Set<string>();
  for (const wache of wachenVonAussen(verzeichnis)) {
    for (const grund of wache.unsavableDirtyReasons?.() ?? []) {
      gesehen.add(grund);
    }
  }
  return [...gesehen];
}

// ── JOB 1850 (A-1265-NAVGUARD): der Dialog gehört in die Modalgrenze ───────────────────────────────
//
// Der Anbieter steht ABSICHTLICH oberhalb der Fehlergrenze (App.tsx:96-98) und damit oberhalb der
// Shell — die Modalgrenze entsteht aber IN der Shell (AppShell.tsx:4-6). Beide Zusicherungen bleiben
// stehen: statt eine von beiden zu verschieben, meldet die Shell ihre Grenze hier herauf, und nur der
// RENDERORT des Dialogs wandert (per Portal in `<main>`). Fehlt die Grenze — genau der Absturzfall,
// für den der Anbieter oben steht —, rendert der Dialog unverändert an seinem alten Platz weiter.
//
// Bewusst strukturell typisiert statt `ModalBoundaryValue` importiert: dieser Wächter braucht nur
// `host` und `enter`, und `ModalBoundaryContext` exportiert seinen Wertetyp nicht.
interface GuardModalBoundary {
  host: () => HTMLElement | null;
  enter: (surface: {
    panel: () => HTMLElement | null;
    trigger: () => HTMLElement | null;
  }) => () => void;
}

const NavGuardBoundaryCtx = createContext<((grenze: GuardModalBoundary | null) => void) | null>(
  null,
);

/**
 * Reicht die Modalgrenze der Shell an den weiter oben hängenden NavGuard-Anbieter hoch.
 * Gehört INNERHALB von `<ModalBoundaryProvider>` (AppShell), rendert selbst nichts.
 */
export function NavGuardModalBoundaryBridge(): null {
  const melde = useContext(NavGuardBoundaryCtx);
  const { host, enter } = useModalBoundary();
  useEffect(() => {
    if (!melde) {
      return undefined;
    }
    melde({ host, enter });
    return () => melde(null);
  }, [melde, host, enter]);
  return null;
}

/**
 * JOB 4335 RUNDE 2: DIE KENNUNG DER ANMELDUNG ENTSTEHT HIER — und nicht beim Aufrufer.
 *
 * Damit bleibt `setGuard(guard | null)` für jeden Aufrufer Zeichen für Zeichen dasselbe (drei gibt
 * es: `Blatt.tsx:1526`, `pages/Capture.tsx:3199`, `pages/Mobile.tsx:481` — der letzte ist nicht
 * Zielpfad dieses Auftrags und durfte sich deshalb nicht ändern). `useId` ist je Bauteil-Instanz
 * stabil und über Renders hinweg dasselbe: dieselbe Instanz überschreibt also ihre eigene Anmeldung,
 * eine zweite Instanz bekommt ihren eigenen Eintrag, und die Abmeldung im Effekt-Aufräumer trifft
 * genau den eigenen. Eine Kennung, die der Aufrufer selbst vergeben müsste, wäre eine Gelegenheit,
 * sie zu vergessen oder zweimal zu vergeben.
 */
function mitKennung(intern: NavGuardIntern, kennung: string): NavGuardValue {
  return {
    setGuard: (wache) => intern.registriereWache(kennung, wache),
    guard: intern.guard,
  };
}

export function useNavGuard(): NavGuardValue {
  const value = useContext(NavGuardCtx);
  const kennung = useId();
  const nachAussen = useMemo(() => (value ? mitKennung(value, kennung) : null), [value, kennung]);
  if (!nachAussen) {
    throw new Error("useNavGuard must be used within NavGuardProvider");
  }
  return nachAussen;
}

// JOB 3390 (LADEFEHLER-ALTER-TAB): DERSELBE Wächter, nur ohne Zusicherung — für die eine Stelle, die
// nicht selbst abstürzen darf.
//
// `useNavGuard` oben WIRFT bewusst, und das bleibt so: jeder gewöhnliche Aufrufer sitzt garantiert
// unter `NavGuardProvider` (`App.tsx:107`), und ein stilles `null` wäre dort ein Entwurfsschutz, der
// einfach nicht greift — der lauteste Fehler ist der beste. Die Fehlergrenze
// (`components/ErrorBoundary.tsx`) ist die AUSNAHME: sie ist die letzte Auffanglinie, und wirft sie
// beim Rendern ihrer eigenen Karte, ist genau die weisse Seite zurück, gegen die sie gebaut wurde —
// diesmal ohne eine Grenze darüber, die das noch fangen könnte.
//
// OHNE ANBIETER GEHT NICHTS VERLOREN: ohne ihn kann sich auch kein `DirtyGuard` angemeldet haben
// (`setGuard` ist nur über diesen Kontext erreichbar). Der Aufrufer darf dann also direkt handeln.
export function useNavGuardOptional(): NavGuardValue | null {
  const value = useContext(NavGuardCtx);
  const kennung = useId();
  return useMemo(() => (value ? mitKennung(value, kennung) : null), [value, kennung]);
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
  // JOB 4335 R2: das VERZEICHNIS der angemeldeten Wachen (Begründung am Typ oben). Ein Ref und kein
  // State: die Anmeldung geschieht in Effekten und darf keinen Render auslösen, und der POP-Wächter
  // unten liest sie ausserhalb von React.
  const wachenRef = useRef<WachenVerzeichnis>(leeresVerzeichnis());
  const [pending, setPending] = useState<PendingNav | null>(null);
  const [saving, setSaving] = useState(false);
  // JOB 3572 Runde 2: der Grund des zuletzt gescheiterten Speicherversuchs AUS DIESEM DIALOG —
  // `null`, solange nichts gescheitert ist. Er steht hier und nicht in einem Ref, weil der Dialog
  // ihn beim nächsten Render zeigen muss (Begründung an `NavGuardSaveError`).
  const [saveError, setSaveError] = useState<string | null>(null);
  // AUFTRAG-mega5 Block A: beim Öffnen des Dialogs EINMAL eingefroren — die Liste ändert sich nicht
  // mitten im offenen Dialog (kein Knopf, der unter dem Zeiger erscheint/verschwindet).
  const [unsavable, setUnsavable] = useState<string[]>([]);

  // JOB 1850 hat die Modalgrenze hier eingeführt: Anmeldung, Portal-Anker, Anfangsfokus und
  // Fokusrückgabe standen als EIGENE Mechanik in diesem Anbieter — die einzige der sieben Flächen,
  // die sie hatte.
  //
  // JOB 1900 (Chef-Entscheidung 22.08.2026, Variante (b)): sie steht jetzt EINMAL in `Modal.tsx`
  // und gilt damit für alle sieben. Dieser Anbieter gibt seine eigene Verdrahtung deshalb ab —
  // nicht weil sie falsch war, sondern weil zwei Mechaniken für dasselbe Problem in JOB 1851 D6
  // (Läufe B und C) als stille Ablösung gemessen wurden.
  //
  // Die drei Zusicherungen aus JOB 1850 bleiben unangetastet und werden weiter geprüft: die Fläche
  // liegt im Portal-Anker `<main>`, der Hintergrund ist gesperrt, der Fokus geht hinein und beim
  // Schließen auf den Auslöser zurück. Sie werden nur nicht mehr von hier erfüllt, sondern von der
  // einen Grenze. Die Marke `data-navguard-dialog` reist dafür auf das Panel des `Modal`.
  //
  // `NavGuardBoundaryCtx` und die Brücke bleiben bestehen, und sie sind hier nicht Beiwerk, sondern
  // notwendig: dieser Anbieter hängt in `App.tsx:99` OBERHALB von `ModalBoundaryProvider` — bewusst,
  // damit der Dialog einen Seitenabsturz überlebt. Über den Kontext erreicht ihn die Grenze deshalb
  // nicht; sie wird ihm heraufgemeldet und von hier an `Modal` weitergereicht.
  const [boundary, setBoundary] = useState<GuardModalBoundary | null>(null);

  // Der POP-Handler läuft AUSSERHALB von React (Fenster-Ereignis) und braucht den Dialog-Zustand
  // synchron — zwei schnelle Zurück-Klicks liegen in getrennten Aufgaben, aber vor dem nächsten
  // Render. Darum die Wahrheit im Ref, die Anzeige im State.
  const pendingRef = useRef<PendingNav | null>(null);
  const applyPending = useCallback((next: PendingNav | null): void => {
    pendingRef.current = next;
    setPending(next);
    // JOB 3572 Runde 2: jeder Wechsel des Slots räumt den Fehlergrund. Ein Grund aus einem
    // vorherigen Versuch darf weder in einem frisch geöffneten Dialog stehen noch nach dem
    // Schliessen weiterleben — er gehört genau zu DIESEM offenen Dialog.
    setSaveError(null);
  }, []);

  // JOB 4335 R2: ANMELDEN UND ABMELDEN TREFFEN NUR DEN EIGENEN EINTRAG. Das ist der ganze Kern des
  // Befunds: `guardRef.current = guard` liess die zweite Anmeldung die erste verschlucken, und ein
  // `setGuard(null)` beim Abbau der einen nahm auch die andere mit.
  //
  // JOB 4335 R4: UND DIE POSITION GEHÖRT DER KENNUNG, NICHT DEM EINTRAG (Begründung am Verzeichnis
  // oben). Eine Neuanmeldung derselben Kennung nimmt ihre alte Ordnungszahl wieder ein; nur eine
  // Kennung, die es noch nie gab, bekommt eine neue.
  const registriereWache = useCallback((kennung: string, wache: DirtyGuard | null): void => {
    const verzeichnis = wachenRef.current;
    if (wache === null) {
      verzeichnis.angemeldet.delete(kennung);
      return;
    }
    let ordnung = verzeichnis.ordnungen.get(kennung);
    if (ordnung === undefined) {
      ordnung = verzeichnis.naechsteOrdnung;
      verzeichnis.naechsteOrdnung += 1;
      verzeichnis.ordnungen.set(kennung, ordnung);
    }
    verzeichnis.angemeldet.set(kennung, { wache, ordnung });
  }, []);

  /** Hat IRGENDEINE angemeldete Wache etwas zu verlieren? */
  const irgendetwasSchmutzig = useCallback(
    (): boolean => wachenVonAussen(wachenRef.current).some((wache) => wache.isDirty()),
    [],
  );

  const guard = useCallback(
    (proceed: () => void): void => {
      if (irgendetwasSchmutzig()) {
        setUnsavable(alleUnsicherbaren(wachenRef.current));
        applyPending({ proceed, cancel: () => {} });
      } else {
        proceed();
      }
    },
    [applyPending, irgendetwasSchmutzig],
  );

  // Der Kontextwert als EIN stabiler Begriff: `useNavGuard` hängt ihn in ein `useMemo`, und ein bei
  // jedem Render neu gebautes Objekt liesse dort jede Anmeldung neu laufen.
  const kontextwert = useMemo<NavGuardIntern>(
    () => ({ registriereWache, guard }),
    [registriereWache, guard],
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
        irgendetwasSchmutzig() && target.pathname !== anchorRef.current.pathname,
      go: (delta) => window.history.go(delta),
      showDialog: () => {
        // Es ist bereits ein Dialog offen (Klick auf eine Navigationsquelle): kein zweiter (Kante 3).
        if (pendingRef.current !== null) {
          return false;
        }
        setUnsavable(alleUnsicherbaren(wachenRef.current));
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

  // ── JOB 3572: KEIN AUSGANG, SOLANGE AUS DIESEM DIALOG HERAUS GESCHRIEBEN WIRD ──────────────────
  //
  // Es ist BENS BEFUND aus JOB 3526 (Runde 2, Korrekturpflicht 1) — nur an der anderen Stelle. Für
  // den Knopf AUF DER SEITE ist er dort geschlossen (`Capture.tsx`: `verlassenGesperrt`, Sperre am
  // Knopf UND im Handler); IM Dialog stand er offen: `saveAndGo` setzt `saving`, wartet auf
  // `active.save()` und wechselt erst danach — in genau diesem Fenster war „Verwerfen und wechseln"
  // anklickbar. Wer ihn drückte, wurde weggeschickt, und der laufende Schreibvorgang überschrieb
  // danach genau den Entwurf, den dieser Knopf zu erhalten versprach.
  //
  // DIE ZUSAGE HÄNGT AM KNOPF, NICHT AM VORGANG: auf ihm steht „der gespeicherte Entwurf bleibt
  // unverändert erhalten" (`capture.leaveDraft.keepsDraftHint`). Ein Ausgang, der eine Zusage macht,
  // die ein laufender Vorgang gleich darauf bricht, ist schlimmer als kein Ausgang.
  //
  // AN BEIDEN ENDEN, dieselbe Bauform wie auf der Seite: sichtbar am Knopf (`disabled`) und wirksam
  // hier im Handler (Tastatur, Klick im selben Tick). EIN Wahrheitsort: beides liest DAS `saving`,
  // das `saveAndGo` unten setzt und in `finally` zurücknimmt — kein zweites Flag, kein Ref daneben.
  // `runPending` selbst bleibt bewusst ungesperrt: der Erfolgsweg von `saveAndGo` läuft durch
  // dieselbe Funktion, und zwar BEVOR `finally` `saving` löscht.
  const discardAndGo = (): void => {
    if (saving) {
      return;
    }
    runPending();
  };

  const saveAndGo = async (): Promise<void> => {
    // JOB 4335 R2: ALLE angemeldeten Wachen, von aussen nach innen, und jede nur dann, wenn SIE
    // etwas zu sichern hat (Begründung am Verzeichnis-Block oben). Scheitert eine, wirft sie — der
    // Fang unten hält den Dialog offen, die folgenden laufen gar nicht erst an, und es wird nicht
    // gewechselt. Das ist dieselbe Zusage wie bisher, nur für mehr als einen Anmelder.
    const wachen = wachenVonAussen(wachenRef.current);
    if (wachen.length === 0) {
      runPending();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      for (const wache of wachen) {
        if (!wache.isDirty()) {
          continue;
        }
        await wache.save();
      }
      runPending();
    } catch (e) {
      // Speichern fehlgeschlagen: Dialog offen lassen, nicht wechseln, damit nichts verloren geht.
      //
      // JOB 3572, Lieferung 4: DIESER Zweig ist gemessen, in beiden Spielarten — der Server lehnt ab
      // (`tests/entwurf-verlassen/dialog-speicherfall-mounted.test.tsx`, Fall D4) und das Speichertor
      // der Seite ist zu, bevor der Dialog aufgeht (Fall D5). Beide Male steht danach genau EIN
      // Dialog, die Adresse ist unverändert, der Bestand ist unverändert.
      //
      // RUNDE 2 (bens Korrekturpflicht 1): und der Grund steht IM Dialog. Vorher stand hier „die
      // Seite zeigt die Fehlermeldung" — das stimmte im DOM und war für den Menschen falsch: die
      // Seite liegt in diesem Augenblick im gesperrten Hintergrund (Begründung an
      // `NavGuardSaveError`). Gezeigt wird nur ein ausdrücklich formulierter Grund; sonst der
      // allgemeine Satz, den die App überall für unerklärte Fehler benutzt.
      setSaveError(e instanceof NavGuardSaveError ? e.message : t("state.error"));
    } finally {
      setSaving(false);
    }
  };

  // JOB 1900: Anmeldung an der Grenze, Portal-Anker, Anfangsfokus und Fokusrückgabe standen hier
  // als zwei Effekte. Sie stehen jetzt in `Modal.tsx` — einmal für alle sieben Flächen. Was hier
  // bleibt, ist der Dialog selbst.

  // Nur solange etwas ansteht: geschlossen darf keine Bediengrenze im Baum stehen bleiben, sonst
  // fände `panel()` beim nächsten Öffnen einen Knoten von vorhin.
  const dialog =
    pending === null ? null : (
      <Modal
        open={pending !== null}
        onClose={close}
        title={unsavable.length > 0 ? t("nav.guard.unsavableTitle") : t("nav.guard.title")}
        // JOB 1850 sucht die Fläche über diese Marke und verlangt, dass sie im Portal-Anker liegt,
        // den Dialogtext trägt und den Fokus enthält. Auf dem Panel erfüllt sie alle drei.
        panelMarker="data-navguard-dialog"
        grenze={boundary}
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
                  Weggehen aus Erfassen UND aus Mobil — er erklärt beide Live-Befunde auf einmal.
                  JOB 3572: hier steht bewusst KEINE Speicher-Sperre. In diesem Zweig gibt es kein
                  „Entwurf speichern und wechseln" (genau das ist sein Zweck), also läuft `saveAndGo`
                  nie an und `saving` ist hier beweisbar falsch — ein `disabled={saving}` wäre
                  Zierrat, der eine Bedingung vorspiegelt, die es an dieser Stelle nicht gibt. */}
              <Button variant="danger" onClick={runPending}>
                {t("nav.guard.discard")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-text">{t("nav.guard.body")}</p>
            {/* JOB 3572 Runde 2 (bens Korrekturpflicht 1): der Grund des gescheiterten Speicherns —
                HIER, im Dialog, der den Fokus hält, und nicht im Fehlerkasten der Seite, den die
                Modalgrenze in diesem Augenblick per `inert` gesperrt hat. `role="alert"`, damit er
                auch angesagt wird und nicht nur dasteht; die Marke ist der Messpunkt der Tests. */}
            {saveError === null ? null : (
              <p
                role="alert"
                data-navguard-save-error=""
                className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-crit-text"
              >
                {saveError}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                {t("nav.guard.stay")}
              </Button>
              {/* AUFTRAG-mega14 Block F (SCRUM-412): DER Fund des Live-Tests. Im echten Browser
                  gemessen: „Verwerfen und wechseln" rendert rgb(104,112,120) — Zeichen für Zeichen
                  dieselbe Farbe wie „Hier bleiben" daneben. Unterscheidbar waren die beiden allein
                  am Text, und hinter einem davon liegt Datenverlust. Dieser Dialog ist zugleich das
                  Weggehen aus Erfassen UND aus Mobil — er erklärt beide Live-Befunde auf einmal.
                  JOB 3572: und er ist zu, solange aus diesem Dialog heraus geschrieben wird
                  (Begründung an `discardAndGo`). */}
              <Button variant="danger" disabled={saving} onClick={discardAndGo}>
                {t("nav.guard.discard")}
              </Button>
              <Button variant="primary" disabled={saving} onClick={() => void saveAndGo()}>
                {t("nav.guard.save")}
              </Button>
            </div>
          </>
        )}
      </Modal>
    );

  return (
    <NavGuardCtx.Provider value={kontextwert}>
      <NavGuardBoundaryCtx.Provider value={setBoundary}>
        {/* Nur MIT Router: dort hält er den Anker (Ort + History-Index) für den Zurück-Wächter nach. */}
        {inRouter ? <AnchorTracker onLocation={trackAnchor} /> : null}
        {children}
        {/* JOB 1850: MIT Modalgrenze hängt der Dialog im Portal-Anker der Shell (`<main>`) und trägt
            damit Hintergrundsperre und Fokusführung; OHNE sie rendert er unverändert an seinem
            angestammten Platz — der Absturzfall aus App.tsx:96-98 bleibt bedienbar.
            JOB 1900: beides tut jetzt `Modal` selbst, für alle sieben Flächen gleich. Hier steht
            der Dialog deshalb schlicht da, und das Portal liegt eine Ebene tiefer. */}
        {dialog}
      </NavGuardBoundaryCtx.Provider>
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
