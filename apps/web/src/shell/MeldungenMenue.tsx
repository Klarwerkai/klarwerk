import type { TFunction } from "i18next";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { KontoMenue } from "./KontoMenue";
import { MeldungenListe, type MeldungenZustand, useMeldungenZustand } from "./Meldungen";
import { MenueFlaeche, MenueKopf, useMenue } from "./Menue";

// ================================================================================================
// FE-002 · MELDUNGEN HABEN WIEDER EINEN EIGENEN, BENANNTEN ZUGANG IM KOPFBAND.
// ================================================================================================
//
// Pedis Befund (26.09.2026): Meldungen lagen im Kontomenü hinter dem Profilkreis; vorher war nur
// ein kleiner Punkt am Kreis zu sehen. FE-002 verlangt einen Zugang, an dem man ungelesene
// Meldungen und den Weg zu ihnen erkennt, BEVOR man das Kontomenü öffnet — und an dem der Zustand
// „nichts Ungelesenes" ebenso verständlich bleibt. Die historische Designzeile H1 („die Glocke
// verschwindet", JOB 3060) ist damit durch Pedis aktuelle Anforderung abgelöst.
//
// KEINE NEUE LOGIK. Zustand, Lesestatus, Rücknahme bei Server-Nein und „Öffnen ist Kenntnisnahme"
// (Audit-P3) kommen unverändert aus `useMeldungenZustand` (Meldungen.tsx). Der Zustand wird in
// `MeldungenUndKonto` EINMAL gehalten und an diesen Zugang UND an das Kontomenü gereicht, damit
// beide dieselbe Zahl zeigen und eine optimistische Markierung nicht in zwei Kopien auseinanderläuft.
//
// DIE ZAHL folgt der Regel des Kopfbands (§9): sie steht nur nach einem frischen, erfolgreichen
// Abruf und nur, wenn sie größer als null ist. Laden, Fehler, veraltet, offline → keine Zahl, und
// der zugängliche Name sagt dann „wird geprüft" statt „keine ungelesenen" — eine unbekannte Zahl
// ist keine bestätigte Null.

/** Der zugängliche Name des Zugangs — er nennt immer auch den Zustand. */
function zugangsName(zustand: MeldungenZustand, t: TFunction): string {
  const name = t("fe002.meldungen");
  if (!zustand.frisch) {
    return `${name} · ${t("fe002.meldungenUnbestaetigt")}`;
  }
  if (zustand.unreadCount > 0) {
    return `${name} · ${t("fe002.meldungenUngelesen", { count: zustand.unreadCount })}`;
  }
  return `${name} · ${t("fe002.meldungenKeine")}`;
}

/** Der Meldungszugang: Glocke, Wort „Meldungen" (wo Platz ist), Zahl der ungelesenen Meldungen. */
export function MeldungenMenue({ zustand }: { zustand: MeldungenZustand }): JSX.Element {
  const { t } = useTranslation();
  const menue = useMenue();
  const { pathname } = useLocation();
  const { schliessen, offen } = menue;
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur auf Pfadwechsel schließen.
  useEffect(() => {
    schliessen(false);
  }, [pathname, schliessen]);
  const ungelesen = zustand.frisch ? zustand.unreadCount : 0;
  const name = zugangsName(zustand, t);
  // Öffnen ist Kenntnisnahme (unten) — danach ist nichts mehr ungelesen. Damit die geöffnete Liste
  // trotzdem sagt, WIE VIELE gerade neu waren, wird die Zahl im Moment des Öffnens festgehalten.
  const [neuBeimOeffnen, setNeuBeimOeffnen] = useState(0);
  const oeffnen = (): void => {
    // Audit-P3: das Öffnen der Liste ist Kenntnisnahme — derselbe Satz wie im Kontomenü.
    if (!offen) {
      setNeuBeimOeffnen(ungelesen);
      zustand.alleSichtbarenMarkieren();
    }
    menue.umschalten();
  };
  const kopf =
    neuBeimOeffnen > 0
      ? `${t("fe002.meldungen")} · ${t("fe002.meldungenNeu", { count: neuBeimOeffnen })}`
      : zustand.frisch
        ? t("fe002.meldungen")
        : `${t("fe002.meldungen")} · ${t("fe002.meldungenUnbestaetigt")}`;
  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        ref={menue.ausloeserRef}
        aria-label={name}
        title={name}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? menue.flaecheId : undefined}
        onClick={oeffnen}
        data-testid="kopfband-meldungen"
        data-ungelesen={ungelesen}
        data-frisch={zustand.frisch ? "ja" : "nein"}
        className="kw-kopfband-meldungen relative flex h-8 items-center gap-1.5 rounded-btn px-1.5 text-hairline outline-none hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {/* Die Zahl sitzt AUF der Glockenecke, nicht daneben: so kostet sie die Zeile keine Breite —
            gemessen bei 390 px mit Firmen-CI, wo eine Zahl neben der Glocke das Zahnrad 6 px über
            die Marke schob (tests/fe002-kopfband/kopfband-fe002-chromium.test.ts, C2). */}
        <span className="relative grid shrink-0 place-items-center">
          <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
          {ungelesen > 0 ? (
            <span
              aria-hidden="true"
              data-testid="meldungen-zahl"
              className="kw-kopfband-meldungen-zahl absolute -right-2 -top-2 min-w-[16px] rounded-[999px] bg-brand px-1 text-center text-[10px] font-bold leading-[16px] text-ink"
            >
              {ungelesen > 99 ? "99+" : ungelesen}
            </span>
          ) : null}
        </span>
        <span className="kw-kopfband-meldungen-wort whitespace-nowrap text-[13px] leading-none">
          {t("fe002.meldungen")}
        </span>
      </button>
      <MenueFlaeche menue={menue} label={t("fe002.meldungen")} testid="meldungen-menue">
        <MenueKopf>
          <span data-testid="meldungen-stand">{kopf}</span>
        </MenueKopf>
        <MeldungenListe zustand={zustand} onGeoeffnet={() => schliessen(false)} />
      </MenueFlaeche>
    </div>
  );
}

/**
 * Meldungszugang und Konto-Kreis mit ihrem EINEN gemeinsamen Meldungszustand. Der Zustand lebt
 * hier (immer montiert, klein) und nicht im Kopfband: eine neue Antwort zeichnet nur diese zwei
 * Griffe neu, nicht die ganze Leiste.
 */
export function MeldungenUndKonto(): JSX.Element {
  const meldungen = useMeldungenZustand();
  return (
    <>
      <MeldungenMenue zustand={meldungen} />
      <KontoMenue meldungen={meldungen} />
    </>
  );
}
