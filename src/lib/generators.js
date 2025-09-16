export const generateCompanyCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return `EMP-${code}`;
};

// Funcion encargada de generar un código aleatorio para el nombre de un archivo
export const generateCodeFile = () =>
  `FILE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
