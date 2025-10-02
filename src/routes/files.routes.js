import { Router } from "express";
import { handleSingleFile, handleMultipleFiles } from "../middlewares/multerMiddleware.js";
import { attachFileExtensions } from "../middlewares/fileExtensionMiddleware.js";
import { validateSchema } from "../middlewares/schemaCoreMiddleware.js";
import { determineSecurityContext } from "../middlewares/securityContextMiddleware.js";
import { measureUploadTime } from "../middlewares/performanceMetricsMiddleware.js";
import { applyRouteRule } from "../middlewares/applyRouteRuleMiddleware.js";
import { uploadSingleFile } from "../controllers/files/uploadSingleFileController.js";
import { uploadMultipleVariantsFiles, uploadMultipleDistinctFiles } from "../controllers/files/uploadMultipleFiles.js";
import { createSingleFileSchema, createMultipleFilesSchema } from "../schemas/uploadSchemas.js";
import { changeStatusFileSchema } from "../schemas/changeStatusFileShema.js";
import { changeStatusFile } from "../controllers/files/changeStatusFileController.js";
import { searchFilesSchema } from "../schemas/searchFilesSchema.js"
import { authenticateContext } from "../middlewares/authenticateMiddleware.js";

const router = Router();

// Endpoint para que el backend externo indique que el archivo se esta utilizando y evitar que el job los elimine
router.patch(
  "/isUseFile",
  validateSchema(changeStatusFileSchema),
  changeStatusFile
);

// Endpoint para subir UN archivo (resolución original o específica)
router.post(
  "/upload/single",
  handleSingleFile("file"),
  validateSchema(createSingleFileSchema),
  attachFileExtensions,
  determineSecurityContext,
  applyRouteRule,
  measureUploadTime,
  uploadSingleFile
);

// Endpoint para subir MÚLTIPLES archivos que son iguales
router.post(
  "/upload/multiple/variants",
  handleMultipleFiles('files'),
  validateSchema(createMultipleFilesSchema),
  attachFileExtensions,
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  uploadMultipleVariantsFiles
);

// Endpoint para subir MÚLTIPLES archivos que son distintos
router.post(
  "/upload/multiple/distinct",
  handleMultipleFiles('files'),
  validateSchema(createMultipleFilesSchema),
  attachFileExtensions,
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  uploadMultipleDistinctFiles
);

// Endpoint para obtener los archivos
router.post(
  "/files/public/search",
  validateSchema(searchFilesSchema),
  getPublicFiles
);

router.post(
  "/files/private/search",
  authenticateContext,
  validateSchema(searchFilesSchema),
  getPrivateFiles
);

export default router;
