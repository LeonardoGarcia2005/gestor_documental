import { Router } from "express";
import { handleSingleFile, handleMultipleFiles } from "../middlewares/multerMiddleware.js";
import { attachFileExtensions } from "../middlewares/fileExtensionMiddleware.js";
import { validateSchema } from "../middlewares/schemaCoreMiddleware.js";
import { determineSecurityContext } from "../middlewares/securityContextMiddleware.js";
import { measureUploadTime } from "../middlewares/performanceMetricsMiddleware.js";
import { applyRouteRule } from "../middlewares/applyRouteRuleMiddleware.js";
import { uploadSingleFile } from "../controllers/files/uploadSingleFileController.js";
import { uploadMultipleVariantsFiles, uploadMultipleDistinctFiles } from "../controllers/files/uploadMultipleFilesController.js";
import { createSingleFileSchema, createMultipleFilesSchema } from "../schemas/uploadSchemas.js";
import { changeStatusFileSchema } from "../schemas/changeStatusFileShema.js";
import { changeStatusFile } from "../controllers/files/changeStatusFileController.js";
import { searchFilesSchema, searchFilesSchemaResizing } from "../schemas/searchFilesSchema.js"
import { validateFilesCompany } from "../middlewares/validateFilesMiddleware.js";
import { validatePublicFiles } from "../middlewares/validatePublicFilesMiddleware.js";
import { getPublicFiles } from "../controllers/files/getPublicFilesController.js";
import { updateMultipleFiles } from "../controllers/files/updateMultipleFilesController.js";
import { updateMultipleFilesSchema } from "../schemas/updateSchemas.js";
import { authenticateContext } from "../middlewares/authenticateMiddleware.js";
import { getPrivateFiles, viewPrivateFile } from "../controllers/files/getPrivateFilesController.js";
import { getBackupFile } from "../controllers/files/getBackupFileController.js";

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
  validateSchema(createMultipleFilesSchema(false), 'body', false),
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
  validateSchema(createMultipleFilesSchema(true), 'body', true),
  attachFileExtensions,
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  uploadMultipleDistinctFiles
);

// Endpoint para actualizar MÚLTIPLES archivos
router.put(
  "/update/multiple",
  handleMultipleFiles('files'),
  validateSchema(updateMultipleFilesSchema, "body", false),
  authenticateContext,
  attachFileExtensions,
  validateFilesCompany(),
  updateMultipleFiles
);

// Endpoint para obtener los archivos publicos sin hacer el resizing
router.get(
  "/files/public/search",
  validateSchema(searchFilesSchema, 'query'),
  validatePublicFiles,
  getPublicFiles
);

router.get(
  "/files/private/search",
  validateSchema(searchFilesSchema, 'query'),
  authenticateContext,
  validateFilesCompany({ requiredSecurityLevel: 'private' }),
  getPrivateFiles
);

router.get(
  "/files/private/view/:code",
  viewPrivateFile
);

router.get(
  "/file/backup/:fileName",
  getBackupFile
);

// Endpoint para obtener los archivos publicos haciendo el resizing
/* router.post(
  "/files/public/search/resizing",
  validateSchema(searchFilesSchemaResizing),
  validatePublicFiles,
  getPublicFilesResizing
);
 */

export default router;
