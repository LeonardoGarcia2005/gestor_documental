// middlewares/validateFilesMiddleware.js
import { filesDAO } from "../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

// Middleware para validar que los archivos pertenezcan a la empresa correcta y tengan el nivel de seguridad esperado
export const validateFilesCompany = (options = {}) => {
  const { requiredSecurityLevel } = options;

  return async (req, res, next) => {
    try {
      let { hasCompany, codes } = req.body;
      const { securityContext } = req;

      if (!codes) {
        codes = req.query.codes;
      }

      if (!hasCompany && hasCompany !== false) {
        hasCompany = securityContext?.hasCompany;
      }

      // Parsear codes (puede venir como string separado por comas)
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
          error: 'No se proporcionaron códigos de archivos'
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
        const foundCodes = files.map(f => f.code);
        const missingCodes = fileCodes.filter(code => !foundCodes.includes(code));
        
        return res.status(404).json({
          error: 'Algunos archivos no existen',
          details: 'Verifique los códigos proporcionados',
          missingCodes
        });
      }

      // ========== VALIDACIÓN DE NIVEL DE SEGURIDAD ==========
      // Solo validar si se especificó requiredSecurityLevel
      if (requiredSecurityLevel !== undefined && requiredSecurityLevel !== null) {
        const invalidSecurityFiles = files.filter(file => {
          const fileSecurityLevel = file.security_level?.toLowerCase() || file.securityLevel?.toLowerCase();
          return fileSecurityLevel !== requiredSecurityLevel.toLowerCase();
        });

        if (invalidSecurityFiles.length > 0) {
          return res.status(403).json({
            error: `Solo se permiten archivos ${requiredSecurityLevel}`,
            details: `${invalidSecurityFiles.length} archivo(s) tienen un nivel de seguridad diferente`,
            invalidFiles: invalidSecurityFiles.map(f => ({
              code: f.code,
              securityLevel: f.security_level || f.securityLevel
            }))
          });
        }

        loggerGlobal.info(`✓ Validación de nivel de seguridad: todos los archivos son ${requiredSecurityLevel}`);
      }

      // ========== VALIDACIÓN DE EMPRESA ==========
      // hasCompany = true: Los archivos DEBEN pertenecer a la empresa del token
      if (hasCompany === true) {
        const { companyId } = securityContext;

        if (!companyId) {
          return res.status(401).json({
            error: 'No se encontró empresa en el contexto de seguridad',
            details: 'El token debe incluir información de la empresa'
          });
        }

        // Verificar que todos los archivos pertenezcan a la empresa del token
        const differentCompanyFiles = files.filter(file =>
          file.company_id !== companyId
        );

        if (differentCompanyFiles.length > 0) {
          return res.status(403).json({
            error: 'Archivos no autorizados',
            details: 'Todos los archivos deben pertenecer a su empresa',
            unauthorizedFiles: differentCompanyFiles.map(f => ({
              code: f.code,
              companyId: f.company_id
            }))
          });
        }

        // Validar que los archivos tengan empresa asignada
        const filesWithoutCompany = files.filter(file =>
          file.company_id === null || file.company_id === undefined
        );

        if (filesWithoutCompany.length > 0) {
          return res.status(403).json({
            error: 'Archivos sin empresa',
            details: 'Todos los archivos deben tener una empresa asignada',
            filesWithoutCompany: filesWithoutCompany.map(f => f.code)
          });
        }

        loggerGlobal.info(`✓ Validación de empresa: todos los archivos pertenecen a company_id ${companyId}`);
        req.validatedFiles = files;
        return next();
      }

      // hasCompany = false: Los archivos NO deben tener empresa
      if (hasCompany === false) {
        // Verificar que NINGÚN archivo tenga empresa asociada
        const filesWithCompany = files.filter(file =>
          file.company_id !== null && file.company_id !== undefined
        );

        if (filesWithCompany.length > 0) {
          return res.status(403).json({
            error: 'No se permiten archivos de empresa',
            details: `${filesWithCompany.length} archivo(s) pertenecen a empresas`,
            filesWithCompany: filesWithCompany.map(f => ({
              code: f.code,
              companyId: f.company_id
            }))
          });
        }

        loggerGlobal.info('✓ Validación: todos los archivos son sin empresa');
        req.validatedFiles = files;
        return next();
      }

      // Si no se especificó hasCompany, no validar empresa (permitir cualquiera)
      if (hasCompany === undefined || hasCompany === null) {
        loggerGlobal.info('⚠ No se especificó hasCompany, omitiendo validación de empresa');
        req.validatedFiles = files;
        return next();
      }

      // hasCompany tiene un valor inválido
      return res.status(400).json({
        error: 'Parámetro hasCompany inválido',
        details: 'Debe ser true, false, o no enviarse'
      });

    } catch (error) {
      loggerGlobal.error('Error en validateFilesCompany:', error);
      return res.status(500).json({
        error: 'Error al validar archivos',
        details: error.message
      });
    }
  };
};