on run
  set healthOK to false
  try
    do shell script "curl -s -m 2 http://127.0.0.1:3002/health | grep -q ok"
    set healthOK to true
  end try
  if not healthOK then
    try
      do shell script "launchctl kickstart -k gui/$(id -u)/de.klarwerk.insel"
    on error
      try
        do shell script "launchctl bootstrap gui/$(id -u) $HOME/Library/LaunchAgents/de.klarwerk.insel.plist"
      end try
    end try
    repeat with i from 1 to 30
      try
        do shell script "curl -s -m 1 http://127.0.0.1:3002/health | grep -q ok"
        set healthOK to true
        exit repeat
      end try
      delay 0.5
    end repeat
  end if
  do shell script "open http://127.0.0.1:3002"
  if not healthOK then
    display notification "Server antwortet nicht - Logs in Klarwerk_Insel/logs pruefen" with title "Klarwerk"
  end if
end run
