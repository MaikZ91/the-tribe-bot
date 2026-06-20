import os
d = r'C:\Users\Maik Zschach\the-tribe\docs\leads'
dirs = [x for x in os.listdir(d) if os.path.isdir(os.path.join(d,x)) and x != 'dashboard']
done = [x for x in dirs if os.path.exists(os.path.join(d,x,'index.html')) and os.path.getsize(os.path.join(d,x,'index.html')) > 100]
empty = [x for x in dirs if x not in done]
print(f'{len(done)} DONE, {len(empty)} EMPTY, {len(dirs)} TOTAL')
for x in sorted(done):
    sz = os.path.getsize(os.path.join(d,x,'index.html'))
    print(f'  DONE: {x} ({sz} bytes)')
for x in sorted(empty)[:5]:
    print(f'  EMPTY: {x}')
if len(empty) > 5:
    print(f'  ... +{len(empty)-5} more empty')
