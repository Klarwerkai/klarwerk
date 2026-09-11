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
 * EIN Punkt des Kopfbands — die Bauform eines Punktes, an einer Stelle.
 *
 * JOB 3525 hat dieses Stück Baum aus `KopfbandPunkte` herausgelöst, weil das schmale Band damals
 * eine ZWEITE Auswahl derselben Punkte zeigte und eine Abschrift zwei Orte geschaffen hätte, an
 * denen Aktivregel, Zähler und Fokusring auseinanderlaufen.
 *
 * JOB 3605 hat jene zweite Auswahl wieder entfernt (Pedi, 11.09.2026: keine Sonderstellung, siehe
 * unten). Der Aufrufer ist seitdem wieder genau einer. Das Bauteil BLEIBT trotzdem benannt: es
 * trägt die vollständige Regel eines Punktes — Aktivregel, Zähler, Fokusring, `data-kopfband-punkt`
 * — und ein Name dafür ist lesbarer als derselbe Baum inline in einer `.map`. Es ist kein zweiter
 * Weg und kein Rest: es hat einen Aufrufer, und er ist der einzige.
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
// JOB 3605 · WARUM HIER KEINE ZWEITE, SCHMALE AUSWAHL MEHR STEHT.
// ================================================================================================
//
// BIS HIERHER stand an dieser Stelle `KopfbandPunkteSchmal` — eine Liste mit genau einer Id
// (`["entwuerfe"]`), die auf dem oberen schmalen Band (760–899 px) einen einzelnen Punkt oben
// stehen liess, während alle anderen hinter den Menü-Knopf wanderten. Sie ist fort, ersatzlos.
//
// PEDIS VORGABE (11.09.2026 Vormittag, über Codex, Nachricht 0bd3a41e, zum Bildschirmfoto
// „Screenshot 2026-09-11 at 09.16.52.png"): „Meine Entwürfe" stand dort allein neben dem Logo. Er
// verlangt, der Punkt sei „normaler Teil der gesamten Navigation, keine Sonderstellung / kein immer
// sichtbarer Sonderknopf"; der Zugang solle „wie die übrigen Punkte ins Menü wandern".
//
// DAS KEHRT KEINE FRÜHERE ENTSCHEIDUNG UM — es nimmt eine AUSLEGUNG zurück. Codex hat am 11.09. um
// 09:36 richtiggestellt: „Meine Entwürfe" war von Pedi von Anfang an als normaler Punkt wie
// „Bibliothek" verlangt. Die Sonderstellung entstand hier beim Bauen (JOB 3525) als gut gemeinte
// Antwort auf Pedis echten Befund vom 10.09. 09:05 — er hatte den Punkt gesucht und nicht gefunden.
// Die richtige Antwort auf jenen Befund ist das BESCHRIFTETE Menü, das derselbe Job gebaut hat
// (`Kopfband.tsx`, „Menü" statt stummem Hamburger), nicht ein bevorzugter Einzelpunkt daneben.
//
// DER ZUGANG GEHT DABEI NICHT VERLOREN, und das ist gemessen statt angenommen: `KopfbandPunkteListe`
// unten ist der VOLLSTÄNDIGE Weg — sie zeigt jeden Punkt, den die Rolle sehen darf.
// `tests/navigation-schmal/kein-sonderpunkt-schmal.test.tsx` zieht bei 760, 800 und 899 px das Menü
// wirklich auf, klickt „Meine Entwürfe" und prüft, dass die Adresse danach `/entwuerfe` ist.
//
// WAS BLEIBT: „Gehe zu …" steht auf diesem Band weiter oben (`Kopfband.tsx`). Das ist keine
// Sonderstellung im Sinne von Pedis Satz — es ist eine Funktion (dieselbe Palette wie ⌘K), kein
// Navigationspunkt; §3.3 des Auftrags lässt ihn ausdrücklich stehen.

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
 *
 * JOB 3605: seit Pedis Vorgabe vom 11.09.2026 ist diese Liste auf jeder schmalen Breite der EINZIGE
 * Weg in die Kopfbandnavigation — die zweite, schmale Auswahl oben ist fort (Begründung im Block
 * darüber). Aus „ein Weg mehr, keiner weniger" wird damit „ein Weg für alle": genau das, was Pedi
 * mit „normaler Teil der gesamten Navigation" verlangt hat. Gemessen bei 760, 800 und 899 px in
 * `tests/navigation-schmal/kein-sonderpunkt-schmal.test.tsx` (Fälle N2 und N3).
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
