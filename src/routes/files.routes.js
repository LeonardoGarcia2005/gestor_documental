import { Router } from "express";
import { handleSingleFile, handleMultipleFiles } from "../middlewares/multerMiddleware.js";
import { attachFileExtensions } from "../middlewares/fileExtensionMiddleware.js";
import { validateSchema } from "../middlewares/schemaCoreMiddleware.js";
import { determineSecurityContext } from "../middlewares/securityContextMiddleware.js";
import { measureUploadTime } from "../middlewares/performanceMetricsMiddleware.js";
import { applyRouteRule } from "../middlewares/applyRouteRuleMiddleware.js";
import { uploadSingleFile } from "../controllers/files/uploadSingleFileController.js";
import { uploadMultipleFiles } from "../controllers/files/uploadMultipleFiles.js";
import { createSingleFileSchema, createMultipleFilesSchema } from "../schemas/uploadSchemas.js";
import { changeStatusFileSchema } from "../schemas/changeStatusFileShema.js";
import { changeStatusFile } from "../controllers/files/changeStatusFileController.js";

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

// Endpoint para subir MÚLTIPLES archivos
router.post(
  "/upload/multiple",
  handleMultipleFiles('files'),
  validateSchema(createMultipleFilesSchema),
  attachFileExtensions,
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  uploadMultipleFiles
);

export default router;
