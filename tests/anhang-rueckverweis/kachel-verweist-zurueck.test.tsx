import { afterEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// R-0095: an der Anhangkachel steht ein BEDIENBARER Rückverweis auf das Wissensobjekt — gegen die
// echte App (`montierenGegenServer`): Upload, Anhängen und die Trägerabfrage laufen über die echten
// Routen; ersetzt ist allein der Transport.
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type Prüfstand, montierenGegenServer, ruhen } from "../quellen-anker-im-formular/flaeche";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let stand: Prüfstand | undefined;
afterEach(() => {
  stand?.abbauen();
  stand = undefined;
});

async function aufbau(): Promise<{ koId: string; objectId: string }> {
  await i18n.changeLanguage("de");
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Eva", email: "eva@r0095-ui.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "eva@r0095-ui.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const up = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "skizze.png", mime: "image/png", data: PNG_DATA_URL, purpose: "attachment" },
  });
  const objectId = up.json().id as string;
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Riemen spannen FB12",
      statement: "Den Riemen nach Vorgabe spannen.",
      type: "best_practice",
      category: "Anlage 3",
    },
  });
  const koId = created.json().id as string;
  const attach = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "attach", attachment: { name: "skizze.png", mime: "image/png", objectId } },
  });
  expect(attach.statusCode, attach.body).toBe(200);
  stand = await montierenGegenServer(app, headers, koId);
  const section = stand.container.querySelector<HTMLDetailsElement>(
    '[data-bib-abschnitt="anhaenge"]',
  );
  if (!section) throw new Error("Anhangabschnitt fehlt");
  await act(async () => {
    section.open = true;
    section.dispatchEvent(new Event("toggle"));
  });
  await ruhen();
  return { koId, objectId };
}

describe("R-0095 · die Anhangkachel verweist auf ihr Wissensobjekt", () => {
  it("K1 · sichtbarer Link mit Titel auf /wissen/<id>, gefragt beim Anhang selbst", async () => {
    const { koId, objectId } = await aufbau();
    const s = stand as Prüfstand;
    expect(
      s.anfragen.some((a) => a.pfad === `/api/objects/${objectId}/traeger` && a.status === 200),
      "die Rückrichtung kommt aus der Trägerabfrage des Anhangs",
    ).toBe(true);
    const zeile = s.container.querySelector(`[data-bib-anhang-traeger="${objectId}"]`);
    expect(zeile, "Rückverweis an der Kachel fehlt").not.toBeNull();
    const link = zeile?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`/wissen/${koId}`);
    expect(link?.textContent).toBe("Riemen spannen FB12 (dieser Eintrag)");
    expect(zeile?.textContent).toContain("Gehört zu");
    expect(link?.closest("[hidden], [aria-hidden=true]")).toBeNull();
  });

  it("K2 · die Hinrichtung bleibt: die Kachel öffnet den Anhang über seinen Rohpfad", async () => {
    const { objectId } = await aufbau();
    const knopf = (stand as Prüfstand).container.querySelector<HTMLButtonElement>(
      "[data-bib-anhang]",
    );
    expect(knopf?.getAttribute("aria-label")).toBe("skizze.png — Original in neuem Tab öffnen");
    expect(knopf?.querySelector("a"), "kein Link im Knopf verschachtelt").toBeNull();
    expect(objectId.length).toBeGreaterThan(0);
  });
});
