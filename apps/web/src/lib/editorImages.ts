// SCRUM-321: Bild-Anhänge für den RichTextEditor abbilden, ohne Upload-/Object-Store-Architektur zu ändern.
// KO-Detail nutzt Object-Store-IDs; Capture kann vor dem Speichern sichere lokale data:image-Thumbnails anbieten.

export interface LocalEditorImageInput {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
}

export interface EditorImageRef {
  src: string;
  name: string;
}

function isSafeRasterDataUrl(value: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value.trim());
}

export function editorImagesFromLocalImages(
  images: readonly LocalEditorImageInput[],
): EditorImageRef[] {
  return images
    .filter((img) => img.mime.startsWith("image/") && isSafeRasterDataUrl(img.dataUrl))
    .map((img) => ({ src: img.dataUrl, name: img.name }));
}
