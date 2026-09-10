import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { GuardedLink } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import {
  FOOT_ITEMS,
  type NavItem,
  anzeigeNameKey,
  canSee,
  istAktiverEintrag,
  kopfbandItems,
  weitereBereicheItems,
} from "../app/navigation";
import { nachObergruppen } from "../app/navigationGliederung";
import { type NavBadge, navBadgeLabelKey, useNavBadges } from "../app/useNavBadges";
import { useOnline } from "./Meldungen";
import { MenueKopf, MenueZeile } from "./Menue";

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
//
// JOB 3113 H1b schließt die dritte Hälfte dieses Satzes: „frisch" heißt seit jetzt auch ZEITLICH
// frisch. `badge.stale` ist wahr, sobald ein Neuabruf gescheitert ist ODER die letzte Bestätigung
// die Frist erreicht hat (`app/useNavBadges.ts`, `lib/loadingState.ts`). Hier steht dafür KEINE
// eigene Rechnung — die Regel wohnt an einer Stelle, diese Datei liest nur ihr Ergebnis.

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

/** Die Kopfband-Punkte, die diese Rolle sieht — Bildreihenfolge des Mockups. */
function useSichtbareKopfbandPunkte(): NavItem[] {
  const { role, stufe2 } = useRole();
  return kopfbandItems().filter((i) => canSee(i, role, stufe2));
}

/**
 * Die Ziele der Liste „Bereiche", die diese Rolle sieht.
 *
 * JOB 3337: dazu gehören seit Pedis Auftrag vom 08.09. auch Profil und Hilfe — nicht als neue
 * Ziele, sondern als Kurzlinks unter der Obergruppe „Persönlich und Hilfe". Die Vorlage verlangt
 * genau diese vierte Gruppe und trennt sie ausdrücklich von der Firmenverwaltung; ihr
 * maßgeblicher Bedienort bleibt, wo er war (Konto-Menü bzw. die Zeile „Hilfe" darunter).
 *
 * Die Reihenfolge innerhalb einer Gruppe ist unverändert die des Auftrags JOB 3060
 * (`weitereBereicheItems`) — gruppiert wird, nicht umsortiert.
 */
function useSichtbareWeitereBereiche(): NavItem[] {
  const { role, stufe2 } = useRole();
  return [...weitereBereicheItems(), ...FOOT_ITEMS].filter((i) => canSee(i, role, stufe2));
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
 * EIN Punkt des Kopfbands — die Bauform, die breit und schmal dieselbe ist.
 *
 * JOB 3525: bis hierher stand dieses Stück Baum genau einmal, mitten in `KopfbandPunkte`. Da das
 * schmale Band jetzt eine ZWEITE Auswahl derselben Punkte zeigt, wäre die naheliegende Abkürzung
 * eine Kopie gewesen — und damit zwei Orte, an denen Aktivregel, Zähler und Fokusring auseinander
 * laufen können. Es ist stattdessen EIN Bauteil, das beide benutzen: das gerenderte `<a>` ist
 * zeichengleich dasselbe, breit wie schmal.
 */
function KopfbandPunkt({
  item,
  badges,
  online,
  pathname,
}: {
  item: NavItem;
  badges: Record<string, NavBadge>;
  online: boolean;
  pathname: string;
}): JSX.Element {
  const { t } = useTranslation();
  const aktiv = istAktiverEintrag(item, pathname);
  return (
    <GuardedLink
      to={item.path}
      aria-current={aktiv ? "page" : undefined}
      data-kopfband-punkt={item.id}
      className={`kw-kopfband-punkt flex items-center gap-1.5 border-b-2 px-0.5 py-1.5 text-[13.5px] leading-tight no-underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        aktiv ? "border-brand font-semibold text-white" : "border-transparent text-hairline"
      }`}
    >
      <span>{t(anzeigeNameKey(item))}</span>
      {zaehlerWert(
        item,
        badges,
        online,
        "kw-kopfband-zaehler rounded-[999px] bg-hairline px-1.5 py-px text-[10.5px] font-bold leading-normal text-ink",
      )}
    </GuardedLink>
  );
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
      {punkte.map((item) => (
        <KopfbandPunkt
          key={item.id}
          item={item}
          badges={badges}
          online={online}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

// ================================================================================================
// JOB 3525 · LIEFERUNG 2 — WELCHE PUNKTE AUF SCHMALER BREITE OBEN BLEIBEN.
// ================================================================================================
//
// Pedi hat am 10.09. um 09:05 zwei Dinge gesucht und nicht gefunden: „Meine Entwürfe" und
// „Gehe zu …". Genau diese zwei stehen auf dem oberen schmalen Band (760–899 px) weiter oben —
// „Gehe zu …" als Knopf in `Kopfband.tsx`, „Meine Entwürfe" hier.
//
// WARUM NUR EINER UND NICHT DREI: die Zeile hat auf 760 px nach Wortmarke, Menü-Knopf, „Gehe zu …",
// Zahnrad und Konto rund 120 px übrig. Ein zweiter Punkt („Bibliothek", „Erfassen") passte bei 760
// nicht mehr, ohne dass etwas schrumpft oder überläuft — und ein überlaufendes Kopfband wäre genau
// der Layoutbruch, den §5.3 des Auftrags verbietet. Lieber EIN Punkt, der sicher steht, als drei,
// die sich schieben; alles Übrige bleibt hinter dem jetzt BESCHRIFTETEN Menü-Knopf erreichbar.
//
// DIE LISTE IST EINE AUSWAHL, KEINE ZWEITE QUELLE: gefiltert wird auf `useSichtbareKopfbandPunkte`
// — dieselben Punkte, dieselben Rollen-Gates. Eine Id, die es im Kopfband nicht (mehr) gibt, fällt
// hier still weg statt einen leeren Platz zu erzeugen; `tests/navigation-schmal/…` rechnet nach,
// dass jede Id dieser Liste in `kopfbandItems()` wirklich vorkommt.
const SCHMAL_PUNKT_IDS: readonly string[] = ["entwuerfe"];

/**
 * Die Punkte, die auf dem oberen schmalen Band (760–899 px) im Kopfband stehen bleiben.
 *
 * `null`, wenn die Rolle keinen davon sehen darf — ein leeres `<nav aria-label="Hauptnavigation">`
 * wäre eine Ansage ohne Inhalt.
 */
export function KopfbandPunkteSchmal(): JSX.Element | null {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const badges = useNavBadges();
  const online = useOnline();
  const punkte = useSichtbareKopfbandPunkte().filter((item) => SCHMAL_PUNKT_IDS.includes(item.id));
  if (punkte.length === 0) {
    return null;
  }
  return (
    <nav
      aria-label={t("kopfband.navigation")}
      className="kw-kopfband-punkte flex shrink-0 items-center gap-[26px]"
    >
      {punkte.map((item) => (
        <KopfbandPunkt
          key={item.id}
          item={item}
          badges={badges}
          online={online}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

/**
 * Dieselben Punkte als Zeilenliste — für den Off-Canvas-Drawer.
 *
 * JOB 3503: sie kommen aus derselben Quelle wie oben (`useSichtbareKopfbandPunkte`), deshalb wandert
 * ein neuer Punkt hier ohne Zutun mit. Das ist die Zusage, auf die Pedis Befund vom 10.09. zählt
 * („auf schmaler Fensterbreite verschwinden die Kopfbandpunkte hinter einem stummen Symbol" — das
 * Symbol selbst ist JOB 3525; dass „Meine Entwürfe" dahinter WIRKLICH steht, misst
 * `tests/entwuerfe-menuepunkt/kopfband-und-uebersicht.test.tsx`, Fall I).
 *
 * JOB 3525: das Symbol ist seitdem KEIN stummes mehr — es trägt das Wort „Menü" (`Kopfband.tsx`).
 * Diese Liste bleibt der VOLLSTÄNDIGE Weg: auch was auf dem oberen schmalen Band oben stehen
 * bleibt, steht hier zusätzlich — ein Weg mehr, keiner weniger.
 */
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
          {t(anzeigeNameKey(item))}
        </MenueZeile>
      ))}
    </>
  );
}

/**
 * Die Zeilen des Untermenüs „Bereiche", mit ihren Zählern (dieselbe Regel wie oben).
 *
 * JOB 3337: die zwölf Zeilen standen bis hierher ohne jede Zwischenüberschrift untereinander —
 * Codex' Livebefund: „More areas mischt My Tasks, Conflicts, Duplicates, Topic map, External
 * knowledge, Risk & Gaps, Lifecycle, Analytics & Audit, Reports, Import & Sources, Knowledge Graph,
 * Capital Views." Jetzt tragen sie die vier Obergruppen der Vorlage, und für Berechtigte steht
 * „Verwaltung" dort ausdrücklich als Wort — nicht mehr nur ein Zahnrad.
 */
export function WeitereBereicheZeilen(): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const bereiche = useSichtbareWeitereBereiche();
  const badges = useNavBadges();
  const online = useOnline();
  return (
    <>
      {nachObergruppen(bereiche).map(({ gruppe, items }) => (
        <div key={gruppe.id} data-bereichsgruppe={gruppe.id}>
          <MenueKopf>{t(gruppe.titleKey)}</MenueKopf>
          {items.map((item) => (
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
              {t(anzeigeNameKey(item))}
            </MenueZeile>
          ))}
        </div>
      ))}
    </>
  );
}
