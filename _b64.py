import base64, sys 
print(base64.b64encode(sys.argv[1].encode()).decode()) 
