import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { GuardedLink } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import {
  KOPFBAND_LABEL_KEY,
  type KopfbandId,
  type NavItem,
  canSee,
  istAktiverEintrag,
  kopfbandItems,
  weitereBereicheItems,
} from "../app/navigation";
import { type NavBadge, navBadgeLabelKey, useNavBadges } from "../app/useNavBadges";
import { useOnline } from "./Meldungen";
import { MenueZeile } from "./Menue";

// ================================================================================================
// JOB 3060 · H1 — DIE FÜNF PUNKTE DES KOPFBANDS UND DIE „WEITEREN BEREICHE".
// ================================================================================================
//
// Zwei Orte, EINE Quelle (app/navigation.ts): das Kopfband trägt Start · Fragen · Bibliothek ·
// Erfassen · Prüfen (Mockup Main.dc.html Z.20-24), das Zahnrad-Menü unter „Weitere Bereiche" alle
// übrigen Gruppenpunkte. Rollen-Gates und Stufe 2 gelten wie zuvor (`canSee`), die Aktivregel ist
// weiterhin `istAktiverEintrag` (JOB 562: die Wissensseite hält die Bibliothek aktiv).
//
// KEIN `title`, KEIN `aria-describedby` an den Punkten mehr (JOB 3028 U3 wird abgelöst): der
// Erklärsatz des Hilfekapitels steht jetzt in der Seitenhilfe des Zahnrad-Menüs, nicht am Punkt —
// Pedis Entscheidung 04.09.: Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld.
//
// DER ZÄHLER (§9 des Auftrags, Lieferung 6): eine Zahl steht NUR nach einem erfolgreichen, frischen
// Abruf und nur, wenn sie größer als null ist. Laden, Fehler, gescheiterter Neuabruf (veraltet),
// offline → KEIN Abzeichen: kein „!", kein Ladepunkt, keine alte Zahl. Der Punkt steht dann ohne
// Zahl. Das gilt für „Prüfen" im Kopfband und für die Zahlen in „Weitere Bereiche" gleichermaßen —
// eine Regel, zwei Orte.

/** Die Zahl, die ein Abzeichen zeigen darf — oder null (dann gibt es kein Abzeichen). */
function sichtbarerZaehler(badge: NavBadge | undefined, online: boolean): number | null {
  if (!badge || !online) {
    return null;
  }
  if (badge.state !== "loaded" || badge.stale || badge.count <= 0) {
    return null;
  }
  return badge.count;
}

/** Die Beschriftung eines Kopfband-Punkts (kürzer als der Seitentitel, s. navigation.ts). */
function kopfbandLabelKey(item: NavItem): string {
  return KOPFBAND_LABEL_KEY[item.id as KopfbandId] ?? item.labelKey;
}

/** Die Kopfband-Punkte, die diese Rolle sieht — Bildreihenfolge des Mockups. */
function useSichtbareKopfbandPunkte(): NavItem[] {
  const { role, stufe2 } = useRole();
  return kopfbandItems().filter((i) => canSee(i, role, stufe2));
}

/** Die „Weiteren Bereiche", die diese Rolle sieht — Menüreihenfolge des Auftrags. */
function useSichtbareWeitereBereiche(): NavItem[] {
  const { role, stufe2 } = useRole();
  return weitereBereicheItems().filter((i) => canSee(i, role, stufe2));
}

function Zaehler({
  item,
  zahl,
  klasse,
}: {
  item: NavItem;
  zahl: number;
  klasse: string;
}): JSX.Element {
  const { t } = useTranslation();
  const labelKey = item.badgeKey ? navBadgeLabelKey(item.badgeKey) : undefined;
  const label = labelKey ? t(labelKey, { count: zahl }) : undefined;
  // SCRUM-486 E: die Zahl trägt ihre Bedeutung (title + aria-label) — WAS gezählt wird.
  return (
    <span className={klasse} title={label} aria-label={label}>
      {zahl}
    </span>
  );
}

/** Das Abzeichen einer Zeile — oder `undefined`, dann rendert die Zeile KEINEN Wert (kein leerer Träger). */
function zaehlerWert(
  item: NavItem,
  badges: Record<string, NavBadge>,
  online: boolean,
  klasse: string,
): JSX.Element | undefined {
  if (!item.badgeKey) {
    return undefined;
  }
  const zahl = sichtbarerZaehler(badges[item.badgeKey], online);
  if (zahl === null) {
    return undefined;
  }
  return <Zaehler item={item} zahl={zahl} klasse={klasse} />;
}

/**
 * Die Punkte im Kopfband: `<a>` mit sichtbarem Text, aktiver Punkt `aria-current="page"` und
 * 2 px Unterstrich (modern.css), „Prüfen" mit dem Zähler der offenen Prüfungen.
 */
export function KopfbandPunkte(): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const punkte = useSichtbareKopfbandPunkte();
  const badges = useNavBadges();
  const online = useOnline();
  return (
    <nav
      aria-label={t("kopfband.navigation")}
      className="kw-kopfband-punkte flex items-center gap-[26px]"
    >
      {punkte.map((item) => {
        const aktiv = istAktiverEintrag(item, pathname);
        return (
          <GuardedLink
            key={item.id}
            to={item.path}
            aria-current={aktiv ? "page" : undefined}
            data-kopfband-punkt={item.id}
            className={`kw-kopfband-punkt flex items-center gap-1.5 border-b-2 px-0.5 py-1.5 text-[13.5px] leading-tight no-underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              aktiv ? "border-brand font-semibold text-white" : "border-transparent text-hairline"
            }`}
          >
            <span>{t(kopfbandLabelKey(item))}</span>
            {zaehlerWert(
              item,
              badges,
              online,
              "kw-kopfband-zaehler rounded-[999px] bg-hairline px-1.5 py-px text-[10.5px] font-bold leading-normal text-ink",
            )}
          </GuardedLink>
        );
      })}
    </nav>
  );
}

/** Dieselben fünf Punkte als Zeilenliste — für den Off-Canvas-Drawer. */
export function KopfbandPunkteListe(): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const punkte = useSichtbareKopfbandPunkte();
  const badges = useNavBadges();
  const online = useOnline();
  return (
    <>
      {punkte.map((item) => (
        <MenueZeile
          key={item.id}
          to={item.path}
          aktiv={istAktiverEintrag(item, pathname)}
          testid={`drawer-punkt-${item.id}`}
          wert={zaehlerWert(
            item,
            badges,
            online,
            "rounded-full bg-hairline px-1.5 py-px text-[10.5px] font-bold text-ink",
          )}
        >
          {t(kopfbandLabelKey(item))}
        </MenueZeile>
      ))}
    </>
  );
}

/** Die Zeilen des Untermenüs „Weitere Bereiche", mit ihren Zählern (dieselbe Regel wie oben). */
export function WeitereBereicheZeilen(): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const bereiche = useSichtbareWeitereBereiche();
  const badges = useNavBadges();
  const online = useOnline();
  return (
    <>
      {bereiche.map((item) => (
        <MenueZeile
          key={item.id}
          to={item.path}
          aktiv={istAktiverEintrag(item, pathname)}
          testid={`bereich-${item.id}`}
          wert={zaehlerWert(
            item,
            badges,
            online,
            item.badgeTone === "crit"
              ? "rounded-full bg-trust-crit-bg px-1.5 py-px text-[10.5px] font-bold text-trust-crit-text"
              : "rounded-full bg-hairline px-1.5 py-px text-[10.5px] font-bold text-ink",
          )}
        >
          {t(item.labelKey)}
        </MenueZeile>
      ))}
    </>
  );
}
