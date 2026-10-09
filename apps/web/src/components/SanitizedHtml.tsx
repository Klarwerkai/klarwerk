import { blankLegacyCaptionPlaceholders } from "../lib/editorFigures";
import { RICH_TEXT_VOID_TAGS, sanitizeHtml } from "../lib/richText";

// KW-STR / SCRUM-45/46/48: rendert allowlist-sanitisiertes HTML. Einziger Ort mit
// dangerouslySetInnerHTML; Eingabe wird hier (und serverseitig) sanitisiert.
// WP-D10: Altlast-Platzhalter („Noch keine Bildbeschreibung" u. Ä.) werden in der ANZEIGE wie leer
// behandelt (geleert → das CSS blendet die leere Fußnote aus) — reine Render-Transformation, die
// gespeicherten Daten bleiben unangetastet; der Editor migriert sie beim Laden (editorFigures.ts).
//
// R-1160 (Lesehülle als Element statt HTML): Eine eigene Kennzeichnung für einen Abschnitt im
// Lesepfad — heute die waagerechte Scroll-Hülle um eine breite Tabelle (Scheibe D-037) — wird NICHT
// ins HTML geschrieben, bevor es durch `sanitizeHtml` geht; dort fiele sie (JOB 2427/2455,
// `tests/web/d037-sanitizing-huellengrenze.test.tsx`). Stattdessen wird die BEREITS SANITISIERTE
// Ausgabe an ihren Tabellen der obersten Ebene zerlegt, und die Hülle entsteht als React-Element
// darum. Die Allowlist für Fremdinhalt bleibt unverändert; nichts, was hier hinzukommt, stammt aus
// dem Inhalt.

/** Kennzeichnung der Lesehülle — steht nur am React-Element, nie im sanitisierten HTML. */
export const LESEHUELLE_ATTR = "data-kw-lesehuelle";

export interface LeseAbschnitt {
  art: "fluss" | "tabelle";
  html: string;
}

// Dieselbe Tag-Form wie in `sanitizeHtml` (richText.ts); dessen Ausgabe kennt nur `<tag attrs>` und
// `</tag>`, Text ist dort escaped — ein `<` im Text kann hier also nicht als Tag erscheinen.
const AUSGABE_TAG_RE = /<(\/?)([a-z][a-z0-9]*)(?:[^<>"']|"[^"]*"|'[^']*')*>/g;

/**
 * Zerlegt die AUSGABE von `sanitizeHtml` an jeder Tabelle der obersten Ebene. Verschachtelte
 * Tabellen (in Panel, Liste, Zelle) bleiben in ihrem Abschnitt. Die Teile ergeben aneinandergereiht
 * wieder genau die Eingabe; jeder Teil ist für sich geschlossen, weil nur auf Tiefe 0 geschnitten wird.
 */
export function zerlegeLesekoerper(sauber: string): LeseAbschnitt[] {
  const teile: LeseAbschnitt[] = [];
  let tiefe = 0;
  let ab = 0;
  let inTabelle = false;
  for (const m of sauber.matchAll(AUSGABE_TAG_RE)) {
    const tag = m[2] ?? "";
    if (RICH_TEXT_VOID_TAGS.has(tag)) {
      continue;
    }
    const bei = m.index ?? 0;
    if (m[1] !== "/") {
      if (tiefe === 0 && tag === "table") {
        if (bei > ab) {
          teile.push({ art: "fluss", html: sauber.slice(ab, bei) });
        }
        ab = bei;
        inTabelle = true;
      }
      tiefe += 1;
      continue;
    }
    tiefe -= 1;
    if (tiefe === 0 && inTabelle && tag === "table") {
      const ende = bei + m[0].length;
      teile.push({ art: "tabelle", html: sauber.slice(ab, ende) });
      ab = ende;
      inTabelle = false;
    }
  }
  if (ab < sauber.length) {
    // Eine nie geschlossene Tabelle erzeugt der Sanitizer nicht; bliebe eine, ginge sie ohne Hülle durch.
    teile.push({ art: "fluss", html: sauber.slice(ab) });
  }
  return teile;
}

export function SanitizedHtml({
  html,
  className,
  lesehuellen = false,
}: {
  html: string;
  className?: string;
  /** R-1160: Tabellen der obersten Ebene in eine waagerecht scrollende Lesehülle setzen (Lesepfad). */
  lesehuellen?: boolean;
}): JSX.Element {
  const sauber = blankLegacyCaptionPlaceholders(sanitizeHtml(html));
  const teile = lesehuellen ? zerlegeLesekoerper(sauber) : [];
  if (!teile.some((t) => t.art === "tabelle")) {
    // Ohne Tabelle (oder ohne Lesehülle) bleibt das Markup exakt das bisherige.
    const inner = { __html: sauber };
    // biome-ignore lint/security/noDangerouslySetInnerHtml: Inhalt ist allowlist-sanitisiert (richText.sanitizeHtml + Server).
    return <div className={className} dangerouslySetInnerHTML={inner} />;
  }
  return (
    <div className={className}>
      {teile.map((t, i) =>
        t.art === "tabelle" ? (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: die Abschnittsfolge ist eine reine Ableitung von `html`.
            key={i}
            data-kw-lesehuelle="tabelle"
            className="max-w-full overflow-x-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Teilstück der allowlist-sanitisierten Ausgabe oben.
            dangerouslySetInnerHTML={{ __html: t.html }}
          />
        ) : (
          // `contents`: der Fließtext-Abschnitt erzeugt keinen eigenen Kasten — Abstände und
          // Typografie von `.prose-kw` wirken wie ohne Zerlegung.
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: die Abschnittsfolge ist eine reine Ableitung von `html`.
            key={i}
            className="contents"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Teilstück der allowlist-sanitisierten Ausgabe oben.
            dangerouslySetInnerHTML={{ __html: t.html }}
          />
        ),
      )}
    </div>
  );
}
