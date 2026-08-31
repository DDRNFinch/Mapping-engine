from pathlib import Path
import json

ROOT = Path('.')
verified_glh = 394
route_files = sorted(Path('packs').glob('6570-04-*-v1.json'))
if len(route_files) != 6:
    raise SystemExit(f'Expected 6 6570-04 route packs, found {len(route_files)}')

changed = []
for path in route_files:
    data = json.loads(path.read_text(encoding='utf-8'))
    qualification = data.get('qualification') or {}
    if str(qualification.get('id')) != '6570-04':
        raise SystemExit(f'Unexpected qualification in {path}')
    if int(qualification.get('glh') or 0) != verified_glh:
        raise SystemExit(f'Verified GLH mismatch in {path}')
    data['learning'] = {'type': 'GLH', 'requiredHours': verified_glh}
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    changed.append(str(path))

manifest_path = Path('manifest-6570-04.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['learning'] = {'type': 'GLH', 'requiredHours': verified_glh}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
changed.append(str(manifest_path))

catalog_path = Path('course-catalog.json')
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
course = next((item for item in catalog.get('courses', []) if str(item.get('id')) == '6570-04'), None)
if not course:
    raise SystemExit('6570-04 missing from course catalog')
if int(course.get('glh') or 0) != verified_glh:
    raise SystemExit('Course catalog GLH mismatch')
course['learning'] = {'type': 'GLH', 'requiredHours': verified_glh}
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
changed.append(str(catalog_path))

print('Updated:', ', '.join(changed))
