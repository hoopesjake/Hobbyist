import { bookCover } from "./open-library-transport";

export type CoverSearchRecord = { key: string; editions?: { docs?: { key?: string; language?: string[]; cover_i?: number }[] } };

export function englishEditionCover(record: CoverSearchRecord): string | null {
  // A work's cover_i can belong to any translation. Only edition metadata
  // establishes the language of the actual cover we are about to display.
  for (const edition of record.editions?.docs || []) {
    if (edition.language?.includes("eng")) {
      const cover = bookCover(edition.cover_i);
      if (cover) return cover;
    }
  }
  return null;
}
