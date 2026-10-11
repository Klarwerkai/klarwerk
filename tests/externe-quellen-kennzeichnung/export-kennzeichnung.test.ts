// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-0205 — AUCH DIE EXPORTE KENNZEICHNEN.
// ================================================================================================
//
// Bens Befund (Nacharbeit 14): Der integrierte Exportauftrag R-0706 nennt in Markdown, MediaWiki und
// HTML die Quellen einer Aussage — aber ohne ihren Prüfstand (`exportQuellen` übernahm nur
// Bezeichnung, Anbieter, Adresse, Löschstatus). Eine externe, ungeprüfte Quelle stand in der Datei
// genauso da wie eine von Kollegen bestätigte. R-0205: „Extern stammende Inhalte sollen überall
// einen Herkunfts-Hinweis ‚Extern · ungeprüft' tragen" — und das Etikett „Stufe 2".
//
// GEMESSEN über die echte Route `GET /api/library/export?format=…` (`library-routes.ts`), je Format
// an der Zeile GENAU dieser Quelle, mit drei Quellen:
//   · extern, `peerValidated: false`            → „Stufe 2" UND „Extern · ungeprüft"
//   · Altbestand OHNE `peerValidated`-Feld       → dasselbe (fail-closed wie die Anzeige)
//   · peer-validiert, `peerValidated: true`      → KEINE Kennzeichnung (Gegenprobe)
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KoSource } from "../../services/knowledge-object/src/types";

const STUFE = "Stufe 2";
const HERKUNFT = "Extern · ungeprüft";

function quelle(id: string, label: string, peerValidated: boolean | undefined): KoSource {
  const roh: Record<string, unknown> = {
    id,
    label,
    url: `https://intranet.example/${id}`,
    excerpt: null,
    kind: "external",
    author: "admin",
    at: "2026-09-01T08:00:00.000Z",
  };
  // Der Altbestand trägt das Feld WIRKLICH nicht — nicht `undefined` als Wert.
  if (peerValidated !== undefined) {
    roh.peerValidated = peerValidated;
  }
  return roh as unknown as KoSource;
}

const EXTERN = "Lexikonartikel Dichtung";
const ALT = "Altbestand Handbuch Dichtung";
const GEPRUEFT = "Betriebsanweisung Dichtung";

async function exportiere(format: "markdown" | "mediawiki" | "html"): Promise<string> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "ek-admin@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ek-admin@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  const ko = await services.ko.create({
    title: "Dichtung tauschen",
    statement: "Die Dichtung wird nach 500 Betriebsstunden getauscht.",
    type: "best_practice",
    category: "Anlage 1",
    author: "admin",
    tags: [],
    sources: [
      quelle("q-extern", EXTERN, false),
      quelle("q-alt", ALT, undefined),
      quelle("q-geprueft", GEPRUEFT, true),
    ],
  });
  await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });

  const res = await app.inject({
    method: "GET",
    url: `/api/library/export?format=${format}&ids=${ko.id}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.body;
}

/** Die Zeile (Markdown/MediaWiki) bzw. der Listenpunkt (HTML) GENAU dieser Quelle. */
function eintrag(text: string, format: string, label: string): string {
  const teile = format === "html" ? text.split("<li>") : text.split("\n");
  const treffer = teile.filter((t) => t.includes(label));
  expect(treffer, `${format}: die Quelle „${label}" steht nicht genau einmal da`).toHaveLength(1);
  return treffer[0] ?? "";
}

describe("R-0205 · Exporte kennzeichnen nicht peer-validierte Quellen", () => {
  for (const format of ["markdown", "mediawiki", "html"] as const) {
    it(`${format}: ungeprüft und Altbestand tragen beide Etiketten, peer-validiert keines`, async () => {
      const text = await exportiere(format);

      for (const label of [EXTERN, ALT]) {
        const zeile = eintrag(text, format, label);
        expect(zeile, `${format}: „${label}" ohne „${STUFE}"`).toContain(STUFE);
        expect(zeile, `${format}: „${label}" ohne „${HERKUNFT}"`).toContain(HERKUNFT);
      }

      const geprueft = eintrag(text, format, GEPRUEFT);
      const meldung = `${format}: die peer-validierte Quelle ist gekennzeichnet`;
      expect(geprueft, meldung).not.toContain(STUFE);
      expect(geprueft, meldung).not.toContain(HERKUNFT);
    });
  }

  it("Kennzeichnung steht AUSSERHALB des Verweises (MediaWiki) bzw. als lesbarer Text (HTML)", async () => {
    const wiki = eintrag(await exportiere("mediawiki"), "mediawiki", EXTERN);
    expect(wiki).toBe(`* [https://intranet.example/q-extern ${EXTERN}] — ${STUFE} · ${HERKUNFT}`);
    const html = eintrag(await exportiere("html"), "html", EXTERN);
    expect(html).toContain(`<span class="kennung">${STUFE}</span>`);
    expect(html).toContain(`<span class="kennung">${HERKUNFT}</span>`);
  });
});
