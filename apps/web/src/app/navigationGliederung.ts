// ================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — DIE VIER OBERGRUPPEN, UND ZWAR AN EINER STELLE.
// ================================================================================================
//
// Pedi 08.09.: „Die Direktfunktion ist unvollständig und schwer zu erkennen. Die Gliederung ist
// schlecht … für die Demo die Gliederung um."
//
// Der Livebefund von Codex (1.0.0-beta.1.198, `ADMIN-NAVIGATION-AUFTRAG.md`) nennt die Ursache
// genau: „More areas mischt My Tasks, Conflicts, Duplicates, Topic map, External knowledge, Risk &
// Gaps, Lifecycle, Analytics & Audit, Reports, Import & Sources, Knowledge Graph, Capital Views" —
// zwölf Ziele aus drei Welten in EINER Liste, und die Schnellnavigation daneben „21 Einträge ohne
// Zwischenüberschriften".
//
// DIESE DATEI IST DIE GLIEDERUNG, NICHT EINE ZWEITE ROUTENTABELLE. `app/navigation.ts` bleibt die
// eine Quelle der Routen, Rollen und Stufe-2-Gates (`NAV_GROUPS`, `ALL_ITEMS`, `canSee`); hier steht
// nur, in WELCHER Obergruppe ein vorhandenes Ziel dem Menschen gezeigt wird. Deshalb kommt hier
// kein Ziel hinzu und keines weg — `tests/admin-navigation/inventar.test.tsx` rechnet das nach.
//
// WARUM NICHT DIE VORHANDENEN `NAV_GROUPS`: die tragen die Rollen-/Stufe-2-Gates des Routers
// (`arbeitsbereich · qualitaet · steuerung · erweitert`) und sind an drei Stellen gepinnt
// (`tests/app/h1-navigation-orte.test.ts`, `tests/bedienbarkeit/u3-*`). Ihre Aufteilung ist eine
// TECHNISCHE (wer darf), die hier ist eine FACHLICHE (wo sucht man es). Beide zu vermengen hieße,
// beim nächsten Rechte-Schnitt die Menüs umzubauen.
import {
  ADMIN_DETAILS,
  ADMIN_SECTIONS,
  type AdminSectionId,
  adminHref,
} from "../lib/adminSections";
import { ANALYTICS_AUDIT_PATH } from "../lib/analyticsSections";
import {
  ALL_ITEMS,
  type NavItem,
  ROLES,
  type Role,
  anzeigeNameKey,
  canSee,
  suchNamenKeys,
} from "./navigation";

export type ObergruppeId = "arbeiten" | "qualitaet" | "verwaltung" | "persoenlich";

export interface Obergruppe {
  id: ObergruppeId;
  titleKey: string;
}

/** Die vier Obergruppen der Vorlage, in ihrer Reihenfolge (Tabelle „Gewünschte Nutzerstruktur"). */
export const OBERGRUPPEN: readonly Obergruppe[] = [
  { id: "arbeiten", titleKey: "gliederung.arbeiten" },
  { id: "qualitaet", titleKey: "gliederung.qualitaet" },
  { id: "verwaltung", titleKey: "gliederung.verwaltung" },
  { id: "persoenlich", titleKey: "gliederung.persoenlich" },
];

/**
 * Jedes der 21 Navigationsziele in genau einer Obergruppe — abgeschrieben aus der Tabelle der
 * Vorlage, nicht erfunden (JOB 3503 hat „Meine Entwürfe" ergänzt; es arbeitet, wo erfasst wird):
 *   Arbeiten   Start, Fragen, Bibliothek, Erfassen, Meine Entwürfe, Meine Aufgaben, Themenkarte,
 *              Externes Wissen
 *   Qualität   Prüfen, Konflikte, Doppelungen, Risiken und Wissenslücken, Lebenszyklus
 *   Verwaltung alle Admin-Ziele (Einstellungen, Analytics & Audit, Auswertungen, Import,
 *              Wissensgraph, Kapital-Sichten) samt der sieben Themen darunter
 *   Persönlich Profil, Hilfe — ausdrücklich getrennt von der Firmenverwaltung
 */
const OBERGRUPPE_JE_ZIEL: Record<string, ObergruppeId> = {
  start: "arbeiten",
  aufgaben: "arbeiten",
  erfassen: "arbeiten",
  // JOB 3503: „Meine Entwürfe" ist ein Kopfband-Punkt und steht damit NICHT unter „Weitere
  // Bereiche" — diese Tabelle braucht ihn trotzdem, denn `direktzugangZiele` fragt sie für JEDES
  // Navigationsziel (`ALL_ITEMS`) und `obergruppeVon` wirft bei einer Lücke. Ohne diesen Eintrag
  // stürzte die Schnellnavigation ab, sobald eine Rolle den neuen Punkt sieht. Mit ihm ist der
  // Bereich zusätzlich über „Gehe zu …" auffindbar — unter „Arbeiten", wo er hingehört.
  entwuerfe: "arbeiten",
  fragen: "arbeiten",
  bibliothek: "arbeiten",
  wissensnetz: "arbeiten",
  extern: "arbeiten",
  validierung: "qualitaet",
  konflikte: "qualitaet",
  duplikate: "qualitaet",
  risiko: "qualitaet",
  lebenszyklus: "qualitaet",
  analytics: "verwaltung",
  admin: "verwaltung",
  output: "verwaltung",
  import: "verwaltung",
  graph: "verwaltung",
  kapital: "verwaltung",
  hilfe: "persoenlich",
  profil: "persoenlich",
};

/**
 * Die Obergruppe eines Navigationsziels.
 *
 * Ein Ziel OHNE Zuordnung wäre ein Ziel ohne Ort im Menü — es fiele still aus dem Bild, genau die
 * Klasse Fehler, gegen die `tests/app/h1-navigation-orte.test.ts` seit JOB 3060 steht. Deshalb
 * wirft diese Funktion, statt still auf eine Auffanggruppe auszuweichen.
 */
export function obergruppeVon(item: NavItem): ObergruppeId {
  const gruppe = OBERGRUPPE_JE_ZIEL[item.id];
  if (gruppe === undefined) {
    throw new Error(`Navigationsziel „${item.id}" hat keine Obergruppe (navigationGliederung.ts).`);
  }
  return gruppe;
}

/** Die übergebenen Ziele nach Obergruppen sortiert — leere Gruppen fallen weg. */
export function nachObergruppen(
  items: readonly NavItem[],
): { gruppe: Obergruppe; items: NavItem[] }[] {
  return OBERGRUPPEN.map((gruppe) => ({
    gruppe,
    items: items.filter((i) => obergruppeVon(i) === gruppe.id),
  })).filter((g) => g.items.length > 0);
}

// ================================================================================================
// DIE ERLAUBTEN NAVIGATIONSWERTE — Vorlage Punkt 4: „Keine beliebigen Komponenten aus Querytext."
// ================================================================================================
//
// `/admin?bereich=…&detail=…` ist ab jetzt der adressierbare Zustand der Verwaltung. Damit wird der
// Querytext zur Eingabe eines Renderers — und ein Renderer, der aus freiem Text eine Komponente
// wählt, ist genau die Bauform, die man nicht will. Deshalb entscheidet NICHT der Switch in
// `pages/Admin.tsx` über den Wert, sondern diese Liste: was hier nicht durchkommt, wird gar nicht
// erst Zustand, und die Seite zeigt die Übersicht ihres Themas.
//
// Die beiden dynamischen Kennungen brauchen eine eigene Regel, weil ihr Rest aus dem Bestand kommt:
//   · `rolle:<rolle>` — der Rest MUSS eine bekannte Rolle sein (`ROLES` aus navigation.ts).
//   · `nutzer:<id>`   — der Rest ist eine Kennung des Servers; erlaubt sind Buchstaben, Ziffern,
//                       Bindestrich und Unterstrich, höchstens 64 Zeichen. Ob es diesen Nutzer
//                       WIRKLICH gibt, entscheidet nicht die Adresszeile, sondern die Karte selbst
//                       (`NutzerDetail` liest `/api/users`) — hier wird nur die Form geprüft.
const NUTZER_KENNUNG = /^[A-Za-z0-9_-]{1,64}$/;

export function isAdminDetailId(value: string): boolean {
  if (value.startsWith("rolle:")) {
    return (ROLES as readonly string[]).includes(value.slice("rolle:".length));
  }
  if (value.startsWith("nutzer:")) {
    return NUTZER_KENNUNG.test(value.slice("nutzer:".length));
  }
  return ADMIN_DETAILS.some((d) => d.id === value);
}

// ================================================================================================
// DER DIREKTZUGANG „GEHE ZU …" — dieselbe Gliederung, und die Admin-Details als echte Ziele.
// ================================================================================================
//
// Codex' Livebefund: „Admin-Unterziele wie KI-Zugänge, Demodaten und Papierkorb fehlen tatsächlich
// als direkte Einträge dieser Liste." Sie fehlten, weil die Liste aus `ALL_ITEMS` entstand und
// `ALL_ITEMS` nur ROUTEN kennt. Die Verwaltung hat aber keine 17 Routen, sondern eine Route mit 17
// Zuständen — und für den Menschen ist „Papierkorb" ein Ziel, kein Zustand.

/** Ein Ziel des Direktzugangs: sichtbarer Name, sein Ort in der Gliederung, sein Weg. */
export interface Direktziel {
  id: string;
  gruppe: ObergruppeId;
  label: string;
  /** Alle Namen, unter denen dieses Ziel gefunden werden soll (sichtbarer Name + Synonyme). */
  suchtexte: readonly string[];
  /** Wohin der Klick führt — eine Route, ein Anker oder ein geprüfter Verwaltungswert. */
  path: string;
  /**
   * DER ZIELKONTEXT — die Hauptorientierung neben dem Namen (Vorlage, Punkt 2).
   *
   * Er sagt in Worten, WO das Ziel wohnt: „Qualität" für einen Bereich der App, „Verwaltung ›
   * Vorführdaten" für eine Karte der Verwaltung. Eine Route sagt das einem Kunden ohne Fachwissen
   * nicht — Codex' Livebefund nannte die alte Liste deshalb „flache Liste, technische Pfade".
   *
   * Er steht auch dann noch da, wenn die Gruppenüberschrift weggescrollt oder weggefiltert ist,
   * und er ist das, was ein Vorlesewerkzeug nach dem Namen ausgibt.
   */
  kontext: string;
  /**
   * Die Route — eine KLEINE Zusatzangabe, nicht die Orientierung.
   *
   * Nur Ziele mit eigener Route tragen sie; ein Verwaltungsziel wohnt in einem Queryparameter von
   * `/admin`, und den als „Adresse" hinzuschreiben wäre Lärm statt Auskunft. Wer die Routen kennt,
   * behält damit seinen Wiedererkennungswert aus FE-FND-03, ohne dass er jemandem im Weg steht.
   */
  route?: string;
}

/** Nur der Namensnachschlag — die Palette reicht ihr `t` herein, damit hier kein Text wohnt. */
export type Uebersetzer = (key: string) => string;

/** Der Textschlüssel einer Obergruppe. Wirft, statt still einen leeren Kontext zu erzeugen. */
function obergruppeTitleKey(id: ObergruppeId): string {
  const gruppe = OBERGRUPPEN.find((g) => g.id === id);
  if (!gruppe) {
    throw new Error(`Obergruppe „${id}" fehlt in OBERGRUPPEN (navigationGliederung.ts).`);
  }
  return gruppe.titleKey;
}

function verwaltungsPfad(t: Uebersetzer, section: AdminSectionId): string {
  const thema = ADMIN_SECTIONS.find((s) => s.id === section);
  const oben = t("gliederung.verwaltung");
  return thema ? `${oben} › ${t(thema.labelKey)}` : oben;
}

/**
 * Der lesbare Pfad über einer Detailansicht: „Verwaltung › Vorführdaten › Demodaten".
 *
 * Dieselbe Quelle wie die Zeile im Direktzugang und wie die Beschriftung auf der Fläche — wer den
 * Weg gegangen ist, liest oben genau die Wörter wieder, die ihn hergeführt haben.
 */
export function verwaltungsPfadTeile(
  t: Uebersetzer,
  section: AdminSectionId,
  detail?: string | null,
): string[] {
  const thema = ADMIN_SECTIONS.find((s) => s.id === section);
  const teile = [t("gliederung.verwaltung"), thema ? t(thema.labelKey) : ""].filter(
    (s) => s.length > 0,
  );
  if (detail === undefined || detail === null) {
    return teile;
  }
  const ziel = ADMIN_DETAILS.find((d) => d.id === detail);
  if (ziel) {
    return [...teile, t(ziel.labelKey)];
  }
  if (detail.startsWith("rolle:")) {
    return [...teile, t(`role.name.${detail.slice("rolle:".length)}`)];
  }
  // Ein Nutzerdetail trägt einen personenbezogenen Namen; den kennt diese Datei nicht und erfindet
  // sie nicht. Der Pfad endet deshalb beim Thema — die Karte selbst nennt die Person.
  return teile;
}

/**
 * Alle Ziele des Direktzugangs für diese Rolle und diesen Stufe-2-Zustand.
 *
 * MEHR NAMEN, NICHT MEHR RECHTE (JOB 3105 UX-08, `palette-rolle-bleibt-geschuetzt.test.tsx`): die
 * Verwaltungsziele hängen ausnahmslos daran, dass `canSee` das Ziel `/admin` durchlässt. Fällt der
 * Admin weg, fällt die ganze Gruppe weg — hier steht keine zweite Rechteregel.
 */
export function direktzugangZiele(t: Uebersetzer, role: Role, stufe2: boolean): Direktziel[] {
  const sichtbar = ALL_ITEMS.filter((i) => canSee(i, role, stufe2));
  const ziele: Direktziel[] = sichtbar.map((i) => {
    const gruppe = obergruppeVon(i);
    return {
      id: `nav:${i.id}`,
      gruppe,
      label: t(anzeigeNameKey(i)),
      // JOB 3337 R2: „Verwaltung"/„Administration" ist für /admin ein SUCHNAME, nicht nur eine
      // Überschrift. Der angezeigte Name bleibt „Einstellungen" (JOB 3105 UX-08: ein Bereich, ein
      // Name über Kopfband, Zahnrad, Seite und Direktzugang) — aber wer „Verwaltung" tippt, weil er
      // die Gruppenüberschrift gelesen hat, landet jetzt dort, wo er hinwill.
      suchtexte:
        i.id === "admin"
          ? [...suchNamenKeys(i).map((key) => t(key)), t("gliederung.verwaltung")]
          : suchNamenKeys(i).map((key) => t(key)),
      path: i.path,
      kontext: t(obergruppeTitleKey(gruppe)),
      route: i.path,
    };
  });

  // SCRUM-229: Audit ist in Analytics konsolidiert — als Deep-Link auffindbar machen, sichtbar nur,
  // wenn Analytics für die Rolle sichtbar ist. Unverändert aus `CommandPalette.tsx` übernommen.
  const analyticsItem = ALL_ITEMS.find((i) => i.id === "analytics");
  if (analyticsItem && canSee(analyticsItem, role, stufe2)) {
    ziele.push({
      id: "deep:audit",
      gruppe: "verwaltung",
      label: t("cmd.audit"),
      suchtexte: [t("cmd.audit")],
      path: ANALYTICS_AUDIT_PATH,
      kontext: verwaltungsPfad(t, "berichte"),
      route: ANALYTICS_AUDIT_PATH,
    });
  }

  const adminItem = ALL_ITEMS.find((i) => i.id === "admin");
  if (adminItem && canSee(adminItem, role, stufe2)) {
    for (const thema of ADMIN_SECTIONS) {
      ziele.push({
        id: `sec:${thema.id}`,
        gruppe: "verwaltung",
        label: t(thema.labelKey),
        suchtexte: [t(thema.labelKey)],
        path: adminHref(thema.id),
        kontext: t("gliederung.verwaltung"),
      });
      for (const ziel of ADMIN_DETAILS.filter((d) => d.section === thema.id)) {
        ziele.push({
          id: `det:${ziel.id}`,
          gruppe: "verwaltung",
          label: t(ziel.labelKey),
          suchtexte: [t(ziel.labelKey), ...(ziel.synonymKeys ?? []).map((k) => t(k))],
          path: adminHref(ziel.section, ziel.id),
          kontext: verwaltungsPfad(t, ziel.section),
        });
      }
    }
  }
  return ziele;
}

/**
 * Die Treffer zu einer Eingabe — und WARUM ein voller Name exklusiv ist.
 *
 * Bis JOB 3337 galt reines Enthaltensein. Das trägt für Teileingaben („Modelle" findet
 * „KI-Anbieter und Modelle") und bricht bei deutschen Zusammensetzungen: „Einstellungen" fand ab
 * dem Tag, an dem die Verwaltungsziele dazukamen, auch „Werkseinstellungen" — und wer den vollen,
 * gelesenen Namen eines Ziels tippt, bekam sein Ziel nicht mehr allein.
 *
 * Die Regel ist deshalb zweistufig und in beiden Stufen ehrlich: tippt jemand den GANZEN Namen
 * eines Ziels, ist genau dieses Ziel gemeint; sonst gilt weiter jeder Teiltreffer. Eine leere
 * Eingabe hat keinen genauen Treffer und zeigt darum wie bisher die ganze Liste.
 */
export function trefferFuer(ziele: readonly Direktziel[], eingabe: string): Direktziel[] {
  const suche = eingabe.trim().toLowerCase();
  const teiltreffer = ziele.filter((z) =>
    z.suchtexte.some((text) => text.toLowerCase().includes(suche)),
  );
  if (suche === "") {
    return teiltreffer;
  }
  const genau = teiltreffer.filter((z) => z.suchtexte.some((text) => text.toLowerCase() === suche));
  return genau.length > 0 ? genau : teiltreffer;
}

/** Die Treffer, nach Obergruppen geordnet — leere Gruppen fallen weg. */
export function trefferNachGruppen(
  treffer: readonly Direktziel[],
): { gruppe: Obergruppe; ziele: Direktziel[] }[] {
  return OBERGRUPPEN.map((gruppe) => ({
    gruppe,
    ziele: treffer.filter((z) => z.gruppe === gruppe.id),
  })).filter((g) => g.ziele.length > 0);
}
