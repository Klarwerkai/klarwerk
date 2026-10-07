// ================================================================================================
// PMO-FEA-0003 (aufnahme:20260922:gesamt-aktivitaetsanzeige) — FREIWILLIGE LIVE-WAND.
// ================================================================================================
//
// Originalpunkt: „Eine freiwillige Live-Wand zeigt neues validiertes Wissen mit zugestimmtem
// Namen/Foto. Sichtrechte und Widerruf bleiben wirksam; keine Punkte oder Personenranglisten."
//
// Geprüft wird je Satzteil:
//   · neues VALIDIERTES Wissen  → Zweig `validated` enthält nur Status `validiert`, neueste zuerst;
//   · zugestimmter Name         → ohne Zustimmung kein Name; `saved` trägt keine Autorenkennung mehr;
//   · Widerruf wirksam          → die jüngste Erklärung gilt, der Name ist beim nächsten Abruf weg;
//   · Sichtrechte wirksam       → ein vertrauliches validiertes Objekt erscheint dem Leser nicht;
//   · keine Punkte/Ranglisten   → die Antwort führt genau die vier Zweige, keine Zähler je Person.
//   · zugestimmtes Foto         → nur das selbst hinterlegte Foto, nur neben SICHTBAREN validierten
//                                 Einträgen, nur für bestehende Konten; Widerruf LÖSCHT die Daten;
//                                 nur Rasterbilder (kein SVG), begrenzt.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  LIVEWALL_WIDERRUF,
  LIVEWALL_ZUSTIMMUNG,
  buildLiveWall,
  zustimmendeKonten,
} from "../../services/app/src/livewall";
import {
  InMemoryLiveWallFotoRepo,
  LIVEWALL_FOTO_MAX_ZEICHEN,
  istZulaessigesFoto,
} from "../../services/app/src/livewall-fotos";
import {
  LIVEWALL_FOTO_GESETZT,
  LIVEWALL_FOTO_WIDERRUFEN,
  type LiveWallRoutesDeps,
  livewallRoutes,
} from "../../services/app/src/routes/livewall-routes";
import type { KnowledgeObject } from "../../services/knowledge-object";

const ko = (
  id: string,
  title: string,
  status: "offen" | "validiert",
  author: string,
  createdAt: string,
  confidentiality = "intern",
): KnowledgeObject =>
  ({
    id,
    title,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    confidence: 0,
    trust: 0,
    status,
    version: 1,
    originalAuthor: author,
    author,
    confidentiality,
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt,
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  }) as unknown as KnowledgeObject;

describe("PMO-FEA-0003 · Aggregation", () => {
  const kos = [
    ko("o1", "Offen neu", "offen", "u-eva", "2026-07-03T08:00:00.000Z"),
    ko("v1", "Validiert alt", "validiert", "u-eva", "2026-07-01T08:00:00.000Z"),
    ko("v2", "Validiert neu", "validiert", "u-tom", "2026-07-02T08:00:00.000Z"),
  ];

  it("validated enthält nur validiertes Wissen, neueste zuerst", () => {
    const wand = buildLiveWall({ kos, helpful: [], today: "2026-07-03" });
    expect(wand.validated.map((v) => v.koId)).toEqual(["v2", "v1"]);
  });

  it("ohne Zustimmung kein Name — und saved trägt keine Autorenkennung", () => {
    const wand = buildLiveWall({ kos, helpful: [], today: "2026-07-03" });
    expect(wand.validated.every((v) => !("name" in v))).toBe(true);
    expect(wand.saved.every((s) => !("author" in s))).toBe(true);
  });

  it("Name nur für das zustimmende Konto", () => {
    const wand = buildLiveWall({
      kos,
      helpful: [],
      today: "2026-07-03",
      zugestimmt: new Map([["u-eva", "Eva Muster"]]),
    });
    expect(wand.validated).toEqual([
      { koId: "v2", title: "Validiert neu", at: "2026-07-02T08:00:00.000Z" },
      { koId: "v1", title: "Validiert alt", at: "2026-07-01T08:00:00.000Z", name: "Eva Muster" },
    ]);
  });
});

describe("PMO-FEA-0003 · Zustimmung und Widerruf", () => {
  const e = (seq: number, actor: string, target: string, action: string) => ({
    seq,
    actor,
    target,
    action,
  });

  it("die jüngste Erklärung gilt — ein Widerruf hebt die Zustimmung auf", () => {
    expect(zustimmendeKonten([e(1, "a", "a", LIVEWALL_ZUSTIMMUNG)])).toEqual(new Set(["a"]));
    expect(
      zustimmendeKonten([e(1, "a", "a", LIVEWALL_ZUSTIMMUNG), e(2, "a", "a", LIVEWALL_WIDERRUF)]),
    ).toEqual(new Set());
    // Reihenfolge der Eingabe egal — es zählt `seq`.
    expect(
      zustimmendeKonten([e(5, "a", "a", LIVEWALL_ZUSTIMMUNG), e(3, "a", "a", LIVEWALL_WIDERRUF)]),
    ).toEqual(new Set(["a"]));
  });

  it("eine Erklärung für ein FREMDES Konto zählt nicht", () => {
    expect(zustimmendeKonten([e(1, "admin", "a", LIVEWALL_ZUSTIMMUNG)])).toEqual(new Set());
  });
});

const STANDARD_KONTEN = [
  { id: "u-eva", name: "Eva Muster" },
  { id: "u-tom", name: "Tom Test" },
];

// Route mit kleinem Prüfprotokoll-Doppel: `record` hängt an, `list` filtert nach Aktion. Die
// Fotoablage ist die ECHTE Speicherfassung des Produkts, nicht ein Doppel.
function aufbau(leser: SessionUser, kos: KnowledgeObject[], konten = STANDARD_KONTEN) {
  const fotos = new InMemoryLiveWallFotoRepo();
  const zeilen: Array<{
    seq: number;
    at: string;
    actor: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
  }> = [];
  const audit = {
    list: async (f: { action?: string }) => zeilen.filter((z) => z.action === f.action),
    record: async (input: { actor: string; action: string; target: string }) => {
      const zeile = { ...input, seq: zeilen.length + 1, at: new Date().toISOString(), payload: {} };
      zeilen.push(zeile);
      return zeile;
    },
  };
  const deps = {
    ko: { list: async () => kos },
    audit,
    konten: async () => konten,
    fotos,
  } as unknown as LiveWallRoutesDeps;
  let aktuell = leser;
  const guards = {
    requireUser: async () => aktuell,
    requirePermission: async () => aktuell,
  } as unknown as Guards;
  return {
    fotos,
    zeilen,
    als: (u: SessionUser) => {
      aktuell = u;
    },
    async start() {
      const app = Fastify();
      await app.register(livewallRoutes(deps, guards));
      return app;
    },
  };
}

describe("PMO-FEA-0003 · HTTP über die Route", () => {
  const eva = { id: "u-eva", role: "experte" } as unknown as SessionUser;
  const tom = { id: "u-tom", role: "experte" } as unknown as SessionUser;
  const kos = [
    ko("v1", "Presse P2 entlüften", "validiert", "u-eva", "2026-07-02T08:00:00.000Z"),
    ko(
      "v2",
      "Zugangscode Leitstand",
      "validiert",
      "u-eva",
      "2026-07-03T08:00:00.000Z",
      "vertraulich",
    ),
  ];

  it("Zustimmung zeigt den Namen, Widerruf nimmt ihn beim nächsten Abruf wieder weg", async () => {
    const w = aufbau(eva, kos);
    const app = await w.start();
    const wand = async () => {
      w.als(tom);
      const res = await app.inject({ method: "GET", url: "/api/livewall" });
      expect(res.statusCode).toBe(200);
      return res.json() as { validated: Array<{ koId: string; name?: string }> };
    };

    expect((await wand()).validated).toEqual([
      { koId: "v1", title: "Presse P2 entlüften", at: "2026-07-02T08:00:00.000Z" },
    ]);

    w.als(eva);
    const ja = await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: true },
    });
    expect(ja.json()).toEqual({ nameConsent: true });
    expect((await app.inject({ method: "GET", url: "/api/livewall/consent" })).json()).toEqual({
      nameConsent: true,
      photoConsent: false,
    });
    expect((await wand()).validated[0]?.name).toBe("Eva Muster");

    w.als(eva);
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: false },
    });
    expect((await wand()).validated[0]).not.toHaveProperty("name");
    await app.close();
  });

  it("Sichtrechte: ein vertrauliches validiertes Objekt erscheint dem Leser nicht", async () => {
    const w = aufbau(tom, kos);
    const app = await w.start();
    const res = await app.inject({ method: "GET", url: "/api/livewall" });
    const wand = res.json() as {
      validated: Array<{ koId: string }>;
      saved: Array<{ koId: string }>;
    };
    expect(wand.validated.map((v) => v.koId)).toEqual(["v1"]);
    expect(wand.saved.map((s) => s.koId)).toEqual(["v1"]);
    await app.close();
  });

  it("keine Punkte oder Ranglisten: die Antwort führt genau die vier Zweige", async () => {
    const w = aufbau(tom, kos);
    const app = await w.start();
    const wand = (await app.inject({ method: "GET", url: "/api/livewall" })).json() as Record<
      string,
      unknown
    >;
    expect(Object.keys(wand).sort()).toEqual(["helped", "helpedToday", "saved", "validated"]);
    await app.close();
  });

  it("ein Wert außer true/false wird abgewiesen und schreibt nichts", async () => {
    const w = aufbau(eva, kos);
    const app = await w.start();
    const res = await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: "ja" },
    });
    expect(res.statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/livewall/consent" })).json()).toEqual({
      nameConsent: false,
      photoConsent: false,
    });
    await app.close();
  });
});

// Ein echtes, winziges PNG (1×1) als Daten-URL — die Form, die der Browser nach dem Verkleinern
// schickt (dort JPEG; die Ablage nimmt PNG, JPEG und WebP gleich).
const FOTO = [
  "data:image/png;base64,",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==",
].join("");

describe("PMO-FEA-0003 · Foto: Zustimmung, Sichtrechte, Widerruf", () => {
  const eva = { id: "u-eva", role: "experte" } as unknown as SessionUser;
  const tom = { id: "u-tom", role: "experte" } as unknown as SessionUser;
  const geheim = { id: "u-geheim", role: "experte" } as unknown as SessionUser;
  const kos = [
    ko("v1", "Presse P2 entlüften", "validiert", "u-eva", "2026-07-02T08:00:00.000Z"),
    // u-geheim hat NUR einen vertraulichen validierten Eintrag — für tom unsichtbar.
    ko(
      "g1",
      "Zugangscode Leitstand",
      "validiert",
      "u-geheim",
      "2026-07-03T08:00:00.000Z",
      "vertraulich",
    ),
  ];
  const konten = [...STANDARD_KONTEN, { id: "u-geheim", name: "Gisela Geheim" }];
  type Wand = { validated: Array<{ koId: string; name?: string; foto?: string }> };
  const hinterlegen = (app: Awaited<ReturnType<ReturnType<typeof aufbau>["start"]>>) =>
    app.inject({ method: "PUT", url: "/api/livewall/photo", payload: { photo: FOTO } });

  it("ohne hinterlegtes Foto kein Foto; mit Foto steht es beim eigenen Eintrag", async () => {
    const w = aufbau(tom, kos, konten);
    const app = await w.start();
    const wand = async () => {
      w.als(tom);
      return (await app.inject({ method: "GET", url: "/api/livewall" })).json() as Wand;
    };
    expect((await wand()).validated[0]).not.toHaveProperty("foto");

    w.als(eva);
    const res = await hinterlegen(app);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ photoConsent: true });
    expect((await wand()).validated[0]?.foto).toBe(FOTO);
    // Foto und Name sind getrennte Erklärungen: das Foto nennt keinen Namen mit.
    expect((await wand()).validated[0]).not.toHaveProperty("name");
    // Im Prüfprotokoll steht das Ereignis — ohne Bilddaten.
    const ereignis = w.zeilen.find((z) => z.action === LIVEWALL_FOTO_GESETZT);
    expect(ereignis?.target).toBe("u-eva");
    expect(JSON.stringify(w.zeilen)).not.toContain("base64");
    await app.close();
  });

  it("Widerruf löscht die Bilddaten; der nächste Abruf zeigt kein Foto mehr", async () => {
    const w = aufbau(eva, kos, konten);
    const app = await w.start();
    await hinterlegen(app);
    expect(
      (await app.inject({ method: "GET", url: "/api/livewall/consent" })).json(),
    ).toMatchObject({ photoConsent: true, photo: FOTO });

    const weg = await app.inject({ method: "DELETE", url: "/api/livewall/photo" });
    expect(weg.json()).toEqual({ photoConsent: false });
    expect((await w.fotos.lies(["u-eva"])).size).toBe(0);
    w.als(tom);
    const wand = (await app.inject({ method: "GET", url: "/api/livewall" })).json() as Wand;
    expect(wand.validated[0]).not.toHaveProperty("foto");
    expect(w.zeilen.some((z) => z.action === LIVEWALL_FOTO_WIDERRUFEN)).toBe(true);
    await app.close();
  });

  it("Sichtrechte: kein Foto einer Person, deren Eintrag der Leser nicht sehen darf", async () => {
    const w = aufbau(geheim, kos, konten);
    const app = await w.start();
    await hinterlegen(app);
    w.als(tom);
    const roh = (await app.inject({ method: "GET", url: "/api/livewall" })).body;
    expect(roh).not.toContain("base64");
    expect(roh).not.toContain("Zugangscode");
    await app.close();
  });

  // Zusammenführung mit main (produkt:20261007:spaces): `darfSehen` kennt seitdem geschlossene
  // Spaces. Die Wand filtert über dieselbe Regel — ein validierter Eintrag in einem Space, den der
  // Leser nicht lesen darf, erscheint nicht, und mit ihm weder Name noch Foto seiner Autorin.
  it("Spaces: kein Eintrag, Name oder Foto aus einem Space ohne Leserecht", async () => {
    const imSpace = {
      ...ko("s1", "Rezeptur Linie 4", "validiert", "u-geheim", "2026-07-04T08:00:00.000Z"),
      spaceId: "space-geschlossen",
    } as unknown as KnowledgeObject;
    const w = aufbau(geheim, [kos[0] as KnowledgeObject, imSpace], konten);
    const app = await w.start();
    await hinterlegen(app);
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: true },
    });

    const ohneRecht = { ...tom, spaceLesbar: new Set<string>() } as unknown as SessionUser;
    w.als(ohneRecht);
    const roh = (await app.inject({ method: "GET", url: "/api/livewall" })).body;
    expect(roh).not.toContain("Rezeptur Linie 4");
    expect(roh).not.toContain("Gisela Geheim");
    expect(roh).not.toContain("base64");

    // Gegenprobe: mit Leserecht am Space erscheint der Eintrag samt Name und Foto.
    const mitRecht = {
      ...tom,
      spaceLesbar: new Set(["space-geschlossen"]),
    } as unknown as SessionUser;
    w.als(mitRecht);
    const wand = (await app.inject({ method: "GET", url: "/api/livewall" })).json() as Wand;
    const eintrag = wand.validated.find((v) => v.koId === "s1");
    expect(eintrag?.name).toBe("Gisela Geheim");
    expect(eintrag?.foto).toBe(FOTO);
    await app.close();
  });

  it("ein gelöschtes Konto bekommt kein Foto, auch wenn noch eines abgelegt ist", async () => {
    const w = aufbau(tom, kos, [{ id: "u-tom", name: "Tom Test" }]);
    await w.fotos.setze("u-eva", FOTO, "2026-07-01T00:00:00.000Z");
    const app = await w.start();
    const wand = (await app.inject({ method: "GET", url: "/api/livewall" })).json() as Wand;
    expect(wand.validated.map((v) => v.koId)).toEqual(["v1"]);
    expect(wand.validated[0]).not.toHaveProperty("foto");
    await app.close();
  });

  it("nur Rasterbilder als Daten-URL, begrenzt — SVG und Übergröße werden abgewiesen", async () => {
    expect(istZulaessigesFoto(FOTO)).toBe(true);
    expect(istZulaessigesFoto("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
    expect(istZulaessigesFoto("https://example.invalid/bild.png")).toBe(false);
    const zuGross = `data:image/png;base64,${"A".repeat(LIVEWALL_FOTO_MAX_ZEICHEN)}`;
    expect(istZulaessigesFoto(zuGross)).toBe(false);

    const w = aufbau(eva, kos, konten);
    const app = await w.start();
    const res = await app.inject({
      method: "PUT",
      url: "/api/livewall/photo",
      payload: { photo: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" },
    });
    expect(res.statusCode).toBe(400);
    expect((await w.fotos.lies(["u-eva"])).size).toBe(0);
    await app.close();
  });
});

describe("PMO-FEA-0003 · Verdrahtung in der echten App", () => {
  it("die eigene Erklärung lässt sich setzen, lesen und widerrufen — ohne Login 401", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    expect((await app.inject({ method: "GET", url: "/api/livewall/consent" })).statusCode).toBe(
      401,
    );
    const lesen = async () =>
      (await app.inject({ method: "GET", url: "/api/livewall/consent", headers })).json();

    expect(await lesen()).toEqual({ nameConsent: false, photoConsent: false });
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      headers,
      payload: { nameConsent: true },
    });
    expect(await lesen()).toEqual({ nameConsent: true, photoConsent: false });
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      headers,
      payload: { nameConsent: false },
    });
    expect(await lesen()).toEqual({ nameConsent: false, photoConsent: false });

    // Die Fotoablage ist in der Kompositionswurzel verdrahtet: hinterlegen, lesen, widerrufen.
    await app.inject({
      method: "PUT",
      url: "/api/livewall/photo",
      headers,
      payload: { photo: FOTO },
    });
    expect(await lesen()).toEqual({ nameConsent: false, photoConsent: true, photo: FOTO });
    await app.inject({ method: "DELETE", url: "/api/livewall/photo", headers });
    expect(await lesen()).toEqual({ nameConsent: false, photoConsent: false });
    await app.close();
  });
});
