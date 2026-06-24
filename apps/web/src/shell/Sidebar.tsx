import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import {
  canSee,
  FOOT_ITEMS,
  NAV_GROUPS,
  type NavItem,
  ROLES,
  type Role,
} from "../app/navigation";
import { useRole } from "../app/RoleContext";
import { useNavBadges } from "../app/useNavBadges";
import { Logo } from "./Logo";

function Badge({ count, tone, active }: { count: number; tone?: "neutral" | "crit"; active: boolean }): JSX.Element {
  const cls = active
    ? "bg-white/20 text-white"
    : tone === "crit"
      ? "bg-trust-crit-bg text-trust-crit-text"
      : "bg-hairline text-muted";
  return (
    <span className={`ml-auto rounded-pill px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${cls}`}>
      {count}
    </span>
  );
}

function NavRow({ item, badge }: { item: NavItem; badge?: number }): JSX.Element {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        [
          "group flex items-center gap-2.5 rounded-nav px-2.5 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-brand text-white outline outline-2 outline-brand outline-offset-2"
            : "text-text hover:bg-hairline-soft",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[8px] ${
              isActive ? "bg-white/15 text-white" : "bg-[rgba(16,24,32,.05)] text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="truncate">{t(item.labelKey)}</span>
          {item.badgeKey && badge ? <Badge count={badge} tone={item.badgeTone} active={isActive} /> : null}
        </>
      )}
    </NavLink>
  );
}

function RoleSwitcher(): JSX.Element {
  const { t } = useTranslation();
  const { role, setRole, stufe2, setStufe2 } = useRole();
  return (
    <div className="border-t border-hairline px-3 pt-3">
      <div className="px-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
        {t("role.viewAs")}
      </div>
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
      {role === "admin" ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2 px-1 py-1 text-[11px] text-muted">
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
  const badges = useNavBadges();
  const help = FOOT_ITEMS.find((i) => i.id === "hilfe");

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-hairline bg-surface">
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
                {group.stufe2 ? <span className="ml-1 text-brand">·2</span> : null}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavRow key={item.id} item={item} badge={item.badgeKey ? badges[item.badgeKey] : undefined} />
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
          MB
        </span>
        <NavLink to="/profil" className="min-w-0 flex-1 leading-tight hover:opacity-80">
          <span className="block truncate text-[13px] font-semibold text-text">M. Brandt</span>
          <span className="block truncate text-[11px] text-muted-2">{t(`role.name.${role}`)}</span>
        </NavLink>
        <button
          type="button"
          title={t("action.logout")}
          className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
