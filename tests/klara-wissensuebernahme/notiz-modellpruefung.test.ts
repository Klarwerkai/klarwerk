import { describe, expect, it, vi } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraNotizModellBeleg } from "../../services/app/src/klara-gespraech-ausgabe";
import { InMemoryKlaraNotizRepo, type KlaraNotiz } from "../../services/app/src/klara-notiz";
import { KlaraWissensDienst } from "../../services/app/src/klara-wissensuebernahme";
import { ReferenzPruefdienst } from "../../services/ask";
import type { ReferenzPrueferWahl, ReferenzRolle } from "../../services/reasoner";
import {
  ANTWORT_ROLLE,
  PRUEF_ROLLE,
  alle,
  doppelgaenger,
} from "../referenzki-antwortstatus/hilfen";

const nutzer = { id: "test-person", role: "experte" as const };
const satz = "Die Leiter ist vor jeder Benutzung auf Risse zu prüfen.";

async function aufbau() {
  const s = assembleServices(inMemoryRepos());
  const notizen = new InMemoryKlaraNotizRepo();
  const quelle = await s.ko.create({
    author: nutzer.id,
    title: "Leiterprüfung",
    statement: "Regel für die Werkstatt.",
    bodyHtml: `<p>${satz}</p>`,
    type: "technik",
    category: "Arbeit",
    confidentiality: "intern",
  });
  const andere = await s.ko.create({
    author: nutzer.id,
    title: "Objekt am Bildschirm",
    statement: "Der Prüfstand ist blau.",
    type: "technik",
    category: "Arbeit",
    confidentiality: "intern",
  });
  await s.validation.adminValidate(quelle.id, "test-pruefer");
  await s.validation.adminValidate(andere.id, "test-pruefer");
  const n: KlaraNotiz = {
    id: "notiz-pruefung",
    kontoId: nutzer.id,
    fassung: 1,
    weg: "gespraech",
    art: "notiz",
    titel: "Werkstatt",
    vorgang: "notiz-auftrag",
    inhalt: `${satz} [1]`,
    offeneFragen: [],
    quelle: { gespraechId: "eigenes-gespraech", nachrichtId: "belegte-antwort" },
    antwortId: "eigene-antwort",
    objektbezug: {
      pfad: "/fragen",
      seitenName: "Wissen",
      objekt: "Anderes Objekt",
      koId: andere.id,
      fassung: andere.version,
    },
    angelegtAm: quelle.createdAt,
    geaendertAm: quelle.createdAt,
  };
  await notizen.lege(n);
  const beleg: KlaraNotizModellBeleg = {
    rolle: ANTWORT_ROLLE,
    quellen: [quelle, andere].map((ko) => ({ id: ko.id, fassung: ko.version })),
    zitierteQuellen: [quelle.id],
  };
  const modellbeleg = vi.fn(async (): Promise<KlaraNotizModellBeleg | undefined> => beleg);
  const zweitmodell = doppelgaenger(alle("belegt"), PRUEF_ROLLE);
  const pruefer = {
    ...zweitmodell.pruefer,
    extern: true,
    pruefe: async (...args: Parameters<typeof zweitmodell.pruefer.pruefe>) => ({
      ...(await zweitmodell.pruefer.pruefe(...args)),
      gemeldetesModell: PRUEF_ROLLE.modell ?? "",
    }),
  };
  const wahl = vi.fn(
    (rolle: ReferenzRolle | undefined, _vertraulich: boolean): ReferenzPrueferWahl =>
      rolle ? { pruefer } : { grund: "antwortmodell_unbekannt" },
  );
  const referenz = new ReferenzPruefdienst({
    waehlePruefer: wahl,
    externErlaubt: (vertraulich) => !vertraulich,
    istVertraulich: (ko) => ko.confidentiality !== "intern",
  });
  const dienst = new KlaraWissensDienst({
    notizen,
    ko: s.ko,
    spaces: s.spaces,
    audit: s.audit,
    vorlagen: { pruefe: vi.fn(), vermerke: vi.fn(), halte: vi.fn(), sperre: vi.fn() },
    referenz,
    notizModellBeleg: modellbeleg,
    antwortQuellen: async () => beleg.quellen,
  });
  return {
    s,
    n,
    notizen,
    quelle,
    andere,
    beleg,
    modellbeleg,
    wahl,
    pruefer,
    referenz,
    dienst,
    zaehler: zweitmodell.zaehler,
  };
}

describe("Klara prüft die unveränderte Modellantwort an den gebundenen Quellen", () => {
  it("benutzt die ursprüngliche Zitatreihenfolge, belegt die Passage im Volltext und schützt Modellnamen", async () => {
    const { n, quelle, dienst, zaehler, wahl } = await aufbau();
    const r = await dienst.pruefe(nutzer, n.id);
    expect(r.ergebnis).toMatchObject({
      status: "geprueft",
      rollen: { antwort: "cloud", pruefer: "cloud" },
      aussagen: [
        { zustand: "belegt", fundstellen: [{ koId: quelle.id, koVersion: quelle.version }] },
      ],
    });
    expect(r.beleg.aussagen[0]?.teile[0]?.fundstellen[0]).toMatchObject({
      feld: "bodyText",
      koId: quelle.id,
    });
    expect(r.modellherkunft).toEqual({ stufe: "cloud" });
    expect(r.quelltitel[quelle.id]).toBe(quelle.title);
    expect(JSON.stringify(r)).not.toContain("pruef-modell-b");
    expect(wahl).toHaveBeenCalledWith(ANTWORT_ROLLE, false);
    expect(zaehler.aufrufe).toBe(1);
    const admin = await dienst.pruefe({ ...nutzer, role: "admin" }, n.id);
    expect(admin.modellherkunft).toEqual(ANTWORT_ROLLE);
    expect(admin.ergebnis.rollen.pruefer).toEqual(PRUEF_ROLLE);
  });
  it.each([
    [ANTWORT_ROLLE.modell ?? "", "pruefer_nicht_unabhaengig"],
    ["", "pruefer_modell_unbekannt"],
  ])(
    "verwirft eine Selbstprüfung über verschiedene Aliasse oder fehlende Transportkennung (%s)",
    async (gemeldetesModell, grund) => {
      const { dienst, n, pruefer, zaehler } = await aufbau();
      const pruefen = pruefer.pruefe;
      pruefer.pruefe = async (...args) => ({ ...(await pruefen(...args)), gemeldetesModell });
      const ergebnis = await dienst.pruefe(nutzer, n.id);
      expect(ergebnis.ergebnis).toMatchObject({
        status: "nicht_pruefbar",
        grund,
        messung: { modellaufrufe: 1 },
      });
      expect(zaehler.aufrufe).toBe(1);
    },
  );
  it("zeigt die nachgewiesene Herkunft auch bei fehlendem unabhängigem Modell und akzeptiert keine unbelegte Rolle", async () => {
    const { dienst, n, wahl, modellbeleg, zaehler } = await aufbau();
    wahl.mockReturnValueOnce({ grund: "nicht_unabhaengig" });
    const r = await dienst.pruefe(nutzer, n.id);
    expect(r.modellherkunft).toEqual({ stufe: "cloud" });
    expect(r.ergebnis).toMatchObject({
      status: "nicht_pruefbar",
      grund: "pruefer_nicht_unabhaengig",
    });
    modellbeleg.mockResolvedValueOnce(undefined);
    const alt = await dienst.pruefe(nutzer, n.id);
    expect(alt.modellherkunft).toBeNull();
    expect(alt.ergebnis.grund).toBe("antwortmodell_unbekannt");
    expect(zaehler.aufrufe).toBe(0);
  });
  it("wendet die Vertraulichkeit einer mitgelesenen, unzitierten Quelle auf den ganzen Modellaufruf an", async () => {
    const { s, n, andere, dienst, zaehler, wahl, beleg, modellbeleg } = await aufbau();
    const geschuetzt = await s.ko.setConfidentiality(andere.id, "vertraulich", nutzer.id);
    modellbeleg.mockResolvedValue({
      ...beleg,
      quellen: beleg.quellen.map((q) =>
        q.id === andere.id ? { id: q.id, fassung: geschuetzt.version } : q,
      ),
    });
    const r = await dienst.pruefe(nutzer, n.id);
    expect(wahl).toHaveBeenCalledWith(ANTWORT_ROLLE, true);
    expect(r.ergebnis.grund).toBe("keine_freigabe_externe_verarbeitung");
    expect(zaehler.aufrufe).toBe(0);
  });
  it("verwirft die Quellfreigabe, wenn sie während der Modellprüfung ohne Versionswechsel erlischt", async () => {
    const { s, n, quelle, dienst, pruefer } = await aufbau();
    const pruefen = pruefer.pruefe;
    pruefer.pruefe = async (...args) => {
      const alt = await s.ko.setValidationState(quelle.id, { trust: 0, status: "offen" });
      expect(alt.version).toBe(quelle.version);
      return pruefen(...args);
    };
    await expect(dienst.pruefe(nutzer, n.id)).rejects.toMatchObject({ status: 409 });
  });
  it("verwirft den Stand bei einer neuen Quellfassung vor dem Aufruf oder bei einer Änderung der Notiz während der Modellprüfung", async () => {
    const { s, n, notizen, quelle, dienst, pruefer, zaehler } = await aufbau();
    const pruefen = pruefer.pruefe;
    pruefer.pruefe = async (...args) => {
      await notizen.ersetze({ ...n, inhalt: "Eine spätere Bearbeitung.", fassung: 2 });
      return pruefen(...args);
    };
    await expect(dienst.pruefe(nutzer, n.id)).rejects.toMatchObject({ status: 409 });
    expect(zaehler.aufrufe).toBe(1);
    await s.ko.revise(quelle.id, { statement: "Eine neue Quellfassung." }, nutzer.id);
    await expect(dienst.pruefe(nutzer, n.id)).rejects.toMatchObject({ status: 409 });
    expect(zaehler.aufrufe).toBe(1);
  });
});
