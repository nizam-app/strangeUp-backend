import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createRequireStoreCatalogManagerMiddleware } from "../admin/require-store-catalog-manager.middleware.js";
import { createStoreCatalogAdminController } from "./store-catalog-admin.controller.js";
import { storeProductImageUploadMiddleware } from "./store-product-image-upload.middleware.js";

export function createStoreCatalogAdminRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const requireCatalogManager = createRequireStoreCatalogManagerMiddleware(deps.db);
  const controller = createStoreCatalogAdminController(deps);

  router.use(authenticate, requireCatalogManager);

  router.get("/categories", (req, res, next) => {
    void controller.listCategories(req, res).catch(next);
  });
  router.get("/products", (req, res, next) => {
    void controller.listProducts(req, res).catch(next);
  });
  router.post("/products", (req, res, next) => {
    void controller.createProduct(req, res).catch(next);
  });
  router.get("/products/:productId", (req, res, next) => {
    void controller.getProduct(req, res).catch(next);
  });
  router.patch("/products/:productId", (req, res, next) => {
    void controller.patchProduct(req, res).catch(next);
  });
  router.post("/products/:productId/publish", (req, res, next) => {
    void controller.publishProduct(req, res).catch(next);
  });
  router.post("/products/:productId/archive", (req, res, next) => {
    void controller.archiveProduct(req, res).catch(next);
  });
  router.post("/products/:productId/variants", (req, res, next) => {
    void controller.createVariant(req, res).catch(next);
  });
  router.patch("/products/:productId/variants/:variantId", (req, res, next) => {
    void controller.patchVariant(req, res).catch(next);
  });
  router.patch("/products/:productId/variants/:variantId/stock", (req, res, next) => {
    void controller.patchVariantStock(req, res).catch(next);
  });
  router.post(
    "/products/:productId/images",
    storeProductImageUploadMiddleware,
    (req, res, next) => {
      void controller.uploadImage(req, res).catch(next);
    },
  );
  router.patch("/products/:productId/images/:imageId", (req, res, next) => {
    void controller.patchImageSort(req, res).catch(next);
  });
  router.delete("/products/:productId/images/:imageId", (req, res, next) => {
    void controller.deleteImage(req, res).catch(next);
  });

  return router;
}
