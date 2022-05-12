#!/usr/bin/node

import commands from "./commands";
import { getArgs } from "./utils";

let args = getArgs();

let command = commands.find(
  (c) => args._[0] === c.name || c.aliases.some((m) => args._[0] === m)
);

(command ? command : commands.find((c) => c.name === "help")!).execute();
