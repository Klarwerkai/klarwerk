// ==================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL (produkt:20261007:arbeitswege-objekt) — DER EINE OBJEKTBEZUG.
// ==================================================================================================
//
// DER BEFUND: Einreichen führte auf `/validierung` OHNE Kennung, und die Prüffläche wählte dann den
// ersten Eintrag ihrer Liste — bei anderer Reihenfolge einen fremden Artikel. Der Fragen-Knopf der
// Lesefläche trug zwar `ko=<id>`, aber keine Fassung, und `/fragen` las den Marker gar nicht; Klara
// kannte nur die Seite, nicht den Artikel.
//
// DIE REGEL: Der Objektbezug steht in der ADRESSE — `ko=<id>` und `fassung=<n>` — und nirgends
// sonst. Damit ist er nach Zurücknavigation und Neuladen derselbe, und Prüfen, Lesen, Fragen und
// Klara lesen ihn aus DERSELBEN Quelle: dieser Datei. Es entsteht kein zweiter Speicher, der vom
// Ort abweichen könnte.
//
// `ko` ist DERSELBE Parametername wie der Herkunftsmarker der Lesefläche
// (`components/bibliothek/fragen.ts`, `FRAGEN_KO_PARAM`) — bestehende Verweise bleiben gültig.

export const OBJEKT_PARAM = "ko";
export const FASSUNG_PARAM = "fassung";
/** Die Auswahl der Bibliothek (`BibliothekFlaeche.tsx`, `EINTRAG_PARAM`). */
const BIBLIOTHEK_EINTRAG_PARAM = "eintrag";

export interface Objektbezug {
  readonly koId: string;
  /** Die Inhaltsfassung (`KnowledgeObject.version`). `null` = die Adresse nennt keine. */
  readonly fassung: number | null;
}

/** Wo der Bezug herkommt — Klara nennt damit die Seite, auf der er gilt. */
export type ObjektbezugSeite = "lesen" | "bibliothek" | "pruefen" | "fragen";

export interface ObjektbezugAuskunft {
  readonly seite: ObjektbezugSeite;
  readonly bezug: Objektbezug;
}

function kennung(wert: string | null | undefined): string | null {
  const id = (wert ?? "").trim();
  return id.length > 0 ? id : null;
}

/** Eine Fassung ist eine ganze Zahl ab 1; alles andere ist „keine genannt", nie geraten. */
export function leseFassung(params: URLSearchParams): number | null {
  const roh = (params.get(FASSUNG_PARAM) ?? "").trim();
  if (!/^\d+$/.test(roh)) {
    return null;
  }
  const n = Number(roh);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** Der Bezug aus `ko`/`fassung` der Abfrage, oder `null`, wenn keine Kennung genannt ist. */
export function leseObjektbezug(params: URLSearchParams): Objektbezug | null {
  const koId = kennung(params.get(OBJEKT_PARAM));
  return koId ? { koId, fassung: leseFassung(params) } : null;
}

/**
 * Der Bezug, der an einem ORT gilt — Pfad plus Abfrage, genau wie die Adresszeile ihn zeigt.
 * `/wissen/:id` trägt die Kennung im Pfad, die Bibliothek ihre Auswahl in `eintrag`, Prüfen und
 * Fragen in `ko`. Andere Seiten haben keinen Artikelbezug: `null`, nicht der zuletzt gesehene.
 */
export function objektbezugAm(pathname: string, search: string): ObjektbezugAuskunft | null {
  const params = new URLSearchParams(search);
  const lesen = /^\/wissen\/([^/]+)\/?$/.exec(pathname);
  if (lesen) {
    const koId = kennung(decodeURIComponent(lesen[1] ?? ""));
    return koId ? { seite: "lesen", bezug: { koId, fassung: leseFassung(params) } } : null;
  }
  if (pathname === "/bibliothek") {
    const koId = kennung(params.get(BIBLIOTHEK_EINTRAG_PARAM));
    return koId ? { seite: "bibliothek", bezug: { koId, fassung: leseFassung(params) } } : null;
  }
  if (pathname === "/validierung" || pathname === "/fragen") {
    const bezug = leseObjektbezug(params);
    return bezug ? { seite: pathname === "/fragen" ? "fragen" : "pruefen", bezug } : null;
  }
  return null;
}

/**
 * Schreibt den Bezug in eine Abfrage (neues Objekt). `null` entfernt beide Werte; eine fehlende
 * Fassung entfernt nur die Fassung — eine alte Zahl bliebe sonst am neuen Artikel stehen.
 */
export function mitObjektbezug(
  params: URLSearchParams,
  bezug: Objektbezug | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!bezug) {
    next.delete(OBJEKT_PARAM);
    next.delete(FASSUNG_PARAM);
    return next;
  }
  next.set(OBJEKT_PARAM, bezug.koId);
  if (bezug.fassung !== null) {
    next.set(FASSUNG_PARAM, String(bezug.fassung));
  } else {
    next.delete(FASSUNG_PARAM);
  }
  return next;
}

/** Gleich heisst: dieselbe Kennung UND dieselbe Fassung. */
export function gleicherBezug(a: Objektbezug | null, b: Objektbezug | null): boolean {
  return a?.koId === b?.koId && (a?.fassung ?? null) === (b?.fassung ?? null);
}

function mitAbfrage(pfad: string, params: URLSearchParams): string {
  const abfrage = params.toString();
  return abfrage ? `${pfad}?${abfrage}` : pfad;
}

/**
 * Die Prüfung GENAU DIESES Beitrags. `basis` erhält vorhandene Ansichtsparameter (z. B.
 * `origin=non-demo` aus `validationOriginHref`); der Bezug kommt immer dazu.
 */
export function pruefHref(
  koId: string,
  fassung: number | null = null,
  basis = "/validierung",
): string {
  const [pfad = "/validierung", abfrage = ""] = basis.split("?");
  return mitAbfrage(pfad, mitObjektbezug(new URLSearchParams(abfrage), { koId, fassung }));
}

/** Die Lesefläche dieses Beitrags; die Fassung reist als Rückweg-Angabe mit. */
export function leserHref(bezug: Objektbezug): string {
  const params = new URLSearchParams();
  if (bezug.fassung !== null) {
    params.set(FASSUNG_PARAM, String(bezug.fassung));
  }
  return mitAbfrage(`/wissen/${encodeURIComponent(bezug.koId)}`, params);
}

/**
 * Der Weg aus einer Antwortquelle zurück in die Lesefläche (Quellrückweg, K3).
 *
 * `belegAdresse` ist, was `belegstelleHref` (R-0326, `lib/belegstelle.ts`) für diese Quelle
 * gebaut hat — Passage samt deren Fassung. Sie wird hier hereingereicht statt hier gebaut, weil
 * `lib/belegstelle.ts` DOM-Typen braucht und diese Datei auch im Node-reinen Root-Typcheck steht.
 *
 * Trägt die Belegadresse KEINEN Anker — keine tragende Passage, oder eine, die `belegstelleHref` als
 * zu lang verwirft (dann fällt dort auch `fassung` weg) —, und ist die Quelle der Beitrag, aus dem
 * gefragt wurde, führt der Weg mit DERSELBEN Kennung und Fassung zurück wie der Rückweg der Zeile
 * „Frage zum Beitrag …". Die Passage wird dafür nicht abgeschnitten: ein gekürzter Anker fände
 * nichts Wörtliches (Begründung in `lib/belegstelle.ts`). Mit Anker gilt die genauere Belegstelle.
 */
export function quellenRueckwegHref(
  koId: string,
  belegAdresse: string,
  bezug: Objektbezug | null,
): string {
  const ankerUebrig = belegAdresse.includes("?");
  if (!ankerUebrig && bezug && bezug.koId === koId) {
    return leserHref(bezug);
  }
  return belegAdresse;
}

/**
 * Hängt den Bezug an eine fertige `/fragen?…`-Adresse an (`askAnswerHref`/
 * `askConfidentialQuestionHref` bauen den Rest). Vorhandene Parameter bleiben unberührt.
 */
export function fragenMitBezug(fragenAdresse: string, bezug: Objektbezug): string {
  const [pfad = "/fragen", abfrage = ""] = fragenAdresse.split("?");
  return mitAbfrage(pfad, mitObjektbezug(new URLSearchParams(abfrage), bezug));
}

// ==================================================================================================
// DER GELESENE STAND — WELCHE FASSUNG DIE LESEFLÄCHE GERADE ZEIGT.
// ==================================================================================================
//
// `/wissen/:id` nennt die Fassung nicht in der Adresse; die Lesefläche kennt sie aus ihrem
// Detailabruf. Sie meldet sie hier, und Klara sowie die Rückweg-Zeile lesen sie von hier — nur,
// wenn die Kennung zum Ort passt (`fassungAmOrt`). Kein Netzabruf, kein zweiter Cache-Schlüssel:
// gemeldet wird, was ohnehin gezeichnet wird. Nach Neuladen meldet die Fläche erneut.
type Zuhoerer = () => void;
let gelesenerStand: Objektbezug | null = null;
const zuhoerer = new Set<Zuhoerer>();

export function meldeGelesenenStand(stand: Objektbezug): void {
  if (gleicherBezug(gelesenerStand, stand)) {
    return;
  }
  gelesenerStand = stand;
  for (const z of zuhoerer) {
    z();
  }
}

export function gelesenenStandAbonnieren(z: Zuhoerer): () => void {
  zuhoerer.add(z);
  return () => {
    zuhoerer.delete(z);
  };
}

export function gelesenerStandJetzt(): Objektbezug | null {
  return gelesenerStand;
}

/**
 * Die Fassung, die für den Bezug an diesem Ort gilt: die der Adresse, sonst die der Lesefläche —
 * aber nur für DENSELBEN Artikel. Ein anderer zuletzt gelesener Artikel liefert nichts.
 */
export function fassungAmOrt(bezug: Objektbezug, gelesen: Objektbezug | null): number | null {
  if (bezug.fassung !== null) {
    return bezug.fassung;
  }
  return gelesen && gelesen.koId === bezug.koId ? gelesen.fassung : null;
}

/**
 * Wie verhält sich die Fassung aus der Adresse zur aktuellen des Artikels? `unbekannt`, solange
 * eine der beiden fehlt — dann wird nichts behauptet.
 */
export type FassungsLage = "gleich" | "abweichend" | "unbekannt";

export function fassungsLage(
  genannt: number | null,
  aktuell: number | null | undefined,
): FassungsLage {
  if (genannt === null || aktuell === null || aktuell === undefined) {
    return "unbekannt";
  }
  return genannt === aktuell ? "gleich" : "abweichend";
}
