import path from "path";
import calculateMD5 from "../../lib/calculateMD5.js";
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { generateCodeFile } from "../../lib/generators.js";
import { formatDate } from "../../lib/formatters.js";

export const uploadSingleFile = async (req, res) => {
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
    const { emissionDate, expirationDate, documentType } = req.body;

    const md5 = calculateMD5(buffer);

    // Validar que el archivo ya no exista en la base de datos
    const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(
      md5,
      routeRuleId
    );
    if (fileExists) {
      return res.status(200).json({
        message: "El archivo ya existe",
        details: {
          urlFile: fileExists.urlFile,
          codeFile: fileExists.codeFile,
          emissionDate: formatDate(fileExists.emissionDate),
          expirationDate: formatDate(fileExists.expirationDate),
          documentType: fileExists.documentType,
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

    // Unir a la ruta final
    const routeWithFileNameAndCode = `${routePath}/${fileNameWithCode}`;

    // Insertar el archivo a la base de datos
    const fileInserted = await filesDAO.insertFile(
      securityContext.companyId ?? null,
      documentTypeId,
      channelId,
      securityLevelId,
      extensionId,
      codeFile,
      false, // is_used
      routeRuleId,
      routeWithFileNameAndCode,
      emissionDate,
      expirationDate,
      false, // hasVariants
      sizeBytes,
      md5
    );

    return res.status(201).json({
      success: true,
      message: "Archivo subido exitosamente",
      details: {
        urlFile: fileInserted.url_calculated,
        codeFile: fileInserted.code,
        emissionDate: formatDate(fileInserted.document_emission_date),
        expirationDate: formatDate(fileInserted.document_expiration_date),
        documentType,
      },
    });
  } catch (error) {
    loggerGlobal.error("Error en uploadOneFile:", error);
    return res.status(500).json({
      error: "Error procesando el archivo",
      details: error.message,
    });
  }
};
