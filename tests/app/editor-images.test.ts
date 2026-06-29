import { describe, expect, it } from "vitest";
import { editorImagesFromLocalImages } from "../../apps/web/src/lib/editorImages";

describe("SCRUM-321: editor image mapping", () => {
  it("maps safe local raster image attachments to RichTextEditor images", () => {
    expect(
      editorImagesFromLocalImages([
        {
          id: "img-1",
          name: "Pumpe.jpg",
          mime: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,AAAA",
        },
      ]),
    ).toEqual([{ src: "data:image/jpeg;base64,AAAA", name: "Pumpe.jpg" }]);
  });

  it("does not offer documents or unsafe image data as inline editor images", () => {
    expect(
      editorImagesFromLocalImages([
        {
          id: "doc-1",
          name: "Handbuch.pdf",
          mime: "application/pdf",
          dataUrl: "data:application/pdf;base64,AAAA",
        },
        {
          id: "svg-1",
          name: "unsafe.svg",
          mime: "image/svg+xml",
          dataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
        },
      ]),
    ).toEqual([]);
  });
});
