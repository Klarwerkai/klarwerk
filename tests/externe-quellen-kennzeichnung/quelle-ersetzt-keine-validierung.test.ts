// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-0177 / R-1703 — EINE QUELLE ERSETZT
// KEINE FACHLICHE VALIDIERUNG.
// ================================================================================================
//
// Der Registerbeleg vom 07.09. hält für `KoService.addSource` fest: „gelesener Methodenkörper ändert
// keinen Validierungsstatus … Kein eigener Laufzeittest." Diese Datei ist dieser Laufzeittest.
//
// Gemessen am ECHTEN Dienst (In-Memory-Repo, kein Mock der Methode):
//   V1  eine angehängte Quelle ist `external` und `peerValidated: false`,
//   V2  ein OFFENES Objekt bleibt offen — die Quelle hebt weder Status noch Vertrauen,
//   V3  ein VALIDIERTES Objekt bleibt unverändert — die Quelle senkt auch nichts,
//   V4  ein Aufrufer, der `peerValidated: true` mitschickt, ändert daran nichts.
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { type CreateKoInput, KoService } from "../../services/knowledge-object/src/service";

function base(): CreateKoInput {
  return {
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "pedi",
  };
}

describe("R-0177 · eine externe Quelle ersetzt keine fachliche Validierung", () => {
  it("V1/V2 · offenes Objekt: Quelle ist extern/ungeprüft, Status und Vertrauen bleiben", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await svc.create(base());
    const vorher = { status: ko.status, trust: ko.trust };

    const mitQuelle = await svc.addSource(ko.id, "experte", {
      label: "Herstellerhandbuch Ventil X",
      url: "https://beispiel.de/handbuch",
      provider: "SharePoint",
    });
    const quelle = mitQuelle.sources.at(-1);
    expect(quelle?.kind).toBe("external");
    expect(quelle?.peerValidated).toBe(false);

    const gelesen = await svc.get(ko.id);
    expect(gelesen?.status, "die Quelle hat den Status verändert").toBe(vorher.status);
    expect(gelesen?.trust, "die Quelle hat das Vertrauen verändert").toBe(vorher.trust);
    expect(gelesen?.status).not.toBe("validiert");
  });

  it("V3 · validiertes Objekt: die Quelle lässt Status und Vertrauen unberührt", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await svc.create(base());
    await svc.setValidationState(ko.id, { trust: 90, status: "validiert" });

    await svc.addSource(ko.id, "experte", { label: "Lexikonartikel Überdruckventil" });

    const gelesen = await svc.get(ko.id);
    expect(gelesen?.status).toBe("validiert");
    expect(gelesen?.trust).toBe(90);
    expect(gelesen?.sources.at(-1)?.peerValidated).toBe(false);
  });

  it("V4 · ein mitgeschicktes peerValidated:true wird nicht übernommen", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await svc.create(base());

    const mitQuelle = await svc.addSource(ko.id, "experte", {
      label: "Behauptet geprüft",
      peerValidated: true,
    } as Parameters<KoService["addSource"]>[2]);

    expect(mitQuelle.sources.at(-1)?.peerValidated).toBe(false);
    expect((await svc.get(ko.id))?.status).toBe(ko.status);
  });
});
