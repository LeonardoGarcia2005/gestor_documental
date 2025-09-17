import { Router } from "express";
import { handleSingleFile } from "../middlewares/multerMiddleware.js"
import { attachFileExtensions } from "../middlewares/fileExtensionMiddleware.js";
import { validateSchema } from "../middlewares/schemaCoreMiddleware.js";
import { determineSecurityContext } from "../middlewares/securityContextMiddleware.js";
import { measureUploadTime } from "../middlewares/performanceMetricsMiddleware.js";
import { applyRouteRule } from "../middlewares/applyRouteRuleMiddleware.js";
import { uploadSingleFile } from "../controllers/files/uploadSingleFileController.js";
import {  
  createSingleFileSchema, 
/*   createMultipleFilesSchema, */
} from "../schemas/filesSchemas.js";

const router = Router();

// Endpoint para subir UN archivo (resolución original o específica)
router.post(
  "/upload/single",
  handleSingleFile('file'),
  validateSchema(createSingleFileSchema),
  attachFileExtensions,
  determineSecurityContext,
  applyRouteRule,
  measureUploadTime,
  uploadSingleFile
);

// Endpoint para subir MÚLTIPLES archivos (diferentes resoluciones)
/* router.post(
  "/upload/multiple",
  handleMultipleFiles('files'),
  validateSchema(createMultipleFilesSchema),
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  handleFileUpload
);
 */
export default router;