#!/usr/bin/node

import commands from "./commands";
import minimist from "minimist";

let args = minimist(process.argv.slice(2));

let command = commands.find((c) => c.matches.some((m) => !!args._.includes(m)));

(command ? command : commands.find((c) => c.name === "help")!).execute(args);
