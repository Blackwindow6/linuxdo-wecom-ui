"""Synchronize userscript release files; does not commit or push anything."""

import argparse
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", nargs="?", help="New numeric version, e.g. 0.5.11")
    parser.add_argument("--check", action="store_true", help="Only verify release files are synchronized")
    args = parser.parse_args()
    script_path = ROOT / "linuxdo-wecom.user.js"
    source = script_path.read_text(encoding="utf-8")
    current = re.search(r"^// @version\s+(\S+)$", source, re.M).group(1)
    version = args.version or current
    if not re.fullmatch(r"\d{1,9}(?:\.\d{1,9}){1,3}", version):
        parser.error("Version must contain 2-4 numeric components, e.g. 0.5.11")
    if args.version:
        parts = lambda v: tuple(([int(n) for n in v.split(".")] + [0] * 4)[:4])
        if parts(version) <= parts(current):
            parser.error("New version must be greater than the current version")
    source = re.sub(r"(?m)^(// @version\s+)\S+$", lambda m: m[1] + version, source, count=1)
    source = re.sub(r'const SCRIPT_VERSION = "[^"]+";', f'const SCRIPT_VERSION = "{version}";', source, count=1)
    metadata = source.split("// ==/UserScript==", 1)[0] + "// ==/UserScript==\n"
    readme_path = ROOT / "README.md"
    readme = re.sub(r"当前版本：\*\*[^*]+\*\*", f"当前版本：**{version}**", readme_path.read_text(encoding="utf-8"), count=1)
    files = {script_path: source, ROOT / "linuxdo-wecom.meta.js": metadata, readme_path: readme}
    if args.check:
        stale = [path.name for path, content in files.items() if not path.exists() or path.read_text(encoding="utf-8") != content]
        if stale:
            parser.exit(1, "Out of sync: " + ", ".join(stale) + "\nRun python scripts/release.py to synchronize.\n")
        print(f"OK: release {version} is synchronized")
        return
    for path, content in files.items():
        with path.open("w", encoding="utf-8", newline="\n") as output:
            output.write(content)
    print(f"Prepared {version}: " + ", ".join(path.name for path in files))
    print("Review and push these files together to main. No commit or push was performed.")


if __name__ == "__main__":
    main()
