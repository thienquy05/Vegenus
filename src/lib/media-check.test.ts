import { expect, test } from "vitest";
import { contentOk, stripJpegMeta } from "./media-check";

// Security gate, Phase 2 (Codex review): upload Complete checks each stored file by its bytes, never by the type the
// browser declared (design 7 §3 "type validation by content"), and refuses a photo that still carries EXIF, XMP or
// IPTC metadata. Synthetic bytes only.
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const chunk = (id: string, size: number) => [...ascii(id), ...le32(size), ...new Array(size + (size & 1)).fill(0)];
const webp = (...chunks: number[][]) => {
  const body = [...ascii("WEBP"), ...chunks.flat()];
  return new Uint8Array([...ascii("RIFF"), ...le32(body.length), ...body]);
};
const seg = (marker: number, size: number) => [0xff, marker, (size + 2) >> 8, (size + 2) & 255, ...new Array(size).fill(0)];
const jpeg = (...segs: number[][]) => new Uint8Array([0xff, 0xd8, ...segs.flat(), 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
// An APP1 Exif segment as an encoder writes it: "Exif\0\0", a TIFF header and IFD0 with the given tags.
const exif = (tags: number[], big = true) => {
  const u16 = (n: number) => (big ? [n >> 8, n & 255] : [n & 255, n >> 8]);
  const u32 = (n: number) => (big ? [0, 0, n >> 8, n & 255] : [n & 255, n >> 8, 0, 0]);
  const tiff = [...(big ? ascii("MM") : ascii("II")), ...u16(42), ...u32(8), ...u16(tags.length),
    ...tags.flatMap((tag) => [...u16(tag), ...u16(4), ...u32(1), ...u32(0)]), ...u32(0)];
  const data = [...ascii("Exif"), 0, 0, ...tiff];
  return [0xff, 0xe1, (data.length + 2) >> 8, (data.length + 2) & 255, ...data];
};
const xmp = () => {
  const data = ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>");
  return [0xff, 0xe1, (data.length + 2) >> 8, (data.length + 2) & 255, ...data];
};
const head = (...bytes: number[]) => new Uint8Array([...bytes, ...new Array(64).fill(0)].slice(0, 64));
const MP4 = head(0, 0, 0, 24, ...ascii("ftypisom"));
const WEBM = head(0x1a, 0x45, 0xdf, 0xa3, 0x9f);

test("a WebP or JPEG as the browser makes it passes", () => {
  expect(contentOk("image/webp", webp(chunk("VP8 ", 10)))).toBe(true);
  expect(contentOk("image/webp", webp(chunk("VP8X", 10), chunk("VP8L", 5)))).toBe(true);
  expect(contentOk("image/jpeg", jpeg(seg(0xe0, 14), seg(0xdb, 67), seg(0xc0, 15)))).toBe(true);
});

test("a photo that still carries EXIF, XMP or IPTC metadata is refused", () => {
  expect(contentOk("image/webp", webp(chunk("VP8X", 10), chunk("VP8 ", 10), chunk("EXIF", 8)))).toBe(false);
  expect(contentOk("image/webp", webp(chunk("VP8X", 10), chunk("VP8 ", 10), chunk("XMP ", 8)))).toBe(false);
  expect(contentOk("image/jpeg", jpeg(seg(0xe0, 14), seg(0xe1, 20)))).toBe(false);
  expect(contentOk("image/jpeg", jpeg(seg(0xed, 20)))).toBe(false);
});

test("any Exif, XMP or IPTC block is refused, even an encoder's own small one", () => {
  expect(contentOk("image/jpeg", jpeg(seg(0xe0, 14), exif([0x8769])))).toBe(false); // only the Exif pointer, as Safari may write
  expect(contentOk("image/jpeg", jpeg(exif([0x0112, 0x8825], false)))).toBe(false); // the GPS block
  expect(contentOk("image/jpeg", jpeg(xmp()))).toBe(false);
});

test("the browser removes its encoder's Exif and IPTC blocks before upload, so the file passes", () => {
  const encoded = jpeg(seg(0xe0, 14), exif([0x8769]), seg(0xed, 30), seg(0xdb, 67));
  const clean = stripJpegMeta(encoded);
  expect(contentOk("image/jpeg", clean)).toBe(true);
  expect([...clean]).toEqual([...jpeg(seg(0xe0, 14), seg(0xdb, 67))]); // everything else kept, byte for byte
  const notJpeg = webp(chunk("VP8 ", 10));
  expect(stripJpegMeta(notJpeg)).toBe(notJpeg);
});

test("bytes that are not the declared type, or are cut short, are refused", () => {
  expect(contentOk("image/webp", new Uint8Array(5000))).toBe(false);
  expect(contentOk("image/jpeg", new Uint8Array(5000))).toBe(false);
  expect(contentOk("image/webp", jpeg(seg(0xe0, 14)))).toBe(false);
  expect(contentOk("image/jpeg", webp(chunk("VP8 ", 10)))).toBe(false);
  expect(contentOk("image/webp", webp(chunk("ICCP", 4)))).toBe(false); // no image chunk first
  expect(contentOk("image/webp", webp(chunk("VP8 ", 10)).slice(0, 25))).toBe(false);
  expect(contentOk("image/webp", new Uint8Array([...webp(chunk("VP8 ", 10)), 0, 0, 0, 0]))).toBe(false); // bytes after the file
  expect(contentOk("image/jpeg", jpeg(seg(0xe0, 14)).slice(0, 12))).toBe(false); // no image data reached
});

test("video and sound need their container's signature", () => {
  for (const mime of ["video/mp4", "audio/mp4"]) expect(contentOk(mime, MP4)).toBe(true);
  for (const mime of ["video/webm", "audio/webm"]) expect(contentOk(mime, WEBM)).toBe(true);
  expect(contentOk("video/mp4", WEBM)).toBe(false);
  expect(contentOk("audio/webm", MP4)).toBe(false);
  expect(contentOk("video/mp4", new Uint8Array(64))).toBe(false);
});

test("a type outside the buckets' list is refused", () => {
  expect(contentOk("image/png", webp(chunk("VP8 ", 10)))).toBe(false);
  expect(contentOk("", MP4)).toBe(false);
});
