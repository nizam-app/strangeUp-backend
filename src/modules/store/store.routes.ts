import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createStoreController } from "./store.controller.js";

export function createStoreRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createStoreController(deps);

  router.get("/categories", authenticate, (req, res, next) => {
    void controller.listCategories(req, res).catch(next);
  });
  router.get("/products", authenticate, (req, res, next) => {
    void controller.listProducts(req, res).catch(next);
  });
  router.get("/products/:productId", authenticate, (req, res, next) => {
    void controller.getProduct(req, res).catch(next);
  });
  router.get("/products/:productId/images/:imageId", authenticate, (req, res, next) => {
    void controller.getProductImage(req, res).catch(next);
  });

  return router;
}

export function createMeStoreRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createStoreController(deps);

  router.get("/store/favorites", authenticate, (req, res, next) => {
    void controller.listFavorites(req, res).catch(next);
  });
  router.put("/store/favorites/:productId", authenticate, (req, res, next) => {
    void controller.addFavorite(req, res).catch(next);
  });
  router.delete("/store/favorites/:productId", authenticate, (req, res, next) => {
    void controller.removeFavorite(req, res).catch(next);
  });

  router.get("/store/cart", authenticate, (req, res, next) => {
    void controller.getCart(req, res).catch(next);
  });
  router.put("/store/cart/items/:variantId", authenticate, (req, res, next) => {
    void controller.setCartItem(req, res).catch(next);
  });
  router.delete("/store/cart/items/:variantId", authenticate, (req, res, next) => {
    void controller.removeCartItem(req, res).catch(next);
  });
  router.delete("/store/cart", authenticate, (req, res, next) => {
    void controller.clearCart(req, res).catch(next);
  });

  return router;
}
