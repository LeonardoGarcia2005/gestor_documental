import jwt from "jsonwebtoken";

// Creación del JWT con el código de la empresa
export const createAccessToken = async (companyCode) => {
  try {
    const payload = { companyCode };
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    return token;
  } catch (error) {
    throw new Error("Error al crear el token: " + error.message);
  }
};

// Creacion de un token para el archivo momentaneo del sistema
export const createTokenForFile = async (code, time) => {
  try {
    // Payload del token
    const payload = {
      companyCode: code,
    };
    // Firma del token
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: time,
    });
    return token;
  } catch (error) {
    throw new Error(
      "Error al crear el token para el archivo: " + error.message
    );
  }
};

// Verificación de la clave secreta con el token enviado
export const verifyAccessToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw error;
  }
};


// Función para validar si el token ha expirado
export const isTokenExpired = async (token) => {
  try {
    // Decodificamos el token sin verificar la firma (no necesitamos la validación de firma en este caso)
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.exp) {
      throw new Error("El token no contiene una fecha de expiración.");
    }

    const expirationDate = decoded.exp * 1000; // El valor de 'exp' está en segundos, convertimos a milisegundos
    const currentDate = Date.now(); // Fecha actual en milisegundos

    // Comparamos la fecha actual con la de expiración
    return currentDate > expirationDate;
  } catch (error) {
    console.error("Error al validar el token:", error.message);
    return false; // En caso de error, devolver falso
  }
};
