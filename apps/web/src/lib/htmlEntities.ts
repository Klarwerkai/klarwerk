// WP-IC-PAKET-1 (Teil 1, Pedis Screenshot &uuml;/&auml;/&middot;): Client-Spiegel der einmaligen,
// vollständigen HTML-Entity-Dekodierung (Server-Original: services/structure/src/sanitize.ts,
// decodeHtmlEntities — Parität per Test gepinnt; bewusst gespiegelt statt importiert, kein
// Service-Runtime-Import im Browser-Bundle, gleiches Muster wie richText↔sanitize).
//
// Zweck hier: ALTBESTAND-Anzeige. Die ~70 bestehenden Queue-Kandidaten wurden VOR dem Quellen-Fix mit
// rohen Entities gespeichert — die Anzeige (Queue-Karten, Auswahl-Vorschau, Erkundungs-Chips) dekodiert
// deshalb zusätzlich beim Rendern, ohne Server-Migration. EIN einziger Regex-Durchlauf: String.replace
// scannt die Ausgabe nicht erneut → &amp;uuml; wird korrekt zu „&uuml;" (Literal), nie doppelt zu ü.
// Unbekannte benannte Entities und ungültige Codepoints bleiben unverändert (fail-closed). Das Ergebnis
// ist IMMER nur ein STRING für Text-Kontexte — die Aufrufer rendern ihn als React-Textknoten, nie als
// Roh-HTML (XSS-neutral; der Test pinnt das an den Anzeige-Stellen).
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  middot: "·",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  sect: "§",
  para: "¶",
  deg: "°",
  plusmn: "±",
  sup2: "²",
  sup3: "³",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  acirc: "â",
  ecirc: "ê",
  icirc: "î",
  ocirc: "ô",
  ucirc: "û",
  ccedil: "ç",
  ntilde: "ñ",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  times: "×",
  divide: "÷",
};

const HTML_ENTITY_RE = /&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,30});/g;

export function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (match, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      const isControl = code < 32 && code !== 9 && code !== 10 && code !== 13;
      if (
        !Number.isInteger(code) ||
        isControl ||
        (code >= 0xd800 && code <= 0xdfff) ||
        code > 0x10ffff
      ) {
        return match; // ungültiger Codepoint → Roh-Text behalten (fail-closed)
      }
      return String.fromCodePoint(code);
    }
    // Benannte Entities case-SENSITIV (auml ≠ Auml); Unbekanntes bleibt unverändert.
    return NAMED_HTML_ENTITIES[body] ?? match;
  });
}
