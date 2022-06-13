import crypto from "crypto";
import {
  Readable,
  Transform,
  TransformCallback,
  TransformOptions,
  Writable,
} from "stream";

type CustomTransformOptions = Omit<TransformOptions, "transform"> & {
  transform?(
    this: CustomTransform,
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void;
  local?: { [key: string]: any };
};

/**
 * Custom transform options, used in {@link Encryption.encryptStream}
 * and {@link Encryption.decryptStream}
 */
class CustomTransform extends Transform {
  public local: { [key: string]: any };

  constructor(options: CustomTransformOptions = {}) {
    let { local, ...rest } = options;
    super(rest);
    this.local = local ?? {};
  }
}

export interface EncryptionOptions {
  key: string;
  algorithm?: string;
}

export default class Encryption {
  private _hashedKey: string;

  public algorithm: string;

  /**
   * Creates an Encryption object
   * @param key Key to encrypt with
   * @param options Encryption options
   */
  constructor(key: string, options?: Omit<EncryptionOptions, "key">);
  /**
   * Creates an Encryption object
   * @param options Encryption options
   */
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
    let result = Buffer.concat([
      iv,
      cipher.update(Buffer.concat([Buffer.alloc(4), plain])),
      cipher.final(),
    ]);
    return result;
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
    if (Buffer.compare(result.slice(0, 4), Buffer.alloc(4)) !== 0)
      throw new Error("Wrong key");
    return result.slice(4);
  }

  /**
   * Validates an encrypted Buffer
   * @param encrypted Encrypted Buffer to validate
   */
  public validate(encrypted: Buffer) {
    let iv = encrypted.slice(0, 16);
    encrypted = encrypted.slice(16);
    let decipher = crypto.createDecipheriv(this.algorithm, this._hashedKey, iv);
    let result = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    if (Buffer.compare(result.slice(0, 4), Buffer.alloc(4)) !== 0) return false;
    else return true;
  }

  /**
   * Encrypts a Stream
   * @param input Plain input (Readable stream) to encrypt
   * @param output Output (Writable stream) to pipe the
   * decrypted data in
   */
  public encryptStream(input: Readable, output: Writable) {
    let iv = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv(this.algorithm, this._hashedKey, iv);

    return new Promise<void>((resolve, reject) =>
      input
        .on("end", resolve)
        .on("error", reject)
        .pipe(
          new CustomTransform({
            transform(chunk, enc, callback) {
              if (this.local.isFirstChunk) {
                this.local.isFirstChunk = false;
                this.push(Buffer.concat([Buffer.alloc(4), chunk]));
              } else this.push(chunk);
              callback();
            },
            local: {
              isFirstChunk: true,
            },
          })
        )
        .on("error", reject)
        .pipe(cipher)
        .on("error", reject)
        .pipe(
          new CustomTransform({
            transform(chunk, enc, callback) {
              chunk = Buffer.from(chunk);
              if (this.local.isFirstChunk) {
                this.local.isFirstChunk = false;
                this.push(Buffer.concat([iv, chunk]));
              } else this.push(chunk);
              callback();
            },
            local: {
              isFirstChunk: true,
            },
          })
        )
        .on("error", reject)
        .pipe(output)
        .on("error", reject)
    );
  }

  /**
   * Decrypts a Stream
   * @param input Encrypted input (Readable stream) to
   * decrypt
   * @param output Output (Writable stream) to pipe the
   * decrypted data in
   */
  public decryptStream(input: Readable, output: Writable) {
    let algorithm = this.algorithm;
    let hashedKey = this._hashedKey;

    return new Promise<void>((resolve, reject) =>
      input
        .on("end", resolve)
        .on("error", reject)
        .pipe(
          new CustomTransform({
            transform(chunk, enc, callback) {
              if (!this.local.iv) {
                this.local.iv = chunk.slice(0, 16);
                let decipher = crypto.createDecipheriv(
                  algorithm,
                  hashedKey,
                  this.local.iv
                );

                this.on("error", reject)
                  .pipe(decipher)
                  .on("error", reject)
                  .pipe(
                    new CustomTransform({
                      transform(chunk, enc, callback) {
                        if (this.local.isFirstChunk) {
                          this.local.isFirstChunk = false;
                          if (
                            Buffer.compare(
                              chunk.slice(0, 4),
                              Buffer.alloc(4)
                            ) !== 0
                          )
                            return callback(new Error("Wrong key"));
                          this.push(chunk.slice(4));
                        } else this.push(chunk);
                        callback();
                      },
                      local: {
                        isFirstChunk: true,
                      },
                    })
                  )
                  .on("error", reject)
                  .pipe(output)
                  .on("error", reject);

                this.push(chunk.slice(16));
              } else this.push(chunk);
              callback();
            },
          })
        )
    );
  }

  /**
   * Validates a stream
   * @param input Encrypted input (Readable stream) to
   * validate
   */
  public validateStream(input: Readable) {
    let algorithm = this.algorithm;
    let hashedKey = this._hashedKey;

    return new Promise<boolean>((resolve, reject) =>
      input
        .on("end", resolve)
        .on("error", reject)
        .pipe(
          new CustomTransform({
            transform(chunk, enc, callback) {
              let iv = chunk.slice(0, 16);
              let decipher = crypto.createDecipheriv(algorithm, hashedKey, iv);

              this.on("error", reject)
                .pipe(decipher)
                .on("error", reject)
                .pipe(
                  new CustomTransform({
                    transform(chunk, enc, callback) {
                      if (
                        Buffer.compare(chunk.slice(0, 4), Buffer.alloc(4)) !== 0
                      )
                        resolve(false);
                      else resolve(true);
                      this.end();
                      this.destroy();
                      callback();
                    },
                  })
                )
                .on("error", reject);

              this.push(chunk.slice(16));
              callback();
            },
          })
        )
    );
  }
}
