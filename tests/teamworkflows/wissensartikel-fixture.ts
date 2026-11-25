import { expect } from "vitest";
import type { AppServices } from "../../services/app/src/build-app";
import { verifizierungFuer } from "../../services/app/src/verifizierungsmarke";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";

const eingabe: CreateKoInput = {
  title: "Freigegebener Übergabeschritt",
  statement: "Die Übergabe wird im Abschlussbericht festgehalten.",
  type: "technik",
  category: "Service",
  author: "teammitglied",
  sources: [
    {
      id: "beleg-1",
      author: "verantwortliche",
      at: "2026-11-25T08:00:00.000Z",
      label: "Klarwerk · v2",
      url: null,
      provider: "Klarwerk",
      workflowQuellart: "wissensfassung",
      externalId: "quelle",
      kind: "external",
      excerpt: null,
      peerValidated: false,
      sourceVersion: 2,
    },
  ],
};

export async function pruefeArtikelBuchung(dienste: AppServices) {
  const { ko, audit } = dienste;
  const artikel = await ko.createFromReviewedWorkflow(eingabe, "verantwortliche", async () => {});
  expect((await ko.get(artikel.id))?.annahmeRef).toEqual(artikel.annahmeRef);
  expect(artikel.status).toBe("validiert");
  expect(await verifizierungFuer(artikel, audit)).toMatchObject({
    mensch: {
      stand: "belegt",
      art: "eigentuemer",
      pruefer: "verantwortliche",
      aktuell: true,
      fassung: 1,
    },
    validiertVon: ["verantwortliche"],
  });
  expect(artikel.annahmeRef).toMatchObject({ koVersion: 1, ...artikel.validationDecisionRef });
  expect(await ko.versionsOf(artikel.id)).toMatchObject([
    { snapshot: { status: "validiert", annahmeRef: artikel.annahmeRef } },
  ]);
  expect(await ko.evidenceOf(artikel.id)).toMatchObject([{ kind: "source", sourceId: "beleg-1" }]);
  const historie = await audit.list({ target: artikel.id });
  expect(historie.filter((e) => e.action === "ko.created")).toHaveLength(1);
  expect(historie.find((e) => e.action === "ko.owner-validated")).toMatchObject({
    actor: "verantwortliche",
    hash: artikel.validationDecisionRef?.auditHash,
  });
  let verworfen = "";
  await expect(
    ko.createFromReviewedWorkflow(eingabe, "verantwortliche", async (entwurf) => {
      verworfen = entwurf.id;
      throw new Error("Vorschlag bereits entschieden");
    }),
  ).rejects.toThrow("Vorschlag bereits entschieden");
  expect(verworfen).not.toBe("");
  expect(await ko.get(verworfen)).toBeUndefined();
  expect(await audit.list({ target: verworfen })).toEqual([]);
  expect(await ko.recentEvidence()).not.toContainEqual(
    expect.objectContaining({ koId: verworfen }),
  );
  return verworfen;
}
