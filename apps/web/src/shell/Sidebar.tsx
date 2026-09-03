import { LogOut } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useSession } from "../app/AuthContext";
import { GuardedLink, GuardedNavLink } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import {
  FOOT_ITEMS,
  NAV_GROUPS,
  type NavItem,
  ROLES,
  type Role,
  canSee,
  istAktiverEintrag,
} from "../app/navigation";
import { type NavBadge, navBadgeLabelKey, useNavBadges } from "../app/useNavBadges";
import { navHilfeFor } from "../lib/navHilfe";
import { Logo } from "./Logo";

// SCRUM-486 E: Badge trägt neben der Zahl ihre Bedeutung — `label` wird zu title + aria-label, damit
// Maus-Hover und Screenreader sagen, WAS gezählt wird (Widersprüche/Dubletten/Aufgaben/Prüfung).
function Badge({
  count,
  tone,
  active,
  label,
}: {
  count: number;
  tone?: "neutral" | "crit" | undefined;
  active: boolean;
  label?: string | undefined;
}): JSX.Element {
  const cls = active
    ? "bg-white/20 text-white"
    : tone === "crit"
      ? "bg-trust-crit-bg text-trust-crit-text"
      : "bg-hairline text-muted";
  return (
    <span
      className={`ml-auto rounded-pill px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${cls}`}
      title={label}
      aria-label={label}
    >
      {count}
    </span>
  );
}

// AUFTRAG-mega2 Block C (bens D9): Ladepunkt für ein noch nicht geladenes Badge — SICHTBAR anders als
// ein echter Zähler (Zahl) und als ein echtes Nullergebnis (gar kein Badge). Screenreader hören „lädt".
function BadgeLoading({ active, label }: { active: boolean; label: string }): JSX.Element {
  return (
    <span
      className={`ml-auto grid h-[17px] w-[17px] place-items-center rounded-pill ${
        active ? "bg-white/20" : "bg-hairline"
      }`}
      title={label}
      aria-label={label}
    >
      <span
        className={`h-1.5 w-1.5 animate-pulse rounded-full ${active ? "bg-white/70" : "bg-muted"}`}
      />
    </span>
  );
}

// AUFTRAG-mega3 Block B (bens D9): ein Badge, dessen Quelle dauerhaft scheiterte (ohne Daten), zeigt
// einen SICHTBAREN Fehler-Marker („!") mit Wiederholen — nicht die stillschweigend fehlende Zahl und
// erst recht keine erfundene 0. Der Marker ist ein Button (Klick = refetch); der übersetzte aria-label/
// title sagt, was los ist. Bewusst als eigenständiges Element neben dem Nav-Link (kein Auto-Reload).
function BadgeError({
  active,
  label,
  onRetry,
}: { active: boolean; label: string; onRetry: () => void }): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        // Nicht die Navigation auslösen — nur den erneuten Abruf.
        e.preventDefault();
        e.stopPropagation();
        onRetry();
      }}
      className={`ml-auto grid h-[17px] w-[17px] place-items-center rounded-pill font-semibold text-[11px] ${
        active ? "bg-white/20 text-white" : "bg-trust-crit-bg text-trust-crit-text"
      }`}
    >
      !
    </button>
  );
}

// AUFTRAG-mega4 Block B (bens Sammel-Review 4): ein Refetch der bereits geladenen Zahl scheiterte —
// die alte Zahl bleibt WEITER sichtbar (nicht verschwiegen, nicht auf 0 erfunden), daneben ein SICHTBARER,
// übersetzter Störungshinweis („!") mit Wiederholen (Klick = refetch). Weder ein Initialfehler (die Zahl
// steht ja) noch ein stilles „loaded". Die Zahl trägt weiter ihre bedeutungstragende aria-Beschriftung;
// der Marker seine eigene, damit Screenreader BEIDES hören: die Zahl UND „veraltet, erneut versuchen".
function BadgeStale({
  count,
  tone,
  active,
  label,
  staleLabel,
  onRetry,
}: {
  count: number;
  tone?: "neutral" | "crit" | undefined;
  active: boolean;
  label?: string | undefined;
  staleLabel: string;
  onRetry: () => void;
}): JSX.Element {
  const numCls = active
    ? "bg-white/20 text-white"
    : tone === "crit"
      ? "bg-trust-crit-bg text-trust-crit-text"
      : "bg-hairline text-muted";
  return (
    <span className="ml-auto inline-flex items-center gap-1">
      {count > 0 ? (
        <span
          className={`rounded-pill px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${numCls}`}
          title={label}
          aria-label={label}
        >
          {count}
        </span>
      ) : null}
      <button
        type="button"
        title={staleLabel}
        aria-label={staleLabel}
        onClick={(e) => {
          // Nicht navigieren — nur den erneuten Abruf auslösen.
          e.preventDefault();
          e.stopPropagation();
          onRetry();
        }}
        className={`grid h-[17px] w-[17px] place-items-center rounded-pill text-[11px] font-semibold ${
          active ? "bg-white/20 text-white" : "bg-trust-warn-bg text-trust-warn-text"
        }`}
      >
        !
      </button>
    </span>
  );
}

function NavRow({ item, badge }: { item: NavItem; badge?: NavBadge | undefined }): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const badgeLabelKey = item.badgeKey ? navBadgeLabelKey(item.badgeKey) : undefined;
  const Icon = item.icon;
  const isActive = istAktiverEintrag(item, pathname);
  // ============================================================================================
  // JOB 3028 · U3 — DER PUNKT ERKLÄRT SICH VOR DEM KLICK.
  // ============================================================================================
  //
  // Dieselbe Frage, die SCRUM-486 E für das Zähler-Abzeichen beantwortet hat („Maus-Hover und
  // Screenreader sagen, WAS gezählt wird"), wurde für den Menüpunkt selbst nie gestellt: er trug
  // ein Wort und sonst nichts. Der Satz dazu steht seit SCRUM-219 als Hilfekapitel im Produkt;
  // `navHilfeFor` holt ihn von dort (kein neuer Text, keine zweite Tabelle) — oder liefert `null`,
  // und dann bleibt der Punkt STUMM. Das Fehlen ist hier die ehrliche Auskunft.
  //
  // ZWEI TRÄGER, WEIL EIN TRÄGER NUR EINE HÄLFTE BEDIENT: `title` sieht die Maus, `aria-describedby`
  // hört der Screenreader. Der zugängliche NAME des Links bleibt dabei die Beschriftung — deshalb
  // ausdrücklich kein `aria-label`: eine Beschreibung ERGÄNZT den Namen, sie ersetzt ihn nicht.
  //
  // Der Träger liegt AUSSERHALB des Links. Läge er darin, flösse sein Text in den Namen des Links
  // ein und aus „Meine Aufgaben" würde der ganze Absatz. Er ist ein `<span class="sr-only">` ohne
  // `tabindex`: nicht fokussierbar (die Fokusfalle des Off-Canvas-Drawers bleibt unberührt) und
  // ausser Fluss (`sr-only` ist absolut positioniert) — kein Maß der Seitenleiste ändert sich.
  //
  // Die Aussage hat KEINE Datenquelle zur Laufzeit: sie entsteht aus zwei Konstanten und der
  // Übersetzung. Sie hängt insbesondere nicht am Zähler und ist in Lade-, Fehler- und Veraltet-Lage
  // dieselbe — sie sagt, WAS hinter dem Punkt liegt, nicht ob dort gerade etwas zu tun ist.
  const hilfe = navHilfeFor(item.path);
  const hilfeId = useId();
  const hilfeText = hilfe ? t(hilfe.bodyKey) : undefined;
  return (
    // AUFTRAG-mega11 Block B-2 (bens SB-2): die hier von Hand verdrahtete Wächter-Logik (Vorbild für
    // alles Übrige) steckt in den Guarded-Bauteilen — dieselbe Wirkung, aber als Bauteil, das eine
    // künftige Navigationsquelle nicht mehr vergessen kann.
    //
    // JOB 562: WARUM HIER `GuardedLink` STEHT UND NICHT `GuardedNavLink`. `NavLink` bestimmt seinen
    // Aktivzustand ausschliesslich aus dem eigenen `to` und setzt `aria-current` selbst; ein von
    // aussen gesetztes `aria-current` wirkt dort nur, wenn `NavLink` ohnehin schon aktiv ist. Für
    // die Entscheidung `ENTSCHEIDUNGEN/JOB-562.md:17` — der Bibliothekseintrag ist auch auf
    // `/wissen/:id` aktiv — reicht das nicht. Die Aktivfrage wird deshalb EINMAL von
    // `istAktiverEintrag` beantwortet und hier angewandt: eine Regel, eine Stelle, kein zweiter
    // Aktivbegriff neben dem des Routers. Die bisherige Präfixwirkung ist in dieser Regel enthalten.
    <>
      <GuardedLink
        to={item.path}
        aria-current={isActive ? "page" : undefined}
        // Kein Kapitel ⇒ WEDER `title` NOCH `aria-describedby` — kein leeres Attribut, kein leerer
        // Träger. React lässt ein `undefined`-Attribut ganz weg.
        title={hilfeText}
        aria-describedby={hilfeText === undefined ? undefined : hilfeId}
        className={[
          "group flex items-center gap-2.5 rounded-nav px-2.5 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-brand text-white outline outline-2 outline-brand outline-offset-2"
            : "text-text hover:bg-hairline-soft",
        ].join(" ")}
      >
        <span
          className={`grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[8px] ${
            isActive ? "bg-white/15 text-white" : "bg-[rgba(16,24,32,.05)] text-ink"
          }`}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="truncate">{t(item.labelKey)}</span>
        {item.badgeKey && badge && badge.state === "error" ? (
          // Dauerhaft gescheitert → sichtbarer Fehler-Marker mit Wiederholen (kein stilles Fehlen, keine 0).
          <BadgeError active={isActive} label={t("nav.badge.error")} onRetry={badge.refetch} />
        ) : item.badgeKey && badge && badge.state === "loading" ? (
          // Noch nicht geladen → neutraler Ladepunkt statt einer erfundenen Zahl/0.
          <BadgeLoading active={isActive} label={t("nav.badge.loading")} />
        ) : item.badgeKey && badge && badge.stale ? (
          // Refetch der vorhandenen Zahl scheiterte → alte Zahl WEITER zeigen + Störungshinweis/Retry.
          <BadgeStale
            count={badge.count}
            tone={item.badgeTone}
            active={isActive}
            label={badgeLabelKey ? t(badgeLabelKey, { count: badge.count }) : undefined}
            staleLabel={t("nav.badge.stale")}
            onRetry={badge.refetch}
          />
        ) : item.badgeKey && badge && badge.count > 0 ? (
          <Badge
            count={badge.count}
            tone={item.badgeTone}
            active={isActive}
            label={badgeLabelKey ? t(badgeLabelKey, { count: badge.count }) : undefined}
          />
        ) : null}
      </GuardedLink>
      {hilfeText === undefined ? null : (
        <span id={hilfeId} className="sr-only">
          {hilfeText}
        </span>
      )}
    </>
  );
}

function RoleSwitcher(): JSX.Element | null {
  const { t } = useTranslation();
  const { role, setRole, stufe2, setStufe2, canPreview, previewActive } = useRole();
  // Bug (Pedi 04.07.): Ein Admin darf die ANSICHT als jede Rolle prüfen (Beta-Test); die echte
  // Session bleibt Admin. Nicht-Admins sehen den Umschalter nicht (keine Rechte-Eskalation).
  const showPreviewSwitch = canPreview;
  const showStufe2 = role === "admin";
  if (!showPreviewSwitch && !showStufe2) {
    return null;
  }
  return (
    <div className="border-t border-hairline px-3 pt-3">
      {showPreviewSwitch ? (
        <>
          <div className="px-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
            {t("role.viewAs")}
          </div>
          {/* Sichtbarer Hinweis, dass die echte Rolle Admin bleibt — plus 1-Klick zurück. */}
          {previewActive ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-btn bg-trust-warn-bg px-2 py-1.5">
              <span className="text-[10.5px] leading-tight text-trust-warn-text">
                {t("role.previewNote", { role: t(`role.short.${role}`) })}
              </span>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className="shrink-0 rounded-pill bg-surface px-2 py-0.5 text-[10px] font-semibold text-text hover:opacity-80"
              >
                {t("role.backToAdmin")}
              </button>
            </div>
          ) : null}
          <div className="mt-2 grid grid-cols-4 gap-1">
            {ROLES.map((r: Role) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-pill px-1 py-1 text-[11px] font-semibold transition-colors ${
                  role === r ? "bg-brand text-white" : "bg-hairline-soft text-muted hover:text-text"
                }`}
              >
                {t(`role.short.${r}`)}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {showStufe2 ? (
        // AUFTRAG-mega51 BLOCK G1: „Stufe 2" ist ein Hausbegriff — für eine Erstnutzerin sagt die
        // Zahl nichts. Der Schalter bleibt, wie er ist, trägt aber jetzt den erklärenden Halbsatz.
        <label
          title={t("role.stage2Hint")}
          className="mt-2 flex cursor-pointer items-center gap-2 px-1 py-1 text-[11px] text-muted"
        >
          <input
            type="checkbox"
            checked={stufe2}
            onChange={(e) => setStufe2(e.target.checked)}
            className="accent-brand"
          />
          <span className="font-mono uppercase tracking-wide">{t("role.stage2")}</span>
        </label>
      ) : null}
    </div>
  );
}

export function Sidebar(): JSX.Element {
  const { t } = useTranslation();
  const { role, stufe2 } = useRole();
  const { user, signOut } = useSession();
  const badges = useNavBadges();
  const help = FOOT_ITEMS.find((i) => i.id === "hilfe");
  const name = user?.name ?? "—";
  const initials = (user?.name ?? "?").slice(0, 2).toUpperCase();

  return (
    // mega40 C: `kw-sidebar` ist ein reiner Stil-Anker für das modern-Thema (styles/modern.css).
    <aside className="kw-sidebar flex h-full w-[252px] shrink-0 flex-col border-r border-hairline bg-surface">
      <div className="px-4 py-4">
        <Logo />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => canSee(i, role, stufe2));
          if (items.length === 0) {
            return null;
          }
          return (
            <div key={group.id}>
              <div className="mb-1.5 px-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                {t(group.titleKey)}
                {group.stufe2 ? <span className="ml-1 text-brand-text">·2</span> : null}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 pb-2">{help ? <NavRow item={help} /> : null}</div>

      <RoleSwitcher />

      <div className="flex items-center gap-2.5 border-t border-hairline px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
          {initials}
        </span>
        {/* AUFTRAG-mega11 Block B-2 (bens SB-2): war ein roher NavLink — der einzige Nav-Eintrag der
            Sidebar, der am Wächter vorbeiging. */}
        <GuardedNavLink to="/profil" className="min-w-0 flex-1 leading-tight hover:opacity-80">
          <span className="block truncate text-[13px] font-semibold text-text">{name}</span>
          <span className="block truncate text-[11px] text-muted-2">{t(`role.name.${role}`)}</span>
        </GuardedNavLink>
        <button
          type="button"
          title={t("action.logout")}
          onClick={() => void signOut()}
          className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
