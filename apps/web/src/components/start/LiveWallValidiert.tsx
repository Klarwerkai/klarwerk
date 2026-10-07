import { useTranslation } from "react-i18next";
import { useLiveWallConsent, useSetLiveWallConsent } from "../../api/hooks";
import type { LiveWall } from "../../api/types";
import { RoleLink } from "../RoleLink";

// ================================================================================================
// PMO-FEA-0003 — NEUES VALIDIERTES WISSEN, PERSONEN NUR MIT ZUSTIMMUNG.
// ================================================================================================
//
// Die Liste kommt aus derselben Antwort wie der Rest der Wand (`/api/livewall`, Zweig
// `validated`); die Sichtrechte hat der Server schon an der Grundmenge angewandt. Einen Namen
// liefert der Server nur für Konten, deren jüngste Erklärung eine Zustimmung ist — die Oberfläche
// erfindet keinen nach (kein Rückgriff aufs Verzeichnis). Keine Punkte, keine Rangliste, kein Foto:
// das Produkt führt keine Profilbilder.
//
// Darunter die EIGENE Erklärung: freiwillig, voreingestellt aus, jederzeit widerrufbar.
export function LiveWallValidiert({ daten }: { daten: LiveWall }): JSX.Element {
  const { t, i18n } = useTranslation();
  const eintraege = daten.validated ?? [];
  return (
    <>
      <div data-testid="livewall-validiert">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {t("start.livewall.validated")}
        </div>
        {eintraege.length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("start.livewall.validatedEmpty")}</p>
        ) : (
          <ul className="space-y-1">
            {eintraege.map((v) => (
              <li key={v.koId} className="flex items-baseline gap-2">
                <RoleLink
                  to={`/wissen/${v.koId}`}
                  className="min-w-0 flex-1 truncate text-[13px] font-medium text-text"
                  hoverClassName="hover:text-ink"
                >
                  {() => v.title}
                </RoleLink>
                {v.name ? (
                  <span
                    data-testid="livewall-validiert-name"
                    className="shrink-0 text-[12px] text-muted"
                  >
                    {v.name}
                  </span>
                ) : null}
                <span className="shrink-0 font-mono text-[10.5px] text-muted-2">
                  {new Date(v.at).toLocaleString(
                    i18n.language.startsWith("en") ? "en-GB" : "de-DE",
                    { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <NamensZustimmung />
    </>
  );
}

function NamensZustimmung(): JSX.Element | null {
  const { t } = useTranslation();
  const stand = useLiveWallConsent();
  const setzen = useSetLiveWallConsent();
  // Ohne gelesenen Stand kein Schalter: ein Kästchen, das „aus" zeigt, weil nichts geladen ist,
  // wäre eine falsche Auskunft über die eigene Erklärung.
  if (!stand.data) {
    return null;
  }
  // Das Entwerten in `useSetLiveWallConsent` trifft Wand UND Erklärung (gemeinsamer Schlüssel
  // „livewall") — nach dem Umschalten sind beide neu gelesen, ein Widerruf wirkt sofort.
  const an = setzen.isPending
    ? (setzen.variables ?? stand.data.nameConsent)
    : stand.data.nameConsent;
  return (
    <label className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
      <input
        type="checkbox"
        data-testid="livewall-namenszustimmung"
        className="mt-0.5"
        checked={an}
        disabled={setzen.isPending}
        onChange={(e) => setzen.mutate(e.target.checked)}
      />
      <span>{t("start.livewall.nameConsent")}</span>
    </label>
  );
}
