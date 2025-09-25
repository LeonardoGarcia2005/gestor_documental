import path from "path";
import fs from "fs/promises";
import calculateMD5 from "../../lib/calculateMD5.js";
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { generateCodeFile } from "../../lib/generators.js";
import { formatDate } from "../../lib/formatters.js";
import {
  saveFileFromBuffer,
  saveMultipleFilesFromBuffer,
} from "../../services/fileSystem.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { buildFileUrl } from "../../lib/builder.js";
import { securityLevels } from "../../dataAccessObjects/enumDAO.js";

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
    } = req;

    // Desestructuramos el fileInfo
    const { cleanName, extensionId, sizeBytes, buffer } = fileInfo;

    // Obtener los valores de la fecha de emisión y cuando se expira (formato YYYY-MM-DD)
    const { emissionDate, expirationDate, documentType, securityLevel } =
      req.body;

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
          emissionDate: formatDate(fileExists.emissionDate),
          expirationDate: formatDate(fileExists.expirationDate),
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
        emissionDate,
        expirationDate,
        false, // hasVariants
        sizeBytes,
        md5,
        t // pasar la transacción
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
          emissionDate: formatDate(fileInserted.document_emission_date),
          expirationDate: formatDate(fileInserted.document_expiration_date),
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

export const uploadMultipleFiles = async (req, res) => {
  let createdFiles = [];
  let responseData = null;

  try {
    const {
      securityContext,
      routePath,
      routeRuleId,
      securityLevelId,
      channelId,
    } = req;

    const { documentType, expirationDate, emissionDate, metadata, files } = req.body;

    // Evaluar el tipo de seguridad para determinar si retornar URLs
    const publicLevel = securityLevels.find((level) =>
      level.toLowerCase().includes(process.env.SECURITY_PUBLIC_LEVEL)
    );

    const processedFiles = [];
    const duplicateFiles = [];

    // Procesar cada archivo
    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i];
      const { file: fileInfo } = fileItem;

      // Usar configuración específica del archivo o defaultConfig como fallback
      const config = {
        channelId: fileItem.channelId || channelId,
        securityLevelId: fileItem.securityLevelId || securityLevelId,
        routeRuleId: fileItem.routeRuleId || routeRuleId,
        emissionDate: fileItem.emissionDate || emissionDate,
        expirationDate: fileItem.expirationDate || expirationDate,
      };

      // Desestructurar fileInfo
      const { cleanName, extensionId, sizeBytes, buffer } = fileInfo;

      const md5 = calculateMD5(buffer);

      // Verificar si el archivo ya existe
      const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(
        md5,
        config.routeRuleId
      );

      if (fileExists) {
        const fullRoutePath = `${routePath}/${fileExists.fileName}`;
        const fileUrl = buildFileUrl(fullRoutePath);

        duplicateFiles.push({
          index: i,
          originalName: cleanName,
          details: {
            ...(securityLevel === publicLevel
              ? { fileUrl }
              : { fileName: fileExists.fileName }),
            codeFile: fileExists.codeFile,
            emissionDate: formatDate(fileExists.emissionDate),
            expirationDate: formatDate(fileExists.expirationDate),
            documentType: fileExists.documentType,
            securityLevel: fileExists.securityLevel,
          },
        });
        continue;
      }

      // Generar código único para el archivo
      const codeFile = generateCodeFile();

      // Procesar nombre del archivo
      const ext = path.extname(cleanName);
      const baseName = path.basename(cleanName, ext);
      const fileNameWithCode = `${baseName}-${codeFile}${ext}`;
      const routeWithFileNameAndCode = `${routePath}/${fileNameWithCode}`;
      const fileUrl = buildFileUrl(routeWithFileNameAndCode);
      const fullStoragePath = path.join(routePath, fileNameWithCode);

      processedFiles.push({
        config,
        fileInfo,
        codeFile,
        fileNameWithCode,
        fileUrl,
        fullStoragePath,
        index: i,
        originalName: cleanName,
      });
    }

    // Ejecutar transacción para todos los archivos nuevos
    if (processedFiles.length > 0) {
      await dbConnectionProvider.tx(async (t) => {
        for (const fileData of processedFiles) {
          const { config, fileInfo, codeFile, fileNameWithCode } = fileData;

          // Insertar archivo en la base de datos
          const fileInserted = await filesDAO.insertFile(
            securityContext.companyId ?? null,
            config.documentTypeId,
            config.channelId,
            config.securityLevelId,
            fileInfo.extensionId,
            codeFile,
            false, // is_used
            config.routeRuleId,
            fileNameWithCode,
            config.emissionDate,
            config.expirationDate,
            false, // hasVariants
            fileInfo.sizeBytes,
            calculateMD5(fileInfo.buffer),
            t
          );

          // Actualizar datos con información de BD
          fileData.dbResult = fileInserted;
        }
      });

      // Si la transacción fue exitosa, guardar archivos físicos
      const filesToSave = processedFiles.map((fileData) => ({
        path: fileData.fullStoragePath,
        buffer: fileData.fileInfo.buffer,
      }));

      await saveMultipleFilesFromBuffer(filesToSave);
      createdFiles = processedFiles.map((f) => f.fullStoragePath);
    }

    // Preparar respuesta
    const successfulUploads = processedFiles.map((fileData) => ({
      index: fileData.index,
      originalName: fileData.originalName,
      details: {
        ...(securityLevel === publicLevel
          ? { fileUrl: fileData.fileUrl }
          : { fileName: fileData.fileNameWithCode }),
        codeFile: fileData.dbResult.code,
        emissionDate: formatDate(fileData.dbResult.document_emission_date),
        expirationDate: formatDate(fileData.dbResult.document_expiration_date),
        securityLevel,
        documentType,
      },
    }));

    responseData = {
      success: true,
      message: `Procesados ${files.length} archivos`,
      summary: {
        total: files.length,
        uploaded: successfulUploads.length,
        duplicates: duplicateFiles.length,
      },
      results: {
        uploaded: successfulUploads,
        duplicates: duplicateFiles,
      },
    };

    return res.status(201).json(responseData);
  } catch (error) {
    loggerGlobal.error("Error en uploadMultipleFiles:", error);

    // Limpiar archivos físicos creados en caso de error
    if (createdFiles.length > 0) {
      for (const filePath of createdFiles) {
        try {
          await fs.unlink(filePath);
          loggerGlobal.info(`Archivo físico eliminado tras error: ${filePath}`);
        } catch (cleanupError) {
          loggerGlobal.error(
            `Error eliminando archivo físico tras fallo: ${filePath}`,
            cleanupError
          );
        }
      }
    }

    return res.status(500).json({
      error: "Error procesando los archivos",
      details: error.message,
    });
  }
};
