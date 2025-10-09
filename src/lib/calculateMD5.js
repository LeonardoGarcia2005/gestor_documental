import crypto from "crypto";

const calculateMD5 = (buffer) => {
  const hashSum = crypto.createHash("md5");
  hashSum.update(buffer);
  return hashSum.digest("hex"); // siempre devuelve 32 caracteres
};

export default calculateMD5;