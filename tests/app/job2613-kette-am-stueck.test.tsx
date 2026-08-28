// @vitest-environment jsdom
// ================================================================================================
// JOB 2613 · D4 — DIE KETTE AM STÜCK: von der echten .docx bis zum GERENDERTEN Entwurf.
// ================================================================================================
//
// BENs Rotgrund zu D3, wörtlich:
//
//   „CODE ist GRÜN, die Substanz ist ROT, weil der vorgelegte Test den verpflichtenden Weg
//    echte `.docx` → neue Route → `capture.createDraft` → gespeicherter und gerenderter Entwurf
//    NICHT belegt."
//
// Er hat recht: D3 prüfte die Teile einzeln — den Kern, den Zähler, die Gegenprobe. Was fehlte,
// war der Lauf von vorn bis hinten. Hier ist er, in EINEM Fall, mit sichtbarem Ende:
//
//     .docx-Bytes  →  POST /api/drafts/from-docx  →  capture.createDraft
//                  →  GET /api/drafts/:id (gespeichert)  →  <SanitizedHtml> (gerendert)
//                  →  die beiden Bilder EINZELN im DOM
//
// WARUM DAS ENDE WICHTIG IST, und nicht Formsache: `SanitizedHtml` ist „der einzige Ort mit
// dangerouslySetInnerHTML" (`SanitizedHtml.tsx:4-5`) und ruft `sanitizeHtml`. Ein Sanitizer, der
// `data:image`-Quellen verwirft, bräche die Kette GENAU HIER — nach einer grünen Route und einem
// gespeicherten Entwurf, in dem die Bilder noch stehen. D3 hätte das nicht gesehen.
//
// MACHART nach `RUECKGABE-PRO4-JOB-2614-D5`: ein Lauf von vorn bis hinten, an dessen Ende etwas
// Sichtbares steht — plus die Gegenprobe, die zeigt, dass ein fehlendes Bild auffiele.
//
// ZU DEN IMPORTPFADEN: React und react-dom werden über apps/web/node_modules geholt — das ist das
// Hausmuster der gemounteten Tests (tests/capture/mega69-bildweg-mounted.test.tsx:60-62). Ein
// Paketname-Import scheitert hier, weil diese Datei im Wurzelpaket liegt und React dort nicht
// aufgelöst wird (gemessen: „Failed to load url @testing-library/react").
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { describe, expect, it } from "vitest";
import { SanitizedHtml } from "../../apps/web/src/components/SanitizedHtml";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Mountet eine Komponente in einen echten DOM-Knoten und gibt ihn zurück. */
async function rendere(element: unknown): Promise<HTMLElement> {
  const wirt = document.createElement("div");
  document.body.appendChild(wirt);
  const wurzel = createRoot(wirt);
  await act(async () => {
    wurzel.render(element as never);
  });
  return wirt;
}

/** 1×1-PNG, rot. */
const PNG_ROT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
/** 1×1-PNG, blau — bewusst ANDERE Bytes, damit „zwei Bilder" nicht „zweimal dasselbe" heissen kann. */
const PNG_BLAU =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Echte .docx: ein Textabsatz und zwei eingebettete PNGs (rot, blau). */
const DOCX_MIT_ZWEI_BILDERN =
  "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";

/** Dieselbe Bauart, aber OHNE Bildteile — die Gegenprobe. */
const DOCX_OHNE_BILDER =
  "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";

const ZUGANG = { name: "Admin", email: "a@x.de", password: "secret123" };

/** Eine echte App mit angemeldetem Nutzer — dieselbe Vorrichtung wie in den Nachbartests. */
async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token as string}` } };
}

/** Die einzelnen eingebetteten Bilddaten eines DOM-Baums — Base64-Rumpf je `<img>`. */
function bilderImDom(behaelter: HTMLElement): string[] {
  return [...behaelter.querySelectorAll("img")].map((b) => {
    const t = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(b.getAttribute("src") ?? "");
    return t?.[1] ?? "";
  });
}

describe("JOB 2613 · K · DIE KETTE AM STÜCK: .docx → Route → Entwurf → BILDSCHIRM", () => {
  it("K1 · zwei Bilder gehen von der Datei bis in den gerenderten Entwurf — einzeln nachweisbar", async () => {
    const { app, headers } = await angemeldeteApp();

    // ── Glied 1: die echte .docx an die neue Route ────────────────────────────────────────────
    const antwort = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: { name: "BAADER-Sonde.docx", data: DOCX_MIT_ZWEI_BILDERN },
    });
    expect(antwort.statusCode, "Die Route hat keinen Entwurf angelegt").toBe(201);
    const angelegt = antwort.json();

    // Die Route sagt selbst, was sie übernommen hat — das ist die Bilanz, die das Panel meldet.
    expect(angelegt.imagesTotal, "Die Quellbildzahl stimmt nicht").toBe(2);
    expect(angelegt.imagesEmbedded, "Es wurden nicht beide Bilder eingebettet").toBe(2);
    expect(angelegt.imagesDropped).toBe(0);

    // ── Glied 2: der Entwurf ist GESPEICHERT, nicht nur zurückgegeben ─────────────────────────
    const geladen = await app.inject({
      method: "GET",
      url: `/api/drafts/${angelegt.id as string}`,
      headers,
    });
    expect(geladen.statusCode, "Der Entwurf ist nicht abrufbar — er wurde nicht gespeichert").toBe(
      200,
    );
    // Der Entwurf trägt seine Inhalte im `payload` (`services/capture/src/types.ts:94-101`) —
    // nicht auf oberster Ebene. Ein erster Anlauf prüfte `gespeichert.origin` und war rot; das war
    // mein Lesefehler, kein Produktbefund.
    const gespeichert = geladen.json().payload;
    expect(gespeichert.origin, "Die Herkunft des Entwurfs ist nicht word_addin").toBe("word_addin");
    expect(typeof gespeichert.bodyHtml, "Der gespeicherte Entwurf trägt kein bodyHtml").toBe(
      "string",
    );

    // ── Glied 3: der gespeicherte Entwurf wird GERENDERT ──────────────────────────────────────
    // Dieselbe Komponente, die das Produkt für bodyHtml nutzt — inklusive Sanitizer.
    const container = await rendere(
      createElement(SanitizedHtml, { html: gespeichert.bodyHtml as string }),
    );

    // ── Das Ende der Kette: die Bilder sind am BILDSCHIRM, einzeln ────────────────────────────
    const gesehen = bilderImDom(container);
    expect(gesehen, "Im gerenderten Entwurf steht kein einziges Bild").toHaveLength(2);
    expect(gesehen[0], "Das ERSTE Bild (rot) fehlt im gerenderten Entwurf").toBe(PNG_ROT);
    expect(gesehen[1], "Das ZWEITE Bild (blau) fehlt im gerenderten Entwurf").toBe(PNG_BLAU);
    expect(new Set(gesehen).size, "Beide Bilder am Bildschirm tragen dieselben Bytes").toBe(2);

    // Und der Text der Quelle ist mitgereist — der Entwurf ist keine reine Bildergalerie.
    expect(container.textContent ?? "").toContain("BAADER Sonde Station 1");
  });

  it("K2 · DIE GEGENPROBE: ohne Bilder in der Quelle steht auch keines am Bildschirm", async () => {
    // BENs Bedingung aus §3 des Auftrags: „Ein Kettentest, der auch bei kaputter Kette grün wäre,
    // belegt nichts." Dieselbe Vorrichtung, dieselbe Kette — nur trägt die Quelle keine Bilder.
    // Bliebe K1 auch hier grün, wäre er blind.
    const { app, headers } = await angemeldeteApp();

    const antwort = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: { name: "Ohne-Bilder.docx", data: DOCX_OHNE_BILDER },
    });
    expect(antwort.statusCode).toBe(201);
    const angelegt = antwort.json();
    expect(angelegt.imagesTotal, "Die Gegenprobe meldet Quellbilder, die es nicht gibt").toBe(0);
    expect(angelegt.imagesEmbedded).toBe(0);

    const geladen = await app.inject({
      method: "GET",
      url: `/api/drafts/${angelegt.id as string}`,
      headers,
    });
    const container = await rendere(
      createElement(SanitizedHtml, { html: geladen.json().payload.bodyHtml as string }),
    );

    expect(bilderImDom(container), "Am Bildschirm steht ein Bild, das in der Quelle fehlt").toHaveLength(
      0,
    );
    // Der Text kommt trotzdem an — die Kette trägt, sie hat nur nichts zu tragen.
    expect(container.textContent ?? "").toContain("BAADER Sonde Station 1");
  });

  it("K3 · der Sanitizer ist das RISIKO der letzten Meile — hier wird es benannt", async () => {
    // Warum dieser Fall eigenständig steht: `SanitizedHtml` ist „der einzige Ort mit
    // dangerouslySetInnerHTML" und ruft `sanitizeHtml`. Verwürfe der Sanitizer künftig
    // `data:image`-Quellen, bräche die Kette GENAU HIER — bei grüner Route und gespeichertem
    // Entwurf, in dem die Bilder noch stehen. Dieser Fall vergleicht beide Seiten der Naht.
    const { app, headers } = await angemeldeteApp();
    const antwort = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: { name: "BAADER-Sonde.docx", data: DOCX_MIT_ZWEI_BILDERN },
    });
    const gespeichert = antwort.json().payload;

    // VOR dem Rendern: die Bilder stehen im gespeicherten bodyHtml.
    const imSpeicher = [
      ...(gespeichert.bodyHtml as string).matchAll(
        /<img[^>]+src="data:image\/[a-zA-Z0-9.+-]+;base64,([^"]+)"/g,
      ),
    ].map((t) => t[1] ?? "");
    expect(imSpeicher, "Schon der gespeicherte Entwurf trägt nicht beide Bilder").toHaveLength(2);

    // NACH dem Rendern: dieselben zwei, unverändert.
    const container = await rendere(
      createElement(SanitizedHtml, { html: gespeichert.bodyHtml as string }),
    );
    expect(
      bilderImDom(container),
      "Der Sanitizer hat Bilder verworfen — die letzte Meile der Kette ist gebrochen",
    ).toEqual(imSpeicher);
  });
});
