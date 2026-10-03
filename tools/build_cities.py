#!/usr/bin/env python3
"""Build cities.js from GeoNames cities15000 (CC BY 4.0)."""
import io, json, sys, urllib.request, zipfile
from collections import defaultdict

URL = 'https://download.geonames.org/export/dump/'

def get(name):
    print('download', name, file=sys.stderr)
    data = urllib.request.urlopen(URL + name).read()
    if name.endswith('.zip'):
        data = zipfile.ZipFile(io.BytesIO(data)).read(name.replace('.zip', '.txt'))
    return data.decode('utf-8').splitlines()

# Load names, admin regions, cities
cn = {f[0]: f[4] for f in (l.split('\t') for l in get('countryInfo.txt') if not l.startswith('#'))}
a1 = dict(l.split('\t')[:2] for l in get('admin1CodesASCII.txt'))
rows, pop = [], defaultdict(lambda: defaultdict(int))
for l in get('cities15000.zip'):
    f = l.split('\t')
    if f[8] not in cn:
        print('skip unknown country', f[8], f[1], file=sys.stderr); continue
    rows.append((int(f[14]), f[1], a1.get(f[8] + '.' + f[10], ''), f[8], f[17]))
    pop[f[8]][f[17]] += int(f[14])
rows.sort(key=lambda r: -r[0])

# Index repeated strings
tzs, adms = sorted({r[4] for r in rows}), sorted({r[2] for r in rows})
ccs = sorted(pop, key=lambda c: -sum(pop[c].values()))
ti, ai, ci = ({v: i for i, v in enumerate(x)} for x in (tzs, adms, ccs))
lines = ['\t'.join(map(str, (r[1], ai[r[2]], ci[r[3]], ti[r[4]]))) for r in rows]
countries = [[c, cn[c], [ti[t] for t, _ in sorted(pop[c].items(), key=lambda x: -x[1])]] for c in ccs]
j = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
out = (f'// GeoNames cities15000, CC BY 4.0. Built by tools/build_cities.py\n'
       f'export const TZ={j(tzs)},ADM={j(adms)},COUNTRIES={j(countries)},ROWS={j(chr(10).join(lines))};\n')
open(sys.argv[1] if len(sys.argv) > 1 else 'cities.js', 'w').write(out)
print(len(rows), 'cities', len(countries), 'countries', len(tzs), 'zones', len(out.encode()), 'bytes', file=sys.stderr)
