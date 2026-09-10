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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ORIGIN, type Stand, WURZEL, beende, fn, starte, wechsle } from "./h6-chromium";

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
    },
    {
      id: "Upload-Grenzen · /api/upload-limits",
      pfad: "/api/upload-limits",
      reiter: t("adm.sec.ki"),
      zeile: '[data-testid="zeile-ki-grenzen"]',
      behaelter: "detail-ki-grenzen",
      inhalt: t("adm.upload.save"),
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
  ];
}

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
    await neuLaden("/admin", '[data-testid="flaeche-nutzer"] button[data-einst="zeile"]');
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
    // JOB 3511: der zentrale Markenstand. Er kommt NICHT über `endpoints`, sondern über
    // `lib/brandTheme.ts` — dort wohnt die eine Quelle der Firmen-CI samt Drosselung und
    // 404-Unterscheidung, und ein zweiter Einstieg über `endpoints` wäre ein zweiter Weg dorthin.
    ladeBranding: "/api/branding",
    "endpoints.admin.factoryResetStatus": "/api/admin/factory-reset",
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
      [...matrixAdmin(), ...matrixNachrangig(), ...matrixProfil()].map((q) => q.pfad),
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

  it("F · die Seite hat dabei keinen Fehler geworfen (pageerror)", () => {
    expect(stand?.seitenfehler).toEqual([]);
  });
});
