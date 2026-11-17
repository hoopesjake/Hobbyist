export const activityPhotoBucket = "activity-photos";
export const maxActivityPhotos = 6;
export const maxActivityPhotoBytes = 8 * 1024 * 1024;
export type ActivityPhoto = { id: string; entry_id: string; created_at: string; state?: "pending" | "ready"; caption?: string };
export function activityPhotoType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}
