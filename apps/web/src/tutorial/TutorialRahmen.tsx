// ================================================================================================
// FE-003 · DER TUTORIAL-RAHMEN IN DER HÜLLE — Knopf unter dem Kopfband, Bereich über der Seite.
// ================================================================================================
//
// DREI TEILE, EIN ZUSTAND:
//   · `TutorialProvider` hält, ob das Tutorial der AKTUELLEN Route offen ist. Ein Routenwechsel
//     unterbricht es mit Rückweg zum konkreten Seitenobjekt; derselbe Schritt wird pausiert übergeben.
//   · `TutorialEinstieg` ist die Leiste direkt unter dem schwarzen Kopfband, links unter dem
//     KLARWERK-Schriftzug, mit dem Knopf „Tutorial“ (Ticket FE-003, „Einstieg und Darstellung“).
//     Die Hülle stellt sie zwischen Kopfband und `<main>`; sie scrollt nicht mit.
//   · `TutorialFlaeche` steht OBEN IN `<main>`, als Geschwister VOR dem Seiteninhalt. Aufklappen
//     schiebt die Seite nach unten — es ersetzt sie nicht, und die Seite wird dabei NICHT neu
//     montiert: ihre Frage, ihre Antwort und jede Eingabe bleiben stehen (Kriterium 1).
//
// OHNE TUTORIAL FÜR DIE ROUTE RENDERN ALLE DREI NICHTS — kein Knopf, keine Leiste, kein leerer
// Bereich (Kriterium 7). Welche Route eins hat, steht allein im Register (`rahmen.ts`).
import { GraduationCap } from "lucide-react";
import {
  type MutableRefObject,
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
import { useLocation, useNavigate } from "react-router-dom";
import { useRoleOptional } from "../app/RoleContext";
import { TutorialBereich } from "./TutorialBereich";
import { type TutorialFernLage, TutorialMeldungCtx } from "./fernsteuerung";
import { tutorialFuerPfad } from "./rahmen";
import type { TutorialDefinition, TutorialSchrittstand } from "./typen";

interface TutorialUnterbrechung {
  ort: string;
  definitionId: string;
  titel: string;
  stand?: TutorialSchrittstand | undefined;
}

interface TutorialLage {
  definition: TutorialDefinition | null;
  offen: boolean;
  bereichId: string;
  knopfRef: MutableRefObject<HTMLButtonElement | null>;
  umschalten: () => void;
  /** KLARA-VORSCHAU: öffnet das Tutorial der Seite (ohne Umschalten). */
  oeffnen: () => void;
  /** `mitFokus`: der Fokus kehrt zum Knopf „Tutorial“ zurück (Ausgangspunkt). */
  schliessen: (mitFokus: boolean) => void;
  /** KLARA-VORSCHAU: die gemeldete Lage des offenen Bereichs (`fernsteuerung.ts`). */
  fernLage: TutorialFernLage | null;
  startstand?: TutorialSchrittstand | undefined;
  beiStand?: ((stand: TutorialSchrittstand) => void) | undefined;
  unterbrochen?: { pfad: string; titel: string; zurueck: () => void } | undefined;
  ort?: string;
}

const LEER: TutorialLage = {
  definition: null,
  offen: false,
  bereichId: "",
  knopfRef: { current: null },
  umschalten: () => {},
  oeffnen: () => {},
  schliessen: () => {},
  fernLage: null,
};

const TutorialCtx = createContext<TutorialLage>(LEER);

export function TutorialProvider({ children }: { children: ReactNode }): JSX.Element {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const ort = pathname + search + hash;
  const rolle = useRoleOptional();
  const definition = tutorialFuerPfad(pathname, rolle?.role ?? "viewer", rolle?.stufe2 ?? false);
  const [offen, setOffen] = useState(false);
  const [fernLage, setFernLage] = useState<TutorialFernLage | null>(null);
  const knopfRef = useRef<HTMLButtonElement | null>(null);
  const bereichId = useId();
  const aktuellRef = useRef<{
    ort: string;
    url: string;
    definition: TutorialDefinition | null;
    offen: boolean;
    stand?: TutorialSchrittstand | undefined;
  }>({ ort: `${ort}|${rolle?.role ?? "viewer"}`, url: ort, definition, offen });
  const [unterbrochen, setUnterbrochen] = useState<TutorialUnterbrechung | null>(null);
  const rueckkehrRef = useRef<TutorialUnterbrechung | null>(null);
  const beiStand = useCallback((stand: TutorialSchrittstand) => {
    aktuellRef.current.stand = stand;
  }, []);
  // Nur flüchtiger Komponentenstand derselben Engine. Seitenobjekte und Rolle sind Teil der Bindung.
  const rollenOrt = `${ort}|${rolle?.role ?? "viewer"}`;
  useEffect(() => {
    const vorher = aktuellRef.current;
    if (vorher.ort !== rollenOrt) {
      if (vorher.offen && vorher.definition)
        setUnterbrochen({
          ort: vorher.url,
          definitionId: vorher.definition.id,
          titel: vorher.definition.titelKey,
          stand: vorher.stand,
        });
      setOffen(false);
      const rueckkehr = rueckkehrRef.current;
      aktuellRef.current = {
        ort: rollenOrt,
        url: ort,
        definition,
        offen: false,
        stand:
          rueckkehr?.ort === ort && rueckkehr.definitionId === definition?.id
            ? rueckkehr.stand
            : undefined,
      };
      rueckkehrRef.current = null;
    }
  }, [rollenOrt, definition, ort]);
  useEffect(() => {
    aktuellRef.current.offen = offen;
    aktuellRef.current.definition = definition;
  }, [offen, definition]);
  const startstand =
    unterbrochen?.ort === ort && unterbrochen.definitionId === definition?.id
      ? unterbrochen.stand
      : undefined;
  const umschalten = useCallback(() => setOffen((v) => !v), []);
  const oeffnen = useCallback(() => setOffen(true), []);
  const schliessen = useCallback((mitFokus: boolean) => {
    // Der Knopf steht ausserhalb des Bereichs und bleibt stehen — der Fokus kann sofort dorthin,
    // bevor der Bereich (und mit ihm der Schliessen-Knopf) verschwindet.
    if (mitFokus) {
      knopfRef.current?.focus();
    }
    setOffen(false);
  }, []);
  const offenAktuell = offen && aktuellRef.current.ort === rollenOrt;
  const wert = useMemo<TutorialLage>(
    () => ({
      definition,
      offen: offenAktuell,
      bereichId,
      knopfRef,
      umschalten,
      oeffnen,
      schliessen,
      fernLage: offenAktuell ? fernLage : null,
      startstand: startstand ?? aktuellRef.current.stand,
      beiStand,
      ort: rollenOrt,
      unterbrochen:
        unterbrochen && unterbrochen.ort !== ort
          ? {
              pfad: unterbrochen.ort,
              titel: unterbrochen.titel,
              zurueck: () => {
                rueckkehrRef.current = unterbrochen;
                navigate(unterbrochen.ort);
              },
            }
          : undefined,
    }),
    [
      definition,
      offenAktuell,
      bereichId,
      umschalten,
      oeffnen,
      schliessen,
      fernLage,
      startstand,
      beiStand,
      rollenOrt,
      unterbrochen,
      ort,
      navigate,
    ],
  );
  return (
    <TutorialCtx.Provider value={wert}>
      <TutorialMeldungCtx.Provider value={setFernLage}>{children}</TutorialMeldungCtx.Provider>
    </TutorialCtx.Provider>
  );
}

/**
 * KLARA-VORSCHAU: was Klara vom Tutorial der aktuellen Seite braucht — ob es eins gibt, ob es offen
 * ist, wie es steht, und wie man es öffnet. Ausserhalb eines `TutorialProvider` ist alles leer.
 */
export function useTutorialFuerKlara(): {
  vorhanden: boolean;
  offen: boolean;
  oeffnen: () => void;
  lage: TutorialFernLage | null;
} {
  const { definition, offen, oeffnen, fernLage } = useContext(TutorialCtx);
  return { vorhanden: definition !== null, offen, oeffnen, lage: fernLage };
}

/** Die Leiste unter dem Kopfband mit dem Knopf „Tutorial“ — nur auf Seiten mit Tutorial. */
export function TutorialEinstieg(): JSX.Element | null {
  const { t } = useTranslation();
  const { definition, offen, bereichId, knopfRef, umschalten, unterbrochen } =
    useContext(TutorialCtx);
  if (!definition && !unterbrochen) {
    return null;
  }
  // FE-002: das Kopfband hält bis 1279 px 16 px Seitenpolster (`LAPTOP_QUERY` in
  // `shell/Kopfband.tsx`), erst ab 1280 px 32 px. Die Leiste folgt derselben Grenze, damit der Knopf
  // auch bei Laptopbreite bündig unter dem Schriftzug steht.
  return (
    <div
      data-testid="tutorial-leiste"
      className="print-hide shrink-0 border-b border-hairline bg-surface px-4 py-1.5 min-[1280px]:px-8"
    >
      {definition ? (
        <button
          ref={knopfRef}
          type="button"
          data-testid="tutorial-knopf"
          aria-expanded={offen}
          aria-controls={offen ? bereichId : undefined}
          title={t(offen ? "tutorial.knopf.schliessen" : "tutorial.knopf.oeffnen")}
          onClick={umschalten}
          className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-3 py-1 text-[13px] font-semibold text-ink shadow-tile hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <GraduationCap size={15} strokeWidth={2} aria-hidden="true" />
          {t("tutorial.knopf")}
        </button>
      ) : null}
      {unterbrochen ? (
        <button
          type="button"
          data-testid="tutorial-rueckkehr"
          className="ml-3 text-[13px] underline"
          onClick={unterbrochen.zurueck}
        >
          {t("seitentutorial.zurueck")} · {unterbrochen.pfad}
        </button>
      ) : null}
    </div>
  );
}

/** Der aufgeklappte Bereich — oben in `<main>`, vor dem Seiteninhalt. */
export function TutorialFlaeche(): JSX.Element | null {
  const { definition, offen, bereichId, schliessen, startstand, beiStand, ort } =
    useContext(TutorialCtx);
  if (!definition || !offen) {
    return null;
  }
  return (
    <TutorialBereich
      key={ort}
      definition={definition}
      id={bereichId}
      onSchliessen={schliessen}
      startstand={startstand}
      beiStand={beiStand}
    />
  );
}
