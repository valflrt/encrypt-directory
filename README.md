# Encrypt Directory

A simple cli program to encrypt a directory and its content, made with nodejs and typescript.

- [Encrypt Directory](#encrypt-directory)
  - [Usage](#usage)
    - [How to build/compile](#how-to-buildcompile)
    - [Example file trees](#example-file-trees)
  - [Features](#features)
  - [What to expect in further versions](#what-to-expect-in-further-versions)

## Usage

- **Commands**
  - `encrypt` or `e`
    - Encrypts a directory
    - Options
      - `--path` or `-p` – required
        - Path of the directory to encrypt
      - `--key` or `-k` – required
        - Key used to encrypt
  - `decrypt` or `d`
    - Decrypts an encrypted directory
    - Options
      - `--path` or `-p` – required
        - Path of the encrypted directory to decrypt
      - `--key` or `-k` – required
        - Key used to decrypt

Examples:

```sh
# Non-compiled
npx ts-node src/index.ts encrypt -p </directory/to/encrypt> -k <your key>
npx ts-node src/index.ts d -p </directory/to/decrypt> -k <your key>

# Compiled
./encrypt-directory e -p </directory/to/encrypt> -k <your key>
```

### How to build/compile

- Use `npm run build` in the project directory to build.
- Use `npm run build:binary` to create an executable.

### Example file trees

Before encryption:

```
test/
├── dir
│   └── bruh
└── hello
```

After encryption:

```
05lT5Xlv2bxtPpYi72EGFF_4v6s/
├── J0OWu4Dfw6m-xIfyJICmSdM4LDIH
└── QWeD11tGkZAKnYLQzityY7Xeqg
    └── y11mnG_VvveGhOhmAPKCM5UIjWM
```

## Features

- Encrypt and decrypt directory with the key of your choosing (file/directory names are also encrypted)

## What to expect in further versions

- More options concerning encryption and decryption
- Fancier log
