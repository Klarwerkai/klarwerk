import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useNavGuard } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { ALL_ITEMS, canSee } from "../app/navigation";
import { ANALYTICS_AUDIT_PATH } from "../lib/analyticsSections";

// Command Palette (FE-FND-03): ⌘K / Strg+K öffnet eine Schnellnavigation über
// alle für die Rolle sichtbaren Ziele. Pfeiltasten + Enter, Esc schließt.
export function CommandPalette(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { guard } = useNavGuard();
  const { role, stufe2 } = useRole();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const navTargets = ALL_ITEMS.filter((i) => canSee(i, role, stufe2)).map((i) => ({
      id: i.id,
      label: t(i.labelKey),
      path: i.path,
    }));
    // SCRUM-229: Audit ist in Analytics konsolidiert — als Deep-Link auffindbar machen,
    // sichtbar nur, wenn Analytics für die Rolle sichtbar ist.
    const analyticsItem = ALL_ITEMS.find((i) => i.id === "analytics");
    if (analyticsItem && canSee(analyticsItem, role, stufe2)) {
      navTargets.push({ id: "audit", label: t("cmd.audit"), path: ANALYTICS_AUDIT_PATH });
    }
    return navTargets;
  }, [role, stufe2, t]);
  const filtered = useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())),
    [items, q],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onCustom = (): void => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onCustom);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  if (!open) {
    return null;
  }

  const go = (path: string): void => {
    setOpen(false);
    guard(() => navigate(path));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <button
        type="button"
        aria-label={t("cmd.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/30"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-card border border-hairline bg-surface shadow-popover">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const it = filtered[active];
              if (it) {
                go(it.path);
              }
            }
          }}
          placeholder={t("cmd.placeholder")}
          className="w-full border-b border-hairline bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">{t("cmd.empty")}</li>
          ) : (
            filtered.map((it, i) => (
              <li key={it.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it.path)}
                  className={`flex w-full items-center gap-2 rounded-btn px-3 py-2 text-left text-[13.5px] ${
                    i === active ? "bg-brand text-white" : "text-text hover:bg-hairline-soft"
                  }`}
                >
                  {it.label}
                  <span
                    className={`ml-auto font-mono text-[11px] ${
                      i === active ? "text-white/70" : "text-muted-2"
                    }`}
                  >
                    {it.path}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
