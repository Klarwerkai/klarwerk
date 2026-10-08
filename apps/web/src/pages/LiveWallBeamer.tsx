import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLiveWall } from "../api/hooks";
import { RoleLink } from "../components/RoleLink";
import { ValidiertListe } from "../components/start/LiveWallValidiert";
import { LIVEWALL_TAKT_MS, personenAktuell, useJetzt } from "../lib/livewallTakt";

// ================================================================================================
// R-0740 — DIE LIVE-WAND ALS BEAMER-ANSICHT (`/livewall`).
// ================================================================================================
//
// „… auch als Beamer-Ansicht denkbar." Dieselbe Wand wie auf der Startseite, für die Projektion
// gesetzt: große Schrift, keine Bedienelemente außer „Vollbild", laufende Aktualisierung auch ohne
// Fokus (`useLiveWall(true)`).
//
// KEINE ZWEITE WAHRHEIT: dieselbe Abfrage, dieselbe Antwort (`GET /api/livewall`). Die Sichtrechte
// sind die der angemeldeten Person, die die Projektion geöffnet hat — der Server filtert vor der
// Ausgabe. Wer projiziert, zeigt also nur, was er selbst sehen darf; ein öffentlicher Zugang ohne
// Anmeldung ist bewusst nicht gebaut. Name und Foto erscheinen nur mit Zustimmung, und ein
// Widerruf verschwindet spätestens mit dem nächsten Takt; reißt die Verbindung ab, blendet die
// Wand Personenangaben nach drei verpassten Takten aus (`personenAktuell`).
//
// Keine Punkte, keine Ranglisten: es gibt hier keine Zahl je Person, nur die Tageszahl „heute
// geholfen" über alle sichtbaren Einträge.
export function LiveWallBeamer(): JSX.Element {
  const { t, i18n } = useTranslation();
  const wand = useLiveWall(true);
  const flaeche = useRef<HTMLDivElement>(null);
  const daten = wand.data;
  // Die eigene Uhr prüft die Frische je Takt neu — auch wenn die Abfrage nichts Neues meldet.
  const jetzt = useJetzt(LIVEWALL_TAKT_MS);
  const personen = personenAktuell(wand.dataUpdatedAt, Math.max(jetzt, Date.now()));
  const zeit = (at: string): string =>
    new Date(at).toLocaleString(i18n.language.startsWith("en") ? "en-GB" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      ref={flaeche}
      data-testid="livewall-beamer"
      className="min-h-screen space-y-8 bg-page p-10 text-text"
    >
      <header className="flex items-start gap-6">
        <div className="flex-1">
          <h1 className="text-[44px] font-semibold text-ink">{t("start.livewall.title")}</h1>
          <p className="mt-1 text-[22px] text-muted">{t("start.livewall.subtitle")}</p>
        </div>
        {daten && daten.helpedToday > 0 ? (
          <span className="rounded-pill bg-trust-pos-bg px-4 py-2 font-mono text-[22px] font-semibold text-trust-pos-text">
            {t("start.livewall.helpedToday", { n: daten.helpedToday })}
          </span>
        ) : null}
        <button
          type="button"
          data-testid="livewall-beamer-vollbild"
          className="text-[16px] text-muted underline underline-offset-2"
          onClick={() => {
            void flaeche.current?.requestFullscreen?.().catch(() => undefined);
          }}
        >
          {t("start.livewall.beamerFullscreen")}
        </button>
      </header>

      {/* Eine Störung darf nicht wie Leere aussehen: ohne Stand steht „lädt" oder die Störung,
          nie „noch nichts erfasst". */}
      {!daten ? (
        <p data-testid="livewall-beamer-lage" className="text-[22px] text-muted">
          {wand.isError ? t("start.livewall.beamerError") : t("start.livewall.beamerLoading")}
        </p>
      ) : (
        <>
          {!personen ? (
            <output data-testid="livewall-beamer-veraltet" className="block text-[18px] text-muted">
              {t("start.livewall.beamerStale")}
            </output>
          ) : null}
          <section>
            <h2 className="mb-3 font-mono text-[16px] uppercase tracking-wider text-muted-2">
              {t("start.livewall.validated")}
            </h2>
            <ValidiertListe eintraege={daten.validated ?? []} personen={personen} gross />
          </section>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 font-mono text-[16px] uppercase tracking-wider text-muted-2">
                {t("start.livewall.saved")}
              </h2>
              {daten.saved.length === 0 ? (
                <p className="text-[22px] text-muted">{t("start.livewall.savedEmpty")}</p>
              ) : (
                <ul className="space-y-3">
                  {daten.saved.map((s) => (
                    <li key={s.koId} className="flex items-baseline gap-4">
                      <RoleLink
                        to={`/wissen/${s.koId}`}
                        className="min-w-0 flex-1 truncate text-[24px] font-medium text-text"
                        hoverClassName="hover:text-ink"
                      >
                        {() => s.title}
                      </RoleLink>
                      <span className="shrink-0 font-mono text-[18px] text-muted-2">
                        {zeit(s.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="mb-3 font-mono text-[16px] uppercase tracking-wider text-muted-2">
                {t("start.livewall.helped")}
              </h2>
              {daten.helped.length === 0 ? (
                <p className="text-[22px] text-muted">{t("start.livewall.helpedEmpty")}</p>
              ) : (
                <ul className="space-y-3">
                  {daten.helped.map((h) => (
                    <li key={`${h.koId}-${h.at}`} className="flex items-baseline gap-4">
                      <RoleLink
                        to={`/wissen/${h.koId}`}
                        className="min-w-0 flex-1 truncate text-[24px] font-medium text-text"
                        hoverClassName="hover:text-ink"
                      >
                        {() => h.title}
                      </RoleLink>
                      <span className="shrink-0 font-mono text-[18px] text-muted-2">
                        {zeit(h.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
