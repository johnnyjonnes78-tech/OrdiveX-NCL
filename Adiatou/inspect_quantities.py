import csv, glob, re
from pathlib import Path

root = Path(__file__).resolve().parent
out = root/'produits_pharma_2026-07-13_consolide.csv'

with out.open('r', encoding='utf-8-sig', newline='') as fh:
    rows = list(csv.DictReader(fh))

blanks = [r for r in rows if not (r.get('Quantite') or '').strip()]
print('blank count', len(blanks))
for r in blanks[:12]:
    code = (r.get('Code') or '').strip()
    name = (r.get('Nom') or '').strip()
    print('---', code, '|', name)
    for f in sorted(glob.glob(str(root/'*.csv'))):
        if Path(f).name == out.name:
            continue
        try:
            with open(f, 'r', encoding='utf-8-sig', newline='') as fh:
                text = fh.read()
        except Exception as e:
            continue
        first_line = text.splitlines()[0] if text.splitlines() else ''
        if '|' in first_line:
            delim = '|'
        elif ';' in first_line:
            delim = ';'
        else:
            delim = ','
        try:
            source_rows = list(csv.DictReader(text.splitlines(), delimiter=delim))
        except Exception as e:
            continue
        matches = [rr for rr in source_rows if (rr.get('Code') or rr.get('code') or rr.get('Code produit') or '').strip() == code]
        if matches:
            for rr in matches[:3]:
                print(' file', Path(f).name, 'row', rr)
            break
