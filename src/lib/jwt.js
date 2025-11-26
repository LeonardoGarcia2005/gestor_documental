import jwt from "jsonwebtoken";

// Crear token con o sin empresa
export const createAccessToken = async (companyCode = null, additionalData = {}) => {
  try {
    let payload = { ...additionalData };
    
    if (companyCode !== null) {
      payload.companyCode = companyCode;
    }
    
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    return token;
  } catch (error) {
    throw new Error("Error al crear el token: " + error.message);
  }
};

// Crear token temporal para archivos
export const createTokenForFile = async (fileCode) => {
  try {
    const payload = {
      type: "file_access",
      ...(fileCode && { fileCode })
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.FILE_JWT_EXPIRES_IN,
    });

    return token;
  } catch (error) {
    throw new Error("Error al crear el token para el archivo: " + error.message);
  }
};

// Verificación unificada de tokens
export const verifyAccessToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Verificar el token por archivo la cual depende si se expira o no
export const verifyTokenForFile = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expirado");
    } else {
      throw new Error("Token inválido");
    }
  }
};

// Función para validar si el token ha expirado
export const isTokenExpired = async (token) => {
  try {
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.exp) {
      throw new Error("El token no contiene una fecha de expiración.");
    }

    const expirationDate = decoded.exp * 1000;
    const currentDate = Date.now();

    return currentDate > expirationDate;
  } catch (error) {
    console.error("Error al validar el token:", error.message);
    return false;
  }
};