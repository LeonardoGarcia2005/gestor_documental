import { filesDAO } from "../dataAccessObjects/filesDAO.js";

export const validateFilesCompany = async (req, res, next) => {
    try {
      const { hasCompany, codes } = req.body;
      const { securityContext } = req;

      // Parsear oldCode (puede venir como string separado por comas)
      let fileCodes = [];
      if (typeof codes === 'string') {
        fileCodes = codes.split(',').map(code => code.trim());
      } else if (Array.isArray(codes)) {
        fileCodes = codes;
      } else {
        return res.status(400).json({
          error: 'codes inválido',
          details: 'Debe ser un string separado por comas o un array'
        });
      }

      if (fileCodes.length === 0) {
        return res.status(400).json({
          error: 'No se proporcionaron archivos para actualizar'
        });
      }

      // Obtener información de los archivos
      const files = await filesDAO.getFilesByCodes(fileCodes);

      if (files.length === 0) {
        return res.status(404).json({
          error: 'No se encontraron los archivos especificados'
        });
      }

      if (files.length !== fileCodes.length) {
        return res.status(404).json({
          error: 'Algunos archivos no existen',
          details: 'Verifique los códigos proporcionados'
        });
      }

      // hasCompany = true
      if (hasCompany === true) {
        const { companyId } = securityContext;

        // Verificar que todos los archivos pertenezcan a la misma empresa del token
        const differentCompanyFiles = files.filter(file => 
          file.company_id !== companyId
        );

        if (differentCompanyFiles.length > 0) {
          return res.status(403).json({
            error: 'Los archivos pertenecen a diferentes empresas',
            details: 'Todos los archivos deben pertenecer a su empresa'
          });
        }

        // Todos los archivos pertenecen a la empresa correcta
        req.validatedFiles = files;
        return next();
      }

      // hasCompany = false
      if (hasCompany === false) {
        // Verificar que NINGÚN archivo tenga empresa asociada
        const filesWithCompany = files.filter(file => 
          file.company_id !== null && file.company_id !== undefined
        );

        if (filesWithCompany.length > 0) {
          return res.status(403).json({
            error: 'No se permite actualizar archivos de empresa',
            details: `${filesWithCompany.length} archivo(s) pertenecen a empresas entonces debes enviar la regla de seguridad correspondiente`
          });
        }

        // Todos los archivos son públicos (sin empresa)
        req.validatedFiles = files;
        return next();
      }

      // hasCompany inválido
      return res.status(400).json({
        error: 'Parámetro hasCompany inválido'
      });

    } catch (error) {
      console.error('Error en validateFilesCompany:', error);
      return res.status(500).json({
        error: 'Error al validar archivos',
        details: error.message
      });
    }
};