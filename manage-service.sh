#!/bin/bash

# Cursor Server 자동 실행 관리 스크립트

SERVICE_NAME="com.cursor-server"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

case "$1" in
    start)
        echo "🚀 Cursor Server 시작 중..."
        launchctl load $PLIST_PATH
        sleep 2
        if launchctl list | grep -q $SERVICE_NAME; then
            echo "✅ 서비스가 성공적으로 시작되었습니다."
            curl -s http://localhost:3000/health | jq .
        else
            echo "❌ 서비스 시작에 실패했습니다."
        fi
        ;;
    stop)
        echo "🛑 Cursor Server 중지 중..."
        launchctl unload $PLIST_PATH
        sleep 2
        if ! launchctl list | grep -q $SERVICE_NAME; then
            echo "✅ 서비스가 성공적으로 중지되었습니다."
        else
            echo "❌ 서비스 중지에 실패했습니다."
        fi
        ;;
    restart)
        echo "🔄 Cursor Server 재시작 중..."
        $0 stop
        sleep 3
        $0 start
        ;;
    status)
        echo "📊 Cursor Server 상태 확인 중..."
        if launchctl list | grep -q $SERVICE_NAME; then
            echo "✅ 서비스가 실행 중입니다."
            echo "🔗 Health check: http://localhost:3000/health"
            curl -s http://localhost:3000/health | jq .
        else
            echo "❌ 서비스가 실행되지 않고 있습니다."
        fi
        ;;
    logs)
        echo "📋 Cursor Server 로그 확인 중..."
        if [ -f "/Users/kakaovx/Documents/cursor-server/logs/server.log" ]; then
            tail -f /Users/kakaovx/Documents/cursor-server/logs/server.log
        else
            echo "❌ 로그 파일을 찾을 수 없습니다."
        fi
        ;;
    *)
        echo "사용법: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "명령어 설명:"
        echo "  start   - Cursor Server 시작"
        echo "  stop    - Cursor Server 중지"
        echo "  restart - Cursor Server 재시작"
        echo "  status  - Cursor Server 상태 확인"
        echo "  logs    - Cursor Server 로그 실시간 확인"
        exit 1
        ;;
esac
