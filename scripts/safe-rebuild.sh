#!/bin/bash
# Safe rebuild: PM2 durdur → build → PM2 başlat
# Zombie process sorununu önler (port 3000 EADDRINUSE)
set -e

cd C:/Users/Administrator/konya-emlak-portal

echo "PM2 durduruluyor..."
pm2 stop emlak-portal 2>/dev/null || true

# Port 3000'deki zombie'yi öldür (varsa)
PID=$(netstat -ano 2>/dev/null | grep ':3000.*LISTENING' | head -1 | awk '{print $NF}')
if [ -n "$PID" ] && [ "$PID" != "0" ]; then
  echo "Zombie process $PID kill ediliyor..."
  cmd.exe //c "taskkill /F /PID $PID" 2>/dev/null || true
  sleep 1
fi

echo "Build başlıyor..."
node_modules/.bin/next build

echo "PM2 başlatılıyor..."
pm2 delete emlak-portal 2>/dev/null || true
pm2 start ecosystem.config.js --only emlak-portal

sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
echo "Site durumu: HTTP $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Rebuild başar��lı"
else
  echo "✗ HATA: Site yanıt vermiyor!"
  pm2 logs emlak-portal --lines 10 --nostream
fi
