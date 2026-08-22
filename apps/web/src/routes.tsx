import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRole } from "./app/RoleContext";
import { GUARDED_ITEMS, HOME_ROUTE, type NavItem, roleAllows } from "./app/navigation";
import { ErrorBoundary } from "./components/ErrorBoundary";
// WP-UX-WOW-1 U9: erklärende Karte statt stiller Stufe-2-Umleitung.
// AUFTRAG-mega70 BLOCK A: dieselbe Behandlung für den Rollenfall (RoleNotice, gleicher Rahmen).
import { RoleNotice, Stage2Notice } from "./components/Stage2Notice";
import { Admin } from "./pages/Admin";
import { Analytics } from "./pages/Analytics";
import { Ask } from "./pages/Ask";
import { Capture } from "./pages/Capture";
import { CaptureFrontDoor } from "./pages/CaptureFrontDoor";
import { Conflicts } from "./pages/Conflicts";
import { DuplicateCompare } from "./pages/DuplicateCompare";
import { Duplicates } from "./pages/Duplicates";
import { ExternalKnowledge } from "./pages/ExternalKnowledge";
import { Help } from "./pages/Help";
import { KnowledgeDetail } from "./pages/KnowledgeDetail";
import { KnowledgeIntake } from "./pages/KnowledgeIntake";
import { Library } from "./pages/Library";
import { Lifecycle } from "./pages/Lifecycle";
import { Mobile } from "./pages/Mobile";
import { MyTasks } from "./pages/MyTasks";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { Profile } from "./pages/Profile";
import { Risk } from "./pages/Risk";
import { Start } from "./pages/Start";
import { Capital, GraphView, ImportReview, Output } from "./pages/Stufe2";
import { UiKit } from "./pages/UiKit";
import { Validation } from "./pages/Validation";

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
  return (
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
  );
}
