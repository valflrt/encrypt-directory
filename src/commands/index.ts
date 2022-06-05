import program from "../program";

// command imports
import decryptCMD from "./decrypt";
import encryptCMD from "./encrypt";

program.addCommand(encryptCMD).addCommand(decryptCMD);
