import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createStoreProductImageStorage } from "./store-product-image.storage.js";
import { StoreCartService } from "./store-cart.service.js";
import { StoreCatalogService } from "./store.service.js";
import { StoreFavoriteService } from "./store-favorite.service.js";
import {
  storeCartItemBodySchema,
  storeProductIdParamSchema,
  storeProductImageParamSchema,
  storeProductListQuerySchema,
  storeVariantIdParamSchema,
} from "./store.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createStoreController(deps: { db: DatabaseClient; env: AppEnv }) {
  const imageStorage = createStoreProductImageStorage(deps.env);
  const catalog = new StoreCatalogService(deps.db, imageStorage);
  const favorites = new StoreFavoriteService(deps.db);
  const cart = new StoreCartService(deps.db);

  return {
    listCategories: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await catalog.listCategories(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getMerchandisePricingPolicy: async (
      req: AuthenticatedRequest,
      res: Response,
    ): Promise<void> => {
      const data = await Promise.resolve(catalog.getMerchandisePricingPolicy(requireUser(req)));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getFulfillmentPolicy: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await Promise.resolve(catalog.getFulfillmentPolicy(requireUser(req)));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listProducts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = storeProductListQuerySchema.parse(req.query);
      const result = await catalog.listProducts(requireUser(req), query);
      res.status(200).json({
        data: { products: result.products },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { productId } = storeProductIdParamSchema.parse(req.params);
      const data = await catalog.getProduct(requireUser(req), productId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getProductImage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { productId, imageId } = storeProductImageParamSchema.parse(req.params);
      const { stream, contentType } = await catalog.getProductImage(
        requireUser(req),
        productId,
        imageId,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      stream.pipe(res);
    },

    listFavorites: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await favorites.listFavorites(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    addFavorite: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { productId } = storeProductIdParamSchema.parse(req.params);
      const data = await favorites.addFavorite(requireUser(req), productId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    removeFavorite: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { productId } = storeProductIdParamSchema.parse(req.params);
      const data = await favorites.removeFavorite(requireUser(req), productId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getCart: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await cart.getCart(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    setCartItem: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { variantId } = storeVariantIdParamSchema.parse(req.params);
      const body = storeCartItemBodySchema.parse(req.body);
      const data = await cart.setCartItem(requireUser(req), variantId, body.quantity);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    removeCartItem: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { variantId } = storeVariantIdParamSchema.parse(req.params);
      const data = await cart.removeCartItem(requireUser(req), variantId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    clearCart: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await cart.clearCart(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
