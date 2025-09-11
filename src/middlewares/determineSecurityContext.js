import { verifyAccessToken } from "../lib/jwt.js";
import { companyDAO } from "../dataAccessObjects/companyDAO.js";

export const determineSecurityContext = async (req, res, next) => {
  try {
    // Obtener parámetros del body
    const securityLevel = req.body?.securityLevel;
    const hasCompany = req.body?.hasCompany;
    const authHeader = req.headers.authorization;

    // Validaciones básicas de entrada
    if (!securityLevel || !['public', 'private'].includes(securityLevel)) {
      return res.status(400).json({
        error: 'securityLevel requerido',
        details: 'Debe ser "public" o "private"'
      });
    }

    if (typeof hasCompany !== 'boolean') {
      return res.status(400).json({
        error: 'hasCompany requerido',
        details: 'Debe ser true o false'
      });
    }

    // Verificar token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token de autenticación requerido."
      });
    }

    const token = authHeader.split(" ")[1];

    // Decodificar token
    let decoded;
    try {
      decoded = await verifyAccessToken(token);
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Token inválido." });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expirado." });
      }
      return res.status(500).json({ message: "Error al procesar el token." });
    }

    const { companyCode } = decoded;

    // Validar coherencia entre parámetros y token
    if (hasCompany && !companyCode) {
      return res.status(403).json({
        message: "Token incompatible: se requiere empresa pero el token no la contiene."
      });
    }

    if (!hasCompany && companyCode) {
      return res.status(403).json({
        message: "Token incompatible: no se requiere empresa pero el token la contiene."
      });
    }

    // Si tiene empresa, verificar que existe
    if (hasCompany && companyCode) {
      const company = await companyDAO.getCompanyByCode(companyCode);
      if (!company) {
        return res.status(404).json({
          message: "Código de empresa no encontrado."
        });
      }

      // Agregar información de empresa al request
      req.company = {
        company_code: company.company_code,
        company_id: company.id,
      };
    }

    // Establecer contexto de seguridad simplificado
    req.securityContext = {
      hasCompany: hasCompany,
      securityLevel: securityLevel,
      companyCode: hasCompany ? companyCode : null
    };

    return next();

  } catch (error) {
    console.error('Error en determineSecurityContext:', error);
    return res.status(500).json({
      error: 'Error interno en autenticación',
      details: error.message
    });
  }
};