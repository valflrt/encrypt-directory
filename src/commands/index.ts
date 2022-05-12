// command imports
import decrypt from "./decrypt";
import encrypt from "./encrypt";
import help from "./help";

/**
 * Command type declaration
 */
export interface Command {
  name: string;
  aliases: string[];
  description: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
  options?: { name: string; aliases?: string[]; description?: string }[];
  execute: () => any;
}

let commands: Command[] = [help, encrypt, decrypt];

export default commands;
