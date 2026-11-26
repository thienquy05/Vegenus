import { expect, test } from "vitest";
import { contentOk, stripJpegMeta } from "./media-check";

// Security gate, Phase 2 (Codex reviews): upload Complete checks each stored file by its bytes, never by the type the
// browser declared (design 7 §3 "type validation by content"): a photo needs a real frame header with a size and,
// for JPEG, a scan and an end marker, and must carry no Exif, XMP or IPTC block. Synthetic bytes only.
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const raw = (id: string, data: number[]) => [...ascii(id), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
const chunk = (id: string, size: number) => raw(id, new Array(size).fill(0));
// A lossy key frame of w x h (frame tag, start code 9d 01 2a, 14-bit sizes), a lossless frame (signature 2f), and the
// extended header a browser writes when the image has alpha.
const vp8 = (w = 4, h = 3) => raw("VP8 ", [0x50, 0x01, 0x00, 0x9d, 0x01, 0x2a, w & 255, w >> 8, h & 255, h >> 8, 0, 0]);
const vp8l = () => raw("VP8L", [0x2f, 0x03, 0x80, 0x00, 0x00, 0, 0, 0]);
const vp8x = () => raw("VP8X", [0x10, 0, 0, 0, 3, 0, 0, 2, 0, 0]);
const webp = (...chunks: number[][]) => {
  const body = [...ascii("WEBP"), ...chunks.flat()];
  return new Uint8Array([...ascii("RIFF"), ...le32(body.length), ...body]);
};
const seg = (marker: number, size: number) => [0xff, marker, (size + 2) >> 8, (size + 2) & 255, ...new Array(size).fill(0)];
const sof = (w = 4, h = 3) => [0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0];
const SOS = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0];
const EOI = [0xff, 0xd9];
const jpeg = (...segs: number[][]) => new Uint8Array([0xff, 0xd8, ...segs.flat(), ...sof(), ...SOS, 1, 2, 3, ...EOI]);
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
  expect(contentOk("image/webp", webp(vp8()))).toBe(true);
  expect(contentOk("image/webp", webp(vp8l()))).toBe(true);
  expect(contentOk("image/webp", webp(vp8x(), chunk("ALPH", 3), vp8()))).toBe(true);
  expect(contentOk("image/jpeg", jpeg(seg(0xe0, 14), seg(0xdb, 67), seg(0xc4, 30)))).toBe(true);
  expect(contentOk("image/jpeg", jpeg([0xff], seg(0xe0, 14)))).toBe(true); // a fill byte before a marker
  const progressive = sof().map((v, i) => (i === 1 ? 0xc2 : v));
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...progressive, ...SOS, 1, 2, 3, ...EOI]))).toBe(true);
});

test("a photo with no image in it is refused (Codex re-review)", () => {
  expect(contentOk("image/webp", webp(chunk("VP8 ", 10)))).toBe(false); // empty frame: no start code
  expect(contentOk("image/webp", webp(raw("VP8 ", [0x50, 0x01, 0x00, 0x9d, 0x01, 0x2a])))).toBe(false); // no size
  expect(contentOk("image/webp", webp(vp8(0, 3)))).toBe(false);
  expect(contentOk("image/webp", webp(chunk("VP8L", 8)))).toBe(false); // no lossless signature
  expect(contentOk("image/webp", webp(vp8x()))).toBe(false); // the extended header alone
  expect(contentOk("image/webp", webp(vp8x(), chunk("ALPH", 3)))).toBe(false);
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...SOS, 1, 2, 3, ...EOI]))).toBe(false); // no frame header
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...sof(0, 3), ...SOS, 1, 2, 3, ...EOI]))).toBe(false);
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...sof(), ...SOS]))).toBe(false); // cut at its first scan
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...sof(), ...SOS, 1, 2, 3]))).toBe(false); // no end marker
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...sof(), ...SOS, ...EOI]))).toBe(false); // no image data
  expect(contentOk("image/jpeg", new Uint8Array([0xff, 0xd8, ...sof(), 0xff, 0xda, 0, 2, 1, 2, 3, ...EOI]))).toBe(false); // empty scan header
});

test("a photo that still carries EXIF, XMP or IPTC metadata is refused", () => {
  expect(contentOk("image/webp", webp(vp8x(), vp8(), chunk("EXIF", 8)))).toBe(false);
  expect(contentOk("image/webp", webp(vp8x(), vp8(), chunk("XMP ", 8)))).toBe(false);
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
  const notJpeg = webp(vp8());
  expect(stripJpegMeta(notJpeg)).toBe(notJpeg);
});

test("bytes that are not the declared type, or are cut short, are refused", () => {
  expect(contentOk("image/webp", new Uint8Array(5000))).toBe(false);
  expect(contentOk("image/jpeg", new Uint8Array(5000))).toBe(false);
  expect(contentOk("image/webp", jpeg(seg(0xe0, 14)))).toBe(false);
  expect(contentOk("image/jpeg", webp(vp8()))).toBe(false);
  expect(contentOk("image/webp", webp(chunk("ICCP", 4), vp8()))).toBe(false); // no image chunk first
  expect(contentOk("image/webp", webp(vp8()).slice(0, 25))).toBe(false);
  expect(contentOk("image/webp", new Uint8Array([...webp(vp8()), 0, 0, 0, 0]))).toBe(false); // bytes after the file
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
  expect(contentOk("image/png", webp(vp8()))).toBe(false);
  expect(contentOk("", MP4)).toBe(false);
});
