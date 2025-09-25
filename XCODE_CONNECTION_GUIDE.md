# Xcode MCP 서버 연결 가이드

## 🚨 "No Models" 오류 해결

### **1. 서버 상태 확인**

서버가 정상적으로 실행 중인지 확인:
```bash
# 서버 상태 확인
curl http://localhost:3000/health

# 모델 목록 확인
curl http://localhost:3000/v1/models
```

### **2. Xcode 설정 방법**

#### **방법 1: Xcode에서 직접 설정**

1. **Xcode 열기**
2. **Preferences → Extensions → AI Assistant**
3. **서버 설정**:
   - **Server URL**: `http://localhost:3000`
   - **API Endpoint**: `/v1/chat/completions`
   - **Models Endpoint**: `/v1/models` (또는 `/models`, `/api/models`)

#### **지원되는 엔드포인트**:
- `/v1/models` - 표준 OpenAI 호환
- `/models` - 단순화된 엔드포인트
- `/api/models` - API 호환

#### **방법 2: Xcode 설정 파일 수정**

1. **Xcode 설정 파일 위치**:
   ```bash
   # macOS
   ~/Library/Preferences/com.apple.dt.Xcode.plist
   ```

2. **설정 추가**:
   ```xml
   <key>AIAssistant</key>
   <dict>
       <key>ServerURL</key>
       <string>http://localhost:3000</string>
       <key>APIEndpoint</key>
       <string>/v1/chat/completions</string>
       <key>ModelsEndpoint</key>
       <string>/v1/models</string>
   </dict>
   ```

### **3. 연결 테스트**

#### **모델 목록 테스트**:
```bash
curl -X GET http://localhost:3000/v1/models \
  -H "Content-Type: application/json"
```

#### **채팅 테스트**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cursor-default",
    "messages": [
      {
        "role": "user",
        "content": "Hello, test message"
      }
    ],
    "stream": false
  }'
```

### **4. 일반적인 문제 해결**

#### **문제 1: "No Models" 오류**
- **원인**: Xcode가 모델 목록을 가져오지 못함
- **해결**: 서버 URL과 엔드포인트 확인

#### **문제 2: 연결 실패**
- **원인**: 서버가 실행되지 않음
- **해결**: `node src/server.js start` 실행

#### **문제 3: 인증 오류**
- **원인**: API 키 설정 문제
- **해결**: 환경 변수 확인

### **5. 디버깅 방법**

#### **서버 로그 확인**:
```bash
# 실시간 로그 확인
tail -f logs/server.log

# 특정 요청 로그 확인
grep "v1/models" logs/server.log
```

#### **Xcode 로그 확인**:
```bash
# Xcode 로그 확인
log show --predicate 'process == "Xcode"' --last 1h
```

### **6. 지원되는 모델**

현재 지원되는 AI 모델:
- **cursor-default**: Cursor Editor 기본 모델
- **gpt-4**: OpenAI GPT-4
- **gpt-3.5-turbo**: OpenAI GPT-3.5 Turbo
- **claude-3-5-sonnet-20241022**: Anthropic Claude 3.5 Sonnet
- **claude-3-haiku-20240307**: Anthropic Claude 3 Haiku
- **gemini-pro**: Google Gemini Pro

### **7. 아키텍처 정보**

```
Xcode → HTTP 프록시 서버 (Port 3000) → MCP 서버 (Core) → Cursor AI
```

- **Xcode 연결**: `http://localhost:3000/v1/chat/completions`
- **모델 목록**: `http://localhost:3000/v1/models`
- **프로토콜**: HTTP REST API (OpenAI 호환)

---

**참고**: Xcode에서 "No Models" 오류가 지속되면 Xcode를 재시작하거나 설정을 다시 확인해주세요.
