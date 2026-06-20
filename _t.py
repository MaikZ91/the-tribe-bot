import os
f = open(os.path.join('docs','leads','koeln-die-maler','index.html'), 'w', encoding='utf-8')
f.write('HELLO_FROM_PYTHON')
f.close()
print('DONE')
