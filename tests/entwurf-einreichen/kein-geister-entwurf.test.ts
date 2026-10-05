// ==================================================================================================
// AUFNAHME gesamt-entwurf-einreichen · R-0036 / SOLL:FR-STR-06 — KEIN GEISTER-ENTWURF.
// ==================================================================================================
//
// DER REST AUS DER QUELLE (R-0036): „Update und Promote sind nicht atomar (P2-Rest)." Der Weg
// `POST /api/drafts/:id/promote` legt zuerst das Wissensobjekt an (`ko.create`) und verbraucht
// danach den Entwurf (`capture.entwurfVerbraucht`). Beide Schritte gehören verschiedenen Modulen
// mit getrennter Datenhaltung — eine gemeinsame Transaktion gibt es dafür nicht, und sie wäre ein
// Griff über die Modulgrenze.
//
// GEMESSEN VOR DER ÄNDERUNG: scheitert der Verbrauch NACH der Anlage, antwortet die Route 500. Die
// Oberfläche wiederholt mit DEMSELBEN Vorgangsschlüssel (`Blatt.tsx`, `submitOperationRef`), der
// Nachschlag erkennt den Vorgang und antwortet 200 mit dem Objekt — und der Entwurf lag danach
// weiter im Pool, neben dem Wissensobjekt, das aus ihm geworden war. Genau der Geister-Entwurf,
// den R-0036 ausschliesst.
//
// DIE ZUSAGE JETZT: die Wiederholung desselben Vorgangs schliesst ihn auch ab. Der Nachschlag
// verbraucht den Entwurf, aus dem der Vorgang das Objekt gemacht hat — die Adresse gehört zum
// Abdruck (`draftId` im Fingerprint), ein fremder Entwurf wird also nie getroffen.
//
// BEN RUNDE 1 (Lauf :1): der Verbrauch ist der ERSTE Schritt der Nacharbeiten. Brach der erste
// Lauf an ihm ab, liefen auch Prüferzuweisung, Hintergrundprüfung (WP-SUBMIT-ASYNC, R-0058) und
// Ablage nie — und die Wiederholung holte bis dahin nur den Verbrauch nach. Das Objekt stand dann
// ohne Prüf-Job und ohne Prüfer im Bestand. Fall 2 prüft deshalb ALLE Folgen der Wiederholung, und
// Fall 3 die Gegenrichtung: nach einem gelungenen Lauf laufen sie NICHT ein zweites Mal.
//
// BEN RUNDE 2 (Lauf :2, F1/F2): auch NACH gelungenem Verbrauch kann ein Lauf abbrechen — an der
// Prüferzuweisung, am Prüf-Vermerk oder zwischen Vermerk und Einreihen. Die Wiederholung meldete
// dann Erfolg, obwohl Zuweisung bzw. Prüf-Job fehlten. Jetzt liest jeder Nacharbeitsschritt seine
// eigene Wirkung und holt nur nach, was fehlt. Die Fälle 5–7 brechen den ersten Lauf an genau
// diesen Stellen und prüfen nach der Wiederholung den BESTAND: Zuweisung, Benachrichtigung,
// Prüf-Vermerk und Einreihung je genau einmal — auch nach einer zweiten Wiederholung.
//
// BEN LAUF :3 RUNDE 1 (B2): „Zuweisung vorhanden" heisst nicht „Prüferin benachrichtigt". Fall 5
// ersetzte die ganze Zuweisung durch einen Fehler VOR jeder Teilwirkung und sah das deshalb nicht.
// Fall 8 lässt bei zwei Prüfern nur das ANLEGEN DER ZWEITEN Zuweisung in der Ablage scheitern (die
// erste steht, niemand ist benachrichtigt), Fall 9 den Mailversand an EINE Prüferin. Soll: nach der
// Wiederholung hat JEDE Prüferin genau eine zugestellte Benachrichtigung, auch nach einer weiteren
// Wiederholung. Gegenprobe: mit der Zuweisung aus Lauf :3 Runde 1 (`nichtZugewiesen` + `assign`,
// Benachrichtigung nur für neu Zugewiesene) sind Fall 8 und 9 rot — Bert bleibt ohne Mail.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryAssignmentRepo } from "../../services/validation";

afterEach(() => {
  vi.restoreAllMocks();
});

type App = ReturnType<typeof buildApp>;

// Ein stiller Prüf-Job: zählt nur, was eingereiht wird — kein Worker-Lauf, kein Modell. Was
// eingereiht ist, bleibt „in der Warteschlange" (`has`), wie beim echten Worker bis zum Abschluss.
function zaehlenderPruefjob() {
  const eingereiht = new Set<string>();
  const enqueue = vi.fn<(koId: string, expectedKoVersion?: number) => void>((koId) => {
    eingereiht.add(koId);
  });
  const worker: AiCheckWorker = {
    enqueue,
    has: (koId) => eingereiht.has(koId),
    // R-0208 (main): der stille Job arbeitet nie — es läuft also nichts.
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
  return { worker, enqueue };
}

async function anmelden(app: App, email: string) {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  const body = login.json() as { token: string; user: { id: string } };
  return { id: body.user.id, headers: { authorization: `Bearer ${body.token}` } };
}

async function buehne() {
  const services = buildServices();
  const pruefjob = zaehlenderPruefjob();
  services.aiCheckWorker = pruefjob.worker;
  const post = vi.spyOn(services.mailer, "send");
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@x.de", password: "secret123" },
  });
  const anna = await anmelden(app, "anna@x.de");
  // Bert ist der Prüfer, den Anna beim Einreichen benennt.
  const bert = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna.headers,
    payload: { name: "Bert", email: "bert@x.de", password: "secret123", role: "experte" },
  });
  expect(bert.statusCode).toBeLessThan(300);
  const pruefer = await anmelden(app, "bert@x.de");
  // Carla ist die zweite Prüferin (Fälle 8 und 9).
  const carla = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna.headers,
    payload: { name: "Carla", email: "carla@x.de", password: "secret123", role: "experte" },
  });
  expect(carla.statusCode).toBeLessThan(300);
  const prueferin = await anmelden(app, "carla@x.de");
  return {
    app,
    services,
    headers: anna.headers,
    bert: pruefer,
    carla: prueferin,
    enqueue: pruefjob.enqueue,
    post,
  };
}

async function entwurfAnlegen(app: App, headers: Record<string, string>, titel: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: {
      title: titel,
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
      bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
    },
  });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

async function entwurfsIds(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { id: string }[]).map((d) => d.id);
}

// Der BESTAND nach einem Vorgang, gelesen am Server — nicht an der Antwort.
async function bestand(
  services: ReturnType<typeof buildServices>,
  pruefer: string,
  enqueue: { mock: { calls: unknown[][] } },
  post: { mock: { calls: unknown[][] } },
) {
  const [objekt, ...weitere] = await services.ko.list();
  return {
    objekte: 1 + weitere.length - (objekt ? 0 : 1),
    pruefVermerk: objekt?.aiCheck?.status ?? null,
    einreihungen: enqueue.mock.calls.filter(([id]) => id === objekt?.id).length,
    zuweisungen: (await services.validation.openAssignmentsFor(pruefer)).filter(
      (z) => z.koId === objekt?.id,
    ).length,
    benachrichtigungen: post.mock.calls.length,
  };
}

async function objektTitel(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { title: string }[]).map((k) => k.title);
}

describe("R-0036 · Einreichen eines gespeicherten Entwurfs lässt keinen Geister-Entwurf zurück", () => {
  it("Normalfall: 201, genau ein Wissensobjekt, der Entwurf ist aus dem Pool verschwunden", async () => {
    const { app, headers } = await buehne();
    const id = await entwurfAnlegen(app, headers, "Dichtungswechsel L4");

    const res = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
      payload: { operationId: "einreichen-normal-0001" },
    });

    expect(res.statusCode).toBe(201);
    // FR-STR-06: das Objekt entsteht im Status „offen" (Prüfung steht aus), nicht validiert.
    expect(res.json().status).toBe("offen");
    expect(await objektTitel(app, headers)).toEqual(["Dichtungswechsel L4"]);
    expect(await entwurfsIds(app, headers)).toEqual([]);
  });

  it("Verbrauch scheitert nach der Anlage → die Wiederholung schliesst den Entwurf ab UND holt alle Nacharbeiten nach", async () => {
    const { app, services, headers, bert, enqueue } = await buehne();
    const id = await entwurfAnlegen(app, headers, "Dichtungswechsel L4");
    const verbrauch = vi
      .spyOn(services.capture, "entwurfVerbraucht")
      .mockRejectedValueOnce(new Error("Ablage kurz nicht erreichbar"));
    const vorgang = { operationId: "einreichen-geist-0001", reviewerIds: [bert.id] };

    const erster = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
      payload: vorgang,
    });
    // Der Ausgangszustand des Befunds: Objekt steht, Entwurf auch — und die Antwort war ein Fehler.
    // Hinter dem Verbrauch ist NICHTS gelaufen: kein Prüf-Job, kein Prüfer.
    expect(erster.statusCode).toBe(500);
    expect(await objektTitel(app, headers)).toEqual(["Dichtungswechsel L4"]);
    expect(await entwurfsIds(app, headers)).toEqual([id]);
    const [objekt] = await services.ko.list();
    expect(objekt?.aiCheck).toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
    expect(await services.validation.openAssignmentsFor(bert.id)).toEqual([]);

    const wiederholung = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
      payload: vorgang,
    });

    expect(wiederholung.statusCode).toBe(200);
    expect(wiederholung.json().title).toBe("Dichtungswechsel L4");
    // Keine Dublette durch die Wiederholung …
    expect(await objektTitel(app, headers)).toEqual(["Dichtungswechsel L4"]);
    // … KEIN Geister-Entwurf. Vor Lauf :1 stand hier `[id]` …
    expect(await entwurfsIds(app, headers)).toEqual([]);
    expect(verbrauch).toHaveBeenCalledTimes(2);
    // … und die Nacharbeiten sind nachgeholt, genau einmal. Vor Lauf :2 fehlten alle drei.
    // Die Antwort trägt den Vermerk (R-0058: Prüfung läuft im Hintergrund), der Bestand auch.
    expect(wiederholung.json().aiCheck?.status).toBe("pending");
    expect((await services.ko.get(wiederholung.json().id))?.aiCheck?.status).toBe("pending");
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[0]).toBe(wiederholung.json().id);
    expect((await services.validation.openAssignmentsFor(bert.id)).map((z) => z.koId)).toEqual([
      wiederholung.json().id,
    ]);
  });

  it("die Wiederholung nach einem GELUNGENEN Lauf bleibt 200 — ohne zweiten Prüf-Job, ohne zweite Zuweisung", async () => {
    const { app, services, headers, bert, enqueue, post } = await buehne();
    const id = await entwurfAnlegen(app, headers, "Dichtungswechsel L4");
    const vorgang = { operationId: "einreichen-doppelt-0001", reviewerIds: [bert.id] };

    const erster = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
      payload: vorgang,
    });
    const zweiter = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
      payload: vorgang,
    });

    expect(erster.statusCode).toBe(201);
    expect(erster.json().aiCheck?.status).toBe("pending");
    expect(zweiter.statusCode).toBe(200);
    expect(zweiter.json().id).toBe(erster.json().id);
    expect(await objektTitel(app, headers)).toEqual(["Dichtungswechsel L4"]);
    expect(await entwurfsIds(app, headers)).toEqual([]);
    // Gegenprobe zu Fall 2: der erste Lauf war vollständig — die Wiederholung reiht die Prüfung
    // NICHT ein zweites Mal ein, weist keine Prüfer erneut zu und benachrichtigt nicht erneut.
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect((await services.validation.openAssignmentsFor(bert.id)).map((z) => z.koId)).toEqual([
      erster.json().id,
    ]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("ein ANDERER Entwurf bleibt unberührt, auch wenn derselbe Schlüssel an ihm wiederholt wird", async () => {
    // R-0028-Nachbar: „Bereits eingereichte Wissensobjekte bleiben unberührt" gilt auch umgekehrt —
    // ein Nachschlag darf keinen fremden Entwurf verbrauchen. Der Abdruck enthält die Adresse, der
    // Schlüssel an einem anderen Entwurf ist also ein ANDERER Vorgang und wird abgewiesen.
    const { app, headers } = await buehne();
    const erster = await entwurfAnlegen(app, headers, "Dichtungswechsel L4");
    const zweiter = await entwurfAnlegen(app, headers, "Lagerwechsel L5");

    const ok = await app.inject({
      method: "POST",
      url: `/api/drafts/${erster}/promote`,
      headers,
      payload: { operationId: "einreichen-fremd-0001" },
    });
    expect(ok.statusCode).toBe(201);

    const fremd = await app.inject({
      method: "POST",
      url: `/api/drafts/${zweiter}/promote`,
      headers,
      payload: { operationId: "einreichen-fremd-0001" },
    });

    expect(fremd.statusCode).toBeGreaterThanOrEqual(400);
    expect(await entwurfsIds(app, headers)).toEqual([zweiter]);
    expect(await objektTitel(app, headers)).toEqual(["Dichtungswechsel L4"]);
  });

  describe("F1/F2 · ein Lauf bricht NACH gelungenem Verbrauch ab → die Wiederholung holt genau das Fehlende nach", () => {
    async function vorgang(
      stoerung: (services: ReturnType<typeof buildServices>) => void,
      schluessel: string,
    ) {
      const b = await buehne();
      const id = await entwurfAnlegen(b.app, b.headers, "Dichtungswechsel L4");
      stoerung(b.services);
      const senden = () =>
        b.app.inject({
          method: "POST",
          url: `/api/drafts/${id}/promote`,
          headers: b.headers,
          payload: { operationId: schluessel, reviewerIds: [b.bert.id] },
        });
      const lesen = () => bestand(b.services, b.bert.id, b.enqueue, b.post);
      return { ...b, senden, lesen };
    }

    const vollstaendig = {
      objekte: 1,
      pruefVermerk: "pending",
      einreihungen: 1,
      zuweisungen: 1,
      benachrichtigungen: 1,
    };

    it("Fall 5 · Prüferzuweisung scheitert einmal: 500, dann 200 mit Zuweisung, Benachrichtigung und Prüf-Job", async () => {
      const v = await vorgang(
        (s) =>
          void vi
            .spyOn(s.validation, "zuweisenBeimEinreichen")
            .mockRejectedValueOnce(new Error("kurz weg")),
        "einreichen-zuweisung-0001",
      );

      const erster = await v.senden();
      expect(erster.statusCode).toBe(500);
      // Der Entwurf ist schon verbraucht — und hinter der Zuweisung ist nichts gelaufen.
      expect(await entwurfsIds(v.app, v.headers)).toEqual([]);
      expect(await v.lesen()).toEqual({
        objekte: 1,
        pruefVermerk: null,
        einreihungen: 0,
        zuweisungen: 0,
        benachrichtigungen: 0,
      });

      const wiederholung = await v.senden();
      expect(wiederholung.statusCode).toBe(200);
      expect(wiederholung.json().aiCheck?.status).toBe("pending");
      expect(await v.lesen()).toEqual(vollstaendig);

      // Eine weitere Wiederholung bewirkt nichts mehr — keine Doppelwirkung.
      expect((await v.senden()).statusCode).toBe(200);
      expect(await v.lesen()).toEqual(vollstaendig);
    });

    it("Fall 6 · Prüf-Vermerk scheitert einmal: 500, dann 200 mit Prüf-Job — die schon stehende Zuweisung wird NICHT verdoppelt", async () => {
      const v = await vorgang(
        (s) =>
          void vi.spyOn(s.ko, "markAiCheckPending").mockRejectedValueOnce(new Error("kurz weg")),
        "einreichen-vermerk-0001",
      );

      const erster = await v.senden();
      expect(erster.statusCode).toBe(500);
      expect(await v.lesen()).toEqual({
        objekte: 1,
        pruefVermerk: null,
        einreihungen: 0,
        zuweisungen: 1,
        benachrichtigungen: 1,
      });

      const wiederholung = await v.senden();
      expect(wiederholung.statusCode).toBe(200);
      expect(wiederholung.json().aiCheck?.status).toBe("pending");
      expect(await v.lesen()).toEqual(vollstaendig);

      expect((await v.senden()).statusCode).toBe(200);
      expect(await v.lesen()).toEqual(vollstaendig);
    });

    it("Fall 7 · Abbruch zwischen Vermerk und Einreihen: 500, dann 200 — der vermerkte Prüf-Job wird genau einmal eingereiht", async () => {
      const v = await vorgang((s) => {
        // Das erste Nachlesen NACH dem Vermerk scheitert einmal: der Vermerk steht, eingereiht
        // ist nichts.
        const echtGet = s.ko.get.bind(s.ko);
        const echtVermerk = s.ko.markAiCheckPending.bind(s.ko);
        let gleichScheitern = false;
        vi.spyOn(s.ko, "markAiCheckPending").mockImplementation(async (...args) => {
          const ok = await echtVermerk(...args);
          gleichScheitern = true;
          return ok;
        });
        vi.spyOn(s.ko, "get").mockImplementation(async (id) => {
          if (gleichScheitern) {
            gleichScheitern = false;
            throw new Error("kurz weg");
          }
          return echtGet(id);
        });
      }, "einreichen-einreihen-0001");

      const erster = await v.senden();
      expect(erster.statusCode).toBe(500);
      expect(await v.lesen()).toEqual({
        objekte: 1,
        pruefVermerk: "pending",
        einreihungen: 0,
        zuweisungen: 1,
        benachrichtigungen: 1,
      });

      const wiederholung = await v.senden();
      expect(wiederholung.statusCode).toBe(200);
      expect(await v.lesen()).toEqual(vollstaendig);

      expect((await v.senden()).statusCode).toBe(200);
      expect(await v.lesen()).toEqual(vollstaendig);
    });
  });

  describe("B2 · eine teilweise gescheiterte Zuweisung verliert keine Benachrichtigung", () => {
    // Zugestellt heisst: das Versprechen aus `mailer.send` wurde ERFÜLLT (`settledResults`, nicht
    // `results` — ein abgelehntes Versprechen ist dort ein gewöhnliches „return"). Gezählt wird je
    // Empfängerin.
    function zustellungen(post: {
      mock: { calls: unknown[][]; settledResults: { type: string }[] };
    }) {
      const je: Record<string, number> = {};
      post.mock.calls.forEach(([nachricht], i) => {
        if (post.mock.settledResults[i]?.type === "fulfilled") {
          const an = (nachricht as { to: string }).to;
          je[an] = (je[an] ?? 0) + 1;
        }
      });
      return je;
    }

    async function zweiPruefer(schluessel: string) {
      const b = await buehne();
      const id = await entwurfAnlegen(b.app, b.headers, "Dichtungswechsel L4");
      const senden = () =>
        b.app.inject({
          method: "POST",
          url: `/api/drafts/${id}/promote`,
          headers: b.headers,
          payload: { operationId: schluessel, reviewerIds: [b.bert.id, b.carla.id] },
        });
      const zugewiesen = async () => ({
        bert: (await b.services.validation.openAssignmentsFor(b.bert.id)).length,
        carla: (await b.services.validation.openAssignmentsFor(b.carla.id)).length,
      });
      return { ...b, senden, zugewiesen };
    }

    it("Fall 8 · das Anlegen der ZWEITEN Zuweisung scheitert: 500, dann 200 — Bert UND Carla sind je genau einmal benachrichtigt", async () => {
      const v = await zweiPruefer("einreichen-zweite-zuweisung-0001");
      const echt = InMemoryAssignmentRepo.prototype.create;
      let aufrufe = 0;
      vi.spyOn(InMemoryAssignmentRepo.prototype, "create").mockImplementation(function (
        this: InMemoryAssignmentRepo,
        zuweisung,
      ) {
        aufrufe += 1;
        if (aufrufe === 2) {
          return Promise.reject(new Error("Ablage kurz nicht erreichbar"));
        }
        return echt.call(this, zuweisung);
      });

      const erster = await v.senden();
      // Der Ausgangszustand des Befunds: Berts Zuweisung steht, Carlas nicht, niemand hat Post.
      expect(erster.statusCode).toBe(500);
      expect(await v.zugewiesen()).toEqual({ bert: 1, carla: 0 });
      expect(zustellungen(v.post)).toEqual({});

      const wiederholung = await v.senden();
      expect(wiederholung.statusCode).toBe(200);
      expect(await v.zugewiesen()).toEqual({ bert: 1, carla: 1 });
      // Vor der Änderung stand hier `{ "carla@x.de": 1 }` — Berts Benachrichtigung war verloren.
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });

      // Weitere Wiederholungen: Erfolg, und keine zweite Mail an irgendwen.
      expect((await v.senden()).statusCode).toBe(200);
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });
      expect(await v.zugewiesen()).toEqual({ bert: 1, carla: 1 });
    });

    it("Fall 9 · der Mailversand an Bert scheitert: 500, dann 200 — Bert wird nachbenachrichtigt, Carla nicht doppelt", async () => {
      const v = await zweiPruefer("einreichen-mail-0001");
      v.post.mockRejectedValueOnce(new Error("SMTP kurz weg"));

      const erster = await v.senden();
      expect(erster.statusCode).toBe(500);
      // Beide Zuweisungen stehen, zugestellt ist nichts (Berts Mail scheiterte, Carla kam nicht dran).
      expect(await v.zugewiesen()).toEqual({ bert: 1, carla: 1 });
      expect(zustellungen(v.post)).toEqual({});

      const wiederholung = await v.senden();
      expect(wiederholung.statusCode).toBe(200);
      expect(wiederholung.json().aiCheck?.status).toBe("pending");
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });

      expect((await v.senden()).statusCode).toBe(200);
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });
    });

    // ==========================================================================================
    // Lauf :3 Runde 3 · Ben B2-R — ALTBESTAND: Zuweisungen OHNE Benachrichtigungsstand.
    // ==========================================================================================
    // Ein Vorgang, der VOR diesem Stand abbrach, hat Zuweisungen in der alten Datenform (ohne
    // `benachrichtigung`). Die Ablage wird hier so gestellt, wie der alte Code sie hinterliess:
    // jede angelegte Zuweisung verliert das neue Feld. Der alte Ablauf war fest
    // zuweisen → benachrichtigen → Prüf-Vermerk; der Vermerk ist deshalb der Nachweis, ob der
    // frühere Lauf über die Benachrichtigung hinauskam.
    // Gegenprobe: mit `nochZuBenachrichtigen` aus Runde 2 (feldlos = erledigt) ist Fall 10 rot —
    // „{ carla: 1 }" statt „{ bert: 1, carla: 1 }", genau Bens Messung.
    function alteDatenform(scheitertBeim?: number) {
      const echt = InMemoryAssignmentRepo.prototype.create;
      const ablagen = new Set<InMemoryAssignmentRepo>();
      let aufrufe = 0;
      vi.spyOn(InMemoryAssignmentRepo.prototype, "create").mockImplementation(function (
        this: InMemoryAssignmentRepo,
        zuweisung,
      ) {
        aufrufe += 1;
        ablagen.add(this);
        if (aufrufe === scheitertBeim) {
          return Promise.reject(new Error("Ablage kurz nicht erreichbar"));
        }
        const { benachrichtigung: _neuesFeld, ...alt } = zuweisung;
        return echt.call(this, alt);
      });
      return ablagen;
    }

    it("Fall 10 · ALTBESTAND, zweite Zuweisung scheiterte: die feldlose erste gilt NICHT als benachrichtigt — beide genau einmal", async () => {
      const v = await zweiPruefer("einreichen-altbestand-teil-0001");
      alteDatenform(2);

      const erster = await v.senden();
      expect(erster.statusCode).toBe(500);
      expect(await v.zugewiesen()).toEqual({ bert: 1, carla: 0 });
      expect(zustellungen(v.post)).toEqual({});
      vi.mocked(InMemoryAssignmentRepo.prototype.create).mockRestore();

      expect((await v.senden()).statusCode).toBe(200);
      expect(await v.zugewiesen()).toEqual({ bert: 1, carla: 1 });
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });

      expect((await v.senden()).statusCode).toBe(200);
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });
    });

    it("Fall 11 · ALTBESTAND, früherer Lauf VOLLSTÄNDIG (Vermerk steht): die Wiederholung schickt KEINE zweite Mail", async () => {
      const v = await zweiPruefer("einreichen-altbestand-voll-0001");
      const ablagen = alteDatenform();

      const erster = await v.senden();
      expect(erster.statusCode).toBe(201);
      expect(erster.json().aiCheck?.status).toBe("pending");
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });
      // So stand es nach dem alten Code in der Ablage: Zuweisungen ohne Feld.
      vi.mocked(InMemoryAssignmentRepo.prototype.create).mockRestore();
      for (const ablage of ablagen) {
        for (const z of await ablage.all()) {
          const { benachrichtigung: _neuesFeld, ...alt } = z;
          await ablage.update(alt);
        }
      }

      expect((await v.senden()).statusCode).toBe(200);
      expect(zustellungen(v.post)).toEqual({ "bert@x.de": 1, "carla@x.de": 1 });
    });
  });
});
