import { Router } from "express";
import { handleSingleFile, handleMultipleFiles } from "../middlewares/multerConfig.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { determineSecurityContext } from "../middlewares/securityContext.js";
import { measureUploadTime } from "../middlewares/performanceMetrics.js";
import { applyRouteRule } from "../middlewares/applyRouteRule.js";
import { handleFileUpload } from "../controllers/files/fileUploadController.js";
import { 
  createSingleFileSchema, 
  createMultipleFilesSchema,
} from "../schemas/filesSchemas.js";

const router = Router();

// Endpoint para subir UN archivo (resolución original o específica)
router.post(
  "/upload/single",
  handleSingleFile('file'),
  validateSchema(createSingleFileSchema),
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  handleFileUpload
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