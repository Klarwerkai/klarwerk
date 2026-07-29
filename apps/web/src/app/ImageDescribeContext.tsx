import { type ReactNode, createContext, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type ReasonerProvenance, endpoints } from "../api/endpoints";
import type { DescribeImageResult } from "../api/types";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { draftProvenance } from "../lib/reasonerProvenance";
import { useAiAvailable } from "../lib/useAiAvailable";

// AUFTRAG-mega50 Block A — DER WEG ZUR BILDBESCHREIBUNG, EINMAL.
//
// DER VORFALL (Pedi, mehrfach gemeldet, 29.07.): auf der Vordertür fehlten am Bild das
// Eingabeformular (mega9 Block F) und der KI-Vorschlag (WP-BILD-1c). Beides war gebaut, beides war
// getestet, beides erschien dort nicht. Der Grund war kein Fehler in der Fachlichkeit, sondern ein
// OPTIONALER PROP: `onDescribeImage` am RichTextEditor. Zwei der vier Flächen übergaben ihn
// (Capture, KnowledgeDetail), zwei nicht (CaptureFrontDoor, KnowledgeInputStudio). Ohne ihn rendert
// der Editor den Knopf „Bildbeschreibung bearbeiten" gar nicht und `captionSuggestVisible` gibt
// false zurück — GERÄUSCHLOS. Kein Fehler, keine Konsole, nichts.
//
// Es ist dieselbe Klasse wie bens sammel45-Befund vom 28.07. (`FacetFilter` ohne `backgroundRef` in
// `ImportSelect`), eine Fläche weiter. Ein Vertrag, den man vergessen kann, wird vergessen.
//
// DIE BAUFORM IST DESHALB DIESELBE WIE IN mega48 (übernommen, nicht erfunden): ein Kontext in
// `app/`, montiert dort, wo die Wahrheit entsteht — die Komponente HOLT sich den Weg, sie bekommt
// ihn nicht mehr von ihrem Aufrufer gereicht. Damit hängt jeder Aufrufer daran, auch der, der nie
// etwas davon gehört hat, und eine fünfte Fläche morgen ebenso.
//
// WAS HIER LIEGT UND WAS BEIM AUFRUFER BLEIBT:
//   · HIER: der describe-Aufruf selbst, die Sprache (`toReasonerLocale`) und die Verfügbarkeit
//     (`useAiAvailable("describe")`). Das war in Capture.tsx und KnowledgeDetail.tsx zweimal
//     derselbe Block — zwei Kopien sind zwei Wahrheiten, die dritte und vierte durften nicht
//     dazukommen.
//   · BEIM AUFRUFER: die PROVENIENZ, also aus welchem Entwurf oder Wissensobjekt das Bild stammt.
//     Das ist das Einzige, was je Fläche wirklich verschieden ist. Eine Fläche, die mehr über die
//     Herkunft ihres Inhalts weiß, sagt es über einen geschachtelten Provider.
//
// WARUM DAS VERGESSEN DER PROVENIENZ NICHT DIESELBE FALLE IST: fehlt sie, gilt
// `draftProvenance(undefined)` — also `failSafeConfidentiality(undefined)` = „vertraulich", die
// SCHÄRFSTE Stufe (`lib/reasonerProvenance.ts`). Eine vergessene Provenienz kann damit nur
// EINSCHRÄNKEN (die Cloud-Kante fällt aus der Kette, `reasoner/service.ts`
// `cloudExcludedByConfidentiality`), niemals die Fläche still um ihr Formular bringen. Der Vorschlag
// erscheint weiterhin, nur eben lokal/deterministisch — mit dem ehrlichen Fallback-Grund, den es
// dafür schon gibt. Das ist genau die Umkehrung des Fehlers, der diesen Block ausgelöst hat.
//
// FAIL-CLOSED wie die Modalgrenze: `useImageDescribe()` wirft ohne Provider. Ein Editor, der außer-
// halb der App montiert wird, entsteht damit gar nicht erst still ohne Bildbeschreibung.
//
// Der Wächter dazu ist `tests/app/mega50-bildbeschreibung-sammler.test.tsx` — er erhebt die
// tatsächlichen Aufrufer aus dem Quellbaum, nicht eine Liste der heutigen vier Flächen.

export interface ImageDescribeValue {
  // Ist für die Aufgabe „describe" überhaupt ein Modell nutzbar? Steuert das harte Ausgrauen
  // (D-AISTATE Paket 1) — bisher der Prop `describeAvailable`, jetzt aus DERSELBEN Quelle für alle.
  available: boolean;
  // Der EINE describe-Aufruf. Zweites Argument ist der umgebende Klartext-Kontext (WP-BILD-1f), der
  // im selben Request und damit über dieselbe Vertraulichkeits-/Egress-Stelle reist wie das Bild.
  describe: (dataUrl: string, context?: string) => Promise<DescribeImageResult>;
}

const ImageDescribeCtx = createContext<ImageDescribeValue | null>(null);

// Die fail-safe Voreinstellung: getippter Entwurfsinhalt unbekannter Stufe → „vertraulich".
// Bewusst über `draftProvenance` gebaut und nicht als Objektliteral, damit diese Datei die
// Fail-Safe-Regel BENUTZT statt sie zu wiederholen.
const VORGABE_PROVENIENZ: ReasonerProvenance = draftProvenance(undefined);

/**
 * Für alles, was eine Bildbeschreibung ANBIETET (heute der RichTextEditor). Fehlt der Provider, ist
 * das ein Defekt und kein Zustand, um den herum gerendert wird — deshalb wirft der Zugriff, statt
 * die Bildbeschreibung still wegzulassen. Genau dieses stille Weglassen war der Befund.
 */
export function useImageDescribe(): ImageDescribeValue {
  const value = useContext(ImageDescribeCtx);
  if (!value) {
    throw new Error(
      "useImageDescribe muss innerhalb von <ImageDescribeProvider> verwendet werden — eine Fläche mit Bildern ohne Weg zur Bildbeschreibung darf es nicht geben.",
    );
  }
  return value;
}

/**
 * Der echte Provider. Ohne `provenance` gilt die fail-safe Vorgabe; eine Fläche, die die Herkunft
 * ihres Inhalts kennt, schachtelt einen zweiten mit ihrer eigenen.
 */
export function ImageDescribeProvider({
  provenance,
  children,
}: {
  provenance?: ReasonerProvenance | undefined;
  children: ReactNode;
}): JSX.Element {
  const { i18n } = useTranslation();
  const describeAi = useAiAvailable("describe");
  const locale = toReasonerLocale(i18n.language);
  const { source, confidentiality, koId } = provenance ?? VORGABE_PROVENIENZ;

  // Auf den PRIMITIVEN Feldern gemerkt, nicht auf der Objektidentität: `draftProvenance(...)` baut
  // bei jedem Render ein neues Objekt, sonst wechselte der Wert grundlos bei jedem Tastendruck.
  const value = useMemo<ImageDescribeValue>(
    () => ({
      available: describeAi.available,
      describe: (dataUrl, context) =>
        endpoints.reasoner.describeImage(
          dataUrl,
          locale,
          { source, confidentiality, ...(koId ? { koId } : {}) },
          context,
        ),
    }),
    [describeAi.available, locale, source, confidentiality, koId],
  );

  return <ImageDescribeCtx.Provider value={value}>{children}</ImageDescribeCtx.Provider>;
}

/**
 * Derselbe Kontext, aber mit fertigem Wert und OHNE Umgebung (kein QueryClient, kein i18n, kein
 * Netz). Die App benutzt ihn nicht — er ist die Naht für Tests, die den Editor isoliert montieren.
 * Vorher leistete das der Prop `describeAvailable` („als PROP, damit der Editor ohne
 * QueryClient-Provider isoliert testbar bleibt"); diese Zusage bleibt, sie hängt nur nicht mehr an
 * einem Vertrag, den ein echter Aufrufer vergessen kann.
 */
export function ImageDescribeValueProvider({
  value,
  children,
}: {
  value: ImageDescribeValue;
  children: ReactNode;
}): JSX.Element {
  return <ImageDescribeCtx.Provider value={value}>{children}</ImageDescribeCtx.Provider>;
}
