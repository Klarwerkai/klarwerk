// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { bildInhaltskennung } from "../../apps/web/src/lib/bildAutomatik";
import { ladeFinderOcrDatei } from "../../apps/web/src/lib/finderOcrEingang";
import { bildMitMassen, dataUrl } from "./deck";

afterEach(() => vi.restoreAllMocks());

async function aufnahme() {
  const bytes = bildMitMassen("FINDER", 1000, 600);
  const hash = (await bildInhaltskennung(bytes))?.replace("sha256:", "") ?? "";
  const get = vi.spyOn(api, "get").mockResolvedValue({
    objektId: "einzel-1",
    herkunft: {
      quelle: "finder-auswahl",
      dateiId: "gewaehlt",
      sha256: hash,
      groesse: bytes.length,
      bindung: {
        programm: "finder",
        sitzung: "native-sitzung",
        hostKonto: "aktuelles-konto",
        objekt: "gewaehlt",
        fassung: hash,
      },
    },
  });
  const read = vi.spyOn(endpoints.objects, "read").mockResolvedValue({
    ref: {
      id: "einzel-1",
      name: "bewusst-gewaehlt.png",
      mime: "image/png",
      size: bytes.length,
      kind: "image",
      createdAt: "2026-10-20T07:00:00Z",
    },
    data: dataUrl(bytes),
  });
  return { get, read, bytes };
}

it("führt nur die bestätigte Einzeldatei mit denselben Originalbytes in den normalen Dateiweg", async () => {
  const { get, read, bytes } = await aufnahme();
  const datei = await ladeFinderOcrDatei("einzel-1");
  expect(get).toHaveBeenCalledWith("/klara/programme/finder/einzel-1");
  expect(read).toHaveBeenCalledWith("einzel-1");
  expect(datei.name).toBe("bewusst-gewaehlt.png");
  expect(datei.type).toBe("image/png");
  expect(datei.size).toBe(bytes.length);
});

it("liest nach Rechteentzug keine Objektbytes und übernimmt keine fremde Herkunft", async () => {
  const { get, read } = await aufnahme();
  get.mockRejectedValueOnce(new Error("404"));
  await expect(ladeFinderOcrDatei("einzel-1")).rejects.toThrow("404");
  expect(read).not.toHaveBeenCalled();
  get.mockResolvedValueOnce({ objektId: "fremd", herkunft: { quelle: "finder-auswahl" } });
  await expect(ladeFinderOcrDatei("einzel-1")).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
});

it("verwirft geänderte Bytes trotz gleicher Objektkennung und Dateigröße", async () => {
  const { read, bytes } = await aufnahme();
  const geaendert = new Uint8Array(bytes);
  geaendert[geaendert.length - 1] = 1;
  const original = await endpoints.objects.read("einzel-1");
  read.mockResolvedValueOnce({ ...original, data: dataUrl(geaendert) });
  await expect(ladeFinderOcrDatei("einzel-1")).rejects.toThrow();
});
