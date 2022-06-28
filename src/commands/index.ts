import program from "../program";

// command imports
import encryptCMD from "./encrypt";
import decryptCMD from "./decrypt";

program.addCommand(encryptCMD).addCommand(decryptCMD);
