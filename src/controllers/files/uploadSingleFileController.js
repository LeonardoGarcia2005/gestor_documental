import path from "path";
import fs from "fs/promises";
import calculateMD5 from "../../lib/calculateMD5.js";
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { generateCodeFile } from "../../lib/generators.js";
import { normalizeDate } from "../../lib/formatters.js";
import {
  saveFileFromBuffer,
} from "../../services/fileSystem.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { buildFileUrl } from "../../lib/builder.js";
import { securityLevels } from "../../dataAccessObjects/enumDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { formatDate } from "../../lib/formatters.js";
import { configurationProvider } from "../../config/configurationManager.js";

export const uploadSingleFile = async (req, res) => {
  let responseData = null;
  let fullStoragePath = null;
  let transactionCommitted = false;

  try {
    const {
      securityContext,
      routePath,
      channelId,
      documentTypeId,
      routeRuleId,
      securityLevelId,
      fileInfo,
      routeParameterValues
    } = req;

    const { cleanName, extensionId, sizeBytes, buffer } = fileInfo;
    const { emissionDate, expirationDate, documentType, securityLevel } = req.body;
    
    // Fecha de expiración por defecto: un año desde hoy
    const defaultEmissionDate = normalizeDate(emissionDate);
    const defaultExpirationDate = normalizeDate(expirationDate, 1);

    // Crear un valor unico por buffer
    const md5 = calculateMD5(buffer);

    // Determinar el nivel público correctamente
    const publicSecurityLevel = configurationProvider.uploads.securityPublicLevel?.toLowerCase() || "public";
    const isPublicFile = securityLevel?.toLowerCase() === publicSecurityLevel;

    // Validar que el archivo ya no exista
    const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(md5, routeRuleId);

    if (fileExists) {
      const fullRoutePath = `${routePath}/${fileExists.fileName}`;
      const fileUrl = buildFileUrl(fullRoutePath);

      return res.status(200).json({
        message: "El archivo ya existe",
        details: {
          ...(isPublicFile
            ? { fileUrl: fileUrl }
            : { fileName: fileExists.fileName }),
          codeFile: fileExists.codeFile,
          emissionDate: fileExists.emissionDate,
          expirationDate: fileExists.expirationDate,
          documentType: fileExists.documentType,
          securityLevel: fileExists.securityLevel,
        },
      });
    }

    const codeFile = generateCodeFile();
    const ext = path.extname(cleanName);
    const baseName = path.basename(cleanName, ext);
    const fileNameWithCode = `${baseName}-${codeFile}${ext}`;
    const routeWithFileNameAndCode = `${routePath}/${fileNameWithCode}`;
    const fileUrl = buildFileUrl(routeWithFileNameAndCode);
    fullStoragePath = path.join(routePath, fileNameWithCode);

    // Si esto falla, no se hace nada en la BD
    try {
      await saveFileFromBuffer(fullStoragePath, buffer);
      loggerGlobal.info(`Archivo físico guardado: ${fullStoragePath}`);
    } catch (fileError) {
      loggerGlobal.error(`Error guardando archivo físico: ${fileError.message}`);
      return res.status(500).json({
        error: "Error guardando el archivo en el sistema",
        details: fileError.message,
      });
    }

    // Solo SI el archivo físico se guardó correctamente, proceder con la BD
    await dbConnectionProvider.tx(async (t) => {
      const fileInserted = await filesDAO.insertFile(
        securityContext.companyId ?? null,
        documentTypeId,
        channelId,
        securityLevelId,
        extensionId,
        codeFile,
        false,
        routeRuleId,
        fileNameWithCode,
        defaultEmissionDate,
        defaultExpirationDate,
        false,
        sizeBytes,
        md5,
        t
      );

      await fileParameterValueDAO.insertFileParameterValue(
        fileInserted.id,
        routeRuleId,
        routeParameterValues,
        t
      );

      // Construir la respuesta DENTRO de la transacción
      responseData = {
        success: true,
        message: "Archivo subido exitosamente",
        details: {
          ...(isPublicFile
            ? { fileUrl }
            : { fileName: fileNameWithCode }),
          codeFile: fileInserted.code,
          emissionDate: formatDate(fileInserted.document_emission_date),
          expirationDate: formatDate(fileInserted.document_expiration_date),
          securityLevel,
          documentType,
        },
      };

      transactionCommitted = true;
    });

    // Verificar que responseData no sea null antes de enviar
    if (!responseData) {
      throw new Error("No se pudo construir la respuesta del archivo");
    }

    return res.status(201).json(responseData);

  } catch (error) {
    loggerGlobal.error("Error en uploadSingleFile:", error);

    // Si la transacción NO se commiteó y el archivo físico existe, eliminarlo
    if (fullStoragePath && !transactionCommitted) {
      try {
        await fs.unlink(fullStoragePath);
        loggerGlobal.info(`Archivo físico eliminado tras error en transacción: ${fullStoragePath}`);
      } catch (cleanupError) {
        loggerGlobal.error(`Error eliminando archivo físico:`, cleanupError);
      }
    }

    return res.status(500).json({
      error: "Error procesando el archivo",
      details: error.message,
    });
  }
};