import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { bodyReadMode, hasBodyBlocks } from "../../apps/web/src/lib/bodyReadMode";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { validationReviewContext } from "../../apps/web/src/lib/validationReviewContext";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-335: Beta-Kernflow Capture/Editor → offenes KO → Validation runtime-nah über die ECHTEN
// HTTP-Routen + Server-Sanitizer geprüft und mit den FE-Anzeige-/Readiness-Helfern verbunden.
// Erlaubte Body-Block-Klassen (panel/panel-info/panel-warning) bleiben erhalten; on*-Handler, style,
// fremde Klassen, <script> und externe Bilder werden entfernt. Offenes Wissen bleibt offen/nicht
// validiert (Trust 0), erscheint im Validation Board und gilt als „needs-work" — keine Fake-Freigabe.
describe("SCRUM-335: Capture-Editor → Validation E2E (HTTP + Sanitizer + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  it("speichert strukturierten, sanitisierten Body als offenes KO, das als Review-Arbeit sichtbar ist", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) Realistischer ausführlicher Body: erlaubte Blöcke + bewusst gefährliche/fremde Inhalte.
    const rawBody = [
      "<h2>Ablauf</h2>",
      '<div class="panel panel-info" onclick="evil()" style="color:red"><p>Erst Druck ablassen.</p></div>',
      '<div class="evil panel panel-warning"><p>Achtung: heisse Oberflaeche, Schutzhandschuhe tragen.</p></div>',
      "<ul><li>Ventil schliessen</li><li>Restdruck pruefen</li></ul>",
      "<script>alert(1)</script>",
      '<img src="https://evil/x.png">',
    ].join("");

    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Presse P2 sicher entlueften",
        statement: "Vor Wartung Druck ablassen und Restdruck pruefen.",
        bodyHtml: rawBody,
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 2,
      },
    });
    expect(created.statusCode).toBe(201);
    const ko = created.json() as KnowledgeObject & { bodyHtml: string };

    // 2) Offen, nicht validiert, Trust ehrlich 0, erste Version.
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.version).toBe(1);

    // 3) BodyHtml ist serverseitig sanitisiert: erlaubte Block-Klassen bleiben, Gefährliches ist weg.
    const body = ko.bodyHtml;
    expect(body).toContain('class="panel panel-info"');
    expect(body).toContain('class="panel panel-warning"');
    expect(body).not.toContain("evil"); // fremde Klasse + externes Bild entfernt
    expect(body).not.toContain("onclick");
    expect(body).not.toContain("style=");
    expect(body.toLowerCase()).not.toContain("<script");
    expect(body).not.toContain("https://evil");

    // 4) FE-Anzeige-Helfer erkennen Body + Blöcke plausibel (DOM-frei, auf sanitisiertem HTML).
    expect(hasBodyBlocks(body)).toBe(true);
    expect(bodyReadMode(body)).toEqual({ hasBody: true, hasBlocks: true });
    const quality = editorContentQuality({ bodyHtml: body, attachments: [] });
    expect(quality.isEmpty).toBe(false);
    expect(quality.hasBlocks).toBe(true);
    expect(quality.hasHeadings).toBe(true);
    expect(quality.hasLists).toBe(true);

    // 5) Nutzbarkeit/Trust/Status sind NICHT irreführend: needs-work, nicht „ready".
    const overview = koOverview(ko);
    expect(overview.usability).toBe("needs-work");
    expect(overview.status).not.toBe("validiert");
    expect(overview.trust).toBe(0);
    expect(useReadiness(overview.usability).usability).not.toBe("ready");
    // frisch erfasst = „neu" im Validation-Fokus (Version 1), nicht „revidiert".
    expect(validationReviewContext(ko).kind).toBe("new");

    // 6) Das offene KO erscheint im Validation Board als Review-Arbeit.
    const board = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: admin,
    });
    expect(board.statusCode).toBe(200);
    const onBoard = (board.json() as KnowledgeObject[]).find((k) => k.id === ko.id);
    expect(onBoard).toBeDefined();
    expect(onBoard?.status).toBe("offen");

    // 7) Erste Bewertung kann beginnen, ohne Fake-Freigabe: eine grüne Stimme reicht bei needed=2 nicht.
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode).toBe(200);
    const afterOneUp = (
      await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(afterOneUp.status).toBe("offen"); // up=1 < needed=2 → bleibt offen
    expect(koOverview(afterOneUp).usability).not.toBe("ready");
  });
});
