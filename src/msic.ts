import crypto from "crypto";

export let randomKey = () => crypto.randomBytes(8).toString("base64url");
