// ================================================================================================
// JOB 2476 · D1 — W1: DIE DOPPELUNG MIT EINER DRITTEN DATEI.
// ================================================================================================
//
// HERKUNFT. Der Gleichlauf-Waechter (`kd-capture-doppelungen.test.ts`) bewacht `KnowledgeDetail`
// gegen `Capture` — und nur diese zwei. Seine eigene Grenze K3(3) sagt das ausdruecklich:
//
//     „NUR DIESE ZWEI DATEIEN. Eine Doppelung zwischen `Capture.tsx` und einer DRITTEN Datei
//      ist fuer diesen Waechter unsichtbar — er liest genau zwei Wege und sonst keinen."
//
// Ich habe diese Grenze in JOB 2467 als `W1` in die Fundstellentabelle geschrieben. JOB 2476 hat
// nachgemessen, ob der Befund traegt. ER TRAEGT, und deutlicher als vermutet:
//
//     660 dritte Quelldateien geprueft (`apps/web/src` und `services`), 0 Parsefehler.
//     33 gedoppelte Bloecke ueber 13 dritte Dateien.
//     Der groesste hat 199 Knoten — mehr als DOPPELT so gross wie das groesste Paar
//     innerhalb der zwei bewachten Seiten (91).
//
// Anders gesagt: Die groesste Doppelung dieser Flaeche lag ausserhalb der Grundmenge des
// Waechters, der fuer Doppelungen gebaut wurde.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESER FALL HAELT
// ------------------------------------------------------------------------------------------------
//
//   Aendert jemand EINE Seite eines gedoppelten Blocks   -> die Groesse faellt aus der Liste -> rot
//   Aendert jemand BEIDE Seiten gleich                   -> die Liste haelt                  -> gruen
//   Kommt eine NEUE Fremddoppelung dazu                  -> sie fehlt im Register            -> rot
//
// Die dritte Zeile ist gewollt: Eine neue Doppelung soll eingetragen werden, bevor sie lebt.
//
// GEPINNT WIRD PRO DRITTER DATEI, nicht pro Block. Ein Register aus 33 Einzelzeilen mit
// Zeilennummern waere bei jeder Einfuegung darueber rot — und ein Waechter, der bei fremder
// Arbeit rot wird, stirbt (`OFFEN.md` I44). Die Knotenzahlen sind stabil gegen Verschiebung; die
// Zeilen stehen in der Fehlermeldung, wo sie hingehoeren.
//
// KEINE ZUSAMMENFUEHRUNG. Ob diese Bloecke zusammengelegt gehoeren, ist eine Architekturfrage
// fuer den Chef. Dieser Fall erhebt und sichert.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  type Erhebung,
  erhebeDatei,
  erhebeQuelle,
  gleichPaare,
  zeile,
} from "./doppelungs-erhebung";

const WURZEL = join(__dirname, "..", "..");

/**
 * Die Flaechen, deren Doppelungen die Gleichlauf-Reihe verfolgt.
 *
 * JOB 3063 (H4): `pages/KnowledgeDetail.tsx` ist zum Adress-Adapter auf die Flaeche der Bibliothek
 * geworden (rund 40 Zeilen); der bewachte Code — Formular, Quellen, Externes — liegt seither in
 * `BibliothekLesen.tsx` und `MehrAbschnitte.tsx`. Bliebe die alte Datei hier stehen, liefe der
 * Waechter fuer diese Seite STILL LEER. Es sind jetzt drei Dateien; die Erhebung war schon immer
 * eine Liste und kommt damit ohne Umbau aus.
 */
const BEWACHT = [
  "apps/web/src/components/bibliothek/BibliothekLesen.tsx",
  "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
  "apps/web/src/pages/Capture.tsx",
] as const;

/**
 * Die Baeume, in denen nach dritten Dateien gesucht wird.
 *
 * `services` liefert heute NULL Funde — das ist gemessen, nicht vermutet, und der Baum bleibt
 * trotzdem drin: Faellt spaeter ein JSX-freier Block (`FirstStatement`, `ArrowFunction`) in
 * beide Welten, soll er auffallen. Der Preis sind rund 260 zusaetzlich gelesene Dateien.
 */
const BAEUME = ["apps/web/src", "services"] as const;

/**
 * DIE REICHWEITE — was dieser Waechter NICHT ansieht, und warum (JOB 2493 §5.1).
 *
 * PRO5 hat in JOB 2458 gemessen, dass ein Sammler „sich nicht selbst pruefen kann, ob er ueber
 * alles misst" — ihre sechs Prueffaelle schlugen an, wo sie zufaellig selbst wohnten, und
 * schwiegen, wo sie es nicht taten. Eine Grundmenge, die aus dem Anlass des ersten Funds
 * entstanden ist, hat genau diese Form.
 *
 * Deshalb steht hier nicht die ZAHL der gelesenen Dateien (die aendert sich bei jeder neuen
 * Datei und waere ein Dauerfund), sondern eine REGEL MIT BEGRUENDETEN AUSNAHMEN:
 *
 *     Jede Quelldatei dieses Werks wird angesehen — ausser sie faellt unter einen Eintrag hier.
 *
 * Legt jemand einen neuen Produktbaum an (`apps/mobile/src`, ein neuer Dienst), passt er auf
 * keine Ausnahme, und R1 wird rot. Genau das ist der Sinn: Die Grundmenge kann nicht mehr still
 * hinter dem Werk zurueckbleiben.
 *
 * WORAUS DIE GRUNDMENGE STAMMT, ist seit JOB 2498 D2 `git ls-files` und nicht mehr der
 * Verzeichnisgang — die Begruendung steht an `versionierteQuelldateien()`. Gemessen wurde beides
 * im selben Lauf, im frischen Klon UND im gewachsenen Produktordner:
 *
 *     Baum            Quelle              im Werk   angesehen   ausgenommen   UNGEDECKT
 *     Klon (frisch)   Verzeichnis-Scan      688        663           25           0
 *     Klon (frisch)   git ls-files          690        663           27           0
 *     Produktordner   Verzeichnis-Scan      734        664           24          46   <- rot
 *     Produktordner   git ls-files          691        664           27           0   <- gruen
 *
 * DIE ZEILE, AUF DIE ES ANKOMMT: Die ANGESEHENE Menge ist in beiden Quellen dieselbe (664 im
 * Produktordner, 663 im Klon). Die Umstellung macht den Waechter also nicht milder — sie nimmt
 * ihm 46 Dateien ab, die nie zum Werk gehoerten, und gibt ihm drei zurueck, die er nie sah.
 */
interface Ausnahme {
  readonly muster: RegExp;
  readonly grund: string;
}

const NICHT_ANGESEHEN: readonly Ausnahme[] = [
  {
    muster: /^tests\//,
    grund: "Pruefwerk, kein Produkt. Der Waechter misst die Flaeche, nicht seine eigene Sippe.",
  },
  {
    muster: /^tests-smoke\//,
    grund: "Rauchproben — dieselbe Begruendung wie `tests/`.",
  },
  {
    muster: /^tools\//,
    grund: "Werkzeuge des Tors. Sie laufen ueber das Produkt, sie sind es nicht.",
  },
  {
    muster: /^scripts\//,
    grund: "Bauskripte.",
  },
  {
    muster: /^apps\/web\/[^/]+\.config\.ts$/,
    grund:
      "Bauwerkzeug der Web-Anwendung (`vite.config.ts`, `tailwind.config.ts`) — sie liegen NEBEN " +
      "`apps/web/src`, nicht darin. Bewusst eng gefasst: ein NEUER Baum unter `apps/` faellt " +
      "nicht darunter und macht R1 rot.",
  },
  {
    muster: /^[^/]+\.config\.ts$/,
    grund:
      "Bauwerkzeug in der WERKSWURZEL: `vitest.config.ts`, `vitest.integration.config.ts`, " +
      "`playwright.smoke.config.ts`. Sie steuern, WIE geprueft und gebaut wird, und sind keine " +
      "Produktflaeche. NEU IN JOB 2498 D2, und zwar als FUND der Umstellung: Der alte " +
      "Verzeichnisgang lief nur ueber die VERZEICHNISSE der obersten Ebene und hat Dateien " +
      "DIREKT in der Wurzel nie erreicht — diese drei waren also nicht 'ausgenommen', sondern " +
      "unsichtbar. `git ls-files` sieht sie; deshalb brauchen sie jetzt einen Grund. " +
      "Bewusst auf die Wurzel begrenzt (`[^/]+`): ein neuer Baum faellt nicht darunter.",
  },
];

interface Fremdrelation {
  /** Pfad der dritten Datei, relativ zur Klonwurzel. */
  readonly dritt: string;
  /** Knotenzahlen der gedoppelten Bloecke, absteigend. */
  readonly groessen: readonly number[];
  /** WAS geteilt wird — ein Satz, damit ein roter Lauf ohne Nachschlagen lesbar ist. */
  readonly was: string;
}

/**
 * DER IST-ZUSTAND, gemessen am Basisklon `51dbc9a` in JOB 2476.
 *
 * Sortiert nach der groessten geteilten Blockgroesse. Die vier groessten sind im Quelltext
 * nachgelesen und benannt; die uebrigen sind nach ihrer gemessenen Gestalt beschrieben — was
 * gemessen ist, steht als Messung da, und was gelesen ist, als Lesung.
 */
const FREMDE: readonly Fremdrelation[] = [
  {
    dritt: "apps/web/src/components/BodyExtractPanel.tsx",
    groessen: [199, 36, 36, 33, 29, 29, 29, 28, 27],
    was:
      "GELESEN: die Punkteliste nach dem Auslesen — dieselbe `<ul>` mit Auswahlkaestchen, " +
      "denselben `CAPTURE_FILE_TEXT`-Schluesseln und demselben `togglePoint`; nur der Setter " +
      "heisst anders (`setFilePoints` gegen `setPoints`), was der Fingerabdruck bewusst ignoriert. " +
      "Dazu der OCR-nicht-verfuegbar-Zweig und die Vertraulichkeits-Auswahlliste.",
  },
  {
    dritt: "apps/web/src/pages/CaptureFrontDoor.tsx",
    // JOB 2624 D1 (28.08.): 83 -> 114. NACHGEZOGEN, WEIL DIE DOPPELUNG RICHTIG GEPFLEGT WURDE —
    // nicht, um einen roten Test gruen zu bekommen. Die Messung dahinter:
    //
    //   Genau EIN Wert im ganzen Register weicht ab, und genau EIN Commit hat die beiden
    //   beteiligten Dateien angefasst: `6f629a2` (SANIERUNG 27.08., „Vertraulichkeits-Anzeige
    //   luegt nicht mehr", Pedi-Befund Bild-KI). Er aendert `Capture.tsx:4813` UND
    //   `CaptureFrontDoor.tsx:865` — zeichengleich in der Sache:
    //     `value={confidentiality}` -> `value={declaredConfidentiality ?? ""}`
    //     und in beiden ein Pflicht-Platzhalter, solange keine Stufe bewusst gewaehlt wurde.
    //
    // WAS DIESER EINTRAG BEWACHT, IST GENAU DAS NICHT EINGETRETEN: „Eine einseitige Aenderung
    // hier waere egress-relevant." Die Sanierung hat BEIDE Seiten gleich gezogen; der gedoppelte
    // Bereich ist dadurch laenger geworden, nicht auseinandergelaufen. Der Waechter hat also
    // funktioniert und gemeldet — er hat nur keinen Fehler gefunden, sondern eine gepflegte
    // Doppelung, deren Groesse sich geaendert hat.
    //
    // DIE DOPPELUNG WIRD NICHT AUFGELOEST. Sie ist keine versehentliche Kopie, sondern die
    // bewusst gefuehrte Parallelitaet zweier Erfassungsflaechen; sie zusammenzulegen waere ein
    // Umbau des Erfassungswegs und beruehrte den Egress — nicht Gegenstand dieses Durchgangs.
    groessen: [114, 41, 29, 27, 27, 25, 25],
    was:
      "GELESEN: die Vertraulichkeits-Auswahl samt Nebenwirkung — die bewusste Wahl setzt " +
      "`setDeclaredConfidentiality` und gilt damit fuer den Egress. Eine einseitige Aenderung " +
      "hier waere egress-relevant. Dazu der Zustand der Bildbeschreibungs-Bitte und ihr Ausloeser. " +
      "Seit der SANIERUNG vom 27.08. (6f629a2) traegt der Block zusaetzlich den Pflicht-Platzhalter " +
      "fuer die noch nicht bestaetigte Stufe — beidseitig, deshalb 114 statt 83 Knoten.",
  },
  {
    dritt: "apps/web/src/pages/Ask.tsx",
    groessen: [72],
    was:
      "GELESEN: die nummerierte Schrittliste `GAP_RESCUE_STEPS` — dieselbe `<ol>` mit " +
      "`labelKey`/`hintKey` je Schritt.",
  },
  // JOB 3061 (H2): DIE VIER `vhelp`-KOPIEN WAREN ZWEI GEWORDEN (Conflicts/Validation lesen seither
  // `REVIEW_HELP_TOPICS` aus dem „?"-Menue). `Start.tsx` und `KnowledgeDetail.tsx` behielten den
  // Helfer unveraendert — bis JOB 3063 (H4): `KnowledgeDetail.tsx` ist zum Adress-Adapter geworden,
  // und `vhelp` steht nicht mehr in der bewachten Lesefläche (`BibliothekLesen.tsx`). Die
  // Start/KnowledgeDetail-Doppelung faellt damit ERSATZLOS weg, nicht nur um — kein Auseinanderlaufen,
  // ein Wegfall.
  //
  // JOB 3064 (H5) · KONFLIKTRUNDE 1: die verbliebene Kopie in `pages/Start.tsx` (`shelp`) fällt
  // mit dem Umbau nach Zielbild ebenfalls weg — die drei ?-Hilfen des Start-Screens werden jetzt
  // als Liste aus `START_HELP_TOPICS` gerendert (`components/start/StartPanel.tsx`, Punkt
  // `start.menu.hilfe`) und brauchen den Helfer nicht mehr. Sie stand hier ohnehin schon nicht
  // als eigener Eintrag, weil sie seit JOB 3063 keinen Doppelungspartner mehr hatte — eine
  // Doppelung weniger, nicht eine verschwiegene.
  {
    dritt: "apps/web/src/lib/captureFromFile.ts",
    groessen: [36, 36],
    was:
      "GEMESSEN: zwei `FirstStatement`-Bloecke zu je 36 Knoten, die `Capture` an zwei Stellen " +
      "(1128 und 1174) mit dem Auslese-Helfer teilt — dieselben zwei, die auch in " +
      "`BodyExtractPanel` stehen.",
  },
  // Die Datei ist mit dem Wegfall von `vhelp` (42 Knoten) in der Reihenfolge nach hinten gerutscht:
  // die Messung sortiert nach dem groessten Block je Datei, und der ist hier jetzt 35.
  //
  // JOB 3063 (H4) · KONFLIKTRUNDE 2: nach dem Rebase EIN Eintrag statt zwei — beide Zeilen
  // beschrieben schon vorher dieselbe dritte Datei und sind jetzt zur tatsaechlich gemessenen
  // Menge zusammengefuehrt: der Block und die Abbrechen-Flaeche `val.feedback.cancel` teilt sich
  // Validation.tsx zusaetzlich mit der neuen Lesefläche `BibliothekLesen.tsx` (35, 35, 29), dazu
  // die Auswahlliste `ktype.` (29) und ein `FirstStatement` (25) — am eigenen Lauf gemessen.
  {
    dritt: "apps/web/src/pages/Validation.tsx",
    groessen: [35, 35, 29, 29, 25],
    was:
      "GEMESSEN: ein Block und die Abbrechen-Flaeche `val.feedback.cancel` (je 35 Knoten, geteilt " +
      "mit der Lesefläche `BibliothekLesen.tsx`), zwei Auswahllisten (`ktype.`, 29 Knoten) sowie " +
      "ein weiterer geteilter Block (25 Knoten). Der Helfer `vhelp` steht hier seit JOB 3061 H2 " +
      "NICHT mehr — die ?-Hilfen wohnen im „?“-Menue der Flaeche.",
  },
  {
    dritt: "apps/web/src/app/NavGuardContext.tsx",
    groessen: [33],
    was: "GEMESSEN: eine Aufzaehlung (`list-disc`) mit 33 Knoten, geteilt mit `Capture:5953`.",
  },
  {
    dritt: "apps/web/src/components/KnowledgeInputStudio.tsx",
    groessen: [28],
    was: "GEMESSEN: ein selbstschliessendes Element mit 28 Knoten, geteilt mit `Capture:5439`.",
  },
  {
    dritt: "apps/web/src/pages/ExternalKnowledge.tsx",
    groessen: [27],
    was:
      "GEMESSEN: ein selbstschliessendes Element mit 27 Knoten um `ext.placeholder`, geteilt " +
      "mit dem Abschnitt „Externes Wissen“ der Lesefläche (`MehrAbschnitte`).",
  },
  {
    dritt: "apps/web/src/pages/Mobile.tsx",
    // JOB 3063 (H4): 25,25 -> 26,25,25. Der Abschnitt „Externes Wissen“ der Lesefläche trägt
    // seinen Fehler-Toast jetzt als eigenen Helfer (`fehlerToast`) — derselbe Block, den Mobile
    // schon hatte. Eine gepflegte Doppelung mehr, kein Auseinanderlaufen.
    groessen: [26, 25, 25],
    was:
      "GEMESSEN: drei Bloecke — das Absenden der externen Suche (zweimal 25 Knoten, geteilt mit " +
      "beiden bewachten Seiten) und ein `FirstStatement` mit 26 Knoten um die Fehlermeldung.",
  },
  // JOB 3034 D3 hatte hier einen Eintrag `pages/Library.tsx` [27] fuer den Hinweis
  // `state.staleRefetchFailed`, geteilt mit `KnowledgeDetail:785` — genau die Bedingung, die sein
  // eigener Text nannte: „Faellt der Hinweis auf einer der beiden Seiten weg, faellt diese Groesse
  // aus der Liste." JOB 3063 (H4) hat `pages/Library.tsx` zum reinen Adress-Adapter gemacht; der
  // Hinweis steht dort nicht mehr, und mit ihm die Doppelung — ERSATZLOS weg, kein Auseinanderlaufen.
  {
    dritt: "apps/web/src/auth/AuthScreens.tsx",
    groessen: [25],
    was: "GEMESSEN: ein `FirstStatement` um `state.error`, geteilt mit `Capture:783`.",
  },
  {
    dritt: "apps/web/src/pages/Duplicates.tsx",
    groessen: [25],
    was: "GEMESSEN: derselbe `state.error`-Block wie in `AuthScreens`.",
  },
];

interface Dreifach {
  readonly knoten: number;
  readonly art: string;
  /** Die dritten Dateien, in denen derselbe Block ebenfalls steht — sortiert. */
  readonly dritte: readonly string[];
  readonly was: string;
}

/**
 * DIE DREIFACH-BLOECKE — in `KnowledgeDetail` UND `Capture` UND mindestens einer dritten Datei.
 *
 * ES SIND FUENF, NICHT SECHS. In JOB 2493 hatte ich sechs gezaehlt und dabei einen Block
 * mitgerechnet, der KEINER ist: 36 Knoten, `Capture:1128` und `Capture:1174` — beide Vorkommen
 * liegen in DERSELBEN bewachten Seite. Ein Dreifach-Block braucht je EINES in beiden Seiten.
 * Nachgemessen in JOB 2498 statt uebernommen.
 *
 * WARUM SIE HIER STEHEN. An diesen fuenf greifen ZWEI Waechter: der Paar-Waechter
 * (`kd-capture-doppelungen.test.ts`) und dieser. JOB 2498 hat gemessen, ob das Verschwendung
 * ist — es ist keine, weil die beiden VERSCHIEDENES sichern:
 *
 *   Aendert sich nur die DRITTE Datei          -> dieser Waechter rot, der Paar-Waechter GRUEN
 *   Aendert sich nur EINE bewachte Seite       -> beide rot   (hier ueberlappen sie)
 *   Aendert sich ein Paar OHNE dritte Datei    -> Paar-Waechter rot, dieser GRUEN
 *
 * Alle drei Zeilen sind an Kopien gemessen, nicht hergeleitet. Die Ueberlappung besteht also nur
 * in der mittleren Zeile — und dort ist sie der Preis dafuer, dass jeder Waechter fuer sich
 * vollstaendig bleibt. Zusammengelegt haette der gemeinsame Waechter DREI Aufrufer statt einem,
 * und gespart waeren rund 130 ms (das Einlesen der zwei bewachten Seiten ein zweites Mal) —
 * gemessen gegen einen Fremd-Lauf von rund 1200 ms Einlesezeit.
 *
 * Dieser Fall haelt fest, WELCHE fuenf es sind. Kommt ein sechster dazu oder faellt einer weg,
 * hat sich die Ueberlappung veraendert und die Entscheidung von JOB 2498 gehoert nachgerechnet.
 */
const DREIFACH: readonly Dreifach[] = [
  {
    knoten: 29,
    art: "ArrowFunction",
    dritte: [
      "apps/web/src/components/BodyExtractPanel.tsx",
      "apps/web/src/pages/CaptureFrontDoor.tsx",
    ],
    was: "Die Auswahlliste der Vertraulichkeitsstufen (`CONFIDENTIALITY_LEVELS` -> `conf.level.*`).",
  },
  {
    knoten: 29,
    art: "ArrowFunction",
    dritte: ["apps/web/src/pages/Validation.tsx"],
    was: "Die Auswahlliste der Wissensarten (`KNOWLEDGE_TYPES` -> `ktype.*`).",
  },
  {
    knoten: 27,
    art: "FirstStatement",
    dritte: ["apps/web/src/pages/CaptureFrontDoor.tsx"],
    was: "Der Zustand der Bildbeschreibungs-Bitte: `captionRequest` mit Bild, Stelle und Zaehler.",
  },
  {
    knoten: 25,
    art: "ArrowFunction",
    dritte: ["apps/web/src/pages/CaptureFrontDoor.tsx"],
    was: "Der Ausloeser derselben Bitte — setzt den Zustand und zaehlt den Zaehler hoch.",
  },
  {
    knoten: 25,
    art: "ArrowFunction",
    dritte: ["apps/web/src/pages/Mobile.tsx"],
    was: "Das Absenden der externen Suche: `onSubmit` prueft auf leer und ruft `extSearch.mutate`.",
  },
];

interface Fund {
  knoten: number;
  bewacht: string;
  zb: number;
  dritt: string;
  zd: number;
  art: string;
}

/**
 * ALLE QUELLDATEIEN DES WERKS — erhoben aus `git ls-files`, NICHT aus dem Dateisystem.
 *
 * DER BEFUND DES CHEFS, 27.08.2026 (JOB 2498 D2): Der bisherige Verzeichnisgang fand im
 * gewachsenen Produktordner 46 Quelldateien unter `_relay/`, die `.gitignore` fuehrt — Messreste
 * aus Monaten, kein Produkt. R1 kannte sie nicht und nahm sie nicht aus, also wurde er rot.
 * **Derselbe Waechter war im frischen Klon GRUEN und im Produktordner ROT**, und der Einbau
 * musste zurueckgenommen werden.
 *
 * WARUM DAS NICHT NUR EINEN WAECHTER BETRIFFT: Die Bahn prueft im Klon, der Maschinenpruefer
 * prueft im Klon, der Pruefer prueft im Klon. Alle drei sehen gruen. Erst der Chef sieht rot,
 * weil er als Einziger im gewachsenen Ordner baut. Ein frischer Klon hat kein `_relay/`, kein
 * `test-results/`, keine Messreste. **Ein Test, der das Dateisystem abgeht, misst den ORDNER —
 * nicht das WERK.**
 *
 * `git ls-files` fragt die einzige Instanz, die weiss, was zum Werk gehoert. Damit ist die
 * Reichweite ueberall gleich streng, gleichgueltig wie der Ordner gewachsen ist.
 *
 * GEMESSEN (JOB 2498 D2, beide Baeume im selben Lauf):
 *     frischer Klon      Scan 688 · git 690   (Differenz: 3 Wurzeldateien, s. u.)
 *     Produktordner      Scan 734 · git 691   (Differenz: 46 Dateien unter `_relay/`)
 *     `apps/web/src`     Scan 400 · git 400   — die Fundmenge von F1/K1 aendert sich NICHT
 *     `services`         Scan 263 · git 263   — ebenso
 */
function versionierteQuelldateien(): string[] {
  let aus: string;
  try {
    aus = execFileSync("git", ["-C", WURZEL, "ls-files", "-z", "--", "*.ts", "*.tsx"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    // FAIL-CLOSED. Eine leere Liste waere hier die gefaehrlichste Antwort: R1 waere trivial
    // gruen ueber einem leeren Blatt, und die Reichweite waere unbemerkt auf null gefallen.
    throw new Error(
      [
        `git ls-files in ${WURZEL} nicht ausfuehrbar: ${(err as Error).message}`,
        "Die Reichweite dieses Waechters haengt daran. Ohne sie misst er nichts, und ein",
        "gruener Lauf waere eine Behauptung ueber ein leeres Blatt.",
      ].join("\n"),
    );
  }
  return (
    aus
      .split("\0")
      .filter((f) => f.length > 0)
      .filter((f) => !/\.(test|spec)\./.test(f))
      // JOB 3060 · H1: `git ls-files` fuehrt eine im Arbeitsbaum GELOESCHTE Datei weiter, bis die
      // Loeschung eingebaut ist (Sidebar.tsx, Topbar.tsx). Eine Datei, die es nicht gibt, ist keine
      // dritte Datei — sie zu lesen waere ein Parsefehler ueber ein Nichts, kein Befund.
      .filter((f) => existsSync(join(WURZEL, f)))
      // Umfeld, kein Codebefund: Kopien mit " 2" im Namen sind keine Quelle.
      .filter((f) => !f.includes(" 2."))
      .sort()
  );
}

let versioniert: string[] | null = null;

/** Alle Quelldateien des Werks — einmal erhoben, mehrfach benutzt. */
function alleQuelldateien(): string[] {
  if (versioniert === null) {
    versioniert = versionierteQuelldateien();
  }
  return versioniert;
}

/**
 * Die Quelldateien EINES Baums — dieselbe Menge wie oben, nur eingeschraenkt.
 *
 * Bewusst aus derselben Quelle: Haetten Reichweite (R1) und Erhebung (F1/K1) zwei verschiedene
 * Vorstellungen davon, was eine Quelldatei ist, urteilte R1 ueber eine andere Menge als die,
 * die tatsaechlich gemessen wird.
 */
function quelldateien(baum: string): string[] {
  return alleQuelldateien().filter((f) => f.startsWith(`${baum}/`));
}

interface Messung {
  funde: Fund[];
  gelesen: number;
  parsefehler: string[];
  /** Die Erhebungen der zwei bewachten Seiten — D1 braucht sie fuer die Paarbildung (JOB 2498). */
  bewacht: Erhebung[];
  /** Fingerabdruck -> Orte in dritten Dateien. Ebenfalls fuer D1. */
  inDritten: Map<string, string[]>;
}

let zwischenspeicher: Messung | null = null;

/** Einmal messen, dreimal benutzen — 660 Dateien werden sonst je Fall neu gelesen. */
function messe(): Messung {
  if (zwischenspeicher !== null) {
    return zwischenspeicher;
  }
  // Ohne Skelett-Fingerabdruck: dieser Waechter sucht nur GLEICH, nicht ABWEICHEND.
  const bewacht: Erhebung[] = BEWACHT.map((f) => erhebeDatei(WURZEL, f, false));
  const dritte = BAEUME.flatMap(quelldateien).filter(
    (f) => !(BEWACHT as readonly string[]).includes(f),
  );

  const funde: Fund[] = [];
  const parsefehler: string[] = [];
  const inDritten = new Map<string, string[]>();
  let gelesen = 0;

  for (const rel of dritte) {
    let e: Erhebung;
    try {
      e = erhebeDatei(WURZEL, rel, false);
    } catch (err) {
      // Sichtbar machen statt verschlucken: eine Datei, die nicht liest, ist keine Datei ohne Fund.
      parsefehler.push(`${rel}: ${(err as Error).message}`);
      continue;
    }
    gelesen++;
    for (const b of bewacht) {
      for (const p of gleichPaare(b, e)) {
        funde.push({
          knoten: b.groesse.get(p.links) ?? 0,
          bewacht: b.datei,
          zb: zeile(b, p.links),
          dritt: rel,
          zd: zeile(e, p.rechts),
          art: ts.SyntaxKind[p.links.kind],
        });
        // JOB 2498: welcher Fingerabdruck der bewachten Seite steht in welcher dritten Datei.
        const fp = b.inh.get(p.links) as string;
        if (!inDritten.has(fp)) {
          inDritten.set(fp, []);
        }
        (inDritten.get(fp) as string[]).push(rel);
      }
    }
  }
  zwischenspeicher = { funde, gelesen, parsefehler, bewacht, inDritten };
  return zwischenspeicher;
}

/** Die Funde, gruppiert nach dritter Datei — die Form, die `FREMDE` pinnt. */
function nachDatei(funde: Fund[]): { dritt: string; groessen: number[] }[] {
  const gruppen = new Map<string, number[]>();
  for (const f of funde) {
    const bisher = gruppen.get(f.dritt) ?? [];
    bisher.push(f.knoten);
    gruppen.set(f.dritt, bisher);
  }
  return [...gruppen.entries()]
    .map(([dritt, groessen]) => ({ dritt, groessen: [...groessen].sort((x, y) => y - x) }))
    .sort((x, y) => (y.groessen[0] ?? 0) - (x.groessen[0] ?? 0) || x.dritt.localeCompare(y.dritt));
}

function tafel(funde: Fund[]): string {
  return [...funde]
    .sort((x, y) => y.knoten - x.knoten)
    .map(
      (f) =>
        `${String(f.knoten).padStart(4)} Knoten · ${f.bewacht.replace("apps/web/src/pages/", "")}:${f.zb} · ${f.dritt}:${f.zd} · ${f.art}`,
    )
    .join("\n");
}

describe("JOB 2476 · W1 · gedoppelte Bloecke mit einer DRITTEN Datei", () => {
  it("R1 · DIE REICHWEITE: jede Quelldatei ist angesehen oder begruendet ausgenommen", () => {
    // JOB 2493 §5.1. Ohne diese Zusicherung sagt jede Fundzahl nichts ueber das, was NICHT
    // angesehen wurde — und der Waechter koennte still hinter dem Werk zurueckbleiben.
    const alle = alleQuelldateien();
    const gesehen = (rel: string): boolean =>
      BAEUME.some((b) => rel === b || rel.startsWith(`${b}/`));

    expect(
      alle.length,
      "Es wurden kaum Quelldateien gefunden — der Gang ist kaputt",
    ).toBeGreaterThan(500);

    const ungedeckt = alle
      .filter((f) => !gesehen(f))
      .filter((f) => !NICHT_ANGESEHEN.some((a) => a.muster.test(f)));

    expect(
      ungedeckt,
      [
        "Quelldateien, die weder angesehen noch begruendet ausgenommen sind:",
        ...ungedeckt.map((f) => `  ${f}`),
        "",
        "Ist es Produktflaeche, gehoert der Baum in `BAEUME`.",
        "Ist es keine, gehoert ein Eintrag mit GRUND in `NICHT_ANGESEHEN`.",
      ].join("\n"),
    ).toEqual([]);

    // Eine Ausnahme, die nichts mehr deckt, ist ein Ueberbleibsel und verschleiert die Reichweite.
    for (const a of NICHT_ANGESEHEN) {
      expect(
        alle.some((f) => a.muster.test(f)),
        `Die Ausnahme ${a.muster} deckt keine einzige Datei mehr — entfernen.`,
      ).toBe(true);
    }

    // KALIBRIERUNG der Regel selbst: Ein NEUER Produktbaum darf durch keine Ausnahme fallen.
    // Ohne diese Zeile waere die Zusicherung oben auch dann gruen, wenn die Ausnahmen zu weit
    // gefasst waeren — und genau das ist PRO5s Befund aus JOB 2458.
    for (const erfunden of ["apps/mobile/src/App.tsx", "services/neuerdienst/src/index.ts"]) {
      const gedeckt = gesehen(erfunden) || NICHT_ANGESEHEN.some((a) => a.muster.test(erfunden));
      if (erfunden.startsWith("services/")) {
        // Ein neuer DIENST liegt unter `services` und ist damit von Haus aus angesehen.
        expect(gedeckt, `${erfunden} muesste angesehen sein`).toBe(true);
      } else {
        expect(gedeckt, `Ein neuer Produktbaum (${erfunden}) ginge stillschweigend durch`).toBe(
          false,
        );
      }
    }
  });

  it("K1 · KALIBRIERUNG: es wird wirklich gelesen — beide Seiten und beide Baeume", () => {
    // Ohne diesen Fall waere F1 auch dann gruen, wenn der Verzeichnisgang nichts faende: dann
    // waere die Fundliste leer, das Register muesste leer sein, und die Zusicherung waere eine
    // Behauptung ueber ein leeres Blatt.
    const { gelesen, parsefehler } = messe();
    for (const f of BEWACHT) {
      // JOB 3063: die Schwelle folgt der kleinsten bewachten Flaeche (`MehrAbschnitte.tsx`), nicht
      // mehr der einen grossen Seitendatei. Sie soll „gelesen" von „leer" trennen, nicht Groesse
      // vorschreiben.
      expect(erhebeDatei(WURZEL, f).knoten.length, `${f} wurde nicht gelesen`).toBeGreaterThan(
        3000,
      );
    }
    for (const baum of BAEUME) {
      expect(
        quelldateien(baum).length,
        `Der Baum ${baum} liefert keine Quelldateien`,
      ).toBeGreaterThan(50);
    }
    expect(gelesen, "Es wurden kaum dritte Dateien gelesen").toBeGreaterThan(500);
    expect(parsefehler, `Dateien liessen sich nicht lesen:\n${parsefehler.join("\n")}`).toEqual([]);
  });

  it("K2 · KALIBRIERUNG: eine gepflanzte Doppelung wird gefunden", () => {
    // Beweist, dass die Paarbildung dieses Falls ueberhaupt zuschlaegt — sonst waere jede
    // Null-Aussage wertlos. Verhalten, nicht Namensanwesenheit.
    const text = `
      const x = (
        <ul className="space-y-2">
          {points.map((p) => (
            <li key={p.id} className="rounded-card border p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={p.selected} className="mt-0.5 h-4 w-4" />
                <span className="min-w-0 flex-1">{t("capture.pointsTitle")}</span>
              </label>
            </li>
          ))}
        </ul>
      );`;
    const eins = erhebeQuelle("l.tsx", text);
    const zwei = erhebeQuelle("r.tsx", text);
    expect(gleichPaare(eins, zwei).length, "Eine gepflanzte Kopie wird nicht gefunden").toBe(1);
  });

  it("D1 · DIE DREIFACH-BLOECKE: die Ueberlappung der zwei Waechter ist unveraendert", () => {
    // JOB 2498 §5. Ein Dreifach-Block steht in BEIDEN bewachten Seiten UND in einer dritten.
    // Genau dort greifen zwei Waechter auf denselben Gegenstand — nachweislich mit
    // verschiedenen Zusicherungen (siehe Begruendung an `DREIFACH`).
    const { bewacht, inDritten } = messe();
    // JOB 3063 (H4): die Bibliothek-Seite besteht aus zwei Bauteilen, `Capture.tsx` steht als
    // letztes im Register. Verglichen wird weiterhin jede Bibliothek-Datei GEGEN Capture — nicht
    // die zwei Bibliothek-Dateien untereinander (das wäre eine andere Frage).
    const capture = bewacht[bewacht.length - 1] as Erhebung;
    const links = bewacht.slice(0, -1);

    // KALIBRIERUNG: ohne Paare zwischen den bewachten Seiten waere die Liste unten trivial leer.
    const paare = links.flatMap((a) => gleichPaare(a, capture).map((p) => ({ a, p })));
    expect(paare.length, "Zwischen den bewachten Seiten wurde kein Paar gefunden").toBeGreaterThan(
      5,
    );

    const gemessen = paare
      .filter(({ a, p }) => inDritten.has(a.inh.get(p.links) as string))
      .map(({ a, p }) => ({
        knoten: a.groesse.get(p.links) ?? 0,
        art: ts.SyntaxKind[p.links.kind],
        dritte: [...new Set(inDritten.get(a.inh.get(p.links) as string))].sort(),
      }))
      .sort(
        (x, y) =>
          y.knoten - x.knoten ||
          x.art.localeCompare(y.art) ||
          x.dritte.join(",").localeCompare(y.dritte.join(",")),
      );
    const erwartet = DREIFACH.map((d) => ({
      knoten: d.knoten,
      art: d.art,
      dritte: [...d.dritte].sort(),
    }));

    const meldung = [
      "Die Ueberlappung der zwei Waechter hat sich veraendert.",
      "",
      "ERWARTET (Register `DREIFACH` in dieser Datei):",
      ...DREIFACH.map(
        (d) =>
          `  ${String(d.knoten).padStart(3)} ${d.art.padEnd(15)} -> ${d.dritte.join(", ")}\n    ${d.was}`,
      ),
      "",
      `GEMESSEN (${gemessen.length}):`,
      ...gemessen.map(
        (d) => `  ${String(d.knoten).padStart(3)} ${d.art.padEnd(15)} -> ${d.dritte.join(", ")}`,
      ),
      "",
      "Kam einer dazu oder faellt einer weg, hat sich die Ueberlappung veraendert —",
      "dann gehoert die Entscheidung aus JOB 2498 (nicht zusammenlegen) nachgerechnet.",
    ].join("\n");

    expect(gemessen, meldung).toEqual(erwartet);
  });

  it("F1 · DIE FREMDDOPPELUNGEN stehen unveraendert", () => {
    const { funde } = messe();
    const gemessen = nachDatei(funde);
    const erwartet = FREMDE.map((f) => ({ dritt: f.dritt, groessen: [...f.groessen] }));

    const meldung = [
      "Die Doppelungen mit dritten Dateien haben sich veraendert.",
      "",
      "ERWARTET (Register `FREMDE` in dieser Datei):",
      ...FREMDE.map((f) => `  ${f.dritt}  [${f.groessen.join(", ")}]\n    ${f.was}`),
      "",
      `GEMESSEN (${funde.length} Bloecke ueber ${gemessen.length} dritte Dateien):`,
      tafel(funde),
      "",
      "Fehlt eine Groesse, wurde EINE Seite geaendert und die andere vergessen — nachziehen.",
      "Kam eine dazu, gehoert sie mit einem Satz in `FREMDE`, bevor sie lebt.",
    ].join("\n");

    expect(gemessen, meldung).toEqual(erwartet);
  });
});
