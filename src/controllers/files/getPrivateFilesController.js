import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { createTokenForFile, verifyTokenForFile } from "../../lib/jwt.js";
import { getMimeType } from "../../lib/secureFileValidator.js";

export const getPrivateFiles = async (req, res) => {
  const { codes } = req.query;
  const { companyCode } = req.securityContext;

  const codeArray = codes.split(",").map(c => c.trim());

  const filesProcessed = await Promise.all(
    codeArray.map(async (code) => {
      const fileData = await filesDAO.getFileByCode(code);

      if (!fileData) {
        return { code, error: 'No encontrado', success: false };
      }

      // Generar token temporal (2 horas)
      const token = await createTokenForFile(code);

      // URL firmada (sin crear archivo físico)
      const signedUrl = `${process.env.BACKEND_URL}/gestor/api/files/private/view/${code}?token=${token}`;

      return {
        id: fileData.id,
        code,
        file_name: fileData.file_name,
        url: signedUrl,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // +2h
      };
    })
  );

  return res.json({ files: filesProcessed });
};

export const viewPrivateFile = async (req, res) => {
  const { code } = req.params;
  const { token } = req.query;

  try {
    const decoded = await verifyTokenForFile(token);

    if (decoded.fileCode !== code) {
      return res.status(401).json({ error: 'Token inválido o pertenece a otro archivo' });
    }

    // Obtener la ruta del archivo original
    const filePath = await fileParameterValueDAO.buildFilePathFromCode(code);

    res.setHeader('Content-Type', getMimeType(filePath));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
};
