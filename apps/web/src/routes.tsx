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
//     04.09.2026, Arbeitsstand `b203c44`, vorher (Seiten statisch): Eintritt 2.028.116 B ·   6 Stücke · 2.984.836 B gesamt
//     04.09.2026, Arbeitsstand `b203c44`, nachher (aufgeteilt):     Eintritt 1.255.662 B · 103 Stücke · 3.019.654 B gesamt
// Der Eintritt fällt also um 772.454 B (−38,09 %). Die Gesamtsumme WÄCHST um 34.818 B (+1,17 %) —
// die Rahmen der 97 zusätzlichen Stücke (359 B je Stück); kein Modul liegt doppelt, das hält der
// Fall (c1) fest. Damit ist Lieferpunkt 3(c) („die Summe wächst nicht") WÖRTLICH NICHT ERFÜLLT;
// die Rückgabe führt ihn als offen, die Entscheidung über diesen Rahmen liegt beim Auftraggeber.
//
// DIE ZAHLEN IN RUNDE 7 WAREN FALSCH und stehen hier korrigiert (ben, R7): dort war das „vorher"
// ein `inlineDynamicImports`-Bau, der auch die FÜNF schon vor JOB 3030 getrennt ausgelieferten
// Stücke einschmolz. Gegen dieses zu große Vergleichsbündel las sich der Gewinn als −58,07 %.
// Bens eigener Produktionsbau des echten Vorstands `9e1e573` — 6 Stücke, Eintritt 2.026.850 B,
// Summe 2.983.570 B — trifft den Gegenbau oben auf 0,06 % genau und bestätigt die −38 %.
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
