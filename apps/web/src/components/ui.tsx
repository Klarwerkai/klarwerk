import type { UseQueryResult } from "@tanstack/react-query";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";

export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  kicker,
  title,
  actions,
}: {
  kicker?: string;
  title: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        {kicker ? (
          <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{kicker}</div>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  // Optionaler Anker für Deep-Links/Sprungmarken (SCRUM-227). Rein additiv.
  id?: string;
}): JSX.Element {
  return (
    <div id={id} className={cx("rounded-card border border-hairline bg-surface p-5", className)}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mb-2 font-mono text-micro uppercase tracking-wider text-muted-2">
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export function Button({ variant = "outline", className, ...props }: ButtonProps): JSX.Element {
  const styles = {
    primary: "bg-ink text-white hover:opacity-90",
    ghost: "text-muted hover:bg-hairline-soft hover:text-text",
    outline: "border border-hairline text-text hover:bg-hairline-soft",
  }[variant];
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-btn px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-muted-2 focus:border-ink/30",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }): JSX.Element {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Das Eingabefeld wird als children im Label gerendert.
    <label className="block space-y-1.5">
      <span className="block text-[12.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function StateShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

// Vereinheitlichte Zustände (Zustands-Katalog): laden / Fehler / leer / Inhalt.
export function QueryState<T>({
  query,
  emptyText,
  emptyExtra,
  children,
}: {
  query: UseQueryResult<T>;
  emptyText?: string;
  // SCRUM-181: optionaler Slot unter dem Leer-Text (z. B. „nächste Schritte"-CTAs).
  emptyExtra?: ReactNode;
  children: (data: T) => ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  if (query.isLoading) {
    return <StateShell>{t("state.loading")}</StateShell>;
  }
  if (query.isError) {
    const e = query.error;
    const msg = e instanceof ApiError ? e.message : t("state.error");
    return <StateShell>{msg}</StateShell>;
  }
  const data = query.data;
  const empty = data == null || (Array.isArray(data) && data.length === 0);
  if (empty) {
    return (
      <StateShell>
        {emptyText ?? t("state.empty")}
        {emptyExtra}
      </StateShell>
    );
  }
  return <>{children(data as T)}</>;
}

export function Avatar({ initials }: { initials: string }): JSX.Element {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
      {initials}
    </span>
  );
}
