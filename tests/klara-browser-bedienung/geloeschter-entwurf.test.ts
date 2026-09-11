// ==================================================================================================
// JOB 3606 · Nachtrag 14:45 — DER ENTWURF, DEN ES NICHT MEHR GIBT.
// ==================================================================================================
//
// Pedi hat am 11.09. alle Entwürfe in der Weboberfläche gelöscht und danach aus der Leiste
// gespeichert. Die Leiste hielt `work.draftId` weiter fest, schickte `PUT /api/drafts/:id`, und der
// Server antwortete 404 `{ error: "NOT_FOUND", message: "Entwurf nicht gefunden." }`. Weil `api()`
// die 404 nicht kannte, fiel sie in den Sammelfall `rejected` — und auf dem Bildschirm stand „Der
// Server hat abgelehnt. Angaben prüfen." Das ist doppelt falsch: die Angaben waren in Ordnung, und
// der nächste Versuch scheiterte an derselben toten Kennung wieder.
//
// Gemessen wird hier der ZUSTAND, aus dem die Oberfläche entsteht — der Prüfstand ist derselbe
// Worker-Prüfstand wie überall (`tests/klara-browser/harness.ts`): echter `worker.js`, gestellter
// Chrome-Anschluss, gestelltes Netz. Was am echten Browser gemessen wurde, steht in der Rückgabe.
import { beforeEach, describe, expect, it } from "vitest";
import type { View } from "../../extensions/klara-browser/types";
import { harness, plainVariants, verfahren } from "../klara-browser/harness";

type Sicht = View & { reason?: string };

const SEITE = {
  url: "https://www.iana.org/help/example-domains",
  title: "Example Domains",
  text: "Ein Absatz, den Pedi markiert hat.",
};
const FORM = { title: "Titel", context: "", confidentiality: "intern", origin: "" };

/** Jede Anfrage, die der Worker abgesetzt hat — Verfahren und Adresse, in der Reihenfolge. */
type Anfrage = { verfahren: string; adresse: string };

/**
 * Ein Prüfstand mit EINEM bereits gespeicherten Entwurf. `antwortet` entscheidet, was der Server
 * dem PUT auf diesen Entwurf sagt — das ist der Unterschied zwischen „gelöscht" (404) und „nicht
 * erlaubt" (403), und genau den muss die Leiste auseinanderhalten.
 */
async function mitGespeichertemEntwurf(
  antwortet: (anfrage: Anfrage) => Response | null,
  anfragen: Anfrage[] = [],
) {
  let angelegt = 0;
  const h = harness(async (eingabe, optionen) => {
    const adresse = String(eingabe);
    const art = verfahren(optionen);
    anfragen.push({ verfahren: art, adresse });
    if (adresse.endsWith("/login"))
      return Response.json({
        token: "fixture-session-secret",
        user: { id: "person-a", email: "a@example.test" },
      });
    const eigene = antwortet({ verfahren: art, adresse });
    if (eigene) return eigene;
    // Der gesunde Anlege- und Aktualisierungsweg: der Server gibt zurück, was er bekommen hat —
    // genau das prüft `matches()` im Worker nach.
    const rumpf = JSON.parse(String(optionen?.body)) as Record<string, unknown>;
    angelegt += 1;
    return Response.json(
      {
        id: art === "POST" ? `draft-${angelegt}` : adresse.split("/").pop(),
        originalAuthor: "person-a",
        payload: rumpf,
        updatedAt: "2026-09-11T14:00:00.000Z",
      },
      { status: art === "POST" ? 201 : 200 },
    );
  });
  h.setSelected({ ...SEITE, variants: plainVariants(SEITE.text) });
  await h.capture();
  await h.send({ type: "login", email: "a@example.test", password: "x" });
  const erst = (await h.send({ type: "save", form: FORM })) as Sicht;
  expect(erst.status, "der erste Entwurf entstand gar nicht").toBe("saved");
  expect(erst.draftId).toBe("draft-1");
  return h;
}

describe("JOB 3606 · ein gelöschter Entwurf ist keine abgelehnte Eingabe", () => {
  let anfragen: Anfrage[];
  beforeEach(() => {
    anfragen = [];
  });

  it("sagt, dass der Entwurf nicht mehr da ist — und sagt es MIT dem Satz des Servers", async () => {
    const h = await mitGespeichertemEntwurf(
      ({ verfahren: art }) =>
        art === "PUT"
          ? Response.json(
              { error: "NOT_FOUND", message: "Entwurf nicht gefunden." },
              { status: 404 },
            )
          : null,
      anfragen,
    );

    const sicht = (await h.send({
      type: "save",
      form: { ...FORM, title: "Zweite Fassung" },
    })) as Sicht;

    // GENAU DER BEFUND: vorher stand hier `rejected` — „Der Server hat abgelehnt. Angaben prüfen."
    expect(sicht.status).toBe("draft_missing");
    expect(sicht.reason).toBe("Entwurf nicht gefunden.");
    // Der Text des Menschen bleibt. Ohne diese Zusicherung wäre die Reparatur wertlos.
    expect(sicht.selection?.url).toBe(SEITE.url);
    expect(sicht.variants?.selection.text).toBe(SEITE.text);
    expect(sicht.form?.title).toBe("Zweite Fassung");
    // Und die tote Kennung ist weg — samt dem Link, der nirgendwohin geführt hätte.
    expect(sicht.draftId).toBeUndefined();
    expect(sicht.link).toBeUndefined();
  });

  it("legt beim nächsten Speichern einen NEUEN Entwurf an und fragt die tote Kennung nie wieder", async () => {
    const h = await mitGespeichertemEntwurf(
      ({ verfahren: art, adresse }) =>
        art === "PUT" && adresse.endsWith("/draft-1")
          ? Response.json(
              { error: "NOT_FOUND", message: "Entwurf nicht gefunden." },
              { status: 404 },
            )
          : null,
      anfragen,
    );
    await h.send({ type: "save", form: { ...FORM, title: "Zweite Fassung" } });
    const nachDem404 = anfragen.length;

    const sicht = (await h.send({
      type: "save",
      form: { ...FORM, title: "Zweite Fassung" },
    })) as Sicht;

    // „Als NEUEN Entwurf sichern" — und zwar wirklich neu, auf dem Anlageweg.
    expect(sicht.status).toBe("saved");
    expect(sicht.draftId).toBe("draft-2");
    const danach = anfragen.slice(nachDem404);
    expect(danach.map((a) => a.verfahren)).toEqual(["POST"]);
    // Kein stilles Weiterbinden: nach der 404 geht keine Anfrage mehr an `draft-1`.
    expect(danach.filter((a) => a.adresse.endsWith("/draft-1"))).toEqual([]);
  });

  it("nimmt nach der 404 auch die Einstufungssperre zurück", async () => {
    // `savedLevel` gehörte dem gelöschten Entwurf. Bliebe es stehen, verweigerte der PUT-Weg
    // („classification_locked") eine Rücknahme auf „Offen" für einen Entwurf, den es nicht gibt.
    const h = await mitGespeichertemEntwurf(
      ({ verfahren: art }) =>
        art === "PUT" ? Response.json({ error: "NOT_FOUND" }, { status: 404 }) : null,
      anfragen,
    );
    await h.send({ type: "save", form: FORM });

    const sicht = (await h.send({
      type: "save",
      form: { ...FORM, confidentiality: "" },
    })) as Sicht;

    expect(sicht.status).toBe("saved");
  });

  it("biegt eine echte 403 NICHT in „neu anlegen“ um", async () => {
    // Eine fehlende Berechtigung ist keine Einladung, denselben Inhalt ein zweites Mal anzulegen.
    const h = await mitGespeichertemEntwurf(
      ({ verfahren: art }) =>
        art === "PUT" ? Response.json({ error: "FORBIDDEN" }, { status: 403 }) : null,
      anfragen,
    );

    const sicht = (await h.send({ type: "save", form: FORM })) as Sicht;

    expect(sicht.status).toBe("denied");
    // Die Kennung bleibt: der Entwurf existiert, er gehört nur gerade nicht diesem Zugriff.
    expect(sicht.draftId).toBe("draft-1");
  });

  it("hält auch „Status erneut prüfen“ nicht an einer gelöschten Kennung fest", async () => {
    const h = await mitGespeichertemEntwurf(
      ({ verfahren: art }) =>
        art === "GET"
          ? Response.json(
              { error: "NOT_FOUND", message: "Entwurf nicht gefunden." },
              { status: 404 },
            )
          : null,
      anfragen,
    );
    const vorher = anfragen.length;

    const sicht = (await h.send({ type: "state" })) as Sicht;
    expect(sicht.status).toBe("draft_missing");
    expect(sicht.draftId).toBeUndefined();

    // Der zweite Druck auf denselben Knopf fragt nicht noch einmal nach — es gibt nichts
    // nachzulesen. Der Satz bleibt stehen (der Entwurf ist ja weiterhin weg), aber es geht keine
    // zweite Anfrage an die tote Kennung: GEMESSEN, genau EIN GET im ganzen Ablauf.
    const erneut = (await h.send({ type: "state" })) as Sicht;
    expect(erneut.status).toBe("draft_missing");
    expect(erneut.draftId).toBeUndefined();
    expect(anfragen.slice(vorher).filter((a) => a.verfahren === "GET")).toHaveLength(1);
  });

  it("deutet eine 404 der Anmeldung NICHT als gelöschten Entwurf", async () => {
    // Nur die beiden Wege mit einer Entwurfskennung dürfen 404 so lesen. Eine 404 am Anmeldeweg
    // sagt nichts über einen Entwurf — sie bleibt der Sammelfall.
    const h = harness(async () => Response.json({ error: "NOT_FOUND" }, { status: 404 }));
    h.setSelected({ ...SEITE, variants: plainVariants(SEITE.text) });
    await h.capture();

    const sicht = (await h.send({
      type: "login",
      email: "a@example.test",
      password: "x",
    })) as Sicht;

    expect(sicht.status).toBe("rejected");
  });
});

describe("JOB 3606 · die Vorschau zeigt den übernommenen Inhalt, sonst nichts", () => {
  it("hält die Metadatenzeilen aus der Vorschau heraus — und lässt sie im Gespeicherten stehen", async () => {
    let gesendet = "";
    const h = harness(async (eingabe, optionen) => {
      const adresse = String(eingabe);
      if (adresse.endsWith("/login"))
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      const rumpf = JSON.parse(String(optionen?.body)) as { bodyHtml: string };
      gesendet = rumpf.bodyHtml;
      return Response.json(
        { id: "draft-1", originalAuthor: "person-a", payload: rumpf },
        { status: 201 },
      );
    });
    h.setSelected({ ...SEITE, variants: plainVariants(SEITE.text) });
    await h.capture();
    await h.send({ type: "login", email: "a@example.test", password: "x" });

    const sicht = (await h.send({ type: "state" })) as Sicht;
    const text = JSON.stringify(sicht.preview);

    // Die Vorschau ist der übernommene Inhalt — genau der Absatz, den Klara gelesen hat.
    expect(sicht.preview).toEqual(plainVariants(SEITE.text).selection.nodes);
    // Und ausdrücklich NICHT der technische Block, durch den man vorher scrollen musste.
    for (const zeile of ["Seite / Page", "Erfasst / Captured", "Umfang / Scope", "Kontext"])
      expect(text, `„${zeile}" steht weiterhin in der Vorschau`).not.toContain(zeile);

    // Was GESPEICHERT wird, ist unverändert der volle Entwurfskörper. Fiele das mit weg, wäre die
    // Herkunft aus dem Entwurf verschwunden — die Vorschau darf nur die Ansicht ändern.
    await h.send({ type: "save", form: FORM });
    for (const zeile of ["Seite / Page", "Ursprüngliche Quelle", "Erfasst / Captured"])
      expect(gesendet, `„${zeile}" fehlt im gespeicherten Entwurf`).toContain(zeile);
    expect(gesendet).toContain(SEITE.text);
  });
});
