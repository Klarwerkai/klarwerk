// WP-UX-WOW-1 U9 (Kopfs Befund): /import & Co. leiteten bei ausgeschalteter Stufe 2 STILL auf
// /start um — der Nutzer wusste nie, warum. Statt der Umleitung erklärt diese freundliche Karte
// die Lage: das Modul gehört zu den Erweiterten Funktionen (Stufe 2). Admins schalten Stufe 2
// direkt hier ein (der BESTEHENDE Toggle aus der Sidebar — kein neuer Zustand); alle anderen
// bekommen den ehrlichen Hinweis, dass das eine Admin-Einstellung ist, plus den Weg zurück.
import { ArrowLeft, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRole } from "../app/RoleContext";
import { HOME_ROUTE } from "../app/navigation";
import { Button, Card } from "./ui";

export function Stage2Notice(): JSX.Element {
  const { t } = useTranslation();
  const { role, setStufe2 } = useRole();
  return (
    <div className="mx-auto max-w-xl">
      <Card className="mt-6 text-center">
        <Layers size={28} className="mx-auto text-muted-2" aria-hidden />
        <h2 className="mt-3 text-[16px] font-semibold text-ink">{t("stage2.gate.title")}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
          {t("stage2.gate.body")}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {role === "admin" ? (
            <Button variant="primary" onClick={() => setStufe2(true)}>
              {t("stage2.gate.enable")}
            </Button>
          ) : (
            <p className="w-full text-[12.5px] text-muted-2">{t("stage2.gate.adminOnly")}</p>
          )}
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
