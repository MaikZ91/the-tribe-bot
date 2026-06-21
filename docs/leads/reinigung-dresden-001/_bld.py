  
import json,os,sys  
BASE=os.path.dirname(os.path.abspath(__file__))  
bj=json.load(open(os.path.join(BASE,'build-job.json')))  
N,P,E,A=bj['name'],bj['phone'],bj['email'],bj['address']  
HERO=bj['images'][5]  
ICO=bj['images'][:5]  
OPPS=bj['opps']  
O1,O2,O3,O4,O5=OPPS[0],OPPS[1],OPPS[2],OPPS[3],OPPS[4]  
print('OK:',N,HERO)  

# HTML builder
