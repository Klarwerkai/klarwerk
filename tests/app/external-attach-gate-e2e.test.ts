import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  attributeExternalSource,
  classifySourceReach,
  decideExternalAttach,
  externalAttachAllowed,
  parseInternalSourceOrigins,
} from "../../services/external-search";
import { safeSourceUrl } from "../../services/knowledge-object/src/source-url";

// AUFTRAG-mega14 Block D → mega15 Block B → AUFTRAG-mega16 Block A: DIE STUFE WIRD EINE GRENZE.
//
// mega14 schloss die erste Hälfte: `externalAttachAllowed(stage)` war definiert, exportiert und
// wurde von NIEMANDEM aufgerufen — die Stufe „suchen, aber nicht anhängen" war wirkungslos.
//
// mega15 schloss die zweite: die Sperre hing an `body.source.provider`, einem vom Client frei
// gesetzten Feld. Der Server leitet die Herkunft seither aus der ADRESSE ab.
//
// mega16 schließt die DRITTE und entscheidende: mega15 prüfte die Stufe nur bei ERKANNTEM
// Provider. Lieferte die Ableitung `null`, ging die Quelle UNGEACHTET der Stufe durch — über einen
// Spiegel, einen Kurzlink, einen beliebigen anderen öffentlichen Host oder ganz ohne Adresse.
// bens Urteil: „Das sind keine Parsertricks, sondern der entscheidende semantische Bypass."
//
// PEDIS VERTRAG (25.07.2026), fail-closed. Jede Zeile dieser Tabelle hat unten einen benannten
// Beleg — und jede Zeile sagt „VERBOTEN, außer es gibt einen POSITIVEN Beleg für intern":
//
//   Stufe            | öffentl. Adresse | interne Adresse | ohne Adresse, | ohne Adresse,
//                    |                  | (Allowlist)     | MIT Anker     | OHNE Anker
//   -----------------+------------------+-----------------+---------------+--------------
//   blocked          | 403              | 200             | 200           | 403
//   search_on_click  | 403              | 200             | 200           | 403
//   search_attach    | 200              | 200             | 200           | 200
//   open             | 200              | 200             | 200           | 200
//
// „Anker" = die Quelle nennt eine `objectId`, die der Server in der ANHANGSLISTE DIESES
// Wissensobjekts wiederfindet. Kein Client-Feld, das geglaubt wird, sondern eines, das nachge-
// schlagen wird. Die Allowlist interner Origins kommt aus der Konfiguration
// (KLARWERK_INTERNAL_SOURCE_ORIGINS), nie aus dem Code.

type App = ReturnType<typeof buildApp>;

const INTERNE_ORIGINS = "intranet.werk.local, https://confluence.werk.local/";
const INTERNE_ADRESSE = "https://confluence.werk.local/pages/WN4711";
const TREFFER_URL = "https://de.wikipedia.org/wiki/Dichtung_(Technik)";

// Der Server liest die Allowlist beim Bauen der App aus der Umgebung. Alle Läufe dieser Datei
// arbeiten deshalb mit DERSELBEN, ausdrücklich gesetzten Konfiguration — und stellen sie danach
// zurück, damit kein anderer Test von ihr abhängt.
let vorher: string | undefined;
beforeEach(() => {
  vorher = process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = INTERNE_ORIGINS;
});
afterEach(() => {
  if (vorher === undefined) {
    delete process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  } else {
    process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = vorher;
  }
});

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(stage?: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  if (stage) {
    const put = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage },
    });
    expect(put.statusCode).toBe(200);
  }
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  return { app, headers, koId: ko.json().id as string };
}

function attach(
  app: App,
  headers: Record<string, string>,
  koId: string,
  source: Record<string, unknown>,
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "add-source", source },
  });
}

async function sourcesOf(app: App, headers: Record<string, string>, koId: string) {
  const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  return (ko.json().sources ?? []) as { label: string; url: string | null; provider?: string }[];
}

// Legt ein echtes Dokument in den Object-Store und hängt es ans KO — DAS ist der Anker, den der
// Server später nachschlägt. Bewusst über die ECHTEN Routen: ein direkt in den Bestand
// geschriebener Anhang würde die Prüfung umgehen, die hier belegt werden soll.
const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

async function ankerAnlegen(app: App, headers: Record<string, string>, koId: string) {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  const objectId = obj.json().id as string;
  const attached = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: {
      action: "attach",
      attachment: { name: "Pruefbericht.pdf", mime: "application/pdf", objectId },
    },
  });
  expect(attached.statusCode).toBe(200);
  return objectId;
}

// Die vier Quellenformen der Vertragstabelle.
const OEFFENTLICHE_QUELLE = {
  label: "Dichtung (Technik)",
  url: TREFFER_URL,
  excerpt: "Eine Dichtung verhindert oder begrenzt den Stoffübergang …",
};
const INTERNE_QUELLE = { label: "Werksnorm WN-4711", url: INTERNE_ADRESSE };
const ADRESSLOSE_QUELLE = { label: "Pruefbericht.pdf", excerpt: "Abschnitt 3.2, Absatz 4" };

// =============================================================================================
// 1. DIE VERTRAGSTABELLE — je Zeile ein benannter Beleg, über die ECHTEN Routen.
// =============================================================================================
describe("mega16 Block A: der Vertrag — 16 Zeilen, 16 Belege", () => {
  const RESTRIKTIV = ["blocked", "search_on_click"] as const;
  const OFFEN = ["search_attach", "open"] as const;

  for (const stage of RESTRIKTIV) {
    it(`ZEILE ${stage} / öffentliche Adresse → 403`, async () => {
      const { app, headers, koId } = await setup(stage);
      const res = await attach(app, headers, koId, OEFFENTLICHE_QUELLE);
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("EXTERNAL_ATTACH_BLOCKED");
      expect(res.json().reason).toBe("public-source");
      expect(res.json().stage).toBe(stage);
      expect(await sourcesOf(app, headers, koId)).toHaveLength(0);
    });

    it(`ZEILE ${stage} / interne Adresse aus der Allowlist → 200`, async () => {
      const { app, headers, koId } = await setup(stage);
      const res = await attach(app, headers, koId, INTERNE_QUELLE);
      expect(res.statusCode).toBe(200);
      const sources = await sourcesOf(app, headers, koId);
      expect(sources).toHaveLength(1);
      expect(sources[0]?.url).toBe(INTERNE_ADRESSE);
    });

    it(`ZEILE ${stage} / ohne Adresse, MIT Anker auf ein hinterlegtes Dokument → 200`, async () => {
      const { app, headers, koId } = await setup(stage);
      const objectId = await ankerAnlegen(app, headers, koId);
      const res = await attach(app, headers, koId, { ...ADRESSLOSE_QUELLE, objectId });
      expect(res.statusCode).toBe(200);
      expect(await sourcesOf(app, headers, koId)).toHaveLength(1);
    });

    it(`ZEILE ${stage} / ohne Adresse, OHNE Anker → 403`, async () => {
      const { app, headers, koId } = await setup(stage);
      const res = await attach(app, headers, koId, ADRESSLOSE_QUELLE);
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("EXTERNAL_ATTACH_BLOCKED");
      expect(res.json().reason).toBe("unanchored-source");
      expect(await sourcesOf(app, headers, koId)).toHaveLength(0);
    });
  }

  for (const stage of OFFEN) {
    it(`ZEILE ${stage} / alle vier Formen → 200, unverändert`, async () => {
      const { app, headers, koId } = await setup(stage);
      const objectId = await ankerAnlegen(app, headers, koId);
      for (const source of [
        OEFFENTLICHE_QUELLE,
        INTERNE_QUELLE,
        { ...ADRESSLOSE_QUELLE, objectId },
        // Auch OHNE Anker: auf diesen Stufen ist Anhängen ausdrücklich erlaubt, es gibt nichts
        // zu prüfen. Der Anker ist eine AUSNAHME von der Sperre, keine neue Pflicht.
        { label: "Handnotiz ohne alles" },
      ]) {
        const res = await attach(app, headers, koId, source);
        expect(res.statusCode, `Stufe ${stage}, Quelle ${source.label}`).toBe(200);
      }
      expect(await sourcesOf(app, headers, koId)).toHaveLength(4);
    });
  }

  it("die Herkunft wird weiterhin SERVERSEITIG vermerkt (mega15 bleibt unangetastet)", async () => {
    const { app, headers, koId } = await setup("search_attach");
    const res = await attach(app, headers, koId, OEFFENTLICHE_QUELLE);
    expect(res.statusCode).toBe(200);
    const sources = await sourcesOf(app, headers, koId);
    // Der Vermerk stammt aus der Ableitung, nicht aus der Nutzlast — die trug kein Feld dafür.
    expect(sources[0]?.provider).toBe("Wikipedia");
  });
});

// =============================================================================================
// 2. DER BEFUND, DEN MEGA15 OFFEN LIESS — Spiegel, Kurzlink, beliebiger Fremdhost.
// =============================================================================================
describe("mega16 Block A: bens semantischer Bypass ist geschlossen", () => {
  // bens Wortlaut: „ueber einen anderen oeffentlichen Host, einen Kurz-/Redirect-Link, einen
  // Mirror oder ohne URL als vermeintlich manuelle Quelle angehaengt werden."
  const UMGEHUNGEN = [
    ["Spiegel", "https://wikiwand.com/de/Dichtung_(Technik)"],
    ["Kurzlink", "https://w.wiki/abcd"],
    ["Redirector", "https://t.co/xYz123"],
    ["beliebiger Fremdhost", "https://blog.example.com/dichtungen"],
    // Nicht auf der Allowlist eingetragen → öffentlich. „Privat" ist keine Eigenschaft, die
    // dieser Server am Hostnamen ablesen kann; fail-closed heißt hier: nicht raten.
    ["Loopback ohne Eintrag", "http://127.0.0.1:8080/artikel"],
    ["privates Netz ohne Eintrag", "http://192.168.1.10/wiki/x"],
  ] as const;

  for (const [name, url] of UMGEHUNGEN) {
    it(`${name} ging bis mega15 durch und wird jetzt auf search_on_click abgewiesen`, async () => {
      const { app, headers, koId } = await setup("search_on_click");
      const res = await attach(app, headers, koId, { label: "Dichtung", url });
      expect(res.statusCode, url).toBe(403);
      expect(res.json().reason).toBe("public-source");
      expect(await sourcesOf(app, headers, koId)).toHaveLength(0);
    });
  }

  it("DER UMGEDREHTE TEST: die adresslose Quelle war bis mega15 als ERLAUBNIS festgeschrieben", async () => {
    // Bis mega15 stand hier „eigene Quellen und Datei-Belegstellen bleiben auf JEDER Stufe
    // erlaubt" — und der Test bewies genau den Weg, den ben als Bypass benennt. Jetzt gilt der
    // umgekehrte Satz, und zwar für BEIDE restriktiven Stufen.
    for (const stage of ["blocked", "search_on_click"]) {
      const { app, headers, koId } = await setup(stage);
      const res = await attach(app, headers, koId, ADRESSLOSE_QUELLE);
      expect(res.statusCode, `Stufe ${stage}`).toBe(403);
      expect(res.json().reason).toBe("unanchored-source");
    }
  });

  it("ein ERFUNDENER Anker hebt die Sperre nicht auf — der Server schlägt ihn nach", async () => {
    const { app, headers, koId } = await setup("search_on_click");
    // Ein Objekt, das es gar nicht gibt; und eines, das existiert, aber an KEINEM Anhang hängt.
    const fremd = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "fremd.pdf", mime: "application/pdf", data: PDF_DATA_URL },
    });
    for (const objectId of ["gibt-es-nicht", fremd.json().id as string]) {
      const res = await attach(app, headers, koId, { ...ADRESSLOSE_QUELLE, objectId });
      expect(res.statusCode, `objectId=${objectId}`).toBe(403);
      expect(res.json().reason).toBe("unanchored-source");
    }
  });

  it("ein Anker auf den Anhang eines FREMDEN Wissensobjekts zählt nicht", async () => {
    const { app, headers, koId } = await setup("search_on_click");
    const zweites = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Anderes Objekt",
        statement: "Egal.",
        type: "best_practice",
        category: "X",
      },
    });
    const fremdesKo = zweites.json().id as string;
    const objectId = await ankerAnlegen(app, headers, fremdesKo);
    // Derselbe, real existierende und real angehängte Anker — aber am FALSCHEN Objekt.
    const res = await attach(app, headers, koId, { ...ADRESSLOSE_QUELLE, objectId });
    expect(res.statusCode).toBe(403);
    expect(res.json().reason).toBe("unanchored-source");
  });

  it("die Sperre hängt an der Stufe, nicht am Rollenrecht — der Admin selbst wird abgewiesen", async () => {
    const { app, headers, koId } = await setup("search_on_click");
    expect((await attach(app, headers, koId, OEFFENTLICHE_QUELLE)).statusCode).toBe(403);
    await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage: "search_attach" },
    });
    expect((await attach(app, headers, koId, OEFFENTLICHE_QUELLE)).statusCode).toBe(200);
  });

  it("SUCHEN bleibt auf search_on_click möglich — genau das ist der Sinn der Stufe", async () => {
    const { app, headers } = await setup("search_on_click");
    const res = await app.inject({
      method: "GET",
      url: "/api/external/search?q=Dichtung",
      headers,
    });
    // Kein 403: die Suche ist NICHT gesperrt. Ob ein Proxy konfiguriert ist, ist eine andere
    // Frage (501) — sie darf hier nicht mit der Stufen-Sperre verwechselt werden.
    expect(res.statusCode).not.toBe(403);
  });

  it("WEG 2 (Erfassen, Warteliste beim Einreichen): jeder Treffer einzeln → jeder 403", async () => {
    const { app, headers, koId } = await setup("search_on_click");
    for (const source of [
      OEFFENTLICHE_QUELLE,
      { label: "Flachdichtung", url: "https://de.wikipedia.org/wiki/Flach" },
    ]) {
      const res = await attach(app, headers, koId, source);
      expect(res.statusCode).toBe(403);
    }
    expect(await sourcesOf(app, headers, koId)).toHaveLength(0);
  });

  it("NEGATIV (mega15): ein GEFÄLSCHTES Herkunftsfeld erzeugt keinen Herkunftsvermerk", async () => {
    const { app, headers, koId } = await setup("open");
    const res = await attach(app, headers, koId, {
      label: "Werksnorm WN-4711",
      url: INTERNE_ADRESSE,
      provider: "Wikipedia",
    });
    expect(res.statusCode).toBe(200);
    const sources = await sourcesOf(app, headers, koId);
    expect(sources[0]?.provider ?? null).toBeNull();
  });
});

// =============================================================================================
// 3. DER AUSLIEFERUNGSZUSTAND — ohne Konfiguration ist die Liste leer, und dann ist alles zu.
// =============================================================================================
describe("mega16 Block A: ohne konfigurierte Allowlist ist der Auslieferungszustand geschlossen", () => {
  it("dieselbe interne Adresse wird ohne Eintrag als öffentlich behandelt", async () => {
    delete process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
    const { app, headers, koId } = await setup("search_on_click");
    const res = await attach(app, headers, koId, INTERNE_QUELLE);
    expect(res.statusCode).toBe(403);
    expect(res.json().reason).toBe("public-source");
  });
});

// =============================================================================================
// 4. DIE REGRESSIONEN, die ben als „heute korrekt, aber NICHT als Vertrag gepinnt" benennt.
// =============================================================================================
describe("mega16 Block A: die Syntaxfallen sind als Vertrag gepinnt", () => {
  const ALLOW = ["intranet.werk.local", "confluence.werk.local"];

  it("Unicode/Punycode: ein Homograph ist NICHT der eingetragene Host", () => {
    // „intranet.werk.local" mit kyrillischem „а" — `new URL` normalisiert zu Punycode, das
    // matcht keinen ASCII-Eintrag. Ohne diese Normalisierung wäre es eine stille Erlaubnis.
    expect(classifySourceReach("https://intrаnet.werk.local/x", ALLOW)).toBe("public");
    expect(classifySourceReach("https://xn--intrnet-o1a.werk.local/x", ALLOW)).toBe("public");
    // Und derselbe Fall bei der Herkunftsableitung aus mega15.
    expect(attributeExternalSource("https://de.wikipediа.org/wiki/X")).toBeNull();
  });

  it("rohe IP: matcht nur bei exaktem Eintrag, nie über die Punktgrenze", () => {
    expect(classifySourceReach("http://10.0.0.5/x", ALLOW)).toBe("public");
    expect(classifySourceReach("http://10.0.0.5/x", ["10.0.0.5"])).toBe("internal");
    // Kein Suffix-Match auf Ziffern: 110.0.0.5 endet zwar auf „0.0.5", aber nicht auf „.10.0.0.5".
    expect(classifySourceReach("http://110.0.0.5/x", ["10.0.0.5"])).toBe("public");
  });

  it("abweichender Port ändert den Hostnamen nicht — die Einstufung bleibt", () => {
    expect(classifySourceReach("https://confluence.werk.local:8443/x", ALLOW)).toBe("internal");
    expect(classifySourceReach("https://de.wikipedia.org:8443/x", ALLOW)).toBe("public");
    // Konservativ auch bei der Herkunftsableitung: ein abweichender Port bleibt Wikipedia und
    // wird damit auf restriktiver Stufe geblockt, statt unerkannt durchzugehen.
    expect(attributeExternalSource("https://de.wikipedia.org:8443/wiki/X")).toBe("Wikipedia");
  });

  it("Punktgrenze, FQDN-Punkt, Userinfo und Pfad — die bekannten Tricks", () => {
    expect(classifySourceReach("https://confluence.werk.local./x", ALLOW)).toBe("internal");
    expect(classifySourceReach("https://sub.confluence.werk.local/x", ALLOW)).toBe("internal");
    // Suffix-Anhängsel: die Seite kommt real von evil.example.
    expect(classifySourceReach("https://confluence.werk.local.evil.example/x", ALLOW)).toBe(
      "public",
    );
    // Userinfo vor dem @: der Hostname ist evil.example.
    expect(classifySourceReach("https://confluence.werk.local@evil.example/x", ALLOW)).toBe(
      "public",
    );
    // Im Pfad, nicht im Host.
    expect(classifySourceReach("https://evil.example/confluence.werk.local/x", ALLOW)).toBe(
      "public",
    );
    // Ohne Punktgrenze kein Match.
    expect(classifySourceReach("https://notconfluence.werk.local/x", ALLOW)).toBe("public");
  });
});

// =============================================================================================
// 5. DIE REINE ENTSCHEIDUNG — und die Gleichheit mit der Persistenzgrenze.
// =============================================================================================
describe("mega16 Block A: Einstufung, Allowlist-Parser und Entscheidung", () => {
  it("die Allowlist kommt aus der Konfiguration und verwirft Unbrauchbares, statt zu raten", () => {
    expect(
      parseInternalSourceOrigins("intranet.werk.local, https://confluence.werk.local/"),
    ).toEqual(["intranet.werk.local", "confluence.werk.local"]);
    // Gross-/Kleinschreibung und FQDN-Punkt normalisiert; Duplikate einmal.
    expect(parseInternalSourceOrigins("INTRANET.Werk.Local., intranet.werk.local")).toEqual([
      "intranet.werk.local",
    ]);
    // Ein Tippfehler darf keine Tür aufmachen: punktlose Platzhalter und Müll fliegen raus.
    for (const raw of [undefined, null, "", "   ", ",,,", "*", "localhost", ".", "ht tp://x"]) {
      expect(parseInternalSourceOrigins(raw), String(raw)).toEqual([]);
    }
  });

  it("keine speicherbare Adresse heisst hier dasselbe wie an der Persistenzgrenze", () => {
    // safeSourceUrl (services/knowledge-object/src/source-url.ts) entscheidet, was ÜBERHAUPT als
    // Adresse in den Bestand kommt. Beide Urteile müssen sich decken — sonst gäbe es eine Klasse
    // von Werten, die das Gate als „hat eine Adresse" liest und der Bestand als „hat keine".
    for (const raw of [
      "",
      "   ",
      "kein-url",
      "/relativ/x",
      "foo/bar",
      "//host/x",
      "javascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<b>x</b>",
      "file:///etc/passwd",
      "vbscript:msgbox",
    ]) {
      expect(safeSourceUrl(raw), `safeSourceUrl ${raw}`).toBeNull();
      expect(classifySourceReach(raw, ["intranet.werk.local"]), `reach ${raw}`).toBe("unaddressed");
    }
    // Und umgekehrt: was gespeichert wird, ist auch für das Gate eine Adresse.
    for (const raw of ["http://x.example/a", "https://intranet.werk.local/a"]) {
      expect(safeSourceUrl(raw)).not.toBeNull();
      expect(classifySourceReach(raw, ["intranet.werk.local"])).not.toBe("unaddressed");
    }
    // Nicht-Zeichenketten sind ebenfalls adresslos.
    for (const raw of [undefined, null, 42, {}, []]) {
      expect(classifySourceReach(raw, []), String(raw)).toBe("unaddressed");
    }
  });

  it("die Entscheidung selbst: 16 Zeilen, keine stille siebzehnte", () => {
    const erwartet: Record<string, Record<string, boolean>> = {
      blocked: { internal: true, public: false, "unaddressed+anker": true, unaddressed: false },
      search_on_click: {
        internal: true,
        public: false,
        "unaddressed+anker": true,
        unaddressed: false,
      },
      search_attach: { internal: true, public: true, "unaddressed+anker": true, unaddressed: true },
      open: { internal: true, public: true, "unaddressed+anker": true, unaddressed: true },
    };
    for (const [stage, zeilen] of Object.entries(erwartet)) {
      for (const [fall, soll] of Object.entries(zeilen)) {
        const reach = fall.startsWith("unaddressed") ? "unaddressed" : fall;
        const decision = decideExternalAttach({
          stage: stage as "blocked",
          reach: reach as "public",
          anchoredToOwnAttachment: fall.endsWith("+anker"),
        });
        expect(decision.allowed, `${stage} / ${fall}`).toBe(soll);
        if (!soll) {
          expect(decision.denial).toBe(reach === "public" ? "public-source" : "unanchored-source");
        }
      }
    }
  });

  it("die alte Regel bleibt als Kurzform gültig — search_attach und open sind die offenen Stufen", () => {
    expect(externalAttachAllowed("blocked")).toBe(false);
    expect(externalAttachAllowed("search_on_click")).toBe(false);
    expect(externalAttachAllowed("search_attach")).toBe(true);
    expect(externalAttachAllowed("open")).toBe(true);
  });

  // DIE GEGENPROBE: derselbe Prüfstand, angesetzt auf die ALTE Regel von mega15 — sie muss
  // durchfallen. Ohne diesen Fall wäre nicht belegt, dass ein grüner Lauf oben etwas bedeutet.
  it("GEGENPROBE — die mega15-Regel (nur erkannte Provider pruefen) faellt an dieser Tabelle durch", () => {
    const mega15 = (url: string, stage: string): boolean =>
      attributeExternalSource(url) === null ? true : stage === "search_attach" || stage === "open";
    // Genau bens vier Umgehungen: mega15 sagt „erlaubt", mega16 sagt „verboten".
    for (const url of [
      "https://wikiwand.com/de/Dichtung",
      "https://w.wiki/abcd",
      "https://t.co/xYz123",
      "https://blog.example.com/dichtungen",
    ]) {
      expect(mega15(url, "search_on_click"), `mega15 ließ ${url} durch`).toBe(true);
      expect(
        decideExternalAttach({
          stage: "search_on_click",
          reach: classifySourceReach(url, ["intranet.werk.local"]),
          anchoredToOwnAttachment: false,
        }).allowed,
        `mega16 muss ${url} sperren`,
      ).toBe(false);
    }
    // Und die adresslose Quelle: mega15 erlaubt, mega16 nur mit Anker.
    expect(mega15("", "blocked")).toBe(true);
    expect(
      decideExternalAttach({
        stage: "blocked",
        reach: "unaddressed",
        anchoredToOwnAttachment: false,
      }).allowed,
    ).toBe(false);
  });
});
