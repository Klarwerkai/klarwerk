import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  MouseEventHandler,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";

export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}

// ==================================================================================================
// AUFTRAG-mega59 BLOCK H1 — DER ANKER, DEN EINE FEHLERKARTE NICHT HAT.
// ==================================================================================================
//
// Die Rauchprobe „Alle Kernrouten rendern (keine weiße Seite)" hatte als einzigen Anker
// `page.locator("h1, h2").first()`. Genau der Absturz, den ihr Name fangen soll, liefert selbst eine
// Überschrift: jede Route steckt in einer Fehlergrenze (routes.tsx), deren Karte ein `<h2>` rendert.
// Dazu drei weitere Wege zum falschen Grün — `PlaceholderPage` rendert ein `<h1>` mit DEMSELBEN
// Titel wie die echte Seite; ein Rollen-Gate leitet auf `/start` um, das eine `h1` hat; der
// Auffangpfad `*` tut dasselbe.
//
// `pageKey` ist der Anker, den keiner dieser vier Wege hat: `PlaceholderPage` und die Fehlerkarte
// rendern KEINEN `PageHeader`, und die Umleitungen fängt die URL-Zusicherung. Ein Titel genügt dafür
// nicht — deshalb ist es eine Kennung und keine Beschriftung.
//
// Bewusst OPTIONAL: eine fehlende Kennung soll keine Seite zerbrechen, sondern nur bedeuten, dass
// diese Seite in der Routenprobe nicht namentlich verankert ist. Der Sammler dafür ist die Probe
// selbst — sie wird rot, wenn eine der zwölf Kernrouten ihren Anker verliert.
export function PageHeader({
  kicker,
  title,
  actions,
  pageKey,
}: {
  kicker?: string;
  title: string;
  actions?: ReactNode;
  pageKey?: string;
}): JSX.Element {
  return (
    <div
      className="mb-6 flex items-start justify-between gap-4"
      data-testid={pageKey ? `page-${pageKey}` : undefined}
    >
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

// AUFTRAG-smoketor BLOCK A — DER ANKER, DEN ES NIE GAB.
//
// `Ask.tsx:712` schrieb `data-testid="ask-answer"` an `<Card>`, Zeile 1080 dasselbe mit `ask-gap`.
// Beide Anker entstanden im DOM NIE: die Signatur unten nahm nur die fünf benannten Props und
// reichte keine Restattribute weiter. Drei Fälle des Browser-Smoke hingen daran, in allen drei
// Engines — und `tests-smoke/ui-smoke.spec.ts` sicherte zusätzlich zu, dass genau diese beiden
// Anker NULL mal vorkommen. Diese Zusicherung war strukturell immer erfüllt.
//
// WARUM WEDER COMPILER NOCH LINT DAS SAHEN, und das ist der Grund, warum hier die GANZE Klasse
// geschlossen wird statt der zwei Aufrufstellen: TypeScript prüft JSX-Attribute, deren Name kein
// gültiger Bezeichner ist (alles mit Bindestrich), NICHT gegen den Props-Typ. `<Card data-foo>`
// kompiliert deshalb fehlerfrei und verpufft. Ein Anker, den man an ein inneres `<div>` verschiebt,
// repariert zwei Zeilen und lässt die Falle für jedes künftige `data-*` an einer Karte stehen.
//
// Bewusst NUR `data-*` und bewusst kein `HTMLAttributes<HTMLDivElement>`: `className`, `id` und
// `onClick` bleiben die benannten Props mit ihrer Sonderlogik (`interactive`), und die Karte wird
// nicht zum beliebig beschreibbaren `div`.
type DatenAnker = { [K in `data-${string}`]?: string };

export function Card({
  children,
  className,
  id,
  onClick,
  interactive = true,
  ...datenAnker
}: DatenAnker & {
  children: ReactNode;
  className?: string;
  // Optionaler Anker für Deep-Links/Sprungmarken (SCRUM-227). Rein additiv.
  id?: string;
  // SCRUM-416: optionaler Flächen-Klick (Board-Karten öffnen das KO). Rein additiv;
  // die Tastatur-Bedienung läuft weiterhin über die enthaltenen Links/Buttons.
  onClick?: MouseEventHandler<HTMLDivElement>;
  // E2E-012/013: enthält die Karte selbst interaktive Elemente (Links/Buttons/Selects), darf sie
  // NICHT role="button"/tabIndex tragen (verschachtelte Buttons + falscher Sammel-Accessible-Name).
  // `interactive={false}` macht sie zum reinen Container mit Maus-Komfortklick — Tastatur/AT bedienen
  // die enthaltenen Steuerelemente (z. B. den Titel-Link). Standard bleibt unverändert (Button-Karte).
  interactive?: boolean;
}): JSX.Element {
  const asButton = Boolean(onClick) && interactive;
  // Lint a11y (useKeyWithClickEvents, Runner-Befund 03.07. 14:09): Klick-Karten bekommen
  // ein echtes Tastatur-Pendant — fokussierbar (tabIndex) mit Button-Rolle, Enter/Leertaste
  // lösen die Karten-Aktion aus. Nur auf der Karte SELBST: Tastendrücke in enthaltenen
  // Bedienelementen bleiben unberührt (target === currentTarget-Prüfung). Karten ohne
  // onClick bleiben exakt wie bisher (keine Rolle, kein Fokus).
  const handleKeyDown = asButton
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
          event.preventDefault(); // Leertaste soll die Seite nicht scrollen
          onClick?.(event as unknown as Parameters<MouseEventHandler<HTMLDivElement>>[0]);
        }
      }
    : undefined;
  return (
    <div
      {...datenAnker}
      id={id}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={asButton ? "button" : undefined}
      tabIndex={asButton ? 0 : undefined}
      className={cx("rounded-card border border-hairline bg-surface p-5", className)}
    >
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
  variant?: "primary" | "ghost" | "outline" | "danger";
};

export function Button({ variant = "outline", className, ...props }: ButtonProps): JSX.Element {
  const styles = {
    primary: "bg-ink text-white hover:opacity-90",
    ghost: "text-muted hover:bg-hairline-soft hover:text-text",
    outline: "border border-hairline text-text hover:bg-hairline-soft",
    // AUFTRAG-mega14 Block F (SCRUM-412): der ZERSTÖRENDE Knopf eines Bestätigungsdialogs.
    //
    // Gemessen im echten Browser (nicht gelesen): vorher trug „Ja, löschen"/„Verwerfen und wechseln"
    // exakt dieselbe Farbe wie „Behalten"/„Hier bleiben" — rgb(104,112,120) bzw. rgb(27,30,33). Die
    // beiden Knöpfe waren allein am Text unterscheidbar. Genau das hat der Live-Test gesehen und
    // mein Klassennamen-Lesen übersehen.
    //
    // Bewusst dieselben Trust-Marken wie der bereits richtige Mobile-Knopf (bg-trust-crit-bg /
    // text-trust-crit-text) — keine neue Farbe, keine zweite Warn-Sprache.
    danger: "bg-trust-crit-bg text-trust-crit-text hover:opacity-90",
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
  // Pedi 04.07. (Fix Admin/Daten „r is not a function"): der Daten-Slot ist OPTIONAL. Ohne children
  // wirkt QueryState als reiner Lade-/Fehler-/Leer-Indikator (der Aufrufer zeichnet die Daten selbst,
  // z. B. der Papierkorb). Vorher rief QueryState bei vorhandenen Daten `children(data)` auf — mit
  // fehlendem children ein Absturz, sobald echte Daten (z. B. Einträge im Papierkorb) vorlagen.
  children?: (data: T) => ReactNode;
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
  return <>{children ? children(data as T) : null}</>;
}

export function Avatar({ initials }: { initials: string }): JSX.Element {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
      {initials}
    </span>
  );
}
