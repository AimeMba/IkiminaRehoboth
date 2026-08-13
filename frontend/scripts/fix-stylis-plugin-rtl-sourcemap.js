const fs = require("fs");
const path = require("path");

const packageRoot = path.join(
  __dirname,
  "..",
  "node_modules",
  "stylis-plugin-rtl"
);
const targetDir = path.join(packageRoot, "src");
const targetFile = path.join(targetDir, "stylis-rtl.ts");

const sourceContents = `import cssjanus from "cssjanus";
import {
  COMMENT,
  compile,
  DECLARATION,
  IMPORT,
  RULESET,
  serialize,
  strlen,
  KEYFRAMES,
  MEDIA,
  SUPPORTS,
} from "stylis";

function stringifyPreserveComments(element, index, children) {
  switch (element.type) {
    case IMPORT:
    case DECLARATION:
    case COMMENT:
      return (element.return = element.return || element.value);
    case RULESET: {
      element.value = Array.isArray(element.props) ? element.props.join(",") : element.props;

      if (Array.isArray(element.children)) {
        element.children.forEach((child) => {
          if (child.type === COMMENT) {
            child.children = child.value;
          }
        });
      }
    }
  }

  const serializedChildren = serialize(
    Array.prototype.concat(element.children),
    stringifyPreserveComments
  );

  return strlen(serializedChildren)
    ? (element.return = element.value + "{" + serializedChildren + "}")
    : "";
}

function stylisRTLPlugin(element, index, children, callback) {
  if (
    element.type === KEYFRAMES ||
    element.type === SUPPORTS ||
    (element.type === RULESET &&
      (!element.parent ||
        element.parent.type === MEDIA ||
        element.parent.type === RULESET))
  ) {
    const stringified = cssjanus.transform(
      stringifyPreserveComments(element, index, children)
    );

    element.children = stringified ? compile(stringified)[0].children : [];
    element.return = "";
  }
}

Object.defineProperty(stylisRTLPlugin, "name", { value: "stylisRTLPlugin" });

export default stylisRTLPlugin;
`;

if (!fs.existsSync(packageRoot)) {
  console.log("stylis-plugin-rtl is not installed; skipping sourcemap fix.");
  process.exit(0);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  fs.writeFileSync(targetFile, sourceContents, "utf8");
  console.log("Created missing stylis-plugin-rtl source file for sourcemap support.");
} else {
  console.log("stylis-plugin-rtl sourcemap source file already exists.");
}
