// ================================================================================================
// R-0920 — DER WEG AUF DIE EIGENE ERGEBNISADRESSE EINES IMPORTLAUFS.
// ================================================================================================
//
// Die Adresse `/import/lauf/:importId` (`pages/ImportLauf.tsx`) zeigt das Ergebnis GENAU EINES
// Laufs. Sie ist teilbar, neu ladbar und mit dem Browser-Zurück verlassbar — was die Lauf-Kachel und
// die Bilanz auf `/import` nicht sein können, weil ihre Kennung nur im offenen Fenster lebt.
//
// WARUM `useInRouterContext`: die zwei Aufrufstellen (Lauf-Kachel in `pages/Stufe2.tsx`, Bilanz in
// `components/ImportGroups.tsx`) werden in vielen Bestandstests OHNE Router gemountet. Ein nackter
// `<Link>` würfe dort; ein nackter `<a>` lüde im Produkt die ganze App neu. Im Router ist es der
// Router-Link, außerhalb derselbe Pfad als gewöhnlicher Verweis — dieselbe Adresse in beiden Fällen.
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useInRouterContext } from "react-router-dom";

/** Die Ergebnisadresse eines Laufs. Die Kennung wird kodiert — sie ist ein Pfadsegment. */
export function importLaufPfad(importId: string): string {
  return `/import/lauf/${encodeURIComponent(importId)}`;
}

const KLASSE =
  "mt-2 inline-flex items-center gap-1 rounded-btn text-[12.5px] font-semibold text-brand-text underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function ImportLaufLink({ importId }: { importId: string }): JSX.Element {
  const { t } = useTranslation();
  const imRouter = useInRouterContext();
  const ziel = importLaufPfad(importId);
  const inhalt = (
    <>
      {t("imp.lauf.oeffnen")}
      <ArrowRight size={14} aria-hidden="true" />
    </>
  );
  return imRouter ? (
    <Link to={ziel} data-testid="imp-lauf-link" className={KLASSE}>
      {inhalt}
    </Link>
  ) : (
    <a href={ziel} data-testid="imp-lauf-link" className={KLASSE}>
      {inhalt}
    </a>
  );
}
