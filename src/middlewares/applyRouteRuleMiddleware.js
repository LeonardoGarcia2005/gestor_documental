import { channelDAO } from "../dataAccessObjects/channelDAO.js";
import { documentTypeDAO } from "../dataAccessObjects/documentTypeDAO.js";
import { securityLevelDAO } from "../dataAccessObjects/securityLevelDAO.js";
import { pathTemplateService } from "../services/pathTemplateService.js";
import { loggerGlobal } from "../logging/loggerManager.js";

export const applyRouteRule = async (req, res, next) => {
  try {
    const { securityContext, isForVariants } = req;
    const rawValues = req.body;

    // Validar contexto de seguridad
    if (!securityContext) {
      return res.status(500).json({
        error: "Contexto de seguridad no establecido",
      });
    }

    // Si tiene empresa y es público, colocar storage = "static"
    if (rawValues.hasCompany && securityContext.securityLevel === "public") {
      rawValues.storage = "static";
    }

    // Construir contexto base para la construcción de rutas
    const baseContext = {
      ...rawValues,
      securityLevel: securityContext.securityLevel,
      hasCompany: rawValues.hasCompany,
      isForVariants: isForVariants || false,
      basePath: "/mnt/gestor_documental_test", // Valor por defecto
      ...(securityContext.companyCode && { companyCode: securityContext.companyCode }),
    };

    // Validar canal y tipo de documento en paralelo
    const [channelExists, documentTypeExists, securityLevel] = await Promise.all([
      channelDAO.existsChannel(baseContext.channel),
      documentTypeDAO.existDocumentType(baseContext.documentType),
      securityLevelDAO.getSecurityByType(baseContext.securityLevel),
    ]);

    if (!channelExists.exists) {
      return res.status(404).json({
        error: "No se encontró el canal especificado en la base de datos",
      });
    }

    if (!documentTypeExists) {
      return res.status(404).json({
        error: "No se encontró el tipo de documento en la base de datos",
      });
    }

    // Procesar según si es archivo único o múltiples archivos
    const hasMultipleFiles = req.files && req.files.length > 0;

    if (hasMultipleFiles) {
      // Múltiples archivos (variantes o distintos)
      const processedFiles = Array.isArray(req.processedFiles) ? req.processedFiles : [];
      const filesData = req.body.filesData || [];

      const enrichedFiles = [];

      for (let i = 0; i < filesData.length; i++) {
        const fileData = filesData[i];
        const originalFileInfo = processedFiles[i] || {};

        // Contexto específico para este archivo
        const fileContext = {
          ...baseContext,
          deviceType: fileData.deviceType || originalFileInfo.deviceType,
          resolution: originalFileInfo.resolution,
          typeOfFile: fileData.typeOfFile || baseContext.typeOfFile,
          processingType: baseContext.processingType || "original",
        };

        // Construir ruta usando el nuevo servicio
        const routeResult = await pathTemplateService.buildRouteForFile(fileContext);

        enrichedFiles.push({
          ...originalFileInfo,
          fileIndex: i,
          routePath: routeResult.path,
          templateId: routeResult.templateId,
          templateName: routeResult.templateName,
          originalFile: fileData.file,
          parameters: routeResult.parameters,
          deviceType: fileContext.deviceType,
          ...(originalFileInfo.resolution && {
            dimensions: { resolution: originalFileInfo.resolution }
          }),
        });
      }

      req.processedFiles = enrichedFiles;
      req.processedFilesRoutes = enrichedFiles.map((f) => f.routePath);

      loggerGlobal.info(
        `Procesados ${enrichedFiles.length} archivos ${isForVariants ? "(variantes)" : "(distintos)"}`
      );
    } else {
      // Archivo único
      const fileContext = {
        ...baseContext,
        processingType: baseContext.processingType || "original",
        typeOfFile: baseContext.typeOfFile,
      };

      const routeResult = await pathTemplateService.buildRouteForFile(fileContext);

      req.routePath = routeResult.path;
      req.templateId = routeResult.templateId;
      req.templateName = routeResult.templateName;
      req.routeParameters = routeResult.parameters;

      loggerGlobal.info(`Ruta construida para archivo único: ${routeResult.path}`);
    }

    // Datos comunes para todos los casos
    req.channelId = channelExists.id;
    req.documentTypeId = documentTypeExists.id;
    req.securityLevelId = securityLevel.id;

    next();
  } catch (error) {
    loggerGlobal.error("Error al procesar las reglas de ruta", error);
    return res.status(500).json({
      error: "Error al procesar las reglas de ruta",
      details: error.message,
    });
  }
};

