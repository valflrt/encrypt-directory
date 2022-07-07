import crypto from "crypto";

export let randomKey = () => crypto.randomBytes(8).toString("base64url");

export let generateMd5Hash = <
  Encoding extends "base64" | "base64url" | "binary" | "hex" | undefined
>(
  buffer: Buffer,
  encoding?: Encoding
) => {
  let hash = crypto.createHash("md5").update(buffer);
  return (
    encoding ? hash.digest(encoding) : hash.digest()
  ) as Encoding extends undefined ? Buffer : string;
};
