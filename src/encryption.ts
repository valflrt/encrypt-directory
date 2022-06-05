import crypto from "crypto";
import { Stream, Transform, Writable } from "stream";

export interface EncryptionOptions {
  key: string;
  algorithm?: string;
}

export class Encryption {
  private _hashedKey: string;

  public algorithm: string;

  constructor(key: string, options?: Omit<EncryptionOptions, "key">);
  constructor(options: EncryptionOptions);
  constructor(...args: any[]) {
    let hashedKey: string;
    let algorithm: string;
    if (Object.getPrototypeOf(args[0]) === Object.prototype) {
      hashedKey = crypto
        .createHash("sha256")
        .update(args[0].key)
        .digest("base64")
        .substring(0, 32);
      algorithm = args[0].algorithm ?? "aes-256-ctr";
    } else {
      hashedKey = crypto
        .createHash("sha256")
        .update(args[0])
        .digest("base64")
        .substring(0, 32);
      algorithm =
        args[1] && args[1].algorithm ? args[1].algorithm : "aes-256-ctr";
    }

    this._hashedKey = hashedKey;
    this.algorithm = algorithm;
  }

  /**
   * Encrypts a Buffer and returns it (the encrypted version)
   * @param plain Plain Buffer to encrypt
   */
  public encrypt(plain: Buffer) {
    let iv = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv(this.algorithm, this._hashedKey, iv);
    let result = Buffer.concat([iv, cipher.update(plain), cipher.final()]);

    return result;
  }

  /**
   * Encrypts a Stream and returns it (the encrypted version)
   * @param plainStream Plain Stream to encrypt
   */
  public encryptStream(plainStream: Stream) {
    let iv = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv(this.algorithm, this._hashedKey, iv);

    let started = false;
    return plainStream.pipe(cipher).pipe(
      new Transform({
        transform(chunk, encoding, callback) {
          if (!started) {
            started = true;
            this.push(Buffer.concat([iv, chunk]));
          } else this.push(chunk);
          callback();
        },
      })
    );
  }

  /**
   * Decrypts a Buffer and returns it (the decrypted version)
   * @param encrypted Encrypted Buffer to decrypt
   */
  public decrypt(encrypted: Buffer) {
    let iv = encrypted.slice(0, 16);
    encrypted = encrypted.slice(16);
    let decipher = crypto.createDecipheriv(this.algorithm, this._hashedKey, iv);
    let result = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return result;
  }

  /**
   * Decrypts a Stream
   * @param encryptedStream Encrypted Stream to decrypt
   */
  public decryptStream(encryptedStream: Writable) {
    let algorithm = this.algorithm;
    let hashedKey = this._hashedKey;
    let iv: string;
    return new Transform({
      transform(chunk, encoding, callback) {
        if (!iv) {
          iv = chunk.slice(0, 16);
          let decipher = crypto.createDecipheriv(algorithm, hashedKey, iv);
          this.pipe(decipher).pipe(encryptedStream);
          this.push(chunk.slice(16));
        } else this.push(chunk);
        callback();
      },
    });
  }
}
