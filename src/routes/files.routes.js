import { Router } from "express";
import { handleSingleFile } from "../middlewares/multerMiddleware.js";
import { validateSchema } from "../middlewares/validateSchemaMiddleware.js";
import { createSingleFileSchema } from "../schemas/uploadSchemas.js";

const router = Router();

// Endpoint para subir un archivo unico
router.post(
  "/upload/single",
  handleSingleFile('file'),
  validateSchema(createSingleFileSchema, 'body', "single")
);

export default router;
