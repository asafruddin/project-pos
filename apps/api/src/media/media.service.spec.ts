import { BadRequestException, NotFoundException, BadGatewayException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDb } from "../db/client";
import { CLOUDINARY_ADAPTER } from "./cloudinary.adapter";
import { MediaService } from "./media.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

const productId = "11111111-1111-4111-8111-111111111111";
const imageRow = {
  imageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  productId,
  publicId: "pos/products/p/img1",
  secureUrl: "https://res.cloudinary.com/demo/image/upload/img1.jpg",
  width: 800,
  height: 600,
  format: "jpg",
  bytes: 12000,
  altText: null,
  sortOrder: 0,
  isPrimary: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function chain(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result);
  const orderBy = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ limit, orderBy, for: limit });
  const from = jest.fn().mockReturnValue({ where, orderBy, leftJoin: () => ({}) });
  return {
    select: jest.fn().mockReturnValue({ from }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([imageRow]),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };
}

describe("MediaService", () => {
  const adapter = {
    isConfigured: jest.fn().mockReturnValue(true),
    deliveryUrl: jest.fn((id: string) => `https://cdn.example/${id}?q_auto,f_auto`),
    uploadBuffer: jest.fn().mockResolvedValue({
      public_id: "pos/products/p/img1",
      secure_url: "https://res.cloudinary.com/demo/image/upload/img1.jpg",
      width: 800,
      height: 600,
      format: "jpg",
      bytes: 12000,
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  let service: MediaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: CLOUDINARY_ADAPTER, useValue: adapter },
      ],
    }).compile();
    service = moduleRef.get(MediaService);
    jest.clearAllMocks();
    adapter.isConfigured.mockReturnValue(true);
  });

  it("upload delegates to adapter and stores a primary on first image", async () => {
    const db = chain([]);
    db.select = jest
      .fn()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ productId }],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: async () => [],
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: async () => [],
          }),
        }),
      });
    getDbMock.mockReturnValue(db as never);

    const result = await service.upload(productId, {
      buffer: Buffer.from("fake"),
      mimetype: "image/jpeg",
      size: 12,
    });
    expect(adapter.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      `pos/products/${productId}`,
    );
    expect(adapter.destroy).not.toHaveBeenCalled();
    expect(result.is_primary).toBe(true);
    expect(result.secure_url).toContain("q_auto,f_auto");
  });

  it("destroy failure enqueues a retry row", async () => {
    adapter.destroy.mockRejectedValueOnce(new Error("cdn down"));
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({ limit: async () => [{ productId }] }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [imageRow],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({ limit: async () => [] }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: async () => [],
        }),
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
      insert: jest.fn().mockReturnValue({ values: insertValues }),
      update: jest.fn(),
    };
    getDbMock.mockReturnValue(db as never);

    await service.remove(productId, imageRow.imageId);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: imageRow.publicId,
        lastError: "cdn down",
      }),
    );
  });

  it("set-primary is DB-only", async () => {
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({ limit: async () => [{ productId }] }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({ limit: async () => [imageRow] }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({ limit: async () => [imageRow] }),
          }),
        }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
        }),
    };
    getDbMock.mockReturnValue(db as never);

    await service.updateImage(productId, imageRow.imageId, { is_primary: true });
    expect(adapter.uploadBuffer).not.toHaveBeenCalled();
    expect(adapter.destroy).not.toHaveBeenCalled();
  });

  it("rejects missing file", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ productId }] }),
        }),
      }),
    } as never);
    await expect(service.upload(productId, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("unknown product → CATALOG_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [] }),
        }),
      }),
    } as never);
    await expect(
      service.upload(productId, {
        buffer: Buffer.from("x"),
        mimetype: "image/png",
        size: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("getFile returns delivery bytes", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [imageRow] }),
        }),
      }),
    } as never);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      headers: { get: () => "image/jpeg" },
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as never;
    try {
      const file = await service.getFile(productId, imageRow.imageId);
      expect(file.mimeType).toBe("image/jpeg");
      expect(file.bytes.equals(Buffer.from([1, 2, 3]))).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("cdn.example"),
        expect.anything(),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("getFile provider down → MEDIA_UNAVAILABLE", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [imageRow] }),
        }),
      }),
    } as never);
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout")) as never;
    try {
      await expect(
        service.getFile(productId, imageRow.imageId),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
