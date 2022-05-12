export default {
  name: "help",
  matches: ["help", "h"],
  execute: () => {
    console.log(
      `Commands:

  - \`help\` or \`h\`
    - Displays this help panel

  - \`encrypt\` or \`e\`
    - Encrypts a directory
    - Options
      --path or -p – required
        Path of the directory to encrypt
      --key or -k – required
        Key used to encrypt

  - \`decrypt\` or \`d\`
    - Decrypts an encrypted directory
    - Options
        --path or -p – required
          Path of the encrypted directory to decrypt
        --key or -k – required
          Key used to decrypt`
    );
  },
};
