
set -u -e

  pattern=relist:* command=del rescan
  redis-cli del relist:req:q
  redis-cli del relist:busy:q
  redis-cli del relist:1:req:h
  redis-cli hset relist:1:req:h text 'another test message'
  redis-cli lpush relist:req:q 1
  redis-cli lpush relist:req:q exit
  #slackUrl=http://localhost:8031 npm start
  slackUrl=$SLACK_URL slackUsername=SqueakyMonkeyBot npm start
  scanCount=1000 format=terse pattern=relist:* format=key rescan
  scanCount=1000 format=terse pattern=relist:*:q command=llen rescan
  scanCount=1000 format=terse pattern=relist:*:h command=hgetall rescan
