// ================================================================================================
// KLARA-VORSCHAU · DER DOKUMENTIERTE EINSTIEG `/klara-vorschau` — und der fiktive Artikel.
// ================================================================================================
//
// Diese Seite schaltet die Vorschau für die Browser-Sitzung ein (`components/klara-vorschau/aktiv.ts`)
// und gibt Klara etwas zum Zeigen: eine kurze Anleitung und zwei FIKTIVE Artikel. Kein Abruf, kein
// Wissensobjekt — die Artikel sind Konstanten (`components/klara-vorschau/artikel.ts`).
//
// Die Absätze tragen `data-klara-absatz`, der Artikel `data-klara-artikel`: daran erkennt Klara die
// Herkunft einer Markierung und den Absatz, an dem sie parkt. Übernimmt jemand einen
// Umformulierungsvorschlag, zeigt der Absatz den neuen Text und sagt das dazu.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { RoleLink } from "../components/RoleLink";
import { setzeKlaraVorschauAktiv } from "../components/klara-vorschau/aktiv";
import {
  DEMO_ARTIKEL,
  VORSCHAU_PFAD,
  artikelPfad,
  demoArtikel,
} from "../components/klara-vorschau/artikel";
import { artikelSchluessel, useKlaraZustand } from "../components/klara-vorschau/zustand";

const LINK =
  "inline-flex h-9 items-center rounded-btn border border-hairline bg-surface px-3 text-[13px] font-semibold text-text hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function Kennzeichen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid="klara-vorschau-kennzeichen"
      className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-trust-warn-text"
    >
      {t("klaravorschau.vorschauseite.kennzeichen")}
    </span>
  );
}

function WeiterLinks(): JSX.Element {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("klaravorschau.vorschauseite.weiter")} className="mt-6">
      <p className="text-[12px] font-semibold text-muted-2">
        {t("klaravorschau.vorschauseite.weiter")}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Link to={VORSCHAU_PFAD} data-testid="klara-vorschau-zur-uebersicht" className={LINK}>
          {t("klaravorschau.vorschauseite.zurUebersicht")}
        </Link>
        {/* Die Erfassung verlangt eine Rolle — dasselbe Tor wie überall (RoleLink). */}
        <RoleLink to="/erfassen" testId="klara-vorschau-zur-erfassung" className={LINK}>
          {() => t("klaravorschau.vorschauseite.zuErfassung")}
        </RoleLink>
        <Link to="/fragen" data-testid="klara-vorschau-zu-fragen" className={LINK}>
          {t("klaravorschau.vorschauseite.zuFragen")}
        </Link>
      </div>
    </nav>
  );
}

function Artikel({ id }: { id: string }): JSX.Element {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { artikelText } = useKlaraZustand();
  const artikel = demoArtikel(id);

  // Rücklink aus einem Entwurf: `#absatz-n` holt den Absatz ins Bild.
  useEffect(() => {
    if (!hash) {
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "center" });
    }
  }, [hash]);

  if (!artikel) {
    return (
      <div className="pt-6">
        <p className="text-[14px] text-text">{t("klaravorschau.vorschauseite.unbekannt")}</p>
        <WeiterLinks />
      </div>
    );
  }
  return (
    <article
      data-testid="klara-vorschau-artikel"
      data-klara-artikel={artikel.id}
      className="mx-auto max-w-3xl pt-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Kennzeichen />
        <span className="text-[12px] text-muted-2">{artikel.bereich}</span>
      </div>
      <h1 data-testid="klara-artikel-titel" className="mt-2 text-[26px] font-semibold text-ink">
        {artikel.titel}
      </h1>
      <p className="mt-1 text-[12px] text-muted-2">
        {t("klaravorschau.vorschauseite.sprachhinweis")}
      </p>
      <div className="mt-5 space-y-4">
        {artikel.absaetze.map((a) => {
          const geaendert = artikelText[artikelSchluessel(artikel.id, a.nr)];
          return (
            <div key={a.nr} className="relative">
              <p
                id={`absatz-${a.nr}`}
                data-klara-absatz={a.nr}
                data-testid="klara-artikel-absatz"
                className="text-[15px] leading-relaxed text-text"
              >
                {geaendert ?? a.text}
              </p>
              {geaendert ? (
                <span
                  data-testid="klara-absatz-geaendert"
                  className="mt-1 inline-block rounded-pill bg-ai-surface-1 px-2 py-0.5 text-[10.5px] font-semibold text-ai"
                >
                  {t("klaravorschau.vorschauseite.geaendert")}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-[12.5px] text-muted">{t("klaravorschau.vorschauseite.gesten")}</p>
      <WeiterLinks />
    </article>
  );
}

function Uebersicht(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl pt-6">
      <Kennzeichen />
      <h1 className="mt-2 text-[26px] font-semibold text-ink">
        {t("klaravorschau.vorschauseite.titel")}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-text">
        {t("klaravorschau.vorschauseite.intro")}
      </p>
      <h2 className="mt-5 text-[15px] font-semibold text-ink">
        {t("klaravorschau.vorschauseite.soGehts")}
      </h2>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-text">
        <li>{t("klaravorschau.vorschauseite.schritt1")}</li>
        <li>{t("klaravorschau.vorschauseite.schritt2")}</li>
        <li>{t("klaravorschau.vorschauseite.schritt3")}</li>
        <li>{t("klaravorschau.vorschauseite.schritt4")}</li>
      </ol>
      <h2 className="mt-6 text-[15px] font-semibold text-ink">
        {t("klaravorschau.vorschauseite.artikel")}
      </h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {DEMO_ARTIKEL.map((a) => (
          <li
            key={a.id}
            data-testid="klara-vorschau-artikelkarte"
            className="rounded-card border border-hairline bg-surface p-4 shadow-tile"
          >
            <p className="text-[11.5px] text-muted-2">{a.bereich}</p>
            <p className="mt-1 text-[15px] font-semibold text-ink">{a.titel}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{a.kurz}</p>
            <Link
              to={artikelPfad(a.id)}
              data-testid={`klara-vorschau-oeffnen-${a.id}`}
              className={`${LINK} mt-3`}
            >
              {t("klaravorschau.vorschauseite.oeffnen")}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[12.5px] text-muted">{t("klaravorschau.vorschauseite.gesten")}</p>
      <WeiterLinks />
    </div>
  );
}

export function KlaraVorschauSeite(): JSX.Element {
  const { id } = useParams();
  // Wer den Einstieg öffnet, schaltet die Vorschau für diese Sitzung ein.
  useEffect(() => {
    setzeKlaraVorschauAktiv(true);
  }, []);
  return <div data-testid="page-klara-vorschau">{id ? <Artikel id={id} /> : <Uebersicht />}</div>;
}
