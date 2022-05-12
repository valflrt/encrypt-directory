// command imports
import decrypt from "./decrypt";
import encrypt from "./encrypt";
import help from "./help";

/**
 * Command type declaration
 */
export interface Command {
  name: string;
  matches: string[];
  execute: () => any;
}

/**
 * Command array
 */
let commands: Command[] = [];

// Command `help`
commands.push(help);

// Command `encrypt`
commands.push(encrypt);

// Command `decrypt`
commands.push(decrypt);

export default commands;
