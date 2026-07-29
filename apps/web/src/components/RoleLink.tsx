import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRole } from "../app/RoleContext";
import { routePathAllows } from "../app/navigation";

// ================================================================================================
// AUFTRAG-mega51 BLOCK A — EIN ZIEL, DAS DIE ROLLE NICHT ERREICHT, IST KEIN WEG.
// ================================================================================================
// DER BEFUND (Erstnutzerlauf 27.07., Rolle Experte): die Arbeitsliste der Startseite rendert ihre
// Zeilen als uneingeschränkte Links auf `/konflikte`, `/risiko`, `/lebenszyklus`, `/validierung` —
// alle vier `minRole: "controller"`. Die Expertin klickt und der Router wirft sie nach `/start`
// zurück. Dieselbe Sackgasse steckt im Wissenskreis (Schritt „Validieren") und in der
// Rollenführung darunter.
//
// DIE ENTSCHEIDUNG (A2): die Angabe VERSCHWINDET NICHT, sie hört auf, ein Weg zu sein.
//   · Die Zahl ist eine WAHRE Auskunft über den Bestand — mega39 hat das ausdrücklich so festge-
//     halten, als es dieselbe Frage für die Empfehlung entschied. Wer sie wegnimmt, macht die
//     Startseite durch Weglassen unehrlich: eine Expertin sähe „nichts zu tun", während vierzig
//     Konflikte offen sind. Auch der Wissenskreis verlöre seinen Schritt 2 und damit die Geschichte.
//   · Ein Weg, der keiner ist, wäre schlimmer als der Rückwurf. Deshalb ist die gesperrte Fassung
//     KEIN Link (kein href, kein Klick, kein Hover, kein Pfeil), sondern trägt sichtbar das Wort
//     „Kein Zugriff" plus die Begründung im title.
//
// Die Rollenfrage beantwortet `routePathAllows` — dieselbe Registry, aus der der Router sein Gate
// zieht (`GUARDED_ITEMS` in app/navigation.ts). Kein zweites Register, keine Kandidatenliste hier.
// Für ein Ziel ohne Gate (z. B. `/wissen/:id`) ist „erreichbar" die wahre Auskunft, nicht ein
// vorsichtiges Nein — der Router lässt dort jede Rolle durch.
//
// `children` ist bewusst eine Funktion von `erreichbar`: der Pfeil, der „hier geht es weiter"
// verspricht, gehört zur Aussage und muss an der gesperrten Fassung fehlen. So bleibt trotzdem
// EIN Tor — die Aufrufer entscheiden nur über ihren eigenen Inhalt, nie über die Rollenfrage.
export interface RoleLinkProps {
  to: string;
  /** Layout-Klassen, die für beide Fassungen gelten. */
  className: string;
  /** Nur für die begehbare Fassung — Hover/Gruppen-Effekte, die an einer Lage lügen würden. */
  hoverClassName?: string;
  /** Vorhandene Testanker bleiben erhalten (z. B. `open-gaps-summary`). */
  testId?: string;
  /** Nur für die begehbare Fassung — eine Lage hat nichts zu schließen oder zu öffnen. */
  onClick?: () => void;
  children: (erreichbar: boolean) => ReactNode;
}

export function RoleLink({
  to,
  className,
  hoverClassName,
  testId,
  onClick,
  children,
}: RoleLinkProps): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  if (routePathAllows(to, role)) {
    return (
      <Link
        to={to}
        data-testid={testId}
        onClick={onClick}
        className={`${className} ${hoverClassName ?? ""}`.trim()}
      >
        {children(true)}
      </Link>
    );
  }
  return (
    <div
      data-role-no-reach="true"
      data-testid={testId}
      aria-disabled="true"
      title={t("roleLink.noReachHint")}
      className={`${className} cursor-default opacity-70`}
    >
      {children(false)}
      <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2">
        {t("roleLink.noReach")}
      </span>
    </div>
  );
}
