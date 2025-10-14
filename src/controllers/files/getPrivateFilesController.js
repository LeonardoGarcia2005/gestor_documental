import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { routeRuleDAO } from "../../dataAccessObjects/routeRuleDAO.js";
import { buildRoutePathWithParameters } from "../../middlewares/applyRouteRuleMiddleware.js";
import { createTokenForFile } from "../../lib/jwt.js";
import { saveToken } from "../../services/tokenManager.js";
import { copyFileToPublicDestination, findExistingTempFile } from "../../services/fileSystem.js";
import { buildFileUrl } from "../../lib/builder.js";

export const getPrivateFiles = async (req, res) => {
  try {
    const { companyCode } = req.securityContext;
    const { codes } = req.query;

    // Validar que se envió el parámetro codes
    if (!codes) {
      return res.status(400).json({
        error: 'Parámetro requerido faltante',
        details: 'Debe proporcionar el parámetro "codes"'
      });
    }

    // Convertir string separado por comas a array
    const codeArray = codes.split(",").map((code) => code.trim()).filter(Boolean);

    if (codeArray.length === 0) {
      return res.status(400).json({
        error: 'Códigos inválidos',
        details: 'Debe proporcionar al menos un código válido'
      });
    }

    const filesProcessed = await Promise.all(
      codeArray.map(async (code) => {
        try {
          // Obtener metadata del archivo
          const fileData = await filesDAO.getFileByCode(code);

          if (!fileData) {
            loggerGlobal.warn(`Archivo no encontrado: ${code}`);
            return {
              code,
              error: 'Archivo no encontrado',
              success: false
            };
          }

          // Obtener ruta completa del archivo privado
          const privateFilePath = await fileParameterValueDAO.buildFilePathFromCode(code);

          // Obtener parámetros de ruta para archivos temporales públicos
          const routeParameters = await routeRuleDAO.getRouteRuleBasePublicCompany();

          const valuesToBuildRoute = {
            companyCode,
            documentType: fileData.documentType,
            storage: "temp",
            typeOfFile: "image",
            securityLevel: "public",
          };

          const { routePath } = buildRoutePathWithParameters(
            routeParameters,
            valuesToBuildRoute,
            { allowOverrideDefaults: true }
          );

          // Verificar si ya existe un archivo temporal para este código
          const existingTempFile = await findExistingTempFile(routePath, code);

          let tempFileUrl;

          if (existingTempFile) {
            // Ya existe un archivo temporal válido, usarlo
            tempFileUrl = existingTempFile;
            loggerGlobal.info(`Reutilizando archivo temporal para código ${code}`);
          } else {
            // No existe, crear uno nuevo
            const tokenFile = await createTokenForFile(
              code,
              process.env.FILE_JWT_EXPIRES_IN || '3d'
            );

            
            const shortId = await saveToken(fileData.code, tokenFile);
            const nameFileWithShortId = `${shortId}&${fileData.file_name}`;

            // Copiar archivo a destino temporal
            tempFileUrl = await copyFileToPublicDestination(
              privateFilePath,
              routePath,
              nameFileWithShortId
            );
          }

          const relativeUrl = buildFileUrl(tempFileUrl);

          return {
            id: fileData.id,
            code: code,
            file_name: fileData.file_name,
            url: relativeUrl,
            success: true
          };

        } catch (error) {
          loggerGlobal.error(`Error procesando archivo ${code}:`, {
            error: error.message,
            stack: error.stack
          });

          return {
            code,
            error: error.message,
            success: false
          };
        }
      })
    );

    // Separar exitosos y fallidos
    const successfulFiles = filesProcessed.filter((f) => f.success);
    const failedFiles = filesProcessed.filter((f) => !f.success);

    // Si todos fallaron, retornar error
    if (successfulFiles.length === 0) {
      return res.status(404).json({
        error: 'No se pudieron procesar los archivos',
        details: failedFiles
      });
    }

    // Si algunos fallaron, incluir información en la respuesta
    const response = {
      files: successfulFiles,
      total: filesProcessed.length,
      successful: successfulFiles.length,
      failed: failedFiles.length
    };

    if (failedFiles.length > 0) {
      response.errors = failedFiles;
    }

    return res.json(response);

  } catch (error) {
    loggerGlobal.error('Error en getPrivateFiles:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Error al procesar archivos privados',
      details: error.message
    });
  }
};
