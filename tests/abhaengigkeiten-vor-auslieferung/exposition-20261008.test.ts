// ================================================================================================
// R-1398 · BEN nacharbeit-4 — DIE 34 MELDUNGEN DES ECHTEN AUDITS VOM 08.10.2026, AM AUFRUFPFAD.
// ================================================================================================
//
// Quelle der Meldungen: HISTORIE/nacharbeit-3/PRUEFUNG/echter-audit.json (sha256 598aa224…).
// Die Bewertungen stehen je Advisory in `tools/abhaengigkeiten-bewertet.json`; jede trägt als
// Beleg einen Fall dieser Datei. Jeder Fall hält die BEDINGUNG fest, auf der ein Urteil ruht:
// ändert sich der Code so, dass sie nicht mehr gilt, wird der Fall rot — und dann wird die
// Bewertung neu gemacht, nicht dieser Test angepasst.
//
// Behoben statt bewertet:
//   · @xmldom/xmldom (Web, 10 Meldungen): 0.8.13 → 0.8.15 in apps/web/package-lock.json. Der
//     Eintrag ist der von npm erzeugte aus package-lock.json (dort 0.8.15; der echte Audit meldet
//     ihn nicht). M2 hält fest, dass mammoth genau diese Fassung lädt.
//   · React Router (GHSA-wrjc, GHSA-jjmj): die zwei Navigationsziele aus `location.pathname`
//     laufen durch `internerPfad()` (R3/R4); alle übrigen 153 Stellen haben feste Ziele.
//
//   · sharp/librsvg (GHSA-wq5f-xc86-pv6w): gehoben auf 0.35.5 (erste behobene Fassung; Lockdatei
//     von npm erzeugt, übernommen am 08.10.2026). Der SVG→WebP-Import ist erhalten (S1) und
//     erreicht librsvg (S2) — jetzt in der behobenen Fassung.
//
// GRENZE, für alle Fälle gleich: die Advisorytexte selbst waren ohne Netzzugang nicht lesbar;
// bewertet ist an Titel und betroffenem Bereich aus dem Auditbericht. Die Bibliotheksquellen
// liegen ausserhalb des Arbeitsbaums; wo eine Aussage IN der Bibliothek liegt (M1), wird sie zur
// Laufzeit gemessen statt behauptet.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { internerPfad } from "../../apps/web/src/lib/internerPfad";
import { BILD_MAX_KANTE, bildVerkleinerung } from "../../services/app/src/import/bildverkleinerung";
import { normalizeFragekontext } from "../../services/knowledge-object/src/geltung";
import { sanitizeHtml } from "../../services/structure/src/sanitize";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function lies(rel: string): string {
  return readFileSync(join(WURZEL, rel), "utf8");
}

/** Produktdateien (.ts/.tsx) unter einem Verzeichnis, ohne Tests und ohne node_modules. */
function produktdateien(rel: string): string[] {
  const raus: string[] = [];
  const stapel = [join(WURZEL, rel)];
  while (stapel.length > 0) {
    const ort = stapel.pop() as string;
    for (const name of readdirSync(ort)) {
      if (name === "node_modules" || name === "dist" || name.startsWith(".")) {
        continue;
      }
      const voll = join(ort, name);
      if (statSync(voll).isDirectory()) {
        stapel.push(voll);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        raus.push(relative(WURZEL, voll).split("\\").join("/"));
      }
    }
  }
  return raus.sort();
}

/** Dateien, deren Text das Muster trifft. */
function fundorte(dateien: readonly string[], muster: RegExp): string[] {
  return dateien.filter((d) => muster.test(lies(d)));
}

/** Der Quelltext eines `{ … }`-Blocks ab `anfang` (Klammern gezählt). */
function block(text: string, anfang: string): string {
  const start = text.indexOf(anfang);
  expect(start, `„${anfang}" nicht gefunden`).toBeGreaterThan(-1);
  const auf = text.indexOf("{", start);
  let tiefe = 0;
  for (let i = auf; i < text.length; i += 1) {
    if (text[i] === "{") {
      tiefe += 1;
    } else if (text[i] === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return text.slice(auf, i + 1);
      }
    }
  }
  throw new Error(`Block ab „${anfang}" endet nicht`);
}

/** Derselbe Block ohne Kommentarzeilen. */
function ohneKommentare(text: string): string {
  return text
    .split("\n")
    .filter((z) => !z.trim().startsWith("//"))
    .join("\n");
}

/** Schlüssel der obersten Ebene eines Objektliterals (Kommentarzeilen ausgenommen). */
function schluessel(objekt: string): string[] {
  const raus: string[] = [];
  let tiefe = 0;
  for (const zeile of ohneKommentare(objekt.slice(1, -1)).split("\n")) {
    const z = zeile.trim();
    const treffer = /^(\w+)\s*[:,]/.exec(z);
    if (tiefe === 0 && treffer?.[1]) {
      raus.push(treffer[1]);
    }
    tiefe += (z.match(/[{[]/g) ?? []).length - (z.match(/[}\]]/g) ?? []).length;
  }
  return raus;
}

const SERVICES = produktdateien("services");
const WEB = produktdateien("apps/web/src");
const WEB_STATIC = "services/app/src/web-static.ts";
const ASK = "services/app/src/routes/ask-routes.ts";
const CHECK = "services/app/src/routes/check-text-routes.ts";
const SMTP = "services/notifications/src/smtp.ts";

describe("fastify 5.12.1 — die Bedingungen der fünf Meldungen", () => {
  it("F1 · genau ein Not-Found-Handler, in web-static.ts, und er liefert nur Öffentliches", () => {
    expect(fundorte(SERVICES, /\.setNotFoundHandler\(/)).toEqual([WEB_STATIC]);
    const handler = block(lies(WEB_STATIC), "app.setNotFoundHandler(");
    expect(handler).toContain('sendFile("index.html")');
    expect(handler).not.toMatch(/request\.(user|session|auth)|authorization/i);
  });

  it("F2 · kein eigener Validator-/Schema-Compiler und kein asynchrones Schema", () => {
    const muster = /setValidatorCompiler|setSchemaController|\$async|addSchema\(/;
    expect(fundorte(SERVICES, muster)).toEqual([]);
  });

  it("F3 · zwei Routenschemata, nur `body`; einziges false-Teilschema ist fragekontext", () => {
    const routenschema = /schema:\s*\{\s*(body|headers|querystring|params)\b/;
    expect(fundorte(SERVICES, routenschema)).toEqual([ASK, CHECK]);
    const ask = lies(ASK);
    const check = lies(CHECK);
    expect(ask).toMatch(/schema:\s*\{\s*body:\s*askBodySchema\s*\}/);
    expect(check).toMatch(/schema:\s*\{\s*body:\s*bodySchema\s*\}/);
    const askSchema = ohneKommentare(block(ask, "const askBodySchema = {"));
    const checkSchema = ohneKommentare(block(check, "const bodySchema = {"));
    expect(checkSchema).not.toMatch(/\bfalse\b/);
    expect(askSchema.match(/\bfalse\b/g) ?? []).toHaveLength(1);
    const kontext = block(askSchema, "fragekontext: {");
    expect(kontext).toMatch(/additionalProperties:\s*false/);
    expect(`${askSchema}${checkSchema}`).not.toMatch(/\bheaders\b/);
  });

  it("F4 · zusätzliche Schlüssel in fragekontext bleiben wirkungslos (Folge von GHSA-hwr6)", () => {
    // Angenommen, fastify übersprünge `additionalProperties: false`: der Handler reicht den Wert
    // durch normalizeFragekontext, und das übernimmt nur werk, schicht und rolle.
    const erlaubt = { werk: "Werk A", schicht: "Früh", rolle: "Leitung" };
    expect(normalizeFragekontext({ ...erlaubt, fremd: "x", admin: true })).toEqual(erlaubt);
    expect(lies(ASK)).toMatch(/normalizeFragekontext\(request\.body\.fragekontext\)/);
  });
});

describe("nodemailer 6.10.1 — was smtp.ts tatsächlich übergibt", () => {
  const smtp = lies(SMTP);
  const versand = block(smtp, "transport.sendMail(");
  const optionen = block(smtp, "nodemailer.createTransport(");

  it("N1 · die Empfängeradresse ist eine Zeichenkette und geht unverändert in den Parser", () => {
    expect(fundorte(SERVICES, /from\s+"nodemailer"/)).toEqual([SMTP]);
    const nachricht = block(lies("services/notifications/src/mailer.ts"), "interface MailMessage");
    expect(nachricht).toMatch(/\bto:\s*string;/);
    expect(versand).toMatch(/\bto:\s*message\.to,/);
  });

  it("N2 · sendMail erhält genau from, to, subject, text, html", () => {
    expect(schluessel(versand)).toEqual(["from", "to", "subject", "text", "html"]);
    expect(smtp).not.toMatch(/resolveContent|\braw\b|envelope|\blist\b|attachments/);
  });

  it("N3 · ein SMTP-Transport an einer Stelle: host, port, secure, auth = { user, pass }", () => {
    expect(fundorte(SERVICES, /createTransport\(/)).toEqual([SMTP]);
    expect(smtp.match(/createTransport\(/g) ?? []).toHaveLength(1);
    expect(smtp.match(/smtpMailer\(\{/g) ?? []).toHaveLength(1);
    expect(schluessel(optionen)).toEqual(["host", "port", "secure", "auth"]);
    expect(optionen).toMatch(/auth:\s*config\.user\s*\?\s*\{\s*user:\s*config\.user,\s*pass:/);
    expect(smtp).not.toMatch(/OAuth2|jsonTransport|streamTransport|\bname:/);
  });
});

describe("sharp 0.35.5 — SVG-Import bleibt erhalten, librsvg wird erreicht (GHSA-wq5f)", () => {
  // Der Fall, in dem die Rasterung bisher griff: grösser als die Zielkante, und die Quelle ist
  // grösser als ihre WebP-Ableitung. Kleinere SVGs blieben schon vorher unverändert
  // (`schon-klein-genug` bzw. `ableitung-nicht-kleiner`) und fielen dann im Sanitizer weg.
  const breite = BILD_MAX_KANTE * 2;
  const fuellung = `<!-- ${"Beschreibung ".repeat(20_000)} -->`;
  const SVG =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${BILD_MAX_KANTE}">` +
    `<rect width="${breite}" height="${BILD_MAX_KANTE}" fill="#2a6f97"/>${fuellung}</svg>`;
  const src = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;

  it("S1 · ein SVG aus dem Importweg wird zu WebP gerastert und überlebt den Sanitizer", async () => {
    const weg = bildVerkleinerung();
    const ausgang = await weg.mapImage(src);
    expect(ausgang.startsWith("data:image/webp;base64,"), ausgang.slice(0, 40)).toBe(true);
    expect(weg.bericht.verkleinert).toBe(1);
    expect(weg.bericht.ausfaelle).toEqual([]);
    const kopf = await sharp(Buffer.from(ausgang.split(",")[1] ?? "", "base64")).metadata();
    expect(kopf.format).toBe("webp");
    expect(Math.max(kopf.width ?? 0, kopf.height ?? 0)).toBe(BILD_MAX_KANTE);
    // Das sanitisierte Ergebnis trägt das Bild weiter …
    const sauber = sanitizeHtml(`<p><img src="${ausgang}" alt="Plan"></p>`);
    expect(sauber).toContain('src="data:image/webp;base64,');
    // … während die SVG-Quelle selbst entfernt würde: die Rasterung ist der Weg zur Anzeige.
    expect(sanitizeHtml(`<p><img src="${src}" alt="Plan"></p>`)).not.toContain("image/svg");
  });

  it("S2 · Bedingung der Meldung: sharp liest diese Quelle als SVG, also über librsvg", async () => {
    const kopf = await sharp(Buffer.from(SVG)).metadata();
    expect(kopf.format).toBe("svg");
  });
});

/** Alle Moduldateien, die beim Laden von mammoth aus `paketJson` heraus geladen werden. */
function modulgraph(paketJson: string): { haupt: string; dateien: string[] } {
  const laden = createRequire(join(WURZEL, paketJson));
  const haupt = laden.resolve("mammoth");
  laden("mammoth");
  const gesehen = new Set<string>();
  const stapel = [laden.cache[haupt]];
  while (stapel.length > 0) {
    const modul = stapel.pop();
    if (!modul || gesehen.has(modul.filename)) {
      continue;
    }
    gesehen.add(modul.filename);
    stapel.push(...modul.children);
  }
  return { haupt, dateien: [...gesehen] };
}

/** Die Fassung von @xmldom/xmldom, die mammoth an seinem Ort auflöst. */
function xmldomFassung(haupt: string): string {
  let ort = dirname(createRequire(haupt).resolve("@xmldom/xmldom"));
  while (!ort.endsWith(join("@xmldom", "xmldom"))) {
    if (dirname(ort) === ort) {
      throw new Error("@xmldom/xmldom: Paketverzeichnis nicht gefunden");
    }
    ort = dirname(ort);
  }
  const paket = JSON.parse(readFileSync(join(ort, "package.json"), "utf8")) as { version: string };
  return paket.version;
}

const BESTAENDE = [
  { bestand: "wurzel", paket: "package.json", ort: "node_modules/mammoth/" },
  { bestand: "web", paket: "apps/web/package.json", ort: "apps/web/node_modules/mammoth/" },
] as const;

describe("mammoth → argparse → sprintf-js / @xmldom/xmldom — zur Laufzeit gemessen", () => {
  for (const { bestand, paket, ort } of BESTAENDE) {
    it(`M1 · ${bestand}: argparse und sprintf-js geraten nicht in mammoths Modulgraphen`, () => {
      const { haupt, dateien } = modulgraph(paket);
      expect(relative(WURZEL, haupt).split("\\").join("/")).toContain(ort);
      // Kalibrierung: der Graph ist nicht leer, er enthält mammoths eigene Bibliothek.
      const eigene = dateien.filter((d) => d.includes(join("mammoth", "lib")));
      expect(eigene.length).toBeGreaterThan(5);
      expect(dateien.filter((d) => /[\\/](argparse|sprintf-js)[\\/]/.test(d))).toEqual([]);
    });

    it(`M2 · ${bestand}: mammoth lädt @xmldom/xmldom 0.8.15 (alle zehn Meldungen ≤ 0.8.14)`, () => {
      const haupt = createRequire(join(WURZEL, paket)).resolve("mammoth");
      expect(relative(WURZEL, haupt).split("\\").join("/")).toContain(ort);
      expect(xmldomFassung(haupt)).toBe("0.8.15");
    });
  }
});

describe("react-router 6.30.4 — SSR und Navigationsziele", () => {
  it("R1 · keine SSR-Hydration im Produktcode der Oberfläche", () => {
    const ssr = /hydrateRoot|StaticRouter|createStaticHandler|createStaticRouter/;
    expect(fundorte(WEB, ssr)).toEqual([]);
  });

  it("R2 · kein Navigationsziel wird direkt aus einem URL-Parameter gesetzt", () => {
    const quelle = String.raw`(params|parameter|searchParams)\.get`;
    const ziel = new RegExp(String.raw`navigate\([^)]*${quelle}|to=\{[^}]*${quelle}`);
    expect(fundorte(WEB, ziel)).toEqual([]);
  });

  it("R3 · internerPfad lässt nur eindeutig interne Pfade durch", () => {
    for (const gut of ["/start", "/wissen/ko-1?edit=1", "/bibliothek?q=a%2Fb#x"]) {
      expect(internerPfad(gut, "/ersatz"), gut).toBe(gut);
    }
    const boese = [
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "start",
      "",
      undefined,
      null,
      42,
    ];
    for (const b of boese) {
      expect(internerPfad(b, "/ersatz"), String(b)).toBe("/ersatz");
    }
  });

  it("R4 · die zwei Ziele aus location.pathname laufen durch internerPfad — und nur sie lesen ihn", () => {
    // Vollständige Erhebung (08.10.2026, 155 Navigationsstellen): alle übrigen Ziele sind
    // Konstanten, feste Konfigurationslisten oder Vorlagen mit festem Anfang. Liest eine weitere Stelle
    // `location.state`, ist die Erhebung neu zu machen.
    const leser = WEB.filter((d) =>
      lies(d)
        .split("\n")
        .some((z) => !/^\s*(\/\/|\*|\{\/\*)/.test(z) && /location\.state\b/.test(z)),
    );
    expect(leser).toEqual(["apps/web/src/pages/Mobile.tsx"]);
    const mobil = lies("apps/web/src/pages/Mobile.tsx");
    expect(mobil).toMatch(/const vorherigeRoute = \(location\.state as/);
    expect(mobil).toContain("const backTo = internerPfad(vorherigeRoute, HOME_ROUTE);");
    expect(mobil.match(/vorherigeRoute/g) ?? []).toHaveLength(2);
    const vorschau = lies("apps/web/src/components/klara-vorschau/KlaraVorschau.tsx");
    const herkunft = block(vorschau, "function herkunftZiel(");
    expect(herkunft).toMatch(/internerPfad\(h\.pfad, HOME_ROUTE\)/);
  });
});
