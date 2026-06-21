import os

html = r'''<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Walter Felsmann GmbH & Co. KG – Gebaeudereinigung in Bielefeld seit 1978</title>
<meta name="description" content="Professionelle Gebaeudereinigung in Bielefeld: Unterhaltsreinigung, Glasreinigung, Industriereinigung. Seit ueber 40 Jahren Ihr zuverlaessiger Partner.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
'''

print("Python script started, writing HTML...")
with open('docs/leads/reinigung-felsmann/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Done writing base HTML.")
