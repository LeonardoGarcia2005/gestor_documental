import { verifyInfinityAccessToken, verifyAccessToken } from "../utils/jwt.js";
import { companyService } from "../models/businessLogic/companyService.js";

export const verifyTokenByCompanyCode = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Verificar si el header contiene un token válido
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Token no proporcionado o inválido." });
    }

    const token = authHeader.split(" ")[1];

    // Verificar y decodificar el token
    let decoded;
    try {
      decoded = await verifyAccessToken(token);
    } catch (error) {
      console.error("Error al verificar el token:", error.message);

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Token inválido." });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expirado." });
      }

      return res.status(500).json({ message: "Error al procesar el token." });
    }

    const { companyCode, permissions } = decoded;

    // Validar que el código de empresa esté presente
    if (!companyCode) {
      return res
        .status(403)
        .json({ message: "Token válido pero sin código de empresa." });
    }

    // Consultar la base de datos para verificar la existencia de la empresa
    const company = await companyService.getCompanyByCode(companyCode);

    if (company == null) {
      return res
        .status(404)
        .json({ message: "Código de empresa no encontrado." });
    }

    // Validar permisos si están presentes (opcional)
    if (permissions && !Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ message: "El campo 'permissions' debe ser un arreglo." });
    }

    // Ejemplo de validación: verificar que los permisos no estén vacíos
    if (permissions && permissions.some((permiso) => !permiso)) {
      return res.status(400).json({
        message: "El arreglo de permisos contiene valores inválidos.",
      });
    }

    // Agregar la empresa y los permisos al objeto req
    req.company = {
      company_code: company.company_code,
      company_id: company.id,
    };
    req.permissions = permissions || []; // Default a un arreglo vacío si no hay permisos

    // Pasar al siguiente middleware
    return next();
  } catch (error) {
    console.error("Error interno al validar token:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Middleware para verificar el token infinito y obtener información del backend
export const verifyInfinityToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Verificar si el header contiene un token válido
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Token no proporcionado o inválido." });
    }

    const token = authHeader.split(" ")[1];

    try {
      // Verificar validez del token infinito
      await verifyInfinityAccessToken(token);

      next();
    } catch (error) {
      console.error("Error al verificar el token:", error.message);

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Token inválido." });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expirado." });
      }

      return res.status(500).json({ message: "Error al procesar el token." });
    }
  } catch (error) {
    console.error("Error al verificar backend:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
