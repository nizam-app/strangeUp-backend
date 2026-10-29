import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { StoreCatalogAdminService } from "./store-catalog-admin.service.js";
import {
  storeCatalogAdminCreateProductSchema,
  storeCatalogAdminCreateVariantSchema,
  storeCatalogAdminImageParamSchema,
  storeCatalogAdminImageSortSchema,
  storeCatalogAdminListQuerySchema,
  storeCatalogAdminPatchProductSchema,
  storeCatalogAdminPatchVariantSchema,
  storeCatalogAdminProductIdParamSchema,
  storeCatalogAdminStockPatchSchema,
  storeCatalogAdminVariantParamSchema,
} from "./store-catalog-admin.validation.js";
import { createStoreProductImageStorage } from "./store-product-image.storage.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createStoreCatalogAdminController(deps: { db: DatabaseClient; env: AppEnv }) {
  const imageStorage = createStoreProductImageStorage(deps.env);
  const service = new StoreCatalogAdminService(deps.db, deps.env, imageStorage);

  return {
    listCategories: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await service.listCategories(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listProducts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = storeCatalogAdminListQuerySchema.parse(req.query);
      const result = await service.listProducts(requireUser(req), query);
      res.status(200).json({
        data: { products: result.products },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { productId } = storeCatalogAdminProductIdParamSchema.parse(req.params);
      const data = await service.getProduct(requireUser(req), productId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    createProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const body = storeCatalogAdminCreateProductSchema.parse(req.body);
      const data = await service.createProduct(requireUser(req), body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    patchProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { productId } = storeCatalogAdminProductIdParamSchema.parse(req.params);
      const body = storeCatalogAdminPatchProductSchema.parse(req.body);
      const data = await service.patchProduct(requireUser(req), productId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    publishProduct: async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = storeCatalogAdminProductIdParamSchema.parse(req.params);
      const data = await service.publishProduct(requireUser(req), productId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    archiveProduct: async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = storeCatalogAdminProductIdParamSchema.parse(req.params);
      const data = await service.archiveProduct(requireUser(req), productId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    createVariant: async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = storeCatalogAdminProductIdParamSchema.parse(req.params);
      const body = storeCatalogAdminCreateVariantSchema.parse(req.body);
      const data = await service.createVariant(requireUser(req), productId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    patchVariant: async (req: AuthenticatedRequest, res: Response) => {
      const { productId, variantId } = storeCatalogAdminVariantParamSchema.parse(req.params);
      const body = storeCatalogAdminPatchVariantSchema.parse(req.body);
      const data = await service.patchVariant(requireUser(req), productId, variantId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    patchVariantStock: async (req: AuthenticatedRequest, res: Response) => {
      const { productId, variantId } = storeCatalogAdminVariantParamSchema.parse(req.params);
      const body = storeCatalogAdminStockPatchSchema.parse(req.body);
      const data = await service.patchVariantStock(
        requireUser(req),
        productId,
        variantId,
        body.stockQuantity,
        body.expectedUpdatedAt,
      );
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    uploadImage: async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = storeCatalogAdminProductIdParamSchema.parse(req.params);
      const file = req.file;
      if (!file?.buffer?.length) {
        throw new AppError("VALIDATION_ERROR", "Image file is required", 400);
      }
      const data = await service.uploadImage(requireUser(req), productId, file.buffer);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    deleteImage: async (req: AuthenticatedRequest, res: Response) => {
      const { productId, imageId } = storeCatalogAdminImageParamSchema.parse(req.params);
      const data = await service.deleteImage(requireUser(req), productId, imageId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    patchImageSort: async (req: AuthenticatedRequest, res: Response) => {
      const { productId, imageId } = storeCatalogAdminImageParamSchema.parse(req.params);
      const body = storeCatalogAdminImageSortSchema.parse(req.body);
      const data = await service.updateImageSort(
        requireUser(req),
        productId,
        imageId,
        body.sortOrder,
      );
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
