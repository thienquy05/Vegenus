// Upload content check (security gate, Phase 2; design 7 §3 "type validation by content, not name"): the browser
// re-encodes every photo and video, and this confirms on the server that a stored file is what its type says. A photo
// must be a whole WebP or JPEG with a real frame header (Q148; no full pixel decode) and no EXIF, XMP or IPTC block; video and sound need only their
// container's signature, so only their first HEAD_BYTES are read. Some JPEG encoders (Safari's) write small Exif and
// IPTC blocks of their own, so the browser removes them first (stripJpegMeta) and the server refuses any left.
// shortcut: video and sound metadata inside the container stays the browser's guarantee (as Q138); parse their boxes
// if that guarantee is ever doubted.
export const HEAD_BYTES = 64;
export const readsWhole = (mime: string) => mime.startsWith("image/");

const text = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const le32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

// A frame the decoder can start on: a lossy key frame (start code 9d 01 2a) with a non-zero width and height, or a
// lossless frame (signature 2f). A full pixel decode is not done (Q148).
function frameOk(id: string, b: Uint8Array, at: number, size: number) {
  if (id === "VP8L") return size >= 5 && b[at] === 0x2f;
  return size >= 10 && (b[at] & 1) === 0 && b[at + 3] === 0x9d && b[at + 4] === 0x01 && b[at + 5] === 0x2a &&
    ((b[at + 6] | (b[at + 7] << 8)) & 0x3fff) > 0 && ((b[at + 8] | (b[at + 9] << 8)) & 0x3fff) > 0;
}

function webpOk(b: Uint8Array) {
  if (b.length < 20 || text(b, 0, 4) !== "RIFF" || text(b, 8, 4) !== "WEBP") return false;
  const end = 8 + le32(b, 4);
  if (end !== b.length) return false;
  let at = 12;
  let frame = false;
  while (at < end) {
    if (at + 8 > end) return false;
    const id = text(b, at, 4);
    const size = le32(b, at + 4);
    if (at + 8 + size > end) return false;
    if (at === 12 && !["VP8 ", "VP8L", "VP8X"].includes(id)) return false;
    if (id === "EXIF" || id === "XMP ") return false;
    if (id === "VP8 " || id === "VP8L") {
      if (!frameOk(id, b, at + 8, size)) return false;
      frame = true;
    }
    at += 8 + size + (size & 1);
  }
  return frame && at === end;
}

const SOF = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc; // frame headers

// Walks the segments before the image data: a frame header with a non-zero size must come before the first scan, the
// scan header must be whole, some image data must follow, and the file must end with its end marker.
function jpegOk(b: Uint8Array) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return false;
  let at = 2;
  let frame = false;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return false;
    const marker = b[at + 1];
    if (marker === 0xff) { at += 1; continue; } // fill byte
    const length = (b[at + 2] << 8) | b[at + 3];
    if (length < 2 || at + 2 + length > b.length) return false;
    if (marker === 0xda) {
      const parts = b[at + 4];
      const data = at + 2 + length;
      return frame && parts >= 1 && length === 6 + 2 * parts && data < b.length - 2 &&
        b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
    }
    if (marker === 0xe1 || marker === 0xed) return false; // APP1 (Exif, XMP) and APP13 (IPTC)
    if (SOF(marker)) {
      if (length < 8 || ((b[at + 5] << 8) | b[at + 6]) === 0 || ((b[at + 7] << 8) | b[at + 8]) === 0 || b[at + 9] < 1) return false;
      frame = true;
    }
    at += 2 + length;
  }
  return false;
}

// Removes the APP1 and APP13 blocks before the image data and keeps every other byte; anything that is not a JPEG it
// can walk comes back unchanged (the server check then decides).
export function stripJpegMeta(b: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (b[0] !== 0xff || b[1] !== 0xd8) return b;
  const kept: Uint8Array[] = [b.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= b.length && b[at] === 0xff && b[at + 1] !== 0xda) {
    const length = (b[at + 2] << 8) | b[at + 3];
    if (length < 2 || at + 2 + length > b.length) return b;
    if (b[at + 1] !== 0xe1 && b[at + 1] !== 0xed) kept.push(b.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  if (b[at] !== 0xff || b[at + 1] !== 0xda) return b;
  kept.push(b.subarray(at));
  const out = new Uint8Array(kept.reduce((n, k) => n + k.length, 0));
  kept.reduce((o, k) => (out.set(k, o), o + k.length), 0);
  return out;
}

export function contentOk(mime: string, b: Uint8Array) {
  switch (mime) {
    case "image/webp": return webpOk(b);
    case "image/jpeg": return jpegOk(b);
    case "video/mp4": case "audio/mp4": return b.length >= 12 && text(b, 4, 4) === "ftyp";
    case "video/webm": case "audio/webm": return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    default: return false;
  }
}
