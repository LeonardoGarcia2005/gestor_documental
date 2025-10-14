import { verifyAccessToken } from "../lib/jwt.js";
import { companyDAO } from "../dataAccessObjects/companyDAO.js";

export const authenticateContext = async (req, res, next) => {
  try {
    let { hasCompany } = req.body;
    // Si hasCompany no está definido colocar por defecto true
    if (hasCompany === undefined || hasCompany === null || hasCompany === "") {
      hasCompany = true;
    }
    const authHeader = req.headers.authorization;

    // Si hasCompany es false, no validar token
    if (hasCompany === false) {
      req.securityContext = {
        companyId: null,
        companyCode: null,
        hasCompany: false,
      };
      return next();
    }

    // Si hasCompany es true, validar token obligatoriamente
    if (hasCompany === true) {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Token de autenticación requerido",
          details:
            "Debe proporcionar un token Bearer cuando hasCompany es true",
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

      // Validar que el token contenga empresa
      if (!companyCode) {
        return res.status(403).json({
          message:
            "Token incompatible: se requiere empresa pero el token no la contiene.",
        });
      }

      // Verificar que la empresa existe
      const company = await companyDAO.getCompanyByCode(companyCode);
      if (!company) {
        return res.status(404).json({
          message: "Token inválido: la empresa no existe.",
        });
      }

      // Establecer contexto de seguridad con empresa
      req.securityContext = {
        companyId: company.id,
        companyCode: company.company_code,
        hasCompany: true,
      };

      return next();
    }

    // Si hasCompany no está definido o es inválido
    return res.status(400).json({
      error: "Parámetro hasCompany requerido",
      details: "Debe especificar hasCompany como true o false",
    });
  } catch (error) {
    console.error("Error en authenticateContext:", error);
    return res.status(500).json({
      error: "Error interno en autenticación",
      details: error.message,
    });
  }
};
