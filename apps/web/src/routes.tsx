import { Plus } from "lucide-react";
import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRole } from "./app/RoleContext";
import { ALL_ITEMS, HOME_ROUTE, type NavItem, canSee } from "./app/navigation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CAPTURE_FRONT_DOOR_ROUTE } from "./lib/captureFrontDoor";
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

const CAPTURE_FRONT_DOOR_ITEM: NavItem = {
  id: "captureFrontDoor",
  path: CAPTURE_FRONT_DOOR_ROUTE,
  labelKey: "nav.capture",
  icon: Plus,
  minRole: "experte",
  section: "7.3",
  shot: "03",
};

const DUPLICATE_COMPARE_ITEM: NavItem = {
  id: "duplicateCompare",
  path: "/duplikate/:id/vergleich",
  labelKey: "nav.duplicates",
  icon: Plus,
  minRole: "controller",
  section: "7.7",
  shot: "11",
};

const CONFLICT_COMPARE_ITEM: NavItem = {
  id: "conflictCompare",
  path: "/konflikte/:id/vergleich",
  labelKey: "nav.conflicts",
  icon: Plus,
  minRole: "controller",
  section: "7.7",
  shot: "11",
};

// Rollen-Gate (RB-2): Deep-Link auf Unerlaubtes → zurück auf Start.
function Guarded({ item }: { item: NavItem }): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!canSee(item, role, stufe2)) {
    return <Navigate to={HOME_ROUTE} replace />;
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
      {ALL_ITEMS.map((item) => (
        <Route key={item.id} path={item.path} element={<Guarded item={item} />} />
      ))}
      <Route
        path={CAPTURE_FRONT_DOOR_ITEM.path}
        element={<Guarded item={CAPTURE_FRONT_DOOR_ITEM} />}
      />
      <Route
        path={DUPLICATE_COMPARE_ITEM.path}
        element={<Guarded item={DUPLICATE_COMPARE_ITEM} />}
      />
      <Route path={CONFLICT_COMPARE_ITEM.path} element={<Guarded item={CONFLICT_COMPARE_ITEM} />} />
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
