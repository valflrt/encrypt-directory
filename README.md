# Encrypt Directory

A simple cli program to encrypt a directory and its content, made with nodejs and typescript.

## How to use

Not built:

```sh
# encryption
npx ts-node src/index.ts encrypt -p <./path/to/your/directory> -k <your key>

# decryption
npx ts-node src/index.ts decrypt -p <./path/to/your/directory> -k <your key>
```

Built:

```sh
# encryption
./build/index.js encrypt -p <./path/to/your/directory> -k <your key>

# decryption
./src/index.ts decrypt -p <./path/to/your/directory> -k <your key>
```

## Features

- Encrypt and decrypt directory with the key of your choosing

## What to expect in further versions

- Encryption for file and directory names
- More options concerning encryption and decryption
