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
// AUFTRAG-mega51 BLOCK A: die bewachten Deep-Link-Routen ziehen ihren Pfad aus derselben
// Konstante wie der Router — keine abgeschriebene Zeichenfolge.
import { CAPTURE_FRONT_DOOR_ROUTE } from "../lib/captureFrontDoor";

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
  /**
   * JOB 562 (Entscheidung `00_CONTROL/ENTSCHEIDUNGEN/JOB-562.md:17`): weitere Routenpräfixe, unter
   * denen dieser Eintrag als aktuelle Seite gilt.
   *
   * Der Anlass: eine Wissensseite `/wissen/:id` gehört zur Bibliothek, hat aber keinen eigenen
   * Menüpunkt — und soll auch keinen bekommen (`:19` verwirft „Eigener Eintrag für die
   * Detailseite" ausdrücklich). Ohne diese Angabe wäre auf der Detailseite gar kein Eintrag
   * ausgezeichnet, und die Nutzerin verlöre ihren Ort im Menü.
   */
  aktivAuchUnter?: readonly string[];
  /** §-Bezug + Screenshot aus dem Design-Handoff (Doku/Platzhalter). */
  section: string;
  shot: string;
}

/**
 * Gilt dieser Eintrag unter dieser Route als aktuelle Seite?
 *
 * EINE Regel an EINER Stelle — der Renderer entscheidet nicht selbst. Sie bildet die bisherige
 * Präfixwirkung ab (eine Unterroute hält ihren Eintrag aktiv) und erweitert sie um die in
 * `aktivAuchUnter` benannten Pfade. Der Präfixvergleich verlangt eine Segmentgrenze: `/bibliothek`
 * ist unter `/bibliothek/x` aktiv, unter `/bibliotheksrat` NICHT.
 */
export function istAktiverEintrag(item: NavItem, pathname: string): boolean {
  const passt = (p: string): boolean => pathname === p || pathname.startsWith(`${p}/`);
  return passt(item.path) || (item.aktivAuchUnter ?? []).some(passt);
}

export interface NavGroup {
  id: string;
  titleKey: string;
  minRole: Role;
  stufe2?: boolean;
  items: NavItem[];
}

export const HOME_ROUTE = "/start";

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
        path: HOME_ROUTE,
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
        // JOB 562: die Wissensseite gehört zur Bibliothek und bekommt keinen eigenen Menüpunkt.
        aktivAuchUnter: ["/wissen"],
        section: "7.10",
        shot: "07",
      },
      {
        // JOB 2600 D1: die Themenkarte. Sie steht neben der Bibliothek, weil sie derselbe Bestand
        // aus der Vogelperspektive ist — und der Klick auf einen Knoten fuehrt genau dorthin
        // zurueck (`/bibliothek?tag=…`). `viewer` wie die Bibliothek: die Route dahinter verlangt
        // `ko.read`, und der Bestand ist bereits fuer diesen Betrachter getrimmt.
        id: "wissensnetz",
        path: "/wissensnetz",
        labelKey: "nav.wissensnetz",
        icon: Share2,
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
        // IC-2 (Discoverability, B4): OFFEN. Das Import-Cockpit soll für Admins nicht mehr hinter dem
        // Stufe-2-Schalter versteckt sein. Das Item allein zu entsperren genügt NICHT — die Gruppe
        // „erweitert" trägt selbst stufe2:true; echte Sichtbarkeit erfordert ein Verschieben in eine
        // Admin-Gruppe ohne Stufe-2-Gate (Reihenfolge/nav-Tests/Screenshots betroffen) → bewusst
        // separater Slice, hier NICHT erzwungen.
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

// ================================================================================================
// JOB 3060 · H1 — DIE HÜLLE HAT EIN KOPFBAND MIT FÜNF PUNKTEN, KEINE SEITENLEISTE MEHR.
// ================================================================================================
//
// Die Gruppen oben bleiben die EINE Quelle aller Routen (Router, Palette, Rollen-Gates). Was sich
// ändert, ist der ORT, an dem ein Punkt im Bild steht: fünf Punkte tragen das Kopfband (Mockup
// `design/klarwerk/Main.dc.html` Z.20-24), alles Übrige wohnt im Zahnrad-Menü unter „Weitere
// Bereiche", und „Admin" ist dort die Zeile „Einstellungen". Drei Mengen, und JEDER Gruppenpunkt
// steht in genau einer davon — das pinnt tests/app/h1-navigation-orte.test.ts, damit ein künftiger
// Punkt nicht still aus dem Bild fällt.
const KOPFBAND_IDS = ["start", "fragen", "bibliothek", "erfassen", "validierung"] as const;
export type KopfbandId = (typeof KOPFBAND_IDS)[number];

/**
 * Die Beschriftung im Kopfband. Zwei Punkte heißen dort kürzer als in ihrer Seite („Erfassen"
 * statt „Wissen erfassen", „Prüfen" statt „Validierung") — die Seitentitel bleiben unangetastet.
 */
export const KOPFBAND_LABEL_KEY: Record<KopfbandId, string> = {
  start: "nav.start",
  fragen: "nav.ask",
  bibliothek: "nav.library",
  erfassen: "kopfband.erfassen",
  validierung: "kopfband.pruefen",
};

/** Reihenfolge im Zahnrad-Menü „Weitere Bereiche" (Auftrag JOB 3060, Lieferung 2). */
const WEITERE_BEREICHE_IDS = [
  "aufgaben",
  "konflikte",
  "duplikate",
  "wissensnetz",
  "extern",
  "risiko",
  "lebenszyklus",
  "analytics",
  "output",
  "import",
  "graph",
  "kapital",
] as const;

/** Der Gruppenpunkt, der im Zahnrad-Menü als „Einstellungen" steht. */
const EINSTELLUNGEN_ID = "admin";

function gruppenPunkt(id: string): NavItem {
  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === id);
  if (!item) {
    throw new Error(`Navigationspunkt „${id}" fehlt in NAV_GROUPS.`);
  }
  return item;
}

/** Die fünf Punkte des Kopfbands, in Bildreihenfolge — noch OHNE Rollenfilter. */
export function kopfbandItems(): NavItem[] {
  return KOPFBAND_IDS.map(gruppenPunkt);
}

/** Die Punkte des Untermenüs „Weitere Bereiche", in Menüreihenfolge — noch OHNE Rollenfilter. */
export function weitereBereicheItems(): NavItem[] {
  return WEITERE_BEREICHE_IDS.map(gruppenPunkt);
}

/** Der Punkt hinter „Einstellungen" im Zahnrad-Menü. */
export function einstellungenItem(): NavItem {
  return gruppenPunkt(EINSTELLUNGEN_ID);
}

// WP-UX-WOW-1 U9: das Rollen-Gate separat prüfbar — der Routen-Guard unterscheidet damit ehrlich
// „Rolle reicht nicht" (harte Umleitung, RB-2 unverändert) von „nur Stufe 2 ist aus" (erklärende
// Karte statt stiller Umleitung). Die Navigation (canSee) blendet weiterhin beides aus.
export function roleAllows(item: NavItem, role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[item.minRole];
}

export function canSee(item: NavItem, role: Role, stufe2: boolean): boolean {
  if (item.stufe2 && !stufe2) {
    return false;
  }
  return roleAllows(item, role);
}

// ================================================================================================
// AUFTRAG-mega51 BLOCK A — DIE FRAGE „KOMMT DIESE ROLLE DA ÜBERHAUPT HIN?"
// ================================================================================================
// mega39 hat die EMPFEHLUNG an diese Quelle gebunden. Die Frage stellt sich aber an jedem Ziel,
// das eine Seite als Weg anbietet — und der Router beantwortet sie nicht nur aus `ALL_ITEMS`:
// er bewacht drei weitere Deep-Link-Routen, die keinen Navigationseintrag haben. Die standen
// bisher als eigene Konstanten IN routes.tsx. Genau die Bauform, die mega39 abgeschafft hat
// (eine zweite Tabelle, die auseinanderlaufen kann) — deshalb stehen sie jetzt hier, an der
// Quelle, und routes.tsx liest sie von hier.
export const EXTRA_GUARDED_ITEMS: NavItem[] = [
  {
    id: "captureFrontDoor",
    path: CAPTURE_FRONT_DOOR_ROUTE,
    labelKey: "nav.capture",
    icon: Plus,
    minRole: "experte",
    section: "7.3",
    shot: "03",
  },
  {
    id: "duplicateCompare",
    path: "/duplikate/:id/vergleich",
    labelKey: "nav.duplicates",
    icon: Plus,
    minRole: "controller",
    section: "7.7",
    shot: "11",
  },
  {
    id: "conflictCompare",
    path: "/konflikte/:id/vergleich",
    labelKey: "nav.conflicts",
    icon: Plus,
    minRole: "controller",
    section: "7.7",
    shot: "11",
  },
];

// ALLE Routen mit Rollen-Gate — genau die Menge, über die `Guarded` in routes.tsx entscheidet.
export const GUARDED_ITEMS: NavItem[] = [...ALL_ITEMS, ...EXTRA_GUARDED_ITEMS];

// Ein Klickziel ist ein href, keine Route: es trägt Query (`?demo=stage1`, `?q=…`) und Anker.
// Für die Rollenfrage zählt nur der Pfad.
function routePathOf(to: string): string {
  const ohneAnker = to.split("#")[0] ?? "";
  const pfad = ohneAnker.split("?")[0] ?? "";
  return pfad.length > 1 && pfad.endsWith("/") ? pfad.slice(0, -1) : pfad;
}

// Routenmuster gegen konkreten Pfad — `:id` steht für genau ein Segment (wie im Router).
function pathMatches(muster: string, pfad: string): boolean {
  const m = muster.split("/");
  const p = pfad.split("/");
  return m.length === p.length && m.every((seg, i) => seg.startsWith(":") || seg === p[i]);
}

// DIE Antwort des Routers, nicht eine zweite Meinung darüber: gibt es für den Pfad ein Gate,
// entscheidet dessen `minRole`; gibt es keins (z. B. `/wissen/:id`, `/hilfe`), lässt der Router
// jede Rolle durch — dann ist „erreichbar" die WAHRE Auskunft und nicht ein vorsichtiges Nein.
// (Bewusst anders als `canActOn` in lib/workCenter.ts: dort geht es um eine EMPFEHLUNG, und die
// bleibt fail-closed — ein unbelegtes Ziel wird nicht empfohlen. Beide lesen dieselbe Registry.)
export function routePathAllows(to: string, role: Role): boolean {
  const pfad = routePathOf(to);
  const gate = GUARDED_ITEMS.find((i) => pathMatches(i.path, pfad));
  return gate ? roleAllows(gate, role) : true;
}

// Topbar-Icons hier mit re-exportieren, damit die Shell eine Quelle hat.
export const TopbarIcons = { Search, Bell, Smartphone, HelpCircle } as const;
