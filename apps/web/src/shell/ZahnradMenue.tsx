import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useRole } from "../app/RoleContext";
import { ALL_ITEMS, einstellungenItem, istAktiverEintrag } from "../app/navigation";
import { LegalFooter, useRechtsseitenAn } from "../legal/LegalPages";
import { navHilfeFor } from "../lib/navHilfe";
import { APP_VERSION } from "../version";
import { WeitereBereicheZeilen } from "./KopfbandPunkte";
import {
  MenueAufklapp,
  MenueFlaeche,
  MenueKopf,
  MenueTrenner,
  MenueZeile,
  useMenue,
} from "./Menue";
import { RollenVorschau } from "./RollenVorschau";
import { type Seitenhilfe, useSeitenhilfe } from "./SeitenhilfeContext";
import { StatusZeilen } from "./StatusZeilen";
import { readIslandMarker } from "./islandMarker";

// ================================================================================================
// JOB 3060 · H1 — DAS ZAHNRAD-MENÜ (Pages-Art): alles, was nicht ins Sichtfeld gehört.
// ================================================================================================
//
// Einträge (Auftrag, Lieferung 1 und 5a): Einstellungen (→ /admin, nur admin) · Status (KI-Modus,
// Reasoner, Extern — nur admin, Ziel /admin) · Ansicht als Rolle / Erweiterte Module (Admin-
// Sitzung; Endort /admin Konten liegt bei JOB 3065, s. RollenVorschau.tsx) · Seitenhilfe „?"
// (die HelpTip-Texte und der Nav-Erklärsatz der aktuellen Seite) · Weitere Bereiche (alle
// Gruppenpunkte ohne Kopfband-Platz, mit Zählern) · Schnellnavigation ⌘K · Hilfe (→ /hilfe) ·
// Rechtliches (LegalFooter) · Fuß: Version und Insel-Marker.
//
// Die Einträge sind eine EIGENE Komponente (`ZahnradEintraege`), damit der Off-Canvas-Drawer
// dieselbe Liste zeigt — ein Bau, zwei Orte.

/** Der Nav-Erklärsatz der aktuellen Seite (JOB 3028: aus dem Hilfekapitel, oder nichts). */
function useNavErklaerung(): Seitenhilfe | null {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const item = ALL_ITEMS.find((i) => istAktiverEintrag(i, pathname));
  const hilfe = item ? navHilfeFor(item.path) : null;
  if (!hilfe) {
    return null;
  }
  return { id: "nav", title: t(hilfe.titleKey), body: t(hilfe.bodyKey) };
}

/** Die Seitenhilfe: Nav-Erklärsatz zuerst, dann jeder HelpTip der Seite in Anmeldereihenfolge. */
function SeitenhilfeListe(): JSX.Element {
  const { t } = useTranslation();
  const tipps = useSeitenhilfe();
  const nav = useNavErklaerung();
  const alle = nav ? [nav, ...tipps] : [...tipps];
  if (alle.length === 0) {
    return <p className="px-2.5 py-1.5 text-[12.5px] text-muted">{t("menue.seitenhilfe.leer")}</p>;
  }
  return (
    <ul
      className="max-h-[50vh] space-y-1.5 overflow-y-auto px-2.5 py-1"
      data-testid="seitenhilfe-liste"
    >
      {alle.map((e) => (
        <li key={e.id} className="text-[12.5px] leading-relaxed">
          <div className="font-semibold text-text">{e.title}</div>
          <p className="text-muted">{e.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Die Einträge des Zahnrad-Menüs — im Menü und im Drawer dieselben. */
export function ZahnradEintraege({ onNavigiert }: { onNavigiert?: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  const { pathname } = useLocation();
  const rechtsseiten = useRechtsseitenAn();
  const [seitenhilfeOffen, setSeitenhilfeOffen] = useState(false);
  const [bereicheOffen, setBereicheOffen] = useState(false);
  const [rechtlichesOffen, setRechtlichesOffen] = useState(false);
  const [islandMarker] = useState(() => readIslandMarker());
  const einstellungen = einstellungenItem();
  const admin = role === "admin";

  const schnellnavigation = (): void => {
    onNavigiert?.();
    window.dispatchEvent(new Event("open-command-palette"));
  };

  return (
    <>
      {admin ? (
        <>
          <MenueZeile
            to={einstellungen.path}
            aktiv={istAktiverEintrag(einstellungen, pathname)}
            testid="zahnrad-einstellungen"
          >
            {t("menue.einstellungen")}
          </MenueZeile>
          <StatusZeilen />
          <MenueTrenner />
        </>
      ) : null}
      <RollenVorschau />
      <MenueAufklapp
        label={t("menue.seitenhilfe")}
        wert="?"
        offen={seitenhilfeOffen}
        onToggle={() => setSeitenhilfeOffen((v) => !v)}
        testid="zahnrad-seitenhilfe"
      >
        <SeitenhilfeListe />
      </MenueAufklapp>
      <MenueAufklapp
        label={t("menue.weitereBereiche")}
        offen={bereicheOffen}
        onToggle={() => setBereicheOffen((v) => !v)}
        testid="zahnrad-weitere-bereiche"
      >
        <WeitereBereicheZeilen />
      </MenueAufklapp>
      <MenueZeile onClick={schnellnavigation} wert="⌘K" testid="zahnrad-schnellnavigation">
        {t("menue.schnellnavigation")}
      </MenueZeile>
      <MenueTrenner />
      <MenueZeile to="/hilfe" aktiv={pathname === "/hilfe"} testid="zahnrad-hilfe">
        {t("nav.help")}
      </MenueZeile>
      {rechtsseiten ? (
        <MenueAufklapp
          label={t("legal.footer.title")}
          offen={rechtlichesOffen}
          onToggle={() => setRechtlichesOffen((v) => !v)}
          testid="zahnrad-rechtliches"
        >
          <div className="px-2.5">
            <LegalFooter />
          </div>
        </MenueAufklapp>
      ) : null}
      <MenueTrenner />
      <MenueKopf>
        <span className="flex items-center gap-2">
          <span className="font-mono normal-case tracking-normal" title="App-Version (Beta-Phase)">
            v{APP_VERSION}
          </span>
          {islandMarker ? (
            <span
              id="klarwerk-island-marker"
              className="min-w-0 truncate font-mono normal-case tracking-normal"
              title={islandMarker}
            >
              {islandMarker}
            </span>
          ) : null}
        </span>
      </MenueKopf>
    </>
  );
}

/** Der Auslöser (Zahnrad, 18 px) und seine aufklappende Fläche. */
export function ZahnradMenue(): JSX.Element {
  const { t } = useTranslation();
  const menue = useMenue();
  const { pathname } = useLocation();
  const { schliessen } = menue;
  // Jeder Routenwechsel schließt das Menü — kein hängendes Overlay über der neuen Seite.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur auf Pfadwechsel schließen.
  useEffect(() => {
    schliessen(false);
  }, [pathname, schliessen]);
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        ref={menue.ausloeserRef}
        aria-label={t("kopfband.menue")}
        aria-haspopup="menu"
        aria-expanded={menue.offen}
        aria-controls={menue.offen ? menue.flaecheId : undefined}
        onClick={menue.umschalten}
        data-testid="kopfband-zahnrad"
        className="kw-kopfband-zahnrad grid h-8 w-8 place-items-center rounded-btn text-hairline outline-none hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <MenueFlaeche menue={menue} label={t("kopfband.menue")} testid="zahnrad-menue">
        <ZahnradEintraege onNavigiert={() => schliessen(false)} />
      </MenueFlaeche>
    </div>
  );
}
