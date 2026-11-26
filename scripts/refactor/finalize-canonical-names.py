#!/usr/bin/env python3
"""Normalize active JaiROADS identifiers consistently across application and test sources.
Historical migration records and compatibility readers remain intact."""
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
files = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
docs = {
    "dd-frontend-field-contract.md": "canonical-frontend-field-contract.md",
    "dd-workflows-task2.md": "canonical-workflows-task2.md",
    "dd-policy-alignment-review-2026-11-07.md": "canonical-policy-alignment-review-2026-11-07.md",
    "phase11l-strict-dd-integrity-2026-11-09.md": "phase11l-strict-canonical-integrity-2026-11-09.md",
}
legacy_audit_readers = {
    "app/Services/AuditActorIdentifier.php",
    "app/Http/Controllers/AuditHistoryController.php",
    "app/Http/Controllers/AuditLogPageController.php",
    "tests/Unit/AuditActorIdentifierTest.php",
}
extensions = {".php", ".tsx", ".ts", ".js", ".mjs", ".css", ".sql", ".py", ".sh", ".json", ".xml", ".yml", ".yaml", ".md", ".blade.php"}
roots = {"app", "bootstrap", "config", "database", "resources", "routes", "tests", "scripts", "tools", "docker"}
changed = []
for name in files:
    if not name:
        continue
    path = root / name
    if not path.is_file():
        continue
    if name.startswith("database/hosted-migration-history/") or name == "database/operator/canonical-identifier-cutover.sql" or name == "scripts/refactor/finalize-canonical-names.py":
        continue
    is_active = name.split("/")[0] in roots and path.suffix in extensions
    is_doc = name.startswith("docs/") and path.suffix == ".md"
    if not is_active and not is_doc and name not in {".env.example", "Dockerfile", "compose.free-staging.yml", "phpunit-passwords.xml", "phpunit.quarterly.xml", "phpunit.premerge-feature.xml", "phpunit.xml", "package.json", "vite.config.ts", "vite.config.mjs"}:
        continue
    original = path.read_text(encoding="utf-8")
    content = original
    for a, b in docs.items():
        content = content.replace(a, b)
    if not is_doc:
        content = content.replace("jairoads.dd-superadmin-landing", "jairoads.superadmin-home")
        content = content.replace("dd-superadmin-landing", "superadmin-home")
        content = content.replace("dd-phase3", "workspace")
        content = content.replace("dd_phase3", "workspace")
        content = content.replace("jairoads_dd_auditlog_", "jairoads_auditlog_")
        content = content.replace("dd_user_account_id", "canonical_user_account_id")
        # Rename DD-prefixed source identifiers and CSS selectors consistently,
        # not substrings in ordinary words, dependency versions, hashes or SQL date formats.
        content = re.sub(r"(?<![A-Za-z0-9])dd-(?=[a-z])", "workspace-", content)
        content = re.sub(r"(?<![A-Za-z0-9_])dd([A-Z][A-Za-z0-9_]*)\b", r"canonical\1", content)
        content = re.sub(r"(?<![A-Za-z0-9_])Dd([A-Z][A-Za-z0-9_]*)\b", r"Canonical\1", content)
        content = re.sub(r"\$dd\b", "$canonical", content)
        if name not in legacy_audit_readers:
            content = content.replace("DD-UserAccount#", "User Account #")
            content = re.sub(r"\bDD\s+(?=user\b|account\b)", "", content, flags=re.I)
            content = content.replace("DD-only", "canonical-only").replace("DD account", "user account")
        content = content.replace("JaiROADS Data Dictionary AuditLog is append-only", "JaiROADS audit log is append-only")
    if name.endswith("RoleLandingController.php"):
        content = content.replace("    private function roadMapBatch(array $actor", "    /** @param array{account_id:int,role:string,engineer_id:?int} $actor */\n    private function roadMapBatch(array $actor") if "private function roadMapBatch(array $actor" in content and "@param array{account_id:int,role:string,engineer_id:?int} $actor */\n    private function roadMapBatch" not in content else content
    if content != original:
        path.write_text(content, encoding="utf-8")
        changed.append(name)
    if is_doc and path.name in docs:
        new_path = path.with_name(docs[path.name])
        if new_path.exists():
            raise RuntimeError(f"Documentation destination already exists: {new_path}")
        path.rename(new_path)
        changed.append(str(new_path.relative_to(root)))
print(f"Normalized {len(changed)} source/documentation paths")
for name in changed:
    print(name)
# Fail if an old active URL or account link is still present. Legacy audit
# compatibility patterns, applied SQL history, and this migration are intentional.
for name in files:
    if not name or name.startswith("database/hosted-migration-history/") or name in {"scripts/refactor/finalize-canonical-names.py", "database/operator/canonical-identifier-cutover.sql"}:
        continue
    p = root / name
    if p.is_file() and name.split("/")[0] in roots and p.suffix in extensions and not name.startswith("docs/"):
        t = p.read_text(encoding="utf-8")
        if re.search(r"dd-phase3|dd-superadmin-landing|dd_user_account_id", t):
            raise RuntimeError(f"Unconverted active identifier: {name}")
