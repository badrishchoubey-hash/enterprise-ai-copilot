import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getCloudinary } from "../config/cloudinary.js";

export interface TemporaryDocumentFile {
  filePath: string;
  sha256: string;
  byteLength: number;
  cleanup(): Promise<void>;
}

export async function streamToTemporaryDocumentFile(
  source: AsyncIterable<Uint8Array>,
  extension: string,
  maximumBytes: number,
): Promise<TemporaryDocumentFile> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexa-ingestion-"));
  const filePath = path.join(directory, `source.${extension}`);
  const hash = crypto.createHash("sha256");
  let byteLength = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteLength += chunk.length;
      if (byteLength > maximumBytes) {
        callback(new Error("The uploaded file exceeds the configured size limit."));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.from(source), meter, createWriteStream(filePath, { flags: "wx" }));
    return {
      filePath,
      sha256: hash.digest("hex"),
      byteLength,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function downloadCloudinaryAssetToTemporaryFile(
  publicId: string,
  extension: string,
  maximumBytes: number,
): Promise<TemporaryDocumentFile> {
  const url = getCloudinary().utils.private_download_url(publicId, extension, {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) {
    throw new Error("The stored file could not be downloaded.");
  }
  return streamToTemporaryDocumentFile(
    Readable.fromWeb(
      response.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
    ) as AsyncIterable<Uint8Array>,
    extension,
    maximumBytes,
  );
}
