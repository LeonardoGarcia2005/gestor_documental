
import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { buildFileUrl } from "../../lib/builder.js";


export const getPublicFiles = async (req, res) => {
  const { files } = req.body;

  try {
    const filesWithMetadata = await Promise.all(files.map(async (file) => {
      const fileData = await filesDAO.getFileByCode(file.codeFile);

      // Obtener la ruta del archivo por el codigo
      const fileParameterValue = await fileParameterValueDAO.buildFilePathFromCode(fileData.codeFile);

      return {
        ...fileData,
        fileNameWithCode: `${fileData.code}_${fileData.name}`,
        fileUrl: buildFileUrl(fileData.code, fileData.name),
      };
    }));

    // Respuesta exitosa
    res.status(200).json({ message: "Archivos obtenidos exitosamente" });
  } catch (error) {
    // Manejo de errores
    res.status(500).json({ error: error.message });
  }
};
