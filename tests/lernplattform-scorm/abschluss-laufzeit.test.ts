// produkt:wettbewerb:20261003:lernplattform — K3: DER GEMELDETE ABSCHLUSS PASST ZUM DURCHLAUF.
//
// Gefahren wird das ECHTE `index.html` und das ECHTE `sco.js` aus einem erzeugten Paket, in jsdom,
// gegen die SCORM-1.2-Laufzeitattrappe (`scorm12-attrappe.ts`). Gemessen wird, was die Plattform am
// Ende GESPEICHERT hat (Stand nach Commit/Finish) — nicht, was das Skript glaubt.
//
// GRENZE: jsdom ist kein Browser und die Attrappe kein Moodle. Dass Moodle 4.5 dieselben Aufrufe
// genauso speichert und in der Abschlussübersicht zeigt, ist die offene Abnahme am Referenzsystem.
import { afterEach, describe, expect, it } from "vitest";
import {
  SCORM_BESCHRIFTUNG,
  SCO_JS as SCO_JS_FUER_TEST,
} from "../../services/output/src/scorm-laufzeit";
import { beispielKo, bestand, eingabe, entpacke, paketOderFehler } from "./beispiel";
import {
  type FensterLike,
  Scorm12Attrappe,
  fenster,
  gestartet,
  setzeOnline,
} from "./scorm12-attrappe";

const offen: FensterLike[] = [];
afterEach(() => {
  for (const w of offen.splice(0)) {
    w.close();
  }
});

async function indexHtml(sprache: "de" | "en" = "de"): Promise<string> {
  const { dienst } = bestand([
    beispielKo({ id: "LE-1", title: "Ventil prüfen" }),
    beispielKo({ id: "LE-2", title: "Druck ablassen" }),
    beispielKo({ id: "LE-3", title: "Ventil schließen" }),
  ]);
  const paket = await paketOderFehler(dienst, eingabe(["LE-1", "LE-2", "LE-3"], { sprache }));
  const { text } = await entpacke(paket.daten);
  const html = text.get("index.html");
  const js = text.get("sco.js");
  expect(js, "das Paket trägt genau das ausgelieferte Skript").toBe(SCO_JS_FUER_TEST);
  if (!html) {
    throw new Error("index.html fehlt");
  }
  return html;
}

async function starte(
  api: Scorm12Attrappe | null,
  sprache: "de" | "en" = "de",
): Promise<FensterLike> {
  const w = fenster(await indexHtml(sprache));
  offen.push(w);
  if (api) {
    w.API = api;
  }
  w.eval(SCO_JS_FUER_TEST);
  await gestartet(w);
  return w;
}

const klick = (w: FensterLike, id: string): void => {
  const el = w.document.getElementById(id);
  if (!el) {
    throw new Error(`${id} fehlt`);
  }
  el.click();
};

const sichtbareEinheit = (w: FensterLike): string | null => {
  const alle = Array.from(w.document.querySelectorAll("section[data-einheit]"));
  const sichtbar = alle.filter((s) => !s.hasAttribute("hidden"));
  expect(sichtbar).toHaveLength(1);
  return sichtbar[0]?.getAttribute("data-ko-id") ?? null;
};

const verlassen = (w: FensterLike): void => {
  w.dispatchEvent(new w.Event("pagehide"));
};

describe("K3 · Abschluss im Referenzablauf (SCORM 1.2 RTE)", () => {
  it("vollständiger Durchlauf: jede Einheit gesehen, „Abschließen“ gewählt → completed gespeichert", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api);
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("incomplete");
    expect(sichtbareEinheit(w)).toBe("LE-1");
    expect(w.document.getElementById("kw-abschliessen")?.hidden).toBe(true);

    klick(w, "kw-weiter");
    klick(w, "kw-weiter");
    expect(sichtbareEinheit(w)).toBe("LE-3");
    expect(w.document.getElementById("kw-abschliessen")?.hidden).toBe(false);
    klick(w, "kw-abschliessen");
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("completed");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abgeschlossen,
    );

    verlassen(w);
    expect(api.finishZahl).toBe(1);
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("completed");
    expect(api.gespeichert["cmi.core.exit"]).toBe("");
    expect(api.gespeichert["cmi.core.session_time"]).toMatch(/^\d{4}:\d{2}:\d{2}$/);
  });

  it("abgebrochener Durchlauf: nach Einheit 2 geschlossen → incomplete, suspend, nie completed", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api);
    klick(w, "kw-weiter");
    verlassen(w);

    expect(api.abschlussJeGesetzt()).toBe(false);
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("incomplete");
    expect(api.gespeichert["cmi.core.exit"]).toBe("suspend");
    expect(api.gespeichert["cmi.core.lesson_location"]).toBe("1");
    expect(api.gespeichert["cmi.suspend_data"]).toBe("besucht:0,1");
    expect(api.finishZahl).toBe(1);
  });

  it("„Abschließen“ ohne alle Einheiten gesehen zu haben meldet nichts", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api);
    // Der Knopf ist auf Einheit 1 verborgen; auch ein erzwungener Klick darf nichts melden.
    klick(w, "kw-abschliessen");
    expect(api.abschlussJeGesetzt()).toBe(false);
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abschlussOffen,
    );
    verlassen(w);
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("incomplete");
  });

  it("Wiederaufnahme: setzt an der gespeicherten Einheit fort und kann dann abschließen", async () => {
    const api = new Scorm12Attrappe({
      "cmi.core.lesson_status": "incomplete",
      "cmi.core.lesson_location": "2",
      "cmi.suspend_data": "besucht:0,1,2",
      "cmi.core.entry": "resume",
    });
    const w = await starte(api);
    expect(sichtbareEinheit(w)).toBe("LE-3");
    klick(w, "kw-abschliessen");
    verlassen(w);
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("completed");
  });

  it("ein bereits gemeldeter Abschluss wird beim erneuten Öffnen nicht zurückgestuft", async () => {
    const api = new Scorm12Attrappe({ "cmi.core.lesson_status": "completed" });
    const w = await starte(api);
    verlassen(w);
    expect(api.aufrufe).not.toContain("LMSSetValue(cmi.core.lesson_status,incomplete)");
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("completed");
    expect(api.gespeichert["cmi.core.exit"]).toBe("");
  });

  it("lehnt die Plattform den Abschluss ab, zeigt das Paket KEINEN Abschluss an", async () => {
    const api = new Scorm12Attrappe();
    api.abgelehnt.add("cmi.core.lesson_status");
    const w = await starte(api);
    klick(w, "kw-weiter");
    klick(w, "kw-weiter");
    klick(w, "kw-abschliessen");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abschlussFehler,
    );
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBeNull();
    verlassen(w);
    expect(api.gespeichert["cmi.core.lesson_status"]).not.toBe("completed");
    expect(api.gespeichert["cmi.core.exit"]).toBe("suspend");
  });

  it("Netzunterbrechung: LMSSetValue gelingt, LMSCommit scheitert → KEIN gemeldeter Abschluss, erneuter Versuch möglich", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api);
    klick(w, "kw-weiter");
    klick(w, "kw-weiter");

    api.netzGetrennt = true;
    klick(w, "kw-abschliessen");
    // Der Wert ging an die Laufzeit, das Speichern scheiterte — und der Fehlercode sagt "0".
    expect(api.aufrufe).toContain("LMSSetValue(cmi.core.lesson_status,completed)");
    expect(api.LMSGetLastError()).toBe("0");
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("incomplete");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abschlussFehler,
    );
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBeNull();
    expect(w.document.getElementById("kw-abschliessen")?.hidden).toBe(false);

    // Netz wieder da: derselbe Knopf versucht es erneut, jetzt gespeichert und bestätigt.
    api.netzGetrennt = false;
    klick(w, "kw-abschliessen");
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("completed");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abgeschlossen,
    );
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBe("ja");
    verlassen(w);
    expect(api.gespeichert["cmi.core.exit"]).toBe("");
  });

  it("Netzunterbrechung bis zum Verlassen: kein bestätigter Abschluss, Austritt bleibt suspend", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api);
    klick(w, "kw-weiter");
    klick(w, "kw-weiter");
    api.netzGetrennt = true;
    klick(w, "kw-abschliessen");
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBeNull();
    // Beim Verlassen ist das Netz zurück: das Paket meldet ehrlich „nicht abgeschlossen bestätigt"
    // (exit suspend) und behauptet nachträglich nichts.
    api.netzGetrennt = false;
    verlassen(w);
    expect(api.gespeichert["cmi.core.exit"]).toBe("suspend");
  });

  it("Moodle-Offlineverhalten: SetValue/Commit „true“, Fehler „0“, nichts gespeichert → KEIN gemeldeter Abschluss, erneuter Versuch nach Wiederverbindung", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api);
    klick(w, "kw-weiter");
    klick(w, "kw-weiter");

    // Genau der beobachtete Zustand: Browser kennt den Ausfall, die API meldet trotzdem Erfolg.
    api.offlineWieMoodle = true;
    setzeOnline(w, false);
    expect(api.LMSSetValue("cmi.core.lesson_location", "2")).toBe("true");
    expect(api.LMSCommit("")).toBe("true");
    expect(api.LMSGetLastError()).toBe("0");
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("incomplete");

    klick(w, "kw-abschliessen");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abschlussOffline,
    );
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBeNull();
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("incomplete");
    expect(w.document.getElementById("kw-abschliessen")?.hidden).toBe(false);

    // Verbindung wieder da: derselbe Knopf schliesst jetzt wirklich ab.
    api.offlineWieMoodle = false;
    setzeOnline(w, true);
    klick(w, "kw-abschliessen");
    expect(api.gespeichert["cmi.core.lesson_status"]).toBe("completed");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.de.abgeschlossen,
    );
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBe("ja");
  });

  it("Moodle-Offlineverhalten auf Englisch: dieselbe Sperre mit englischem Hinweis", async () => {
    const api = new Scorm12Attrappe();
    const w = await starte(api, "en");
    klick(w, "kw-weiter");
    klick(w, "kw-weiter");
    api.offlineWieMoodle = true;
    setzeOnline(w, false);
    klick(w, "kw-abschliessen");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.en.abschlussOffline,
    );
    expect(api.abschlussJeGesetzt()).toBe(false);
  });

  it("ohne Lernplattform: Inhalt sichtbar, ausdrücklich nichts gemeldet (auch auf Englisch)", async () => {
    const w = await starte(null, "en");
    expect(w.document.body.getAttribute("data-kw-lms")).toBe("keins");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.en.keinLms,
    );
    klick(w, "kw-weiter");
    klick(w, "kw-weiter");
    klick(w, "kw-abschliessen");
    expect(w.document.getElementById("kw-meldung")?.textContent).toBe(
      SCORM_BESCHRIFTUNG.en.abschlussOhneLms,
    );
    expect(w.document.body.getAttribute("data-kw-abgeschlossen")).toBeNull();
  });
});
