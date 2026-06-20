$html = @"
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Dental Company — Zahnarztpraxis Bielefeld | Premium Zahnmedizin</title>
</head>
<body>
<h1>Building...</h1>
</body>
</html>
"@
$html | Out-File -FilePath docs/leads/zahnarzt-thedentalcompany/index.html -Encoding utf8 -Force
Write-Host "DONE"