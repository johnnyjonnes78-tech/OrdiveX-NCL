import csv
from pathlib import Path

infile = Path('produits_pharma_2026-07-13_consolide.csv')
with infile.open('r', encoding='utf-8-sig', newline='') as fh:
    rows = list(csv.DictReader(fh))

updated = 0
for row in rows:
    if not (row.get('Quantite') or '').strip():
        row['Quantite'] = '0'
        updated += 1

with infile.open('w', encoding='utf-8-sig', newline='') as fh:
    writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print('updated rows', updated)
