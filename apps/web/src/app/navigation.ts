import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckSquare,
  Copy,
  FileOutput,
  GitCompare,
  Globe,
  HelpCircle,
  Home,
  Inbox,
  type LucideIcon,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  User,
  Users,
} from "lucide-react";

// Rollenmodell (BRIEF §9). Jede höhere Rolle schließt die niedrigeren ein.
export type Role = "viewer" | "experte" | "controller" | "admin";
export const ROLES: readonly Role[] = ["viewer", "experte", "controller", "admin"];
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  experte: 1,
  controller: 2,
  admin: 3,
};

export type BadgeTone = "neutral" | "crit";

export interface NavItem {
  id: string;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  minRole: Role;
  /** Stufe-2-Modul: nur sichtbar, wenn der Erweitert-Schalter aktiv ist. */
  stufe2?: boolean;
  /** Badge-Quelle (Zähler aus useNavBadges). */
  badgeKey?: string;
  badgeTone?: BadgeTone;
  /** §-Bezug + Screenshot aus dem Design-Handoff (Doku/Platzhalter). */
  section: string;
  shot: string;
}

export interface NavGroup {
  id: string;
  titleKey: string;
  minRole: Role;
  stufe2?: boolean;
  items: NavItem[];
}

// Zentrale Navigations-/Routen-Quelle (BRIEF §4). Sidebar UND Routing leiten
// sich hieraus ab — eine einzige Wahrheit.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "arbeitsbereich",
    titleKey: "nav.group.workspace",
    minRole: "viewer",
    items: [
      {
        id: "start",
        path: "/start",
        labelKey: "nav.start",
        icon: Home,
        minRole: "viewer",
        section: "7.1",
        shot: "01",
      },
      {
        id: "aufgaben",
        path: "/aufgaben",
        labelKey: "nav.tasks",
        icon: CheckSquare,
        minRole: "experte",
        badgeKey: "tasks",
        section: "7.1",
        shot: "02",
      },
      {
        id: "erfassen",
        path: "/erfassen",
        labelKey: "nav.capture",
        icon: Plus,
        minRole: "experte",
        section: "7.3",
        shot: "03",
      },
      {
        id: "fragen",
        path: "/fragen",
        labelKey: "nav.ask",
        icon: MessageSquare,
        minRole: "viewer",
        section: "7.8",
        shot: "05",
      },
      {
        id: "bibliothek",
        path: "/bibliothek",
        labelKey: "nav.library",
        icon: BookOpen,
        minRole: "viewer",
        section: "7.10",
        shot: "07",
      },
      {
        id: "extern",
        path: "/extern",
        labelKey: "nav.external",
        icon: Globe,
        minRole: "viewer",
        section: "7.10",
        shot: "07",
      },
    ],
  },
  {
    id: "qualitaet",
    titleKey: "nav.group.quality",
    minRole: "controller",
    items: [
      {
        id: "validierung",
        path: "/validierung",
        labelKey: "nav.validation",
        icon: ShieldCheck,
        minRole: "controller",
        badgeKey: "validation",
        section: "7.6",
        shot: "10",
      },
      {
        id: "konflikte",
        path: "/konflikte",
        labelKey: "nav.conflicts",
        icon: GitCompare,
        minRole: "controller",
        badgeKey: "conflicts",
        badgeTone: "crit",
        section: "7.7",
        shot: "11",
      },
      {
        // Berater-Konzept Duplikate 04.07. (Stufe D4): Duplikate-Board (Redaktion, kein Wahrheits-
        // konflikt) — neutraler Badge, bewusst weniger dringlich als Konflikte.
        id: "duplikate",
        path: "/duplikate",
        labelKey: "nav.duplicates",
        icon: Copy,
        minRole: "controller",
        badgeKey: "duplicates",
        section: "7.7",
        shot: "11",
      },
      {
        id: "risiko",
        path: "/risiko",
        labelKey: "nav.risk",
        icon: AlertTriangle,
        minRole: "controller",
        section: "7.9",
        shot: "12",
      },
      {
        id: "lebenszyklus",
        path: "/lebenszyklus",
        labelKey: "nav.lifecycle",
        icon: RefreshCw,
        minRole: "controller",
        badgeKey: "lifecycle",
        section: "7.14",
        shot: "13",
      },
    ],
  },
  {
    id: "steuerung",
    titleKey: "nav.group.control",
    minRole: "admin",
    items: [
      {
        id: "analytics",
        path: "/analytics",
        labelKey: "nav.analytics",
        icon: BarChart3,
        minRole: "admin",
        section: "7.13",
        shot: "14",
      },
      {
        id: "admin",
        path: "/admin",
        labelKey: "nav.admin",
        icon: Users,
        minRole: "admin",
        section: "7.15",
        shot: "15",
      },
    ],
  },
  {
    id: "erweitert",
    titleKey: "nav.group.advanced",
    minRole: "admin",
    stufe2: true,
    items: [
      {
        id: "output",
        path: "/output",
        labelKey: "nav.output",
        icon: FileOutput,
        minRole: "admin",
        stufe2: true,
        section: "7.12",
        shot: "16",
      },
      {
        id: "import",
        path: "/import",
        labelKey: "nav.import",
        icon: Inbox,
        minRole: "admin",
        stufe2: true,
        section: "7.11",
        shot: "17",
      },
      {
        id: "graph",
        path: "/graph",
        labelKey: "nav.graph",
        icon: Share2,
        minRole: "admin",
        stufe2: true,
        section: "7.9",
        shot: "18",
      },
      {
        id: "kapital",
        path: "/kapital",
        labelKey: "nav.capital",
        icon: Building2,
        minRole: "admin",
        stufe2: true,
        section: "7.17",
        shot: "19",
      },
    ],
  },
];

// Fuß + über das Nutzerfeld erreichbar (nicht in den Gruppen).
export const FOOT_ITEMS: NavItem[] = [
  {
    id: "hilfe",
    path: "/hilfe",
    labelKey: "nav.help",
    icon: HelpCircle,
    minRole: "viewer",
    section: "U-4",
    shot: "21",
  },
  {
    id: "profil",
    path: "/profil",
    labelKey: "nav.profile",
    icon: User,
    minRole: "viewer",
    section: "U-7",
    shot: "20",
  },
];

export const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS];

export function canSee(item: NavItem, role: Role, stufe2: boolean): boolean {
  if (item.stufe2 && !stufe2) {
    return false;
  }
  return ROLE_RANK[role] >= ROLE_RANK[item.minRole];
}

// Topbar-Icons hier mit re-exportieren, damit die Shell eine Quelle hat.
export const TopbarIcons = { Search, Bell, Smartphone, HelpCircle } as const;
