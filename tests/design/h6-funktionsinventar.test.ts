// ================================================================================================
// JOB 3065 H6 · DAS FUNKTIONSINVENTAR: nichts von gestern ist verloren.
// ================================================================================================
//
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren … arbeite mit
// Untermenüs … Wir haben sehr, sehr viele Informationsfunktionen."
//
// Die Tabelle unten ist das Inventar aus dem Auftrag (§5a) — GENAU EINE benannte Probe je Zeile,
// von 1 bis 28, keine zusammengefassten Ersatzposten und keine Mindestzahl. Für jeden Posten öffnet
// dieser Test in der GEBAUTEN Fläche (Chromium, echte App, echter Bestand, Admin angemeldet) den
// genannten Reiter, die genannte Zeile und — wo die Funktion dahinter liegt — auch noch den
// genannten Knopf IN der Karte; danach prüft er, dass das genannte Element wirklich da und SICHTBAR
// ist.
//
// JOB 3065 R2 — WAS BEN AN RUNDE 1 BEANSTANDET HAT, UND WAS SICH DADURCH GEÄNDERT HAT:
//   · „25 zusammengefasste Posten, abgesichert mit `>= 24`" → jetzt 28 Posten mit fester Zeile aus
//     §5a; die Kalibrierung verlangt die Menge {1…28} exakt, eine Lücke ist rot.
//   · „Beim Posten Einmalkennwörter werden nur die beiden Demodatenknöpfe geprüft; Seed und Liste
//     bleiben ungetestet" → Zeile 7 DRÜCKT jetzt „Demodaten laden" und verlangt die Liste
//     (`demo-einmalkennwoerter`) mit einer echten Zugangszeile.
//   · Freigeben (2), Reset-Wiederholung (4) und Löschbestätigung (5) öffnen jetzt bis zum Element:
//     der Prüfstand legt dafür einen ZWEITEN, nicht freigegebenen Nutzer über die echte Route an.
//
// Der Demodaten-Schalter (`KLARWERK_DEMO_SEED`) steht in dieser Messung ausdrücklich auf AN — sonst
// wäre der Lade-Knopf baulich abwesend (mega64) und die Zeilen 7/16 unprüfbar. Die Vorgabe des
// Produkts bleibt AUS; sie wird unten nur für die Dauer dieser Datei gesetzt und danach wieder
// hergestellt (die Umgebung gehört dem ganzen Prozess).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { SECURITY_POINTS } from "../../apps/web/src/lib/securityStatements";
import { PFAD_FN, type Stand, beende, fn, starte, wechsle } from "./h6-chromium";

/** Eine Erwartung an die geöffnete Karte: ein Selektor, ein sichtbarer Text — oder beides. */
interface Erwartung {
  selektor?: string;
  text?: string;
  /**
   * Mindestens EINER dieser Texte muss sichtbar sein. Für Listen, deren Inhalt vom Bestand abhängt:
   * die Audit-Liste zeigt entweder Einträge ODER ihre ehrliche Leeraussage — beides ist der Beleg,
   * dass die Liste da ist; „gar nichts" wäre der Verlust.
   */
  einesVon?: string[];
}

interface Posten {
  /** Die Zeile der Tabelle in §5a, die dieser Posten belegt. */
  zeile5a: number;
  id: string;
  /** Beschriftung des Reiters (entfällt auf /profil). */
  reiter?: string;
  /** Was geklickt wird, um den Posten zu öffnen. */
  klick: string;
  /** Die Karte, die dabei aufgehen muss (entfällt, wenn die Zeile selbst das Element trägt). */
  detail?: string;
  /** Ein WEITERER Klick INNERHALB der Karte (Knopftext), bevor geprüft wird. */
  innenKlick?: string;
  /** Selektor, auf den nach dem inneren Klick gewartet wird (bis 15 s). */
  warteAuf?: string;
  erwartet: Erwartung[];
  /** Zusätzlich das „?"-Menü öffnen und diesen Text darin verlangen. */
  hilfeText?: string;
}

const t = (k: string, o?: Record<string, unknown>): string => i18n.t(k, o ?? {});

/** Der zweite, NICHT freigegebene Nutzer des Prüfstands — er macht Zeile 2 überhaupt prüfbar. */
const WARTENDER = { name: "Wanda Wartend", email: "wanda@job3065.test" };
const ERSTE_NUTZERZEILE = '[data-einst="karte"] button[data-einst="zeile"]';
/** Die Zeile des wartenden Nutzers: die zweite Zeile der Nutzerkarte (nach dem Admin). */
const ZWEITE_NUTZERZEILE = '[data-einst="karte"] button[data-einst="zeile"]:nth-of-type(2)';

function inventarAdmin(): Posten[] {
  return [
    // ---- Konten (§5a 1–6, 8, 9) -----------------------------------------------------------------
    {
      zeile5a: 1,
      id: "Nutzerliste mit Name, E-Mail → Konten → Nutzerzeile → Detailkarte (E-Mail dort)",
      reiter: t("adm.sec.konten"),
      klick: ERSTE_NUTZERZEILE,
      detail: "detail-nutzer",
      erwartet: [{ text: "pedi@job3065.test" }],
    },
    {
      zeile5a: 2,
      id: "Freigeben → Konten → Zeile des wartenden Nutzers → Knopf Freigeben",
      reiter: t("adm.sec.konten"),
      klick: ZWEITE_NUTZERZEILE,
      detail: "detail-nutzer",
      erwartet: [{ text: WARTENDER.email }, { text: t("adm.approve") }],
    },
    {
      zeile5a: 3,
      id: "Rolle ändern (Auswahlliste) → Konten → Nutzer → Auswahl Rolle",
      reiter: t("adm.sec.konten"),
      klick: ERSTE_NUTZERZEILE,
      detail: "detail-nutzer",
      erwartet: [{ text: t("adm.role") }, { selektor: '[data-testid="detail-nutzer"] select' }],
    },
    {
      zeile5a: 4,
      id: "Passwort zurücksetzen mit Wiederholung → Konten → Nutzer → Knopf → zwei Felder",
      reiter: t("adm.sec.konten"),
      klick: ERSTE_NUTZERZEILE,
      detail: "detail-nutzer",
      innenKlick: t("adm.reset"),
      warteAuf: `[data-testid="detail-nutzer"] input[placeholder="${t("adm.newPasswordRepeat")}"]`,
      erwartet: [
        { selektor: `[data-testid="detail-nutzer"] input[placeholder="${t("adm.newPassword")}"]` },
        {
          selektor: `[data-testid="detail-nutzer"] input[placeholder="${t("adm.newPasswordRepeat")}"]`,
        },
        { text: t("adm.resetConfirm") },
        { text: t("adm.resetCancel") },
      ],
    },
    {
      zeile5a: 5,
      id: "Löschen mit Bestätigung → Konten → Nutzer → Knopf Löschen → Rückfrage",
      reiter: t("adm.sec.konten"),
      klick: ERSTE_NUTZERZEILE,
      detail: "detail-nutzer",
      innenKlick: t("adm.remove"),
      erwartet: [
        { text: t("adm.removeQ") },
        { text: t("adm.removeKeep") },
        { text: t("adm.removeYes") },
      ],
    },
    {
      zeile5a: 6,
      id: "Nutzer anlegen mit Rollenfeld → Konten → Knopf Nutzer hinzufügen → Detailkarte",
      reiter: t("adm.sec.konten"),
      klick: '[data-testid="knopf-nutzer-hinzufuegen"]',
      detail: "detail-nutzer-neu",
      erwartet: [
        { text: t("adm.name") },
        { text: t("adm.email") },
        { text: t("adm.password") },
        { text: t("adm.newPasswordRepeat") },
        { text: t("adm.role") },
        { selektor: '[data-testid="detail-nutzer-neu"] select' },
        { text: t("adm.create") },
      ],
      hilfeText: t("adm.createHint"),
    },
    {
      zeile5a: 8,
      id: "Ansicht als Rolle (vorher Sidebar) → Konten → Zeile → Auswahl",
      reiter: t("adm.sec.konten"),
      klick: '[data-testid="zeile-ansicht-rolle"]',
      detail: "detail-ansicht-rolle",
      erwartet: [
        { text: t("role.short.viewer") },
        { text: t("role.short.experte") },
        { text: t("role.short.controller") },
        { text: t("role.short.admin") },
      ],
    },
    {
      zeile5a: 9,
      id: "Erweiterte Module · Stufe 2 (vorher Sidebar) → Konten → Zeile → Schalter",
      reiter: t("adm.sec.konten"),
      klick: "",
      erwartet: [{ selektor: '[data-testid="zeile-stufe2"] input[type="checkbox"]' }],
    },
    // ---- KI (§5a 10–15) ---------------------------------------------------------------------------
    {
      zeile5a: 10,
      id: "KI-Verwaltung (Anbieter, Modus, Schlüsseltest, Zuordnung) → KI → Zeile KI",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki"]',
      detail: "detail-ki",
      erwartet: [
        { text: t("adm.ai.test") },
        { text: t("adm.ai.testLocal") },
        { text: t("adm.selfTest.button") },
        { text: t("adm.ai.global") },
        { selektor: '[data-testid="detail-ki"] select' },
        { text: t("adm.ai.save") },
        { text: t("adm.ai.detail") },
      ],
      hilfeText: t("adm.ai.help"),
    },
    {
      zeile5a: 11,
      id: "Verfügbare KIs → KI → Zeile → Detailkarte",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki-zugaenge"]',
      detail: "detail-ki-zugaenge",
      erwartet: [
        { text: t("adm.ai.access.cloud") },
        { text: t("adm.ai.access.fallback") },
        { text: t("adm.ai.access.local") },
      ],
      hilfeText: t("adm.ai.accessHelp"),
    },
    {
      zeile5a: 12,
      id: "Eigene KI-Funktionen (Name, Anweisung) → KI → Zeile → Hinzufügen → zwei Felder",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki-funktionen"]',
      detail: "detail-ki-funktionen",
      innenKlick: t("adm.presets.add"),
      warteAuf: `[data-testid="detail-ki-funktionen"] input[aria-label="${t("adm.presets.name")}"]`,
      erwartet: [
        {
          selektor: `[data-testid="detail-ki-funktionen"] input[aria-label="${t("adm.presets.name")}"]`,
        },
        {
          selektor: `[data-testid="detail-ki-funktionen"] input[aria-label="${t("adm.presets.instruction")}"]`,
        },
        { text: t("adm.presets.save") },
      ],
      hilfeText: t("adm.presets.help"),
    },
    {
      zeile5a: 13,
      id: "Prüfungen und Upload-Grenzen → KI → Zeile Prüfungen und Grenzen",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki-grenzen"]',
      detail: "detail-ki-grenzen",
      erwartet: [
        { selektor: `[data-testid="detail-ki-grenzen"] input[aria-label="${t("adm.val.label")}"]` },
        { text: t("adm.val.save") },
        {
          selektor: `[data-testid="detail-ki-grenzen"] input[aria-label="${t("adm.upload.maxAttachments")}"]`,
        },
        {
          selektor: `[data-testid="detail-ki-grenzen"] input[aria-label="${t("adm.upload.maxMb")}"]`,
        },
        { selektor: '[data-testid="upload-raw-limit"]' },
        { text: t("adm.upload.save") },
      ],
      hilfeText: t("adm.val.help"),
    },
    {
      zeile5a: 14,
      id: "Externe Wissensabfrage (4 Stufen) → KI → Zeile → Detailkarte",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki-extern"]',
      detail: "detail-ki-extern",
      erwartet: [
        { text: t("adm.ext.stage.blocked") },
        { text: t("adm.ext.stage.search_on_click") },
        { text: t("adm.ext.stage.search_attach") },
        { text: t("adm.ext.stage.open") },
        { text: t("adm.ext.save") },
      ],
      hilfeText: t("adm.ext.help"),
    },
    {
      zeile5a: 15,
      id: "Duplikat-Erkennung (Schwelle) → KI → Zeile → Detailkarte",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki-dup"]',
      detail: "detail-ki-dup",
      erwartet: [
        {
          selektor: `[data-testid="detail-ki-dup"] input[aria-label="${t("adm.dup.threshold")}"]`,
        },
        { text: t("adm.dup.save") },
      ],
      hilfeText: t("adm.dup.help"),
    },
    // ---- Daten (§5a 16–19) --------------------------------------------------------------------------
    {
      zeile5a: 16,
      id: "Demodaten laden / entfernen → Daten → Zeile → zwei Knöpfe",
      reiter: t("adm.sec.daten"),
      klick: '[data-testid="zeile-demodaten"]',
      detail: "detail-demodaten",
      erwartet: [{ text: t("adm.seedButton") }, { text: t("adm.purgeButton") }],
      hilfeText: t("adm.seedHint"),
    },
    {
      zeile5a: 17,
      id: "Werkseinstellungen → Daten → Zeile → Knopf mit Bestätigung",
      reiter: t("adm.sec.daten"),
      klick: '[data-testid="zeile-werkseinstellungen"]',
      detail: "detail-werkseinstellungen",
      // In dieser Instanz ist der Werksreset nicht verfügbar (kein Desktop-Betrieb) — dann MUSS die
      // Karte das ehrlich sagen. Verfügbar wäre es der Knopf; beides ist derselbe Posten.
      erwartet: [{ einesVon: [t("adm.factory.unavailable"), t("adm.factory.button")] }],
      hilfeText: t("adm.factory.help"),
    },
    {
      zeile5a: 18,
      id: "Papierkorb → Daten → Zeile (Wert = Anzahl) → Detailkarte → Liste",
      reiter: t("adm.sec.daten"),
      klick: '[data-testid="zeile-papierkorb"]',
      detail: "detail-papierkorb",
      erwartet: [{ text: t("adm.trash.empty") }],
      hilfeText: t("adm.trash.help"),
    },
    {
      zeile5a: 19,
      id: "Audit-Liste → Daten → Zeile → Detailkarte → Liste",
      reiter: t("adm.sec.daten"),
      klick: '[data-testid="zeile-audit"]',
      detail: "detail-audit",
      erwartet: [{ einesVon: ["auth.", "user.", t("adm.auditEmpty")] }],
    },
    // ---- Sicherheit (§5a 20–22) ----------------------------------------------------------------------
    {
      zeile5a: 20,
      id: "Prüfprotokoll hash-verkettet (+ Integritätsprüfung, Druck) → Sicherheit → Zeile",
      reiter: t("adm.sec.sicherheit"),
      klick: '[data-testid="zeile-pruefprotokoll"]',
      detail: "detail-pruefprotokoll",
      erwartet: [{ text: t("adm.sich.verify.button") }, { text: t("adm.print") }],
      hilfeText: t("adm.sich.auditHelp"),
    },
    {
      zeile5a: 21,
      id: "Datenschutz & Sicherheit → Sicherheit → Zeile → Detailkarte",
      reiter: t("adm.sec.sicherheit"),
      klick: '[data-testid="zeile-datenschutz"]',
      detail: "detail-datenschutz",
      erwartet: [
        { text: t(SECURITY_POINTS[0]?.titleKey ?? "") },
        { text: t("adm.sich.evidenceNote").slice(0, 30) },
        { text: t("adm.print") },
      ],
      hilfeText: t("adm.sich.dataHelp"),
    },
    {
      zeile5a: 22,
      id: "VIP-Bereitschaft mit Quellen und Druck (vorher fünfter Reiter) → Sicherheit → Zeile",
      reiter: t("adm.sec.sicherheit"),
      klick: '[data-testid="zeile-bereitschaft"]',
      detail: "detail-bereitschaft",
      erwartet: [
        { text: t("adm.ready.ki") },
        { text: t("adm.ready.validated") },
        { text: t("adm.ready.openReviews") },
        { text: t("adm.ready.upload") },
        { text: t("adm.ready.external") },
        { text: t("adm.ready.demo") },
        { text: t("adm.print") },
      ],
      hilfeText: t("adm.ready.intro"),
    },
    {
      zeile5a: 23,
      id: "Die verlegten Hilfetexte → „?“-Menü der jeweiligen Detailkarte (hier: KI-Verwaltung)",
      reiter: t("adm.sec.ki"),
      klick: '[data-testid="zeile-ki"]',
      detail: "detail-ki",
      erwartet: [{ selektor: '[data-testid="detail-ki"] [data-einst="hilfe"]' }],
      hilfeText: t("adm.ai.internExtern"),
    },
    // §5a 7 steht ABSICHTLICH am Ende: der Seed legt echten Demo-Bestand an und verändert damit die
    // Nutzerliste, an der die Posten 1–6 hängen.
    {
      zeile5a: 7,
      id: "Einmalkennwörter nach Seed → Daten → Demodaten → LADEN → Liste mit Zugängen",
      reiter: t("adm.sec.daten"),
      klick: '[data-testid="zeile-demodaten"]',
      detail: "detail-demodaten",
      innenKlick: t("adm.seedButton"),
      warteAuf: '[data-testid="demo-einmalkennwoerter"]',
      erwartet: [
        { selektor: '[data-testid="demo-einmalkennwoerter"]' },
        { text: t("adm.seedCredsTitle") },
        { text: t("adm.seedCredsHint") },
        // Eine echte Zugangszeile: die Demo-Konten tragen alle diese Kennung
        // (`services/app/src/seed-demo.ts:175` — `admin@demo.klarwerk` und Geschwister).
        { text: "@demo.klarwerk" },
      ],
    },
  ];
}

function inventarProfil(): Posten[] {
  return [
    {
      zeile5a: 24,
      id: "Profil: Name (Wert = Rolle)",
      klick: "",
      erwartet: [{ selektor: '[data-testid="zeile-name"]' }, { text: t("role.name.admin") }],
    },
    {
      zeile5a: 25,
      id: "Profil: Sprache → Zeile mit der Auswahl DE/EN/NL",
      // JOB 3065 R10: keine Detailkarte mehr. Die drei Knöpfe stehen als Bedienelement IN der Zeile
      // — das Funktionsinventar von JOB 3060 (`h1-funktionsinventar.test.ts`, Fall `P-sprache`)
      // misst sie in `main` ohne weiteren Klick; hinter einem Chevron fand es nichts.
      klick: "",
      // Die Knöpfe tragen das Kürzel klein; die Versalien macht CSS (`uppercase`).
      erwartet: [
        { selektor: '[data-testid="zeile-sprache"] [data-testid="sprach-knoepfe"]' },
        { text: "de" },
        { text: "en" },
        { text: "nl" },
      ],
    },
    {
      zeile5a: 26,
      id: "Profil: Passwort ändern → Zeile → Detailkarte",
      klick: '[data-testid="zeile-passwort"]',
      detail: "detail-passwort",
      erwartet: [
        { text: t("prof.oldPassword") },
        { text: t("prof.newPassword") },
        { text: t("prof.passwordSubmit") },
      ],
    },
    {
      zeile5a: 27,
      id: "Profil: Abmelden",
      klick: "",
      erwartet: [{ selektor: '[data-testid="zeile-abmelden"]' }, { text: t("action.logout") }],
    },
    {
      zeile5a: 28,
      id: "Profil: Wirkung (funke.impact) → Zeile → Detailkarte mit ihren vier Zahlen",
      klick: '[data-testid="zeile-wirkung"]',
      detail: "detail-wirkung",
      // JOB 3065 R3 (BENs Korrekturpflicht 3): Bis Runde 2 verlangte dieser Posten nur die leere
      // Kartenhülle — der ganze Inhalt der Wirkung konnte verschwinden, ohne dass er rot wurde.
      // Jetzt hängt er an den VIER Werten, die „Meine Wirkung" ausmacht (`MyImpactNumbers`:
      // Beiträge · davon validiert · zitiert · als hilfreich markiert) samt ihrer ehrlichen Fußnote.
      erwartet: [
        { selektor: '[data-testid="detail-wirkung"] [data-testid="my-impact"]' },
        { text: t("funke.impact.contributions") },
        { text: t("funke.impact.validated") },
        { text: t("funke.impact.cited") },
        { text: t("funke.impact.helpful") },
        { text: t("funke.impact.hint") },
      ],
    },
  ];
}

// ================================================================================================
// JOB 3065 H6 R9 · DER VORSCHAU-RUNDWEG UND DIE ZÄHLUNG DER BEDIENORTE (BEN R8, Korrekturpflicht 1)
// ================================================================================================
//
// BEN, Runde 8: „genau ein Rollen-Auswahlort und ein Stufe-2-Schalter, zusätzlich ein während der
// Vorschau erreichbarer Rückweg. Erwarteter Beleg: Chromium zählt beide Bedienorte jeweils einmal
// und durchläuft Viewer, Experte und Controller jeweils zurück nach `/admin` ohne Reload."
//
// WARUM DAS HIER STEHT UND NICHT IN EINER EIGENEN DATEI: `h6-chromium.ts` hält die Lehre fest, dass
// ein Volllauf mit FÜNF H6-Browser-Instanzen fremde Messungen mit „Target page, context or browser
// has been closed" umgeworfen hat. Es gibt bereits vier. Diese Fälle teilen sich deshalb die Seite,
// die dieses Inventar ohnehin offen hat — dieselbe App, derselbe Admin, kein sechster Browser.
//
// DIE VORAUSSETZUNG WIRD GEPRÜFT, NICHT ANGENOMMEN: Der Rückweg während der Vorschau ist das
// Zahnrad-Menü der Hülle aus JOB 3060 (`shell/RollenVorschau.tsx`, „Zur Admin-Ansicht"). Steht der
// Arbeitsbaum noch nicht auf main, gibt es kein Zahnrad — dann ist Fall B0 rot und NENNT den Grund,
// statt dass die folgenden Fälle in undurchsichtige Zeitüberschreitungen laufen.
//
// UND DIE ZÄHLUNG FINDET BEI OFFENEM MENÜ STATT: die Bedienelemente des Zahnrads stehen nur im DOM,
// solange es offen ist. Bei geschlossenem Menü fände eine Zählung die Einstellungen-Zeile und sonst
// nichts — sie wäre grün, obwohl es den zweiten Ort gibt, und würde die Doppelung VERSTECKEN.

/** Die Anker der Hülle aus JOB 3060 (gelesen in `apps/web/src/shell/`). */
const ZAHNRAD = '[data-testid="kopfband-zahnrad"]';
const ZAHNRAD_MENUE = '[data-testid="zahnrad-menue"]';
const ZAHNRAD_ANSICHT = '[data-testid="zahnrad-ansicht"]';
/** Die Admin-Zeile im Zahnrad — sie verschwindet in der Vorschau und kehrt mit dem Rückweg zurück. */
const ZAHNRAD_EINSTELLUNGEN = '[data-testid="zahnrad-einstellungen"]';

/** Gemeinsamer Vorspann in der Seite: Sichtbarkeit, Normalisierung, Warten, Zahnrad auf/zu. */
const VORSPANN = `
  const sichtbar = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const pfad = ${PFAD_FN};
  const warte = async (pruefung, ms = 6000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return pruefung();
  };
  const zahnradAuf = async () => {
    if (document.querySelector('${ZAHNRAD_MENUE}') !== null) return true;
    const z = document.querySelector('${ZAHNRAD}');
    if (!z) return false;
    z.click();
    return await warte(() => document.querySelector('${ZAHNRAD_MENUE}') !== null);
  };
  const zahnradZu = async () => {
    if (document.querySelector('${ZAHNRAD_MENUE}') === null) return true;
    document.querySelector('${ZAHNRAD}').click();
    return await warte(() => document.querySelector('${ZAHNRAD_MENUE}') === null);
  };
  // Die Posten davor lassen den zuletzt geöffneten Reiter stehen (der letzte ist „Sicherheit").
  // „Ansicht als Rolle" und „Erweiterte Module" wohnen unter KONTEN — ohne diesen Wechsel misst
  // man die Abwesenheit eines Reiters und nennt sie „Zeile fehlt".
  const reiterWaehlen = async (name) => {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => norm(b.textContent) === name);
    if (!r) return false;
    r.click();
    return await warte(() => r.getAttribute('aria-pressed') === 'true');
  };
`;

/**
 * B0: steht die Hülle aus JOB 3060 überhaupt? Ohne sie ist alles Weitere nicht messbar.
 *
 * `ansichtsgruppe` wird hier als ABWESEND erwartet: ohne laufende Vorschau hat die Gruppe im
 * Zahnrad nichts zu zeigen (das Raster ist in die Einstellungen umgezogen, es bleibt nur der
 * Rückweg — und von nichts kann man nicht zurückkehren). Dass sie in der Vorschau ERSCHEINT, misst
 * B1; erst beide Richtungen zusammen sind eine Aussage.
 */
const HUELLE_DA = `(async () => {
  ${VORSPANN}
  const kopfband = document.querySelector('header[data-testid="kopfband"]');
  const zahnrad = document.querySelector('${ZAHNRAD}');
  const auf = await zahnradAuf();
  const ansicht = document.querySelector('${ZAHNRAD_ANSICHT}');
  const einstellungen = document.querySelector('${ZAHNRAD_EINSTELLUNGEN}');
  await zahnradZu();
  return {
    kopfband: kopfband !== null,
    zahnrad: zahnrad !== null,
    menueGehtAuf: auf === true,
    einstellungenLink: einstellungen !== null,
    ansichtsgruppeOhneVorschau: ansicht !== null,
    // Der Gegenbeweis, falls die alte Hülle noch steht: ihre Seitenleiste.
    alteSeitenleiste: document.querySelector('aside.kw-sidebar') !== null,
  };
})`;

/**
 * B1: der Rundweg für EINE Rolle. Wählt sie im Zahnrad, belegt die Wirkung der Vorschau, geht über
 * „Zur Admin-Ansicht" zurück und weist nach, dass dabei NICHT neu geladen wurde.
 *
 * Der Reload-Nachweis ist eine Marke am `window`: ein echter Seitenneuaufbau wirft sie weg. Damit
 * hängt die Aussage „ohne Reload" an einer Tatsache der Sitzung, nicht an einer Vermutung.
 */
const RUNDWEG = `(async ([kurz, zurueckText, reiter]) => {
  ${VORSPANN}
  const schritte = [];
  window.__job3065_marke = 'gesetzt';

  // 1. Gewählt wird in den EINSTELLUNGEN: Konten → Zeile „Ansicht als Rolle" → Detailkarte.
  await zahnradZu();
  const zurueckOben = document.querySelector('[data-einst="zurueck"]');
  if (zurueckOben) { zurueckOben.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (!(await reiterWaehlen(reiter))) return { fehler: 'Reiter „' + reiter + '" nicht gefunden', schritte };
  const zeile = document.querySelector('[data-testid="zeile-ansicht-rolle"]');
  if (!sichtbar(zeile)) return { fehler: 'Zeile „Ansicht als Rolle" fehlt in den Einstellungen', schritte };
  zeile.click();
  const karte = await warte(() => sichtbar(document.querySelector('[data-testid="detail-ansicht-rolle"]')));
  if (!karte) return { fehler: 'Detailkarte „Ansicht als Rolle" ging nicht auf', schritte };
  schritte.push('Detailkarte offen');

  const knopf = [...document.querySelectorAll('[data-testid="detail-ansicht-rolle"] button[aria-pressed]')]
    .find((b) => norm(b.textContent) === kurz);
  if (!knopf) return { fehler: 'Rollenknopf „' + kurz + '" nicht in der Detailkarte', schritte };
  knopf.click();
  schritte.push('Rolle ' + kurz + ' gewählt');

  // 2. Die Vorschau WIRKT: der Rollen-Guard nimmt dem Admin die Seite /admin weg, und die
  //    Admin-Zeile „Einstellungen" verschwindet aus dem Zahnrad.
  const wegDaneben = await warte(() => document.querySelector('[data-einst="seite"]') === null);
  if (!wegDaneben) return { fehler: 'Vorschau wirkte nicht: die Einstellungen stehen noch', schritte };
  if (!(await zahnradAuf())) return { fehler: 'Zahnrad-Menü ging in der Vorschau nicht auf', schritte };
  const wirkt = await warte(() => document.querySelector('${ZAHNRAD_EINSTELLUNGEN}') === null);
  if (!wirkt) return { fehler: 'Vorschau wirkte nicht: Admin-Zeile steht noch', schritte };
  schritte.push('Vorschau wirkt (Seite gesperrt, Admin-Zeile weg)');

  // 3. Der Rückweg ist WÄHREND der Vorschau erreichbar — das ist der Kern von BENs Befund. Er hängt
  //    in der Hülle, nicht auf der Seite: die Seite ist in genau diesem Moment gesperrt.
  const zurueck = [...document.querySelectorAll('${ZAHNRAD_ANSICHT} button')]
    .find((b) => norm(b.textContent) === zurueckText);
  if (!zurueck) return { fehler: 'kein Rückweg „' + zurueckText + '" während der Vorschau', schritte };
  if (!sichtbar(zurueck)) return { fehler: 'Rückweg vorhanden, aber unsichtbar', schritte };
  zurueck.click();
  schritte.push('Rückweg geklickt');

  const zurueckDa = await warte(() => document.querySelector('${ZAHNRAD_EINSTELLUNGEN}') !== null);
  if (!zurueckDa) return { fehler: 'nach dem Rückweg fehlt die Admin-Zeile', schritte };
  await zahnradZu();

  // /admin steht wieder, die Einstellungen sind gemountet, und die Sitzung ist dieselbe geblieben.
  const aufAdmin = await warte(() => location.pathname === '/admin');
  const seiteDa = await warte(() => sichtbar(document.querySelector('[data-einst="seite"]')));
  return {
    fehler: null,
    schritte,
    aufAdmin,
    seiteDa,
    ohneReload: window.__job3065_marke === 'gesetzt',
    pfadname: location.pathname,
  };
})`;

/**
 * B2: die Zählung bei OFFENEM Zahnrad — beide Orte sind dann gleichzeitig im DOM.
 *   Rollen-Auswahlort  = sichtbares Blattelement mit der Beschriftung „Ansicht als Rolle"
 *   Stufe-2-Schalter   = sichtbares Kontrollkästchen, das „Erweiterte Module · Stufe 2" beschriftet
 * Jeder Treffer kommt mit CSS-Pfad zurück: eine Zahl ohne Ort wäre nicht auflösbar.
 */
const ZAEHLUNG = `(async ([viewAs, stage2, reiter]) => {
  ${VORSPANN}
  await zahnradZu();
  const zurueckOben = document.querySelector('[data-einst="zurueck"]');
  if (zurueckOben) { zurueckOben.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (!(await reiterWaehlen(reiter))) return { fehler: 'Reiter „' + reiter + '" nicht gefunden' };
  if (!(await zahnradAuf())) return { fehler: 'Zahnrad-Menü ging nicht auf' };
  const alle = [...document.querySelectorAll('*')];
  const ansicht = alle.filter((el) => sichtbar(el) && norm(el.textContent) === viewAs
    && ![...el.children].some((c) => norm(c.textContent) === viewAs));
  const schalter = [...document.querySelectorAll('input[type="checkbox"]')].filter((el) => {
    if (!sichtbar(el)) return false;
    const eigen = norm(el.getAttribute('aria-label'));
    const umschliessend = norm(el.closest('label') ? el.closest('label').textContent : '');
    return eigen === stage2 || umschliessend === stage2;
  });
  const ergebnis = {
    fehler: null,
    menueOffen: document.querySelector('${ZAHNRAD_MENUE}') !== null,
    ansicht: ansicht.map(pfad),
    schalter: schalter.map(pfad),
  };
  await zahnradZu();
  return ergebnis;
})`;

/** In der Seite: Reiter wählen, Posten öffnen, ggf. innen weiterklicken, Erwartungen prüfen. */
const PRUEFE = `(async ([reiter, klick, detail, innenKlick, warteAuf, erwartet, hilfeText]) => {
  const sichtbar = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const warte = async (pruefung, ms = 15000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return pruefung();
  };
  const fehlt = [];
  // Immer vom Sichtfeld aus starten.
  const zurueckOben = document.querySelector('[data-einst="zurueck"]');
  if (zurueckOben) { zurueckOben.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (reiter) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiter);
    if (!r) return ['Reiter „' + reiter + '" nicht gefunden'];
    r.click();
    await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
  }
  if (klick) {
    const ziel = document.querySelector(klick);
    if (!sichtbar(ziel)) return ['Zeile/Knopf „' + klick + '" fehlt oder ist unsichtbar'];
    ziel.click();
  }
  if (detail) {
    const da = await warte(() => sichtbar(document.querySelector('[data-testid="' + detail + '"]')), 8000);
    if (!da) return ['Detailkarte „' + detail + '" ging nicht auf'];
  }
  const raum = detail ? document.querySelector('[data-testid="' + detail + '"]') : document.querySelector('[data-einst="seite"]');
  if (innenKlick) {
    const knopf = [...raum.querySelectorAll('button')].find((b) => sichtbar(b) && (b.textContent||'').replace(/\\s+/g, ' ').trim().includes(innenKlick));
    if (!knopf) return ['Knopf „' + innenKlick + '" fehlt in der Karte'];
    knopf.click();
    if (warteAuf) {
      const kam = await warte(() => sichtbar(document.querySelector(warteAuf)));
      if (!kam) return ['nach „' + innenKlick + '" kam „' + warteAuf + '" nicht'];
    } else {
      await warte(() => false, 300);
    }
  }
  const sichtbarerText = (was) => {
    const treffer = [...raum.querySelectorAll('*')].some((el) => sichtbar(el) && (el.textContent||'').includes(was));
    return treffer || (sichtbar(raum) && (raum.textContent||'').includes(was));
  };
  for (const e of erwartet) {
    if (e.selektor) {
      const el = document.querySelector(e.selektor);
      if (!sichtbar(el)) fehlt.push('Element „' + e.selektor + '" fehlt oder ist unsichtbar');
    }
    if (e.text) {
      if (!sichtbarerText(e.text)) fehlt.push('Text „' + e.text + '" nicht sichtbar');
    }
    if (e.einesVon) {
      if (!e.einesVon.some(sichtbarerText)) fehlt.push('keiner dieser Texte sichtbar: ' + e.einesVon.join(' | '));
    }
  }
  if (hilfeText) {
    const knopf = raum.querySelector('[data-einst="hilfe"]');
    if (!sichtbar(knopf)) {
      fehlt.push('kein Fragezeichen-Menü an dieser Karte');
    } else {
      knopf.click();
      const auf = await warte(() => sichtbar(document.querySelector('[data-einst="hilfemenue"]')), 4000);
      if (!auf) {
        fehlt.push('das Fragezeichen-Menü ging nicht auf');
      } else {
        const menue = document.querySelector('[data-einst="hilfemenue"]');
        if (!(menue.textContent||'').includes(hilfeText)) {
          fehlt.push('Hilfetext fehlt im Menü: ' + hilfeText.slice(0, 40));
        }
        knopf.click();
      }
    }
  }
  // Zurück in das Sichtfeld, damit der nächste Posten von vorn beginnt.
  const zurueck = document.querySelector('[data-einst="zurueck"]');
  if (zurueck) zurueck.click();
  return fehlt;
})`;

// EINE Chromium-Instanz für beide Flächen: erst alle Posten auf /admin, dann führt dieselbe Seite
// auf /profil (siehe `wechsle` in h6-chromium.ts — mehr Instanzen kippen im Gesamttor fremde
// Messungen mit „Target page, context or browser has been closed").
let stand: Stand | null = null;
let demoSchalterVorher: string | undefined;

describe("JOB 3065 H6 · Funktionsinventar — jede Funktion von gestern ist erreichbar", () => {
  beforeAll(async () => {
    demoSchalterVorher = process.env.KLARWERK_DEMO_SEED;
    process.env.KLARWERK_DEMO_SEED = "1";
    await i18n.changeLanguage("de");
    stand = await starte("/admin", '[data-einst="seite"]', 1280, 900, async (app) => {
      // Der zweite Nutzer entsteht über die ECHTE Route und ist deshalb NICHT freigegeben — genau
      // der Zustand, an dem der Knopf „Freigeben" hängt (§5a Zeile 2).
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { ...WARTENDER, password: "geheim12345" },
      });
    });
    if (stand.fehler === null && stand.seite) {
      await stand.seite.waitForFunction(
        fn(`() => document.querySelectorAll('[data-einst="zeile"]').length > 1`),
        undefined,
        { timeout: 30_000 },
      );
    }
  }, 240_000);

  afterAll(async () => {
    if (stand) await beende(stand);
    if (demoSchalterVorher === undefined) {
      delete process.env.KLARWERK_DEMO_SEED;
    } else {
      process.env.KLARWERK_DEMO_SEED = demoSchalterVorher;
    }
  }, 60_000);

  it("K · Kalibrierung: die Fläche steht, und §5a ist Zeile für Zeile belegt (1–28, keine Lücke)", () => {
    expect(stand?.fehler).toBeNull();
    const zeilen = [...inventarAdmin(), ...inventarProfil()]
      .map((p) => p.zeile5a)
      .sort((a, b) => a - b);
    // GENAU die 28 Zeilen der Tabelle in §5a — keine Mindestzahl, keine Dublette, keine Lücke.
    expect(zeilen).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  for (const posten of inventarAdmin()) {
    it(`I${posten.zeile5a} · ${posten.id}`, async () => {
      expect(stand?.fehler).toBeNull();
      const fehlt = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<string[]>(
        fn(PRUEFE),
        [
          posten.reiter ?? "",
          posten.klick,
          posten.detail ?? "",
          posten.innenKlick ?? "",
          posten.warteAuf ?? "",
          posten.erwartet,
          posten.hilfeText ?? "",
        ],
      );
      expect(fehlt, `§5a Zeile ${posten.zeile5a}: ${fehlt.join(" · ")}`).toEqual([]);
    }, 90_000);
  }

  // ---- BEN R8, Korrekturpflicht 1: Rundweg und Zählung ------------------------------------------
  it("B0 · KALIBRIERUNG: die Hülle aus JOB 3060 steht (Kopfband, Zahnrad, Vorschau-Gruppe)", async () => {
    expect(stand?.fehler).toBeNull();
    const h = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<{
      kopfband: boolean;
      zahnrad: boolean;
      menueGehtAuf: boolean;
      einstellungenLink: boolean;
      ansichtsgruppeOhneVorschau: boolean;
      alteSeitenleiste: boolean;
    }>(fn(HUELLE_DA));
    expect(
      h,
      "Ohne die Hülle aus JOB 3060 ist der Rundweg nicht messbar (alte Seitenleiste statt Kopfband); " +
        "und ohne laufende Vorschau darf im Zahnrad keine Ansichts-Gruppe stehen — das Raster wohnt " +
        "in den Einstellungen.",
    ).toEqual({
      kopfband: true,
      zahnrad: true,
      menueGehtAuf: true,
      einstellungenLink: true,
      ansichtsgruppeOhneVorschau: false,
      alteSeitenleiste: false,
    });
  }, 90_000);

  for (const rolle of ["viewer", "experte", "controller"]) {
    it(`B1-${rolle} · Vorschau als ${rolle}, Rückweg über das Zahnrad, zurück auf /admin ohne Reload`, async () => {
      expect(stand?.fehler).toBeNull();
      const r = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<{
        fehler: string | null;
        schritte: string[];
        aufAdmin?: boolean;
        seiteDa?: boolean;
        ohneReload?: boolean;
        pfadname?: string;
      }>(fn(RUNDWEG), [t(`role.short.${rolle}`), t("role.backToAdmin"), t("adm.sec.konten")]);

      expect(r.fehler, `${rolle}: ${r.fehler} (bis dahin: ${r.schritte.join(" → ")})`).toBeNull();
      expect(r.aufAdmin, `${rolle}: nicht auf /admin, sondern ${r.pfadname}`).toBe(true);
      expect(r.seiteDa, `${rolle}: die Einstellungen sind nach dem Rückweg nicht gemountet`).toBe(
        true,
      );
      expect(r.ohneReload, `${rolle}: die Seite wurde neu geladen — kein Ein-Klick-Rückweg`).toBe(
        true,
      );
    }, 120_000);
  }

  it("B2 · genau EIN Rollen-Auswahlort und EIN Stufe-2-Schalter in der ganzen Anwendung", async () => {
    expect(stand?.fehler).toBeNull();
    const z = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<{
      fehler: string | null;
      menueOffen?: boolean;
      ansicht?: string[];
      schalter?: string[];
    }>(fn(ZAEHLUNG), [t("role.viewAs"), t("role.stage2"), t("adm.sec.konten")]);

    expect(z.fehler).toBeNull();
    // Kalibrierung der Zählung: bei geschlossenem Menü wäre ein zweiter Ort im Zahnrad unsichtbar,
    // und „genau 1" wäre ein Artefakt der Messung statt einer Aussage über das Produkt.
    expect(z.menueOffen, "gezählt wurde bei geschlossenem Zahnrad — die Zahl wäre wertlos").toBe(
      true,
    );
    expect(
      z.ansicht,
      `„${t("role.viewAs")}" ist ${z.ansicht?.length}× bedienbar: ${z.ansicht?.join(" · ")}`,
    ).toHaveLength(1);
    expect(
      z.schalter,
      `„${t("role.stage2")}" ist ${z.schalter?.length}× schaltbar: ${z.schalter?.join(" · ")}`,
    ).toHaveLength(1);
  }, 90_000);

  it("W · dieselbe Seite führt auf /profil — die zweite Fläche steht", async () => {
    expect(stand?.fehler).toBeNull();
    await wechsle(stand as Stand, "/profil", '[data-testid="zeile-abmelden"]');
    expect(stand?.fehler, "/profil nicht gemountet").toBeNull();
  }, 60_000);

  for (const posten of inventarProfil()) {
    it(`I${posten.zeile5a} · ${posten.id}`, async () => {
      expect(stand?.fehler).toBeNull();
      const fehlt = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<string[]>(
        fn(PRUEFE),
        [
          "",
          posten.klick,
          posten.detail ?? "",
          posten.innenKlick ?? "",
          posten.warteAuf ?? "",
          posten.erwartet,
          posten.hilfeText ?? "",
        ],
      );
      expect(fehlt, `§5a Zeile ${posten.zeile5a}: ${fehlt.join(" · ")}`).toEqual([]);
    }, 90_000);
  }

  it("F · die Seiten haben dabei keinen Fehler geworfen (pageerror)", () => {
    expect(stand?.seitenfehler).toEqual([]);
  });
});
