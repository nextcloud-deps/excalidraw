const fs = require("fs");
const path = require("path");

const IMPORT_REWRITES = new Map([
  ["@excalidraw/common", "@nextcloud/excalidraw-common"],
  ["@excalidraw/element", "@nextcloud/excalidraw-element"],
  ["@excalidraw/math", "@nextcloud/excalidraw-math"],
  ["@excalidraw/utils", "@nextcloud/excalidraw-utils"],
  ["@excalidraw/excalidraw", "@nextcloud/excalidraw"],
]);

const REWRITABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".d.ts",
  ".d.mts",
  ".d.cts",
]);

const getExtension = (filePath) => {
  if (filePath.endsWith(".d.ts")) {
    return ".d.ts";
  }
  if (filePath.endsWith(".d.mts")) {
    return ".d.mts";
  }
  if (filePath.endsWith(".d.cts")) {
    return ".d.cts";
  }
  return path.extname(filePath);
};

const rewriteFile = (filePath) => {
  const ext = getExtension(filePath);
  if (!REWRITABLE_EXTENSIONS.has(ext)) {
    return 0;
  }

  const original = fs.readFileSync(filePath, "utf8");
  let rewritten = original;

  for (const [from, to] of IMPORT_REWRITES) {
    rewritten = rewritten.split(from).join(to);
  }

  if (rewritten === original) {
    return 0;
  }

  fs.writeFileSync(filePath, rewritten, "utf8");
  return 1;
};

// Recursively walks through and rewrites imports in files
const walk = (dirPath) => {
  let rewrites = 0;

  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, dirent.name);
    if (dirent.isDirectory()) {
      rewrites += walk(fullPath);
    } else if (dirent.isFile()) {
      rewrites += rewriteFile(fullPath);
    }
  }

  return rewrites;
};

const target = process.argv[2];

if (!target) {
  process.stderr.write(
    "Usage: node scripts/rewriteInternalPackageImports.js <directory>\n",
  );
  process.exit(1);
}

const resolvedTarget = path.resolve(process.cwd(), target);

if (!fs.existsSync(resolvedTarget)) {
  process.stderr.write(`Directory does not exist: ${resolvedTarget}\n`);
  process.exit(1);
}

if (!fs.statSync(resolvedTarget).isDirectory()) {
  process.stderr.write(`Expected a directory path: ${resolvedTarget}\n`);
  process.exit(1);
}

const filesRewritten = walk(resolvedTarget);
process.stdout.write(
  `Rewrote imports in ${filesRewritten} file(s) in ${resolvedTarget}\n`,
);
