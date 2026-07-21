// WP-KLARA-2 (Pedis Befund 2, Kern): das WILDE Word-HTML aus dem Add-in läuft über den
// BESTEHENDEN Draft-Weg (POST /api/drafts) durch den autoritativen Server-Sanitizer
// (services/structure, SCRUM-524 WP5 an der Persistenz-Grenze) — NICHTS am Sanitizer geändert,
// nur der vorhandene Vertrag genutzt. Gepinnt: h1→h2-Mapping (wie beim DOCX-Import), mso-Spans
// fallen weg (Text bleibt), Tabellen bleiben als erlaubtes Struktur-Subset erhalten, data:image-
// Bilder überleben, cid:-/externe Bilder und Skripte fallen weg.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// Realistisch verkleinertes Word-HTML (getSelectedDataAsync(Html) liefert ein Voll-Dokument;
// das Taskpane schneidet den body-Inhalt heraus — hier steht er bereits geschnitten).
const WORD_BODY_HTML = [
  '<h1 class="MsoTitle">Wartung der Presse</h1>',
  '<p class="MsoNormal"><span style="mso-bidi-font-weight:bold"><b>Wichtig:</b> vor Beginn</span> die Anlage freischalten.</p>',
  "<table><tr><td>Schritt</td><td>Dauer</td></tr><tr><td>Freischalten</td><td>5 min</td></tr></table>",
  '<p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Typenschild"></p>',
  '<p><img src="cid:image001.png@01DB" alt="nicht geliefert"></p>',
  "<script>alert(1)</script>",
].join("");

async function appWithLogin() {
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
  return {
    app,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

describe("WP-KLARA-2: Word-HTML → Draft über den bestehenden Sanitizer-Vertrag", () => {
  it("POST /api/drafts mit Word-HTML → persistierter Entwurf trägt das SANITISIERTE bodyHtml", async () => {
    const { app, headers } = await appWithLogin();
    const created = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Wartung der Presse",
        statement: "Wartung der Presse. Wichtig: vor Beginn die Anlage freischalten.",
        bodyHtml: WORD_BODY_HTML,
        origin: "frontdoor",
      },
    });
    expect(created.statusCode).toBe(201);
    const draft = created.json() as { id: string; payload: { bodyHtml?: string } };
    const body = draft.payload.bodyHtml ?? "";
    // h1 → h2 (dasselbe TAG_MAP wie beim DOCX-Import); mso-Klassen/Styles fallen weg.
    expect(body).toContain("<h2>Wartung der Presse</h2>");
    expect(body).not.toContain("<h1");
    expect(body).not.toContain("Mso");
    expect(body).not.toContain("style=");
    // b → strong; der span fällt weg, sein TEXT bleibt (kein Inhaltsverlust).
    expect(body).toContain("<strong>Wichtig:</strong>");
    expect(body).toContain("die Anlage freischalten.");
    // Tabellen bleiben als erlaubtes Struktur-Subset ERHALTEN (Stufe 2 des Sanitizers).
    expect(body).toContain("<table>");
    expect(body).toContain("<td>Freischalten</td>");
    // data:image überlebt; cid:-Bild (Word hat es nicht geliefert) und Skript fallen weg.
    expect(body).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(body).not.toContain("cid:");
    expect(body).not.toContain("<script");
    expect(body).not.toContain("alert(1)");
    // Der GET desselben Entwurfs liefert exakt den persistierten (gesäuberten) Stand.
    const fetched = await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers });
    expect((fetched.json() as { payload: { bodyHtml?: string } }).payload.bodyHtml).toBe(body);
  });
});
