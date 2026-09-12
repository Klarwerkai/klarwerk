// ==================================================================================================
// JOB 3668 RUNDE 2 — DIE ZWEI FEHLER, DIE CODEX AN RUNDE 1 GEMESSEN HAT.
// ==================================================================================================
//
// Runde 1 war grün am Tor und trug trotzdem zwei Wege, auf denen der Papierkorb sein Versprechen
// bricht. Beide sind hier zuerst als Fall geschrieben und dann behoben — nicht umgekehrt.
//
// FEHLER 1 · DER ZWEITE ÜBERNAHMEWEG. `POST /api/drafts/:id/promote` war umgestellt, die
// Dokumentübernahme `POST /api/kos/from-document` NICHT: sie hängt an einer eigenen Verdrahtung
// (`build-app.ts` → `draftPromotion.discard`), die weiterhin den weichen Weg rief. Ein Entwurf,
// aus dem gerade ein Wissensobjekt geworden war, landete damit im Papierkorb — von dort
// wiederherstellbar und danach eine Dublette neben dem Objekt aus ihm. Codex' Messung:
// „DOKUMENTÜBERNAHME 201 · VERBRAUCHT Papierkorb: 1 Wiederherstellen: 200".
//
// FEHLER 2 · DAS FENSTER ZWISCHEN PRÜFEN UND LÖSCHEN. `purgeTrashedDraft` las erst `findTrashed`
// und löschte danach unbedingt. Codex' Messung:
// `Promise.allSettled([svc.purgeTrashedDraft(id), svc.restoreDraft(id)])` → beide erfüllt,
// Bestand 0. Der Mensch holt seinen Entwurf zurück, bekommt „gelungen" gesagt — und hat nichts.
//
// WARUM BEIDE HIER ZUSAMMEN STEHEN: Es ist zweimal dieselbe Frage, nämlich WELCHER der drei
// Löschgründe gerade vorliegt (Nachführung der Steuerung vom 12.09.). Einmal wurde er an einem
// Aufrufer verwechselt, einmal konnte er sich zwischen Prüfung und Vollzug ändern.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft } from "../../services/capture/src/types";

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

function entwurf(id: string, over: Partial<Draft> = {}): Draft {
  return {
    id,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
      confidentiality: "intern",
      origin: "studio",
    },
    originalAuthor: "anna",
    lastEditor: "anna",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...over,
  };
}

// --------------------------------------------------------------------------------------------
// N — NEBENLAUF: WIEDERHERSTELLEN GEGEN ENDGÜLTIG LÖSCHEN.
// --------------------------------------------------------------------------------------------
describe("JOB 3668 R2 · N — Zurückholen und endgültig Löschen treffen sich, und niemand verliert etwas", () => {
  async function getrashterEntwurf() {
    const repo = new InMemoryDraftRepo();
    const dienst = new CaptureService({ repo });
    await repo.insert(entwurf("d-1"));
    await dienst.deleteDraft("d-1", "anna");
    return { repo, dienst };
  }

  /**
   * DIE INVARIANTE, und sie ist der eigentliche Prüfsatz dieser Datei: Es darf NIE eine erfüllte
   * Wiederherstellung neben einem leeren Bestand stehen. Wer „wiederhergestellt" gesagt bekommt,
   * hält danach seinen Entwurf — vollständig, nicht als Hülle. Wer verliert, bekommt ein ehrliches
   * NOT_FOUND und nicht einen behaupteten Vollzug.
   */
  async function pruefeInvariante(
    repo: InMemoryDraftRepo,
    ergebnisse: PromiseSettledResult<unknown>[],
  ) {
    const [erste, zweite] = ergebnisse;
    const erfuellt = ergebnisse.filter((r) => r.status === "fulfilled");
    expect(erfuellt).toHaveLength(1);
    const wiederhergestellt = (await repo.list()).find((d) => d.id === "d-1");
    // Genau eine der beiden Zusagen darf gelten — und der Bestand muss zu ihr passen.
    if (erste?.status === "fulfilled") {
      // Endgültig gelöscht hat gewonnen: der Entwurf ist fort, und das Zurückholen sagt es.
      expect(wiederhergestellt).toBeUndefined();
      expect(zweite).toMatchObject({ status: "rejected", reason: { code: "NOT_FOUND" } });
    } else {
      // Zurückholen hat gewonnen: der Entwurf LEBT, vollständig, und ohne Papierkorb-Spur.
      expect(zweite).toMatchObject({ status: "fulfilled" });
      expect(wiederhergestellt).toEqual(entwurf("d-1"));
      expect(await repo.findById("d-1")).toEqual(entwurf("d-1"));
      expect(erste).toMatchObject({ status: "rejected", reason: { code: "NOT_FOUND" } });
    }
  }

  // DER FALL, DEN CODEX GEMESSEN HAT. In dieser Reihenfolge lag der Datenverlust: `purge` prüfte,
  // gab die Ereignisschleife am `await` frei, `restore` holte den Entwurf zurück und meldete
  // Erfolg — und `purge` löschte danach unbedingt, was inzwischen wieder lebte.
  it("endgültig Löschen zuerst: es gewinnt, und das Zurückholen behauptet keinen Erfolg", async () => {
    const { repo, dienst } = await getrashterEntwurf();

    const ergebnisse = await Promise.allSettled([
      dienst.purgeTrashedDraft("d-1"),
      dienst.restoreDraft("d-1"),
    ]);

    await pruefeInvariante(repo, ergebnisse);
    // Deterministisch an dieser Ablage: die Bedingung steht in derselben Anweisung wie die
    // Löschung, es gibt zwischen ihnen keinen Punkt, an dem `restore` fortsetzen könnte.
    expect(ergebnisse[0]?.status).toBe("fulfilled");
    expect(await repo.list()).toEqual([]);
  });

  it("Zurückholen zuerst: der Entwurf lebt VOLLSTÄNDIG weiter, das endgültige Löschen greift ins Leere", async () => {
    const { repo, dienst } = await getrashterEntwurf();

    const ergebnisse = await Promise.allSettled([
      dienst.restoreDraft("d-1"),
      dienst.purgeTrashedDraft("d-1"),
    ]);

    // Umgekehrte Rollen, dieselbe Invariante — deshalb der Tausch vor der Prüfung.
    await pruefeInvariante(repo, [
      ergebnisse[1] as PromiseSettledResult<unknown>,
      ergebnisse[0] as PromiseSettledResult<unknown>,
    ]);
    expect(ergebnisse[0]?.status).toBe("fulfilled");
    // Titel, Rumpf, Quelle, Zeit und Vertraulichkeit — keine Hülle (Auftrag §4.3).
    expect(await repo.findById("d-1")).toEqual(entwurf("d-1"));
  });

  it("zwei endgültige Löschungen gleichzeitig: genau eine vollzieht, die andere sagt NOT_FOUND", async () => {
    // Derselbe Prüfsatz von der anderen Seite: der Vollzug wird BERICHTET, nicht behauptet. Läge
    // die Bedingung wieder vor dem Löschen, meldeten beide Erfolg für EINE Löschung.
    const { dienst, repo } = await getrashterEntwurf();

    const ergebnisse = await Promise.allSettled([
      dienst.purgeTrashedDraft("d-1"),
      dienst.purgeTrashedDraft("d-1"),
    ]);

    expect(ergebnisse.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(ergebnisse.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await repo.list()).toEqual([]);
  });
});

// --------------------------------------------------------------------------------------------
// V — DER ZWEITE ÜBERNAHMEWEG, an der echten App.
// --------------------------------------------------------------------------------------------
describe("JOB 3668 R2 · V — Ein übernommener Entwurf ist VERBRAUCHT, auch über die Dokumentübernahme", () => {
  async function anmelden(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return { authorization: `Bearer ${res.json().token}` };
  }

  async function buehne() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: "anna@x.de", password: "secret123" },
    });
    return { app, headers: await anmelden(app, "anna@x.de", "secret123") };
  }

  async function originalAnlegen(app: App, headers: Record<string, string>) {
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "Pruefbericht.pdf",
        mime: "application/pdf",
        data: PDF_DATA_URL,
        purpose: "anchor",
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  /** Ein Entwurf, wie ihn die Oberfläche nach einer Dokumentübernahme speichert. */
  async function entwurfMitAnker(app: App, headers: Record<string, string>, objectId: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Dichtungswechsel L4",
        statement: "Dichtung vor jedem Anlauf prüfen.",
        type: "best_practice",
        category: "Instandhaltung",
        confidentiality: "intern",
        bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
        pendingSources: [
          {
            label: "Pruefbericht.pdf",
            excerpt: "Dichtung nach 500 h tauschen.",
            anchorKey: "lokal-1",
            objectId,
          },
        ],
        anchorDocuments: [
          { key: "lokal-1", objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
        ],
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    return res.json().id as string;
  }

  async function papierkorb(app: App, headers: Record<string, string>) {
    const res = await app.inject({ method: "GET", url: "/api/drafts/trash", headers });
    expect(res.statusCode).toBe(200);
    return res.json() as { id: string }[];
  }

  it("Dokumentübernahme 201 → der Entwurf ist NICHT im Papierkorb und NICHT wiederherstellbar", async () => {
    const { app, headers } = await buehne();
    const objectId = await originalAnlegen(app, headers);
    const draftId = await entwurfMitAnker(app, headers, objectId);
    const stand = (
      (await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers })).json() as {
        updatedAt: string;
      }
    ).updatedAt;

    const uebernahme = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: {
        operationId: "uebernahme-r2-1",
        draftId,
        expectedUpdatedAt: stand,
        draftPayload: {},
        documents: [
          {
            anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
            points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
          },
        ],
      },
    });
    expect(uebernahme.statusCode).toBe(201);
    // Der Entwurf wurde tatsächlich angefasst — sonst sagte der Rest dieses Falls nichts aus.
    expect(uebernahme.json().followUpsFailed ?? []).toEqual([]);

    // DAS IST DER BEFUND VON CODEX, jetzt als Zusage: hier stand „Papierkorb: 1".
    expect(await papierkorb(app, headers)).toEqual([]);

    // Und er ist auch nicht über die Hintertür zurückzuholen — sonst stünde er als Dublette neben
    // dem Wissensobjekt, das aus ihm geworden ist.
    const zurueck = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/restore`,
      headers,
    });
    expect(zurueck.statusCode).toBe(404);

    // Genau EIN Wissensobjekt, und keine lebende Entwurfszeile daneben.
    expect(
      ((await app.inject({ method: "GET", url: "/api/kos", headers })).json() as unknown[]).length,
    ).toBe(1);
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toEqual([]);
  });

  it("GEGENSTÜCK am selben Weg: LÖSCHT der Mensch denselben Entwurf, liegt er sehr wohl im Papierkorb", async () => {
    // Ohne diesen Fall wäre der obige auch mit einem kaputten Papierkorb grün — „nichts liegt je
    // im Papierkorb" bestünde die Prüfung. Beide Fälle zusammen zeigen den UNTERSCHIED zwischen
    // den Löschgründen, und darum geht es in diesem Auftrag.
    const { app, headers } = await buehne();
    const objectId = await originalAnlegen(app, headers);
    const draftId = await entwurfMitAnker(app, headers, objectId);

    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/drafts/${draftId}`,
      headers,
    });
    expect(geloescht.statusCode).toBe(204);

    expect((await papierkorb(app, headers)).map((d) => d.id)).toEqual([draftId]);
    const zurueck = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/restore`,
      headers,
    });
    expect(zurueck.statusCode).toBe(200);
    expect(zurueck.json().payload.title).toBe("Dichtungswechsel L4");
  });

  it("die Verdrahtung selbst ist gepinnt: `draftPromotion.discard` ruft den VERBRAUCHSWEG", async () => {
    // WARUM EIN PIN AUF DEN QUELLTEXT: Der Fall darüber deckt den Rückfall ab — aber nur, solange
    // ihn jemand fährt. Diese eine Zeile ist die Stelle, an der Runde 1 auseinanderlief: zwei
    // Übernahmewege, zwei verschiedene Verdrahtungen, und die zweite kannte den Unterschied
    // zwischen „gelöscht" und „verbraucht" nicht. Wer sie zurückdreht, liest hier warum.
    const quelle = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    expect(quelle).toContain("discard: (draftId) => services.capture.entwurfVerbraucht(draftId)");
    expect(quelle).not.toContain("discard: (draftId) => services.capture.deleteDraft(draftId)");
  });
});
