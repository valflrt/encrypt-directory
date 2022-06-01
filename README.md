# crypto-vault

A simple cli program to encrypt a directory and its content, made with nodejs and typescript.

- [crypto-vault](#crypto-vault)
  - [Usage](#usage)
    - [How to build/compile](#how-to-buildcompile)
    - [Example](#example)
  - [Features](#features)
  - [What to expect in further versions](#what-to-expect-in-further-versions)

## Usage

```
Usage: crypto-vault [options] [command]

simple encryption and decryption tool.

Options:
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  decrypt|d [options] <path> <key>  decrypts an encrypted file/directory
  encrypt|e [options] <path> <key>  encrypts a file/directory
  help [command]                    display help for command
```

Examples:

```sh
# Non-compiled
npx ts-node src/index.ts encrypt </directory/to/encrypt> <your key>
npx ts-node src/index.ts d </directory/to/decrypt> <your key>

# Compiled
./encrypt-directory e </directory/to/encrypt> <your key>
```

### How to build/compile

- Use `npm run build` in the project directory to build.
- Use `npm run build:binaries` to create an executable.

### Example

[See example](./example)

## Features

- Encrypt and decrypt directory with the key of your choosing (file/directory names are also encrypted)

## What to expect in further versions

- More options concerning encryption and decryption
- Fancier log
