import { appendFileSync } from "node:fs";

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function validateReleaseVersion(version) {
  if (typeof version !== "string" || !SEMVER.test(version)) {
    throw new Error(
      "Release version must be valid semantic versioning (for example, 0.2.0 or 1.0.0-rc.1). Do not include the leading 'v'.",
    );
  }
  return version;
}

export function validateReleaseNotes(notes) {
  if (typeof notes !== "string" || notes.trim().length === 0) {
    throw new Error("Release notes must not be empty.");
  }
  return notes.trim();
}

function main() {
  const version = validateReleaseVersion(process.env.ATLAS_RELEASE_VERSION);
  const notes = validateReleaseNotes(process.env.ATLAS_RELEASE_NOTES);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      \`version=\${version}\ntag=v\${version}\n\`,
      "utf8",
    );
  }

  console.log(\`Validated Atlas release v\${version}.\`);
  console.log(\`Release notes: \${notes.length} characters.\`);
}

if (process.argv[1] && import.meta.url === new URL(\`file://\${process.argv[1]}\`).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
