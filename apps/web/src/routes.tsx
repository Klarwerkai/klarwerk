import { type ComponentType, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRole } from "./app/RoleContext";
import { GUARDED_ITEMS, HOME_ROUTE, type NavItem, roleAllows } from "./app/navigation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Splash } from "./components/Splash";
// WP-UX-WOW-1 U9: erklärende Karte statt stiller Stufe-2-Umleitung.
// AUFTRAG-mega70 BLOCK A: dieselbe Behandlung für den Rollenfall (RoleNotice, gleicher Rahmen).
import { RoleNotice, Stage2Notice } from "./components/Stage2Notice";

// ================================================================================================
// JOB 3030 (U4/SCRUM-543) — JEDE SEITE WIRD NACHGELADEN, KEINE HÄNGT MEHR AM EINTRITT.
// ================================================================================================
//
// Bis hierher standen hier 24 STATISCHE Importe. Weil diese Datei am Eintrittspunkt hängt, lag damit
// der Code ALLER Seiten im Eintritts-Stück — Admin, UiKit, Wissensnetz, Stufe 2, die 1.686 Zeilen der
// Vordertür, die 1.370 Zeilen der Bibliothek — und musste geladen sein, bevor die erste Seite
// erscheinen konnte, obwohl ein Mensch beim ersten Blick genau EINE Seite sieht.
//
// GEMESSEN IM PRODUKTIONSBAU (`NODE_ENV=production`, gegen `tools/build` kalibriert). Die Zahlen
// stammen NICHT aus einer Schätzung, sondern aus zwei Bauläufen DESSELBEN Quellstands, die
// `tests/erstladezeit/eintritt-ohne-seiten.test.ts` bei jedem Lauf neu fährt: einmal wie hier
// aufgeteilt, einmal mit einem Plugin, das GENAU DIESE `lazy`-Zeilen wieder zu statischen Importen
// macht und sonst nichts anfasst — dieser Gegenbau ist das „vorher".
//     05.09.2026, Arbeitsstand `e8116ba`, vorher (Seiten statisch): Eintritt 2.069.266 B ·   6 Stücke · 3.025.986 B gesamt
//     05.09.2026, Arbeitsstand `e8116ba`, nachher (aufgeteilt):     Eintritt 1.285.166 B · 102 Stücke · 3.063.530 B gesamt
// Der Eintritt fällt also um 784.100 B (−37,89 %). Die Gesamtsumme WÄCHST um 37.544 B (+1,24 %).
//
// DIESER ZUWACHS IST ENTSCHIEDEN, NICHT OFFEN — und er ist gemessen, nicht behauptet (JOB 3077).
// Bis zum 05.09.2026 stand hier, Lieferpunkt 3(c) („die Summe wächst nicht") sei wörtlich nicht
// erfüllt und die Entscheidung darüber liege beim Auftraggeber. Sie ist gefallen: Steuerung,
// 05.09.2026, Entscheidung 13 (`UEBERGABE.md`), Zeile U4b in `PRIORITAETEN.md`. 3(c) wird NICHT als
// Nullwachstumsbedingung geführt, sondern als ausdrücklich angenommenes, GEMESSENES
// Verpackungsbudget: 37.544 B mehr Auslieferung gegen 784.100 B weniger Erstlast.
//
// DIE BEDINGUNG DIESER ANNAHME ist, dass der Zuwachs Rahmen ist und nicht Inhalt — und das wird seit
// JOB 3077 bei jedem Testlauf neu erhoben, nicht mehr vermutet. Gemessen wird an den AUSGELIEFERTEN
// Bytes: die Quellkarte des fertigen, minimierten Stücks ordnet jeden Bereich seiner Quelldatei zu.
// Was zu keiner Quelle gehört, ist Rahmen — die Import-Zeilen zwischen den Stücken, die
// Nachlade-Helfer und die erzeugte Ausfuhrliste `export{…}` am Stückende:
//     Zuwachs 37.544 B = RAHMEN +39.256 B (104,6 %) + INHALT −1.712 B (−4,6 %)
// DER AUSGELIEFERTE MODULINHALT WÄCHST ALSO NICHT, ER SCHRUMPFT um 1.712 B: in 102 kleinen Stücken
// muss rollup weniger Namen entkollidieren (`Foo$1`, `Foo$2`) als in sechs großen, und das spart
// mehr, als der Schnitt kostet. Damit ist Lieferpunkt 3(c) für den INHALT sogar wörtlich erfüllt;
// gewachsen ist ausschließlich die Verpackung. Aufgeschlüsselt: 31 von 854 Modulen wachsen (zusammen
// +3.167 B), 254 schrumpfen (zusammen −4.879 B). Der einzige nennenswerte Zuwachs ist DIESE DATEI
// mit +3.037 B (2.325 → 5.362) — die 27 `lazy(() => import(…))`-Ausdrücke unten stehen als
// Laufzeitcode da, wo ein statischer Import beim Bündeln spurlos verschwindet; der zweitgrößte
// Zuwachs im ganzen Baum beträgt 32 B. Am 05.09.2026 wächst KEIN Seitenmodul aus `pages/`; die
// schwersten schrumpfen (Capture −543 B, Admin −311 B). Diese Liste wird bei jedem Testlauf neu
// erhoben und gedruckt, damit der Satz nicht veraltet. Kein Modul liegt doppelt — das hält (c1)
// toleranzfrei fest.
// Die Wächter dazu: (c3) verlangt, dass der ausgelieferte Modulinhalt NICHT wächst (Budget 0),
// (c3r) stellt dieselbe Frage vor der Minimierung aus einer zweiten Quelle, (c4) hält die
// Gesamtsumme unter 2,5 % Zuwachs. Reißt einer, ist die Annahme neu zu treffen — nicht die Schranke
// zu heben. Zum Spielraum von (c3): rund 17 weitere nachgeladene Seiten trägt er, dann kippt er
// (gemessen, siehe Kommentar an `INHALT_BUDGET_BYTES`).
//
// DIE ZAHLEN IN RUNDE 7 WAREN FALSCH und stehen hier korrigiert (ben, R7): dort war das „vorher"
// ein `inlineDynamicImports`-Bau, der auch die FÜNF schon vor JOB 3030 getrennt ausgelieferten
// Stücke einschmolz. Gegen dieses zu große Vergleichsbündel las sich der Gewinn als −58,07 %.
// Bens eigener Produktionsbau des echten Vorstands `9e1e573` — 6 Stücke, Eintritt 2.026.850 B,
// Summe 2.983.570 B — traf den damaligen Gegenbau (04.09., `b203c44`: 2.028.116 B) auf 0,06 % genau
// und bestätigte die −38 %. Beide Zahlen sind Historie: der Gegenbau baut den HEUTIGEN Quellstand,
// steht am 05.09. deshalb schon bei 2.069.266 B und wächst mit dem Produkt weiter. Genau darum
// steht oben ein Verhältnis und keine Byte-Schranke — die wäre über Nacht von selbst rot geworden.
//
// DREI DINGE, DIE HIER BEWUSST SO SIND:
//   · KEINE AUSNAHME. Auch `PlaceholderPage` wird nachgeladen. Sobald eine Seite die Ausnahme wäre,
//     wäre die Regel nicht mehr binär prüfbar — und der Wächter `tests/erstladezeit/` erhebt seine
//     Sollmenge aus dem Dateisystem, kennt also gar keine Ausnahme.
//   · `pages/Stufe2.tsx` LIEFERT VIER SEITEN (Capital, GraphView, ImportReview, Output). Das sind
//     vier `lazy`-Einträge auf DIESELBE Datei; rollup legt sie in EIN gemeinsames Stück. Das ist
//     richtig so: es ist eine Datei, und wer eine der vier öffnet, bekommt genau dieses eine Stück.
//   · `Stage2Notice`, `RoleNotice`, `ErrorBoundary`, `navigation.ts`, `useRole` und `Splash` bleiben
//     STATISCH. Sie sind keine Seiten, sondern werden auf jedem Weg gebraucht — sie nachzuladen
//     hieße, für den Rahmen selbst eine Ladefläche zu zeigen.
//
// DIE RECHTE ÄNDERN SICH NICHT: `Guarded` prüft Rolle und Stufe 2 VOR dem Nachladen — wer nicht darf,
// lädt auch nicht. Und ein fehlgeschlagener Nachlade-Abruf ist keine weiße Seite: die Fehlergrenze
// in `Guarded` (`<ErrorBoundary key={item.id}>`) fängt ihn und zeigt die Karte mit Neu-laden-Knopf.
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Ask = lazy(() => import("./pages/Ask").then((m) => ({ default: m.Ask })));
const Capture = lazy(() => import("./pages/Capture").then((m) => ({ default: m.Capture })));
const CaptureFrontDoor = lazy(() =>
  import("./pages/CaptureFrontDoor").then((m) => ({ default: m.CaptureFrontDoor })),
);
const Conflicts = lazy(() => import("./pages/Conflicts").then((m) => ({ default: m.Conflicts })));
const DuplicateCompare = lazy(() =>
  import("./pages/DuplicateCompare").then((m) => ({ default: m.DuplicateCompare })),
);
const Duplicates = lazy(() =>
  import("./pages/Duplicates").then((m) => ({ default: m.Duplicates })),
);
const ExternalKnowledge = lazy(() =>
  import("./pages/ExternalKnowledge").then((m) => ({ default: m.ExternalKnowledge })),
);
const Help = lazy(() => import("./pages/Help").then((m) => ({ default: m.Help })));
const KnowledgeDetail = lazy(() =>
  import("./pages/KnowledgeDetail").then((m) => ({ default: m.KnowledgeDetail })),
);
const KnowledgeIntake = lazy(() =>
  import("./pages/KnowledgeIntake").then((m) => ({ default: m.KnowledgeIntake })),
);
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Lifecycle = lazy(() => import("./pages/Lifecycle").then((m) => ({ default: m.Lifecycle })));
const Mobile = lazy(() => import("./pages/Mobile").then((m) => ({ default: m.Mobile })));
const MyTasks = lazy(() => import("./pages/MyTasks").then((m) => ({ default: m.MyTasks })));
const PlaceholderPage = lazy(() =>
  import("./pages/PlaceholderPage").then((m) => ({ default: m.PlaceholderPage })),
);
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const Risk = lazy(() => import("./pages/Risk").then((m) => ({ default: m.Risk })));
const Start = lazy(() => import("./pages/Start").then((m) => ({ default: m.Start })));
const Capital = lazy(() => import("./pages/Stufe2").then((m) => ({ default: m.Capital })));
const GraphView = lazy(() => import("./pages/Stufe2").then((m) => ({ default: m.GraphView })));
const ImportReview = lazy(() =>
  import("./pages/Stufe2").then((m) => ({ default: m.ImportReview })),
);
const Output = lazy(() => import("./pages/Stufe2").then((m) => ({ default: m.Output })));
const UiKit = lazy(() => import("./pages/UiKit").then((m) => ({ default: m.UiKit })));
const Validation = lazy(() =>
  import("./pages/Validation").then((m) => ({ default: m.Validation })),
);
const Wissensnetz = lazy(() =>
  import("./pages/Wissensnetz").then((m) => ({ default: m.Wissensnetz })),
);

function DuplicateComparePage(): JSX.Element {
  return <DuplicateCompare kind="duplicate" />;
}

function ConflictComparePage(): JSX.Element {
  return <DuplicateCompare kind="conflict" />;
}

const PAGES: Record<string, ComponentType> = {
  start: Start,
  aufgaben: MyTasks,
  erfassen: Capture,
  captureFrontDoor: CaptureFrontDoor,
  // JOB 1972: Seitenauflösung für den bewachten Deep-Link `/erfassen/neu`. Ohne diesen Schlüssel
  // fiele die berechtigte Rolle auf den `PlaceholderPage`-Zweig (:88) statt auf die Erfassung.
  captureIntake: KnowledgeIntake,
  fragen: Ask,
  bibliothek: Library,
  extern: ExternalKnowledge,
  validierung: Validation,
  konflikte: Conflicts,
  duplikate: Duplicates,
  duplicateCompare: DuplicateComparePage,
  conflictCompare: ConflictComparePage,
  risiko: Risk,
  lebenszyklus: Lifecycle,
  analytics: Analytics,
  admin: Admin,
  output: Output,
  import: ImportReview,
  graph: GraphView,
  // JOB 2600 D1: die Themenkarte auf der bestehenden Oberflaeche.
  wissensnetz: Wissensnetz,
  kapital: Capital,
  hilfe: Help,
  profil: Profile,
};

// AUFTRAG-mega51 BLOCK A: die drei bewachten Deep-Link-Routen standen hier als eigene Tabelle —
// unsichtbar für jeden, der „darf diese Rolle dorthin?" an der Navigationsquelle fragt. Sie stehen
// jetzt in app/navigation.ts neben ALL_ITEMS (`GUARDED_ITEMS`); hier wird nur noch darüber geroutet.

// Rollen-Gate (RB-2): der Deep-Link auf Unerlaubtes bleibt zu — aber nicht mehr stumm.
// AUFTRAG-mega70 BLOCK A (bens Befund): der Rückwurf `<Navigate to={HOME_ROUTE}>` war die stille
// Umleitung, die WP-UX-WOW-1 U9 für den Stufe-2-Fall bereits abgeschafft hatte. Jetzt erklärt
// sich auch der Rollenfall: welche Rolle der Bereich braucht, plus Weg zurück (RoleNotice).
function Guarded({ item }: { item: NavItem }): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!roleAllows(item, role)) {
    return <RoleNotice item={item} />;
  }
  // WP-UX-WOW-1 U9: die Rolle würde reichen, nur Stufe 2 ist aus → KEINE stille Umleitung mehr,
  // sondern die erklärende Karte mit Einschalt-Knopf (Admin) bzw. ehrlichem Hinweis + Zurück.
  if (item.stufe2 && !stufe2) {
    return <Stage2Notice />;
  }
  const Page = PAGES[item.id];
  // Bug (Pedi 04.07.): Fehler in EINER Seite dürfen nicht die ganze App weiß ausblenden.
  // key={item.id} → die Fehlergrenze setzt sich beim Seitenwechsel zurück.
  return (
    <ErrorBoundary key={item.id}>{Page ? <Page /> : <PlaceholderPage item={item} />}</ErrorBoundary>
  );
}

export function AppRoutes(): JSX.Element {
  // JOB 3030: GENAU EINE Grenze für alle Routen. Sie steht um `<Routes>` herum und nicht je Route,
  // weil zu jedem Zeitpunkt genau eine Seite gerendert wird — je Route wären es 30 gleiche Grenzen
  // und damit 30 Stellen, an denen jemand `fallback={null}` schreiben könnte. Der Rückfall ist die
  // Ladefläche „Lädt …", nie eine leere Fläche.
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Navigate to={HOME_ROUTE} replace />} />
        {GUARDED_ITEMS.map((item) => (
          <Route key={item.id} path={item.path} element={<Guarded item={item} />} />
        ))}
        <Route path="/wissen/:id" element={<KnowledgeDetail />} />
        {/* SCRUM-527 (Design-Batch B): zuhörende „Wissen erfassen"-Erstversion — Deep-Link zum Browser-
            Check durch Pedi (noch nicht in der Navigation, um die bestehende Erfassung nicht zu berühren). */}
        <Route path="/erfassen/neu" element={<KnowledgeIntake />} />
        <Route path="/mobile" element={<Mobile />} />
        <Route path="/ui-kit" element={<UiKit />} />
        <Route path="*" element={<Navigate to={HOME_ROUTE} replace />} />
      </Routes>
    </Suspense>
  );
}
