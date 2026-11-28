"""Restore ONLY public, previously verified geographic assets from an APK artifact.

The caller checks the complete GitHub artifact SHA-256 before calling this script,
then checks all per-tile and network digests with build-open-map-packs.py.
No APK application code, keys, or private workspace records are copied.
"""
import io
import pathlib
import shutil
import sys
import zipfile

MAX_APK_BYTES = 180 * 1024 * 1024
MAX_MAP_BYTES = 180 * 1024 * 1024
PREFIX = "assets/bundled-maps/"


def main():
    source, destination = map(pathlib.Path, sys.argv[1:])
    if destination.exists():
        raise RuntimeError("Map destination must not already exist")
    with zipfile.ZipFile(source) as artifact:
        packages = [
            item for item in artifact.infolist()
            if not item.is_dir() and item.filename.endswith(".apk")
        ]
        if len(packages) != 1 or packages[0].file_size > MAX_APK_BYTES:
            raise RuntimeError("Unexpected seed APK")
        with zipfile.ZipFile(io.BytesIO(artifact.read(packages[0]))) as apk:
            entries = [
                entry for entry in apk.infolist()
                if entry.filename.startswith(PREFIX) and not entry.is_dir()
            ]
            if not entries or len(entries) > 60005:
                raise RuntimeError("Unexpected map bundle entry count")
            if sum(entry.file_size for entry in entries) > MAX_MAP_BYTES:
                raise RuntimeError("Map bundle exceeds byte budget")
            paths = set()
            destination.mkdir(parents=True)
            try:
                for entry in entries:
                    rel = pathlib.PurePosixPath(entry.filename[len(PREFIX):])
                    if rel.is_absolute() or not rel.parts or ".." in rel.parts or "\\" in str(rel):
                        raise RuntimeError("Invalid map path")
                    if rel in paths or rel.suffix not in {".json", ".jpg", ".png", ".webp"}:
                        raise RuntimeError("Unexpected or duplicate map asset")
                    paths.add(rel)
                    target = destination.joinpath(*rel.parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with apk.open(entry) as contents, target.open("xb") as output:
                        shutil.copyfileobj(contents, output)
                if not {"manifest.json", "road-network.json"}.issubset({str(p) for p in paths}):
                    raise RuntimeError("Map manifest or network missing")
            except Exception:
                shutil.rmtree(destination)
                raise
    print("Restored", len(paths), "public map assets; full manifest verification follows.")


if __name__ == "__main__":
    main()
