import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeVideo,
  CanvasSink,
  Conversion,
  Input,
  type InputTrack,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
} from "mediabunny";

// Browser-side processing before upload (T2.3b). Only these outputs are stored: re-encoding drops EXIF, location and
// every other tag of the original (FR7, E7). Keys match the upload variants (owner_upload_begin).
// Sizes (owner, 2026-11-11): photo thumb 480 px and display 2048 px long side (Q66), no full copy; video 720p (Q27).
const THUMB_PX = 480;
const DISPLAY_PX = 2048;
const VIDEO_PX = 1280;
// Bucket limits (the media migration's storage.buckets rows): a file over them would be refused at upload, so it is made to fit here.
const THUMB_BYTES = 307200;
const DISPLAY_BYTES = 2097152; // display and poster
const VIDEO_MAX_BYTES = 52428800; // Q27

export class MediaError extends Error {
  constructor(message: "unsupported" | "too_large", options?: ErrorOptions) {
    super(message, options);
  }
}

type Image = { blob: Blob; width: number; height: number };
async function image(source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas, longSide: number, maxBytes: number): Promise<Image> {
  const side = Math.min(longSide, Math.max(source.width, source.height)); // never enlarged
  const scale = side / Math.max(source.width, source.height);
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.6, 0.4]) {
    const webp = await canvas.convertToBlob({ type: "image/webp", quality });
    // A browser without a WebP encoder (Safari) returns PNG instead; the buckets take WebP or JPEG.
    const blob = webp.type === "image/webp" ? webp : await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (blob.size <= maxBytes) return { blob, width: canvas.width, height: canvas.height };
  }
  // A very detailed image is still too big at low quality: fewer pixels (Codex).
  if (side <= 256) throw new MediaError("too_large");
  return image(source, Math.round(side * 0.75), maxBytes);
}

// width and height are the display file's, sent with Complete (O6).
export async function processPhoto(file: Blob): Promise<{ thumb: Blob; display: Blob; width: number; height: number }> {
  // Decoding by content, not name: HEIC where the browser cannot decode it, corrupt files and non-images fail here (E8).
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const display = await image(bitmap, DISPLAY_PX, DISPLAY_BYTES);
    return { thumb: (await image(bitmap, THUMB_PX, THUMB_BYTES)).blob, display: display.blob, width: display.width, height: display.height };
  } catch (e) {
    // Drawing or encoding can fail too (a phone out of memory on a huge image), or the browser lacks the decoder:
    // same clear answer (E8, Codex).
    throw e instanceof MediaError ? e : new MediaError("unsupported", { cause: e });
  } finally {
    bitmap?.close();
  }
}

// width, height and duration_ms are the stored clip's, sent with Complete (O6). Aborting the signal (O6 Cancel) stops
// the conversion and rejects with the signal's reason.
export async function processVideo(file: Blob, signal?: AbortSignal): Promise<{ thumb: Blob; poster: Blob; video: Blob; width: number; height: number; duration_ms: number }> {
  if (typeof VideoEncoder === "undefined") throw new MediaError("unsupported"); // no WebCodecs (Q133)
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new MediaError("unsupported");
    const audio = await input.getPrimaryAudioTrack();

    const frame = await new CanvasSink(track).getCanvas(await track.getFirstTimestamp());
    if (!frame) throw new MediaError("unsupported");
    const poster = (await image(frame.canvas, DISPLAY_PX, DISPLAY_BYTES)).blob;
    const thumb = (await image(frame.canvas, THUMB_PX, THUMB_BYTES)).blob;

    const scale = Math.min(1, VIDEO_PX / Math.max(track.displayWidth, track.displayHeight));
    const even = (n: number) => 2 * Math.ceil(Math.round(n) / 2); // as mediabunny sizes the output; H.264 needs even sides
    const [width, height] = [even(track.displayWidth * scale), even(track.displayHeight * scale)];
    // H.264 plays in every guest browser; a phone that cannot encode it gets a message, not an unplayable file.
    if (!(await canEncodeVideo("avc", { width, height, quality: QUALITY_MEDIUM }))) throw new MediaError("unsupported");
    const resize = scale < 1 ? (height > width ? { height } : { width }) : {};
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    // The conversion copies each track's free-text name, with no option to drop it (mediabunny 1.62.1, Codex).
    const addVideo = output.addVideoTrack.bind(output);
    const addAudio = output.addAudioTrack.bind(output);
    output.addVideoTrack = (source, metadata) => addVideo(source, { ...metadata, name: undefined });
    output.addAudioTrack = (source, metadata) => addAudio(source, { ...metadata, name: undefined });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      tags: {}, // drops every container tag, location included; track names above
      video: { ...resize, codec: "avc", quality: QUALITY_MEDIUM },
      // AAC plays in every guest browser: phone AAC is copied, other sound is converted, or refused below (Codex).
      audio: { codec: "aac" },
    });
    const stop = () => void conversion.cancel();
    signal?.addEventListener("abort", stop, { once: true });
    if (signal?.aborted) stop();
    // Refuse rather than store a clip that silently lost its sound (Codex).
    if (!conversion.utilizedTracks.includes(track) || (audio && !conversion.utilizedTracks.includes(audio))) {
      throw new MediaError("unsupported");
    }
    await conversion.execute();
    signal?.throwIfAborted();

    const video = new Blob([output.target.buffer!], { type: "video/mp4" });
    // A damaged file can end early without any error: refuse it if picture or sound its index promises is missing
    // (E8, Codex). Copied sound is not decoded, so damaged bytes inside a complete track are not detected.
    const result = new Input({ formats: ALL_FORMATS, source: new BlobSource(video) });
    const length = async (t: InputTrack | null) => (t ? (await t.computeDuration()) - (await t.getFirstTimestamp()) : 0);
    const seconds = await length(await result.getPrimaryVideoTrack());
    const short =
      seconds < (await length(track)) - 0.1 ||
      (await length(await result.getPrimaryAudioTrack())) < (await length(audio)) - 0.1;
    result.dispose();
    if (short) throw new MediaError("unsupported");
    if (video.size > VIDEO_MAX_BYTES) throw new MediaError("too_large"); // owner, 2026-11-11: refuse, ask to trim
    return { thumb, poster, video, width, height, duration_ms: Math.max(1, Math.round(seconds * 1000)) };
  } catch (e) {
    if (signal?.aborted) throw signal.reason;
    // Parsing and decoding failures anywhere in the file are the same answer to the owner: this video cannot be used.
    throw e instanceof MediaError ? e : new MediaError("unsupported", { cause: e });
  } finally {
    input.dispose();
  }
}
