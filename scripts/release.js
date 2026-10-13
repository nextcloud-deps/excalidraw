const fs = require("fs");
const path = require("path");

const { execFileSync, execSync } = require("child_process");

const updateChangelog = require("./updateChangelog");

// used for getting the package.json files while building
// skipping utils for now, as it has independent release process
const PACKAGES = [
  "common",
  "fractional-indexing",
  "math",
  "element",
  "excalidraw",
];

// used for rewriting versions in package.json
const PACKAGES_RENAMED = [
  "excalidraw-common",
  "excalidraw-fractional-indexing",
  "excalidraw-math",
  "excalidraw-element",
  "excalidraw",
];
const PACKAGES_DIR = path.resolve(__dirname, "../packages");

/**
 * Returns the arguments for the release script.
 *
 * Usage examples:
 * - yarn release --help                          -> prints this help message
 * - yarn release                                 -> publishes `@excalidraw` packages with "test" tag and "-[hash]" version suffix
 * - yarn release --tag=test                      -> same as above
 * - yarn release --tag=next                      -> publishes `@excalidraw` packages with "next" tag and version "-[hash]" suffix
 * - yarn release --tag=next --non-interactive    -> skips interactive prompts (runs on CI/CD), otherwise same as above
 * - yarn release --tag=latest --version=0.19.0   -> publishes `@excalidraw` packages with "latest" tag and version "0.19.0" & prepares changelog for the release
 * - yarn release --tag=whiteboard-3              -> publishes `@nextcloud` packages with "whiteboard-3" tag and the version from packages/excalidraw/package.json
 * - yarn release --tag=whiteboard-3 --pack=<dir> -> builds and packs the packages into <dir>, without prompts and without publishing
 *
 * @returns [tag, version, nonInteractive, packDir]
 */
const getArguments = () => {
  let tag = "test";
  let version = "";
  let nonInteractive = false;
  let packDir = "";

  for (const argument of process.argv.slice(2)) {
    if (/--help/.test(argument)) {
      console.info(`Available arguments:
  --tag=<tag>                                    -> (optional) "test" (default), "next" for auto release, "latest" for stable release
  --version=<version>                            -> (optional) for "next" and "test", (required) for "latest" i.e. "0.19.0"
  --non-interactive                              -> (optional) disables interactive prompts
  --pack=<dir>                                   -> (optional) packs the packages into <dir> instead of publishing`);

      console.info(`\nUsage examples:
  - yarn release                                 -> publishes \`@excalidraw\` packages with "test" tag and "-[hash]" version suffix
  - yarn release --tag=test                      -> same as above
  - yarn release --tag=next                      -> publishes \`@excalidraw\` packages with "next" tag and version "-[hash]" suffix
  - yarn release --tag=next --non-interactive    -> skips interactive prompts (runs on CI/CD), otherwise same as above
  - yarn release --tag=latest --version=0.19.0   -> publishes \`@excalidraw\` packages with "latest" tag and version "0.19.0" & prepares changelog for the release`);

      process.exit(0);
    }

    if (/--tag=/.test(argument)) {
      tag = argument.split("=")[1];
    }

    if (/--version=/.test(argument)) {
      version = argument.split("=")[1];
    }

    if (/--non-interactive/.test(argument)) {
      nonInteractive = true;
    }

    if (/--pack=/.test(argument)) {
      packDir = path.resolve(argument.split("=")[1]);
    }
  }

  if (
    tag !== "latest" &&
    tag !== "next" &&
    tag !== "test" &&
    tag !== "whiteboard-3"
  ) {
    console.error(
      `Unsupported tag "${tag}", use "latest", "next", "test" or "whiteboard-3".`,
    );
    process.exit(1);
  }

  if (tag === "latest" && !version) {
    console.error("Pass the version to make the latest stable release!");
    process.exit(1);
  }

  if (!version && tag === "whiteboard-3") {
    version = require(getPackageJsonPath("excalidraw")).version;
  }

  if (!version) {
    // set the next version based on the excalidraw package version + commit hash
    const excalidrawPackageVersion = require(getPackageJsonPath(
      "excalidraw",
    )).version;

    const hash = getShortCommitHash();

    if (!excalidrawPackageVersion.includes(hash)) {
      version = `${excalidrawPackageVersion}-${hash}`;
    } else {
      // ensuring idempotency
      version = excalidrawPackageVersion;
    }
  }

  console.info(`Running with tag "${tag}" and version "${version}"...`);

  return [tag, version, nonInteractive, packDir];
};

const validatePackageName = (packageName) => {
  if (!PACKAGES.includes(packageName)) {
    console.error(`Package "${packageName}" not found!`);
    process.exit(1);
  }
};

const getPackageJsonPath = (packageName) => {
  validatePackageName(packageName);
  return path.resolve(PACKAGES_DIR, packageName, "package.json");
};

const updatePackageJsons = (nextVersion) => {
  const packageJsons = new Map();

  for (const packageName of PACKAGES) {
    const pkg = require(getPackageJsonPath(packageName));

    pkg.version = nextVersion;

    if (pkg.dependencies) {
      for (const dependencyName of PACKAGES_RENAMED) {
        if (!pkg.dependencies[`@nextcloud/${dependencyName}`]) {
          continue;
        }

        pkg.dependencies[`@nextcloud/${dependencyName}`] = nextVersion;
      }
    }

    packageJsons.set(packageName, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  // modify once, to avoid inconsistent state
  for (const packageName of PACKAGES) {
    const content = packageJsons.get(packageName);
    fs.writeFileSync(getPackageJsonPath(packageName), content, "utf-8");
  }
};

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const askToCommit = (tag, nextVersion) => {
  if (tag !== "latest") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "Would you like to commit these changes to git? (Y/n): ",
      (answer) => {
        rl.close();

        if (answer.toLowerCase() === "y") {
          execSync(`git add -u`);
          execSync(
            `git commit -m "chore: release @excalidraw/excalidraw@${nextVersion} 🎉"`,
          );
        } else {
          console.warn(
            "Skipping commit. Don't forget to commit manually later!",
          );
        }

        resolve();
      },
    );
  });
};

const buildPackages = () => {
  console.info("Running yarn install...");
  execSync(`yarn --frozen-lockfile`, { stdio: "inherit" });

  console.info("Removing existing build artifacts...");
  execSync(`yarn rm:build`, { stdio: "inherit" });

  for (const packageName of PACKAGES) {
    console.info(`Building "${packageName}"...`);
    execSync(`yarn run build:esm`, {
      cwd: path.resolve(PACKAGES_DIR, packageName),
      stdio: "inherit",
    });
  }
};

const askToPublish = (tag, version) => {
  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "Would you like to publish these changes to npm? (Y/n): ",
      (answer) => {
        rl.close();

        if (answer.toLowerCase() === "y") {
          publishPackages(tag, version);
        } else {
          console.info("Skipping publish.");
        }

        resolve();
      },
    );
  });
};

const isPublished = (name, version) => {
  try {
    return (
      execSync(
        `npm view ${name}@${version} version --registry https://registry.npmjs.org/`,
      )
        .toString()
        .trim() === version
    );
  } catch {
    return false;
  }
};

const publishPackages = (tag, version) => {
  for (const packageName of PACKAGES) {
    const { name } = require(getPackageJsonPath(packageName));

    // versions are fixed per commit, so a push without a version bump is a no-op
    if (isPublished(name, version)) {
      console.info(`Skipping "${name}@${version}", already published.`);
      continue;
    }

    execSync(
      `npm publish --tag ${tag} --access public --registry https://registry.npmjs.org/`,
      {
        cwd: path.resolve(PACKAGES_DIR, packageName),
        stdio: "inherit",
      },
    );

    console.info(`Published "${name}@${tag}" with version "${version}"! 🎉`);
  }
};

const packPackages = (packDir) => {
  fs.mkdirSync(packDir, { recursive: true });

  for (const packageName of PACKAGES) {
    execFileSync("npm", ["pack", "--pack-destination", packDir], {
      cwd: path.resolve(PACKAGES_DIR, packageName),
      stdio: "inherit",
    });
  }
};

/** main */
(async () => {
  const [tag, version, nonInteractive, packDir] = getArguments();

  buildPackages();

  if (tag === "latest") {
    await updateChangelog(version);
  }

  updatePackageJsons(version);

  if (packDir) {
    packPackages(packDir);
  } else if (nonInteractive) {
    publishPackages(tag, version);
  } else {
    await askToCommit(tag, version);
    await askToPublish(tag, version);
  }
})();
