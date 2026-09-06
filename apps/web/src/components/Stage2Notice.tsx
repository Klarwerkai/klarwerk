// WP-UX-WOW-1 U9 (Kopfs Befund): /import & Co. leiteten bei ausgeschalteter Stufe 2 STILL auf
// /start um — der Nutzer wusste nie, warum. Statt der Umleitung erklärt eine freundliche Karte
// die Lage: das Modul gehört zu den Erweiterten Funktionen (Stufe 2). Admins schalten Stufe 2
// direkt hier ein (der BESTEHENDE Toggle aus der Sidebar — kein neuer Zustand); alle anderen
// bekommen den ehrlichen Hinweis, dass das eine Admin-Einstellung ist, plus den Weg zurück.
//
// AUFTRAG-mega70 BLOCK A (bens Befund, sammel66-vortest): der ROLLENFALL blieb bis dahin die
// stille Umleitung — die Entscheidung gegen stille Umleitungen war nur für Stufe 2 umgesetzt.
// Jetzt teilen sich beide Fälle EINEN Kartenrahmen (GateFrame): `RoleNotice` sagt, welcher Rolle
// der Bereich gehört, und bietet den Weg zurück — bewusst OHNE Einschalt-Knopf, denn eine Rolle
// vergibt der Administrator, nicht die Nutzerin. Keine zweite Fläche, die dasselbe sagt und
// getrennt gepflegt werden müsste.
import { ArrowLeft, Layers, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRole } from "../app/RoleContext";
import { HOME_ROUTE, type NavItem } from "../app/navigation";
// JOB 3124 UX-12: DASSELBE Bauteil, das im Zahnrad hängt — nicht eine zweite Kopie des Textes.
// Der Aufruf `setRole("admin")` bleibt dort; hier wird nur gerendert (s. Kopf von RollenVorschau).
import { VorschauHinweis } from "../shell/RollenVorschau";
import { Button, Card } from "./ui";

// Der gemeinsame Rahmen beider Tor-Karten: Symbol, Titel, Erklärung, optionale Handlung und
// IMMER der Weg zurück (dieselbe Beschriftung für beide Fälle — eine Zeichenfolge, eine Wahrheit).
function GateFrame({
  icon: Icon,
  title,
  body,
  hinweis,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Ein Kasten zwischen Erklärung und Handlungen (JOB 3124: der Vorschauhinweis). */
  hinweis?: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl">
      <Card className="mt-6 text-center">
        <Icon size={28} className="mx-auto text-muted-2" aria-hidden />
        <h2 className="mt-3 text-[16px] font-semibold text-ink">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">{body}</p>
        {hinweis}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          <Link
            to={HOME_ROUTE}
            className="inline-flex items-center gap-1.5 rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
          >
            <ArrowLeft size={15} />
            {t("stage2.gate.back")}
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function Stage2Notice(): JSX.Element {
  const { t } = useTranslation();
  const { role, setStufe2 } = useRole();
  return (
    <GateFrame
      icon={Layers}
      title={t("stage2.gate.title")}
      body={t("stage2.gate.body")}
      action={
        role === "admin" ? (
          <Button variant="primary" onClick={() => setStufe2(true)}>
            {t("stage2.gate.enable")}
          </Button>
        ) : (
          <p className="w-full text-[12.5px] text-muted-2">{t("stage2.gate.adminOnly")}</p>
        )
      }
    />
  );
}

// Der Rollenfall: erklärt in Alltagssprache, welche Rolle der Bereich braucht (aus der EINEN
// Registry, `item.minRole`) und welche Rolle gerade angemeldet ist. Keine Handlung außer dem Weg
// zurück — es gibt hier nichts, das die Nutzerin selbst einschalten könnte.
//
// JOB 3124 UX-12: EINE Ausnahme, und sie nimmt niemandem etwas. Läuft eine Admin-VORSCHAU, ist die
// Sperre selbst gewollt und jederzeit zurücknehmbar — dann steht hier zusätzlich der Satz „du
// bleibst Admin" und derselbe Rückweg wie im Zahnrad (`VorschauHinweis`). Das ist KEINE
// Rollenwahl: es gibt genau einen Knopf, der in die EIGENE Rolle zurückführt, nie ein Rollenraster
// (das wohnt in den Einstellungen, gehütet von `tests/app/h6-bedienort-register.test.ts` R3/R5).
//
// Ohne laufende Vorschau — echte Nicht-Admin-Sitzung, ladende Sitzung, gescheiterte Sitzungsabfrage
// — gibt `VorschauHinweis` null zurück und die Karte sieht aus wie zuvor. Die Rollen-Erklärung
// darunter wird in keinem Fall abgeschwächt.
export function RoleNotice({ item }: { item: NavItem }): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  return (
    <GateFrame
      icon={Lock}
      title={t("role.gate.title")}
      body={t("role.gate.body", {
        owner: t(`role.name.${item.minRole}`),
        own: t(`role.name.${role}`),
      })}
      hinweis={<VorschauHinweis flaeche="sperrkarte" />}
    />
  );
}
