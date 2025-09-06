import { dbConnectionProvider } from "../db/dbConnectionManager.js";
import { createTokenForFile } from "../../utils/jwt.js";
import { copyFileToPublicDestination } from "../../utils/fileLogic.js";
import { extractParametersByUrl } from "../../utils/fileAndUrlUtils.js";
import { metadataDAO } from "./metadataDAO.js";
import { loggerGlobal } from "../../globalServices/logging/loggerManager.js";

const getFiles = async (
  documentIdentifiers,
  codes,
  permissions = [],
  companyId
) => {
  try {
    // Obtener archivos en una sola consulta
    const files = await dbConnectionProvider.getAll(`
      SELECT 
        f.id, f.code, f.url, f.binary_data_id, 
        f.security_level_id, f.permission_id, f.company_id,
        sl.status as security_status
      FROM file f
      JOIN security_level sl ON sl.id = f.security_level_id 
      WHERE f.code IN (${codes
        .map((code) => `'${code}'`)
        .join(", ")}) AND f.is_expired <> true
    `);

    // Validación para validar que si no existen los codigos
    if (files == null || typeof files == undefined) {
      return {
        files: [],
        notFound: `Los códigos ${codes.join(
          ", "
        )} no se encontraron en el sistema`,
      };
    }

    // Validación rápida de archivos no encontrados
    const foundCodes = files.map((file) => file.code);
    const notFoundCodes = codes.filter((code) => !foundCodes.includes(code));

    if (notFoundCodes.length) {
      return {
        files: [],
        notFound: `Los archivos ${notFoundCodes.join(
          ", "
        )} no se encontraron en el sistema`,
      };
    }

    // Validación de pertenencia a empresa
    const invalidFiles = files.filter((file) => file.company_id !== companyId);
    if (invalidFiles.length) {
      return {
        error: `Los siguientes archivos no pertenecen a la empresa proporcionada: ${invalidFiles
          .map((f) => f.code)
          .join(", ")}`,
      };
    }

    const result = { files: [] };
    const metadataPromises = files.map((file) =>
      metadataDAO.getMetadataByFileId(file.id)
    );
    const allMetadata = await Promise.all(metadataPromises);

    // Procesamiento paralelo de archivos
    await Promise.all(
      files.map(async (file, index) => {
        const urlParams = await extractParametersByUrl(file.url);

        // Validación de identificador
        if (!documentIdentifiers.includes(urlParams.documentIdentifier)) {
          throw new Error(
            `El identificador (${documentIdentifiers.join(
              ", "
            )}) no coincide para el código ${file.code}.`
          );
        }

        const fileResponse = {
          id: file.id,
          code: file.code,
          documentIdentifier: urlParams.documentIdentifier,
          metadata: allMetadata[index],
        };

        // Manejo de seguridad
        const securityStatus = parseInt(file.security_status, 10);

        if (securityStatus === 0) {
          // Archivo público
          const urlFilePublica = `${process.env.URL_GLOBAL}/${file.url}`;
          fileResponse.url = urlFilePublica;
          result.files.push(fileResponse);
          return;
        }

        if (securityStatus === 1) {
          // Archivo con permisos y privado
          if (!permissions.length) {
            throw new Error(
              `El archivo ${file.code} tiene nivel de seguridad 1, pero no se han proporcionado permisos.`
            );
          }

          // Validar permisos en una sola consulta
          const validPermission = await dbConnectionProvider.oneOrNone(
            `
          SELECT id FROM permission 
          WHERE id = $1 
            AND name IN (${permissions.map((p) => `'${p}'`).join(", ")})
            AND status = TRUE
        `,
            [file.permission_id]
          );

          if (!validPermission) {
            throw new Error(
              `Permiso denegado para el archivo ${file.code}. No tiene acceso.`
            );
          }

          // Generar acceso temporal
          const tokenFile = await createTokenForFile(
            file.code,
            process.env.FILE_JWT_EXPIRES_IN
          );
          // Se crea la copia del archivo a la carpeta publica temp
          const urlPrivated = await copyFileToPublicDestination(
            urlParams.companyCode,
            urlParams.documentType,
            urlParams.documentIdentifier,
            urlParams.fileName.split("&")[1],
            tokenFile
          );

          await updateUrlByFileCode(file.code, urlPrivated);
          const urlFilePrivada = `${process.env.URL_GLOBAL}/${urlPrivated}`;
          fileResponse.url = urlFilePrivada;
          result.files.push(fileResponse);
          return;
        }

        throw new Error(
          `Nivel de seguridad no válido para el archivo ${file.code}: ${securityStatus}`
        );
      })
    );

    return result;
  } catch (error) {
    loggerGlobal.error("Error al obtener archivos:", error.message);
    throw error;
  }
};

const getFilesWithoutCompany = async (codes) => {
  try {
    if (!codes || codes.length === 0) {
      return {
        status: 400,
        data: {
          files: [],
          notFound: `No se proporcionaron códigos.`,
        },
      };
    }

    const codeList = codes.map((code) => `'${code}'`).join(", ");

    const files = await dbConnectionProvider.getAll(`
      SELECT
        f.id, f.code, f.url, f.binary_data_id,
        f.security_level_id, f.permission_id, f.company_id,
        sl.status as security_status
      FROM file f
      JOIN security_level sl ON sl.id = f.security_level_id
      WHERE f.code IN (${codeList})
    `);

    if (!files || files.length === 0) {
      return {
        status: 404,
        data: {
          files: [],
          notFound: `Los códigos ${codes.join(
            ", "
          )} no se encontraron en el sistema`,
        },
      };
    }

    const result = { files: [] };
    const metadataPromises = files.map((file) =>
      metadataDAO.getMetadataByFileId(file.id)
    );
    const allMetadata = await Promise.all(metadataPromises);

    await Promise.all(
      files.map(async (file, index) => {
        const urlParams = await extractParametersByUrl(file.url, true);
        const urlFile = `${process.env.URL_GLOBAL}/${file.url}`;
        const fileResponse = {
          id: file.id,
          code: file.code,
          documentIdentifier: urlParams.documentIdentifier,
          url: urlFile,
          metadata: allMetadata[index],
        };
        result.files.push(fileResponse);
      })
    );

    return {
      status: 200,
      data: result,
    };
  } catch (error) {
    loggerGlobal.error("Error al obtener archivos sin empresa:", error.message);
    throw new Error(`Error al obtener archivos sin empresa: ${error.message}`);
  }
};

const getExpiringFiles = async () => {
  try {
    const query = `
      SELECT fi.code, fi.url, s.type AS security_type, bi.binary_data
        FROM "file" as fi 
        JOIN binary_data as bi ON fi.binary_data_id = bi.id
        JOIN security_level as s ON fi.security_level_id = s.id 
        WHERE  
          (fi.document_expiration_date IS NOT NULL AND fi.document_expiration_date <= CURRENT_DATE) 
        OR
          (fi.document_expiration_date IS NULL AND fi.creation_date + INTERVAL '1 year' <= CURRENT_DATE)
        ORDER BY 
          COALESCE(fi.document_expiration_date, fi.creation_date + INTERVAL '1 year')
        LIMIT 10;
    `;
    const files = await dbConnectionProvider.manyOrNone(query);
    return files;
  } catch (error) {
    loggerGlobal.error(
      "Error en getFilesByTimeOfExpirationOrCreationDate:",
      error.message
    );
    throw new Error(
      "Error al obtener los archivos por expiración o fecha de creación. Por favor, intente de nuevo."
    );
  }
};

const removeFilesAndBinaryData = async (codeFile) => {
  try {
    const result = await dbConnectionProvider.tx(async (t) => {
      // Consulta para obtener los datos del archivo
      const fileQuery = `
        SELECT id, binary_data_id
        FROM file
        WHERE code = $1;
      `;
      const file = await t.oneOrNone(fileQuery, [codeFile]);

      if (!file) {
        loggerGlobal.error(
          "El archivo con el código proporcionado no fue encontrado."
        );
        return false; // Retorna false si el archivo no se encuentra
      }

      // Eliminar el archivo de la tabla file
      const deleteFileQuery = `
            DELETE FROM file
            WHERE code = $1;
          `;
      await t.none(deleteFileQuery, [codeFile]);

      // Eliminar los datos binarios relacionados con el archivo
      const deleteBinaryDataQuery = `
        DELETE FROM binary_data
        WHERE id = $1;
      `;
      await t.none(deleteBinaryDataQuery, [file.binary_data_id]);

      // Eliminar la metadata que tenga mi archivo
      const deleteMetadataQuery = `
        DELETE FROM metadata
        WHERE file_id = $1;
      `;
      await t.none(deleteMetadataQuery, [file.id]);

      loggerGlobal.info("Archivo y datos binarios eliminados correctamente.");
      return true; // Retorna true si todo es exitoso
    });

    return result; // Retorna el resultado de la transacción
  } catch (error) {
    loggerGlobal.error("Error en removeFilesAndBinaryData:", error.message);
    return false; // Retorna false si ocurre un error
  }
};

const insertFile = async (
  code,
  binaryDataId,
  uploadChannelType,
  fileExtension,
  fileUrl,
  emissionDate,
  expirationDate,
  companyId,
  securityLevelId,
  permission_id,
  version,
  t
) => {
  try {
    // Construcción del objeto con los valores para la inserción
    const values = {
      code,
      binary_data_id: binaryDataId,
      upload_channel_id: uploadChannelType,
      extension_id: fileExtension,
      company_id: companyId,
      security_level_id: securityLevelId,
      permission_id: permission_id,
      status: true,
      url: fileUrl,
      document_emission_date: emissionDate,
      document_expiration_date: expirationDate,
      creation_date: new Date(),
      desactivation_date: null,
      modification_date: null,
      version: version === null ? 1 : version,
    };

    // Ejecución de la consulta de inserción
    const result = await dbConnectionProvider.insertOne("file", values, t);

    // Retorno del id del archivo insertado
    return result;
  } catch (error) {
    // Registro del error en los logs
    loggerGlobal.error("Error al insertar archivo", error);
    throw new Error("Error al insertar archivo: " + error.message);
  }
};

const getFilesByCompanyIdAndValueDocument = async (
  companyId,
  typeDocumentUser,
  documentIdentifierUser,
  t
) => {
  try {
    if (!companyId || !typeDocumentUser || !documentIdentifierUser) {
      throw new Error(
        "companyId, typeDocumentUser y documentIdentifierUser son requeridos"
      );
    }

    const query = `
      SELECT fi.id, fi.code, fi.url, fi.version
      FROM file AS fi
      JOIN company AS co ON fi.company_id = co.id
      WHERE co.id = $1 
        AND fi.status = TRUE
        AND fi.url LIKE $2
        AND fi.url LIKE $3
    `;

    const files = await dbConnectionProvider.getAll(
      query,
      [companyId, `%/${typeDocumentUser}/%`, `%/${documentIdentifierUser}/%`],
      t
    );

    return files === null ? [] : files;
  } catch (error) {
    // Para otros errores, registrarlos y lanzar el error
    loggerGlobal.error("Error en getFilesByCompanyAndDocument:", error.message);
    throw new Error("Error al obtener los archivos por empresa y documento.");
  }
};

const getUnusedFiles = async () => {
  try {
    // Calculamos la fecha límite (3 días atrás)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const query = `
      SELECT fi.id, fi.url, slv.type, fi.creation_date
      FROM "file" as fi
      JOIN security_level as slv ON fi.security_level_id = slv.id
      WHERE fi.status = TRUE 
        AND fi.is_active = FALSE 
        AND fi.creation_date < $1;
    `;

    // Pasar la fecha como parámetro para evitar inyección SQL
    const files = await dbConnectionProvider.getAll(query, [threeDaysAgo]);
    return files === null ? [] : files;
  } catch (error) {
    loggerGlobal.error("Error en getUnusedFiles:", error.message);
    throw new Error(
      "Error al obtener los archivos sin usar. Por favor, intente de nuevo."
    );
  }
};

const deleteFilesUnused = async (arrayIdsToRemove) => {
  try {
    await dbConnectionProvider.tx(async (t) => {
      // Validar que hay IDs para eliminar
      if (!arrayIdsToRemove.length) {
        loggerGlobal.info("No hay archivos para eliminar");
        return;
      }

      // Consultar los binary_data_id antes de cualquier eliminación
      const getDataBinaryIdsQuery = `
        SELECT binary_data_id FROM file WHERE id IN (${arrayIdsToRemove.join(
          ", "
        )});
      `;
      const dataBinaryResults = await t.any(getDataBinaryIdsQuery);
      const arrayBinaryIds = dataBinaryResults
        .map((row) => row.binary_data_id)
        .filter(Boolean);

      // Eliminar metadatos primero (dependencia de file)
      const deleteMetadataQuery = `
            DELETE FROM metadata
            WHERE file_id IN (${arrayIdsToRemove.join(", ")});
          `;
      await t.none(deleteMetadataQuery);

      // Eliminar registros de archivos
      const deleteFilesQuery = `
            DELETE FROM file
            WHERE id IN (${arrayIdsToRemove.join(", ")});
          `;
      await t.none(deleteFilesQuery);

      // Eliminar datos binarios solo si hay IDs para eliminar
      if (arrayBinaryIds.length > 0) {
        const deleteBinaryDataQuery = `
          DELETE FROM binary_data
          WHERE id IN (${arrayBinaryIds.join(", ")});
        `;
        await t.none(deleteBinaryDataQuery);
      }
    });

    loggerGlobal.info(
      "Archivos y datos relacionados eliminados correctamente."
    );
  } catch (error) {
    loggerGlobal.error("Error en deleteFilesUnused:", error.message);
    throw new Error(
      "Error al eliminar los archivos y datos relacionados: " + error.message
    );
  }
};

const updateFileMetadata = async (
  codeFile,
  newMetadata,
  version,
  companyId
) => {
  try {
    const result = await dbConnectionProvider.tx(async (t) => {
      const file = await t.oneOrNone(
        `SELECT id, version FROM file WHERE code = $1 AND company_id = $2`,
        [codeFile, companyId]
      );

      if (!file) {
        throw new Error(
          `Archivo no encontrado con el codigo: ${codeFile} para la compañia: ${companyId}`
        );
      }

      // Validar que el valor sea un string
      const metadataUpdates = newMetadata.map(async ({ clave, valor }) => {
        if (typeof valor !== "string") {
          throw new Error(
            `Metadata invalida la clave no es un string: ${clave}`
          );
        }

        // Revisar si la metadata existe
        const existingMetadata = await t.oneOrNone(
          `SELECT id FROM metadata WHERE file_id = $1 AND parameter = $2`,
          [file.id, clave]
        );

        if (existingMetadata) {
          // Actualizar la data existente
          return t.none(`UPDATE metadata SET value = $1 WHERE id = $2`, [
            valor,
            existingMetadata.id,
          ]);
        } else {
          // Insetar la nueva metadata
          return t.none(
            `INSERT INTO metadata (file_id, parameter, value, status) 
             VALUES ($1, $2, $3, $4)`,
            [file.id, clave, valor, true]
          );
        }
      });

      // Ejecutar todas las actualizaciones en paralelo
      await Promise.all(metadataUpdates);

      // Actualizar la version si la proveen
      if (version !== null) {
        await t.none(`UPDATE file SET version = $1 WHERE id = $2`, [
          version,
          file.id,
        ]);
      }

      const updatedMetadata = await t.any(
        `SELECT parameter, value, status FROM metadata WHERE file_id = $1`,
        [file.id]
      );

      return {
        fileId: file.id,
        version: version || file.version,
        metadata: updatedMetadata,
      };
    });

    return {
      message: "Metadata actualizada exitosamente",
      data: {
        codeFile,
        version: result.version,
        companyId,
        metadata: result.metadata,
      },
    };
  } catch (error) {
    const errorMessage = `Fallo al actualizar la metadata: ${error.message}`;
    loggerGlobal.error(errorMessage);
    throw new Error(errorMessage);
  }
};

const updateUrlByFileCode = async (
  code,
  expired = false,
  urlWithNewName = null
) => {
  try {
    // Validación de parámetros
    if (!code) {
      throw new Error("El código del archivo es requerido");
    }

    let fileModify;

    // Si el archivo está expirado, se actualiza el registro
    if (expired !== false && urlWithNewName === null) {
      fileModify = {
        is_expired: true,
      };
    } else {
      // Caso contrario, se actualiza la URL ya que es otro caso de uso
      fileModify = {
        url: urlWithNewName,
      };
    }

    // Usar parámetros seguros en lugar de concatenación directa
    const whereClause = {
      code: code,
    };

    // Se modifica el archivo con la nueva url generada
    const fileResponse = await dbConnectionProvider.updateOne(
      "file",
      fileModify,
      null,
      whereClause // Pasamos un objeto en lugar de un string concatenado
    );

    // Validación más específica de la respuesta
    if (!fileResponse) {
      throw new Error("No se encontró el archivo con el código especificado");
    }

    // Si todo sale bien, retornamos la respuesta
    return fileResponse;
  } catch (error) {
    // Logging más detallado
    loggerGlobal.error("Error en updateUrlByFileCode:", error.message);

    // Propagamos un error más específico
    throw new Error(
      `Error al actualizar la URL del archivo (${code}): ${error.message}`
    );
  }
};

const changeStatusFile = async (codeFile, isActive) => {
  try {
    const result = await dbConnectionProvider.updateOne(
      "file",
      { is_active: isActive },
      null,
      { code: codeFile }
    );
    if (!result) {
      loggerGlobal.error(
        `No se encontró el archivo con el código: ${codeFile}`
      );
      throw new Error(`Archivo no encontrado: ${codeFile}`);
    }
    return "Archivo actualizado correctamente";
  } catch (error) {
    loggerGlobal.error(
      "Error al cambiar el estado del archivo:",
      error.message
    );
    throw new Error(
      `Error al cambiar el estado del archivo (${codeFile}): ${error.message}`
    );
  }
};

const filesDAO = {
  getFiles,
  getExpiringFiles,
  removeFilesAndBinaryData,
  insertFile,
  getFilesByCompanyIdAndValueDocument,
  getUnusedFiles,
  deleteFilesUnused,
  updateFileMetadata,
  updateUrlByFileCode,
  changeStatusFile,
  getFilesWithoutCompany,
};

export { filesDAO };
