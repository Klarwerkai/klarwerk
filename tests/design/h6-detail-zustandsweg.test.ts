// ================================================================================================
// JOB 3065 H6 R3 · DIE ENDPUNKT-MATRIX: jede Quelle einer Detailkarte, mit 503 am gebauten Produkt.
// ================================================================================================
//
// BENs Befund an Runde 2 (Korrekturpflichten 1 und 2): Der Zustandsvertrag war NICHT überall
// wirksam, und der Test hat das nicht gesehen, weil er nur EINE Quelle wirklich bis zum Retry-Zähler
// verfolgt hat. Gefunden hat er zwei Löcher:
//   · Bereitschaft: sechs Quellen als Gruppe, aber `retryReady` rief nur fünf davon neu ab —
//     `demoStatus` fehlte. Der Zähler blieb bei 3 vor und nach dem Klick.
//   · Profil-Wirkung: hing noch am alten `QueryState` und zeigte „Service Unavailable" ohne Ausweg.
//
// DIESER TEST IST DESHALB EINE TABELLE, keine Stichprobe. Für JEDE querygestützte Quelle einer
// Detailkarte steht unten ihr exakter Endpunkt, und für jede läuft derselbe vierteilige Beleg am
// GEBAUTEN Produkt (Chromium, echte App hinter der Weiche, echter Bestand):
//
//   1  Störung setzen (503 auf genau diesen Pfad), Seite neu laden, Karte öffnen.
//   2  Die Karte sagt „nicht abrufbar" und bietet „Erneut versuchen" — kein stehendes Ladewort.
//   3  Der Klick auf „Erneut versuchen" erhöht den ABRUFZÄHLER GENAU DIESES PFADES.
//   4  Störung beenden, noch einmal klicken → der ECHTE Inhalt der Karte steht da.
//
// Dazu die Kalibrierung K: ohne Störung gibt es diesen Zustand nirgends (sonst wäre Schritt 2 immer
// grün). Die Gegenmutation steht in der Arbeitsspur: `retryReady` wieder auf fünf Quellen
// zurückgedreht → genau der Bereitschaftsfall `/api/admin/demo-seed` wird rot.
//
// ------------------------------------------------------------------------------------------------
// JOB 3065 R4 — BENs Befund an Runde 3: Die Matrix behauptete „18 von 18", ohne `/api/users` zu
// führen. Zwei Dinge fehlten, und beide sind hier behoben:
//   · EIN BEDIENORT OHNE KARTE. `/api/users` wird auf der Kontenfläche SELBST bedient — hinter der
//     Nutzerliste liegt keine Detailkarte. Eine Matrix, die nur Karten öffnen kann, konnte ihn nicht
//     sehen. `zeile: ""` heißt jetzt: der Behälter ist die Fläche.
//   · EINE HANDGESCHRIEBENE LISTE. Der Fall V leitet die Vollzähligkeit aus dem Quelltext der sechs
//     Seiten ab, statt sie zu behaupten: jede `queryFn:` und jeder Haken aus `../api/hooks` braucht
//     einen Fall hier. Die nächste neue Quelle macht V rot, bevor sie ungemessen live geht.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { BRANDING_MINDESTABSTAND_MS } from "../../apps/web/src/lib/brandTheme";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import {
  ORIGIN,
  type Stand,
  WURZEL,
  beende,
  fn,
  setzeSprache,
  starte,
  wechsle,
} from "./h6-chromium";

/** Eine querygestützte Quelle eines Bedienortes. */
interface Quelle {
  /** Der Name des Falls — er nennt Bedienort und Endpunkt. */
  id: string;
  /** Der exakte Pfad, der gestört wird. */
  pfad: string;
  /** Reiter der Fläche (leer = die Karte liegt auf /profil). */
  reiter: string;
  /**
   * Die Zeile, die die Karte öffnet — LEER, wenn der Bedienort die Fläche SELBST ist.
   *
   * JOB 3065 R4 (BENs Korrekturpflicht 2): `/api/users` hat keine Detailkarte hinter sich. Genau
   * deshalb blieb sein Fehlerweg in Runde 3 ungemessen — eine Matrix, die nur Karten kennt, kann
   * den einen Bedienort ohne Karte nicht sehen. Sie kennt jetzt beides.
   */
  zeile: string;
  /** Der Behälter (Detailkarte ODER Flächenkarte), in dem der Zustand steht. */
  behaelter: string;
  /** Der ECHTE Inhalt, der nach der Erholung im Behälter stehen muss. */
  inhalt: string;
  /**
   * Nur bei Karten mit MEHREREN Quellen: die `data-testid` der `Abfragehuelle` GENAU DIESER Quelle.
   * Die Zustandsfolge Z misst dann in dieser Hülle und nicht in der ganzen Karte — sonst würde die
   * Standzeile einer Nachbarquelle derselben Karte als Beleg für diese gelesen (Nacharbeit 6).
   */
  huelle?: string;
  /**
   * Die Quelle zeichnet einen BESTÄTIGTEN Stand ausdrücklich ohne Hülle und meldet eine gescheiterte
   * Auffrischung nicht (Vertrag der Karte, Begründung im Feld). Z prüft dann statt der Standzeile
   * einen ECHTEN gescheiterten Neuabruf über den Produktweg (Request, 503, Markenwerte erhalten) und
   * danach einen erfolgreichen mit geändertem Wert (BEN, Nacharbeit 8).
   */
  standOhneHuelle?: string;
}

const t = (k: string): string => i18n.t(k);

function matrixAdmin(): Quelle[] {
  return [
    // ---- Konten: der EINE Bedienort ohne Detailkarte (BENs Befund aus Runde 3) -----------------
    {
      id: "Kontenfläche · /api/users (BENs Befund aus Runde 3)",
      pfad: "/api/users",
      reiter: t("adm.sec.konten"),
      zeile: "",
      behaelter: "flaeche-nutzer",
      // Nach der Erholung stehen die Konten wieder da; das erste ist der Admin dieses Prüfstands
      // (`h6-chromium.ts`: die Ersteinrichtung legt „Pedi" an).
      inhalt: "Pedi",
    },
    {
      id: "KI-Verwaltung · /api/reasoner/config",
      pfad: "/api/reasoner/config",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki"]',
      behaelter: "detail-ki",
      inhalt: t("adm.ai.save"),
    },
    {
      id: "Verfügbare KIs · /api/reasoner/config",
      pfad: "/api/reasoner/config",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-zugaenge"]',
      behaelter: "detail-ki-zugaenge",
      // JOB 3134: die Cloud-Zeile ist zwei Anbieterzeilen gewichen; die erste heisst ChatGPT (OpenAI).
      inhalt: t("adm.ai.access.openai"),
    },
    {
      id: "Eigene Funktionen · /api/reasoner/assist-presets",
      pfad: "/api/reasoner/assist-presets",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-funktionen"]',
      behaelter: "detail-ki-funktionen",
      inhalt: t("adm.presets.add"),
    },
    {
      id: "Prüferanzahl · /api/validation/settings",
      pfad: "/api/validation/settings",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-grenzen"]',
      behaelter: "detail-ki-grenzen",
      inhalt: t("adm.val.save"),
      huelle: "huelle-pruefanzahl",
    },
    {
      id: "Upload-Grenzen · /api/upload-limits",
      pfad: "/api/upload-limits",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-grenzen"]',
      behaelter: "detail-ki-grenzen",
      inhalt: t("adm.upload.save"),
      huelle: "huelle-uploadgrenzen",
    },
    {
      id: "Externe Wissensabfrage · /api/external/policy",
      pfad: "/api/external/policy",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-extern"]',
      behaelter: "detail-ki-extern",
      inhalt: t("adm.ext.save"),
    },
    {
      id: "Duplikat-Erkennung · /api/duplicates/settings",
      pfad: "/api/duplicates/settings",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-dup"]',
      behaelter: "detail-ki-dup",
      inhalt: t("adm.dup.save"),
    },
    {
      // JOB 3065 R4: die zweite Lücke derselben Klasse — die Karte hinter der Zeile „Demodaten"
      // kannte den Bestand gar nicht, also gab es dort weder Zustand noch „Erneut versuchen".
      id: "Demodaten · /api/admin/demo-seed",
      pfad: "/api/admin/demo-seed",
      // JOB 3337: eigenes Thema „Vorführdaten".
      reiter: t("adm.sec.vorfuehrdaten"),
      zeile: '[data-testid="zeile-demodaten"]',
      behaelter: "detail-demodaten",
      inhalt: t("einst.daten.demoBestand"),
      huelle: "huelle-demostatus",
    },
    {
      // JOB 3511 (DEMO-FIRMEN-CI): die ZWEITE Quelle derselben Karte — der Abschnitt
      // „Demo-Erscheinungsbild" liest den zentralen Markenstand. Sie ist TRAGEND und nicht
      // nachrangig wie `/api/directory` weiter unten: wer den Schalter bedient, darf nicht auf eine
      // Stellung schauen, die niemand bestätigt hat. Also derselbe vierteilige Beleg wie überall.
      //
      // NICHT ZU VERWECHSELN MIT 404: Antwortet der Server „gibt es hier nicht" (Stände ohne JOB
      // 3510), dann ist „kein Firmenprofil" die WAHRE Auskunft und es entsteht ausdrücklich KEIN
      // Fehlerzustand — genau das hält die Kalibrierung K fest. Gestört wird hier mit 503, und das
      // sagt nichts über die Installation aus.
      id: "Demo-Erscheinungsbild · /api/branding",
      pfad: "/api/branding",
      reiter: t("adm.sec.vorfuehrdaten"),
      zeile: '[data-testid="zeile-demodaten"]',
      behaelter: "detail-demodaten",
      inhalt: t("einst.marke.profil"),
      // JOB 3563 (`AdminDatenDetails.tsx`, Kopf von `DemoErscheinungsbild`): hat das Markenmodul
      // einen bestätigten Stand, zeichnet die Karte ihn OHNE Hülle; eine spätere gescheiterte
      // Auffrischung leert nichts und meldet nichts. Eine Standzeile dieser Quelle gibt es also
      // nicht — das ist ihr Vertrag, keine Lücke.
      standOhneHuelle:
        "bestätigter Markenstand ohne Hülle; gescheiterte Auffrischung wird nicht gemeldet (JOB 3563)",
    },
    {
      // JOB 3636 (VORFUEHRDATEN GETRENNT WAEHLEN): die DRITTE Quelle derselben Karte — die Liste
      // der Demopakete. Aus ihr holt die Advisor-Karte die Kennung, mit der sie lädt; ohne sie gibt
      // es dort weder Name noch Knopf. Sie ist damit TRAGEND und bekommt denselben vierteiligen
      // Beleg wie jede andere: Fehlerwort, Ausweg, echter Neuabruf, echter Inhalt.
      //
      // `inhalt` ist der Titel aus dem Paketvertrag (`example-packages/advisor-ict-en-v1.ts:93-97`)
      // — er lautet in allen drei Sprachen gleich und hängt deshalb nicht an der Oberflächensprache
      // dieses Laufs. Er steht INNERHALB der Hülle: der Kartentitel „Demopakete" darüber ist ohne
      // Antwort da, der Paketname erst mit ihr.
      id: "Advisor-Demodaten · /api/admin/demo-packages",
      pfad: "/api/admin/demo-packages",
      reiter: t("adm.sec.vorfuehrdaten"),
      zeile: '[data-testid="zeile-demodaten"]',
      behaelter: "detail-demodaten",
      inhalt: "Advisor ICT (EN)",
      huelle: "huelle-demopakete",
    },
    {
      id: "Werkseinstellungen · /api/admin/factory-reset",
      pfad: "/api/admin/factory-reset",
      // JOB 3337: Werkseinstellungen unter „System".
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-werkseinstellungen"]',
      behaelter: "detail-werkseinstellungen",
      inhalt: t("adm.factory.unavailable"),
    },
    {
      // JOB 4025 (KUNDENBETRIEB-BACKUP): die Sicherungsauskunft unter „System", neben der
      // Werkseinstellung. Sie ist TRAGEND: wer wissen will, ob eine Sicherung vorliegt, darf bei
      // einer gestörten Leitung nicht „keine Sicherung" lesen — das wäre die gefährlichste aller
      // falschen Beruhigungen. Fällt die Quelle aus, sagt die Karte „nicht abrufbar" und bietet den
      // Ausweg, wie jede andere auch.
      //
      // `inhalt` ist der VERZEICHNIS-Vorspann und kein ganzer Satz, aus zwei Gründen. Erstens hängt
      // der Pfad dahinter an der Maschine, auf der dieser Prüfstand läuft — er ist nicht vorhersagbar.
      // Zweitens, und das ist der tragende Grund: die Zeile „Verzeichnis: …" steht AUSSCHLIESSLICH
      // im Erfolgszweig der `Abfragehuelle`, also nur mit einer echten Antwort. Sie unterscheidet
      // damit wirklich zwischen Störung und Erholung. Der Ehrlichkeitssatz der Karte taugt dafür
      // ausdrücklich NICHT: er steht bewusst AUSSERHALB der Hülle und ist auch im Fehlerfall da —
      // als Fortschrittsbeleg wäre er trivial wahr.
      id: "Sicherung · /api/admin/sicherungen",
      pfad: "/api/admin/sicherungen",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-sicherung"]',
      behaelter: "detail-sicherung",
      inhalt: i18n.t("adm.backup.dir", { verzeichnis: "" }).trim(),
    },
    {
      id: "Papierkorb · /api/kos/trash",
      pfad: "/api/kos/trash",
      // JOB 3337: Papierkorb unter „Quellen und Daten".
      reiter: t("adm.sec.quellen"),
      zeile: '[data-testid="zeile-papierkorb"]',
      behaelter: "detail-papierkorb",
      inhalt: t("adm.trash.empty"),
    },
    {
      id: "Audit-Liste · /api/audit",
      pfad: "/api/audit",
      // JOB 3337: Benutzeränderungen unter „Sicherheit und Nachweise".
      reiter: t("adm.sec.sicherheit"),
      zeile: '[data-testid="zeile-audit"]',
      behaelter: "detail-audit",
      inhalt: "auth.",
    },
    {
      id: "Prüfprotokoll · /api/audit",
      pfad: "/api/audit",
      reiter: t("adm.sec.sicherheit"),
      zeile: '[data-testid="zeile-pruefprotokoll"]',
      behaelter: "detail-pruefprotokoll",
      inhalt: t("adm.sich.verify.button"),
    },
    // ---- Die Bereitschaft: EINE Karte, SECHS Quellen. Jede einzeln gestört — genau hier lag
    // BENs Befund, dass „Erneut versuchen" die sechste Quelle nie wiederholt hat.
    {
      id: "Bereitschaft · Quelle 1 · /api/reasoner/config",
      pfad: "/api/reasoner/config",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-bereitschaft"]',
      behaelter: "detail-bereitschaft",
      inhalt: t("adm.ready.ki"),
    },
    {
      id: "Bereitschaft · Quelle 2 · /api/analytics",
      pfad: "/api/analytics",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-bereitschaft"]',
      behaelter: "detail-bereitschaft",
      inhalt: t("adm.ready.validated"),
    },
    {
      id: "Bereitschaft · Quelle 3 · /api/validation/board",
      pfad: "/api/validation/board",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-bereitschaft"]',
      behaelter: "detail-bereitschaft",
      inhalt: t("adm.ready.openReviews"),
    },
    {
      id: "Bereitschaft · Quelle 4 · /api/upload-limits",
      pfad: "/api/upload-limits",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-bereitschaft"]',
      behaelter: "detail-bereitschaft",
      inhalt: t("adm.ready.upload"),
    },
    {
      id: "Bereitschaft · Quelle 5 · /api/external/policy",
      pfad: "/api/external/policy",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-bereitschaft"]',
      behaelter: "detail-bereitschaft",
      inhalt: t("adm.ready.external"),
    },
    {
      id: "Bereitschaft · Quelle 6 · /api/admin/demo-seed (BENs Befund aus Runde 2)",
      pfad: "/api/admin/demo-seed",
      reiter: t("adm.sec.system"),
      zeile: '[data-testid="zeile-bereitschaft"]',
      behaelter: "detail-bereitschaft",
      inhalt: t("adm.ready.demo"),
    },
  ];
}

/**
 * JOB 3140 (UX-11) — DIE ZWEITE SORTE QUELLE: NACHRANGIG.
 *
 * Die Matrix oben kennt bis hierher nur TRAGENDE Quellen: fällt eine aus, sagt die Karte „nicht
 * abrufbar" und bietet den Ausweg. Mit dem Prüfprotokoll kommt eine Quelle dazu, für die genau das
 * FALSCH wäre: `/api/directory` liefert nur die Namen zu den Kennungen. Fällt sie aus, bleibt das
 * Protokoll vollständig lesbar — es fehlen die Namen, und das sagt die Fläche ehrlich.
 *
 * Der Beleg ist deshalb spiegelbildlich zu `pruefeQuelle`: KEINE Fehlerbox, kein stehendes
 * Ladewort, der Inhalt der tragenden Quelle bleibt stehen, an der Stelle des Namens steht die
 * SCHWÄCHERE Auskunft — und die starke Tatsachenaussage („Konto nicht mehr vorhanden") fällt
 * ausdrücklich NICHT, weil sie eine erfolgreiche Antwort voraussetzt (Auftrag 3140 §9).
 */
interface NachrangigeQuelle {
  id: string;
  pfad: string;
  reiter: string;
  zeile: string;
  behaelter: string;
  /** Was trotz der Störung dasteht — die tragende Quelle trägt weiter. */
  inhalt: string;
  /** Die ehrliche, schwächere Auskunft an der Stelle des fehlenden Wertes. */
  schwach: string;
  /** Die starke Aussage, die ohne Beleg NICHT fallen darf. */
  verboten: string;
  /**
   * Der ZWISCHENZUSTAND, der vergehen muss, bevor gemessen wird. Solange die nachrangige Abfrage
   * noch läuft (react-query wiederholt), steht hier ehrlich „Name wird geladen" — das ist RICHTIG
   * und nicht der Endzustand. Gewartet wird auf sein Verschwinden, nicht auf das erwartete
   * Ergebnis: der Test wartet damit auf die Ruhe, nicht auf seine eigene Erwartung.
   */
  zwischen: string;
  /** Was nach der Erholung wirklich dasteht — ein positiver Beleg, keine bloße Abwesenheit. */
  erholt: string;
}

function matrixNachrangig(): NachrangigeQuelle[] {
  return [
    {
      id: "Prüfprotokoll · /api/directory (nachrangig, JOB 3140)",
      pfad: "/api/directory",
      reiter: t("adm.sec.sicherheit"),
      zeile: '[data-testid="zeile-pruefprotokoll"]',
      behaelter: "detail-pruefprotokoll",
      inhalt: t("adm.sich.verify.button"),
      schwach: t("audit.detail.nameUnavailable"),
      verboten: t("audit.detail.accountGone"),
      zwischen: t("audit.detail.nameLoading"),
      // Der Prüfstand richtet sich mit dem Admin „Pedi" ein (h6-chromium.ts); seine Anmeldung ist
      // der erste Protokolleintrag, also steht sein Name nach der Erholung als Ausführender da.
      erholt: "Pedi",
    },
  ];
}

function matrixProfil(): Quelle[] {
  return [
    {
      id: "Profil · Meine Wirkung · /api/me/impact",
      pfad: "/api/me/impact",
      reiter: "",
      zeile: '[data-testid="zeile-wirkung"]',
      behaelter: "detail-wirkung",
      inhalt: t("funke.impact.contributions"),
    },
    {
      // R-0562: ohne eingerichteten zweiten Faktor steht nach der Erholung der Einrichtungsknopf.
      id: "Profil · Zwei-Faktor-Anmeldung · /api/auth/second-factor",
      pfad: "/api/auth/second-factor",
      reiter: "",
      zeile: '[data-testid="zeile-zweifaktor"]',
      behaelter: "detail-zweifaktor",
      inhalt: t("zweifaktor.profil.starten"),
    },
  ];
}

// ================================================================================================
// R-0913 (Nacharbeit 2/5) — DIE SCHALTERQUELLE DER DEMODATENKARTE.
// ================================================================================================
//
// Die Demodatenkarte fragt seit R-0913 die Betriebsschalter (`useFeatures` → `/api/features`)
// selbst ab: bei BESTÄTIGTEM `demodaten=false` sagt sie „Laden ist ausgeschaltet", bei bestätigtem
// `true` steht der Ladeknopf da. Diese Quelle ist weder tragend (ihr Ausfall darf die Karte nicht
// sperren — Entfernen bleibt bedienbar) noch nachrangig im Sinn von JOB 3140 (sie hat keine
// schwächere Ersatzauskunft): ihr Ausfall heißt schlicht „keine Aussage über den Schalter". Gemessen
// wird deshalb genau das, und nach der Erholung das, was der Server WIRKLICH meldet.
interface SchalterQuelle {
  id: string;
  pfad: string;
  reiter: string;
  zeile: string;
  behaelter: string;
}

function matrixSchalter(): SchalterQuelle[] {
  return [
    {
      id: "Demodaten · /api/features (Betriebsschalter, R-0913)",
      pfad: "/api/features",
      reiter: t("adm.sec.vorfuehrdaten"),
      zeile: '[data-testid="zeile-demodaten"]',
      behaelter: "detail-demodaten",
    },
  ];
}

interface SchalterLage {
  fehler: string | null;
  fehlerbox?: boolean;
  ausZeile?: boolean;
  ladeknopf?: boolean;
  entfernen?: boolean;
  /** Was der Server über den Schalter meldet (nur nach der Erholung gelesen). */
  serverAn?: boolean | null;
}

/**
 * In der Seite: Karte öffnen, warten bis der Bestand der Karte steht, dann ablesen. Mit
 * `serverFragen` fragt die Seite den Schalter zusätzlich selbst am Server nach — die Erwartung nach
 * der Erholung kommt damit aus der echten Auskunft, nicht aus einer Annahme über die Umgebung.
 */
const SCHALTER_LIES = `(async ([reiter, zeile, behaelter, ladeText, entfernenText, serverFragen]) => {
  const warte = async (pruefung, ms = 15000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (pruefung()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return pruefung();
  };
  const zurueck = document.querySelector('[data-einst="zurueck"]');
  if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiter);
  if (!r) return { fehler: 'Reiter fehlt: ' + reiter };
  r.click();
  await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
  const z = document.querySelector(zeile);
  if (!z) return { fehler: 'Zeile fehlt: ' + zeile };
  z.click();
  const karte = () => document.querySelector('[data-testid="' + behaelter + '"]');
  if (!(await warte(() => karte() !== null, 10000))) return { fehler: 'Karte ging nicht auf: ' + behaelter };
  await warte(() => { const k = karte(); return k !== null && k.querySelector('[data-testid="demo-bestand"]') !== null; }, 15000);
  let serverAn = null;
  if (serverFragen) {
    const antwort = await fetch('/api/features', { credentials: 'include' });
    serverAn = antwort.ok ? ((await antwort.json()).features || {}).demodaten === true : null;
    if (serverAn === false) await warte(() => karte() !== null && karte().querySelector('[data-testid="demo-laden-aus"]') !== null, 15000);
  }
  // Die Schalterabfrage darf noch einmal wiederholt werden (react-query) — sie soll ausgelaufen sein.
  await new Promise((r) => setTimeout(r, 2500));
  const k = karte();
  const allgemein = k ? k.querySelector('[data-einst="karte-allgemein"]') : null;
  const entfernen = k ? k.querySelector('[data-einst="entfernen"]') : null;
  return {
    fehler: null,
    fehlerbox: k ? k.querySelector('[data-einst="abfrage-fehler"]') !== null : false,
    ausZeile: k ? k.querySelector('[data-testid="demo-laden-aus"]') !== null : false,
    ladeknopf: allgemein ? [...allgemein.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === ladeText) : false,
    entfernen: entfernen ? [...entfernen.querySelectorAll('button')].some((b) => (b.textContent || '').includes(entfernenText)) : false,
    serverAn,
  };
})`;

/**
 * In der Seite: Reiter wählen, (falls es eine gibt) die Zeile öffnen, den Zustand des Behälters
 * ablesen. Ist `zeile` leer, ist der Behälter die Flächenkarte selbst — dann wird nichts geöffnet.
 */
const OEFFNE_UND_LIES = `(async ([reiter, zeile, behaelter]) => {
  const warte = async (pruefung, ms = 15000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (pruefung()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return pruefung();
  };
  const zurueck = document.querySelector('[data-einst="zurueck"]');
  if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (reiter) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiter);
    if (!r) return { fehler: 'Reiter fehlt: ' + reiter };
    r.click();
    await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
  }
  if (zeile) {
    const z = document.querySelector(zeile);
    if (!z) return { fehler: 'Zeile fehlt: ' + zeile };
    z.click();
    const auf = await warte(() => document.querySelector('[data-testid="' + behaelter + '"]') !== null, 10000);
    if (!auf) return { fehler: 'Karte ging nicht auf: ' + behaelter };
  } else {
    const da = await warte(() => document.querySelector('[data-testid="' + behaelter + '"]') !== null, 10000);
    if (!da) return { fehler: 'Fläche fehlt: ' + behaelter };
  }
  // Auf den Fehlerzustand warten (react-query wiederholt einmal, das dauert einen Moment).
  await warte(() => document.querySelector('[data-einst="abfrage-fehler"]') !== null, 15000);
  const karte = document.querySelector('[data-testid="' + behaelter + '"]');
  const box = karte ? karte.querySelector('[data-einst="abfrage-fehler"]') : null;
  return {
    fehler: null,
    hatFehlerbox: box !== null,
    fehlerText: box ? (box.textContent || '').replace(/\\s+/g, ' ').trim() : '',
    laedt: karte ? karte.querySelector('[data-einst="laedt"]') !== null : false,
    text: karte ? (karte.textContent || '').replace(/\\s+/g, ' ').trim() : '',
  };
})`;

/**
 * In der Seite: den „Erneut versuchen"-Knopf der Fehlerbox IM BEHÄLTER drücken.
 *
 * JOB 3065 R4: vorher nahm der Griff die erste Fehlerbox des Dokuments. Solange nur Detailkarten
 * gemessen wurden, war das dieselbe; seit der Kontenfläche ihren eigenen Zustand trägt, muss der
 * Knopf dem Fall gehören, der gerade geprüft wird — sonst zählte womöglich ein fremder Abruf.
 */
const ERNEUT = `(async (behaelter) => {
  const karte = document.querySelector('[data-testid="' + behaelter + '"]');
  const box = karte ? karte.querySelector('[data-einst="abfrage-fehler"]') : null;
  if (!box) return false;
  const knopf = box.querySelector('button');
  if (!knopf) return false;
  knopf.click();
  await new Promise((r) => setTimeout(r, 600));
  return true;
})`;

/**
 * JOB 3140: dieselbe Öffnung, aber OHNE auf einen Fehlerzustand zu warten — bei einer nachrangigen
 * Quelle darf es keinen geben. Gewartet wird stattdessen darauf, dass das Ladewort verschwindet:
 * erst danach ist ablesbar, was die Karte wirklich sagt.
 */
const OEFFNE_UND_LIES_OHNE_FEHLERWARTEN = `(async ([reiter, zeile, behaelter, zwischen]) => {
  const warte = async (pruefung, ms = 15000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (pruefung()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return pruefung();
  };
  const zurueck = document.querySelector('[data-einst="zurueck"]');
  if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (reiter) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiter);
    if (!r) return { fehler: 'Reiter fehlt: ' + reiter };
    r.click();
    await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
  }
  const z = document.querySelector(zeile);
  if (!z) return { fehler: 'Zeile fehlt: ' + zeile };
  z.click();
  const auf = await warte(() => document.querySelector('[data-testid="' + behaelter + '"]') !== null, 10000);
  if (!auf) return { fehler: 'Karte ging nicht auf: ' + behaelter };
  const karte0 = () => document.querySelector('[data-testid="' + behaelter + '"]');
  await warte(() => { const k = karte0(); return k !== null && k.querySelector('[data-einst="laedt"]') === null; }, 15000);
  // Die nachrangige Abfrage darf noch laufen — dann steht ihr Ladewort in der Zeile. Gewartet wird
  // auf sein VERSCHWINDEN, nicht auf ein bestimmtes Ergebnis.
  if (zwischen) {
    await warte(() => { const k = karte0(); return k !== null && !(k.textContent || '').includes(zwischen); }, 25000);
  }
  const karte = karte0();
  const box = karte ? karte.querySelector('[data-einst="abfrage-fehler"]') : null;
  return {
    fehler: null,
    hatFehlerbox: box !== null,
    fehlerText: box ? (box.textContent || '').replace(/\\s+/g, ' ').trim() : '',
    laedt: karte ? karte.querySelector('[data-einst="laedt"]') !== null : false,
    text: karte ? (karte.textContent || '').replace(/\\s+/g, ' ').trim() : '',
  };
})`;

// ================================================================================================
// R-1563 / R-1581 (BEN, Nacharbeit 5) — DIE ZUSTANDSFOLGE JE QUELLE, nicht nur „503 und zurück".
// ================================================================================================
//
// Der vierteilige Beleg oben deckt „Fehler ohne Daten → Neuabruf → Erholung". Für jede Quelle, die
// ihre Karte über die gemeinsame `Abfragehuelle` zeichnet, läuft hier zusätzlich die Folge der
// übrigen Zustände des Vertrags (`components/einstellungen/Abfragehuelle.tsx`, Kopf):
//
//   1  Laden            die Antwort GENAU DIESES PFADES wird zurückgehalten → „Wird geladen …"
//   2  offline, leer    der Browser meldet „offline", während die Antwort noch fehlt → Offline-Box
//   3  Erholung         online, Antwort frei → der echte Inhalt
//   4  offline, Cache   der Browser meldet „offline" → Inhalt BLEIBT, darüber „nicht aktualisiert"
//   5  gescheitert      online, Störung (503) auf genau diesen Pfad, „Erneut" in der Standzeile →
//                       der Pfad wird WIRKLICH neu abgerufen, die Markierung bleibt, der Inhalt auch
//   6  Erholung         Störung weg, „Erneut" → Markierung weg, Inhalt da
//
// DER OFFLINEWECHSEL hier ist das Browserereignis `offline`/`online` am Fenster — dieselbe Quelle,
// aus der die Fläche den Zustand liest (`lib/netzzustand.ts`, `onlineManager`). Es ist KEIN
// Abschalten des Netzwerks des Geräts; die unabhängige Live-Gegenprobe mit echtem Offlinewechsel
// bleibt ein eigener, offener Beleg.
//
// „Laufende Auffrischung" (ruhiges „Stand von …") entsteht nur bei einem Abruf über einer
// abgelaufenen Frischefrist (30 s, `main.tsx`) ohne vorausgegangene Störung. Sie misst seit
// Nacharbeit 8 die eigene Folge R weiter unten für jede Hüllen-Quelle und das Profil: Frist
// verstreichen lassen, Browserfokus, Antwort zurückhalten. Die Kontenfläche und die Bereitschaft
// zeichnen ihre Zustände NICHT über die Hülle; ihre Folgen messen
// `tests/h6-d1-nutzerdetail-stand/` und `tests/h6-bereitschaft-stand-nutzerweg/`.
const BEHAELTER_OHNE_HUELLE = new Set(["flaeche-nutzer", "detail-bereitschaft"]);

/** In der Seite: Reiter wählen und die Zeile öffnen — ohne auf irgendeinen Zustand zu warten. */
const OEFFNE_ROH = `(async ([reiter, zeile, behaelter]) => {
  const warte = async (p, ms = 10000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (p()) return true; await new Promise((r) => setTimeout(r, 40)); }
    return p();
  };
  const zurueck = document.querySelector('[data-einst="zurueck"]');
  if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (reiter) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiter);
    if (!r) return 'Reiter fehlt: ' + reiter;
    r.click();
    await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
  }
  const z = document.querySelector(zeile);
  if (!z) return 'Zeile fehlt: ' + zeile;
  z.click();
  return (await warte(() => document.querySelector('[data-testid="' + behaelter + '"]') !== null)) ? null : 'Karte ging nicht auf: ' + behaelter;
})`;

/** In der Seite: was der Behälter gerade zeigt. */
const BEHAELTER_LAGE = `((behaelter) => {
  const k = document.querySelector('[data-testid="' + behaelter + '"]');
  if (!k) return null;
  const box = k.querySelector('[data-einst="abfrage-fehler"]');
  const staende = [...k.querySelectorAll('[data-einst="stand"]')];
  return {
    // Im Ladezustand IST die Hülle selbst der Ladeabsatz (\`<p data-einst="laedt" data-testid>\`).
    laedt: k.matches('[data-einst="laedt"]') || k.querySelector('[data-einst="laedt"]') !== null,
    fehlerbox: box !== null,
    fehlerText: box ? (box.textContent || '').replace(/\\s+/g, ' ').trim() : '',
    stand: staende.map((s) => (s.textContent || '').replace(/\\s+/g, ' ').trim()).join(' | '),
    text: (k.textContent || '').replace(/\\s+/g, ' ').trim(),
  };
})`;

/** In der Seite: JEDES „Erneut" in den Standzeilen des Behälters drücken. */
const STAND_ERNEUT = `(async (behaelter) => {
  const k = document.querySelector('[data-testid="' + behaelter + '"]');
  const knoepfe = k ? [...k.querySelectorAll('[data-einst="stand"] button')] : [];
  knoepfe.forEach((b) => b.click());
  await new Promise((r) => setTimeout(r, 2500));
  return knoepfe.length;
})`;

// ================================================================================================
// BEN, Nacharbeit 8, Befund 1 — DER MARKENSTAND UND SEIN ECHTER NEUABRUF.
// ================================================================================================
//
// `/api/branding` zeichnet einen bestätigten Stand ohne Hülle und meldet eine gescheiterte
// Auffrischung nicht (JOB 3563). Belegt wird deshalb nicht eine Fehlermeldung, sondern der Abruf
// selbst: der Mithörer schreibt in der Seite jeden Abruf GENAU DIESES Pfades mit Beginn und
// Antwortstatus mit — er reicht die Antwort unverändert durch und ändert nichts am Produktweg. Er
// lebt bis zum nächsten Seitenaufbau.
const MARKEN_MITHOERER = `((pfad) => {
  if (window.__kwMarkenAbrufe) return true;
  const liste = [];
  window.__kwMarkenAbrufe = liste;
  const roh = window.fetch;
  window.fetch = async (...args) => {
    const ziel = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
    const eintrag = ziel.pathname === pfad ? { beginn: Date.now(), status: null, fertig: false } : null;
    if (eintrag) liste.push(eintrag);
    try {
      const antwort = await roh.apply(window, args);
      if (eintrag) { eintrag.status = antwort.status; eintrag.fertig = true; }
      return antwort;
    } catch (e) {
      if (eintrag) { eintrag.status = -1; eintrag.fertig = true; }
      throw e;
    }
  };
  return true;
})`;

/** In der Seite: die sichtbaren Markenwerte der Karte, das Wurzelattribut und die Mitschrift. */
const MARKE_LIES = `((behaelter) => {
  const k = document.querySelector('[data-testid="' + behaelter + '"]');
  const auswahl = k ? k.querySelector('[data-testid="marke-profil"]') : null;
  const schalter = k ? k.querySelector('[data-testid="marke-schalter"]') : null;
  return {
    profil: auswahl ? auswahl.value : null,
    aktiv: schalter ? schalter.checked : null,
    wurzel: document.documentElement.getAttribute('data-brand'),
    huelle: k ? k.querySelector('[data-testid="huelle-branding"]') !== null : false,
    fehlerbox: k ? k.querySelector('[data-einst="abfrage-fehler"]') !== null : false,
    text: k ? (k.textContent || '').replace(/\\s+/g, ' ').trim() : '',
    abrufe: (window.__kwMarkenAbrufe || []).map((e) => ({ beginn: e.beginn, status: e.status, fertig: e.fertig })),
  };
})`;

/** In der Seite: den Markenstand am Server lesen — vor dem Mithörer, an der Karte vorbei. */
const MARKE_SERVER = `(async () => {
  const r = await fetch('/api/branding', { credentials: 'include' });
  return { status: r.status, daten: await r.json() };
})`;

/** In der Seite: den Markenstand am Server umschalten — an der Karte vorbei (zweiter Admin). */
const MARKE_SETZEN = `(async (wahl) => {
  const r = await fetch('/api/admin/branding', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(wahl),
  });
  return { status: r.status };
})`;

/** In der Seite: das Fensterfokus-Ereignis, auf das `initBrandTheme` hört. */
const FENSTER_FOKUS = `() => { window.dispatchEvent(new Event('focus')); return true; }`;

interface MarkenAbruf {
  beginn: number;
  status: number | null;
  fertig: boolean;
}

interface MarkenLage {
  profil: string | null;
  aktiv: boolean | null;
  wurzel: string | null;
  huelle: boolean;
  fehlerbox: boolean;
  text: string;
  abrufe: MarkenAbruf[];
}

// ================================================================================================
// BEN, Nacharbeit 8, Befund 3 — DIE VOLLSTÄNDIGEN SICHTBAREN INHALTE JE SPRACHE.
// ================================================================================================
//
// Der Fehlerweg in EN/NL (S-Quellen) belegt nur Fehlerwort, Ausweg und EIN Inhaltswort. Hier wird
// jede Karte der Matrix samt Profil in Ruhe geöffnet, ihre „?"-Hilfen aufgeklappt und ALLES gelesen,
// was sichtbar ist: Textknoten (Titel, Beschriftungen, Wertebezeichnungen, Knöpfe, Optionen,
// Hilfetexte) und die Namen an `aria-label`/`title`/`placeholder`. Verglichen wird gegen den
// Katalog, aus dem die Oberfläche spricht (`i18n.ts`): jeder deutsch erkannte Katalogtext muss in
// EN/NL als SEIN Soll-Text dastehen, kein deutscher Katalogtext darf in EN/NL stehen bleiben, und
// was EN/NL zusätzlich zeigt, muss auch deutsch dastehen. Daten (Namen, Pfade, Zahlen) sind kein
// Katalogtext und werden nicht übersetzt erwartet.
//
// Nacharbeit 9: Die Kontenfläche hat keine Detailkarte; ihr Behälter `flaeche-nutzer` ist nur die
// Nutzerliste (Namen = Daten). Gelesen wird deshalb die GANZE sichtbare Themenspalte des Reiters
// „Konten" (`bereich`, `[data-einst="spalte"]`): Nutzerliste, Hinzufügen, Rollen.
const INHALT_LIES = `(async ([reiter, zeile, behaelter, bereich]) => {
  const warte = async (p, ms = 15000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (p()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return p();
  };
  const zurueck = document.querySelector('[data-einst="zurueck"]');
  if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
  if (reiter) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiter);
    if (!r) return { fehler: 'Reiter fehlt: ' + reiter };
    r.click();
    await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
  }
  if (zeile) {
    const z = document.querySelector(zeile);
    if (!z) return { fehler: 'Zeile fehlt: ' + zeile };
    z.click();
  }
  const behaelterDa = () => document.querySelector('[data-testid="' + behaelter + '"]');
  if (!(await warte(() => behaelterDa() !== null, 10000))) return { fehler: 'Karte fehlt: ' + behaelter };
  if (bereich) {
    // Die Kontenfläche: erst lesen, wenn die Konten wirklich da sind.
    await warte(() => behaelterDa() !== null && behaelterDa().querySelector('button[data-einst="zeile"]') !== null, 15000);
  }
  const karte = () => (bereich ? document.querySelector(bereich) : behaelterDa());
  if (karte() === null) return { fehler: 'Bereich fehlt: ' + bereich };
  const ruhig = () => {
    const k = karte();
    return k !== null && !k.matches('[data-einst="laedt"]') && k.querySelector('[data-einst="laedt"]') === null
      && k.querySelector('[data-einst="stand"]') === null && k.querySelector('[data-einst="abfrage-fehler"]') === null;
  };
  await warte(ruhig, 20000);
  // Nachrangige Abfragen (z. B. Namen im Prüfprotokoll) dürfen noch auflaufen.
  await new Promise((r) => setTimeout(r, 1500));
  if (!ruhig()) return { fehler: 'Karte kam nicht zur Ruhe: ' + behaelter };
  const knoepfe = [...karte().querySelectorAll('[data-einst="hilfe"]')];
  knoepfe.forEach((b) => { if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
  await warte(() => karte().querySelectorAll('[data-einst="hilfemenue"]').length >= knoepfe.length, 4000);
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const sichtbar = (el) => {
    if (!el) return false;
    for (let e = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
    }
    return el.getClientRects().length > 0;
  };
  const fragmente = [];
  const gang = document.createTreeWalker(karte(), NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) {
    const text = norm(n.nodeValue);
    const el = n.parentElement;
    if (!text || !el) continue;
    const option = el.closest('option');
    if (option ? !sichtbar(option.closest('select')) : !sichtbar(el)) continue;
    fragmente.push(text);
  }
  for (const el of karte().querySelectorAll('[aria-label],[title],[placeholder]')) {
    if (!sichtbar(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder']) { const v = norm(el.getAttribute(a)); if (v) fragmente.push(v); }
  }
  const hilfen = karte().querySelectorAll('[data-einst="hilfetext"]').length;
  [...karte().querySelectorAll('[data-einst="hilfe"]')].forEach((b) => { if (b.getAttribute('aria-expanded') === 'true') b.click(); });
  const titel = karte().querySelector('[data-einst="detailtitel"]');
  return { fehler: null, lang: document.documentElement.lang, titel: titel ? norm(titel.textContent) : null, fragmente, hilfeKnoepfe: knoepfe.length, hilfen };
})`;

interface InhaltLage {
  fehler: string | null;
  lang?: string;
  /** Der Titel der Detailkarte (`null` auf der Kontenfläche, die keine Karte ist). */
  titel?: string | null;
  /** Nacharbeit 10: der Titel ist ein DATENWERT (Name des Kontos), kein Katalogtext. */
  titelDaten?: boolean;
  fragmente: string[];
  hilfeKnoepfe: number;
  hilfen: number;
}

interface Sprachindex {
  bundle: Record<string, string>;
  /** Katalogtext ohne Platzhalter → seine Schlüssel. */
  statisch: Map<string, string[]>;
  /** Katalogtexte MIT Platzhaltern als Muster — nur mit genug festem Text, um zu unterscheiden. */
  muster: [string, RegExp][];
}

const normText = (s: string): string => s.replace(/\s+/g, " ").trim();
const PLATZHALTER = /\{\{[^}]+\}\}/g;

function alsMuster(wert: string, mindestFest: number): RegExp | null {
  const teile = normText(wert).split(PLATZHALTER);
  if (teile.join("").replace(/\s+/g, "").length < mindestFest) {
    return null;
  }
  const flucht = teile.map((teil) => teil.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${flucht.join(".+?")}$`);
}

const SPRACHINDEX = new Map<string, Sprachindex>();

function sprachindex(sprache: string): Sprachindex {
  const vorhanden = SPRACHINDEX.get(sprache);
  if (vorhanden) {
    return vorhanden;
  }
  const roh = (i18n.getResourceBundle(sprache, "translation") ?? {}) as Record<string, unknown>;
  const bundle: Record<string, string> = {};
  const statisch = new Map<string, string[]>();
  const muster: [string, RegExp][] = [];
  for (const [k, v] of Object.entries(roh)) {
    if (typeof v !== "string") {
      continue;
    }
    bundle[k] = v;
    if (v.includes("{{")) {
      const m = alsMuster(v, 4);
      if (m) {
        muster.push([k, m]);
      }
    } else {
      const w = normText(v);
      statisch.set(w, [...(statisch.get(w) ?? []), k]);
    }
  }
  const index = { bundle, statisch, muster };
  SPRACHINDEX.set(sprache, index);
  return index;
}

const ohneDoppelpunkt = (f: string): string => f.replace(/\s*:$/, "");

/** Die Katalogschlüssel, deren Text dieses Fragment ist (exakt, sonst über ein Muster). */
function schluessel(idx: Sprachindex, f: string, mitMuster: boolean): string[] {
  const exakt = idx.statisch.get(f) ?? idx.statisch.get(ohneDoppelpunkt(f));
  if (exakt) {
    return exakt;
  }
  return mitMuster ? idx.muster.filter(([, m]) => m.test(f)).map(([k]) => k) : [];
}

/** Steht der Text von `k` in dieser Sprache unter den gelesenen Fragmenten? */
function stehtDa(idx: Sprachindex, k: string, fragmente: string[]): boolean {
  const w = idx.bundle[k];
  if (w === undefined) {
    return false;
  }
  if (!w.includes("{{")) {
    const soll = normText(w);
    return fragmente.some((f) => f === soll || ohneDoppelpunkt(f) === soll);
  }
  const m = alsMuster(w, 1);
  return m === null || fragmente.some((f) => m.test(f));
}

/**
 * Die Kalibrierung je Ort: die Messung greift wirklich, sonst wäre der Vergleich über einer leeren
 * Menge trivial grün.
 *
 * Nacharbeit 9: Bis hierher stand hier pauschal „mindestens drei Katalogtexte". Gemessen ist, dass
 * das an der Fläche vorbeigeht: die Auditkarte zeigt außer Titel und „Zurück" nur Protokolldaten
 * (5 Fragmente, 2 Katalogtexte), und `flaeche-nutzer` war allein die Nutzerliste. Jetzt verlangt
 * jede DETAILKARTE ihre zwei festen Katalogtexte namentlich — ihren Titel und „Zurück" in DIESER
 * Sprache —, und die Kontenfläche wird als ganze Themenspalte gelesen und braucht weiter drei.
 *
 * Nacharbeit 10: Die Nutzerkarte trägt als Titel den NAMEN des Kontos — ein Datenwert, der in keiner
 * Sprache Katalogtext ist. Für sie gilt statt des Titels: „Zurück" und mindestens drei Katalogtexte.
 */
function kalibrierung(karte: string, l: InhaltLage, sprache: string): string[] {
  const idx = sprachindex(sprache);
  const befunde: string[] = [];
  const katalog = [...new Set(l.fragmente)].filter((f) => schluessel(idx, f, true).length > 0);
  if (typeof l.titel === "string") {
    if (l.titelDaten === true) {
      if (katalog.length < 3) {
        befunde.push(`${karte}: nur ${katalog.length} Katalogtexte neben dem Datentitel`);
      }
    } else if (schluessel(idx, l.titel, false).length === 0) {
      befunde.push(`${karte}: Kartentitel „${l.titel}“ ist kein ${sprache}-Katalogtext`);
    }
    if (!stehtDa(idx, "einst.zurueck", l.fragmente)) {
      befunde.push(`${karte}: „${idx.bundle["einst.zurueck"] ?? "?"}“ (einst.zurueck) fehlt`);
    }
  } else if (katalog.length < 3) {
    befunde.push(`${karte}: nur ${katalog.length} von ${new Set(l.fragmente).size} Katalogtexten`);
  }
  if (l.hilfeKnoepfe > 0 && l.hilfen === 0) {
    befunde.push(`${karte}: „?“ ohne aufgeklappte Hilfen`);
  }
  return befunde;
}

function sprachBefunde(karte: string, de: InhaltLage, ziel: InhaltLage, sprache: string): string[] {
  const iDe = sprachindex("de");
  const iZiel = sprachindex(sprache);
  const befunde: string[] = kalibrierung(karte, ziel, sprache);
  // (1) Jeder deutsch erkannte Katalogtext steht in der Zielsprache als sein Soll-Text da.
  for (const f of new Set(de.fragmente)) {
    const keys = schluessel(iDe, f, true);
    if (keys.length === 0) {
      continue;
    }
    if (!keys.some((k) => stehtDa(iZiel, k, ziel.fragmente))) {
      const soll = keys.slice(0, 3).map((k) => iZiel.bundle[k] ?? "(kein Text)");
      befunde.push(
        `${karte}: „${f}“ (${keys.slice(0, 3).join(" | ")}) fehlt — Soll „${soll.join(" | ")}“`,
      );
    }
  }
  for (const g of new Set(ziel.fragmente)) {
    const zielKeys = schluessel(iZiel, g, false);
    const deKeys = schluessel(iDe, g, false);
    // (2) Kein deutscher Katalogtext bleibt in der Zielsprache stehen.
    if (zielKeys.length === 0 && deKeys.length > 0) {
      befunde.push(`${karte}: „${g}“ ist deutscher Katalogtext (${deKeys[0]})`);
      continue;
    }
    // (3) Was nur die Zielsprache zeigt, muss auch deutsch dastehen.
    if (
      zielKeys.length > 0 &&
      !de.fragmente.includes(g) &&
      !zielKeys.some((k) => stehtDa(iDe, k, de.fragmente))
    ) {
      befunde.push(`${karte}: „${g}“ (${zielKeys[0]}) steht nur in ${sprache}`);
    }
  }
  if (de.hilfeKnoepfe !== ziel.hilfeKnoepfe || de.hilfen !== ziel.hilfen) {
    befunde.push(
      `${karte}: Hilfen de ${de.hilfeKnoepfe}/${de.hilfen}, ${sprache} ${ziel.hilfeKnoepfe}/${ziel.hilfen}`,
    );
  }
  return befunde;
}

interface BehaelterLage {
  laedt: boolean;
  fehlerbox: boolean;
  fehlerText: string;
  stand: string;
  text: string;
}

interface Lage {
  fehler: string | null;
  hatFehlerbox?: boolean;
  fehlerText?: string;
  laedt?: boolean;
  text?: string;
}

let stand: Stand | null = null;

describe("JOB 3065 H6 R3 · Endpunkt-Matrix der Detailkarten — 503 am gebauten Produkt", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("de");
    stand = await starte("/admin", '[data-einst="seite"]');
    if (stand.fehler === null && stand.seite) {
      await stand.seite.waitForFunction(
        fn(`() => document.querySelectorAll('[data-einst="zeile"]').length > 0`),
        undefined,
        { timeout: 30_000 },
      );
    }
  }, 180_000);

  afterAll(async () => {
    if (stand) {
      stand.stoerung = null;
      await beende(stand);
    }
  }, 60_000);

  async function neuLaden(pfad: string, warteAuf: string): Promise<void> {
    const s = stand as Stand;
    await (s.seite as NonNullable<Stand["seite"]>).goto(`${ORIGIN}${pfad}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await (s.seite as NonNullable<Stand["seite"]>).waitForFunction(
      fn("(s) => document.querySelector(s) !== null"),
      warteAuf,
      { timeout: 30_000 },
    );
  }

  /** Der vierteilige Beleg für eine Quelle. */
  async function pruefeQuelle(q: Quelle, seitenPfad: string): Promise<void> {
    const s = stand as Stand;
    expect(s.fehler, "Seite nicht gemountet").toBeNull();

    // 1 — Störung setzen und mit leerem Zwischenspeicher neu aufbauen.
    s.stoerung = q.pfad;
    await neuLaden(seitenPfad, '[data-einst="seite"]');
    const lage = await (s.seite as NonNullable<Stand["seite"]>).evaluate<Lage>(
      fn(OEFFNE_UND_LIES),
      [q.reiter, q.zeile, q.behaelter],
    );
    expect(lage.fehler, `${q.id}: ${lage.fehler}`).toBeNull();

    // 2 — Der Zustand steht da: Wortlaut und Ausweg, kein stehendes Ladewort.
    expect(lage.hatFehlerbox, `${q.id}: keine Fehlerbox in ${q.behaelter}`).toBe(true);
    expect(lage.fehlerText).toContain(t("einst.wert.nichtAbrufbar"));
    expect(lage.fehlerText).toContain(t("loadstate.error.retry"));
    expect(lage.laedt, `${q.id}: daneben steht noch ein Ladewort`).toBe(false);

    // 3 — Der Knopf ruft GENAU DIESEN Pfad wirklich neu ab.
    const vorher = s.abrufe.get(q.pfad) ?? 0;
    expect(
      await (s.seite as NonNullable<Stand["seite"]>).evaluate<boolean>(fn(ERNEUT), q.behaelter),
      `${q.id}: Erneut-Knopf fehlt`,
    ).toBe(true);
    const nachher = s.abrufe.get(q.pfad) ?? 0;
    expect(
      nachher,
      `${q.id}: Abrufe ${q.pfad} vorher ${vorher}, nachher ${nachher}`,
    ).toBeGreaterThan(vorher);

    // 4 — Störung vorbei: derselbe Knopf führt zum echten Inhalt.
    s.stoerung = null;
    await (s.seite as NonNullable<Stand["seite"]>).evaluate<boolean>(fn(ERNEUT), q.behaelter);
    await (s.seite as NonNullable<Stand["seite"]>).waitForFunction(
      fn(
        `([id, text]) => { const k = document.querySelector('[data-testid="' + id + '"]'); return k !== null && (k.textContent || '').includes(text); }`,
      ),
      [q.behaelter, q.inhalt],
      { timeout: 20_000 },
    );
  }

  /** JOB 3140: der spiegelbildliche Beleg für eine NACHRANGIGE Quelle. */
  async function pruefeNachrangig(q: NachrangigeQuelle, seitenPfad: string): Promise<void> {
    const s = stand as Stand;
    expect(s.fehler, "Seite nicht gemountet").toBeNull();

    // 1 — Störung setzen und mit leerem Zwischenspeicher neu aufbauen.
    s.stoerung = q.pfad;
    await neuLaden(seitenPfad, '[data-einst="seite"]');
    const lage = await (s.seite as NonNullable<Stand["seite"]>).evaluate<Lage>(
      fn(OEFFNE_UND_LIES_OHNE_FEHLERWARTEN),
      [q.reiter, q.zeile, q.behaelter, q.zwischen],
    );
    expect(lage.fehler, `${q.id}: ${lage.fehler}`).toBeNull();

    // 2 — Die Karte bleibt benutzbar: keine Fehlerbox, kein stehendes Ladewort, Inhalt da.
    expect(lage.hatFehlerbox, `${q.id}: die nachrangige Quelle hat die Karte gesperrt`).toBe(false);
    expect(lage.laedt, `${q.id}: die Karte hängt im Ladewort`).toBe(false);
    expect(lage.text, `${q.id}: der Inhalt der tragenden Quelle fehlt`).toContain(q.inhalt);

    // 3 — An der Stelle des fehlenden Wertes die SCHWÄCHERE Auskunft, nie die starke.
    expect(lage.text, `${q.id}: die ehrliche Auskunft fehlt`).toContain(q.schwach);
    expect(lage.text, `${q.id}: starke Tatsachenaussage ohne Beleg`).not.toContain(q.verboten);

    // 4 — Störung vorbei: die Karte holt die Namen von selbst nach, ohne Zutun der lesenden Person.
    s.stoerung = null;
    await neuLaden(seitenPfad, '[data-einst="seite"]');
    const heil = await (s.seite as NonNullable<Stand["seite"]>).evaluate<Lage>(
      fn(OEFFNE_UND_LIES_OHNE_FEHLERWARTEN),
      [q.reiter, q.zeile, q.behaelter, q.zwischen],
    );
    expect(heil.fehler, `${q.id} (erholt): ${heil.fehler}`).toBeNull();
    expect(heil.text, `${q.id}: der echte Name fehlt nach der Erholung`).toContain(q.erholt);
    expect(
      heil.text,
      `${q.id}: die schwache Auskunft steht noch da, obwohl die Quelle wieder geht`,
    ).not.toContain(q.schwach);
  }

  for (const quelle of matrixNachrangig()) {
    it(`N · ${quelle.id}`, async () => {
      await pruefeNachrangig(quelle, "/admin");
    }, 120_000);
  }

  /** R-0913: der Beleg für die Schalterquelle (siehe `matrixSchalter`). */
  async function pruefeSchalter(q: SchalterQuelle): Promise<void> {
    const s = stand as Stand;
    expect(s.fehler, "Seite nicht gemountet").toBeNull();
    const seite = s.seite as NonNullable<Stand["seite"]>;
    const argumente = (serverFragen: boolean): unknown[] => [
      q.reiter,
      q.zeile,
      q.behaelter,
      t("adm.seedButton"),
      t("adm.purgeButton"),
      serverFragen,
    ];

    // 1 — Störung auf genau diese Quelle, Seite neu aufbauen, Karte öffnen.
    s.stoerung = q.pfad;
    const vorher = s.abrufe.get(q.pfad) ?? 0;
    await neuLaden("/admin", '[data-einst="seite"]');
    const gestoert = await seite.evaluate<SchalterLage>(fn(SCHALTER_LIES), argumente(false));
    expect(gestoert.fehler, `${q.id}: ${gestoert.fehler}`).toBeNull();
    expect(s.abrufe.get(q.pfad) ?? 0, `${q.id}: die Quelle wurde nie gefragt`).toBeGreaterThan(
      vorher,
    );

    // 2 — Keine Behauptung ohne Auskunft, und die Karte bleibt bedienbar.
    expect(gestoert.fehlerbox, `${q.id}: die Schalterquelle sperrt die Karte`).toBe(false);
    expect(gestoert.ausZeile, `${q.id}: Ausfall als bestätigtes „aus“ ausgegeben`).toBe(false);
    expect(gestoert.ladeknopf, `${q.id}: Ladeknopf ohne bestätigten Schalter`).toBe(false);
    expect(gestoert.entfernen, `${q.id}: Entfernen fehlt bei gestörter Quelle`).toBe(true);

    // 3 — Erholung: die Karte zeigt, was der Server WIRKLICH meldet.
    s.stoerung = null;
    await neuLaden("/admin", '[data-einst="seite"]');
    const heil = await seite.evaluate<SchalterLage>(fn(SCHALTER_LIES), argumente(true));
    expect(heil.fehler, `${q.id} (erholt): ${heil.fehler}`).toBeNull();
    expect(heil.serverAn, `${q.id}: der Server gab keine Auskunft`).not.toBeNull();
    const serverAus = heil.serverAn === false;
    const serverAn = heil.serverAn === true;
    expect(heil.ausZeile, `${q.id}: Aus-Zeile passt nicht zum Server`).toBe(serverAus);
    expect(heil.ladeknopf, `${q.id}: Ladeknopf passt nicht zum Server`).toBe(serverAn);
    expect(heil.entfernen, `${q.id}: Entfernen fehlt nach der Erholung`).toBe(true);
  }

  for (const quelle of matrixSchalter()) {
    it(`SCH · ${quelle.id}`, async () => {
      await pruefeSchalter(quelle);
    }, 120_000);
  }

  it("K · KALIBRIERUNG: ohne Störung gibt es in keiner Karte einen Fehlerzustand", async () => {
    const s = stand as Stand;
    s.stoerung = null;
    await neuLaden("/admin", '[data-einst="seite"]');
    const gefunden = await (s.seite as NonNullable<Stand["seite"]>).evaluate<string[]>(
      fn(`(async ([reiter]) => {
        const warte = async (p, ms = 8000) => { const bis = Date.now() + ms; while (Date.now() < bis) { if (p()) return true; await new Promise((r) => setTimeout(r, 50)); } return p(); };
        const befunde = [];
        for (const label of reiter) {
          const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === label);
          if (!r) { befunde.push('Reiter fehlt: ' + label); continue; }
          r.click();
          await warte(() => r.getAttribute('aria-pressed') === 'true', 4000);
          const zeilen = [...document.querySelectorAll('[data-einst="zeile"]')].filter((z) => z.querySelector('[data-einst="chevron"]'));
          for (let i = 0; i < zeilen.length; i++) {
            const aktuell = [...document.querySelectorAll('[data-einst="zeile"]')].filter((z) => z.querySelector('[data-einst="chevron"]'))[i];
            if (!aktuell) continue;
            const name = (aktuell.textContent || '').replace(/\\s+/g, ' ').trim();
            aktuell.click();
            await warte(() => document.querySelector('[data-einst="detail"]') !== null, 8000);
            await warte(() => document.querySelector('[data-einst="laedt"]') === null, 8000);
            if (document.querySelector('[data-einst="abfrage-fehler"]') !== null) befunde.push(label + ' → ' + name);
            const z = document.querySelector('[data-einst="zurueck"]');
            if (z) z.click();
            await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000);
          }
        }
        return befunde;
      })`),
      // JOB 3337: alle SIEBEN Themen. „Berichte und Analyse" trägt nur Kurzlinks (kein Chevron) —
      // der Griff unten sammelt ausdrücklich nur Zeilen MIT Chevron und geht dort leer durch, was
      // genau richtig ist: ein Kurzlink hat keinen Abfragezustand, über den er lügen könnte.
      [
        [
          t("adm.sec.konten"),
          t("adm.sec.ki"),
          t("adm.sec.quellen"),
          t("adm.sec.vorfuehrdaten"),
          t("adm.sec.sicherheit"),
          t("adm.sec.berichte"),
          t("adm.sec.system"),
        ],
      ],
    );
    expect(gefunden, `Fehlerzustand ohne Störung: ${gefunden.join(" · ")}`).toEqual([]);
  }, 180_000);

  for (const quelle of matrixAdmin()) {
    it(`M · ${quelle.id}`, async () => {
      await pruefeQuelle(quelle, "/admin");
    }, 120_000);
  }

  it("W · dieselbe Seite führt auf /profil", async () => {
    const s = stand as Stand;
    s.stoerung = null;
    await wechsle(s, "/profil", '[data-testid="zeile-wirkung"]');
    expect(s.fehler, "/profil nicht gemountet").toBeNull();
  }, 60_000);

  for (const quelle of matrixProfil()) {
    it(`M · ${quelle.id}`, async () => {
      await pruefeQuelle(quelle, "/profil");
    }, 120_000);
  }

  it("K2 · KALIBRIERUNG: auch die Kontenfläche selbst trägt ohne Störung keinen Fehlerzustand", async () => {
    const s = stand as Stand;
    s.stoerung = null;
    // ADMIN-01: die Kontenfläche hat ihre eigene Adresse; `/admin` ist die Startseite.
    await neuLaden(
      "/admin?bereich=konten",
      '[data-testid="flaeche-nutzer"] button[data-einst="zeile"]',
    );
    const lage = await (s.seite as NonNullable<Stand["seite"]>).evaluate<{
      boxen: number;
      nutzer: number;
    }>(
      fn(`() => {
        const k = document.querySelector('[data-testid="flaeche-nutzer"]');
        return {
          boxen: k ? k.querySelectorAll('[data-einst="abfrage-fehler"]').length : -1,
          nutzer: k ? k.querySelectorAll('button[data-einst="zeile"]').length : -1,
        };
      }`),
    );
    expect(lage.nutzer, "keine Nutzerzeile auf der Kontenfläche").toBeGreaterThan(0);
    expect(lage.boxen, "Fehlerbox auf der Kontenfläche OHNE Störung").toBe(0);
  }, 120_000);

  // ---- Z · die Zustandsfolge je Hüllen-Quelle (siehe Kommentar an `BEHAELTER_OHNE_HUELLE`) -------
  /** Hält die Antworten EINES Pfades zurück, bis `oeffnen()` gerufen wird. */
  let tor: { pfad: string; oeffnen: () => void; offen: Promise<void> } | null = null;

  function torSchliessen(pfad: string): void {
    let oeffnen = (): void => undefined;
    const offen = new Promise<void>((fertig) => {
      oeffnen = fertig;
    });
    tor = { pfad, oeffnen, offen };
    (stand as Stand).antworten.vorAuslieferung = async (url, body) => {
      const aktuell = tor;
      if (aktuell !== null && url.pathname.startsWith(aktuell.pfad)) {
        await aktuell.offen;
      }
      return body;
    };
  }

  async function netz(an: boolean): Promise<void> {
    await (stand?.seite as NonNullable<Stand["seite"]>).evaluate(
      fn(`(an) => window.dispatchEvent(new Event(an ? 'online' : 'offline'))`),
      an,
    );
  }

  async function lage(behaelter: string): Promise<BehaelterLage> {
    const l = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<BehaelterLage | null>(
      fn(BEHAELTER_LAGE),
      behaelter,
    );
    expect(l, `Behälter ${behaelter} fehlt`).not.toBeNull();
    return l as BehaelterLage;
  }

  /** Wartet in Node-Takten auf eine Lage — die Seite wird nur gelesen, nicht belagert. */
  async function warteAufLage(
    behaelter: string,
    pruefung: (l: BehaelterLage) => boolean,
    was: string,
  ): Promise<BehaelterLage> {
    const seite = stand?.seite as NonNullable<Stand["seite"]>;
    let zuletzt: BehaelterLage | null = null;
    for (let i = 0; i < 150; i++) {
      zuletzt = await lage(behaelter);
      if (pruefung(zuletzt)) {
        return zuletzt;
      }
      await seite.waitForTimeout(100);
    }
    throw new Error(`${was} — nie erreicht; zuletzt: ${JSON.stringify(zuletzt)}`);
  }

  async function marke(behaelter: string): Promise<MarkenLage> {
    return (stand?.seite as NonNullable<Stand["seite"]>).evaluate<MarkenLage>(
      fn(MARKE_LIES),
      behaelter,
    );
  }

  /**
   * Wartet, bis der Mithörer den Abruf Nummer `index` mit abgeschlossener Antwort gesehen hat. Je
   * Sekunde geht EIN Fokusereignis an das Fenster — vor Ablauf des Mindestabstands lässt das Modul
   * es ausdrücklich verfallen, danach löst es den regulären Neuabruf aus (oder der Minutentakt tut
   * es zuerst; beides ist der Produktweg).
   */
  async function warteAufMarkenabruf(behaelter: string, index: number): Promise<MarkenAbruf> {
    const seite = stand?.seite as NonNullable<Stand["seite"]>;
    const bis = Date.now() + BRANDING_MINDESTABSTAND_MS + 20_000;
    let zuletzt = await marke(behaelter);
    while (Date.now() < bis) {
      const abruf = zuletzt.abrufe[index];
      if (abruf?.fertig) {
        return abruf;
      }
      await seite.evaluate(fn(FENSTER_FOKUS));
      await seite.waitForTimeout(1000);
      zuletzt = await marke(behaelter);
    }
    throw new Error(
      `Markenabruf ${index + 1} kam nicht — Mitschrift: ${JSON.stringify(zuletzt.abrufe)}`,
    );
  }

  async function pruefeFolge(q: Quelle, seitenPfad: string): Promise<void> {
    const s = stand as Stand;
    const seite = s.seite as NonNullable<Stand["seite"]>;
    expect(s.fehler, "Seite nicht gemountet").toBeNull();
    let markeVorher: { profil: string | null; aktiv: boolean } | null = null;
    try {
      // 1 — Laden.
      s.stoerung = null;
      if (q.standOhneHuelle !== undefined) {
        // Ausgangsstand des Markenfalls: ein bestätigter, SICHTBARER Wert (Profil gewählt, aktiv),
        // damit „erhalten" an konkreten Werten gemessen wird und nicht am leeren Grundzustand.
        const ausgang = await seite.evaluate<{
          status: number;
          daten: { profil: string | null; aktiv: boolean };
        }>(fn(MARKE_SERVER));
        expect(ausgang.status, `${q.id}: Markenstand am Server`).toBe(200);
        markeVorher = { profil: ausgang.daten.profil, aktiv: ausgang.daten.aktiv };
        const gesetzt = await seite.evaluate<{ status: number }>(fn(MARKE_SETZEN), {
          profil: "advisor",
          aktiv: true,
        });
        expect(gesetzt.status, `${q.id}: Ausgangsstand setzen`).toBe(200);
      }
      torSchliessen(q.pfad);
      await neuLaden(seitenPfad, '[data-einst="seite"]');
      const offenFehler = await seite.evaluate<string | null>(fn(OEFFNE_ROH), [
        q.reiter,
        q.zeile,
        q.behaelter,
      ]);
      expect(offenFehler, `${q.id}: ${offenFehler}`).toBeNull();
      // Der Messbereich: die Hülle GENAU DIESER Quelle, wenn die Karte mehrere trägt — sonst die
      // Karte. Gelesen, gedrückt und gezählt wird ausschließlich darin (Nacharbeit 6).
      const bereich = q.huelle ?? q.behaelter;
      await warteAufLage(bereich, (l) => l.laedt && !l.fehlerbox, `${q.id}: Ladezustand`);

      // 2 — offline, solange die Antwort fehlt: die ehrliche Offline-Auskunft samt Ausweg.
      await netz(false);
      const leer = await warteAufLage(bereich, (l) => l.fehlerbox, `${q.id}: offline ohne Daten`);
      expect(leer.fehlerText, `${q.id}: Offline-Wortlaut`).toContain(t("einst.detail.offline"));
      expect(leer.fehlerText).toContain(t("loadstate.error.retry"));

      // 3 — Erholung: online, Antwort frei.
      await netz(true);
      tor?.oeffnen();
      await warteAufLage(
        bereich,
        (l) => l.text.includes(q.inhalt) && !l.laedt && !l.fehlerbox,
        `${q.id}: Inhalt nach der Erholung`,
      );

      if (q.standOhneHuelle !== undefined) {
        // 4 — offline: der bestätigte Stand steht OHNE Hülle da und wird weder geleert noch gemeldet.
        await netz(false);
        await seite.waitForTimeout(500);
        const offline = await marke(q.behaelter);
        expect(offline.text, `${q.id}: Stand verschwand offline`).toContain(q.inhalt);
        expect(offline.fehlerbox, `${q.id}: offline wurde zur Fehlerbox`).toBe(false);
        expect(offline.huelle, `${q.id}: ${q.standOhneHuelle}`).toBe(false);
        await netz(true);

        // 5 — ein ECHTER gescheiterter Neuabruf (BEN, Nacharbeit 8). Die Störung steht, BEVOR der
        //     nächste Abruf zulässig ist; ausgelöst wird er über den Produktweg (Fensterfokus bzw.
        //     der Minutentakt des Moduls), frühestens nach `BRANDING_MINDESTABSTAND_MS`.
        s.stoerung = q.pfad;
        const vorher = s.abrufe.get(q.pfad) ?? 0;
        await seite.evaluate(fn(MARKEN_MITHOERER), q.pfad);
        const bestaetigt = await marke(q.behaelter);
        expect(bestaetigt.abrufe, `${q.id}: Mitschrift beginnt leer`).toEqual([]);
        expect(
          { profil: bestaetigt.profil, aktiv: bestaetigt.aktiv, wurzel: bestaetigt.wurzel },
          `${q.id}: der bestätigte Stand vor der Störung`,
        ).toEqual({ profil: "advisor", aktiv: true, wurzel: "advisor" });
        const gescheitert = await warteAufMarkenabruf(q.behaelter, 0);
        expect(gescheitert.status, `${q.id}: Antwort des gestörten Neuabrufs`).toBe(503);
        expect(s.abrufe.get(q.pfad) ?? 0, `${q.id}: Request am Prüfstand`).toBeGreaterThan(vorher);
        await seite.waitForTimeout(500);
        const erhalten = await marke(q.behaelter);
        expect(
          { profil: erhalten.profil, aktiv: erhalten.aktiv, wurzel: erhalten.wurzel },
          `${q.id}: Markenwerte nach dem gescheiterten Neuabruf`,
        ).toEqual({ profil: "advisor", aktiv: true, wurzel: "advisor" });
        expect(erhalten.text, `${q.id}: Inhalt nach dem gescheiterten Neuabruf`).toContain(
          q.inhalt,
        );
        expect(erhalten.huelle, `${q.id}: ${q.standOhneHuelle}`).toBe(false);

        // 6 — danach eine erfolgreiche Aktualisierung mit GEÄNDERTEM Antwortwert: der Server wird
        //     an der Karte vorbei umgeschaltet (wie durch einen zweiten Admin), die Karte erfährt es
        //     nur über den nächsten regulären Neuabruf.
        s.stoerung = null;
        const umgeschaltet = await seite.evaluate<{ status: number }>(fn(MARKE_SETZEN), {
          profil: "advisor",
          aktiv: false,
        });
        expect(umgeschaltet.status, `${q.id}: Umschalten am Server`).toBe(200);
        const erfolg = await warteAufMarkenabruf(q.behaelter, 1);
        expect(erfolg.status, `${q.id}: Antwort des erfolgreichen Neuabrufs`).toBe(200);
        let nachher = await marke(q.behaelter);
        for (let i = 0; i < 50 && nachher.aktiv !== false; i++) {
          await seite.waitForTimeout(100);
          nachher = await marke(q.behaelter);
        }
        expect(
          { profil: nachher.profil, aktiv: nachher.aktiv, wurzel: nachher.wurzel },
          `${q.id}: Markenwerte nach dem erfolgreichen Neuabruf`,
        ).toEqual({ profil: "advisor", aktiv: false, wurzel: null });
        expect(nachher.fehlerbox, `${q.id}: Fehlerbox nach der Erholung`).toBe(false);
        return;
      }

      // 4 — offline MIT Daten: der Inhalt bleibt, darüber „nicht aktualisiert".
      await netz(false);
      const cache = await warteAufLage(
        bereich,
        (l) => l.stand.includes(t("einst.wert.nichtAktualisiert")),
        `${q.id}: Standzeile offline`,
      );
      expect(cache.text, `${q.id}: der Inhalt verschwand offline`).toContain(q.inhalt);
      expect(cache.fehlerbox, `${q.id}: offline mit Daten wurde zur Fehlerbox`).toBe(false);

      // 5 — gescheiterte Auffrischung: online, 503 auf genau diesen Pfad, „Erneut" in der Standzeile.
      await netz(true);
      s.stoerung = q.pfad;
      const vorher = s.abrufe.get(q.pfad) ?? 0;
      const knoepfe = await seite.evaluate<number>(fn(STAND_ERNEUT), bereich);
      expect(knoepfe, `${q.id}: kein „Erneut“ in der Standzeile`).toBeGreaterThan(0);
      const nachher = s.abrufe.get(q.pfad) ?? 0;
      expect(nachher, `${q.id}: „Erneut“ hat ${q.pfad} nicht abgerufen`).toBeGreaterThan(vorher);
      const gescheitert = await lage(bereich);
      expect(gescheitert.stand, `${q.id}: Markierung nach gescheiterter Auffrischung`).toContain(
        t("einst.wert.nichtAktualisiert"),
      );
      expect(gescheitert.text, `${q.id}: Inhalt nach gescheitertem Abruf`).toContain(q.inhalt);

      // 6 — Erholung: Störung weg, „Erneut" → Markierung weg, Inhalt da.
      s.stoerung = null;
      await seite.evaluate<number>(fn(STAND_ERNEUT), bereich);
      await warteAufLage(
        bereich,
        (l) => l.stand === "" && l.text.includes(q.inhalt) && !l.fehlerbox,
        `${q.id}: Erholung nach der Auffrischung`,
      );
    } finally {
      s.stoerung = null;
      tor?.oeffnen();
      tor = null;
      delete s.antworten.vorAuslieferung;
      await netz(true);
      if (markeVorher !== null) {
        // Den Markenstand der Instanz für die folgenden Fälle zurücknehmen.
        await seite.evaluate(fn(MARKE_SETZEN), markeVorher);
      }
    }
  }

  for (const quelle of matrixAdmin().filter((q) => !BEHAELTER_OHNE_HUELLE.has(q.behaelter))) {
    // Der Markenfall wartet zweimal den Mindestabstand des Moduls ab (60 s, `brandTheme.ts`) — ein
    // regulärer Neuabruf ist vorher ausdrücklich nicht zulässig. Seine Frist deckt genau das.
    const frist =
      quelle.standOhneHuelle !== undefined ? 2 * BRANDING_MINDESTABSTAND_MS + 120_000 : 120_000;
    it(
      `Z · ${quelle.id}`,
      async () => {
        await pruefeFolge(quelle, "/admin");
      },
      frist,
    );
  }

  // BEN, Nacharbeit 8, Befund 2: die Profilquelle durchläuft dieselbe Zustandsfolge.
  for (const quelle of matrixProfil()) {
    it(`Z · ${quelle.id}`, async () => {
      await pruefeFolge(quelle, "/profil");
    }, 120_000);
  }

  // ---- R · die LAUFENDE Auffrischung je Hüllen-Quelle (BEN, Nacharbeit 8, Befund 2) -------------
  //
  //   1  erfolgreicher Stand    Karte offen, Inhalt da, keine Standzeile
  //   2  Frischefrist           `ZAEHLER_FRISCHE_MS` (30 s, `main.tsx`) verstreicht — ohne Auslöser
  //                             holt die Karte nichts und zeigt nichts an
  //   3  laufend                Browserfokus (`visibilitychange` am Fenster, dort hört `focusManager`),
  //                             die Antwort GENAU DIESES PFADES wird zurückgehalten → ruhiges
  //                             „Stand von …" ohne „nicht aktualisiert", Inhalt bleibt, Abruf gezählt
  //   4  Erfolg                 Antwort frei → Standzeile weg, Inhalt da
  //   5  Fehler mit Cache       Frist erneut, Störung (503) auf genau diesen Pfad, Browserfokus →
  //                             „nicht aktualisiert", Inhalt bleibt, keine Fehlerbox, Abruf gezählt
  //   6  Erholung               Störung weg, „Erneut" in der Standzeile → Standzeile weg
  //
  // Kontenfläche und Bereitschaft zeichnen ihre Zustände nicht über die Hülle; ihre laufende
  // Auffrischung messen weiterhin `tests/h6-d1-nutzerdetail-stand/frischefrist-nachholung.test.tsx`
  // und `tests/h6-bereitschaft-stand-nutzerweg/` (beide im PRUEFPLAN ausgewählt). Der Markenstand
  // hat keine Standzeile (JOB 3563); sein Neuabruf ist der Z-Fall oben.
  const FOKUS = `() => {
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    return document.visibilityState;
  }`;

  async function pruefeAuffrischung(q: Quelle, seitenPfad: string): Promise<void> {
    const s = stand as Stand;
    const seite = s.seite as NonNullable<Stand["seite"]>;
    expect(s.fehler, "Seite nicht gemountet").toBeNull();
    const bereich = q.huelle ?? q.behaelter;
    const standWort = t("einst.wert.stand").replace("{{zeit}}", "").trim();
    const nichtAktualisiert = t("einst.wert.nichtAktualisiert");
    try {
      // 1 — erfolgreicher Stand.
      s.stoerung = null;
      await neuLaden(seitenPfad, '[data-einst="seite"]');
      const offenFehler = await seite.evaluate<string | null>(fn(OEFFNE_ROH), [
        q.reiter,
        q.zeile,
        q.behaelter,
      ]);
      expect(offenFehler, `${q.id}: ${offenFehler}`).toBeNull();
      await warteAufLage(
        bereich,
        (l) => l.text.includes(q.inhalt) && !l.laedt && !l.fehlerbox && l.stand === "",
        `${q.id}: erfolgreicher Stand`,
      );

      // 2 — die reguläre Frischefrist verstreicht.
      await seite.waitForTimeout(ZAEHLER_FRISCHE_MS + 2_000);
      const abgelaufen = await lage(bereich);
      expect(abgelaufen.stand, `${q.id}: Standzeile ohne Auslöser`).toBe("");
      expect(abgelaufen.text, `${q.id}: Inhalt nach der Frist`).toContain(q.inhalt);

      // 3 — Browserfokus mit zurückgehaltener Antwort: die laufende Auffrischung.
      torSchliessen(q.pfad);
      const vorher = s.abrufe.get(q.pfad) ?? 0;
      await seite.evaluate(fn(FOKUS));
      const laufend = await warteAufLage(
        bereich,
        (l) => l.stand.includes(standWort),
        `${q.id}: laufende Auffrischung`,
      );
      expect(laufend.stand, `${q.id}: laufend ist keine Störung`).not.toContain(nichtAktualisiert);
      expect(laufend.text, `${q.id}: Inhalt während der Auffrischung`).toContain(q.inhalt);
      expect(laufend.fehlerbox, `${q.id}: Fehlerbox während der Auffrischung`).toBe(false);
      expect(laufend.laedt, `${q.id}: Ladewort statt Stand`).toBe(false);
      expect(s.abrufe.get(q.pfad) ?? 0, `${q.id}: Fokus hat nicht abgerufen`).toBeGreaterThan(
        vorher,
      );

      // 4 — die Antwort kommt: Erfolg.
      tor?.oeffnen();
      tor = null;
      delete s.antworten.vorAuslieferung;
      await warteAufLage(
        bereich,
        (l) => l.stand === "" && l.text.includes(q.inhalt) && !l.fehlerbox && !l.laedt,
        `${q.id}: Erfolg nach der Auffrischung`,
      );

      // 5 — Frist erneut, Störung, Browserfokus: Fehler mit erhaltenem Cache.
      //
      // ADMIN-01 Nacharbeit 2: Die Störung steht AB JETZT, nicht erst nach der Frist. Grund ist der
      // `GeteilterStandNachlader` (`app/GeteilterStandNachlader.tsx`, Basisstand 1322621a): er lädt
      // aktive `["kos"]`- und `["audit"]`-Abfragen im Takt `GETEILTE_LISTEN_TAKT_MS` (60 s) nach.
      // Fiel ein Takt in die Wartezeit, war der Stand beim Fokus wieder frisch — der Fokus rief
      // nichts ab, und die erst danach gesetzte Störung traf keinen Abruf mehr (rot nur für Papierkorb
      // und beide /api/audit-Karten, genau die Quellen dieser Präfixe). Mit früher Störung scheitert
      // jeder Abruf dieses Pfades — der des Takts wie der des Fokus —, der letzte Erfolg bleibt der aus
      // Schritt 4, und nach der Frist ist er sicher abgelaufen. Erwartet wird unverändert dasselbe.
      s.stoerung = q.pfad;
      await seite.waitForTimeout(ZAEHLER_FRISCHE_MS + 2_000);
      const vorFehler = s.abrufe.get(q.pfad) ?? 0;
      await seite.evaluate(fn(FOKUS));
      const gescheitert = await warteAufLage(
        bereich,
        (l) => l.stand.includes(nichtAktualisiert),
        `${q.id}: gescheiterte Auffrischung`,
      );
      expect(gescheitert.text, `${q.id}: Inhalt nach gescheiterter Auffrischung`).toContain(
        q.inhalt,
      );
      expect(gescheitert.fehlerbox, `${q.id}: Cache wurde zur Fehlerbox`).toBe(false);
      expect(s.abrufe.get(q.pfad) ?? 0, `${q.id}: Fokus hat nicht abgerufen`).toBeGreaterThan(
        vorFehler,
      );

      // 6 — Erholung.
      s.stoerung = null;
      await seite.evaluate<number>(fn(STAND_ERNEUT), bereich);
      await warteAufLage(
        bereich,
        (l) => l.stand === "" && l.text.includes(q.inhalt) && !l.fehlerbox,
        `${q.id}: Erholung nach gescheiterter Auffrischung`,
      );
    } finally {
      s.stoerung = null;
      tor?.oeffnen();
      tor = null;
      delete s.antworten.vorAuslieferung;
    }
  }

  const AUFFRISCHUNG: [Quelle, string][] = [
    ...matrixAdmin()
      .filter((q) => !BEHAELTER_OHNE_HUELLE.has(q.behaelter) && q.standOhneHuelle === undefined)
      .map((q): [Quelle, string] => [q, "/admin"]),
    ...matrixProfil().map((q): [Quelle, string] => [q, "/profil"]),
  ];
  for (const [quelle, seitenPfad] of AUFFRISCHUNG) {
    it(
      `R · ${quelle.id}`,
      async () => {
        await pruefeAuffrischung(quelle, seitenPfad);
      },
      2 * ZAEHLER_FRISCHE_MS + 90_000,
    );
  }

  // ---- S · der Fehlerzustand jeder Quelle auch in Englisch und Niederländisch ----------------------
  // Derselbe vierteilige Beleg wie M, mit den Texten DIESER Sprache: Reiter, Fehlerwort, Ausweg und
  // der echte Inhalt der Erholung kommen aus demselben Katalog, aus dem die Oberfläche sie nimmt.
  //
  // Davor und danach je Sprache: die vollständigen sichtbaren Inhalte jeder Karte (BEN, Nacharbeit
  // 8, Befund 3 — siehe `INHALT_LIES`). Deutsch wird zuerst gelesen und ist der Vergleichsstand.
  const inhalte = new Map<string, Map<string, InhaltLage>>();

  interface InhaltsOrt {
    reiter: string;
    zeile: string;
    behaelter: string;
    seitenPfad: string;
    titelDaten?: boolean;
  }

  /**
   * Nacharbeit 10 (BEN, K6/K7): die Detailkarten OHNE eigene Abfragequelle. Sie standen bis hierher
   * nicht im Sprachinventar, weil es nur aus der Endpunkt-Matrix gebildet wurde. Die Zugänge sind
   * dieselben wie in `h6-funktionsinventar.test.ts` (§5a 1, 6, 8, 21, 26); dazu die Rollenkarte
   * hinter den Rollenzeilen der Kontenfläche. Nutzeranlage und Passwortkarte werden nur geöffnet,
   * nichts wird gespeichert. Welche Karten es gibt, sagt der Fall `S-inhalt-V` aus dem Quelltext.
   */
  function zusatzOrte(): InhaltsOrt[] {
    return [
      // ADMIN-16: die beiden früheren Kästen der Importseite, jetzt Karten unter „Vorführdaten".
      {
        reiter: t("adm.sec.vorfuehrdaten"),
        zeile: '[data-testid="zeile-demopakete"]',
        behaelter: "detail-pakete",
        seitenPfad: "/admin",
      },
      {
        reiter: t("adm.sec.vorfuehrdaten"),
        zeile: '[data-testid="zeile-testimporte"]',
        behaelter: "detail-testimporte",
        seitenPfad: "/admin",
      },
      {
        reiter: t("adm.sec.konten"),
        zeile: '[data-testid="flaeche-nutzer"] button[data-einst="zeile"]',
        behaelter: "detail-nutzer",
        seitenPfad: "/admin",
        titelDaten: true,
      },
      {
        reiter: t("adm.sec.konten"),
        zeile: '[data-testid="knopf-nutzer-hinzufuegen"]',
        behaelter: "detail-nutzer-neu",
        seitenPfad: "/admin",
      },
      // ADMIN-06 (produkt:20261009:admin-teams): die Karte „Teams" — Liste, Anlegen und, mit
      // gewähltem Team, dessen Karte im selben Behälter.
      {
        reiter: t("adm.sec.konten"),
        zeile: '[data-testid="zeile-teams"]',
        behaelter: "detail-teams",
        seitenPfad: "/admin",
      },
      {
        reiter: t("adm.sec.konten"),
        zeile: '[data-testid="zeile-ansicht-rolle"]',
        behaelter: "detail-ansicht-rolle",
        seitenPfad: "/admin",
      },
      {
        reiter: t("adm.sec.konten"),
        zeile: '[data-testid="zeile-rolle-experte"]',
        behaelter: "detail-rolle",
        seitenPfad: "/admin",
      },
      {
        reiter: t("adm.sec.sicherheit"),
        zeile: '[data-testid="zeile-datenschutz"]',
        behaelter: "detail-datenschutz",
        seitenPfad: "/admin",
      },
      {
        reiter: "",
        zeile: '[data-testid="zeile-passwort"]',
        behaelter: "detail-passwort",
        seitenPfad: "/profil",
      },
    ];
  }

  /** Jede Detailkarte genau einmal, samt Profil — Reiter in der Sprache dieses Laufs. */
  function inhaltsOrte(): InhaltsOrt[] {
    const orte = new Map<string, InhaltsOrt>();
    const nimm = (o: InhaltsOrt): void => {
      if (!orte.has(o.behaelter)) {
        orte.set(o.behaelter, o);
      }
    };
    for (const q of matrixAdmin()) {
      nimm({ reiter: q.reiter, zeile: q.zeile, behaelter: q.behaelter, seitenPfad: "/admin" });
    }
    for (const o of zusatzOrte()) {
      nimm(o);
    }
    for (const q of matrixProfil()) {
      nimm({ reiter: q.reiter, zeile: q.zeile, behaelter: q.behaelter, seitenPfad: "/profil" });
    }
    // Erst alle Orte der Verwaltung, dann die des Profils: je Seite genau ein Neuaufbau.
    return [...orte.values()].sort(
      (a, b) => Number(a.seitenPfad === "/profil") - Number(b.seitenPfad === "/profil"),
    );
  }

  async function liesInhalte(sprache: string): Promise<Map<string, InhaltLage>> {
    const s = stand as Stand;
    const seite = s.seite as NonNullable<Stand["seite"]>;
    expect(s.fehler, "Seite nicht gemountet").toBeNull();
    s.stoerung = null;
    const gelesen = new Map<string, InhaltLage>();
    let geladen = "";
    for (const ort of inhaltsOrte()) {
      if (ort.seitenPfad !== geladen) {
        await neuLaden(ort.seitenPfad, '[data-einst="seite"]');
        geladen = ort.seitenPfad;
      }
      // Ein Ort ohne Zeile ist eine Fläche, keine Karte: dann die ganze Themenspalte lesen.
      const l = await seite.evaluate<InhaltLage>(fn(INHALT_LIES), [
        ort.reiter,
        ort.zeile,
        ort.behaelter,
        ort.zeile === "" ? '[data-einst="spalte"]' : null,
      ]);
      expect(l.fehler, `${sprache} · ${ort.behaelter}: ${l.fehler}`).toBeNull();
      expect(l.lang, `${sprache} · ${ort.behaelter}: <html lang>`).toBe(sprache);
      gelesen.set(ort.behaelter, { ...l, titelDaten: ort.titelDaten === true });
    }
    return gelesen;
  }

  it("S-inhalt-de · vollständige sichtbare Karteninhalte als Vergleichsstand", async () => {
    await i18n.changeLanguage("de");
    const gelesen = await liesInhalte("de");
    inhalte.set("de", gelesen);
    const befunde: string[] = [];
    for (const [karte, l] of gelesen) {
      // Kalibrierung (siehe `kalibrierung`): die Messung greift in jeder Karte wirklich.
      befunde.push(...kalibrierung(karte, l, "de"));
    }
    expect(befunde, befunde.join("\n")).toEqual([]);
  }, 240_000);

  for (const sprache of ["en", "nl"]) {
    it(`S-${sprache} · die Oberfläche spricht ${sprache}`, async () => {
      await i18n.changeLanguage(sprache);
      const l = await setzeSprache(stand as Stand, sprache, "/admin", '[data-einst="seite"]');
      expect(l.lang).toBe(sprache);
    }, 120_000);
    it(`S-inhalt-${sprache} · jede Karte samt Profil spricht vollständig ${sprache}`, async () => {
      await i18n.changeLanguage(sprache);
      const de = inhalte.get("de");
      expect(de, "der deutsche Vergleichsstand fehlt").toBeDefined();
      const gelesen = await liesInhalte(sprache);
      const befunde: string[] = [];
      for (const [karte, deLage] of de ?? new Map<string, InhaltLage>()) {
        const ziel = gelesen.get(karte);
        if (!ziel) {
          befunde.push(`${karte}: in ${sprache} nicht gelesen`);
          continue;
        }
        befunde.push(...sprachBefunde(karte, deLage, ziel, sprache));
      }
      expect(befunde, befunde.join("\n")).toEqual([]);
    }, 240_000);
    for (let i = 0; i < matrixAdmin().length; i++) {
      it(`S-${sprache} · Quelle ${i + 1}`, async () => {
        await i18n.changeLanguage(sprache);
        const quelle = matrixAdmin()[i] as Quelle;
        await pruefeQuelle(quelle, "/admin");
      }, 120_000);
    }
  }

  it("S-de · zurück auf Deutsch für die übrigen Fälle", async () => {
    await i18n.changeLanguage("de");
    const l = await setzeSprache(stand as Stand, "de", "/admin", '[data-einst="seite"]');
    expect(l.lang).toBe("de");
  }, 120_000);

  // ================================================================================================
  // V · VOLLZÄHLIGKEIT — JOB 3065 R4, BENs Korrekturpflicht 2.
  // ================================================================================================
  //
  // BENs Befund an Runde 3: die Matrix war eine HANDGESCHRIEBENE Liste und behauptete „18 von 18",
  // obwohl `/api/users` nie darin stand. Eine Liste, die von Hand gepflegt wird, kann genau das
  // wieder passieren lassen — der nächste neue `useQuery` in einer dieser Seiten fiele erneut
  // durchs Raster.
  //
  // Deshalb wird die Vollzähligkeit jetzt nicht mehr behauptet, sondern ABGELEITET: der Fall liest
  // die sechs Seiten der Einstellungen und des Profils, sammelt JEDE Abfragequelle (`queryFn:` und
  // jeden aus `../api/hooks` importierten Haken) und verlangt für jede einen Eintrag in der Matrix.
  // Eine neue Quelle ohne Matrix-Fall macht diesen Fall rot, bevor sie ungemessen live gehen kann.
  const SEITEN = [
    "apps/web/src/pages/Admin.tsx",
    "apps/web/src/pages/AdminKontenDetails.tsx",
    "apps/web/src/pages/AdminKiDetails.tsx",
    "apps/web/src/pages/AdminDatenDetails.tsx",
    "apps/web/src/pages/AdminSicherheitDetails.tsx",
    "apps/web/src/pages/Profile.tsx",
  ];

  /**
   * Abfragequelle → der Pfad, den sie wirklich abruft (`apps/web/src/api/endpoints.ts`,
   * `apps/web/src/api/hooks.ts`). Dass diese Zuordnung stimmt, belegt die Matrix selbst: ihr
   * Schritt 3 zählt die ECHTEN Abrufe genau dieses Pfades.
   */
  const QUELLE_PFAD: Record<string, string> = {
    "endpoints.reasoner.config": "/api/reasoner/config",
    "endpoints.reasoner.assistPresets": "/api/reasoner/assist-presets",
    "endpoints.validation.settings": "/api/validation/settings",
    "endpoints.uploadLimits.get": "/api/upload-limits",
    "endpoints.external.policy": "/api/external/policy",
    "endpoints.duplicates.settings": "/api/duplicates/settings",
    "endpoints.admin.demoStatus": "/api/admin/demo-seed",
    // JOB 3636: die Übersicht der Demopakete. Derselbe Weg wie im Demopaket-Kasten auf `/import`
    // (`components/ExamplePackages.tsx`) und derselbe Vorratsschlüssel — die Verwaltungskarte hält
    // keine zweite Kopie dieser Liste.
    "endpoints.admin.demoPackages.list": "/api/admin/demo-packages",
    // JOB 3511: der zentrale Markenstand. Er kommt NICHT über `endpoints`, sondern über
    // `lib/brandTheme.ts` — dort wohnt die eine Quelle der Firmen-CI samt Drosselung und
    // 404-Unterscheidung, und ein zweiter Einstieg über `endpoints` wäre ein zweiter Weg dorthin.
    //
    // JOB 3563 NACHGEFÜHRT: Der Griff heißt jetzt `holeMarkeFuerFlaeche` statt `ladeBranding`.
    // Derselbe Endpunkt, derselbe Weg — die Karte ruft `ladeBranding` nur nicht mehr SELBST, weil
    // sie sonst einen zweiten Markenstand neben `lib/brandTheme.ts` hielte (BEN, JOB 3511 R2
    // `ben.md:31`). `holeMarkeFuerFlaeche` legt die Antwort ins Modul und reicht Fehler weiter,
    // damit dieser Matrix-Fall seinen Fehlerzustand samt „Erneut versuchen" behält.
    holeMarkeFuerFlaeche: "/api/branding",
    "endpoints.admin.factoryResetStatus": "/api/admin/factory-reset",
    // JOB 4025 (KUNDENBETRIEB-BACKUP): die Sicherungsauskunft. Die Zeile im Reiter „System" und die
    // Karte dahinter fahren DENSELBEN Abfrageschlüssel (`SICHERUNGEN_KEY`) — ein Abruf, eine
    // Wahrheit. Gestört wird deshalb genau ein Pfad, und er trägt beide.
    "endpoints.admin.sicherungen": "/api/admin/sicherungen",
    "endpoints.ko.trash": "/api/kos/trash",
    useUsers: "/api/users",
    useAudit: "/api/audit",
    // JOB 3140 (UX-11): die NACHRANGIGE Quelle des Prüfprotokolls — die Namen zu den Kennungen.
    // Bewusst `/api/directory` (jeder Angemeldete) und nicht `/api/users` (Admin): das Protokoll
    // steht auch einem Controller offen, und die Fläche darf ihm nicht wegbrechen. Ihr Fall in
    // dieser Matrix ist `N · Prüfprotokoll · /api/directory` — spiegelbildlich zu den tragenden
    // Quellen, weil ihr Ausfall ausdrücklich KEINEN Fehlerzustand erzeugen darf.
    useDirectory: "/api/directory",
    useAnalytics: "/api/analytics",
    useValidationBoard: "/api/validation/board",
    useMyImpact: "/api/me/impact",
    // R-0562: der Stand der eigenen Zwei-Faktor-Anmeldung — Zeile und Karte auf `/profil` teilen
    // denselben Abfrageschlüssel, gestört wird also genau ein Pfad.
    "authApi.secondFactorStatus": "/api/auth/second-factor",
    // R-0913: die Betriebsschalter der Demodatenkarte — Fall `SCH · Demodaten · /api/features`.
    useFeatures: "/api/features",
  };

  /** Jede Abfragequelle, die in den sechs Seiten wirklich vorkommt — samt ihrer Datei. */
  function quellenAusQuelltext(): { datei: string; quelle: string }[] {
    const gefunden: { datei: string; quelle: string }[] = [];
    for (const rel of SEITEN) {
      const text = readFileSync(join(WURZEL, rel), "utf8");
      for (const m of text.matchAll(/queryFn:\s*([A-Za-z0-9_$.]+)/g)) {
        gefunden.push({ datei: rel, quelle: m[1] ?? "" });
      }
      const importiert = /import\s*\{([^}]*)\}\s*from\s*"\.\.\/api\/hooks"/.exec(text)?.[1] ?? "";
      for (const name of importiert.split(",").map((s) => s.trim())) {
        if (name.startsWith("use")) {
          gefunden.push({ datei: rel, quelle: name });
        }
      }
    }
    return gefunden;
  }

  it("V · VOLLZÄHLIGKEIT: jede Abfragequelle der sechs Seiten hat einen Fall in dieser Matrix", () => {
    const gefunden = quellenAusQuelltext();
    // Kalibrierung: der Griff greift überhaupt etwas — sonst wäre die Zusage über einer leeren
    // Menge trivial grün (genau die Klasse Fehler, die BEN in Runde 3 gefunden hat).
    expect(
      gefunden.length,
      "keine Abfragequelle gefunden — der Griff greift ins Leere",
    ).toBeGreaterThan(19);
    expect(
      new Set(gefunden.map((g) => g.datei)).size,
      "nicht jede der sechs Seiten wurde gelesen",
    ).toBe(SEITEN.length);

    // (1) Jede gefundene Quelle ist benannt — eine unbekannte ist ein ungemessener Fehlerweg.
    const unbekannt = gefunden
      .filter((g) => QUELLE_PFAD[g.quelle] === undefined)
      .map((g) => `${g.datei}: ${g.quelle}`);
    expect(unbekannt, `Abfragequelle ohne Pfad-Zuordnung: ${unbekannt.join(" · ")}`).toEqual([]);

    // (2) Jeder daraus abgeleitete Pfad steht als Fall in der Matrix.
    // JOB 3140: die nachrangigen Quellen zählen mit — sie haben einen eigenen, spiegelbildlichen
    // Fall (`N · …`), aber sie sind genauso wenig ungemessen erlaubt wie eine tragende.
    const inMatrix = new Set(
      [...matrixAdmin(), ...matrixNachrangig(), ...matrixProfil(), ...matrixSchalter()].map(
        (q) => q.pfad,
      ),
    );
    const ohneFall = [...new Set(gefunden.map((g) => QUELLE_PFAD[g.quelle] ?? ""))].filter(
      (p) => p !== "" && !inMatrix.has(p),
    );
    expect(ohneFall, `Endpunkt ohne Matrix-Fall: ${ohneFall.join(" · ")}`).toEqual([]);

    // (3) Und umgekehrt: kein Matrix-Fall über einen Pfad, den keine dieser Seiten abruft — sonst
    //     könnte die Matrix mit Karteileichen „vollständig" aussehen.
    const abgerufen = new Set(gefunden.map((g) => QUELLE_PFAD[g.quelle] ?? ""));
    const karteileichen = [...inMatrix].filter((p) => !abgerufen.has(p));
    expect(karteileichen, `Matrix-Fall ohne Quelle: ${karteileichen.join(" · ")}`).toEqual([]);

    // (4) Und die Zuordnungstabelle selbst rostet nicht: jeder ihrer Einträge wird gebraucht.
    const benutzt = new Set(gefunden.map((g) => g.quelle));
    const ungenutzt = Object.keys(QUELLE_PFAD).filter((k) => !benutzt.has(k));
    expect(ungenutzt, `Zuordnung ohne Aufrufer: ${ungenutzt.join(" · ")}`).toEqual([]);

    console.info(
      `JOB 3065 H6 R4 · Vollzähligkeit: ${gefunden.length} Quellen in ${SEITEN.length} Seiten → ${abgerufen.size} Endpunkte → ${inMatrix.size} Matrix-Pfade`,
    );
  });

  // Nacharbeit 10 (BEN, K6/K7): die Kartenmenge der Sprachfälle wird nicht behauptet, sondern gegen
  // das Detailinventar des Quelltexts abgeglichen — jede `Detailkarte` der Verwaltung und des Profils
  // (`testId="detail-…"`), unabhängig davon, ob sie eine eigene Abfragequelle hat.
  it("S-inhalt-V · das Sprachinventar deckt jede Detailkarte von Verwaltung und Profil", () => {
    const seitenDir = join(WURZEL, "apps/web/src/pages");
    const dateien = readdirSync(seitenDir).filter(
      (d) => (d.startsWith("Admin") && d.endsWith(".tsx")) || d === "Profile.tsx",
    );
    const karten = new Set<string>();
    for (const d of dateien) {
      const text = readFileSync(join(seitenDir, d), "utf8");
      for (const m of text.matchAll(/testId="(detail-[a-z0-9-]+)"/g)) {
        karten.add(m[1] ?? "");
      }
    }
    // Kalibrierung: der Griff findet die bekannten Karten überhaupt.
    expect(karten.size, `Detailkarten im Quelltext: ${[...karten].join(" · ")}`).toBeGreaterThan(
      15,
    );
    const imInventar = new Set(inhaltsOrte().map((o) => o.behaelter));
    const fehlt = [...karten].filter((k) => !imInventar.has(k)).sort();
    expect(fehlt, `Detailkarte ohne Sprachfall: ${fehlt.join(" · ")}`).toEqual([]);
    console.info(
      `Nacharbeit 10 · Sprachinventar: ${karten.size} Detailkarten aus ${dateien.length} Seiten`,
    );
  });

  it("F · die Seite hat dabei keinen Fehler geworfen (pageerror)", () => {
    expect(stand?.seitenfehler).toEqual([]);
  });
});
