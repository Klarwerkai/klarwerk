import { Bell, HelpCircle, Search, Smartphone } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useNotifications, useReasonerStatus } from "../api/hooks";

function LangPill(): JSX.Element {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : "de";
  return (
    <div className="flex overflow-hidden rounded-pill border border-hairline text-[12px] font-semibold">
      {(["de", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => void i18n.changeLanguage(l)}
          className={`px-2.5 py-1 uppercase transition-colors ${
            lang === l ? "bg-ink text-white" : "text-muted hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function NotificationBell(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const items = data ?? [];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
        aria-label={t("topbar.notifications")}
      >
        <Bell size={18} />
        {items.length > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-bold text-white">
            {items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-20 w-80 rounded-card border border-hairline bg-surface p-3 shadow-popover">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
            {t("topbar.notifications")}
          </div>
          {items.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">{t("topbar.notificationsEmpty")}</p>
          ) : (
            <ul className="space-y-0.5">
              {items.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.kind === "conflict" ? "/konflikte" : "/risiko"}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 rounded-btn px-1.5 py-1.5 text-[13px] text-text hover:bg-hairline-soft"
                  >
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        n.kind === "conflict" ? "bg-trust-crit-fill" : "bg-trust-info-text"
                      }`}
                    />
                    <span className="truncate">{n.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ReasonerStatusPill(): JSX.Element {
  const { t } = useTranslation();
  const { data } = useReasonerStatus();
  const active = data?.active ?? false;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
        active ? "bg-trust-pos-bg text-trust-pos-text" : "bg-page text-muted"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-trust-pos-fill" : "bg-muted-2"}`} />
      {active ? t("topbar.reasonerActive") : t("topbar.reasonerOffline")}
    </div>
  );
}

export function Topbar(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/bibliothek?q=${encodeURIComponent(term)}` : "/bibliothek");
  };

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-hairline bg-surface px-5">
      <form
        onSubmit={submitSearch}
        className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-input border border-hairline bg-page px-3 text-muted focus-within:border-ink/30"
      >
        <button
          type="submit"
          aria-label={t("topbar.search")}
          className="grid place-items-center text-muted hover:text-text"
        >
          <Search size={16} />
        </button>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("topbar.search")}
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-muted-2"
        />
        <button
          type="button"
          aria-label={t("cmd.open")}
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="hidden shrink-0 rounded border border-hairline px-1.5 font-mono text-[11px] text-muted-2 hover:text-text sm:block"
        >
          ⌘K
        </button>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/mobile")}
          className="flex items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-text"
        >
          <Smartphone size={15} />
          {t("topbar.mobile")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/hilfe")}
          className="grid h-9 w-9 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
          aria-label={t("nav.help")}
        >
          <HelpCircle size={18} />
        </button>
        <LangPill />
        <NotificationBell />
        <ReasonerStatusPill />
      </div>
    </header>
  );
}
