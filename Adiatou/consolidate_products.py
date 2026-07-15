import csv
import os
import re
from pathlib import Path

root = Path(__file__).resolve().parent
reference_name = 'produits_pharma_2026-07-13.csv'
output_name = 'produits_pharma_2026-07-13_consolide.csv'

canonical_columns = [
    'Code', 'Nom', 'DCI', 'Marque', 'Categorie', 'Forme',
    'Prix Vente', 'Prix Achat', 'Rx', 'Quantite', 'Peremption'
]

synonyms = {
    'Code': ['code', 'code_produit', 'id', 'identifiant'],
    'Nom': ['nom', 'name', 'produit', 'designation', 'designation_produit'],
    'DCI': ['dci', 'dci_actif', 'substance_active'],
    'Marque': ['marque', 'brand', 'fabricant'],
    'Categorie': ['categorie', 'category', 'famille', 'famille_produit'],
    'Forme': ['forme', 'shape', 'presentation'],
    'Prix Vente': ['prix vente', 'prix_vente', 'prix vente gnf', 'prixvente', 'prix de vente'],
    'Prix Achat': ['prix achat', 'prix_achat', 'prixachat', 'prix d achat', 'prix d\'achat'],
    'Rx': ['rx', 'ordonnance', 'prescription', 'ordonnance_required'],
    'Quantite': ['quantite', 'quantité', 'stock', 'quantity', 'qte'],
    'Peremption': ['peremption', 'date_peremption', 'expiry', 'date_expiration', 'date d expiration'],
}


def normalize_header(value: str) -> str:
    if value is None:
        return ''
    value = value.strip().strip('"').strip("'")
    value = re.sub(r'\s+', ' ', value)
    value = value.lower()
    value = value.replace('é', 'e').replace('è', 'e').replace('ê', 'e').replace('à', 'a').replace('ç', 'c')
    return value


def detect_delimiter(text: str) -> str:
    first_line = text.splitlines()[0] if text.splitlines() else ''
    if '|' in first_line:
        return '|'
    if ';' in first_line:
        return ';'
    return ','


def clean_value(value):
    if value is None:
        return ''
    if isinstance(value, str):
        value = value.strip().strip('"').strip("'")
        value = re.sub(r'\s+', ' ', value)
        if value.lower() in {'na', 'n/a', 'none', 'null', '-', ''}:
            return ''
        return value
    return str(value)


def clean_quantity(value):
    if value is None:
        return ''
    if isinstance(value, str):
        value = value.strip().strip('"').strip("'")
        value = re.sub(r'\s+', '', value)
        if value.lower() in {'na', 'n/a', 'none', 'null', '-', ''}:
            return ''
        if re.fullmatch(r'\d+(?:[.,]\d+)?', value):
            value = value.replace(',', '.')
            try:
                return str(int(float(value))) if float(value).is_integer() else str(float(value))
            except ValueError:
                return value
        return value
    return str(value)


def normalize_row(row):
    normalized = {}
    for canonical, aliases in synonyms.items():
        for alias in aliases:
            if alias in normalized:
                continue
            for key, value in row.items():
                if normalize_header(key) == alias:
                    if canonical == 'Quantite':
                        normalized[canonical] = clean_quantity(value)
                    else:
                        normalized[canonical] = clean_value(value)
                    break
            if canonical in normalized:
                break
    return normalized


def parse_csv(path: Path):
    encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin-1']
    text = None
    for enc in encodings:
        try:
            with path.open('r', encoding=enc, newline='') as fh:
                text = fh.read()
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError(f'Unable to decode {path.name}')
    delimiter = detect_delimiter(text)
    rows = list(csv.DictReader(text.splitlines(), delimiter=delimiter))
    return [normalize_row(row) for row in rows if row]


files = sorted([p for p in root.glob('*.csv') if p.name != output_name])
products = {}

# Load reference file first so its values have priority.
reference_path = root / reference_name
if reference_path.exists():
    files = [reference_path] + [p for p in files if p != reference_path]

for path in files:
    if not path.exists():
        continue
    print(f'Processing {path.name}')
    rows = parse_csv(path)
    for row in rows:
        code = clean_value(row.get('Code', ''))
        if not code:
            continue
        if code not in products:
            products[code] = {col: '' for col in canonical_columns}
        target = products[code]
        for col in canonical_columns:
            val = clean_value(row.get(col, ''))
            if not target[col] and val:
                target[col] = val

# Sort by code
ordered = [products[code] for code in sorted(products.keys())]

out_path = root / output_name
temp_path = root / 'produits_pharma_2026-07-13_consolide_tmp.csv'
with temp_path.open('w', encoding='utf-8-sig', newline='') as fh:
    writer = csv.DictWriter(fh, fieldnames=canonical_columns)
    writer.writeheader()
    for row in ordered:
        writer.writerow({col: row.get(col, '') for col in canonical_columns})

if out_path.exists():
    try:
        out_path.unlink()
    except PermissionError:
        pass
if temp_path.exists():
    temp_path.replace(out_path)

print(f'Wrote {len(ordered)} rows to {out_path.name}')
print('Duplicate codes removed:', len(products))
