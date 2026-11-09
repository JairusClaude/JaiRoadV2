"""CI commands must reference existing PHP sources after backend relocation."""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class WorkflowBackendPathsTest(unittest.TestCase):
    def test_workflow_php_paths_exist(self):
        for workflow in (ROOT / '.github/workflows').glob('*.yml'):
            paths = set(re.findall(r'(?:app|tests)/[A-Za-z0-9_./-]+\.php', workflow.read_text()))
            for path in sorted(paths):
                with self.subTest(workflow=workflow.name, path=path):
                    self.assertTrue((ROOT / path).is_file(), f'{workflow.name}: missing {path}')


if __name__ == '__main__':
    unittest.main()
