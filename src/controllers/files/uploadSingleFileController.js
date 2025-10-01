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

export const uploadSingleFile = async (req, res) => {
  let responseData = null;
  let fullStoragePath = null;

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

    // Desestructuramos el fileInfo
    const { cleanName, extensionId, sizeBytes, buffer } = fileInfo;

    // Obtener y normalizar las fechas de emisión y expiración
    const { emissionDate, expirationDate, documentType, securityLevel } = req.body;
    
    // Normalizar fechas: si no vienen del frontend, se generan por defecto
    const defaultEmissionDate = normalizeDate(emissionDate);
    const defaultExpirationDate = normalizeDate(expirationDate, 1);

    const md5 = calculateMD5(buffer);

    // Validar que el archivo ya no exista en la base de datos (fuera de transacción)
    const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(
      md5,
      routeRuleId
    );

    // Evaluar el tipo de seguridad para retornarle la url o no para decirle que el archivo es privado debe consultarlo para poder obtener la url
    const publicLevel = securityLevels.find((level) =>
      level.toLowerCase().includes(process.env.SECURITY_PUBLIC_LEVEL)
    );

    if (fileExists) {
      const fullRoutePath = `${routePath}/${fileExists.fileName}`;
      const fileUrl = buildFileUrl(fullRoutePath);

      return res.status(200).json({
        message: "El archivo ya existe",
        details: {
          ...(securityLevel === publicLevel
            ? {
              fileUrl: fileUrl,
            }
            : {
              fileName: fileExists.fileName,
            }),
          codeFile: fileExists.codeFile,
          emissionDate: fileExists.emissionDate,
          expirationDate: fileExists.expirationDate,
          documentType: fileExists.documentType,
          securityLevel: fileExists.securityLevel,
        },
      });
    }

    // Generar el código del archivo para unirlo a la ruta
    const codeFile = generateCodeFile();

    // Dividir el nombre con la extensión
    const ext = path.extname(cleanName); // .pdf
    const baseName = path.basename(cleanName, ext); // document

    // Construir el nuevo nombre
    const fileNameWithCode = `${baseName}-${codeFile}${ext}`;

    // Unir a la ruta final para la URL
    const routeWithFileNameAndCode = `${routePath}/${fileNameWithCode}`;

    const fileUrl = buildFileUrl(routeWithFileNameAndCode);

    // Ruta física completa del archivo
    fullStoragePath = path.join(routePath, fileNameWithCode);

    // Ejecutar la transacción para operaciones de BD
    await dbConnectionProvider.tx(async (t) => {
      // Insertar el archivo a la base de datos dentro de la transacción
      const fileInserted = await filesDAO.insertFile(
        securityContext.companyId ?? null,
        documentTypeId,
        channelId,
        securityLevelId,
        extensionId,
        codeFile,
        false, // is_used
        routeRuleId,
        fileNameWithCode,
        defaultEmissionDate,
        defaultExpirationDate,
        false, // hasVariants
        sizeBytes,
        md5,
        t // pasar la transacción
      );

      await fileParameterValueDAO.insertFileParameterValue(
        fileInserted.id,
        routeParameterValues,
        t
      );

      // Preparar datos de respuesta
      responseData = {
        success: true,
        message: "Archivo subido exitosamente",
        details: {
          ...(securityLevel === publicLevel
            ? {
              fileUrl,
            }
            : {
              fileName: fileNameWithCode,
            }),
          codeFile: fileInserted.code,
          emissionDate: fileInserted.document_emission_date,
          expirationDate: fileInserted.document_expiration_date,
          securityLevel,
          documentType,
        },
      };
    });

    // Si la transacción fue exitosa, guardar el archivo físico
    await saveFileFromBuffer(fullStoragePath, buffer);

    // Devolver respuesta exitosa
    return res.status(201).json(responseData);
  } catch (error) {
    loggerGlobal.error("Error en uploadSingleFile:", error);

    // Si el archivo físico fue creado pero hubo error, intentar eliminarlo
    if (fullStoragePath) {
      try {
        await fs.unlink(fullStoragePath);
        loggerGlobal.info(
          `Archivo físico eliminado tras error: ${fullStoragePath}`
        );
      } catch (cleanupError) {
        loggerGlobal.error(
          `Error eliminando archivo físico tras fallo:`,
          cleanupError
        );
      }
    }

    return res.status(500).json({
      error: "Error procesando el archivo",
      details: error.message,
    });
  }
};