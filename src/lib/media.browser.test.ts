import {
  ALL_FORMATS,
  canEncodeAudio,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  Input,
  MovOutputFormat,
  Output,
} from "mediabunny";
import { expect, test } from "vitest";
import { MediaError, processPhoto, processVideo } from "./media";

const has = async (blob: Blob, text: string) => new TextDecoder("latin1").decode(await blob.arrayBuffer()).includes(text);
const size = async (blob: Blob) => {
  const b = await createImageBitmap(blob, { imageOrientation: "none" });
  return [b.width, b.height];
};

// A camera-style JPEG: EXIF with Orientation 6 (rotate 90° clockwise) and a GPS block carrying a marker string.
async function cameraJpeg(width: number, height: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c33";
  ctx.fillRect(0, 0, width, height);
  const jpeg = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg" })).arrayBuffer());

  const tiff = new Uint8Array(66); // zero-filled: the marker string below ends with a 0 byte
  const v = new DataView(tiff.buffer);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    v.setUint16(at, tag, true);
    v.setUint16(at + 2, type, true);
    v.setUint32(at + 4, count, true);
    if (type === 3) v.setUint16(at + 8, value, true);
    else v.setUint32(at + 8, value, true);
  };
  tiff.set([0x49, 0x49, 0x2a, 0], 0);
  v.setUint32(4, 8, true); // IFD0 at 8
  v.setUint16(8, 2, true);
  entry(10, 0x0112, 3, 1, 6); // Orientation
  entry(22, 0x8825, 4, 1, 38); // GPS IFD at 38
  v.setUint16(38, 1, true);
  entry(40, 0x0012, 2, 10, 56); // GPSMapDatum, ASCII at 56
  tiff.set(new TextEncoder().encode("SECRETGPS"), 56);

  const app1 = new Uint8Array([0xff, 0xe1, 0, 2 + 6 + tiff.length, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
  return new Blob([jpeg.slice(0, 2), app1, jpeg.slice(2)], { type: "image/jpeg" });
}

test("photo: orientation applied, EXIF and location dropped, thumb 480 and display 2048 (E7, Q66)", async () => {
  const source = await cameraJpeg(3000, 1500);
  expect(await has(source, "SECRETGPS")).toBe(true);

  const { thumb, display } = await processPhoto(source);
  for (const out of [thumb, display]) {
    expect(out.type).toBe("image/webp");
    expect(await has(out, "SECRETGPS")).toBe(false);
    expect(await has(out, "Exif")).toBe(false);
  }
  // Pixels are turned upright (the stored file needs no orientation tag), long side scaled down.
  expect(await size(display)).toEqual([1024, 2048]);
  expect(await size(thumb)).toEqual([240, 480]);
});

test("photo: a small image is not enlarged", async () => {
  const { display } = await processPhoto(await cameraJpeg(400, 300));
  expect(await size(display)).toEqual([300, 400]);
});

test("photo: a very detailed image still fits its storage class (Codex)", async () => {
  const canvas = new OffscreenCanvas(2048, 2048);
  const ctx = canvas.getContext("2d")!;
  const noise = ctx.createImageData(2048, 2048);
  for (let i = 0; i < noise.data.length; i++) noise.data[i] = Math.random() * 256;
  ctx.putImageData(noise, 0, 0);
  const { thumb, display } = await processPhoto(await canvas.convertToBlob({ type: "image/png" }));
  expect(display.size).toBeLessThanOrEqual(2097152); // media-display bucket
  expect(thumb.size).toBeLessThanOrEqual(307200); // media-thumb bucket
});

test("photo: corrupt or unsupported bytes are refused with a clear error (E8)", async () => {
  const junk = new Blob([new Uint8Array(1000).fill(7)], { type: "image/jpeg" });
  await expect(processPhoto(junk)).rejects.toThrow(new MediaError("unsupported"));
});

test("photo: a browser without the image decoder gets the clear error (Codex)", async () => {
  const source = await cameraJpeg(400, 300);
  const real = globalThis.createImageBitmap;
  Reflect.deleteProperty(globalThis, "createImageBitmap");
  try {
    await expect(processPhoto(source)).rejects.toThrow(new MediaError("unsupported"));
  } finally {
    globalThis.createImageBitmap = real;
  }
});

test("photo: a failure after decoding (a phone out of memory) still gives the clear error (Codex)", async () => {
  const source = await cameraJpeg(400, 300);
  const real = OffscreenCanvas.prototype.convertToBlob;
  OffscreenCanvas.prototype.convertToBlob = () => Promise.reject(new DOMException("out of memory"));
  try {
    await expect(processPhoto(source)).rejects.toThrow(new MediaError("unsupported"));
  } finally {
    OffscreenCanvas.prototype.convertToBlob = real;
  }
});

// A 1 s clip with a title tag, made in the browser. A fixed bitrate keeps it out of mediabunny's memo of the quality
// checks that processVideo makes (canEncodeVideo), so the H.264 test below sees its stub.
// MOV, as phones record; optional silent sound in the given codec (1 s unless given). Tracks carry a free-text name.
async function phoneClip(width = 1920, height = 1080, audio?: "aac" | "pcm-s16" | "ulaw", audioSeconds = 1): Promise<Blob> {
  const output = new Output({ format: new MovOutputFormat(), target: new BufferTarget() });
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const source = new CanvasSource(canvas, { codec: "avc", bitrate: 2e6 });
  output.addVideoTrack(source, { frameRate: 10, name: "SECRETTRACK" });
  const sound = audio === "aac" ? new EncodedAudioPacketSource("aac") : audio && new AudioSampleSource({ codec: audio });
  if (sound) output.addAudioTrack(sound, { name: "SECRETTRACK" });
  output.setMetadataTags({ title: "SECRETPLACE" });
  await output.start();
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `hsl(${i * 36} 70% 50%)`;
    ctx.fillRect(0, 0, width, height);
    await source.add(i / 10, 1 / 10);
  }
  if (sound instanceof EncodedAudioPacketSource) {
    // Ready-made silent AAC-LC frames (44.1 kHz mono, 1024 samples each), as phones record: this browser cannot encode AAC.
    const frame = new Uint8Array([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]);
    // AudioSpecificConfig 0x12 0x08: object type 2 (LC), 44.1 kHz, mono.
    const decoderConfig = { codec: "mp4a.40.2", numberOfChannels: 1, sampleRate: 44100, description: new Uint8Array([0x12, 0x08]) };
    for (let i = 0; i * 1024 < 44100 * audioSeconds; i++) {
      await sound.add(new EncodedPacket(frame, "key", (i * 1024) / 44100, 1024 / 44100), i === 0 ? { decoderConfig } : undefined);
    }
  } else if (sound) {
    await sound.add(new AudioSample({ data: new Float32Array(48000 * audioSeconds), format: "f32", numberOfChannels: 1, sampleRate: 48000, timestamp: 0 }));
  }
  await output.finalize();
  return new Blob([output.target.buffer!], { type: "video/quicktime" });
}

test("video: 720p MP4 without metadata, poster and thumb from the first frame (Q27, Q133)", async () => {
  const clip = await phoneClip();
  expect(await has(clip, "SECRETTRACK")).toBe(true);
  const { video, poster, thumb } = await processVideo(clip);

  expect(video.type).toBe("video/mp4");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(video) });
  const track = (await input.getPrimaryVideoTrack())!;
  expect([track.displayWidth, track.displayHeight]).toEqual([1280, 720]);
  expect(track.codec).toBe("avc"); // H.264 plays in every guest browser
  expect((await input.getMetadataTags()).title).toBeUndefined();
  expect(await has(video, "SECRETPLACE")).toBe(false);
  expect(await has(video, "SECRETTRACK")).toBe(false); // track names are metadata too (Codex)

  expect(poster.type).toBe("image/webp");
  expect(await size(poster)).toEqual([1920, 1080]);
  expect(await size(thumb)).toEqual([480, 270]);
});

test("video: corrupt bytes are refused with a clear error (E8)", async () => {
  const junk = new Blob([new Uint8Array(1000).fill(7)], { type: "video/mp4" });
  await expect(processVideo(junk)).rejects.toThrow(new MediaError("unsupported"));
});

test("video: a phone that cannot encode H.264 gets a clear error, not a file some guests cannot play", async () => {
  const clip = await phoneClip(640, 360); // a size no other test encodes: mediabunny memoizes each check
  const real = VideoEncoder.isConfigSupported;
  VideoEncoder.isConfigSupported = async (config) =>
    config.codec.startsWith("avc") ? { supported: false, config } : real.call(VideoEncoder, config);
  try {
    await expect(processVideo(clip)).rejects.toThrow(new MediaError("unsupported"));
  } finally {
    VideoEncoder.isConfigSupported = real;
  }
});

test("video: an unusual aspect ratio is sized to even sides, as H.264 needs, not refused", async () => {
  const { video } = await processVideo(await phoneClip(1920, 886));
  const track = (await new Input({ formats: ALL_FORMATS, source: new BlobSource(video) }).getPrimaryVideoTrack())!;
  expect([track.displayWidth, track.displayHeight]).toEqual([1280, 592]);
});

test("video: AAC sound from the phone is kept as it is, without its track name", async () => {
  const { video } = await processVideo(await phoneClip(1920, 1080, "aac"));
  const sound = await new Input({ formats: ALL_FORMATS, source: new BlobSource(video) }).getPrimaryAudioTrack();
  expect(await sound?.getCodecParameterString()).toBe("mp4a.40.2"); // copied: this browser cannot encode AAC
  expect(await has(video, "SECRETTRACK")).toBe(false);
});

test("video: other sound is converted to AAC, which every guest browser plays, or refused (Codex)", async () => {
  const clip = await phoneClip(1920, 1080, "pcm-s16"); // MP4 could hold this as it is, but not every browser plays it
  if (await canEncodeAudio("aac")) {
    const { video } = await processVideo(clip);
    const sound = await new Input({ formats: ALL_FORMATS, source: new BlobSource(video) }).getPrimaryAudioTrack();
    expect(sound?.codec).toBe("aac");
  } else {
    await expect(processVideo(clip)).rejects.toThrow(new MediaError("unsupported"));
  }
});

test("video: an AAC profile some browsers cannot play is refused, never copied (Codex)", async () => {
  // mediabunny cannot write AAC Main, so the clip is made as AAC-LC and its AudioSpecificConfig (inside the esds box)
  // is patched to object type 1 (Main). The MP4 writer accepts only LC, HE-AAC (v1, v2) and MPEG-2 LC, so a copy of
  // any other profile fails there; this keeps that guarantee if mediabunny changes.
  const bytes = new Uint8Array(await (await phoneClip(1920, 1080, "aac")).arrayBuffer());
  const esds = new TextDecoder("latin1").decode(bytes).indexOf("esds");
  const at = bytes.findIndex((b, i) => i > esds && b === 0x12 && bytes[i + 1] === 0x08);
  bytes.set([0x0a, 0x08], at);
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(new Blob([bytes])) });
  expect(await (await input.getPrimaryAudioTrack())?.getCodecParameterString()).toBe("mp4a.40.1");
  await expect(processVideo(new Blob([bytes]))).rejects.toThrow(new MediaError("unsupported"));
});

test("video: sound that cannot be converted is refused, never dropped silently (Codex)", async () => {
  const clip = await phoneClip(1920, 1080, "ulaw"); // MP4 cannot hold this codec, so it must be re-encoded
  const real = AudioEncoder.isConfigSupported;
  AudioEncoder.isConfigSupported = async (config) => ({ supported: false, config });
  try {
    await expect(processVideo(clip)).rejects.toThrow(new MediaError("unsupported"));
  } finally {
    AudioEncoder.isConfigSupported = real;
  }
});

test("video: a file damaged after its first frame is refused with a clear error (E8, Codex)", async () => {
  const clip = await phoneClip();
  await expect(processVideo(clip.slice(0, clip.size * 0.6))).rejects.toThrow(new MediaError("unsupported"));
});

test("video: a file whose sound is cut off is refused, even when the picture is whole (Codex)", async () => {
  // 1 s of picture and 4 s of AAC sound: the last 100 bytes of this file are sound only (checked with mediabunny
  // 1.62.1: the cut file keeps all 10 frames and 156 of 173 sound packets).
  const clip = await phoneClip(1920, 1080, "aac", 4);
  await expect(processVideo(clip.slice(0, clip.size - 100))).rejects.toThrow(new MediaError("unsupported"));
});
