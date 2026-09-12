// ================================================================================================
// JOB 3133 · UX-22 — DIE HANDMESSUNG, WIEDERHOLBAR: ECHTER SERVER, ECHTES CHROMIUM, ECHTES F5.
// ================================================================================================
//
// §7 des Auftrags erlaubt und wünscht eine Messung von Hand in Chromium (DE/EN, Tastatur,
// Anhängen, Neuladen, Quelle wiederfinden). Eine Messung von Hand ist EINMAL wahr; hier steht sie
// als Fall, damit sie es bleibt. Sie fasst KEINE Konfigurationsdatei an (`tools/test`,
// `vitest*.config.ts`, `package.json` hält JOB 3131) — sie ist eine gewöhnliche Testdatei im
// Zielpfad und läuft im vorhandenen Lauf mit.
//
// WAS SIE ZUSÄTZLICH BELEGT, was die gemounteten Fälle nicht können:
//  · Der Weg geht durch den ECHTEN `add-source`-Zweig (ko-routes.ts:1921-1953) mit der echten
//    Stufenprüfung — Vorgabestufe ist `search_on_click` (policy.ts:21), also genau die Sperre.
//  · Die Quelle ÜBERLEBT DAS NEULADEN. Das ist Pedis Satz („nach dem Neuladen steht keine Quelle
//    da") und nur am gespeicherten Bestand messbar.
//  · Chromium übersetzt `Enter` auf dem Knopf wirklich in eine Aktivierung — in jsdom gibt es
//    diese Vorgabehandlung nicht (Lehre aus JOB 3108, A4/B3).
//
// Die Vorrichtung ist die bestehende `h4Stand` (tests/design/h4-harness.ts): gebautes `dist`,
// echte Fastify-App, echte Dienste, echte Anmeldung. Kein Nachbau, kein zweiter Weg. Fehlt `dist`
// (kein `./tools/build` gelaufen), wird der Fall ROT und sagt warum — kein stilles Überspringen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, fn, h4Stand } from "../design/h4-harness";

const ANHANG_NAME = "Pruefprotokoll.pdf";
const BEZEICHNUNG = "Seite 4, Absatz 2";

/** Ein winziges, aber ECHTES PDF — der Object-Store misst die gespeicherte Größe. */
const PDF_BYTES = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==";

/** Alles, was für ein Urteil zählt, in EINEM Zug aus der Seite — sonst zwei Stände. */
const MESSEN = `() => {
  const abschnitt = document.querySelector('[data-bib-abschnitt="quellen"]');
  const grund = abschnitt ? abschnitt.querySelector('output') : null;
  const auswahl = abschnitt ? abschnitt.querySelector('select') : null;
  const knopf = abschnitt
    ? Array.prototype.find.call(abschnitt.querySelectorAll('button'), (b) =>
        (b.textContent || '').trim().length > 0 && b.getAttribute('aria-disabled') !== null)
    : null;
  const aktiv = document.activeElement;
  const stil = knopf ? getComputedStyle(knopf) : null;
  return {
    abschnittOffen: !!(abschnitt && abschnitt.open),
    grundText: grund ? (grund.innerText || '').replace(/\\s+/g, ' ').trim() : '',
    grundId: grund ? grund.getAttribute('id') : null,
    auswahlDa: !!auswahl,
    auswahlWert: auswahl ? auswahl.value : null,
    auswahlOptionen: auswahl
      ? Array.prototype.map.call(auswahl.options, (o) => o.textContent)
      : [],
    auswahlBeschriftung: auswahl && auswahl.closest('label')
      ? (auswahl.closest('label').querySelector('span').textContent || '').trim()
      : '',
    knopfText: knopf ? (knopf.textContent || '').trim() : '(kein Knopf)',
    knopfAriaDisabled: knopf ? knopf.getAttribute('aria-disabled') : null,
    knopfDisabled: knopf ? knopf.disabled : null,
    knopfBeschriebenVon: knopf ? knopf.getAttribute('aria-describedby') : null,
    knopfHatFokus: !!(knopf && aktiv === knopf),
    // Sichtbarer Fokus: WELCHE Eigenschaft ihn zeichnet, wird nicht angenommen — es werden beide
    // in Frage kommenden mitgenommen und der Unterschied zwischen fokussiert und nicht fokussiert
    // gemessen (s. C1). Eine einzelne Momentaufnahme sagte darüber nichts.
    knopfOutline: stil ? stil.outlineStyle + ' ' + stil.outlineWidth + ' | ' + stil.boxShadow : '',
    quellenTitel: abschnitt
      ? Array.prototype.map.call(
          abschnitt.querySelectorAll('li .text-\\\\[13\\\\.5px\\\\]'),
          (e) => (e.textContent || '').trim(),
        )
      : [],
    labelWert: (() => {
      const felder = abschnitt ? abschnitt.querySelectorAll('input') : [];
      return felder.length > 0 ? felder[0].value : null;
    })(),
  };
}`;

interface Messung {
  abschnittOffen: boolean;
  grundText: string;
  grundId: string | null;
  auswahlDa: boolean;
  auswahlWert: string | null;
  auswahlOptionen: string[];
  auswahlBeschriftung: string;
  knopfText: string;
  knopfAriaDisabled: string | null;
  knopfDisabled: boolean | null;
  knopfBeschriebenVon: string | null;
  knopfHatFokus: boolean;
  knopfOutline: string;
  quellenTitel: string[];
  labelWert: string | null;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;
let objektId = "";

const messen = async (): Promise<Messung> =>
  (await (stand as H4Stand).seite.evaluate<Messung>(fn(MESSEN))) as Messung;

/** Die Seite von vorn laden und den Abschnitt „Quellen und Belege" öffnen — wie ein Mensch. */
async function frischUndAufgeklappt(sprache?: string): Promise<void> {
  const s = (stand as H4Stand).seite;
  if (sprache) {
    await s.evaluate(fn(`(l) => localStorage.setItem("kw.sprache", l)`), sprache);
  }
  await s.reload({ waitUntil: "load", timeout: 60_000 });
  await s.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-sprung-quellen"]')`),
    undefined,
    { timeout: 30_000 },
  );
  await s.click('[data-testid="bib-sprung-quellen"]');
  await s.waitForFunction(
    fn(`() => { const d = document.querySelector('[data-bib-abschnitt="quellen"]');
               return !!(d && d.open && d.querySelector('button')); }`),
    undefined,
    { timeout: 30_000 },
  );
  // Die Stufe kommt in einem ZWEITEN Zug (`/api/external/policy`). Vorher steht kein Grund da —
  // richtig so (§9: keine Sperrbehauptung ohne geladene Stufe), aber es wäre der falsche Moment
  // zum Messen. Auf einer OFFENEN Stufe erscheint der Knopf ohne `aria-disabled="true"`; deshalb
  // wird auf die ANTWORT gewartet, nicht auf den Grund.
  await s.waitForFunction(
    fn(`() => { const d = document.querySelector('[data-bib-abschnitt="quellen"]');
               if (!d) return false;
               const b = Array.prototype.find.call(d.querySelectorAll('button'),
                 (x) => x.getAttribute('aria-disabled') !== null);
               return !!(b && b.getAttribute('aria-disabled') === 'true'); }`),
    undefined,
    { timeout: 30_000 },
  );
}

/** Mit der TASTATUR bis zum Knopf „Quelle hinzufügen" — höchstens zwölf Schritte. */
async function tabBisKnopf(): Promise<boolean> {
  const s = (stand as H4Stand).seite;
  for (let i = 0; i < 12; i++) {
    const da = await s.evaluate<boolean>(
      fn(`() => { const a = document.activeElement;
                 return !!(a && a.tagName === 'BUTTON' && a.getAttribute('aria-disabled') !== null
                           && (a.textContent || '').trim().length > 0); }`),
    );
    if (da) {
      return true;
    }
    await s.keyboard.press("Tab");
  }
  return false;
}

describe("JOB 3133 · UX-22 — die Belegstelle in Chromium: anhängen, neu laden, wiederfinden", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@job3133.test", async (z) => {
        // Ein ECHTES Objekt im Object-Store — nur so trägt der Anhang eine `objectId`, die die
        // Route `ko-routes.ts:1928` nachschlagen kann.
        const ref = (await (
          z.services as unknown as {
            objects: { put(i: Record<string, unknown>): Promise<{ id: string }> };
          }
        ).objects.put({
          name: ANHANG_NAME,
          mime: "application/pdf",
          data: PDF_BYTES,
        })) as { id: string };
        objektId = ref.id;
        await (
          z.services as unknown as {
            ko: {
              addAttachment(
                id: string,
                autor: string,
                i: Record<string, unknown>,
              ): Promise<unknown>;
            };
          }
        ).ko.addAttachment(z.freiId, z.autorId, {
          name: ANHANG_NAME,
          mime: "application/pdf",
          objectId: ref.id,
        });
      });
      await frischUndAufgeklappt("de");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C0 · die Vorrichtung steht: gebautes dist, echte App, Chromium, ein ankerfähiger Anhang", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(s.version.length).toBeGreaterThan(0);
    expect(objektId.length, "kein Objekt im Store — der Anhang trüge keinen Anker").toBeGreaterThan(
      0,
    );
    const m = await messen();
    console.log("JOB 3133 C0 ·", JSON.stringify({ ...m, version: s.version, theme: s.theme }));
    expect(m.abschnittOffen).toBe(true);
    // Die Vorgabestufe IST die restriktive — sonst gäbe es hier nichts zu messen.
    expect(m.grundText.length, "kein Sperrgrund — die Stufe ist nicht restriktiv").toBeGreaterThan(
      40,
    );
    expect(m.auswahlDa, "kein Auswahlfeld über die Anhänge").toBe(true);
    expect(m.auswahlOptionen).toEqual(["—", ANHANG_NAME]);
    expect(m.auswahlBeschriftung).toBe("Anhänge");
  });

  it("C1 · gesperrt: Enter auf dem Knopf hängt NICHTS an — und der Knopf behält Ort und Grund", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await frischUndAufgeklappt();
    const vorher = await messen();
    const zahlVorher = vorher.quellenTitel.length;

    // Bezeichnung tippen — ohne sie wäre der Knopf ohnehin hart abgeschaltet und der Fall leer.
    await s.click('[data-bib-abschnitt="quellen"] input');
    await s.keyboard.type(BEZEICHNUNG);
    // Der Knopf, SOLANGE der Fokus noch im Eingabefeld steht — der Vergleichswert für unten.
    const ohneFokus = (await messen()).knopfOutline;

    // NUR TASTATUR bis zum Knopf. Ein `disabled`-Knopf fiele hier aus der Reihenfolge — genau die
    // Lehre aus JOB 3126.
    expect(await tabBisKnopf(), "der Knopf ist per Tab nicht erreichbar").toBe(true);
    const amKnopf = await messen();
    expect(amKnopf.knopfHatFokus).toBe(true);
    expect(amKnopf.knopfAriaDisabled).toBe("true");
    expect(amKnopf.knopfDisabled).toBe(false);
    // Der Grund ist mit dem Knopf VERBUNDEN, nicht nur zufällig daneben.
    expect(amKnopf.knopfBeschriebenVon).toBe(amKnopf.grundId);
    expect(amKnopf.grundId).toBeTruthy();
    // Und Chromium zeichnet den Fokus wirklich SICHTBAR: gemessen wird der Unterschied zum
    // unfokussierten Zustand (Fokus noch im Eingabefeld), nicht die Anwesenheit einer bestimmten
    // CSS-Eigenschaft — die Fläche darf ihren Fokusring über outline ODER box-shadow zeichnen.
    console.log(`JOB 3133 C1 · Fokus: ohne „${ohneFokus}“ · mit „${amKnopf.knopfOutline}“`);
    expect(amKnopf.knopfOutline, "der Fokus ist am Knopf nicht zu sehen").not.toBe(ohneFokus);

    await s.keyboard.press("Enter");
    await s.waitForTimeout(500);
    const nachher = await messen();
    expect(nachher.quellenTitel.length, "die gesperrte Aktion wurde ausgeführt").toBe(zahlVorher);
    expect(nachher.knopfHatFokus, "der Fokus ist verloren gegangen").toBe(true);
  });

  it("C2 · Anhang wählen → der Grund geht, Enter hängt an, und die Quelle steht in der Liste", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await frischUndAufgeklappt();
    const vorher = await messen();
    const zahlVorher = vorher.quellenTitel.length;

    await s.click('[data-bib-abschnitt="quellen"] input');
    await s.keyboard.type(BEZEICHNUNG);
    await s.selectOption('[data-bib-abschnitt="quellen"] select', objektId);
    await s.waitForTimeout(200);

    const mitAnker = await messen();
    expect(mitAnker.grundText, "der Grund steht noch da, obwohl der Anker steht").toBe("");
    expect(mitAnker.knopfAriaDisabled).toBe("false");
    expect(mitAnker.knopfBeschriebenVon).toBeNull();

    expect(await tabBisKnopf()).toBe(true);
    await s.keyboard.press("Enter");
    await s.waitForFunction(
      fn(`(n) => document.querySelectorAll('[data-bib-abschnitt="quellen"] li').length > n`),
      zahlVorher,
      { timeout: 20_000 },
    );
    const nachher = await messen();
    console.log("JOB 3133 C2 ·", JSON.stringify(nachher.quellenTitel));
    expect(nachher.quellenTitel).toContain(BEZEICHNUNG);
    // Das Formular ist geräumt — samt Auswahl (Lieferung 5).
    expect(nachher.labelWert).toBe("");
    expect(nachher.auswahlWert).toBe("");
  });

  it("C3 · NEULADEN (F5): die Quelle ist immer noch da — sie liegt beim Server, nicht im Formular", async () => {
    expect(fehler).toBeNull();
    await frischUndAufgeklappt();
    const m = await messen();
    expect(
      m.quellenTitel,
      "nach dem Neuladen steht die Quelle nicht da — genau Pedis Befund",
    ).toContain(BEZEICHNUNG);
  });

  it("C4 · dieselbe Fläche auf Englisch: beschriftet, ohne einen einzigen neuen Textschlüssel", async () => {
    expect(fehler).toBeNull();
    await frischUndAufgeklappt("en");
    const m = await messen();
    // `ko.mehr.anhaenge` und `ko.sourceAdd` sind VORHANDENE Schlüssel (i18n.ts:7513 / DE 2506).
    expect(m.auswahlBeschriftung).toBe("Attachments");
    // Der Optionstext ist der Dateiname aus den Daten — er wird bewusst NICHT übersetzt.
    expect(m.auswahlOptionen).toEqual(["—", ANHANG_NAME]);
    expect(m.quellenTitel).toContain(BEZEICHNUNG);
    await frischUndAufgeklappt("de");
  });

  it("C5 · Chromium meldete keinen Seitenfehler außer der bekannten Grenze DIESER Vorrichtung", async () => {
    expect(fehler).toBeNull();
    // GEMESSEN, NICHT ANGENOMMEN: die Vorrichtung liefert die Seite unter `http://klarwerk.test`
    // aus. Das ist KEIN sicherer Kontext, und Chromium stellt `crypto.randomUUID` dort nicht
    // bereit. Der Erfolgs-Toast nach dem Anhängen ruft sie (`app/ToastContext.tsx:36`) und wirft
    // deshalb HIER — nicht im Produkt, das über https bzw. localhost läuft. Die Wirkung ist am
    // Ergebnis nachgemessen: die Quelle steht (C2) und überlebt das Neuladen (C3).
    //
    // Der Fall bleibt fail-closed: JEDER andere Seitenfehler macht ihn rot.
    const unsicher = await (stand as H4Stand).seite.evaluate<boolean>(
      fn(`() => typeof crypto.randomUUID !== 'function' && !window.isSecureContext`),
    );
    expect(unsicher, "sicherer Kontext — dann ist der Fehler unten KEINE Prüfstandsgrenze").toBe(
      true,
    );
    const fremde = (stand as H4Stand).seitenfehler.filter((f) => !f.includes("crypto.randomUUID"));
    expect(fremde, `Seitenfehler: ${JSON.stringify((stand as H4Stand).seitenfehler)}`).toEqual([]);
  });
});
