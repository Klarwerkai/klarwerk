// ================================================================================================
// produkt:20261010:rechteentzug-gespraeche-belege — EINE CHAT-ÜBERNAHME OHNE IHRE QUELLE.
// ================================================================================================
//
// Die Wissensübernahme aus dem Chat schreibt eine Nachricht samt Ausschnitt eines Wissensobjekts
// (Zitat und Quellentitel) in einen Entwurf (`services/app/src/routes/chat-routes.ts`). Ist die Quelle
// HEUTE nicht zugänglich, bestimmt diese reine Regel, was davon noch hinausgeht — am Server (Ausgabe,
// Einreichen, Selbstauskunft, Lesefassung des Wissensobjekts) UND im geöffneten Editor
// (`useChatQuellwaechter`). Eine Regel, mehrere Aufrufer: deshalb liegt sie DOM- und paketfrei hier,
// wie `docx.ts`, und der Server liest sie über `services/capture`.
//
// NACHARBEIT 12 (Befund Ben an dd1e1ed): HERKUNFT STATT TEXTÄHNLICHKEIT.
// Bis hierher wurde der Wortlaut der Quelle im Text GESUCHT (Wortpaare). Eine Umformulierung
// („Für das Vorhaben sind 47000 vorgesehen" aus „Budget beträgt 47000 Euro") oder ein einzeln
// übernommener Wert blieb damit offen. Ob ein Satz aus der Quelle abgeleitet ist, lässt sich am Text
// nicht entscheiden — wohl aber, ob er NACHWEISLICH EIGEN ist. Deshalb gilt jetzt umgekehrt:
//   · NACHWEISLICH EIGEN ist, was die Übernahme aus der eigenen Nachricht geschrieben hat und seitdem
//     unverändert ist: jeder Absatz der Nachricht, Titel und Aussage (auch gekürzt, solange sie mit
//     der Nachricht übereinstimmen), und der Herkunftsvermerk der Übernahme.
//   · ALLES ANDERE ist mit der Quelle vermischt und nicht mehr trennbar — das Zitat, jede Bearbeitung,
//     jeder später geschriebene Absatz, ein eingefügtes Bild. Es wird zurückgehalten; je
//     zusammenhängender Strecke steht eine Marke da.
//   · In den eigenen Teilen werden Wortlaut und Quellentitel zusätzlich über Wortpaare herausgenommen
//     (die eigene Nachricht kann den Titel der Quelle nennen: „Zur Markierung aus „…“").
//   · Ist die eigene Nachricht unbekannt (Herkunft unbekannt), ist nur der Herkunftsvermerk eigen;
//     Titel und Aussage gehen nicht hinaus.
// Lieber zu viel als zu wenig: ein eigener, nach der Übernahme geschriebener Satz ist nicht
// nachweislich eigen und wird mit zurückgehalten, solange die Quelle nicht zugänglich ist.

/** Wortlaut und Titel der gebundenen Quelle und die eigene Nachricht der Übernahme. */
export interface ChatQuellschutz {
  zitat: string;
  quelle: string;
  /** Der Text der übernommenen Nachricht — `null`/fehlt: unbekannt, nichts ist nachweislich eigen. */
  eigeneNachricht?: string | null;
}

/** Die Textfelder, in denen ein übernommenes Zitat stehen kann — am Entwurf wie am Wissensobjekt. */
interface Textfelder {
  title?: string;
  statement?: string;
  bodyHtml?: string | null;
}

/** Ersatz für zurückgehaltenen Wortlaut — fester Produkttext, kein Inhalt der Quelle. */
export const CHAT_QUELLE_ZURUECKGEHALTEN = "[zurückgehalten]";

/** Ersatz für eine zurückgehaltene Strecke im Entwurf. */
export const CHAT_ZITAT_ZURUECKGEHALTEN =
  "[Zitat zurückgehalten – die Quelle ist für dich heute nicht zugänglich.]";

/** Der Herkunftsvermerk, den die Übernahme schreibt — er ist immer eigener Produkttext. */
export const CHAT_HERKUNFT_MUSTER =
  /^Aus dem internen Chat übernommen: (persönliche|geteilte) Nachricht von .{1,200} vom \d{4}-\d{2}-\d{2}\.$/;

const WORT = /[\p{L}\p{N}]+/gu;
const ABSATZ = /<(p|li|h[1-6]|td|th|pre|dt|dd|figcaption|caption)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
const LEER = new Set(["br", "hr", "img", "wbr", "input", "col", "source", "area", "embed"]);

interface Muster {
  readonly paare: ReadonlySet<string>;
  readonly einzel: ReadonlySet<string>;
}

const BENANNT: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function entschluessle(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (ganz, name: string) => {
    if (name.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return BENANNT[name.toLowerCase()] ?? ganz;
  });
}

function maskiere(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Vergleichsform: sichtbarer Text, Leerraum zusammengefasst, Unicode-Normalform. */
function normiere(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Sichtbarer Text eines HTML-Stücks in Vergleichsform. */
function sichtbarerText(html: string): string {
  return normiere(entschluessle(html.replace(/<[^>]*>/g, " ")));
}

function woerter(text: string): string[] {
  return (text.match(WORT) ?? []).map((w) => w.toLowerCase());
}

function musterVon(schutz: ChatQuellschutz): Muster {
  const paare = new Set<string>();
  const einzel = new Set<string>();
  for (const wortlaut of [schutz.zitat, schutz.quelle]) {
    const w = woerter(wortlaut);
    if (w.length === 1 && w[0]) {
      einzel.add(w[0]);
      continue;
    }
    const alle: string[] = [];
    const tragend: string[] = [];
    for (let i = 0; i + 1 < w.length; i += 1) {
      const a = w[i] ?? "";
      const b = w[i + 1] ?? "";
      alle.push(`${a} ${b}`);
      if (a.length >= 4 || b.length >= 4) {
        tragend.push(`${a} ${b}`);
      }
    }
    for (const paar of tragend.length > 0 ? tragend : alle) {
      paare.add(paar);
    }
  }
  return { paare, einzel };
}

/** Die Spannen im Klartext, die Wortlaut oder Titel der Quelle tragen. */
function spannen(text: string, m: Muster): [number, number][] {
  const fund = [...text.matchAll(WORT)].map((t) => ({
    wort: t[0].toLowerCase(),
    von: t.index ?? 0,
    bis: (t.index ?? 0) + t[0].length,
  }));
  const markiert = fund.map((t) => m.einzel.has(t.wort));
  for (let i = 0; i + 1 < fund.length; i += 1) {
    if (m.paare.has(`${fund[i]?.wort} ${fund[i + 1]?.wort}`)) {
      markiert[i] = true;
      markiert[i + 1] = true;
    }
  }
  const raus: [number, number][] = [];
  for (let i = 0; i < fund.length; i += 1) {
    if (!markiert[i]) {
      continue;
    }
    let j = i;
    while (j + 1 < fund.length && markiert[j + 1]) {
      j += 1;
    }
    raus.push([fund[i]?.von ?? 0, fund[j]?.bis ?? 0]);
    i = j;
  }
  return raus;
}

function trifft(text: string, m: Muster): boolean {
  return spannen(text, m).length > 0;
}

function ersetzeKlartext(text: string, m: Muster): string {
  let aus = text;
  for (const [von, bis] of spannen(text, m).reverse()) {
    aus = `${aus.slice(0, von)}${CHAT_QUELLE_ZURUECKGEHALTEN}${aus.slice(bis)}`;
  }
  return aus;
}

/** Wortlaut und Titel der Quelle aus einem EIGENEN Block nehmen (Wortpaare, s. Kopf). */
function ohneWortlaut(html: string, m: Muster, blockMarke: string): string {
  const marken = [CHAT_QUELLE_ZURUECKGEHALTEN, blockMarke];
  const treffer = (stueck: string): boolean => {
    let text = sichtbarerText(stueck);
    for (const marke of marken) {
      text = text.split(marke).join(" ");
    }
    return trifft(text, m);
  };
  const aus = html
    .split(/(<[^>]*>)/)
    .map((teil) => {
      if (teil.startsWith("<")) {
        return teil;
      }
      const klar = entschluessle(teil);
      return trifft(klar, m) ? maskiere(ersetzeKlartext(klar, m)) : teil;
    })
    .join("");
  return aus.replace(ABSATZ, (absatz, tag: string, attribute: string) =>
    treffer(absatz) ? `<${tag}${attribute}>${maskiere(blockMarke)}</${tag}>` : absatz,
  );
}

/**
 * Die Blöcke der obersten Ebene eines HTML-Stücks, in Reihenfolge und vollständig: ihre Verkettung
 * ist wieder das Stück. Text auf oberster Ebene ist ein eigener Block.
 */
function bloecke(html: string): string[] {
  const raus: string[] = [];
  let tiefe = 0;
  let start = 0;
  for (const m of html.matchAll(TAG)) {
    const ganz = m[0];
    const von = m.index ?? 0;
    const bis = von + ganz.length;
    const tag = (m[1] ?? "").toLowerCase();
    const schliesst = ganz.startsWith("</");
    const leer = !schliesst && (LEER.has(tag) || ganz.endsWith("/>"));
    if (tiefe === 0 && von > start) {
      raus.push(html.slice(start, von));
      start = von;
    }
    if (schliesst) {
      tiefe = Math.max(0, tiefe - 1);
    } else if (!leer) {
      tiefe += 1;
    }
    if (tiefe === 0) {
      raus.push(html.slice(start, bis));
      start = bis;
    }
  }
  if (start < html.length) {
    raus.push(html.slice(start));
  }
  return raus;
}

/** Was aus der eigenen Nachricht nachweislich eigen ist (s. Kopf). */
interface Eigenes {
  readonly absaetze: ReadonlySet<string>;
  readonly titel: string | null;
  readonly aussage: string | null;
}

function eigenesAus(nachricht: string | null | undefined): Eigenes {
  if (typeof nachricht !== "string" || nachricht.trim().length === 0) {
    return { absaetze: new Set(), titel: null, aussage: null };
  }
  // Dieselbe Ableitung wie die Übernahme (`chat-routes.ts`, `wissenUebernehmen`).
  const absaetze = new Set(
    nachricht
      .split(/\n{2,}/)
      .map((absatz) => normiere(absatz))
      .filter((absatz) => absatz.length > 0),
  );
  const erste = nachricht.split("\n")[0]?.trim() ?? "";
  return {
    absaetze,
    titel: normiere((erste || nachricht).slice(0, 120)),
    aussage: normiere(nachricht.slice(0, 2_000)),
  };
}

/** Ein Block ist eigen, wenn er unverändert ein Absatz der Nachricht oder der Vermerk ist. */
function blockIstEigen(block: string, eigen: Eigenes): boolean {
  const text = sichtbarerText(block);
  if (text.length === 0) {
    // Leere Absätze und Zeilenumbrüche tragen keinen Inhalt — ein Bild ohne Text dagegen schon.
    return !/<(img|svg|video|audio|object|embed|iframe|canvas)\b/i.test(block);
  }
  return eigen.absaetze.has(text) || CHAT_HERKUNFT_MUSTER.test(text);
}

/** Titel oder Aussage: eigen, wenn sie mit dem eigenen Text übereinstimmen (auch gekürzt). */
function feldIstEigen(wert: string, eigen: string | null): boolean {
  const text = normiere(wert);
  if (text.length === 0) {
    return true;
  }
  return eigen?.startsWith(text) === true;
}

function ohneImHtml(html: string, schutz: ChatQuellschutz, m: Muster, blockMarke: string): string {
  const eigen = eigenesAus(schutz.eigeneNachricht);
  const raus: string[] = [];
  let zurueckgehalten = false;
  for (const block of bloecke(html)) {
    if (blockIstEigen(block, eigen)) {
      raus.push(ohneWortlaut(block, m, blockMarke));
      zurueckgehalten = false;
      continue;
    }
    // Eine zusammenhängende Strecke nicht nachweislich eigener Blöcke: EINE Marke.
    if (!zurueckgehalten) {
      raus.push(`<p>${maskiere(blockMarke)}</p>`);
      zurueckgehalten = true;
    }
  }
  return raus.join("");
}

/**
 * Die Textfelder ohne alles, was nicht nachweislich eigen ist (s. Kopf). Rein; ändert nichts
 * Gespeichertes. `blockMarke` ist der Ersatz für eine zurückgehaltene Strecke (Entwurf und
 * Wissensobjekt sagen Verschiedenes).
 */
export function ohneChatQuelle<T extends Textfelder>(
  payload: T,
  schutz: ChatQuellschutz,
  blockMarke = CHAT_ZITAT_ZURUECKGEHALTEN,
): T {
  const m = musterVon(schutz);
  const eigen = eigenesAus(schutz.eigeneNachricht);
  const neu: Textfelder = {};
  if (typeof payload.bodyHtml === "string") {
    neu.bodyHtml = ohneImHtml(payload.bodyHtml, schutz, m, blockMarke);
  }
  if (typeof payload.title === "string") {
    neu.title = feldIstEigen(payload.title, eigen.titel)
      ? ersetzeKlartext(payload.title, m)
      : CHAT_QUELLE_ZURUECKGEHALTEN;
  }
  if (typeof payload.statement === "string") {
    neu.statement = feldIstEigen(payload.statement, eigen.aussage)
      ? ersetzeKlartext(payload.statement, m)
      : CHAT_QUELLE_ZURUECKGEHALTEN;
  }
  // Nur Zeichenketten werden ersetzt, und zwar durch Zeichenketten — die Feldtypen bleiben.
  return { ...payload, ...neu } as T;
}

/**
 * Eine Chat-Übernahme, deren Herkunft sich NICHT zuordnen lässt (Altbestand ohne Bindung und ohne
 * auflösbaren Übernahmevermerk): weder Quelle noch eigene Nachricht sind bekannt. Eigen ist nur der
 * Herkunftsvermerk; alles andere — einschließlich Titel und Aussage — geht nicht hinaus.
 */
export function ohneUngebundeneZitate<T extends Textfelder>(
  payload: T,
  blockMarke = CHAT_ZITAT_ZURUECKGEHALTEN,
): T {
  return ohneChatQuelle(payload, { zitat: "", quelle: "", eigeneNachricht: null }, blockMarke);
}

/** Trägt dieser Text den Herkunftsvermerk einer Chat-Übernahme (als eigenen Block)? */
export function traegtChatHerkunftsvermerk(bodyHtml: string | null | undefined): boolean {
  if (typeof bodyHtml !== "string") {
    return false;
  }
  return bloecke(bodyHtml).some((block) => CHAT_HERKUNFT_MUSTER.test(sichtbarerText(block)));
}
