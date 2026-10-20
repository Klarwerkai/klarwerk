import type { ArbeitswegBeobachtung, VormachenHost, VormachenVorgang } from "./vormachen";

// ================================================================================================
// produkt:20261011:peter-p06 — WELCHER VORHANDENE ARBEITSWEG IST WELCHER VORGANG? (P06-AC01/AC04)
// ================================================================================================
//
// Beim Vormachen schreibt der Server mit, was die Person TATSÄCHLICH über die vorhandenen Wege tut —
// nicht, was ein Client behauptet. Diese Datei ist die eine Zuordnung „Route + Host → Vorgang" und
// leitet daraus die zweckgebundene Beschreibung ab. Sie wird nach einer ERFOLGREICHEN Antwort (2xx)
// gefragt (`build-app.ts`, onResponse — je Anfrage genau einmal; den gesendeten Rumpf merkt sich
// onSend) und nur, wenn überhaupt irgendwo eine Lernsitzung offen ist; ob
// DIESE Person gerade lernt, ob Host und Vorgang gewählt sind und ob der Lernzustand in diesem
// Client sichtbar ist, entscheidet danach allein der Dienst (`vormachen.ts`, `nimmAn`).
//
// DER HOST einer Anfrage, fail-closed:
//   · Word-Kanal: die Bindungskopfzeile der Klara-Sitzung (`x-klara-session`, Taskpane
//     `klaraS4Header`), die Herkunftsangabe `origin: "word_addin"` im Entwurf (Taskpane
//     `prepareWordDraftRequest`) oder eine Herkunftsseite unter `/word-addin/`.
//   · Klarwerk-Web: der ausdrückliche Kanal des Web-API-Clients (`x-klarwerk-host`) oder
//     eine Herkunftsseite (`referer`) außerhalb von `/word-addin/`. Der normale Browser
//     sendet wegen der bestehenden Referrer-Policy keine solche Herkunftsseite.
//   · Sonst unbestimmt (`null`) — dann wird NIE mitgeschrieben, nur als fremder Host gezählt.
//
// DIE BESCHREIBUNG (Ben zu Nacharbeit 4: „feste Vorgangsnamen statt der vorgemachten Aufgabe"):
//   · was getan wurde („Entwurf speichern"),
//   · woran: der Zielentwurf — der Dienst macht daraus „Entwurf aus Schritt n",
//   · welche Angaben dabei gesetzt wurden: ORDNUNGSANGABEN mit Wert (Art, Kategorie,
//     Vertraulichkeit, Fachgebiet — sie bestimmen die Aufgabe und sind keine Inhalte) und
//     INHALTSFELDER nur beim Namen (Titel, Aussage, Inhalt). Der Inhalt selbst wird nie
//     übernommen; als Rohwert bleibt höchstens Titel bzw. Frage, gekürzt, nur in der Lernsitzung.

export interface Anfrage {
  readonly methode: string;
  /** Die registrierte Route (`request.routeOptions.url`), nicht die konkrete Adresse. */
  readonly route: string | undefined;
  readonly kopf: Readonly<Record<string, string | string[] | undefined>>;
  readonly rumpf: unknown;
  /** Die Pfadparameter der Route (`request.params`). */
  readonly parameter?: unknown;
  /** Die gesendete, serialisierte Antwort (in onSend gemerkt), daraus die Kennung eines neuen Entwurfs. */
  readonly antwort?: unknown;
}

interface Weg {
  readonly methode: string;
  readonly route: string;
  /** Der Vorgang je Host; fehlt ein Host, ist der Weg dort kein wählbarer Vorgang. */
  readonly vorgang: Partial<Record<VormachenHost, VormachenVorgang>>;
  readonly beschreibung: Readonly<Record<VormachenHost, string>>;
  /** Welches Rumpffeld als Rohwert dient (Titel, Frage, Auftragstext). */
  readonly rohwertFeld: string | null;
  /** Woher der Zielentwurf kommt: neu angelegt (Antwort) oder der Pfadparameter `:id`. */
  readonly ziel: "neu" | "pfad" | null;
  /** Ob die gesetzten Entwurfsangaben zur Beschreibung gehören. */
  readonly angaben: boolean;
  /** BPA-06: ob die gesetzten Entwurfsfelder mit Wert als Rohdaten der Lernsitzung mitgehen. */
  readonly felder?: boolean;
  /**
   * EQF-06-K02: ein Lesen als Quelle — Kennung (Pfad) und Fassung (Antwort) des Wissensobjekts gehen
   * als Rohdaten mit; Titel und Inhalt nie.
   */
  readonly quelle?: boolean;
}

/** Die Zuordnung. Jeder wählbare Vorgang mit Quelle `server` steht hier mindestens einmal. */
export const ARBEITSWEGE: readonly Weg[] = [
  {
    methode: "POST",
    route: "/api/drafts",
    vorgang: { word: "word_auswahl_uebernehmen", klarwerk_web: "entwurf_anlegen" },
    beschreibung: {
      word: "Markierten Text aus Word als Entwurf übernehmen",
      klarwerk_web: "Entwurf anlegen",
    },
    rohwertFeld: "title",
    ziel: "neu",
    angaben: true,
    felder: true,
  },
  {
    methode: "POST",
    route: "/api/drafts/from-docx",
    vorgang: { word: "word_dokument_uebernehmen" },
    beschreibung: {
      word: "Ganzes Word-Dokument als Entwurf übernehmen",
      klarwerk_web: "Dokument als Entwurf übernehmen",
    },
    rohwertFeld: "title",
    ziel: "neu",
    angaben: true,
  },
  {
    methode: "PUT",
    route: "/api/drafts/:id",
    vorgang: { klarwerk_web: "entwurf_speichern" },
    beschreibung: { word: "Entwurf speichern", klarwerk_web: "Entwurf speichern" },
    rohwertFeld: "title",
    ziel: "pfad",
    angaben: true,
  },
  {
    methode: "POST",
    route: "/api/drafts/:id/promote",
    vorgang: { klarwerk_web: "zur_pruefung_einreichen" },
    beschreibung: {
      word: "Entwurf zur Prüfung einreichen",
      klarwerk_web: "Entwurf zur Prüfung einreichen",
    },
    rohwertFeld: null,
    ziel: "pfad",
    angaben: false,
  },
  {
    methode: "POST",
    route: "/api/ask",
    vorgang: { word: "word_frage", klarwerk_web: "frage_stellen" },
    beschreibung: {
      word: "In Word eine Frage an das Firmenwissen stellen",
      klarwerk_web: "Eine Frage an das Firmenwissen stellen",
    },
    rohwertFeld: "question",
    ziel: null,
    angaben: false,
  },
  {
    methode: "POST",
    route: "/api/klara/sessions/:sessionId/execute",
    vorgang: { word: "word_frage" },
    beschreibung: {
      word: "In Word eine Frage an das Firmenwissen stellen",
      klarwerk_web: "Eine Frage an das Firmenwissen stellen",
    },
    rohwertFeld: "question",
    ziel: null,
    angaben: false,
  },
  {
    methode: "POST",
    route: "/api/klara/sessions/:sessionId/zuruf",
    vorgang: { word: "word_formulierung" },
    beschreibung: {
      word: "Formulierungsvorschlag für das Word-Dokument anfordern",
      klarwerk_web: "Formulierungsvorschlag anfordern",
    },
    rohwertFeld: "text",
    ziel: null,
    angaben: false,
  },
  // EQF-06-K02: ein Wissensobjekt öffnen und als Quelle lesen — nur das Lesen, das der vorhandene
  // Leseweg mit den Rechten der Person beantwortet hat (2xx: sichtbar).
  {
    methode: "GET",
    route: "/api/kos/:id",
    vorgang: { klarwerk_web: "quelle_lesen" },
    beschreibung: {
      word: "Wissensobjekt als Quelle lesen",
      klarwerk_web: "Wissensobjekt als Quelle lesen",
    },
    rohwertFeld: null,
    ziel: null,
    angaben: false,
    quelle: true,
  },
];

/** Ordnungsangaben: mit Wert übernommen — sie bestimmen, WAS die Aufgabe ist. */
const ORDNUNGSANGABEN: readonly (readonly [string, string])[] = [
  ["type", "Art"],
  ["category", "Kategorie"],
  ["confidentiality", "Vertraulichkeit"],
  ["domain", "Fachgebiet"],
];
/** Inhaltsfelder: nur beim Namen — ihr Wortlaut ist Inhalt und gehört nicht in die Routine. */
const INHALTSFELDER: readonly (readonly [string, string])[] = [
  ["title", "Titel"],
  ["statement", "Aussage"],
  ["bodyHtml", "Inhalt"],
];

const ROHWERT_MAX = 200;
const WERT_MAX = 60;

function kopfwert(kopf: Anfrage["kopf"], name: string): string | null {
  const wert = kopf[name];
  const eins = Array.isArray(wert) ? wert[0] : wert;
  return typeof eins === "string" && eins.trim() !== "" ? eins.trim() : null;
}

function feld(quelle: unknown, name: string): unknown {
  return quelle && typeof quelle === "object" && !Array.isArray(quelle)
    ? (quelle as Record<string, unknown>)[name]
    : undefined;
}

function gesetzt(wert: unknown): wert is string {
  return typeof wert === "string" && wert.trim() !== "";
}

/** Die gesetzten Angaben eines Entwurfsrumpfs — Ordnungsangaben mit Wert, Inhalt nur beim Namen. */
export function gesetzteAngaben(rumpf: unknown): string[] {
  const teile: string[] = [];
  for (const [schluessel, name] of ORDNUNGSANGABEN) {
    const wert = feld(rumpf, schluessel);
    if (gesetzt(wert)) {
      teile.push(`${name} „${wert.trim().slice(0, WERT_MAX)}“`);
    }
  }
  for (const [schluessel, name] of INHALTSFELDER) {
    if (gesetzt(feld(rumpf, schluessel))) {
      teile.push(name);
    }
  }
  return teile;
}

/** BPA-06: die Entwurfsfelder, die eine Ableitung aus mehreren Vorführungen vergleicht. */
const ROHFELDER = ["title", "statement", "type", "category", "confidentiality", "domain"] as const;

/**
 * BPA-06 — die gesetzten Entwurfsfelder MIT Wert, gekürzt, und die Prüfer (Empfänger) als
 * sortierte Kennungsliste. Das sind Rohdaten: sie bleiben in der Lernsitzung (`vormachen.ts`) und
 * dienen nur dem Vergleich der Vorführungen; in die Routine gelangt keiner dieser Inhaltswerte.
 */
export function rohfelder(rumpf: unknown): Record<string, string> {
  const felder: Record<string, string> = {};
  for (const name of ROHFELDER) {
    const wert = feld(rumpf, name);
    if (gesetzt(wert)) {
      felder[name] = wert.trim().slice(0, ROHWERT_MAX);
    }
  }
  const pruefer = feld(rumpf, "reviewerIds");
  if (Array.isArray(pruefer)) {
    const kennungen = [...new Set(pruefer.filter(gesetzt).map((p) => p.trim()))].sort();
    if (kennungen.length > 0) {
      felder.reviewerIds = kennungen.join(", ").slice(0, ROHWERT_MAX);
    }
  }
  return felder;
}

/** Die Antwort als Objekt — onSend liefert sie serialisiert. */
function antwortObjekt(antwort: unknown): unknown {
  if (typeof antwort !== "string") {
    return antwort;
  }
  try {
    return JSON.parse(antwort);
  } catch {
    return undefined;
  }
}

/** Der Host einer Anfrage — oder `null`, wenn er nicht sicher bestimmbar ist. */
export function hostDerAnfrage(kopf: Anfrage["kopf"], rumpf: unknown): VormachenHost | null {
  if (kopfwert(kopf, "x-klara-session") !== null || feld(rumpf, "origin") === "word_addin") {
    return "word";
  }
  if (kopfwert(kopf, "x-klarwerk-host") === "klarwerk_web") {
    return "klarwerk_web";
  }
  const herkunft = kopfwert(kopf, "referer");
  if (herkunft === null) {
    return null;
  }
  let pfad: string;
  try {
    pfad = new URL(herkunft).pathname;
  } catch {
    return null;
  }
  return pfad.startsWith("/word-addin/") ? "word" : "klarwerk_web";
}

/** Die Beobachtung zu einer beantworteten Anfrage — `null`, wenn sie kein Arbeitsweg ist. */
export function arbeitswegBeobachtung(a: Anfrage): ArbeitswegBeobachtung | null {
  const weg = ARBEITSWEGE.find((w) => w.methode === a.methode && w.route === a.route);
  if (!weg) {
    return null;
  }
  const host = hostDerAnfrage(a.kopf, a.rumpf);
  const roh = weg.rohwertFeld === null ? undefined : feld(a.rumpf, weg.rohwertFeld);
  const rohwert = gesetzt(roh) ? roh.trim().slice(0, ROHWERT_MAX) : null;
  const entwurfId =
    weg.ziel === "neu"
      ? feld(antwortObjekt(a.antwort), "id")
      : weg.ziel === "pfad"
        ? feld(a.parameter, "id")
        : undefined;
  return {
    host,
    vorgang: host === null ? null : (weg.vorgang[host] ?? null),
    beschreibung: weg.beschreibung[host ?? "klarwerk_web"],
    angaben: weg.angaben ? gesetzteAngaben(a.rumpf) : [],
    ziel: gesetzt(entwurfId) ? { entwurfId, neu: weg.ziel === "neu" } : null,
    rohwert,
    ...(weg.felder ? { felder: rohfelder(a.rumpf) } : {}),
    ...(weg.quelle ? { felder: quellfelder(a.parameter, a.antwort) } : {}),
  };
}

/**
 * EQF-06-K02 — das Originalereignis einer gelesenen Quelle: Kennung aus dem Pfad, Fassung aus der
 * Antwort des Lesewegs. Rohdaten der Lernsitzung wie `rohfelder`.
 */
function quellfelder(parameter: unknown, antwort: unknown): Record<string, string> {
  const id = feld(parameter, "id");
  const version = feld(antwortObjekt(antwort), "version");
  return {
    ...(gesetzt(id) ? { quelle: id.trim().slice(0, ROHWERT_MAX) } : {}),
    ...(typeof version === "number" ? { fassung: String(version) } : {}),
  };
}
