# Encrypt Directory

A simple cli program to encrypt a directory and its content, made with nodejs and typescript.

- [Encrypt Directory](#encrypt-directory)
  - [Usage](#usage)
    - [How to build](#how-to-build)
    - [Example file trees](#example-file-trees)
    - [Example file content](#example-file-content)
  - [Features](#features)
  - [What to expect in further versions](#what-to-expect-in-further-versions)

## Usage

> note: you need to have node and npm installed on your computer

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
./build/index.js decrypt -p <./path/to/your/directory> -k <your key>
```

### How to build

Use `npm run build` in the project directory

### Example file trees

Before encryption:

```
./test/
├── dir
│   └── bruh
└── hello
```

After encryption:

```
./test/
├── dir
│   ├── bruh
│   └── bruh.encrypted
├── hello
└── hello.encrypted
```

### Example file content

> Encrypted using `./build/index.js encrypt -p ./test -k hello`

`hello` (non encrypted)

```
hello
```

`hello.encrypted`

```
�s��>?�X�q/Px�F��[�
```

## Features

- Encrypt and decrypt directory with the key of your choosing (encrypted files are simply renamed to `[original name].encrypted`)

## What to expect in further versions

- Encryption for file and directory names
- Encrypted files goes to a new directory named "encrypted"
- More options concerning encryption and decryption
