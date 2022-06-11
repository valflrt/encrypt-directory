# Changelog

## v1.4.4

- Improve help descriptions
- Fix commands encrypt and decrypt: they were displaying success message before the encryption/decryption was really finished

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.4.3...v1.4.4)

## v1.4.3

- Fix encryption methods: when encrypting and decrypting a stream, only first chunk was encrypted/decrypted and the process remained stuck
- Change loader style

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.4.2...v1.4.3)

## v1.4.2

- Rework encryption methods so wrong key on decryption can be detected

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.4.1...v1.4.2)

## v1.4.1

- Slightly edit logger
- Edit README

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.4.0...v1.4.1)

## v1.4.0

- Files are not longer encrypted in base64 (was making files very very heavier than without it)
- Implement data streams support to be able to encrypt/decrypt much heavier files (in theory infinite file size)
- Remove gzip support

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.3.6...v1.4.0)

## v1.3.5 and v1.3.6

- Miscellaneous changes

[full changelog v1.3.4...v1.3.5](https://github.com/valflrt/Fencryption/compare/v1.3.4...v1.3.5)

[full changelog v1.3.5...v1.3.6](https://github.com/valflrt/Fencryption/compare/v1.3.5...v1.3.6)

## v1.3.4

- Add binaries auto build
- Change the way commands are imported

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.3.3...v1.3.4)

## v1.3.3

- Rework logger

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.3.2...v1.3.3)

## v1.3.2

- Miscellaneous changes

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.3.1...v1.3.2)

## v1.3.1

- Switch from manual parsing and command handling to commander.js
- Can now encrypt a file on its own
- Greatly improve log (more readable and add colors)
- Add gzip compression support (disable with --no-compression)
- Add loader
- Add LICENSE

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.2.0...v1.3.1)

## v1.2.0

- Path and key are now treated as arguments, no need to add `--key` and such anymore

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.1.1...v1.2.0)

## v1.1.1

- Miscellaneous performance improvements

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.0.1...v1.1.0)

## v1.1.0

- When encrypting, file/directory names are now encrypted too

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.0.1...v1.1.0)

## v1.0.1

- Miscellaneous fixes

[full changelog](https://github.com/valflrt/Fencryption/compare/v1.0.0...v1.0.1)

## v1.0.0

- Add base features: encrypting and decrypting a directory only

[full changelog](https://github.com/valflrt/Fencryption/commits/v1.0.0)
