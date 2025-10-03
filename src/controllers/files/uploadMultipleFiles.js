import path from "path";
import fs from "fs/promises";
import calculateMD5 from "../../lib/calculateMD5.js";
import { securityLevels } from "../../dataAccessObjects/enumDAO.js";
import { normalizeDate } from "../../lib/formatters.js";
import { buildFileUrl } from "../../lib/builder.js";
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { saveMultipleFilesFromBuffer } from "../../services/fileSystem.js";
import { generateCodeFile } from "../../lib/generators.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { formatDate } from "../../lib/formatters.js";

export const uploadMultipleVariantsFiles = async (req, res) => {
    let createdFiles = [];
    let responseData = null;

    try {
        const { securityContext, securityLevelId, channelId, documentTypeId } = req;
        const { documentType, securityLevel, expirationDate, emissionDate } = req.body;
        const files = Array.isArray(req.processedFiles) ? req.processedFiles : [];

        if (files.length === 0) {
            return res.status(400).json({
                error: "No se proporcionaron archivos para procesar",
            });
        }

        const publicLevel = securityLevels.find((level) =>
            level.toLowerCase().includes(process.env.SECURITY_PUBLIC_LEVEL)
        );

        const defaultEmissionDate = normalizeDate(emissionDate);
        const defaultExpirationDate = normalizeDate(expirationDate, 1);

        const preparedFiles = files.map((fileEntry) => {
            const buffer = fileEntry.buffer || fileEntry.originalFile?.buffer;

            if (!buffer) {
                throw new Error(`No se encontró buffer para el archivo: ${fileEntry.cleanName}`);
            }

            const md5 = calculateMD5(buffer);

            return {
                index: fileEntry.fileIndex,
                originalName: fileEntry.cleanName,
                cleanName: fileEntry.cleanName,
                extensionId: fileEntry.extensionId,
                sizeBytes: fileEntry.sizeBytes,
                buffer,
                md5,
                config: {
                    channelId,
                    documentTypeId,
                    securityLevelId,
                    routeRuleId: fileEntry.routeRuleId,
                    emissionDate: defaultEmissionDate,
                    expirationDate: defaultExpirationDate,
                    routePath: fileEntry.routePath,
                },
                deviceType: fileEntry.deviceType || null,
                resolution: fileEntry.resolution || fileEntry.dimensions?.resolution || null,
                routeParameterValues: fileEntry.routeParameterValues || [],
            };
        });

        const routeRuleIds = [...new Set(preparedFiles.map(f => f.config.routeRuleId))];
        const md5Hashes = preparedFiles.map(f => f.md5);

        const existingFiles = await filesDAO.getFilesByMd5AndRouteRuleIds(md5Hashes, routeRuleIds);

        const existingFilesMap = new Map(
            existingFiles.map(file => {
                const key = `${file.md5}_${file.routeRuleId}`;
                return [key, file];
            })
        );

        const newFiles = [];
        const duplicateFiles = [];

        preparedFiles.forEach(file => {
            const key = `${file.md5}_${file.config.routeRuleId}`;
            const existingFile = existingFilesMap.get(key);

            if (existingFile) {
                const fullRoutePath = `${file.config.routePath}/${existingFile.fileName}`;
                const fileUrl = buildFileUrl(fullRoutePath);

                duplicateFiles.push({
                    index: file.index,
                    originalName: file.originalName,
                    details: {
                        ...(securityLevel === publicLevel
                            ? { fileUrl }
                            : { fileName: existingFile.fileName }),
                        codeFile: existingFile.codeFile,
                        emissionDate: defaultEmissionDate,
                        expirationDate: defaultExpirationDate,
                        documentType: existingFile.documentType,
                        securityLevel: existingFile.securityLevel,
                        deviceType: existingFile.deviceType,
                        resolution: existingFile.resolution,
                    },
                });
            } else {
                newFiles.push(file);
            }
        });

        const uploadedFiles = [];

        if (newFiles.length > 0) {
            const hasVariants = newFiles.length > 1;

            const filesWithMetadata = newFiles.map((file, idx) => {
                const codeFile = generateCodeFile();
                const ext = path.extname(file.cleanName);
                const baseName = path.basename(file.cleanName, ext);
                const fileNameWithCode = `${baseName}-${codeFile}${ext}`;
                const fullStoragePath = path.join(file.config.routePath, fileNameWithCode);
                const fileUrl = buildFileUrl(`${file.config.routePath}/${fileNameWithCode}`);

                return {
                    ...file,
                    codeFile,
                    fileNameWithCode,
                    fullStoragePath,
                    fileUrl,
                    isMain: idx === 0,
                    hasVariants: idx === 0 ? hasVariants : false,
                };
            });

            await dbConnectionProvider.tx(async (t) => {
                const mainFileData = filesWithMetadata[0];

                const mainFileInserted = await filesDAO.insertFile(
                    securityContext.companyId ?? null,
                    mainFileData.config.documentTypeId,
                    mainFileData.config.channelId,
                    mainFileData.config.securityLevelId,
                    mainFileData.extensionId,
                    mainFileData.codeFile,
                    false,
                    mainFileData.config.routeRuleId,
                    mainFileData.fileNameWithCode,
                    mainFileData.config.emissionDate,
                    mainFileData.config.expirationDate,
                    mainFileData.hasVariants,
                    mainFileData.sizeBytes,
                    mainFileData.md5,
                    t
                );

                mainFileData.dbResult = mainFileInserted;
                mainFileData.mainFileId = mainFileInserted.id;

                if (mainFileData.routeParameterValues?.length > 0) {
                    await fileParameterValueDAO.insertFileParameterValue(
                        mainFileInserted.id,
                        mainFileData.config.routeRuleId,
                        mainFileData.routeParameterValues,
                        t
                    );
                }

                await filesDAO.insertFileVariant(
                    mainFileInserted.id,
                    mainFileInserted.id,
                    mainFileData.resolution,
                    mainFileData.deviceType,
                    true,
                    t
                );

                if (filesWithMetadata.length > 1) {
                    const variantInsertPromises = filesWithMetadata.slice(1).map(async (variantFile, idx) => {
                        const variantInserted = await filesDAO.insertFile(
                            securityContext.companyId ?? null,
                            variantFile.config.documentTypeId,
                            variantFile.config.channelId,
                            variantFile.config.securityLevelId,
                            variantFile.extensionId,
                            variantFile.codeFile,
                            false,
                            variantFile.config.routeRuleId,
                            variantFile.fileNameWithCode,
                            variantFile.config.emissionDate,
                            variantFile.config.expirationDate,
                            false,
                            variantFile.sizeBytes,
                            variantFile.md5,
                            t
                        );

                        variantFile.dbResult = variantInserted;

                        if (variantFile.routeParameterValues?.length > 0) {
                            await fileParameterValueDAO.insertFileParameterValue(
                                variantInserted.id,
                                variantFile.config.routeRuleId,
                                variantFile.routeParameterValues,
                                t
                            );
                        }

                        await filesDAO.insertFileVariant(
                            mainFileInserted.id,
                            variantInserted.id,
                            variantFile.resolution,
                            variantFile.deviceType,
                            false,
                            t
                        );

                        return variantFile;
                    });

                    await Promise.all(variantInsertPromises);
                }
            });

            const filesToSave = filesWithMetadata.map(file => ({
                filePath: file.fullStoragePath,
                buffer: file.buffer,
            }));

            await saveMultipleFilesFromBuffer(filesToSave);

            createdFiles = filesWithMetadata.map(f => f.fullStoragePath);

            uploadedFiles.push(...filesWithMetadata.map(file => ({
                index: file.index,
                originalName: file.originalName,
                isMain: file.isMain,
                details: {
                    ...(securityLevel === publicLevel
                        ? { fileUrl: file.fileUrl }
                        : { fileName: file.fileNameWithCode }),
                    codeFile: file.codeFile,
                    emissionDate: formatDate(defaultEmissionDate),
                    expirationDate: formatDate(defaultExpirationDate),
                    securityLevel,
                    documentType,
                    deviceType: file.deviceType,
                    resolution: file.resolution,
                },
            })));
        }

        responseData = {
            success: true,
            message: `Procesados ${files.length} archivos`,
            summary: {
                total: files.length,
                uploaded: uploadedFiles.length,
                duplicates: duplicateFiles.length,
                hasVariants: uploadedFiles.length > 1,
            },
            results: {
                uploaded: uploadedFiles,
                duplicates: duplicateFiles,
            },
        };

        return res.status(201).json(responseData);
    } catch (error) {
        loggerGlobal.error("Error en uploadMultipleFiles:", error);
        loggerGlobal.error("Stack trace:", error.stack);

        if (createdFiles.length > 0) {
            loggerGlobal.info(`Limpiando ${createdFiles.length} archivos por error`);
            const cleanupPromises = createdFiles.map(async (filePath) => {
                try {
                    await fs.unlink(filePath);
                    loggerGlobal.info(`Archivo físico eliminado: ${filePath}`);
                } catch (cleanupError) {
                    loggerGlobal.error(`Error eliminando archivo: ${filePath}`, cleanupError);
                }
            });

            await Promise.allSettled(cleanupPromises);
        }

        return res.status(500).json({
            error: "Error procesando los archivos",
            details: error.message,
        });
    }
};

export const uploadMultipleDistinctFiles = async (req, res) => {
    let createdFiles = [];

    try {
        const { securityContext, securityLevelId, channelId, documentTypeId } = req;
        const { securityLevel } = req.body;
        const files = Array.isArray(req.processedFiles) ? req.processedFiles : [];

        if (files.length === 0) {
            return res.status(400).json({
                error: "No se proporcionaron archivos para procesar",
            });
        }

        const publicLevel = securityLevels.find((level) =>
            level.toLowerCase().includes(process.env.SECURITY_PUBLIC_LEVEL)
        );

        const preparedFiles = files.map((fileEntry, index) => {
            const buffer = fileEntry.buffer || fileEntry.originalFile?.buffer;

            if (!buffer) {
                throw new Error(`No se encontró buffer para el archivo: ${fileEntry.cleanName}`);
            }

            const md5 = calculateMD5(buffer);

            // Cada archivo puede tener sus propias fechas
            const fileMetadata = req.body.filesMetadata?.[index] || {};
            const emissionDate = normalizeDate(fileMetadata.emissionDate);
            const expirationDate = normalizeDate(fileMetadata.expirationDate, 1);

            return {
                index,
                originalName: fileEntry.cleanName,
                cleanName: fileEntry.cleanName,
                extensionId: fileEntry.extensionId,
                sizeBytes: fileEntry.sizeBytes,
                buffer,
                md5,
                config: {
                    channelId,
                    documentTypeId,
                    securityLevelId,
                    routeRuleId: fileEntry.routeRuleId,
                    emissionDate,
                    expirationDate,
                    routePath: fileEntry.routePath,
                },
                routeParameterValues: fileEntry.routeParameterValues || [],
            };
        });

        const routeRuleIds = [...new Set(preparedFiles.map(f => f.config.routeRuleId))];
        const md5Hashes = preparedFiles.map(f => f.md5);

        const existingFiles = await filesDAO.getFilesByMd5AndRouteRuleIds(md5Hashes, routeRuleIds);

        const existingFilesMap = {};
        for (const file of existingFiles) {
            const key = `${file.md5}_${file.routeRuleId}`;
            existingFilesMap[key] = file;
        }

        const newFiles = [];
        const duplicateFiles = [];

        for (const file of preparedFiles) {
            const key = `${file.md5}_${file.config.routeRuleId}`;
            const existingFile = existingFilesMap[key];

            if (existingFile) {
                const fullRoutePath = `${file.config.routePath}/${existingFile.fileName}`;
                const fileUrl = buildFileUrl(fullRoutePath);

                duplicateFiles.push({
                    index: file.index,
                    originalName: file.originalName,
                    status: 'duplicate',
                    details: {
                        ...(securityLevel === publicLevel
                            ? { fileUrl }
                            : { fileName: existingFile.fileName }),
                        codeFile: existingFile.codeFile,
                        emissionDate: existingFile.emissionDate,
                        expirationDate: existingFile.expirationDate,
                        documentType: existingFile.documentType,
                        securityLevel: existingFile.securityLevel,
                    },
                });
            } else {
                newFiles.push(file);
            }
        }

        const uploadedFiles = [];

        if (newFiles.length > 0) {
            const filesWithMetadata = newFiles.map((file) => {
                const codeFile = generateCodeFile();
                const ext = path.extname(file.cleanName);
                const baseName = path.basename(file.cleanName, ext);
                const fileNameWithCode = `${baseName}-${codeFile}${ext}`;
                const fullStoragePath = path.join(file.config.routePath, fileNameWithCode);
                const fileUrl = buildFileUrl(`${file.config.routePath}/${fileNameWithCode}`);

                return {
                    ...file,
                    codeFile,
                    fileNameWithCode,
                    fullStoragePath,
                    fileUrl,
                };
            });

            loggerGlobal.info('Iniciando transacción de base de datos para batch...');

            await dbConnectionProvider.tx(async (t) => {
                for (const file of filesWithMetadata) {
                    loggerGlobal.debug(`Insertando archivo: ${file.fileNameWithCode}`);

                    const fileInserted = await filesDAO.insertFile(
                        securityContext.companyId ?? null,
                        file.config.documentTypeId,
                        file.config.channelId,
                        file.config.securityLevelId,
                        file.extensionId,
                        file.codeFile,
                        false, // is_used
                        file.config.routeRuleId,
                        file.fileNameWithCode,
                        file.config.emissionDate,
                        file.config.expirationDate,
                        false, // has_variants (batch no tiene variantes)
                        file.sizeBytes,
                        file.md5,
                        t
                    );

                    file.dbResult = fileInserted;

                    // Insertar parámetros dinámicos
                    if (file.routeParameterValues?.length > 0) {
                        loggerGlobal.debug(`Insertando ${file.routeParameterValues.length} parámetros`);
                        await fileParameterValueDAO.insertFileParameterValue(
                            fileInserted.id,
                            file.config.routeRuleId,
                            file.routeParameterValues,
                            t
                        );
                    }
                }
            });

            const filesToSave = filesWithMetadata.map(file => ({
                filePath: file.fullStoragePath,
                buffer: file.buffer,
            }));

            await saveMultipleFilesFromBuffer(filesToSave);
            loggerGlobal.info('Archivos guardados exitosamente');

            createdFiles = filesWithMetadata.map(f => f.fullStoragePath);

            uploadedFiles.push(...filesWithMetadata.map(file => ({
                index: file.index,
                originalName: file.originalName,
                status: 'uploaded',
                details: {
                    ...(securityLevel === publicLevel
                        ? { fileUrl: file.fileUrl }
                        : { fileName: file.fileNameWithCode }),
                    codeFile: file.codeFile,
                    emissionDate: formatDate(file.config.emissionDate),
                    expirationDate: formatDate(file.config.expirationDate),
                },
            })));
        }

        return res.status(201).json({
            success: true,
            message: `Procesados ${files.length} archivos en modo batch`,
            summary: {
                total: files.length,
                uploaded: uploadedFiles.length,
                duplicates: duplicateFiles.length,
            },
            results: {
                uploaded: uploadedFiles,
                duplicates: duplicateFiles,
            },
        });

    } catch (error) {
        loggerGlobal.error("Error en uploadBatch:", error);
        loggerGlobal.error("Stack trace:", error.stack);

        if (createdFiles.length > 0) {
            loggerGlobal.info(`Limpiando ${createdFiles.length} archivos por error`);
            const cleanupPromises = createdFiles.map(async (filePath) => {
                try {
                    await fs.unlink(filePath);
                    loggerGlobal.info(`Archivo físico eliminado: ${filePath}`);
                } catch (cleanupError) {
                    loggerGlobal.error(`Error eliminando archivo: ${filePath}`, cleanupError);
                }
            });

            await Promise.allSettled(cleanupPromises);
        }

        return res.status(500).json({
            error: "Error procesando archivos en batch",
            details: error.message,
        });
    }
}