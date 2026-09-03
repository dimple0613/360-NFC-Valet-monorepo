const pathModule = require("path");
const themeFile = pathModule.resolve(__dirname, "src/theme/index.tsx").replace(/\\/g, "/");

module.exports = function fontAliasPlugin({ types: t }) {
  const FONT_IMPORT = "@/theme";

  return {
    visitor: {
      ImportDeclaration(path) {
        const filename = (path.hub?.file?.opts?.filename ?? "").replace(/\\/g, "/");
        if (filename.includes("node_modules")) return;
        if (filename === themeFile) return;

        const source = path.node.source.value;
        if (source !== "react-native") return;

        const specifiers = path.node.specifiers;
        const textSpecs = [];
        const otherSpecs = [];

        for (const spec of specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported.type === "Identifier" &&
            (spec.imported.name === "Text" || spec.imported.name === "TextInput")
          ) {
            textSpecs.push(spec);
          } else {
            otherSpecs.push(spec);
          }
        }

        if (textSpecs.length === 0) return;

        if (otherSpecs.length > 0) {
          path.node.specifiers = otherSpecs;
        } else {
          path.remove();
        }

        const fontImport = t.importDeclaration(
          textSpecs.map((spec) =>
            t.importSpecifier(
              t.identifier(spec.local.name),
              t.identifier(spec.imported.name),
            ),
          ),
          t.stringLiteral(FONT_IMPORT),
        );

        path.insertAfter(fontImport);
      },
    },
  };
};
