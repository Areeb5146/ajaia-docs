import type { ProseDoc } from "./doc";
import { deriveTitle } from "./doc";
import { markdownToDoc } from "./markdown";

/**
 * Supported upload types. Surfaced verbatim in the UI so the constraint is
 * visible to users, not just documented in the README.
 */
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".markdown", ".docx"] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.join(",");

export class ImportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export function isSupported(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(
    extensionOf(filename),
  );
}

/** Strip the extension; used as the fallback document title. */
export function baseName(filename: string): string {
  const withoutPath = filename.split(/[\\/]/).pop() ?? filename;
  const dot = withoutPath.lastIndexOf(".");
  return (dot === -1 ? withoutPath : withoutPath.slice(0, dot)).trim() ||
    "Imported document";
}

export type ImportResult = { doc: ProseDoc; title: string };

/**
 * Convert an uploaded file into editable document content.
 *
 * .docx goes through mammoth -> Markdown -> the same converter as .md, so there
 * is exactly one path from text to document nodes. mammoth is imported lazily
 * so plain-text imports do not pay for it.
 */
export async function parseUpload(
  filename: string,
  bytes: Buffer,
): Promise<ImportResult> {
  if (!isSupported(filename)) {
    throw new ImportError(
      `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
    );
  }
  if (bytes.byteLength === 0) throw new ImportError("File is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImportError(
      `File is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }

  const ext = extensionOf(filename);
  let markdown: string;

  if (ext === ".docx") {
    // mammoth ships convertToMarkdown at runtime but omits it from its type
    // definitions, so the call is typed locally rather than cast to `any`.
    const mammoth = (await import("mammoth")) as unknown as {
      convertToMarkdown: (input: {
        buffer: Buffer;
      }) => Promise<{ value: string }>;
    };
    try {
      const { value } = await mammoth.convertToMarkdown({ buffer: bytes });
      markdown = value;
    } catch {
      // mammoth throws on anything that is not a real OOXML package, including
      // a .doc renamed to .docx.
      throw new ImportError("Could not read this .docx file. It may be corrupt or not a real Word document.");
    }
  } else {
    markdown = bytes.toString("utf8");
  }

  const doc = markdownToDoc(markdown);
  const fallback = baseName(filename);
  return { doc, title: deriveTitle(doc, fallback) };
}
