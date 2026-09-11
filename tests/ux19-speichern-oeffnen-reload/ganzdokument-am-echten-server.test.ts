// ================================================================================================
// JOB 3259 · UX-19-R2 — SPEICHERN, ÖFFNEN, NEULADEN UND SCHEITERN, AM ECHTEN SERVER.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT, hat der Prüfer benannt (Codex zu JOB 3196 R2, ben.md,
// Prüfpunkt 3): „Gemountete Produkttests prüfen Anleitung, Quittung, Erfolg und bestehenden
// Öffnen-Link … Speicher-API dabei gemockt; keine neue Persistenzwirkung beansprucht."
//
// Ein Erfolgskasten ist eine TATSACHENAUSSAGE über den Server: „Dieses Dokument liegt jetzt als
// Entwurf bei uns." In der gemockten Bühne ist diese Aussage strukturell unwiderlegbar — hinter ihr
// steht `vi.fn(async () => ({ id: "d-42", … }))` und sonst nichts. Hier steht die echte Fastify-App
// dahinter, und der Test fragt sie OHNE den Browser (`frage`, `h3-blatt-buehne.ts:130`). Ein
// Erfolgskasten ohne Serverentwurf ist ab jetzt ein harter Fehlschlag.
//
// GEPRÜFT WIRD DER WEG EINES MENSCHEN, in dieser Reihenfolge:
//   F1  die Bühne steht (echte gebaute App, keine Seitenfehler)
//   F2  Aus Datei → Ganzes Dokument → Datei wählen → speichern; Fläche UND Server sagen dasselbe
//   F3  neu laden: der Entwurf bleibt, die Erfolgsbehauptung bleibt NICHT
//   F4  der Wartezustand, danach der Öffnen-Link mit einem ECHTEN Zeigerklick (samt Kalibrierung)
//   F5  derselbe Öffnen-Link, nur mit Tab und Enter
//   F6  DE · der Aufruf kommt nicht an (Netz weg): lokalisierter Satz, kein Erfolg, Wiederholung
//   F7  DE · der Server antwortet 500: der GRUND steht beim Menschen, kein Erfolg, Wiederholung
//   F8  eine leere Datei: ehrliche Leermeldung, kein Erfolgskasten, kein Entwurf
//   F9  EN · beide Fehlerarten (500 und Netz weg), englische Fläche, Wiederholung
//   F10 die Fehlerfrische: Fehler A, DERSELBE Fehler A erneut, ein anderer Fehler B, dann Erfolg —
//       jeder Versuch wird an SEINEM Ausgang gemessen, nicht am Wortlaut auf der Fläche
//
// KEIN OBERFLÄCHENSATZ STEHT IN DIESER DATEI FEST. Jede Erwartung an einen Produkttext kommt über
// `i18n.t` aus `CAPTURE_FILE_TEXT` — derselben Quelle, aus der `Capture.tsx` rendert (Auftrag §8.7).
// Die einzige feste Zeichenkette in einer Zusicherung ist `WEICHE_FEHLERSATZ`: der Grund, den die
// GESTELLTE Serverantwort mitschickt. Er gehört dem Test, nicht dem Produkt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Draft } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT, FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { type Buehne, buehneAufbauen, fn } from "../design/h3-blatt-buehne";
import {
  ADRESSE,
  BLATT_INHALT,
  DATEI_EINGANG,
  DATEI_INHALTSSATZ,
  DATEI_NAME,
  DATEI_TITEL,
  DECKE_LINK_AUF,
  DECKE_LINK_ZU,
  EINGANG_ZAEHLEN,
  type Entwurfsweiche,
  FALL_RAHMEN_MS,
  FOKUS_HREF,
  LESBARER_TEXT,
  OEFFNEN_LINK_SELEKTOR,
  SEITENTEXT,
  type SeiteMitDatei,
  type Speicherversuch,
  WARTEBUDGET,
  WEICHE_FEHLERSATZ,
  aufErfolgskastenWarten,
  aufFlaechensatzWarten,
  aufRuhestandWarten,
  dateiAnlage,
  dateiWaehlen,
  dateiwegOeffnen,
  entwurfsWeicheLegen,
  ganzdokumentWaehlen,
  kennungAusOeffnenLink,
  neuLaden,
  speichernDruecken,
  speicherversuchBeginnen,
  spracheSetzen,
  wartebudget,
} from "./ux19-buehne";

let b: Buehne;
let seite: SeiteMitDatei;
let weiche: Entwurfsweiche;

/** Alle Entwürfe, die WIRKLICH beim Server liegen — ohne den Browser gefragt. */
async function serverEntwuerfe(): Promise<Draft[]> {
  return b.frage<Draft[]>("GET", "/api/drafts");
}

/** Ein einzelner Entwurf, direkt beim Server nachgeschlagen. */
async function serverEntwurf(id: string): Promise<Draft> {
  return b.frage<Draft>("GET", `/api/drafts/${encodeURIComponent(id)}`);
}

/**
 * Der ganze Weg bis zum gedrückten Speichern-Knopf — Blatt frisch, Modus gewählt, Datei gesetzt.
 * Zurück kommt der SPEICHERVERSUCH von VOR dem Klick: mit seiner Marke misst `aufRuhestandWarten`,
 * dass der Anlege-Aufruf wirklich lief, und `aufErfolgskastenWarten` unterscheidet daran den
 * Fehlerausgang DIESES Versuchs vom alten Satz des vorigen.
 */
async function bisZumSpeichern(): Promise<Speicherversuch> {
  await neuLaden(seite);
  await dateiwegOeffnen(seite);
  await ganzdokumentWaehlen(seite);
  await dateiWaehlen(seite);
  const versuch = speicherversuchBeginnen(weiche);
  expect(await speichernDruecken(seite), "Speichern-Knopf nicht gefunden").toBe(true);
  return versuch;
}

/**
 * Einen Warteschritt fahren und festhalten, WAS er gesagt hat und WIE LANGE er gebraucht hat.
 * Leere Meldung = er ist durchgekommen. Für F10, wo beides zur Aussage gehört.
 */
async function abbruchMessen(
  tun: () => Promise<void>,
): Promise<{ meldung: string; dauer: number }> {
  const start = Date.now();
  try {
    await tun();
    return { meldung: "", dauer: Date.now() - start };
  } catch (e) {
    return { meldung: String(e), dauer: Date.now() - start };
  }
}

function t(schluessel: string, params?: Record<string, unknown>): string {
  return String(i18n.t(schluessel, params ?? {}))
    .replace(/\s+/g, " ")
    .trim();
}

/** Der deutsche Wortlaut eines Schlüssels — für die Rückfall-Proben auf der englischen Fläche. */
function deutsch(schluessel: string): string {
  return String(i18n.getResource("de", "translation", schluessel));
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  b = await buehneAufbauen("/erfassen");
  seite = b.seite as SeiteMitDatei;
  if (b.fehler !== null) {
    return;
  }
  weiche = await entwurfsWeicheLegen(seite);
}, FALL_RAHMEN_MS);

afterAll(async () => {
  await b?.schliessen();
});

describe("JOB 3259 · UX-19-R2 — der Ganzdokument-Import am echten Server (Chromium)", () => {
  it("F1 · die Bühne steht: die echte gebaute Seite ist geladen, ohne Seitenfehler", () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    expect(b.seitenfehler, "die Seite hat beim Mounten geworfen").toEqual([]);
  });

  it(
    "F2 · nach dem Speichern sagen Fläche UND Server dasselbe — und „Frontdoor“ liest niemand",
    async () => {
      expect(b.fehler).toBeNull();
      const vorher = await serverEntwuerfe();

      await neuLaden(seite);
      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      // Der Dateieingang, den der Test bedient, ist GENAU der des Dokument-Imports — nicht einer
      // der Anhang-Eingänge daneben. Ohne diese Zusicherung könnte der Weg unbemerkt umziehen.
      expect(
        await seite.evaluate<number>(fn(EINGANG_ZAEHLEN), FILE_IMPORT_ACCEPT),
        "der Dateieingang des Dokument-Imports ist nicht eindeutig",
      ).toBe(1);
      await dateiWaehlen(seite);
      const versuch = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite)).toBe(true);
      await aufErfolgskastenWarten(seite, versuch);
      // Der Erfolg hing an einem WIRKLICH gelaufenen Anlege-Aufruf, nicht an einer Zustandszeile.
      await weiche.warteAufAbschluss(versuch.marke);

      // ---- (a) DIE FLÄCHE ------------------------------------------------------------------
      const text = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(text).toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(text).toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
      expect(text).toContain(t(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME }));
      expect(text).toContain(t(CAPTURE_FILE_TEXT.wholeOpenDraft));
      expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeOpenMissing));
      expect(await seite.evaluate<string>(fn(LESBARER_TEXT))).not.toMatch(/frontdoor/i);

      // ---- (b) DER SERVER — das, was die gemockte Bühne strukturell nicht kann ---------------
      const kennung = await kennungAusOeffnenLink(seite);
      expect(
        kennung,
        "der Erfolgskasten bietet keinen Öffnen-Link mit Entwurfskennung an",
      ).not.toBe(null);
      const nachher = await serverEntwuerfe();
      expect(nachher.length, "beim Server ist kein Entwurf entstanden").toBe(vorher.length + 1);

      const entwurf = await serverEntwurf(kennung as string);
      expect(entwurf.id).toBe(kennung);
      expect(entwurf.payload.title).toBe(DATEI_TITEL);
      expect(entwurf.payload.bodyHtml ?? "").toContain(DATEI_INHALTSSATZ);
      expect(entwurf.payload.bodyHtml ?? "").toContain(DATEI_NAME);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F3 · nach dem Neuladen bleibt der Entwurf — die Erfolgsbehauptung bleibt nicht",
    async () => {
      expect(b.fehler).toBeNull();
      const kennung = await kennungAusOeffnenLink(seite);
      expect(kennung, "F2 hat keinen Entwurf hinterlassen").not.toBe(null);

      await neuLaden(seite);

      // POSITIV: der Entwurf ist weiterhin da und weiterhin lesbar — Serverwahrheit, nicht Fläche.
      const entwurf = await serverEntwurf(kennung as string);
      expect(entwurf.payload.title).toBe(DATEI_TITEL);
      expect(entwurf.payload.bodyHtml ?? "").toContain(DATEI_INHALTSSATZ);

      // NEGATIV: keine Aussage aus dem vorigen Vorgang überlebt. Geprüft wird das Blatt UND der
      // wieder geöffnete Dateiweg — sonst hiesse „nicht sichtbar" nur „noch nicht aufgeklappt".
      const blatt = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(blatt).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(blatt).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));

      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      const datei = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(datei).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(datei).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
      expect(datei).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME }));
      expect(datei).not.toContain(t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI_NAME }));
      expect(await kennungAusOeffnenLink(seite)).toBe(null);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F4 · während des Speicherns steht der Wartezustand, danach öffnet ein ECHTER Zeigerklick den Entwurf",
    async () => {
      expect(b.fehler).toBeNull();
      weiche.setze("langsam");
      try {
        const versuch = await bisZumSpeichern();

        // ---- der Zustand „laden" (Auftrag §9) ----------------------------------------------
        await aufFlaechensatzWarten(seite, t(CAPTURE_FILE_TEXT.wholeSaving));
        const waehrend = await seite.evaluate<string>(fn(SEITENTEXT));
        expect(waehrend).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
        expect(waehrend).not.toContain(t(CAPTURE_FILE_TEXT.wholeOpenDraft));
        expect(await kennungAusOeffnenLink(seite)).toBe(null);

        await aufErfolgskastenWarten(seite, versuch);
        await weiche.warteAufAbschluss(versuch.marke);
      } finally {
        weiche.setze("durch");
      }

      const kennung = await kennungAusOeffnenLink(seite);
      expect(kennung).not.toBe(null);

      // ==========================================================================================
      // ÖFFNEN MIT DER MAUS — und zwar mit einem ECHTEN Zeigerklick.
      // ==========================================================================================
      //
      // Codex' Nachführung vom 08.09. 16:50 zu Runde 1: dort betätigte dieser Fall den Link über
      // `evaluate(… el.click())`. Das umgeht alles, was einen Menschen aufhält — Sichtbarkeit, Lage
      // im Fenster, ein Deckel darüber. `seite.click` fährt dagegen Playwrights Bedienbarkeitsprüfung
      // und schickt echte Maus-Ereignisse.
      //
      // ERST DIE KALIBRIERUNG, sonst wäre „echter Zeigerklick" nur behauptet: über die Seite kommt
      // ein durchsichtiger Deckel. Ein Zeigerklick MUSS daran scheitern; ein `el.click()` würde
      // ungerührt hindurchgehen. Der Deckel liegt NUR im Test und wird sofort wieder weggenommen.
      expect(
        await seite.evaluate<boolean>(fn(DECKE_LINK_ZU)),
        "der Deckel liess sich nicht über die Seite legen",
      ).toBe(true);
      let deckelFehler = "";
      try {
        await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("deckelGegenprobe") });
      } catch (e) {
        deckelFehler = String(e);
      }
      // Der Wortlaut ist der Beleg: Playwright nennt hier genau die Prüfung, die ein `el.click()`
      // gar nicht erst durchläuft — der Deckel FÄNGT die Zeigerereignisse ab.
      expect(
        deckelFehler,
        "der Klick ging durch den Deckel hindurch — das war kein Zeigerklick",
      ).toContain("intercepts pointer events");
      expect(
        await seite.evaluate<string>(fn(ADRESSE)),
        "die Seite ist trotz Deckel gewandert",
      ).toContain("/erfassen");
      expect(await seite.evaluate<boolean>(fn(DECKE_LINK_AUF))).toBe(true);

      // Und jetzt der echte Klick auf den freien Link.
      await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
      await aufFlaechensatzWarten(seite, DATEI_INHALTSSATZ);
      expect(await seite.evaluate<string>(fn(ADRESSE))).toContain(CAPTURE_FRONT_DOOR_ROUTE);

      const inhalt = await seite.evaluate<{ titel: string; text: string }>(fn(BLATT_INHALT));
      expect(inhalt.titel, "der Titel des Entwurfs steht nicht im Blatt").toBe(DATEI_TITEL);
      expect(inhalt.text, "der Inhalt des Entwurfs steht nicht im Blatt").toContain(
        DATEI_INHALTSSATZ,
      );
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F5 · derselbe Öffnen-Link, nur mit Tab und Enter — der Entwurf steht danach offen da",
    async () => {
      expect(b.fehler).toBeNull();
      const versuch = await bisZumSpeichern();
      await aufErfolgskastenWarten(seite, versuch);
      await weiche.warteAufAbschluss(versuch.marke);
      const href = `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(
        (await kennungAusOeffnenLink(seite)) as string,
      )}`;

      // NUR TASTATUR ab hier: vom Anfang der Seite durchtabben, bis der Öffnen-Link den Fokus hat.
      await seite.evaluate(
        fn("() => { document.activeElement && document.activeElement.blur(); }"),
      );
      let anschlaege = -1;
      for (let n = 1; n <= 80; n++) {
        await seite.keyboard.press("Tab");
        if ((await seite.evaluate<string | null>(fn(FOKUS_HREF))) === href) {
          anschlaege = n;
          break;
        }
      }
      expect(anschlaege, "„Entwurf öffnen“ war mit Tab nicht erreichbar").toBeGreaterThan(0);

      await seite.keyboard.press("Enter");
      await aufFlaechensatzWarten(seite, DATEI_INHALTSSATZ);
      const inhalt = await seite.evaluate<{ titel: string; text: string }>(fn(BLATT_INHALT));
      expect(inhalt.titel).toBe(DATEI_TITEL);
      expect(inhalt.text).toContain(DATEI_INHALTSSATZ);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F6 · DE · kommt der Anlege-Aufruf nicht an, steht der lokalisierte Fehlersatz da — und der Weg bleibt begehbar",
    async () => {
      expect(b.fehler).toBeNull();
      const vorher = await serverEntwuerfe();
      weiche.setze("abbruch");
      try {
        const versuch = await bisZumSpeichern();
        await aufRuhestandWarten(seite, versuch);
        await aufFlaechensatzWarten(seite, t("state.error"));

        // (a) ein Mensch liest einen ehrlichen Fehlersatz in SEINER Sprache — kein Schlüsselname.
        const text = await seite.evaluate<string>(fn(SEITENTEXT));
        expect(t("state.error")).not.toBe("state.error");
        expect(text).toContain(t("state.error"));
        // (b) keine Erfolgsaussage, kein Öffnen-Link.
        expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
        expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
        expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeOpenDraft));
        expect(await kennungAusOeffnenLink(seite)).toBe(null);
        // (c) beim Server liegt kein Entwurf.
        expect((await serverEntwuerfe()).length).toBe(vorher.length);
        // (d) der Weg ist nicht tot: der Speichern-Knopf steht wieder da und wartet.
        expect(text).toContain(t(CAPTURE_FILE_TEXT.wholeCta));
      } finally {
        weiche.setze("durch");
      }

      // … und ein zweiter Versuch auf derselben Fläche gelingt wirklich. Der Fehlersatz des ERSTEN
      // Versuchs steht beim Klick noch da und ist trotzdem kein Abbruchgrund für diesen hier: der
      // Abbruch greift erst, wenn DIESER Versuch beendet und der Client fertig ist (`fehlerzustand`).
      const versuch = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite)).toBe(true);
      await aufErfolgskastenWarten(seite, versuch);
      await weiche.warteAufAbschluss(versuch.marke);
      expect((await serverEntwuerfe()).length).toBe(vorher.length + 1);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F7 · DE · antwortet der Server mit 500, wird der GRUND nicht verschluckt — kein Erfolg, kein Entwurf, zweiter Versuch gelingt",
    async () => {
      expect(b.fehler).toBeNull();
      const vorher = await serverEntwuerfe();
      weiche.setze("fehler");
      try {
        const versuch = await bisZumSpeichern();
        // Gemessen wird der ANGEKOMMENE und BEANTWORTETE POST — nicht bloss das Fehlen von
        // `wholeSaving` (Codex-Nachführung 08.09. 16:50).
        await aufRuhestandWarten(seite, versuch);

        // ---- (a) DER GRUND STEHT BEIM MENSCHEN --------------------------------------------
        // `Capture.tsx:993` gibt bei einem `ApiError` die Meldung des Servers weiter
        // (`api/client.ts:33-38`). Zugesichert wird HIER genau eines: sie wird nicht verschluckt.
        // Wer `setErr`/`fail` im Fehlerzweig entfernt, macht diese Zeile rot.
        // NICHT zugesichert und ausdrücklich NICHT gutgeheissen: dass dieser Satz der Sprache des
        // Menschen folgt — das tut er heute nicht (Befund in der Rückgabe unter REST). Wird der
        // Satz später übersetzt, wird diese Zeile bewusst rot und ist nachzuführen.
        await aufFlaechensatzWarten(seite, WEICHE_FEHLERSATZ);
        const text = await seite.evaluate<string>(fn(SEITENTEXT));
        expect(text, "der Serverfehler wurde verschluckt").toContain(WEICHE_FEHLERSATZ);
        // ---- (b) keine Erfolgsaussage, kein Öffnen-Link ------------------------------------
        expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
        expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
        expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeOpenDraft));
        expect(await kennungAusOeffnenLink(seite)).toBe(null);
        // ---- (c) beim Server liegt kein Entwurf --------------------------------------------
        expect((await serverEntwuerfe()).length).toBe(vorher.length);
        // ---- (d) der Weg bleibt begehbar: der Knopf steht wieder auf seiner Ruhebeschriftung -
        expect(text).toContain(t(CAPTURE_FILE_TEXT.wholeCta));
      } finally {
        weiche.setze("durch");
      }

      // … und die WIEDERHOLUNG gelingt wirklich — ein Entwurf mehr, Erfolgskasten da, Grund weg.
      const versuch = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite)).toBe(true);
      await aufErfolgskastenWarten(seite, versuch);
      await weiche.warteAufAbschluss(versuch.marke);
      const nachher = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(nachher, "die alte Fehlermeldung steht neben dem Erfolg").not.toContain(
        WEICHE_FEHLERSATZ,
      );
      expect((await serverEntwuerfe()).length).toBe(vorher.length + 1);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F8 · eine leere Datei bringt die ehrliche Leermeldung — keinen Erfolgskasten und keinen Entwurf",
    async () => {
      expect(b.fehler).toBeNull();
      const vorher = await serverEntwuerfe();
      await neuLaden(seite);
      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await seite.setInputFiles(DATEI_EINGANG, [dateiAnlage(DATEI_NAME, "   \n  \n")]);
      await aufFlaechensatzWarten(seite, t(CAPTURE_FILE_TEXT.empty, { name: DATEI_NAME }));

      const text = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(text).not.toContain(t(CAPTURE_FILE_TEXT.wholeCta));
      expect((await serverEntwuerfe()).length).toBe(vorher.length);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F9 · EN · beide Fehlerarten auf englischer Fläche — Grund da, kein Erfolg, kein deutscher Rückfall, Wiederholung gelingt",
    async () => {
      expect(b.fehler).toBeNull();
      await spracheSetzen(seite, "en");
      const vorher = await serverEntwuerfe();

      // ==========================================================================================
      // TEIL A — der Server antwortet 500. Der Grund muss beim Menschen ankommen.
      // ==========================================================================================
      weiche.setze("fehler");
      try {
        const versuch = await bisZumSpeichern();
        await aufRuhestandWarten(seite, versuch);
        await aufFlaechensatzWarten(seite, WEICHE_FEHLERSATZ);
        const httpText = await seite.evaluate<string>(fn(SEITENTEXT));
        expect(httpText, "der Serverfehler wurde verschluckt").toContain(WEICHE_FEHLERSATZ);
        // Die Fläche steht wirklich auf Englisch — sonst prüfte dieser Fall nur DE ein zweites Mal.
        expect(httpText).toContain(t(CAPTURE_FILE_TEXT.wholeCta));
        expect(t(CAPTURE_FILE_TEXT.wholeCta)).not.toBe(deutsch(CAPTURE_FILE_TEXT.wholeCta));
        expect(httpText).not.toContain(deutsch(CAPTURE_FILE_TEXT.wholeCta));
        expect(httpText).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
        expect(httpText).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
        expect(await kennungAusOeffnenLink(seite)).toBe(null);
        expect((await serverEntwuerfe()).length).toBe(vorher.length);

        // ========================================================================================
        // TEIL B — der Aufruf kommt gar nicht an. Hier ist der Satz WIRKLICH lokalisiert.
        // ========================================================================================
        weiche.setze("abbruch");
        const versuch2 = speicherversuchBeginnen(weiche);
        expect(await speichernDruecken(seite)).toBe(true);
        await aufRuhestandWarten(seite, versuch2);
        await aufFlaechensatzWarten(seite, t("state.error"));
        const netzText = await seite.evaluate<string>(fn(SEITENTEXT));
        expect(t("state.error")).not.toBe("state.error");
        expect(t("state.error")).not.toBe(deutsch("state.error"));
        expect(netzText).toContain(t("state.error"));
        expect(netzText, "deutscher Rückfall auf der englischen Fläche").not.toContain(
          deutsch("state.error"),
        );
        // Die Meldung folgt dem JÜNGSTEN Vorgang: der alte Grund steht nicht mehr daneben.
        expect(netzText).not.toContain(WEICHE_FEHLERSATZ);
        expect(netzText).not.toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
        expect(await kennungAusOeffnenLink(seite)).toBe(null);
        expect((await serverEntwuerfe()).length).toBe(vorher.length);
      } finally {
        weiche.setze("durch");
      }

      // ==========================================================================================
      // TEIL C — der Weg ist nicht tot, auch nach zwei Fehlschlägen und auch auf Englisch.
      // ==========================================================================================
      const versuch3 = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite)).toBe(true);
      await aufErfolgskastenWarten(seite, versuch3);
      await weiche.warteAufAbschluss(versuch3.marke);
      const nachher = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(nachher).toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(nachher).toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
      expect(nachher).not.toContain(deutsch(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(nachher).not.toContain(WEICHE_FEHLERSATZ);
      expect(nachher).not.toContain(t("state.error"));
      expect((await serverEntwuerfe()).length).toBe(vorher.length + 1);
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F10 · die Fehlerfrische am echten Server: Fehler → Erfolg, Fehler A → Fehler B, Fehler A → Fehler A — jeder Versuch wird an SEINEM Ausgang gemessen",
    async () => {
      // ==========================================================================================
      // JOB 3575 R3 — CODEX' KORREKTURPFLICHT 1 AUS RUNDE 2, am echten Chromium.
      // ==========================================================================================
      // Runde 2 erkannte einen Fehler daran, dass sein SATZ beim Beginn des Versuchs noch nicht
      // dastand. Codex hat zwei Speicherungen mit demselben gestellten Serverfehler gefahren: der
      // zweite Fehlschlag trug denselben Wortlaut, stand damit auf der Ausschlussliste seines
      // eigenen Versuchs und lief in sein Budget („Wartebudget erschöpft, nach 142 ms bei 120 ms
      // Probebudget, trotz angekommen=2 beendet=2").
      //
      // Der Fall ist nicht nachlässig geprüft, sondern strukturell unprüfbar gewesen: `setErr` bekommt
      // beim zweiten Mal zeichengleich denselben Wert, React bricht bei identischem Zustand ab und
      // rendert nicht neu. Die Fläche ist vor und nach dem zweiten Fehlschlag DIESELBE. Deshalb hängt
      // die Frische jetzt am Ausgang des Versuchs (`fehlerzustand`), und deshalb misst dieser Fall
      // alle drei Folgen hintereinander auf EINER Fläche.
      //
      // In jeder Folge wird — Codex' Promptverbesserung — ZUERST der gerenderte Zustand abgewartet
      // und ERST DANN der Erfolg-Wartehelfer gerufen. Ohne diese Reihenfolge prüfte der Fall den
      // schnellen Fehler ein zweites Mal statt den wiederholten.
      expect(b.fehler).toBeNull();
      await spracheSetzen(seite, "de");
      const vorher = await serverEntwuerfe();
      const budget = wartebudget("aufErfolgskastenWarten");
      // „Sofort" heisst: weit unter dem Budget. Ein Abbruch, der das Budget ausschöpft, ist genau
      // der Befund aus Runde 2 — und er wäre auch mit der richtigen Meldung noch falsch.
      const sofort = budget / WARTEBUDGET.teiler.gross;

      weiche.setze("fehler");
      try {
        // ---- Folge 1 · Fehler A, erstmals gezeigt ------------------------------------------
        const v1 = await bisZumSpeichern();
        await aufRuhestandWarten(seite, v1);
        await aufFlaechensatzWarten(seite, WEICHE_FEHLERSATZ);
        const m1 = await abbruchMessen(() => aufErfolgskastenWarten(seite, v1));
        expect(m1.meldung, "der erste Fehlschlag brach nicht mit Grund ab").toContain(
          "endet im Fehlerzustand des Speicherwegs",
        );
        expect(m1.meldung).toContain(WEICHE_FEHLERSATZ);
        expect(m1.meldung, "der Abbruch kam erst über das Budget").not.toContain(
          "Wartebudget erschöpft",
        );
        expect(m1.dauer, `der erste Abbruch brauchte ${m1.dauer} ms`).toBeLessThan(sofort);

        // ---- Folge 2 · Fehler A → Fehler A, DERSELBE Wortlaut ------------------------------
        // Hier ändert sich auf der Fläche nichts. Zwischen den beiden Versuchen steht deshalb
        // bewusst KEINE Zusicherung auf einen NEUEN Satz — es gibt keinen, und genau das ist der
        // Fall. Gemessen wird stattdessen, dass ein ZWEITER Anlege-Aufruf wirklich lief.
        const v2 = speicherversuchBeginnen(weiche);
        expect(
          await speichernDruecken(seite),
          "der Knopf kam nach dem Fehlschlag nicht zurück",
        ).toBe(true);
        await aufRuhestandWarten(seite, v2);
        expect(weiche.zaehler.beendet, "es lief kein zweiter Anlege-Aufruf").toBeGreaterThan(
          v2.marke,
        );
        await aufFlaechensatzWarten(seite, WEICHE_FEHLERSATZ);
        const m2 = await abbruchMessen(() => aufErfolgskastenWarten(seite, v2));
        expect(
          m2.meldung,
          "der WIEDERHOLTE Fehler mit identischem Wortlaut wurde übergangen",
        ).toContain("endet im Fehlerzustand des Speicherwegs");
        expect(m2.meldung).toContain(WEICHE_FEHLERSATZ);
        expect(m2.meldung, "der zweite Abbruch kam erst über das Budget").not.toContain(
          "Wartebudget erschöpft",
        );
        expect(m2.dauer, `der zweite Abbruch brauchte ${m2.dauer} ms`).toBeLessThan(sofort);
        expect((await serverEntwuerfe()).length, "ein Fehlschlag hat etwas angelegt").toBe(
          vorher.length,
        );

        // ---- Folge 3 · Fehler A → Fehler B ------------------------------------------------
        weiche.setze("abbruch");
        const v3 = speicherversuchBeginnen(weiche);
        expect(await speichernDruecken(seite)).toBe(true);
        await aufRuhestandWarten(seite, v3);
        await aufFlaechensatzWarten(seite, t("state.error"));
        const m3 = await abbruchMessen(() => aufErfolgskastenWarten(seite, v3));
        expect(m3.meldung, "der ANDERE Fehler brach nicht mit Grund ab").toContain(
          "endet im Fehlerzustand des Speicherwegs",
        );
        expect(m3.meldung, "der Abbruch nennt nicht den neuen Grund").toContain(t("state.error"));
        expect(m3.meldung, "der dritte Abbruch kam erst über das Budget").not.toContain(
          "Wartebudget erschöpft",
        );
        expect(m3.dauer, `der dritte Abbruch brauchte ${m3.dauer} ms`).toBeLessThan(sofort);
      } finally {
        weiche.setze("durch");
      }

      // ---- Folge 4 · Fehler → Erfolg: KEIN falscher Abbruch -------------------------------
      // Die Gegenrichtung, und die wichtigere: nach drei Fehlschlägen darf der gelingende Versuch
      // nicht an einer alten Meldung scheitern. `aufErfolgskastenWarten` muss hier DURCHKOMMEN.
      const v4 = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite)).toBe(true);
      const m4 = await abbruchMessen(() => aufErfolgskastenWarten(seite, v4));
      expect(m4.meldung, "der gelungene Versuch wurde an einer alten Meldung abgebrochen").toBe("");
      await weiche.warteAufAbschluss(v4.marke);

      const nachher = await seite.evaluate<string>(fn(SEITENTEXT));
      expect(nachher).toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
      expect(nachher, "die alte Fehlermeldung steht neben dem Erfolg").not.toContain(
        WEICHE_FEHLERSATZ,
      );
      expect((await serverEntwuerfe()).length, "der Erfolg hat nichts angelegt").toBe(
        vorher.length + 1,
      );
      expect(b.seitenfehler).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});
