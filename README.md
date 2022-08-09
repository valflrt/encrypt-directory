<p align="center">
  <a href="#readme">
    <img src="./docs/assets/logo.png" height="auto">
  </a>

  <p align="center">
    <a href="https://github.com/valflrt/Fencryption/actions/workflows/build.yml"><img alt="build status" src="https://img.shields.io/github/workflow/status/valflrt/fencryption/build" /></a>
    <a href="./LICENSE"><img alt="license" src="https://img.shields.io/github/license/valflrt/fencryption" /></a>
  </p>

  <p align="center">
    <a href="https://github.com/valflrt/fencryption/issues/new"><b>Report Bug</b></a>
    <br />
    <a href="https://github.com/valflrt/Fencryption/blob/master/CHANGELOG.md"><b>Changelog</b></a>
    <br />
    <a href="https://github.com/valflrt/Fencryption/releases/latest"><b>Download</b></a>
  </p>
</p>

# Fencryption

A simple cli program to encrypt a directory or a file, made with nodejs and typescript.

**PLEASE BE CAREFUL, I MADE THIS PROGRAM ALONE AND CAN'T GUARANTEE THERE IS NO VULNERABILITY ! USE AT YOUR OWN RISK !**

- [Fencryption](#fencryption)
  - [Usage](#usage)
  - [Features](#features)
  - [Development](#development)
    - [How to build/compile](#how-to-buildcompile)
  - [License](#license)

## Usage

```
Usage: fencryption [options] [command]

A simple cli program to encrypt a file/directory

Options:
  --verbose                       enable verbose mode
  --debug                         enable debug mode
  -v, --version                   show version
  -h, --help                      display help for command

Commands:
  encrypt|e [options] <paths...>  encrypt a file/directory
  decrypt|d [options] <paths...>  decrypt an encrypted file/directory
  help [command]                  display help for command
```

You can also get help about commands using `fencryption help [command]` or `fencryption [command] --help`

## Features

- Encrypt and decrypt one or more file-s or a director-y-ies with the key of your choice

## Development

### How to build/compile

- Use `npm run build` in the project directory to build.
- Use `npm run build:binaries` to create an executable.

## License

MIT (see [LICENSE](./LICENSE))
