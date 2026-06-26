import { describe, expect, it } from "vitest";
import { InMemoryObjectRepo } from "./repo";
import { ObjectStore, inferKind } from "./service";

function store() {
  return new ObjectStore({ repo: new InMemoryObjectRepo() });
}

describe("ObjectStore (SCRUM-121)", () => {
  it("put liefert ObjectRef mit Größe und abgeleiteter Art", async () => {
    const s = store();
    const ref = await s.put({
      name: "foto.jpg",
      mime: "image/jpeg",
      data: "data:image/jpeg;base64,AAAA",
    });
    expect(ref.id).toBeTruthy();
    expect(ref.kind).toBe("image");
    expect(ref.size).toBe("data:image/jpeg;base64,AAAA".length);
    expect(ref.name).toBe("foto.jpg");
  });

  it("read liefert Referenz + Inhalt; metadata nur die Referenz", async () => {
    const s = store();
    const ref = await s.put({ name: "x", mime: "application/pdf", data: "PDFDATA" });
    const obj = await s.read(ref.id);
    expect(obj?.data).toBe("PDFDATA");
    expect(obj?.ref.kind).toBe("document");
    const meta = await s.metadata(ref.id);
    expect(meta).toEqual(ref);
    expect((meta as unknown as { data?: string }).data).toBeUndefined();
  });

  it("unbekannte ID → undefined", async () => {
    const s = store();
    expect(await s.read("nope")).toBeUndefined();
    expect(await s.metadata("nope")).toBeUndefined();
  });

  it("leerer/zu großer/ungültiger Inhalt → INVALID", async () => {
    const s = store();
    await expect(s.put({ name: "x", mime: "image/png", data: "" })).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(s.put({ name: "", mime: "image/png", data: "x" })).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(
      s.put({ name: "big", mime: "image/png", data: "a".repeat(5_000_001) }),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("inferKind leitet Art aus MIME ab", () => {
    expect(inferKind("image/png")).toBe("image");
    expect(inferKind("application/pdf")).toBe("document");
    expect(inferKind("text/plain")).toBe("document");
    expect(inferKind("application/octet-stream")).toBe("binary");
  });
});
