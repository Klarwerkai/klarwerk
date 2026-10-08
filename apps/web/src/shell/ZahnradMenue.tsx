import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useRole } from "../app/RoleContext";
import { ALL_ITEMS, anzeigeNameKey, einstellungenItem, istAktiverEintrag } from "../app/navigation";
import { LegalFooter, useRechtsseitenAn } from "../legal/LegalPages";
import { navHilfeFor } from "../lib/navHilfe";
import { APP_VERSION } from "../version";
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
// Reasoner, Extern — nur admin, Ziel /admin) · Persönliche Einstellungen (→ /profil, FE-002) ·
// Ansicht als Rolle / Erweiterte Module (Admin-Sitzung; Endort /admin Konten liegt bei JOB 3065,
// s. RollenVorschau.tsx) · Seitenhilfe „?" (die HelpTip-Texte und der Nav-Erklärsatz der aktuellen
// Seite) · Hilfe (→ /hilfe) · Rechtliches (LegalFooter) · Fuß: Version und Insel-Marker.
//
// FE-002 (Pedi, 26.09.2026): „Das Zahnrad erhält eine klar erkennbare Funktion für Einstellungen."
// Bis hierher standen hier ZUSÄTZLICH „Bereiche" (die weiteren Arbeitsseiten) und „Gehe zu …" —
// wer „Meine Aufgaben" suchte, musste wissen, dass ein Einstellungssymbol zu Arbeitsseiten führt.
// Beide sind umgezogen, nicht entfallen: die Übersicht unter das beschriftete „Arbeitsbereiche"
// (`ArbeitsbereicheMenue.tsx`, mit „Seite finden … ⌘K" als letzter Zeile), der Schnellzugriff
// zusätzlich als „Seite finden ⌘K" ins Kopfband. Das Zahnrad heißt jetzt „Einstellungen und
// Hilfe" — genau das, was darin steht. Für JEDE Rolle steht darin eine Einstellung
// („Persönliche Einstellungen" → /profil, dieselbe Seite wie „Profil" im Kontomenü), damit der
// Name auch für Nicht-Admins stimmt; kein neues Ziel, keine neue Berechtigung.
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
export function ZahnradEintraege(): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  const { pathname } = useLocation();
  const rechtsseiten = useRechtsseitenAn();
  const [seitenhilfeOffen, setSeitenhilfeOffen] = useState(false);
  const [rechtlichesOffen, setRechtlichesOffen] = useState(false);
  const [islandMarker] = useState(() => readIslandMarker());
  const einstellungen = einstellungenItem();
  const admin = role === "admin";

  return (
    <>
      {admin ? (
        <>
          {/* JOB 3337 (Pedi 08.09.): „für berechtigte Nutzer ist Verwaltung / Administration
              ausdrücklich erkennbar." Bis hierher stand über der Zeile nichts — wer „Verwaltung"
              suchte, musste wissen, dass sie „Einstellungen" heißt und hinter einem Zahnrad liegt.
              Der NAME der Zeile bleibt „Einstellungen": er ist seit JOB 3105 UX-08 mit Seitentitel
              und Direktzugang zeichengleich, und drei Flächen umzubenennen war hier nicht der
              Auftrag. Die Überschrift sagt jetzt das Fach, die Zeile das Ziel. */}
          <MenueKopf>{t("gliederung.verwaltung")}</MenueKopf>
          <MenueZeile
            to={einstellungen.path}
            aktiv={istAktiverEintrag(einstellungen, pathname)}
            testid="zahnrad-einstellungen"
          >
            {/* JOB 3105 · UX-08: der Name kommt aus derselben Quelle wie Kopfband und
                Schnellnavigation (`anzeigeNameKey`) — bis hierher stand hier eine dritte,
                verdrahtete Namensregel, die keine der beiden anderen kannte. */}
            {t(anzeigeNameKey(einstellungen))}
          </MenueZeile>
          <StatusZeilen />
          <MenueTrenner />
        </>
      ) : null}
      <MenueZeile to="/profil" aktiv={pathname === "/profil"} testid="zahnrad-persoenlich">
        {t("fe002.persoenlicheEinstellungen")}
      </MenueZeile>
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
          <span
            className="font-mono normal-case tracking-normal"
            title={t("beschriftung.zahnrad.version")}
          >
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
        // JOB 3337: „Kein alleinstehendes, unerklärtes Zahnrad." FE-002: der Name sagt jetzt, was
        // darin steht — Einstellungen und Hilfe —, statt des allgemeinen „Menü", das auf dem
        // schmalen Band zugleich der beschriftete Menü-Knopf ist. Der Zeigehinweis nennt ihn auch
        // der Maus.
        aria-label={t("fe002.einstellungen")}
        title={t("fe002.einstellungen")}
        aria-haspopup="menu"
        aria-expanded={menue.offen}
        aria-controls={menue.offen ? menue.flaecheId : undefined}
        onClick={menue.umschalten}
        data-testid="kopfband-zahnrad"
        className="kw-kopfband-zahnrad grid h-8 w-8 place-items-center rounded-btn text-hairline outline-none hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <MenueFlaeche menue={menue} label={t("fe002.einstellungen")} testid="zahnrad-menue">
        <ZahnradEintraege />
      </MenueFlaeche>
    </div>
  );
}
