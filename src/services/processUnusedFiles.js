const processUnusedFiles = async () => {
    try {
        // Obtner los archivos que no estan siendo usados por el frontend
        const unusedFiles = await filesService.getUnusedFiles();

        if (!unusedFiles.length) {
            loggerGlobal.info("No se encontraron archivos sin usar para procesar");
            return;
        }

        const removedIds = [];
        // Se añade los ids que eliminaré en la base de datos en un arreglo
        for (const file of unusedFiles) {
            removedIds.push(file.id);
        }

        if (removedIds.length > 0) {
            await filesService.removeFilesUnused(removedIds);
        }
        // Eliminar archivos físicos en el sistema
        const deletePromises = unusedFiles.map(async (file) => {
            const { companyCode, documentType, documentIdentifier, fileName } =
                await extractParametersByUrl(file.url);

            // Determinar rutas según tipo de archivo
            if (file.type === "privado") {
                const { name } = extractTokenAndName(fileName);
                // Ruta principal del archivo privado
                const privateFilePath = path.join(
                    process.env.PATH_GESTOR_PRIVATE,
                    companyCode,
                    documentType,
                    documentIdentifier,
                    name
                );

                // Ruta del archivo temporal expuesto
                const tempFilePath = path.join(
                    process.env.PATH_GESTOR_PUBLIC,
                    companyCode,
                    documentType,
                    "temp",
                    documentIdentifier,
                    fileName
                );

                // Eliminar archivo temporal y sus directorios vacíos
                const deletedTemp = await filesystem.removeFile(tempFilePath);
                if (deletedTemp) {
                    await filesystem.cleanEmptyDirectories(
                        tempFilePath,
                        process.env.PATH_GESTOR_PUBLIC
                    );
                }

                // Eliminar archivo privado principal y sus directorios vacíos
                const deletedPrivate = await filesystem.removeFile(privateFilePath);
                if (deletedPrivate) {
                    await filesystem.cleanEmptyDirectories(
                        privateFilePath,
                        process.env.PATH_GESTOR_PRIVATE
                    );
                }
            } else {
                // Ruta del archivo público
                const publicFilePath = path.join(
                    process.env.PATH_GESTOR_PUBLIC,
                    companyCode,
                    documentType,
                    "static",
                    documentIdentifier,
                    fileName
                );

                // Eliminar archivo público y sus directorios vacíos
                const deletedPublic = await filesystem.removeFile(publicFilePath);
                if (deletedPublic) {
                    await filesystem.cleanEmptyDirectories(
                        publicFilePath,
                        process.env.PATH_GESTOR_PUBLIC
                    );
                }
            }
        });

        // Esperar a que todas las operaciones de eliminación de archivos terminen
        await Promise.all(deletePromises);

        loggerGlobal.info(`Procesados ${removedIds.length} archivos sin usar`);
    } catch (error) {
        loggerGlobal.error("Error en processUnusedFiles:", error.message);
        throw error;
    }
}

export default processUnusedFiles;
