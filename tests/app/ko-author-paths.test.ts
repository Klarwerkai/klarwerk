// WP-RETEST7 R6 (Pedis Befund: Validierungskarte ohne „von …"). DIAGNOSE-Ergebnis: die LIVE-Pfade
// (Wizard-Submit POST /api/kos, FrontDoor/Klara Draft→Promote) setzen author bereits aus dem
// Session-Nutzer — die Lücke sind (a) ALTBESTANDS-Entwürfe ohne originalAuthor, deren Promote
// bisher ein leeres author-Feld erzeugte, und (b) Import-Items mit LEEREM Autor-String (?? griff
// nicht). FIX am Entstehungsort: leerer Autor → ehrlicher Fallback auf den eingeloggten Nutzer.
// Rückwirkend wird NICHTS angefasst (Altbestand ohne Autor bleibt ehrlich ohne „von").
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

async function appWithUser() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const userId = (login.json() as { user: { id: string } }).user.id;
  return { app, services, userId, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("WP-RETEST7 R6: author ist auf JEDEM Anlege-Pfad gesetzt", () => {
  it("Wizard-Submit (POST /api/kos) → author = Session-Nutzer (Bestandsverhalten, gepinnt)", async () => {
    const { app, userId, headers } = await appWithUser();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title: "Direkt", statement: "s", type: "best_practice", category: "K" },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { author: string }).author).toBe(userId);
  });

  it("FrontDoor/Klara-Weg (Draft → Promote) → author = Session-Nutzer (Bestandsverhalten, gepinnt)", async () => {
    const { app, userId, headers } = await appWithUser();
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "KLARA VISION DEtest",
        statement: "s",
        type: "best_practice",
        category: "K",
      },
    });
    const promoted = await app.inject({
      method: "POST",
      url: `/api/drafts/${(draft.json() as { id: string }).id}/promote`,
      headers,
      payload: {},
    });
    expect(promoted.statusCode).toBe(201);
    expect((promoted.json() as { author: string }).author).toBe(userId);
  });

  it("FIX: ALTBESTANDS-Entwurf ohne originalAuthor → Promote setzt den EINREICHENDEN Nutzer", async () => {
    const { app, services, userId, headers } = await appWithUser();
    // Altbestand simulieren: Entwurf mit LEEREM originalAuthor direkt über den Service.
    const legacy = await services.capture.createDraft(
      { title: "Alt-Entwurf", statement: "s", type: "best_practice", category: "K" },
      "",
    );
    const promoted = await app.inject({
      method: "POST",
      url: `/api/drafts/${legacy.id}/promote`,
      headers,
      payload: {},
    });
    expect(promoted.statusCode).toBe(201);
    // Vorher: author "" → Validierungskarte ohne „von". Jetzt: der Einreicher.
    expect((promoted.json() as { author: string }).author).toBe(userId);
  });

  it("FIX: Import-Item mit LEEREM Autor-String → Accept setzt den annehmenden Nutzer", async () => {
    const { services } = await appWithUser();
    await services.library.createImportCandidates(
      [
        {
          title: "Importiert ohne Autor",
          statement: "s",
          type: "best_practice",
          category: "K",
          author: "",
        },
      ],
      "tester",
    );
    const [candidate] = await services.library.listImportCandidates();
    await services.library.reviewImportCandidate(
      (candidate as { id: string }).id,
      "accept",
      "reviewer-1",
    );
    const [ko] = await services.ko.list();
    expect(ko?.author).toBe("reviewer-1");
  });

  it("Validierungs-Board: neue KOs tragen einen nicht-leeren author für die von-Zeile der Karte", async () => {
    const { app, headers } = await appWithUser();
    await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title: "Fürs Board", statement: "s", type: "best_practice", category: "K" },
    });
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(board.statusCode).toBe(200);
    const entries = board.json() as { author?: string }[];
    expect(entries.length).toBe(1);
    expect((entries[0]?.author ?? "").trim().length).toBeGreaterThan(0);
  });
});
