// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · Runde 2 (Bens Befund B2) — die lose Fußnote über den echten Speicher- und
// Suchweg: `POST /api/kos` (Server-Sanitizer) → `GET /api/library/images` (Bildsuche).
//
// Bild und Fußnote stehen getrennt, die Fußnote trägt ausdrücklich die Kennung des Bildes. Bisher
// strich der Sanitizer diese Kennung, die Beschreibung war danach keinem Bild mehr zugeordnet.
// Aufbau wie `tests/bildsuche/route.test.ts`.
//
// Seit Bens Befund K3 (Kandidat ac5e0482) zusätzlich: Ersetzen und bewusste Zuordnung über die
// echten Editor-Funktionen (`editorFigures.ts`) und den regulären Speicher-/Ladeweg, und der
// Löschen-/Wiederherstellen-Rundlauf (übertragen aus der historischen `ben-wiederherstellung.test.ts`).
// jsdom, weil die Editor-Funktionen einen DOM-Baum bearbeiten; der Server läuft wie bisher über
// `buildApp` + `app.inject`.
import { afterEach, describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import {
  CAPTION_UNASSIGNED_ATTR,
  captionForImage,
  enhanceFiguresForEditing,
  imageForCaption,
  ordneFussnoteZu,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const offeneApps: App[] = [];
afterEach(async () => {
  for (const a of offeneApps.splice(0)) {
    await a.close();
  }
});

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(): Promise<{ app: App; admin: Auth }> {
  const app = buildApp(buildServices());
  offeneApps.push(app);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@lose.test", password: "geheim12345" },
  });
  return { app, admin: await login(app, "admin@lose.test", "geheim12345") };
}

async function anlegen(app: App, headers: Auth, bodyHtml: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Lagerbefund",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml,
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res.json().id as string;
}

const LOSE =
  '<figure data-image-id="lager-1"><img data-image-id="lager-1" src="/api/objects/l1/raw"></figure>' +
  '<figcaption data-image-id="lager-1">Lagerschale mit Riefen</figcaption>';

describe("B2 · lose Fußnote mit Bildkennung über Speichern und Bildsuche", () => {
  it("die Kennung übersteht POST /api/kos → GET /api/kos/:id", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(app, admin, LOSE);
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.stringify(res.json())).toContain(
      '<figcaption data-image-id=\\"lager-1\\">Lagerschale mit Riefen</figcaption>',
    );
  });

  it("die Bildsuche liefert das Bild mit dieser Beschreibung", async () => {
    const { app, admin } = await setup();
    await anlegen(app, admin, LOSE);
    const res = await app.inject({
      method: "GET",
      url: "/api/library/images?q=Lagerschale",
      headers: admin,
    });
    expect(res.statusCode, res.body).toBe(200);
    const treffer = (res.json() as { treffer: { imageId: string; caption: string }[] }).treffer;
    expect(treffer.map((t) => [t.imageId, t.caption])).toEqual([
      ["lager-1", "Lagerschale mit Riefen"],
    ]);
  });

  it("Gegenprobe: hat das Bild eine eigene (leere) Fußnote, wird die lose nicht geraten", async () => {
    const { app, admin } = await setup();
    await anlegen(
      app,
      admin,
      '<figure data-image-id="lager-1"><img data-image-id="lager-1" src="/api/objects/l1/raw">' +
        '<figcaption data-image-id="lager-1"></figcaption></figure>' +
        '<figcaption data-image-id="lager-1">Lagerschale mit Riefen</figcaption>',
    );
    const res = await app.inject({
      method: "GET",
      url: "/api/library/images?q=Lagerschale",
      headers: admin,
    });
    const treffer = (res.json() as { treffer: { caption: string }[] }).treffer;
    expect(treffer.map((t) => t.caption)).not.toContain("Lagerschale mit Riefen");
  });
});

// ================================================================================================
// K3 — Ersetzen, Zuordnen, Löschen und Wiederherstellen über den regulären Speicher-/Ladeweg
// ================================================================================================

async function lesen(app: App, headers: Auth, id: string): Promise<string> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { bodyHtml?: string }).bodyHtml ?? "";
}

/** Wie der Editor lädt: Körper in einen Baum, verankern und kennzeichnen. */
function imEditor(html: string): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  enhanceFiguresForEditing(el, "Platzhalter", "Öffnen", "nicht zugeordnet", "Label");
  return el;
}

/** Wie der Editor ausgibt (`emit()` → Client-Sanitizer). */
const ausgabe = (el: HTMLElement): string => clientSanitize(el.innerHTML);

function fussnoteMitText(el: HTMLElement, text: string): HTMLElement {
  const treffer = Array.from(el.querySelectorAll("figcaption")).filter(
    (f) => (f.textContent ?? "").trim() === text,
  );
  const eine = treffer[0];
  if (treffer.length !== 1 || !(eine instanceof HTMLElement)) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

const SRC_ALT = "/api/objects/altes-bild/raw";
const SRC_NEU = "/api/objects/neues-bild/raw";

describe("K3 · Ersetzen: das Ersatzbild erbt die alte Beschreibung nicht (POST → GET → Wiederöffnen)", () => {
  // Gespeicherte Einheit `kw-alt`; im Editor wurde das Bild in der stehen gebliebenen Hülle gegen
  // ein neues ohne Kennung getauscht.
  const ERSETZT = `<figure data-image-id="kw-alt"><img src="${SRC_NEU}"><figcaption data-image-id="kw-alt">Beschreibung des alten Bildes</figcaption></figure>`;

  it("R1 · gespeichert und frisch gelesen trägt das Ersatzbild eine eigene Kennung und keine Beschreibung", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(app, admin, ausgabe(imEditor(ERSETZT)));
    const geladen = await lesen(app, admin, id);
    const galerie = extractBodyImages(geladen);
    expect(galerie).toHaveLength(1);
    expect(galerie[0]?.src).toBe(SRC_NEU);
    expect(galerie[0]?.id, "das Ersatzbild hat die alte Kennung geerbt").not.toBe("kw-alt");
    expect(galerie[0]?.caption, "das Ersatzbild trägt die alte Beschreibung").toBe("");

    const wieder = imEditor(geladen);
    const neu = wieder.querySelector("img");
    expect(neu?.getAttribute("data-image-id")).toBe(galerie[0]?.id);
    const eigene = neu === null ? null : captionForImage(neu, wieder);
    expect((eigene?.textContent ?? "").trim()).toBe("");
    const alt = fussnoteMitText(wieder, "Beschreibung des alten Bildes");
    expect(alt.getAttribute("data-image-id")).toBe("kw-alt");
    expect(imageForCaption(alt, wieder), "alte Beschreibung gilt als die des neuen").toBeNull();
    expect(alt.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBe("nicht zugeordnet");
  });
});

describe("K3 · bewusste Zuordnung: die zugeordnete Fußnote bleibt beim gewählten Bild (POST → GET → Wiederöffnen)", () => {
  // Bild `kw-a` ohne eigene Beschreibung, daneben eine Fußnote mit fremder Kennung `kw-b`.
  const WIDERSPRUCH = `<figure data-image-id="kw-a"><img src="${SRC_ALT}" data-image-id="kw-a"><figcaption data-image-id="kw-b">Fremde Beschreibung</figcaption></figure>`;

  it("R2 · nach Zuordnen, Speichern und frischem Laden hängt genau diese Beschreibung an kw-a", async () => {
    const el = imEditor(WIDERSPRUCH);
    const bild = el.querySelector("img");
    if (bild === null) {
      throw new Error("kein Bild");
    }
    expect(ordneFussnoteZu(fussnoteMitText(el, "Fremde Beschreibung"), bild, el)).toBe(true);

    const { app, admin } = await setup();
    const id = await anlegen(app, admin, ausgabe(el));
    const geladen = await lesen(app, admin, id);
    expect(extractBodyImages(geladen)).toEqual([
      { id: "kw-a", src: SRC_ALT, caption: "Fremde Beschreibung" },
    ]);

    const wieder = imEditor(geladen);
    const beschreibung = fussnoteMitText(wieder, "Fremde Beschreibung");
    expect(beschreibung.getAttribute("data-image-id")).toBe("kw-a");
    expect(beschreibung.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBeNull();
    expect(imageForCaption(beschreibung, wieder)?.getAttribute("data-image-id")).toBe("kw-a");
    expect(wieder.querySelectorAll("figcaption")).toHaveLength(1);
  });
});

describe("K3 · Löschen und Wiederherstellen (übertragen aus ben-wiederherstellung.test.ts)", () => {
  const SRC = "/api/objects/gleich/raw";
  const paar = (id: string, text: string): string =>
    `<figure data-image-id="${id}"><img src="${SRC}" data-image-id="${id}"><figcaption data-image-id="${id}">${text}</figcaption></figure>`;
  const KOERPER = `<p>Vorher</p>${paar("bild-a", "Erste")}<p>Dazwischen</p>${paar("bild-b", "Zweite")}`;

  const paare = (html: string): [string, string][] =>
    extractBodyImages(html).map((b) => [b.id, b.caption]);

  it("R3 · DELETE 204 → GET 404 → Restore 200 → GET: Körper und Kennungs-/Beschreibungs-Paare unverändert", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(app, admin, KOERPER);

    const vorher = await lesen(app, admin, id);
    expect(paare(vorher)).toEqual([
      ["bild-a", "Erste"],
      ["bild-b", "Zweite"],
    ]);

    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/kos/${id}`,
      headers: admin,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(204);

    const weg = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
    expect(weg.statusCode, weg.body).toBe(404);

    const zurueck = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: admin,
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);

    const nachher = await lesen(app, admin, id);
    expect(nachher, "der Körper hat sich durch Löschen/Wiederherstellen verändert").toBe(vorher);
    expect(paare(nachher)).toEqual(paare(vorher));
  });
});
