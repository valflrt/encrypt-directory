# Fencryption

A simple cli program to encrypt a directory or a file, made with nodejs and typescript.

- [Fencryption](#fencryption)
  - [Usage](#usage)
    - [CLI](#cli)
    - [How to build/compile](#how-to-buildcompile)
  - [Features](#features)

## Usage

### CLI

```
Usage: fencryption [options] [command]

A simple cli program to encrypt a directory and its content, made with nodejs and typescript.

Options:
  -V, --version                     output the version number
  --verbose                         verbose mode
  --debug                           debug mode
  -h, --help                        display help for command

Commands:
  decrypt|d [options] <path> <key>  decrypts an encrypted file/directory
  encrypt|e [options] <path> <key>  encrypts a file/directory
  help [command]                    display help for command
```

You can also get help about commands using `fencryption help [command]` or `fencryption [command] --help`

### How to build/compile

- Use `npm run build` in the project directory to build.
- Use `npm run build:binaries` to create an executable.

## Features

- Encrypt and decrypt a file or a directory with the key of your choice (when encrypting a directory, file/directory names are also encrypted)
