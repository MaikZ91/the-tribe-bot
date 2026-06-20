import sys, json

html = r'''CONTENT_PLACEHOLDER'''

# Read build job
with open('docs/leads/fitness-kampfsportakademie/build-job.json', 'r', encoding='utf-8') as f:
    job = json.load(f)

# Write HTML
with open('docs/leads/fitness-kampfsportakademie/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Written OK')
