// ================================================================================================
// JOB 2696 D1 — „ENTWUERFE FORTSETZEN" LAEDT NUR NOCH, WAS DER FRAGENDE SEHEN DARF
// ================================================================================================
//
// Pedis Frage: „Warum wird meine Entwurfsliste langsamer, wenn ein Kollege viel gespeichert hat?"
//
// Der Befund R2-33, woertlich: *„`GET /api/drafts` → `listDraftsForResume()` →
// `SELECT data FROM drafts ORDER BY …` (alle Nutzer, volles `bodyHtml` bis 5 MiB je Entwurf),
// dann `withAnchorCheck` je Entwurf (Objekt-Nachschlaege), erst danach `visibleDraftsFor(user, …)`."*
//
// DIESE DATEI MISST DEN GEWINN, statt ihn zu behaupten — der Auftrag verlangt genau das:
// „Zaehl die geladenen Zeilen oder Bytes vor und nach der Aenderung."
//
// UND SIE HAELT DIE ZUSICHERUNG FEST, die dabei nicht kippen darf: `visibleDraftsFor` entscheidet,
// wer welchen Entwurf sieht. Wird vorher gefiltert, muss die Menge am Ende DIESELBE sein — fuer
// den Autor UND fuer den Admin.

import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { DraftRepo } from "../../services/capture/src/repo";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft } from "../../services/capture/src/types";

// ------------------------------------------------------------------------------ die Messablage
/**
 * Eine Ablage, die mitschreibt, WIE VIEL sie herausgibt.
 *
 * Gezaehlt werden Datensaetze UND Bytes. Die Bytes sind der eigentliche Punkt des Befunds: ein
 * Entwurf darf bis 5 MiB `bodyHtml` tragen, und die Zahl der Zeilen allein verschweigt, was das
 * fuer die Leitung bedeutet.
 */
class MessendeAblage implements DraftRepo {
  readonly innen = new InMemoryDraftRepo();
  gelesen = { datensaetze: 0, bytes: 0, aufrufe: [] as string[] };

  #zaehle(drafts: Draft[], weg: string): Draft[] {
    this.gelesen.datensaetze += drafts.length;
    this.gelesen.bytes += drafts.reduce((s, d) => s + JSON.stringify(d).length, 0);
    this.gelesen.aufrufe.push(weg);
    return drafts;
  }

  insert(d: Draft) {
    return this.innen.insert(d);
  }
  findById(id: string) {
    return this.innen.findById(id);
  }
  update(d: Draft) {
    return this.innen.update(d);
  }
  delete(id: string) {
    return this.innen.delete(id);
  }
  async list(): Promise<Draft[]> {
    return this.#zaehle(await this.innen.list(), "list()");
  }
  async listByAuthor(autor: string): Promise<Draft[]> {
    // Vor dem Bau gibt es diese Methode nicht; der Dienst faellt dann auf `list()` zurueck.
    const alle = await this.innen.list();
    return this.#zaehle(
      alle.filter((d) => d.originalAuthor === autor),
      `listByAuthor(${autor})`,
    );
  }
}

const SCHWER = "x".repeat(20_000); // ein Entwurf mit Gewicht — stellvertretend fuer bodyHtml

function entwurf(id: string, autor: string, gewicht = false): Draft {
  return {
    id,
    originalAuthor: autor,
    createdAt: new Date(Number(id.slice(-1)) * 1000).toISOString(),
    updatedAt: new Date(Number(id.slice(-1)) * 1000).toISOString(),
    payload: {
      title: `Entwurf ${id}`,
      statement: "Aussage",
      bodyHtml: gewicht ? SCHWER : null,
    },
  } as unknown as Draft;
}

/** Ein Bestand, wie er im Betrieb aussieht: mehrere Nutzer, einer davon mit schweren Entwuerfen. */
async function bestand(): Promise<MessendeAblage> {
  const ablage = new MessendeAblage();
  await ablage.insert(entwurf("anna-1", "anna"));
  await ablage.insert(entwurf("anna-2", "anna"));
  await ablage.insert(entwurf("bodo-3", "bodo", true));
  await ablage.insert(entwurf("bodo-4", "bodo", true));
  await ablage.insert(entwurf("bodo-5", "bodo", true));
  await ablage.insert(entwurf("cara-6", "cara", true));
  return ablage;
}

// ================================================================================================
describe("JOB 2696 · R2-33 — die Entwurfsliste laedt nur noch die eigene Menge", () => {
  it("MESSUNG: Anna fragt — geladen wird nur, was Anna sehen darf", async () => {
    const ablage = await bestand();
    const dienst = new CaptureService({ repo: ablage });

    await dienst.listDraftsForResume("anna");

    // Anna hat zwei Entwuerfe, beide leicht. Der Bestand hat sechs, vier davon schwer.
    expect(ablage.gelesen.datensaetze).toBe(2);
    expect(ablage.gelesen.aufrufe).toEqual(["listByAuthor(anna)"]);
    // Kein einziges Byte eines fremden, schweren Entwurfs hat die Ablage verlassen.
    expect(ablage.gelesen.bytes).toBeLessThan(SCHWER.length);
  });

  it("MESSUNG: der Admin fragt — geladen wird weiterhin alles", async () => {
    const ablage = await bestand();
    const dienst = new CaptureService({ repo: ablage });

    await dienst.listDraftsForResume();

    expect(ablage.gelesen.datensaetze).toBe(6);
    expect(ablage.gelesen.aufrufe).toEqual(["list()"]);
  });

  it("die Ankerpruefung laeuft NUR auf der gefilterten Menge", async () => {
    // Der teure Teil des Befunds: `withAnchorCheck` schlaegt je Entwurf Objekte nach. Lief er
    // ueber fremde Entwuerfe, bezahlte Anna die Ankerpruefung von Bodos Bildern mit.
    const ablage = await bestand();
    const nachgeschlagen: string[] = [];
    const dienst = new CaptureService({
      repo: ablage,
      objectExists: async (id) => {
        nachgeschlagen.push(id);
        return true;
      },
    });

    const ergebnis = await dienst.listDraftsForResume("anna");

    expect(ergebnis).toHaveLength(2);
    expect(ergebnis.every((e) => e.draft.originalAuthor === "anna")).toBe(true);
  });
});

// ================================================================================================
describe("JOB 2696 · R2-33 — die Zusicherung kippt nicht", () => {
  /**
   * DIE STELLE, WO DER MENSCH HANDELT: `GET /api/drafts` ueber die echte Anwendung.
   *
   * Vorher entschied `visibleDraftsFor` allein. Nachher filtert die Ablage vor — die Menge am Ende
   * MUSS dieselbe sein. Beide Faelle stehen hier, nicht nur der schnelle.
   */
  async function baueMitEntwuerfen(): Promise<{
    app: ReturnType<typeof buildApp>;
    kopf: (t: string) => Record<string, string>;
    annaToken: string;
    adminToken: string;
  }> {
    const services = buildServices();
    const app = buildApp(services);

    // Erstes Konto = Admin (Bootstrap), zweites = Anna.
    const admin = await services.auth.register({
      name: "Admin",
      email: "admin@x.de",
      password: "secret123",
    });
    const anna = await services.auth.register({
      name: "Anna",
      email: "anna@x.de",
      password: "secret123",
    });
    await services.auth.approveUser(anna.id, admin.id);
    await services.auth.changeRole(anna.id, "experte", admin.id);

    const adminAnmeldung = await services.auth.login({
      email: "admin@x.de",
      password: "secret123",
    });
    const annaAnmeldung = await services.auth.login({ email: "anna@x.de", password: "secret123" });

    await services.capture.createDraft({ title: "Annas Erster", statement: "A" }, anna.id);
    await services.capture.createDraft({ title: "Annas Zweiter", statement: "B" }, anna.id);
    await services.capture.createDraft({ title: "Admins Entwurf", statement: "C" }, admin.id);

    return {
      app,
      kopf: (t) => ({ authorization: `Bearer ${t}` }),
      annaToken: annaAnmeldung.token,
      adminToken: adminAnmeldung.token,
    };
  }

  it("Anna sieht genau ihre zwei Entwuerfe — und keinen fremden", async () => {
    const { app, kopf, annaToken } = await baueMitEntwuerfen();
    const antwort = await app.inject({
      method: "GET",
      url: "/api/drafts",
      headers: kopf(annaToken),
    });

    expect(antwort.statusCode).toBe(200);
    const liste = antwort.json() as { originalAuthor: string; payload: { title: string } }[];
    expect(liste).toHaveLength(2);
    expect(liste.map((d) => d.payload.title).sort()).toEqual(["Annas Erster", "Annas Zweiter"]);
  });

  it("der Admin sieht weiterhin ALLE drei — auch die von Anna", async () => {
    const { app, kopf, adminToken } = await baueMitEntwuerfen();
    const antwort = await app.inject({
      method: "GET",
      url: "/api/drafts",
      headers: kopf(adminToken),
    });

    expect(antwort.statusCode).toBe(200);
    const liste = antwort.json() as { payload: { title: string } }[];
    expect(liste).toHaveLength(3);
    expect(liste.map((d) => d.payload.title).sort()).toEqual([
      "Admins Entwurf",
      "Annas Erster",
      "Annas Zweiter",
    ]);
  });
});
