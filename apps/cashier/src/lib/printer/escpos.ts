const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const COLS = 32;

export function printerSafe(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .trimEnd();
}

export function wrapLine(text: string, width = COLS): string[] {
  const cleaned = printerSafe(text);
  if (!cleaned) return [""];
  const lines: string[] = [];
  for (const raw of cleaned.split("\n")) {
    let rest = raw;
    if (!rest) {
      lines.push("");
      continue;
    }
    while (rest.length > width) {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    lines.push(rest);
  }
  return lines;
}

export function padRow(left: string, right: string, width = COLS): string {
  const l = printerSafe(left);
  const r = printerSafe(right);
  const space = width - l.length - r.length;
  if (space < 1) {
    const joined = `${l} ${r}`;
    return joined.length <= width ? joined : joined.slice(0, width);
  }
  return `${l}${" ".repeat(space)}${r}`;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const encoder = new TextEncoder();

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];

  init(): this {
    this.chunks.push(new Uint8Array([ESC, 0x40]));
    return this;
  }

  align(mode: "left" | "center" | "right"): this {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    this.chunks.push(new Uint8Array([ESC, 0x61, n]));
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(new Uint8Array([ESC, 0x45, on ? 1 : 0]));
    return this;
  }

  text(value: string): this {
    for (const line of wrapLine(value)) {
      this.chunks.push(encoder.encode(`${line}\n`));
    }
    return this;
  }

  separator(): this {
    this.chunks.push(encoder.encode(`${"-".repeat(COLS)}\n`));
    return this;
  }

  feed(lines = 1): this {
    this.chunks.push(new Uint8Array([ESC, 0x64, Math.max(0, Math.min(lines, 20))]));
    return this;
  }

  cut(): this {
    this.feed(6);
    this.chunks.push(new Uint8Array([GS, 0x56, 0x00]));
    return this;
  }

  raw(bytes: Uint8Array): this {
    this.chunks.push(bytes);
    return this;
  }

  build(): Uint8Array {
    return concat(this.chunks);
  }
}
