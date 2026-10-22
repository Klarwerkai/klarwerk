// ================================================================================================
// H8 · WEBA-4 · WEBB-2 · IMP-2 · TST-5 — LINKZIELE IN BEIDEN SANITIZERN, EIN FALL-KATALOG.
// ================================================================================================
//
// DER BEFUND (Review 21.10., nachgestellt in `belege/pruefer/klara-import/sanitizer-paritaet.ts`,
// `sanitizer-browserdeutung.ts` und `belege/pruefer/klara-web-a/sanitizer-href.mts`): `isSafeHref`
// pruefte den ROHEN Attributwert per Regex. Der Browser dekodiert aber zuerst die Entities, streicht
// Tab/Zeilenumbruch und fuehrende Steuerzeichen und deutet `/\` wie `//`. So kamen `&#106;avascript:`,
// `javascript&colon;`, `java&Tab;script:`, ein echter Tab, `\x01` davor, `data:` per Entity und
// verdeckte Fremdlinks (`//`, `/\`, `\\`) als lebender Link im DOM an — Server und Client wortgleich.
//
// DIESE DATEI ist der gemeinsame Fall-Katalog: jeder Fall laeuft durch den Server-Sanitizer
// (`services/structure`) UND den Client-Spiegel (`apps/web/src/lib/richText`). Geprueft wird
// (1) Gleichheit beider Ausgaben, (2) was ein echter HTML-Parser (jsdom, WHATWG-URL) aus der Ausgabe
// macht — nicht, was die Zeichenkette verspricht —, (3) der Fixpunkt.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

// Der Gate-tsc laeuft ohne DOM-lib und ohne `@types/jsdom` — jsdom deshalb ueber schmale
// Struktur-Typen (dasselbe Muster wie `tests/app/job2551-bildverlust-satz-mounted.test.ts`).
interface AnkerLike {
  getAttribute(name: string): string | null;
  readonly protocol: string;
  readonly host: string;
}
interface DomLike {
  window: { document: { querySelector(sel: string): AnkerLike | null } };
}
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, opt: { url: string }) => DomLike;
};

const SEITE = "https://app.klarwerk.test/bibliothek/1";
const EIGENER_HOST = "app.klarwerk.test";

/** Die 13 Linkfaelle aus `sanitizer-paritaet.ts` (IMP-2) — woertlich, Name wie im Beleg. */
const IMP2_FAELLE: readonly [string, string][] = [
  ["plain_js", '<a href="javascript:alert(1)">x</a>'],
  ["dec_entity", '<a href="&#106;avascript:alert(1)">x</a>'],
  ["hex_entity", '<a href="&#x6A;avascript:alert(1)">x</a>'],
  ["colon_named", '<a href="javascript&colon;alert(1)">x</a>'],
  ["colon_num", '<a href="javascript&#58;alert(1)">x</a>'],
  ["tab_named", '<a href="java&Tab;script:alert(1)">x</a>'],
  ["newline_raw", '<a href="java\nscript:alert(1)">x</a>'],
  ["tab_raw", '<a href="java\tscript:alert(1)">x</a>'],
  ["ctrl_prefix", '<a href="\u0001javascript:alert(1)">x</a>'],
  ["proto_rel", '<a href="//evil.example/login">x</a>'],
  ["backslash", '<a href="/\\evil.example/login">x</a>'],
  ["data_html", '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
  ["vbscript_ent", '<a href="vb&#115;cript:msgbox(1)">x</a>'],
];

/** Zusaetzlich aus `sanitizer-href.mts` (WEBA-4/WEBB-2), die in IMP-2 nicht vorkommen. */
const WEBA_FAELLE: readonly [string, string][] = [
  [
    "data_entity",
    '<a href="&#100;ata:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  ],
  ["doppel_backslash", '<a href="\\\\evil.example/login">x</a>'],
];

/** Alle Faelle, deren href ENTFERNT sein muss. */
const ENTFERNEN: readonly [string, string][] = [
  ...IMP2_FAELLE,
  ...WEBA_FAELLE,
  // Ein per Entity versteckter zweiter Slash — der Decoder kennt `&#47;`, der Wert wird `//…`.
  ["slash_entity_num", '<a href="/&#47;evil.example/login">x</a>'],
  ["leer", '<a href="">x</a>'],
];

/**
 * Faelle, die der Decoder NICHT kennt (`&sol;`, `&NewLine;`, `&bsol;`). Der Browser kennt sie alle.
 * Sie duerfen bleiben — aber nur, wenn das, was der Browser liest, dasselbe ist wie das, was geprueft
 * wurde. Gibt der Sanitizer den Rohwert mit dem Entity weiter, macht der Browser daraus `//evil`.
 */
const PRUEFWERT_IST_AUSGABEWERT: readonly [string, string][] = [
  ["sol_entity", '<a href="/&sol;evil.example/login">x</a>'],
  ["newline_entity", '<a href="/&NewLine;/evil.example/login">x</a>'],
  ["bsol_entity", '<a href="/&bsol;evil.example/login">x</a>'],
];

/** Harmlose Faelle — sie muessen auf beiden Seiten gleich ERHALTEN bleiben. */
const ERHALTEN: readonly [string, string, string][] = [
  ["https", '<a href="https://ok.example">x</a>', 'href="https://ok.example"'],
  ["https_pfad", '<a href="https://example.org/">x</a>', 'href="https://example.org/"'],
  ["http_gross", '<a href="HTTPS://Example.org/A">x</a>', 'href="HTTPS://Example.org/A"'],
  ["mailto", '<a href="mailto:test@example.test">x</a>', 'href="mailto:test@example.test"'],
  ["anker", '<a href="#quelle">x</a>', 'href="#quelle"'],
  ["relativ", '<a href="/bibliothek/1">x</a>', 'href="/bibliothek/1"'],
  ["wurzel", '<a href="/">x</a>', 'href="/"'],
  ["objekt_raw", '<a href="/api/objects/abc-1/raw">x</a>', 'href="/api/objects/abc-1/raw"'],
  [
    "query_mit_amp",
    '<a href="/wissen/ko-1?fassung=2&amp;x=1">x</a>',
    'href="/wissen/ko-1?fassung=2&amp;x=1"',
  ],
  [
    "prozentkodiert_eigener_pfad",
    '<a href="/%2F%2Ffremd.example">x</a>',
    'href="/%2F%2Ffremd.example"',
  ],
];

/** Was ein echter HTML-Parser aus der Ausgabe macht. */
function deutung(html: string): { href: string | null; protocol: string; host: string } {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: SEITE });
  const a = dom.window.document.querySelector("a");
  if (!a) {
    throw new Error(`kein <a> in der Ausgabe: ${html}`);
  }
  const href = a.getAttribute("href");
  return { href, protocol: href === null ? "" : a.protocol, host: href === null ? "" : a.host };
}

const SEITEN = [
  ["Server", serverSanitize],
  ["Client", clientSanitize],
] as const;

describe("H8/WEBA-4/WEBB-2: Linkziel-Umgehungen — href wird auf beiden Seiten entfernt", () => {
  it("KALIBRIERUNG: der Katalog enthaelt alle 13 IMP-2-Linkfaelle und die WEBA-Zusaetze", () => {
    expect(IMP2_FAELLE).toHaveLength(13);
    expect(new Set(ENTFERNEN.map(([n]) => n)).size).toBe(ENTFERNEN.length);
  });

  it("KALIBRIERUNG: jsdom deutet die rohen Faelle wirklich als Skript/Daten/Fremdhost", () => {
    // Ohne diese Probe koennte `deutung` an allem vorbeigehen und die Faelle unten waeren muehelos gruen.
    expect(deutung('<a href="&#106;avascript:alert(1)">x</a>').protocol).toBe("javascript:");
    expect(deutung('<a href="java&Tab;script:alert(1)">x</a>').protocol).toBe("javascript:");
    expect(deutung('<a href="/\\evil.example/login">x</a>').host).toBe("evil.example");
    expect(deutung('<a href="/&NewLine;/evil.example/login">x</a>').host).toBe("evil.example");
  });

  for (const [seite, sanitize] of SEITEN) {
    for (const [name, html] of ENTFERNEN) {
      it(`${seite} · ${name}: href entfernt`, () => {
        const aus = sanitize(html);
        expect(deutung(aus).href, `${seite} ${name}: ${aus}`).toBeNull();
        expect(aus).toContain('rel="noopener noreferrer nofollow"');
      });
    }
  }
});

describe("H8: was geprueft wird, ist das, was der Browser liest", () => {
  for (const [seite, sanitize] of SEITEN) {
    for (const [name, html] of PRUEFWERT_IST_AUSGABEWERT) {
      it(`${seite} · ${name}: kein verdeckter Fremdlink`, () => {
        const aus = sanitize(html);
        const d = deutung(aus);
        if (d.href !== null) {
          expect(d.protocol, `${seite} ${name}: ${aus}`).toBe("https:");
          expect(d.host, `${seite} ${name}: ${aus}`).toBe(EIGENER_HOST);
        }
      });
    }
  }
});

describe("H8: harmlose Linkziele bleiben erhalten", () => {
  for (const [seite, sanitize] of SEITEN) {
    for (const [name, html, erwartet] of ERHALTEN) {
      it(`${seite} · ${name}: ${erwartet}`, () => {
        expect(sanitize(html)).toContain(erwartet);
      });
    }
  }
});

describe("H8: Paritaet und Fixpunkt ueber den ganzen Katalog", () => {
  const ALLE: readonly [string, string][] = [
    ...ENTFERNEN,
    ...PRUEFWERT_IST_AUSGABEWERT,
    ...ERHALTEN.map(([n, h]) => [n, h] as [string, string]),
  ];

  it("Server und Client liefern fuer jeden Fall dieselbe Ausgabe", () => {
    const abweichungen = ALLE.filter(([, html]) => serverSanitize(html) !== clientSanitize(html));
    expect(abweichungen.map(([n]) => n)).toEqual([]);
  });

  it("zweimal sanitisieren aendert nichts mehr (beide Seiten)", () => {
    for (const [seite, sanitize] of SEITEN) {
      for (const [name, html] of ALLE) {
        const einmal = sanitize(html);
        expect(sanitize(einmal), `${seite} ${name}: ${einmal}`).toBe(einmal);
      }
    }
  });
});
