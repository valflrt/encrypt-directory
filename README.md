# Encrypt Directory

A simple cli program to encrypt a directory and its content, made with nodejs and typescript.

- [Encrypt Directory](#encrypt-directory)
  - [Usage](#usage)
    - [How to build/compile](#how-to-buildcompile)
    - [Example](#example)
  - [Features](#features)
  - [What to expect in further versions](#what-to-expect-in-further-versions)

## Usage

```
  help
    Displays this help panel
    Aliases: h

  encrypt <path> <key>
    Encrypts a directory
    Aliases: e

  decrypt <path> <key>
    Decrypts an encrypted directory
    Aliases: d
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
- Use `npm run build:binary` to create an executable.

### Example

[See example](./example)

## Features

- Encrypt and decrypt directory with the key of your choosing (file/directory names are also encrypted)

## What to expect in further versions

- More options concerning encryption and decryption
- Fancier log
