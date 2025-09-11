import { Router } from "express";
import { determineSecurityContext } from "../middlewares/determineSecurityContext.js"
import { measureUploadTime } from "../middlewares/measureUploadTime.js"
import { applyRouteRule } from "../middlewares/applyRouteRule.js"
import { configureDynamicUpload } from "../middlewares/configureDynamicUpload.js"
import { validateSchema } from "../middlewares/validations.js"
import { handleFileUpload } from "../controllers/files/uploadfiles.js"
import { createNewFileSchema } from "../schemas/fileSchemas.js"

const router = Router();

// Endpoint para subir UN archivo
router.post(
  "/upload",
  configureDynamicUpload,
  validateSchema(createNewFileSchema),
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  handleFileUpload
);

// Endpoint para subir MÚLTIPLES archivos
router.post(
  "/upload/multiple",
  configureDynamicUpload,
  validateSchema(createNewFileSchema),
  determineSecurityContext,
  measureUploadTime,
  applyRouteRule,
  handleFileUpload
);
  
export default router;