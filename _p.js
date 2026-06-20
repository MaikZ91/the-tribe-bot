const { execSync } = require('child_process');
execSync('git pull --rebase --autostash origin main', { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });
