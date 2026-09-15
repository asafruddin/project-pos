import {
  BadGatewayException,
  BadRequestException,
} from "@nestjs/common";

/**
 * `fetch` `Response` can collapse to `{}` under TypeScript 5.9 + @types/node
 * (DOM `onmessage` check). Cast to the Fetch shape we actually use.
 */
type FetchLike = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  headers: { get(name: string): string | null };
};

export async function fetchRemoteBytes(
  url: string,
  maxBytes: number,
): Promise<{ mimeType: string; bytes: Buffer }> {
  let res: FetchLike;
  try {
    res = (await fetch(url, {
      signal: AbortSignal.timeout(8000),
    })) as FetchLike;
  } catch {
    throw new BadGatewayException({
      code: "MEDIA_UNAVAILABLE",
      message: "Gambar tidak dapat diambil.",
    });
  }
  if (!res.ok) {
    throw new BadGatewayException({
      code: "MEDIA_UNAVAILABLE",
      message: "Gambar tidak dapat diambil.",
    });
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new BadRequestException({
      code: "MEDIA_TOO_LARGE",
      message: "Ukuran gambar maksimal 8 MB.",
    });
  }
  const rawType = res.headers.get("content-type") ?? "image/jpeg";
  const mimeType = rawType.split(";")[0]?.trim() || "image/jpeg";
  return { mimeType, bytes };
}
