import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertStoreAccess } from "./store-access.js";
import { mapProductDetail } from "./store.mapper.js";

const productInclude = {
  category: { select: { slug: true, label: true } },
  variants: true,
  images: true,
} as const;

export class StoreFavoriteService {
  constructor(private readonly db: DatabaseClient) {}

  async listFavorites(user: User) {
    assertStoreAccess(user);
    const favorites = await this.db.storeFavorite.findMany({
      where: {
        userId: user.id,
        product: { status: "PUBLISHED" },
      },
      include: {
        product: { include: productInclude },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      products: favorites.map((f) => mapProductDetail(f.product, true)),
    };
  }

  async addFavorite(user: User, productId: string) {
    assertStoreAccess(user);
    const product = await this.db.storeProduct.findFirst({
      where: { id: productId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    await this.db.storeFavorite.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId },
      update: {},
    });
    return { productId, favorited: true };
  }

  async removeFavorite(user: User, productId: string) {
    assertStoreAccess(user);
    await this.db.storeFavorite.deleteMany({
      where: { userId: user.id, productId },
    });
    return { productId, favorited: false };
  }
}
