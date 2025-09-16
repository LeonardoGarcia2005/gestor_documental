import crypto from "crypto";
import fs from "fs";

const calculateMD5 = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("md5");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex"); // siempre devuelve 32 caracteres
}

export default calculateMD5;
