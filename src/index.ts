#!/usr/bin/node

import commands from "./commands";
import { getArgs } from "./utils";

let args = getArgs();

let command = commands.find((c) => c.matches.some((m) => !!args._.includes(m)));

(command ? command : commands.find((c) => c.name === "help")!).execute();
