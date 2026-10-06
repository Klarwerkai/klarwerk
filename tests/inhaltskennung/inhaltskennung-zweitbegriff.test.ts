// ================================================================================================
// R-0098 (aufnahme:20260922:gesamt-bildidentitaet:inhaltskennung-zweitbegriff) — DIE
// INHALTSKENNUNG ALS ZWEITER BEGRIFF NEBEN DEM VORKOMMENSANKER.
// ================================================================================================
//
// entscheidung:1019d7a6: Die Inhaltskennung (Entscheidung vom 13.08.) wird NEBEN dem
// Vorkommensanker geführt, etwa für die Dublettenerkennung, und ersetzt ihn nicht. Der Anker
// (`data-image-id`: `newImageRunToken` im Browser, `kw-fig-N` am Server) und R-0089, R-1620/V8
// und R-0053 bleiben maßgeblich.
//
// Gemessen am echten Speicherweg (`POST /api/kos` → `GET /api/kos/:id`, Server-Sanitizer) und am
// Überarbeitungsweg des Dienstes. Die Inhaltskennung erwartet der Test unabhängig vom Produkt:
// sha256 über die dekodierten Bildbytes, hier mit `node:crypto` selbst gerechnet.
//
// Am Stand vor dieser Lieferung sind K1–K2 rot (es gab kein Feld `bildInhalte`).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { bildInhalteAusRumpf, sanitizeHtml } from "../../services/structure";
import { isImageAnchorId } from "../../services/structure/src/sanitize";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };
type BildInhalt = { imageId: string | null; inhaltskennung: string | null };
type Ko = { id: string; author: string; bodyHtml?: string; bildInhalte?: BildInhalt[] };

const offeneApps: App[] = [];
afterEach(async () => {
  for (const a of offeneApps.splice(0)) {
    await a.close();
  }
});

// Zwei verschiedene Bildinhalte (Bytes beliebig — der Sanitizer prüft nur Typ und base64-Form).
const BYTES_A = Buffer.from("klarwerk-bild-a-pumpenkopf");
const BYTES_B = Buffer.from("klarwerk-bild-b-ventil");
const SRC_A = `data:image/png;base64,${BYTES_A.toString("base64")}`;
const SRC_B = `data:image/png;base64,${BYTES_B.toString("base64")}`;

function erwarteteKennung(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function figur(id: string, src: string, caption: string): string {
  return (
    `<figure data-image-id="${id}"><img data-image-id="${id}" src="${src}">` +
    `<figcaption data-image-id="${id}">${caption}</figcaption></figure>`
  );
}

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

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  offeneApps.push(app);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@inhalt.test", password: "geheim12345" },
  });
  return { services, app, admin: await login(app, "admin@inhalt.test", "geheim12345") };
}

async function anlegen(app: App, headers: Auth, bodyHtml: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Pumpenbefund",
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

async function lesen(app: App, headers: Auth, id: string): Promise<Ko> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Ko;
}

async function hochladen(app: App, headers: Auth, bytes: Buffer, name: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name, mime: "image/png", data: `data:image/png;base64,${bytes.toString("base64")}` },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

describe("K1 · der Server leitet je Bild eine Inhaltskennung ab und speichert sie getrennt vom Anker", () => {
  it("jedes Bild bekommt einen Eintrag in `bildInhalte`; der Rumpf trägt nur den Vorkommensanker", async () => {
    const { app, admin } = await setup();
    const eingang = `<p>Befund.</p>${figur("a", SRC_A, "Pumpenkopf")}${figur("b", SRC_B, "Ventil")}`;
    const id = await anlegen(app, admin, eingang);
    const ko = await lesen(app, admin, id);

    expect(ko.bildInhalte).toEqual([
      { imageId: "a", inhaltskennung: erwarteteKennung(BYTES_A) },
      { imageId: "b", inhaltskennung: erwarteteKennung(BYTES_B) },
    ]);
    // Getrennt gespeichert: der Rumpf ist genau die Ausgabe des Sanitizers — kein neues Attribut,
    // keine Inhaltskennung im Markup, `data-image-id` unverändert.
    expect(ko.bodyHtml).toBe(sanitizeHtml(eingang));
    expect(ko.bodyHtml).not.toContain("sha256:");
  });

  it("ein Objekt-Store-Bild wird aus den Bytes seines Objekts abgeleitet — gleich wie eingebettet", async () => {
    const { app, admin } = await setup();
    const objekt = await hochladen(app, admin, BYTES_A, "pumpenkopf.png");
    const id = await anlegen(
      app,
      admin,
      figur("obj", `/api/objects/${objekt}/raw`, "aus dem Store") +
        figur("emb", SRC_A, "eingebettet"),
    );
    const ko = await lesen(app, admin, id);
    expect(ko.bildInhalte).toEqual([
      { imageId: "obj", inhaltskennung: erwarteteKennung(BYTES_A) },
      { imageId: "emb", inhaltskennung: erwarteteKennung(BYTES_A) },
    ]);
  });

  it("ein Bild ohne lesbares Objekt bekommt `null` — nicht geraten", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(app, admin, figur("weg", "/api/objects/gibt-es-nicht/raw", "fehlt"));
    const ko = await lesen(app, admin, id);
    expect(ko.bildInhalte).toEqual([{ imageId: "weg", inhaltskennung: null }]);
  });

  it("ein Text ohne Bilder trägt `bildInhalte: []`", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(app, admin, "<p>Nur Text.</p>");
    expect((await lesen(app, admin, id)).bildInhalte).toEqual([]);
  });

  it("die Überarbeitung leitet neu ab; eine Änderung ohne Rumpf lässt das Feld stehen", async () => {
    const { services, app, admin } = await setup();
    const id = await anlegen(app, admin, figur("a", SRC_A, "alt"));
    const { author } = await lesen(app, admin, id);

    const ersetzt = await services.ko.revise(id, { bodyHtml: figur("a2", SRC_B, "neu") }, author);
    expect(ersetzt.bildInhalte).toEqual([
      { imageId: "a2", inhaltskennung: erwarteteKennung(BYTES_B) },
    ]);
    expect((await lesen(app, admin, id)).bildInhalte).toEqual(ersetzt.bildInhalte);

    await services.ko.revise(id, { title: "Nur der Titel" }, author);
    expect((await lesen(app, admin, id)).bildInhalte).toEqual(ersetzt.bildInhalte);
  });
});

describe("K2 · zwei Vorkommen desselben Inhalts: eine Inhaltskennung, zwei Vorkommensanker", () => {
  it("dasselbe Bild zweimal mit eigenen Ankern", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(
      app,
      admin,
      figur("erste", SRC_A, "Erste") + figur("zweite", SRC_A, "Zweite"),
    );
    const ko = await lesen(app, admin, id);
    expect(ko.bildInhalte).toEqual([
      { imageId: "erste", inhaltskennung: erwarteteKennung(BYTES_A) },
      { imageId: "zweite", inhaltskennung: erwarteteKennung(BYTES_A) },
    ]);
  });

  it("eine kopierte Einheit (gleicher Anker, R-0089) wird weiter getrennt — die Inhaltskennung bleibt gleich", async () => {
    const { app, admin } = await setup();
    const einheit = figur("kopie", SRC_A, "Pumpenkopf");
    const id = await anlegen(app, admin, einheit + einheit);
    const ko = await lesen(app, admin, id);
    const anker = (ko.bildInhalte ?? []).map((e) => e.imageId);
    expect(anker).toHaveLength(2);
    expect(anker[0]).toBe("kopie");
    expect(anker[1]).not.toBe("kopie");
    expect(new Set(anker).size).toBe(2);
    expect(ko.bodyHtml).toContain(`data-image-id="${anker[1]}"`);
    expect((ko.bildInhalte ?? []).map((e) => e.inhaltskennung)).toEqual([
      erwarteteKennung(BYTES_A),
      erwarteteKennung(BYTES_A),
    ]);
  });

  it("zwei hochgeladene Objekte mit denselben Bytes: zwei Objekte, zwei Anker, eine Inhaltskennung", async () => {
    const { app, admin } = await setup();
    const o1 = await hochladen(app, admin, BYTES_B, "ventil.png");
    const o2 = await hochladen(app, admin, BYTES_B, "ventil-kopie.png");
    expect(o1).not.toBe(o2);
    const id = await anlegen(
      app,
      admin,
      figur("v1", `/api/objects/${o1}/raw`, "Ventil") +
        figur("v2", `/api/objects/${o2}/raw`, "Ventil"),
    );
    expect((await lesen(app, admin, id)).bildInhalte).toEqual([
      { imageId: "v1", inhaltskennung: erwarteteKennung(BYTES_B) },
      { imageId: "v2", inhaltskennung: erwarteteKennung(BYTES_B) },
    ]);
  });

  it("dasselbe Bild in zwei Dokumenten trägt in beiden dieselbe Inhaltskennung", async () => {
    const { app, admin } = await setup();
    const k1 = await anlegen(app, admin, figur("hier", SRC_A, "hier"));
    const k2 = await anlegen(app, admin, figur("dort", SRC_A, "dort"));
    const [e1] = (await lesen(app, admin, k1)).bildInhalte ?? [];
    const [e2] = (await lesen(app, admin, k2)).bildInhalte ?? [];
    expect(e1?.inhaltskennung).toBe(erwarteteKennung(BYTES_A));
    expect(e2?.inhaltskennung).toBe(e1?.inhaltskennung);
    expect(e1?.imageId).not.toBe(e2?.imageId);
  });

  it("dieselben Bytes in anderer base64-Umbrechung sind derselbe Inhalt", async () => {
    const umbrochen = `data:image/png;base64,${BYTES_A.toString("base64").replace(/(.{8})/g, "$1\n")}`;
    const inhalte = await bildInhalteAusRumpf(
      `<img data-image-id="x" src="${SRC_A}"><img data-image-id="y" src="${umbrochen}">`,
    );
    expect(inhalte.map((e) => e.inhaltskennung)).toEqual([
      erwarteteKennung(BYTES_A),
      erwarteteKennung(BYTES_A),
    ]);
  });
});

describe("K3 · lesbar für die Dublettenerkennung, nie Ersatz für den Vorkommensanker", () => {
  it("über `GET /api/kos/:id` lassen sich Dubletten an der Inhaltskennung gruppieren", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(
      app,
      admin,
      figur("a1", SRC_A, "eins") + figur("b1", SRC_B, "zwei") + figur("a2", SRC_A, "drei"),
    );
    const gruppen = new Map<string, (string | null)[]>();
    for (const e of (await lesen(app, admin, id)).bildInhalte ?? []) {
      if (e.inhaltskennung !== null) {
        gruppen.set(e.inhaltskennung, [...(gruppen.get(e.inhaltskennung) ?? []), e.imageId]);
      }
    }
    expect([...gruppen.values()].filter((anker) => anker.length > 1)).toEqual([["a1", "a2"]]);
  });

  it("die Inhaltskennung ist kein gültiges Anker-Token: als `data-image-id` verwirft der Sanitizer sie", () => {
    const kennung = erwarteteKennung(BYTES_A);
    expect(isImageAnchorId(kennung)).toBe(false);
    const aus = sanitizeHtml(
      `<figure><img data-image-id="${kennung}" src="${SRC_A}"><figcaption data-image-id="${kennung}">x</figcaption></figure>`,
    );
    expect(aus).not.toContain(kennung);
    expect(aus).toContain('data-kw-kennung="ungueltig"');
  });

  it("Fußnoten-Zuordnung, Klickweg und Paarung lesen die Inhaltskennung nirgends", () => {
    // Die Stellen, an denen Fußnoten zugeordnet und Klicks aufgelöst werden: der ganze Browsercode
    // (Editor `editorFigures.ts`, Galerie `bodyImages.ts`/`BodyImageGallery.tsx`, `RichTextEditor.tsx`),
    // die beiden Sanitizer mit `anchorFigures` und der Paarungs-Scanner der Bildsuche.
    const dateien: string[] = [
      "services/structure/src/sanitize.ts",
      "services/structure/src/captions.ts",
      "services/app/src/routes/library-routes.ts",
    ];
    const sammle = (verzeichnis: string): void => {
      for (const e of readdirSync(verzeichnis, { withFileTypes: true })) {
        const pfad = join(verzeichnis, e.name);
        if (e.isDirectory()) {
          sammle(pfad);
        } else if (/\.(ts|tsx)$/.test(e.name)) {
          dateien.push(pfad);
        }
      }
    };
    sammle("apps/web/src");
    expect(dateien.length).toBeGreaterThan(50);
    const treffer = dateien.filter((d) =>
      /inhaltskennung|bildInhalte|bildinhalt/i.test(readFileSync(d, "utf8")),
    );
    expect(treffer).toEqual([]);
  });
});
