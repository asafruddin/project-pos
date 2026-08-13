import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Product, ProductImage } from "@pos-apps/types";
import {
  primaryCatalogImage,
  syncCatalogImageCache,
  type CatalogImageRecord,
  type ImageCacheStore,
} from "./catalog-images";

function image(overrides: Partial<ProductImage> & Pick<ProductImage, "image_id">): ProductImage {
  return {
    product_id: "p1",
    public_id: "pos/products/p1/img",
    secure_url: "https://cdn.example/img",
    sort_order: 0,
    is_primary: true,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    product_id: "p1",
    name: "Latte",
    price_minor: 25000,
    stock_qty: 3,
    status: "active",
    track_stock: true,
    tags: [],
    images: [image({ image_id: "img-1" })],
    has_primary_image: true,
    ...overrides,
  };
}

function memoryStore(seed: CatalogImageRecord[] = []): ImageCacheStore & { rows: Map<string, CatalogImageRecord> } {
  const rows = new Map(seed.map((row) => [row.productId, row]));
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async put(row) {
      rows.set(row.productId, row);
    },
    async delete(productId) {
      rows.delete(productId);
    },
  };
}

describe("primaryCatalogImage", () => {
  it("prefers is_primary then first image", () => {
    const gallery = image({ image_id: "g", is_primary: false, public_id: "g" });
    const primary = image({ image_id: "p", is_primary: true, public_id: "p" });
    assert.equal(primaryCatalogImage(product({ images: [gallery, primary] }))?.image_id, "p");
    assert.equal(primaryCatalogImage(product({ images: [gallery], has_primary_image: false }))?.image_id, "g");
    assert.equal(primaryCatalogImage(product({ images: [], has_primary_image: false })), null);
  });
});

describe("syncCatalogImageCache", () => {
  it("fetches primary bytes and does not throw when a product has no image", async () => {
    const store = memoryStore();
    const fetched: string[] = [];
    await syncCatalogImageCache(
      [
        product(),
        product({
          product_id: "p2",
          name: "No pic",
          images: [],
          has_primary_image: false,
        }),
      ],
      store,
      async (productId) => {
        fetched.push(productId);
        return {
          mimeType: "image/jpeg",
          bytes: new Uint8Array([1, 2, 3]).buffer,
        };
      },
    );
    assert.deepEqual(fetched, ["p1"]);
    assert.equal(store.rows.get("p1")?.publicId, "pos/products/p1/img");
    assert.equal(store.rows.has("p2"), false);
  });

  it("skips refetch when publicId is unchanged", async () => {
    const store = memoryStore([
      {
        productId: "p1",
        publicId: "pos/products/p1/img",
        mimeType: "image/jpeg",
        bytes: new Uint8Array([9]).buffer,
        cachedAt: "old",
      },
    ]);
    let calls = 0;
    await syncCatalogImageCache([product()], store, async () => {
      calls += 1;
      return { mimeType: "image/jpeg", bytes: new Uint8Array([1]).buffer };
    });
    assert.equal(calls, 0);
    assert.equal(store.rows.get("p1")?.cachedAt, "old");
  });

  it("keeps previous bytes when fetch fails", async () => {
    const store = memoryStore([
      {
        productId: "p1",
        publicId: "old-id",
        mimeType: "image/jpeg",
        bytes: new Uint8Array([9]).buffer,
        cachedAt: "old",
      },
    ]);
    await syncCatalogImageCache([product()], store, async () => null);
    assert.equal(store.rows.get("p1")?.publicId, "old-id");
  });

  it("drops cache rows for products no longer in the pull", async () => {
    const store = memoryStore([
      {
        productId: "gone",
        publicId: "x",
        mimeType: "image/jpeg",
        bytes: new Uint8Array([1]).buffer,
        cachedAt: "old",
      },
    ]);
    await syncCatalogImageCache(
      [product({ images: [], has_primary_image: false })],
      store,
      async () => null,
    );
    assert.equal(store.rows.has("gone"), false);
  });
});
