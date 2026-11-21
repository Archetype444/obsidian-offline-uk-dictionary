#!/usr/bin/env python3
"""Package a pre-built plugin; no network or third-party Python dependencies."""
from pathlib import Path
import zipfile
import json
import hashlib

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'manifest.json').read_text())['version']
destination = root / 'artifacts'
destination.mkdir(exist_ok=True)
archive = destination / f'offline-uk-dictionary-{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for source in sorted((root / 'dist').rglob('*')):
        if not source.is_file():
            continue
        name = 'offline-uk-dictionary/' + source.relative_to(root / 'dist').as_posix()
        info = zipfile.ZipInfo(name, (2026, 11, 21, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        output.writestr(info, source.read_bytes(), compresslevel=9)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(destination / (archive.name + '.sha256')).write_text(f'{digest}  {archive.name}\n')
print(json.dumps({'file': str(archive), 'bytes': archive.stat().st_size, 'sha256': digest}))

# Include a reproducible source archive so the build is reviewable without GitHub.
source_archive = destination / f'offline-uk-dictionary-{version}-source.zip'
roots = ['.github', 'src', 'scripts', 'data', 'licences', 'tests']
source_files = [path for path in root.iterdir() if path.is_file()]
for name in roots:
    source_files.extend(path for path in (root / name).rglob('*')
                        if path.is_file() and '__pycache__' not in path.parts)
with zipfile.ZipFile(source_archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for source in sorted(source_files):
        name = 'obsidian-offline-uk-dictionary/' + source.relative_to(root).as_posix()
        info = zipfile.ZipInfo(name, (2026, 11, 21, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        output.writestr(info, source.read_bytes(), compresslevel=9)
source_digest = hashlib.sha256(source_archive.read_bytes()).hexdigest()
(destination / (source_archive.name + '.sha256')).write_text(f'{source_digest}  {source_archive.name}\n')
print(json.dumps({'file': str(source_archive), 'bytes': source_archive.stat().st_size, 'sha256': source_digest}))
