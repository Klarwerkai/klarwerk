import { useTranslation } from "react-i18next";
import type { DisplayStatus } from "./types";

// Status-Pill (BRIEF §5). Farben fest je Status — bewusst inline, da einige
// Töne nicht in den Tailwind-Tokens liegen.
const STYLE: Record<DisplayStatus, { color: string; background: string }> = {
  entwurf: { color: "#687078", background: "#eef0f1" },
  offen: { color: "#1c5d70", background: "#e4eef1" },
  pruefung: { color: "#9a6a12", background: "#faf1db" },
  validiert: { color: "#256b46", background: "#e2f1e8" },
  abgelehnt: { color: "#9e352e", background: "#f8e7e5" },
  revalidierung: { color: "#9a6a12", background: "#faf1db" },
  konflikt: { color: "#9e352e", background: "#f8e7e5" },
};

export function StatusPill({ status }: { status: DisplayStatus }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[11px] font-semibold"
      style={STYLE[status]}
    >
      {t(`status.${status}`)}
    </span>
  );
}
