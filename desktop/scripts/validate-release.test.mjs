import test from "node:test";
import assert from "node:assert/strict";
import {
  validateReleaseNotes,
  validateReleaseVersion,
} from "./validate-release.mjs";

test("accepts stable and prerelease semantic versions", () => {
  assert.equal(validateReleaseVersion("0.2.0"), "0.2.0");
  assert.equal(validateReleaseVersion("1.0.0-rc.1"), "1.0.0-rc.1");
});

test("rejects malformed versions and a v prefix", () => {
  for (const version of ["v0.2.0", "1.2", "01.2.3", "1.2.3-01"]) {
    assert.throws(() => validateReleaseVersion(version));
  }
});

test("requires non-empty release notes", () => {
  assert.equal(validateReleaseNotes("  Initial release  "), "Initial release");
  assert.throws(() => validateReleaseNotes("   "));
});
