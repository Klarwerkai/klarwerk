import { afterEach, beforeEach, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { anfrageEpoche, rechtekontextGesehen } from "../../apps/web/src/lib/rechtekontext";
import { FRAGE, KONTEXT, bis, montiere, tick } from "./kiw1-vorrichtung";

vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let seite: Awaited<ReturnType<typeof montiere>> | undefined;
beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(async () => {
  await seite?.abbauen();
  seite = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("GKIW1-1 · echte Client-/Fetchkante zeigt Laufzeit/Langsamkeit und bricht bewusst ab, obwohl der gehaltene Transport noch offen ist", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  seite = await montiere();
  await seite.senden();
  await bis(() => expect(seite?.abrufe).toHaveLength(1));
  expect(seite.container.querySelector('[data-testid="ask-abbrechen"]')).not.toBeNull();
  expect(
    seite.container.querySelector('[data-testid="ask-wartestand-dauer"]')?.textContent,
  ).toContain("0");
  expect(seite.container.querySelector('[data-testid="ask-wartestand-langsam"]')).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(
    seite.container.querySelector('[data-testid="ask-wartestand-dauer"]')?.textContent,
  ).toContain("5");
  expect(
    seite.container.querySelector('[data-testid="ask-wartestand-langsam"]')?.textContent,
  ).toBeTruthy();
  await seite.abbrechen();
  await bis(() => expect(seite?.knopf().disabled).toBe(false));
  expect(seite.abrufe[0]?.signal?.aborted).toBe(true);
  expect(seite.container.querySelector('[data-testid="ask-pending"]')).toBeNull();
  expect(seite.container.querySelector('[data-testid="ask-error"]')).toBeNull();
  expect(seite.container.querySelector('[data-testid="ask-warteabbruch"]')?.textContent).toContain(
    "Server",
  );
});

it("GKIW1-2 · Cancel einer Auffrischung hält Original/Receipt; Neuabruf bindet Locale/Kontext/Faden, ignorierter Abort liefert danach keine alte Antwort oder History", async () => {
  seite = await montiere("nl");
  await seite.senden();
  await bis(() => expect(seite?.abrufe).toHaveLength(1));
  await act(async () => seite?.abrufe[0]?.antworten("Erste unveränderte Antwort.", "original"));
  await bis(() => expect(seite?.stand()?.antwort?.receipt).toBe("original"));
  await seite.senden();
  await bis(() => expect(seite?.abrufe).toHaveLength(2));
  expect(seite.stand()?.antwort?.receipt).toBe("original");
  expect(seite.container.textContent).toContain("Erste unveränderte Antwort.");
  await seite.abbrechen();
  await bis(() => expect(seite?.knopf().disabled).toBe(false));
  expect(seite.abrufe[1]?.signal?.aborted).toBe(true);
  expect(seite.stand()?.antwort?.receipt).toBe("original");
  expect(
    seite.container.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]'),
  ).toBeNull();
  await seite.senden("Und welcher Filter folgt danach?");
  await bis(() => expect(seite?.abrufe).toHaveLength(3));
  expect(seite.abrufe[2]?.body).toMatchObject({
    locale: "nl",
    fragekontext: KONTEXT,
    thread: [FRAGE],
  });
  await act(async () => seite?.abrufe[2]?.antworten("Neue gültige Antwort.", "neu"));
  await bis(() => expect(seite?.stand()?.antwort?.receipt).toBe("neu"));
  const vorher = JSON.stringify(seite.stand());
  await act(async () => seite?.abrufe[1]?.antworten("Falsche späte Altantwort.", "spaet"));
  await tick();
  expect(JSON.stringify(seite.stand())).toBe(vorher);
  expect(seite.container.textContent).not.toContain("Falsche späte Altantwort.");
  await seite.senden("Und dann?");
  await bis(() => expect(seite?.abrufe).toHaveLength(4));
  expect(seite.abrufe[3]?.body.thread).toEqual([FRAGE, "Und welcher Filter folgt danach?"]);
});

it("GKIW1-3 · Kontowechsel während Wartezeit stoppt genau diesen Transport; seine spätere Antwort schreibt weder ins alte noch ins neue Konto", async () => {
  seite = await montiere();
  await seite.senden();
  await bis(() => expect(seite?.abrufe).toHaveLength(1));
  await act(async () =>
    seite?.client.setQueryData(["auth", "me"], { id: "kiw-b", role: "experte" }),
  );
  await bis(() => expect(seite?.abrufe[0]?.signal?.aborted).toBe(true));
  const alt = JSON.stringify(seite.stand());
  const neu = JSON.stringify(seite.stand("kiw-b"));
  await act(async () => seite?.abrufe[0]?.antworten("Fremde alte Antwort.", "fremd"));
  await tick();
  expect(JSON.stringify(seite.stand())).toBe(alt);
  expect(JSON.stringify(seite.stand("kiw-b"))).toBe(neu);
  expect(seite.container.textContent).not.toContain("Fremde alte Antwort.");
});

it("GKIW1-4 · Rechteepoche während gehaltenem Abruf verhindert dessen späte Antwort und Receipt", async () => {
  seite = await montiere();
  await seite.senden();
  await bis(() => expect(seite?.abrufe).toHaveLength(1));
  await act(async () => {
    seite?.stempel("kiw-rechte-b");
    rechtekontextGesehen("kiw-rechte-b", anfrageEpoche());
  });
  await bis(() => expect(seite?.abrufe[0]?.signal?.aborted).toBe(true));
  const vorher = JSON.stringify(seite.stand());
  await act(async () => seite?.abrufe[0]?.antworten("Antwort aus alten Rechten.", "altrecht"));
  await tick();
  expect(JSON.stringify(seite.stand())).toBe(vorher);
  expect(seite.container.textContent).not.toContain("Antwort aus alten Rechten.");
});

it("GKIW1-5 · Abbau der Fläche beendet den eigenen Transport und lässt keinen späten Arbeitsstand entstehen", async () => {
  seite = await montiere();
  await seite.senden();
  await bis(() => expect(seite?.abrufe).toHaveLength(1));
  const vorher = JSON.stringify(seite.stand());
  await seite.abbauen();
  expect(seite.abrufe[0]?.signal?.aborted).toBe(true);
  expect(JSON.stringify(seite.stand())).toBe(vorher);
});

it.each(["de", "en", "nl"] as const)(
  "GKIW1-6 · %s: wirklicher AbortError am kontrollierten Fetch bleibt eigener Abbruch, erfolgreicher Nichtverfügbarstatus bleibt gesperrt",
  async (sprache) => {
    seite = await montiere(sprache, true);
    await seite.senden();
    await bis(() => expect(seite?.abrufe).toHaveLength(1));
    await seite.abbrechen();
    await bis(() => expect(seite?.knopf().disabled).toBe(false));
    expect(seite.container.querySelector('[data-testid="ask-error"]')).toBeNull();
    expect(seite.container.querySelector('[data-testid="ask-warteabbruch"]')?.textContent).toBe(
      i18n.t("ask.wartestand.abgebrochen"),
    );
    for (const k of ["dauer", "langsam", "abbrechen", "abgebrochen"])
      expect(i18n.t(`ask.wartestand.${k}`, { sekunden: 1 })).not.toContain(`ask.wartestand.${k}`);
    seite.modellAus();
    await act(async () => seite?.client.refetchQueries({ queryKey: ["reasoner", "status"] }));
    await bis(() => expect(seite?.knopf().disabled).toBe(true));
    await seite.senden("Kein Sperr-Bypass durch Abbruch");
    expect(seite.abrufe).toHaveLength(1);
  },
);
