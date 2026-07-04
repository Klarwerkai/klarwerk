import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRole } from "./app/RoleContext";
import { ALL_ITEMS, type NavItem, canSee } from "./app/navigation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Admin } from "./pages/Admin";
import { Analytics } from "./pages/Analytics";
import { Ask } from "./pages/Ask";
import { Capture } from "./pages/Capture";
import { Conflicts } from "./pages/Conflicts";
import { ExternalKnowledge } from "./pages/ExternalKnowledge";
import { Help } from "./pages/Help";
import { KnowledgeDetail } from "./pages/KnowledgeDetail";
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

const PAGES: Record<string, ComponentType> = {
  start: Start,
  aufgaben: MyTasks,
  erfassen: Capture,
  fragen: Ask,
  bibliothek: Library,
  extern: ExternalKnowledge,
  validierung: Validation,
  konflikte: Conflicts,
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

// Rollen-Gate (RB-2): Deep-Link auf Unerlaubtes → zurück auf Start.
function Guarded({ item }: { item: NavItem }): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!canSee(item, role, stufe2)) {
    return <Navigate to="/start" replace />;
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
      <Route path="/" element={<Navigate to="/start" replace />} />
      {ALL_ITEMS.map((item) => (
        <Route key={item.id} path={item.path} element={<Guarded item={item} />} />
      ))}
      <Route path="/wissen/:id" element={<KnowledgeDetail />} />
      <Route path="/mobile" element={<Mobile />} />
      <Route path="/ui-kit" element={<UiKit />} />
      <Route path="*" element={<Navigate to="/start" replace />} />
    </Routes>
  );
}
