export type ProcurementNoteData = {
  quantity: string | null;
  reason: string | null;
  publishLinks: string[];
  note: string | null;
};

export function parseProcurementNote(value: string | null | undefined): ProcurementNoteData {
  const lines = (value ?? "").split(/\r?\n/);
  let quantity: string | null = null;
  let reason: string | null = null;
  const publishLinks: string[] = [];
  const noteLines: string[] = [];
  let readingLinks = false;
  let readingNote = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("采买数量：")) {
      quantity = trimmed.slice("采买数量：".length).trim() || null;
      readingLinks = false;
      readingNote = false;
    } else if (trimmed.startsWith("需求理由：")) {
      reason = trimmed.slice("需求理由：".length).trim() || null;
      readingLinks = false;
      readingNote = false;
    } else if (trimmed === "发布链接：") {
      readingLinks = true;
      readingNote = false;
    } else if (trimmed.startsWith("备注：")) {
      noteLines.push(trimmed.slice("备注：".length).trim());
      readingLinks = false;
      readingNote = true;
    } else if (readingLinks) {
      const match = /^\d+\.\s*(.+)$/.exec(trimmed);
      if (match) publishLinks.push(match[1]);
      else if (trimmed) readingLinks = false;
    } else if (readingNote) {
      noteLines.push(line);
    }
  }

  const note = noteLines.join("\n").trim();
  return { quantity, reason, publishLinks, note: note || null };
}
