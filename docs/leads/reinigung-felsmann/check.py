import os
p = 'docs/leads/reinigung-felsmann/index.html'
s = os.path.getsize(p)
c = open(p, encoding='utf-8').read()
print(f'Size: {s} bytes, Lines: {c.count(chr(10))}')
for sec in ['hero','services','references','warum','kontakt','site-footer','fade-in']:
    print(f'  {sec}: {"OK" if sec in c else "MISSING"}')
print('Has style:', '<style>' in c)
print('Has /style:', '</style>' in c)
print('Has /html:', '</html>' in c)
