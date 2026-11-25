import { expect, it } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import { pruefeArtikelBuchung } from "./wissensartikel-fixture";

it("bucht den freigegebenen Artikel und seine Belege gemeinsam mit der Teamentscheidung", async () => {
  const repos = inMemoryRepos();
  const id = await pruefeArtikelBuchung(assembleServices(repos));
  expect(await repos.koVersions.listByKo(id)).toEqual([]);
  expect(await repos.evidence.listByKo(id)).toEqual([]);
});
