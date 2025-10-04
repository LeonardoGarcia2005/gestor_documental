import crypto from "crypto";

// Código aleatorio para empresa
export const generateCompanyCode = () => {
  // 3 bytes → 6 caracteres hexadecimales
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `EMP-${randomPart}`;
};

// Código aleatorio para archivo
export const generateCodeFile = () =>
  `FILE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
