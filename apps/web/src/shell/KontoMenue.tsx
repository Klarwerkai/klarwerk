import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useSession } from "../app/AuthContext";
import { useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { DarstellungWahl } from "./Darstellung";
import { Meldungen, type MeldungenZustand, useMeldungenZustand } from "./Meldungen";
import { MenueFlaeche, MenueTrenner, MenueZeile, useMenue } from "./Menue";

// ================================================================================================
// JOB 3060 · H1 — DAS KONTO-MENÜ: Name und Rolle · Meldungen · Mobil · Darstellung · Profil ·
// Abmelden. Auslöser ist der Konto-Kreis (30 px, Initialen aus der bestätigten Sitzung, sonst
// leer); ein kleiner Punkt daran meldet ungelesene Meldungen (nur nach frischem Abruf, §9).
// ================================================================================================

/** „Peter Kohnert" → „PK", „Pia" → „PI" — aus der bestätigten Sitzung, sonst leer. */
function initialen(name: string | undefined): string {
  const worte = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (worte.length === 0) {
    return "";
  }
  if (worte.length === 1) {
    return (worte[0] ?? "").slice(0, 2).toUpperCase();
  }
  return `${worte[0]?.[0] ?? ""}${worte[worte.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/** Die Einträge des Konto-Menüs — im Menü und im Drawer dieselben. */
export function KontoEintraege({
  meldungen,
  onNavigiert,
}: {
  meldungen: MeldungenZustand;
  onNavigiert?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const { role } = useRole();
  const navigate = useGuardedNavigate();
  const location = useLocation();
  const name = user?.name ?? "—";
  return (
    <>
      <div className="px-2.5 pb-1.5 pt-1" data-testid="konto-kopf">
        <div className="truncate text-[13px] font-semibold text-text">{name}</div>
        <div className="truncate text-[11.5px] text-muted-2">{t(`role.name.${role}`)}</div>
      </div>
      <MenueTrenner />
      <Meldungen zustand={meldungen} />
      <MenueZeile
        onClick={() => {
          // WP-SAMMEL20-FIX (bens Fix 4, B1b): der Wechsel zu /mobile ist eine normale In-App-
          // Navigation — durch den NavGuard, mit der AKTUELLEN Route als Absprungpunkt.
          onNavigiert?.();
          navigate("/mobile", { state: { from: `${location.pathname}${location.search}` } });
        }}
        testid="konto-mobil"
      >
        {t("topbar.mobile")}
      </MenueZeile>
      <DarstellungWahl />
      <MenueZeile to="/profil" aktiv={location.pathname === "/profil"} testid="konto-profil">
        {t("nav.profile")}
      </MenueZeile>
      <MenueTrenner />
      <MenueZeile onClick={() => void signOut()} testid="konto-abmelden">
        {t("action.logout")}
      </MenueZeile>
    </>
  );
}

/** Der Konto-Kreis und seine aufklappende Fläche. */
export function KontoMenue(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const menue = useMenue();
  const { pathname } = useLocation();
  const { schliessen } = menue;
  // Der Meldungs-Zustand lebt HIER (immer montiert), nicht in der Liste (nur bei offenem Menü).
  const meldungen = useMeldungenZustand();
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur auf Pfadwechsel schließen.
  useEffect(() => {
    schliessen(false);
  }, [pathname, schliessen]);
  const kuerzel = initialen(user?.name);
  const ungelesen = meldungen.frisch ? meldungen.unreadCount : 0;
  const label =
    ungelesen > 0
      ? `${t("kopfband.konto")} · ${t("kopfband.ungelesen", { count: ungelesen })}`
      : t("kopfband.konto");
  // JOB 3085 · Q4 (Pedis Entscheidung 21, 05.09.2026) — DIE FARBE DES KREISES.
  // Er trägt den vollen Funke des Mockups (Main.dc.html Z.32, #E8630A) und deshalb NACHT-Initialen
  // (`text-ink`, #0E1626, 5,36:1) statt Weiß (3,38:1, unter AA). Der Kreis ist damit die eine
  // benannte Ausnahme zur mega41-Hausregel „texttragende Markenfläche → Funke dunkel" — er hebelt
  // sie nicht aus, er verlässt sie: ohne die weiße Textklasse greift ihr Selektor in
  // styles/modern.css an diesem Element gar nicht mehr. Kein Sonderweg, kein eigenes Token.
  // Gemessen: tests/kontokreis-funke/ (statisch) und tests/design/zielbild-h1-huelle.test.ts
  // (V16/V17, an der gebauten Seite in Chromium).
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        ref={menue.ausloeserRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menue.offen}
        aria-controls={menue.offen ? menue.flaecheId : undefined}
        onClick={menue.umschalten}
        data-testid="kopfband-konto"
        className="kw-konto-kreis relative grid h-[30px] w-[30px] place-items-center rounded-[50%] bg-brand text-[12px] font-bold leading-none text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {kuerzel}
        {ungelesen > 0 ? (
          <span
            aria-hidden="true"
            data-testid="konto-punkt"
            className="kw-konto-punkt absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink bg-trust-crit-fill"
          />
        ) : null}
      </button>
      <MenueFlaeche menue={menue} label={t("kopfband.konto")} testid="konto-menue">
        <KontoEintraege meldungen={meldungen} onNavigiert={() => schliessen(false)} />
      </MenueFlaeche>
    </div>
  );
}
