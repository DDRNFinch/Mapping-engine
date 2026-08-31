from pathlib import Path
import json

ROOT = Path('.')

COURSES = {
    'ST0095': {'type':'OTJ','requiredHours':578,'source':'Skills England minimum hours for compliance'},
    'ST0264-SITE': {'type':'OTJ','requiredHours':557,'source':'Skills England minimum hours for compliance'},
    'ST0264-AJ': {'type':'OTJ','requiredHours':557,'source':'Skills England minimum hours for compliance'},
    'ST0171': {'type':'OTJ','requiredHours':418,'source':'Skills England minimum hours for compliance'},
    '6570-04': {'type':'GLH','requiredHours':394,'source':'City & Guilds 6570-04 Qualification Handbook v1.1'},
    '6570-05': {'type':'GLH','requiredHours':847,'source':'City & Guilds 6570-05 Qualification Handbook v1.1'},
}


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

# Catalogue: every course advertises the learning requirement used by Evia.
catalog_path = ROOT / 'course-catalog.json'
catalog = read_json(catalog_path)
seen = set()
for course in catalog.get('courses', []):
    cid = course.get('id')
    if cid not in COURSES:
        continue
    learning = dict(COURSES[cid])
    course['learning'] = learning
    if learning['type'] == 'GLH':
        course['glh'] = learning['requiredHours']
        if cid == '6570-05':
            course['tqt'] = 1470
    seen.add(cid)
missing = set(COURSES) - seen
if missing:
    raise SystemExit(f'catalogue missing courses: {sorted(missing)}')
write_json(catalog_path, catalog)

# Standards: put the verified OTJ minimum directly into each Evia mapping pack.
standard_packs = {
    'ST0095': ROOT / 'packs/ST0095-v1.json',
    'ST0264-SITE': ROOT / 'packs/ST0264-SITE-v1.json',
    'ST0264-AJ': ROOT / 'packs/ST0264-AJ-v1.json',
    'ST0171': ROOT / 'packs/ST0171-v1.json',
}
for cid, path in standard_packs.items():
    data = read_json(path)
    data['learning'] = dict(COURSES[cid])
    write_json(path, data)

# NVQ manifests carry the qualification-wide GLH requirement.
for cid, path in [('6570-04', ROOT/'manifest-6570-04.json'), ('6570-05', ROOT/'manifest.json')]:
    data = read_json(path)
    data['learning'] = dict(COURSES[cid])
    write_json(path, data)

# Every route pack carries the same qualification-level GLH so any scanned route can feed Evia.
for path in sorted((ROOT/'packs').glob('6570-04-*-v1.json')):
    data = read_json(path)
    data['learning'] = dict(COURSES['6570-04'])
    qualification = data.setdefault('qualification', {})
    qualification['glh'] = 394
    qualification.setdefault('tqt', 670)
    write_json(path, data)

for path in sorted((ROOT/'packs').glob('6570-05-*-v1.json')):
    data = read_json(path)
    data['learning'] = dict(COURSES['6570-05'])
    qualification = data.setdefault('qualification', {})
    qualification['glh'] = 847
    qualification['tqt'] = 1470
    write_json(path, data)

print('approved Naxos course learning-hour metadata applied')
