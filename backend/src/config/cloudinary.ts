import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../middleware/appError.js";

let configured = false;

export function getCloudinary() {
  if (configured) return cloudinary;
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) {
    throw new AppError(
      503,
      "Cloudinary document storage is not configured.",
      "CLOUDINARY_UNAVAILABLE",
    );
  }

  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.protocol !== "cloudinary:" ||
      !parsed.username ||
      !parsed.password ||
      !parsed.hostname
    ) {
      throw new Error("Invalid Cloudinary URL");
    }
    cloudinary.config({
      cloud_name: parsed.hostname,
      api_key: decodeURIComponent(parsed.username),
      api_secret: decodeURIComponent(parsed.password),
      secure: true,
    });
    configured = true;
    return cloudinary;
  } catch {
    throw new AppError(
      503,
      "Cloudinary document storage is not configured correctly.",
      "CLOUDINARY_UNAVAILABLE",
    );
  }
}

const cloudinarySingleUploadLimit = 100 * 1024 * 1024;
// Cloudinary Free accounts allow raw files up to 10 MiB. Raise this setting
// only after the Cloudinary account's raw-file allowance has been increased.
const cloudinaryFreeRawLimit = 10 * 1024 * 1024;
export function getMaxDocumentSizeBytes(): number {
  const configuredLimit = Number(process.env.MAX_FILE_SIZE_BYTES);
  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, cloudinarySingleUploadLimit)
    : cloudinaryFreeRawLimit;
}
