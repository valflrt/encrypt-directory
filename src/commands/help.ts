import commands, { Command } from ".";

/**
 * Writes indents
 * @param number number of indents
 */
let idt = (number: number = 1) => "  ".repeat(number);

let help: Command = {
  name: "help",
  aliases: ["h"],
  description: "Displays this help panel",
  execute: () => {
    console.log(
      commands
        .map((c) =>
          idt()
            .concat(c.name)
            .concat(
              c.arguments
                ? ` ${c.arguments
                    .map((a) => `<${a.name}${a.required === false ? "?" : ""}>`)
                    .join(" ")}`
                : ""
            )
            .concat(
              c.description ? "\n".concat(idt(2)).concat(c.description) : ""
            )
            .concat("\n")
            .concat(
              c.aliases ? idt(2).concat(`Aliases: ${c.aliases.join(", ")}`) : ""
            )
            .concat(
              c.options && c.options.length !== 0
                ? `\n${idt(2)}Options:\n`.concat(
                    c.options
                      .map((o) =>
                        idt(3)
                          .concat(
                            o.name.length > 1 ? `--${o.name}` : `-${o.name}`
                          )
                          .concat(o.description ? ` – ${o.description}` : "")
                          .concat(
                            o.aliases && o.aliases.length !== 0
                              ? `\n${idt(4)}Aliases: `.concat(
                                  o.aliases
                                    .map((a) =>
                                      a.length > 1 ? `--${a}` : `-${a}`
                                    )
                                    .join(", ")
                                )
                              : ""
                          )
                      )
                      .join("\n")
                  )
                : ""
            )
        )
        .join("\n\n")
    );
  },
};

export default help;
