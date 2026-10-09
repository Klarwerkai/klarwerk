// ==================================================================================================
// LESEN-INHALT-ZUERST · Artikel und freigegebene Arbeitsanleitung im echten Browser.
// ==================================================================================================
//
// Auftrag `produkt:20261007:lesen-inhalt-zuerst`. Beobachtet am 07.10.2026: Titel und Inhalt standen
// erst NACH einer etwa 280 px hohen Kenntnisnahmefläche, obwohl keine Kenntnisnahme verlangt war;
// eine freigegebene Arbeitsanleitung begann mit Entstehungsschritten und Bearbeitungsformularen.
//
// Gemessen wird hier, was nur ein Browser sagen kann — Lage, Höhe, Verdeckung, Umbruch:
//   K1 · Desktop: Status, Titel und Text stehen VOR der Kenntnisnahme; Titel und erste Regel liegen
//        im ersten Bild.
//   K2 · Das Smoke-Konto ist Admin (Zuweisungsrecht) und hat selbst KEINE Anforderung — genau der
//        beobachtete Fall. Die Fläche ist eine zugeklappte Zeile (< 80 px) nach dem Inhalt.
//        Die WIRKSAMKEIT einer echten Pflichtkenntnisnahme (Verweis oben, Bestätigen nur per Klick)
//        steht in `tests/lesen-inhalt-zuerst/kenntnisnahme-nachgeordnet.test.tsx` gegen die echte
//        App; ein zweites, freigegebenes Konto hat dieser Smoke-Server nicht.
//   K3 · 390 × 844: Titel und erste Regel liegen im ersten Bild, brechen innerhalb der Lesespalte
//        um, und an ihrer Mitte liegt weder Klara noch eine Aktion (`elementFromPoint`).
//   K4 · Freigegebene Anleitung: die Lesefassung steht vor „Bearbeiten und Freigabe"; aufgeklappt
//        sind Kopfangaben und Entscheidung erreichbar, der Vergleich der Stände (Historie) steht offen.
//   K5 · Quellen-Sprung, Meta-Zeile und Beziehungen sind beschriftet sichtbar; „Mehr" zeigt vier
//        benannte Gruppen.
//
// Bildanhänge je Fall sind die Bedienbelege (Playwright-Bericht). Alle Daten sind fiktiv.
import { type APIRequestContext, type Locator, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

const SCHMAL = { width: 390, height: 844 } as const;

interface Rechteck {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Eintrag {
  id: string;
  titel: string;
  regel: string;
}

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Ein fiktiver Eintrag. `lang` (Vorgabe): langes Kompositum im Titel und eine mehrzeilige Regel —
 * der Umbruchfall. `kurz`: kurzer Titel, eine kurze Regel — der Fall eines kleinen Testobjekts
 * (Ben, nacharbeit-6, nach dem Vergleichsbericht P1 · U11/U15; der Bericht selbst liegt ausserhalb
 * der lesbaren Pfade, die Daten hier sind deshalb eigene, fiktive Werte).
 */
async function legeEintragAn(
  request: APIRequestContext,
  m: string,
  art: "lang" | "kurz" = "lang",
): Promise<Eintrag> {
  const titel =
    art === "kurz"
      ? `Ventil prüfen ${m}`
      : `Druckluftbehälterprüfungsdokumentation vor Inbetriebnahme ${m}`;
  const regel =
    art === "kurz"
      ? `Regel 1: Ventil vor Arbeitsbeginn schließen (${m}).`
      : [
          "Regel 1: Vor jeder Inbetriebnahme das Sicherheitsventil des Druckluftbehälters prüfen",
          `und das Ergebnis im Prüfbuch festhalten (${m}).`,
        ].join(" ");
  const antwort = await request.post("/api/kos", {
    data: {
      title: titel,
      statement: regel,
      // Nacharbeit 2 (Prüflauf K4): ohne Fließtext trägt die gebundene Fassung keinen Rumpf, und die
      // Lesefassung der Anleitung zeigt nur Titel und Fassung des Abschnitts. Die Regel steht deshalb
      // auch als Fließtext da — wie bei einem gewöhnlich erfassten Artikel.
      bodyHtml: `<p>${regel}</p>`,
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
    },
  });
  const grund = `Anlegen scheiterte: ${antwort.status()} ${await antwort.text()}`;
  expect(antwort.ok(), grund).toBe(true);
  const ko = (await antwort.json()) as { id: string };
  return { id: ko.id, titel, regel };
}

async function box(ort: Locator): Promise<Rechteck> {
  const b = await ort.boundingBox();
  expect(b, "das Element hat keine Lage im Bild").not.toBeNull();
  return b as Rechteck;
}

/**
 * Nacharbeit 6 (Ben): liegt an MEHREREN Stellen des ganzen Elements (Ecken innen, Mitte) wirklich
 * dieses Element? Nicht nur die Mitte der ersten Zeile — auch das Ende eines Absatzes darf weder
 * vom Hilfeknopf noch von einer anderen Fläche verdeckt sein. Punkte ausserhalb des Bildes zählen
 * als nicht frei (das Element liegt dann nicht vollständig im ersten Bild).
 */
async function ganzFrei(ort: Locator): Promise<boolean> {
  return ort.evaluate((ziel) => {
    const r = ziel.getBoundingClientRect();
    const rand = 3;
    const punkte: Array<[number, number]> = [
      [r.left + rand, r.top + rand],
      [r.right - rand, r.top + rand],
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + rand, r.bottom - rand],
      [r.right - rand, r.bottom - rand],
    ];
    return punkte.every(([x, y]) => {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        return false;
      }
      const oben = document.elementFromPoint(x, y);
      return oben !== null && (ziel === oben || ziel.contains(oben));
    });
  });
}

/** Steht `a` im Dokument vor `b`? */
async function steht(a: Locator, vorB: Locator): Promise<boolean> {
  const b = await vorB.elementHandle();
  return a.evaluate((x, y) => {
    if (!y) {
      return false;
    }
    return (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }, b);
}

function schneiden(a: Rechteck, b: Rechteck): boolean {
  const waagerecht = a.x < b.x + b.width && b.x < a.x + a.width;
  const senkrecht = a.y < b.y + b.height && b.y < a.y + a.height;
  return waagerecht && senkrecht;
}

/** Liegt an der Mitte des Elements wirklich dieses Element (und nicht Klara oder eine Aktion)? */
async function mitteFrei(page: Page, testId: string, ersterAbsatz = false): Promise<boolean> {
  return page.evaluate(
    ([id, absatz]) => {
      const wurzel = document.querySelector(`[data-testid="${id}"]`);
      const ziel = absatz ? wurzel?.firstElementChild : wurzel;
      if (!ziel) {
        return false;
      }
      const r = ziel.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + Math.min(r.height / 2, 12);
      const oben = document.elementFromPoint(x, y);
      return oben !== null && (ziel === oben || ziel.contains(oben));
    },
    [testId, ersterAbsatz] as const,
  );
}

/**
 * Nacharbeit 2 (Prüflauf, Bilder der Fehlerartefakte): über Titel und erster Regel lag der
 * rechtliche Nutzungshinweis „Kurz zur Kenntnis“ des Produkts. Er ist eine ECHTE, einmalige
 * Pflichtbestätigung (eigener Knopf „Verstanden — weiter“, serverseitig vermerkt) und nicht die
 * Kenntnisnahme-Fläche dieses Auftrags. Er bleibt unangetastet und wird hier so bestätigt, wie es
 * ein Mensch beim ersten Öffnen tut — dieselbe Bauform wie `bildschirmablauf-browser.spec.ts`.
 * Steht er da, wird VORHER belegt, dass er wirklich eine Bestätigung verlangt (Bild + beide Knöpfe).
 * Steht keiner da, hat derselbe geteilte Smoke-Account ihn schon quittiert.
 */
async function nutzungshinweisQuittieren(page: Page, name: string): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (!(await weiter.isVisible())) {
    return;
  }
  await expect(page.getByTestId("notice-decline-open")).toBeVisible();
  await belegBild(page, `${name}-nutzungshinweis-pflicht`);
  await weiter.click();
  await expect(page.getByTestId("notice-banner")).toHaveCount(0, { timeout: 15_000 });
}

/** Alle sichtbaren Klara-Flächen: der Hilfeknopf und die bewegliche Figur. */
async function klaraFlaechen(page: Page): Promise<Rechteck[]> {
  const orte = page.locator('button[data-klara="1"], [data-testid="klara-figur"]');
  const raus: Rechteck[] = [];
  for (let i = 0; i < (await orte.count()); i += 1) {
    const ort = orte.nth(i);
    if (await ort.isVisible()) {
      raus.push(await box(ort));
    }
  }
  return raus;
}

async function belegBild(page: Page, name: string): Promise<void> {
  const body = await page.screenshot();
  await test.info().attach(name, { body, contentType: "image/png" });
}

async function stand(antwort: { json: () => Promise<unknown> }): Promise<number> {
  return ((await antwort.json()) as { version: number }).version;
}

test.describe("Lesen: Inhalt zuerst", () => {
  test("K1/K2/K5 · Desktop: Inhalt vor der Kenntnisnahme, die Fläche ist eine Zeile", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const eintrag = await legeEintragAn(page.request, marke());
    await page.goto(`/wissen/${eintrag.id}`);
    const titel = page.getByTestId("bib-titel");
    await expect(titel).toHaveText(eintrag.titel, { timeout: 15_000 });
    const text = page.getByTestId("bib-text");
    await expect(text).toContainText(eintrag.regel);
    await nutzungshinweisQuittieren(page, "desktop");
    const flaeche = page.getByTestId("kenntnisnahme-bereich");
    await expect(flaeche, "Admin ohne Anforderung: die Zeile fehlt").toBeVisible({
      timeout: 15_000,
    });
    await expect(flaeche).toHaveAttribute("data-kenntnisnahme-lage", "nur-anfordern");
    await belegBild(page, "desktop-lesereihenfolge");

    // K1 — Reihenfolge im Bild: Status über Titel über Text über Kenntnisnahme.
    const pille = await box(page.getByTestId("bib-pille"));
    const t = await box(titel);
    const x = await box(text);
    const k = await box(flaeche);
    expect(pille.y, "der Status steht nicht über dem Titel").toBeLessThan(t.y);
    expect(t.y + t.height, "der Titel steht nicht über dem Text").toBeLessThanOrEqual(x.y + 1);
    expect(x.y + x.height, "die Kenntnisnahme steht vor dem Text").toBeLessThanOrEqual(k.y + 1);
    const hoehe = page.viewportSize()?.height ?? 720;
    expect(t.y + t.height, "der Titel liegt nicht im ersten Bild").toBeLessThan(hoehe);
    expect(await mitteFrei(page, "bib-text", true), "die erste Regel ist verdeckt").toBe(true);
    // Nacharbeit 6 (Ben): der Text steht vor ALLEN nachgeordneten Flächen — nicht nur vor der
    // Kenntnisnahme. „Space und Verantwortung" stand bis dahin vor der ganzen Fläche.
    const space = page.getByTestId("space-zeile");
    await expect(space, "Space und Verantwortung ist nicht mehr erreichbar").toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("wissensbeziehungen")).toBeVisible({ timeout: 15_000 });
    for (const [testId, name] of [
      ["wissensbeziehungen", "die Beziehungen"],
      ["kenntnisnahme-bereich", "die Kenntnisnahme"],
      ["space-zeile", "Space und Verantwortung"],
      ["bib-mehr", "„Mehr“"],
    ] as const) {
      const nachher = page.getByTestId(testId).first();
      expect(await steht(text, nachher), `${name} steht vor dem Text`).toBe(true);
      expect(await steht(titel, nachher), `${name} steht vor dem Titel`).toBe(true);
    }

    // K2 — keine grosse Bestätigungsfläche ohne Anforderung; Anfordern bleibt erreichbar.
    expect(k.height, `die Kenntnisnahme ist ${k.height}px hoch`).toBeLessThan(80);
    await expect(page.getByTestId("kenntnisnahme-bestaetigen")).toHaveCount(0);
    await expect(page.getByTestId("kenntnisnahme-verweis")).toHaveCount(0);
    const verwalten = page.getByTestId("kenntnisnahme-verwalten");
    await verwalten.locator(":scope > summary").click();
    await expect(verwalten).toHaveAttribute("open", "");
    await expect(flaeche).toContainText("keine elektronische Signatur");
    await belegBild(page, "desktop-kenntnisnahme-aufgeklappt");

    // K5 — Quellen, Meta und Beziehungen beschriftet sichtbar; „Mehr" in vier Gruppen.
    await expect(page.getByTestId("bib-sprung-quellen")).toContainText("Quellen");
    await expect(page.getByTestId("bib-meta")).toBeVisible();
    await expect(page.getByTestId("wissensbeziehungen")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("bib-mehr").click();
    const gruppen = page.locator("[data-bib-gruppe]");
    await expect(gruppen).toHaveCount(4);
    await expect(gruppen).toHaveText([
      /Quellen und Nachweise/i,
      /Herkunft und Verlauf/i,
      /Prüfung und Zusammenarbeit/i,
      /Verknüpfungen/i,
    ]);
    await belegBild(page, "desktop-mehr-gruppen");
  });

  test("K3 · 390 × 844: Titel und erste Regel im ersten Bild, umbrochen und unverdeckt", async ({
    page,
  }) => {
    await page.setViewportSize(SCHMAL);
    await ensureLoggedIn(page);
    // Nacharbeit 6 (Ben): ZWEI Objekte — das lange (Umbruch) und ein kurzes Testobjekt. Für beide
    // gilt im ERSTEN Bild, ohne Scrollen: Titel UND der VOLLSTÄNDIGE erste Regelabsatz liegen im
    // Bild, und an keiner Stelle des Absatzes liegt Klara (Knopf oder Figur) oder eine andere Fläche.
    for (const art of ["lang", "kurz"] as const) {
      const eintrag = await legeEintragAn(page.request, marke(), art);
      await page.goto(`/wissen/${eintrag.id}`);
      const titel = page.getByTestId("bib-titel");
      await expect(titel).toHaveText(eintrag.titel, { timeout: 15_000 });
      const text = page.getByTestId("bib-text");
      await expect(text).toContainText(eintrag.regel);
      await nutzungshinweisQuittieren(page, `schmal-${art}`);
      await belegBild(page, `schmal-390x844-${art}`);

      const ersteRegel = text.locator(":scope > *").first();
      const t = await box(titel);
      const regel = await box(ersteRegel);
      expect(t.y, `${art}: der Titel beginnt über dem Bild`).toBeGreaterThanOrEqual(0);
      expect(t.y + t.height, `${art}: der Titel liegt nicht im ersten Bild`).toBeLessThanOrEqual(
        SCHMAL.height,
      );
      const regelUnten = regel.y + regel.height;
      expect(regelUnten, `${art}: die erste Regel endet unter dem Bild`).toBeLessThanOrEqual(
        SCHMAL.height,
      );
      expect(t.x + t.width, `${art}: der Titel ragt über den Bildschirm`).toBeLessThanOrEqual(390);
      if (art === "lang") {
        expect(t.height, "der lange Titel bricht nicht um").toBeGreaterThan(40);
      }
      // Umbruch innerhalb der Lesespalte: nichts ragt über die Breite hinaus.
      for (const id of ["bib-titel", "bib-text", "bib-lesen"]) {
        const ort = page.getByTestId(id);
        const ueberlauf = await ort.evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(ueberlauf, `${art}: ${id} läuft ${ueberlauf}px über den Rand`).toBeLessThanOrEqual(
          1,
        );
      }
      // Weder Klara noch eine Aktion liegt auf Titel oder auf IRGENDEINER Stelle der ersten Regel.
      expect(await ganzFrei(titel), `${art}: der Titel ist verdeckt`).toBe(true);
      expect(await ganzFrei(ersteRegel), `${art}: die erste Regel ist verdeckt`).toBe(true);
      for (const k of await klaraFlaechen(page)) {
        expect(schneiden(k, t), `${art}: Klara liegt auf dem Titel`).toBe(false);
        expect(schneiden(k, regel), `${art}: Klara liegt auf der ersten Regel`).toBe(false);
      }
    }
  });

  test("K4 · freigegebene Anleitung: Lesefassung zuerst, Bearbeitung und Historie da", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const eintrag = await legeEintragAn(page.request, m);
    const fassungen = await page.request.get(`/api/kos/${eintrag.id}/versions`);
    expect(fassungen.ok()).toBe(true);
    const saetze = (await fassungen.json()) as { version: number }[];
    const fassung = Math.max(...saetze.map((s) => s.version));

    const tuer = "/api/gesamtanweisungen";
    const angelegt = await page.request.post(tuer, { data: { titel: `Anlage anfahren ${m}` } });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const id = ((await angelegt.json()) as { id: string }).id;
    const gebunden = await page.request.post(`${tuer}/${id}/bausteine`, {
      data: {
        version: await stand(angelegt),
        koId: eintrag.id,
        koVersion: fassung,
        nachweisHash: null,
      },
    });
    expect(gebunden.ok(), await gebunden.text()).toBe(true);
    const vorgelegt = await page.request.post(`${tuer}/${id}/vorlegen`, {
      data: { version: await stand(gebunden) },
    });
    expect(vorgelegt.ok(), await vorgelegt.text()).toBe(true);
    const entschieden = await page.request.post(`${tuer}/${id}/entscheiden`, {
      data: { version: await stand(vorgelegt), entscheidung: "angenommen" },
    });
    expect(entschieden.ok(), await entschieden.text()).toBe(true);

    await page.goto(`/gesamtanweisungen/${id}`);
    const lesefassung = page.getByTestId("ga-lesestand");
    await expect(lesefassung).toBeVisible({ timeout: 15_000 });
    await nutzungshinweisQuittieren(page, "anleitung");
    // Nacharbeit 6 (Ben): geprüft wird der REGELTEXT des ersten Abschnitts, nicht nur der Container
    // der Lesefassung — und dass er vor allgemeiner Leseerläuterung, ausführlicher Quellenprüfung
    // und den Herkunftsvermerken des Abschnitts steht. Freigabestand und Lückenvermerk bleiben da.
    const ersteRegel = lesefassung.getByTestId("ga-lesestand-text").first();
    await expect(ersteRegel).toContainText(eintrag.regel);
    await expect(lesefassung.getByTestId("ga-lesestand-stand")).toHaveText("Freigegeben");
    expect(await steht(lesefassung.getByTestId("ga-lesestand-stand"), ersteRegel)).toBe(true);
    const einleitung = lesefassung.getByTestId("ga-lesestand-einleitung");
    const quellen = lesefassung.getByTestId("ga-lesestand-quellen");
    await expect(quellen).toHaveCount(1);
    await expect(quellen.getByTestId("ga-lesestand-quellen-ergebnis")).toHaveAttribute(
      "data-ergebnis",
      "aktuell",
    );
    expect(await steht(ersteRegel, einleitung), "Leseerläuterung vor der Regel").toBe(true);
    expect(await steht(ersteRegel, quellen), "Quellenprüfung vor der Regel").toBe(true);
    const nachweis = lesefassung.getByText("Zu dieser Fassung liegt kein Nachweis vor.").first();
    expect(await steht(ersteRegel, nachweis), "Nachweisvermerk vor der Regel").toBe(true);
    await expect(lesefassung.getByTestId("ga-lesestand-pruefanbindung")).toBeVisible();
    await expect(page.getByTestId("ga-seite-stand")).toContainText("Freigegeben");
    const bearbeiten = page.getByTestId("ga-seite-bearbeiten");
    await expect(bearbeiten).toBeVisible();
    await expect(page.getByTestId("ga-seite-schritte")).toBeHidden();
    await expect(page.getByTestId("ga-kopf")).toBeHidden();
    await belegBild(page, "anleitung-freigegeben-lesefassung");

    const titel = await box(page.getByTestId("ga-seite-titel"));
    const lesen = await box(lesefassung);
    const zeile = await box(bearbeiten);
    expect(titel.y, "der Titel steht nicht über der Lesefassung").toBeLessThan(lesen.y);
    const unten = lesen.y + lesen.height;
    expect(unten, "die Bearbeitung steht vor der Lesefassung").toBeLessThanOrEqual(zeile.y + 1);

    // Historie offen, Bearbeitung einen Klick entfernt.
    await expect(page.getByTestId("ga-vergleich")).toBeVisible();
    // Nacharbeit 3: NUR die eigene Zusammenfassung der Zeile — darin liegt ein weiteres <details>
    // („Für Fachleute: Inhaltsnachweis …“ im Aufnehmen-Formular) mit eigener Zusammenfassung.
    await bearbeiten.locator(":scope > summary").click();
    await expect(page.getByTestId("ga-kopf")).toBeVisible();
    await expect(page.getByTestId("ga-entscheidung")).toBeVisible();
    await belegBild(page, "anleitung-bearbeiten-aufgeklappt");
  });
});
