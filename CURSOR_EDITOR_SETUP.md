# Cursor Editor MCP 서버 연결 가이드

## 🎯 Cursor Editor 전용 MCP 서버

MCP Cursor Server는 이제 Cursor Editor와의 통신을 위해 최적화되었습니다.

### **1. 서버 시작**

```bash
# 프로젝트 디렉토리에서
node src/server.js start
```

서버가 시작되면 다음 메시지가 표시됩니다:
```
🚀 MCP Cursor Server 시작 중...
✅ MCP 서버가 성공적으로 시작되었습니다!
MCP HTTP 서버가 시작되었습니다: http://localhost:3001 (Cursor Editor 전용)
```

### **2. Cursor Editor 연결 설정**

#### **방법 1: Cursor Editor 설정에서 MCP 서버 추가**

1. **Cursor Editor 열기**
2. **설정 (Settings) → Extensions → MCP Servers**
3. **"Add Server" 클릭**
4. **다음 정보 입력**:
   - **Name**: `cursor-server`
   - **Command**: `node`
   - **Args**: `["src/server.js", "start"]`
   - **Working Directory**: `/Users/kakaovx/Documents/cursor-server`
   - **Environment Variables**: `NODE_ENV=development`

#### **방법 2: 설정 파일 사용**

1. **Cursor Editor 설정 디렉토리로 이동**:
   ```bash
   # macOS
   ~/.cursor/mcp_servers.json
   
   # Windows
   %APPDATA%\Cursor\User\mcp_servers.json
   
   # Linux
   ~/.config/cursor/mcp_servers.json
   ```

2. **설정 파일에 다음 내용 추가**:
   ```json
   {
     "mcpServers": {
       "cursor-server": {
         "command": "node",
         "args": ["src/server.js", "start"],
         "cwd": "/Users/kakaovx/Documents/cursor-server",
         "env": {
           "NODE_ENV": "development"
         }
       }
     }
   }
   ```

### **3. 지원되는 MCP 기능**

#### **핵심 메서드**
- **`initialize`**: 서버 초기화 및 기능 목록
- **`tools/list`**: 사용 가능한 도구 목록
- **`tools/call`**: 도구 실행
- **`resources/list`**: 리소스 목록
- **`resources/read`**: 리소스 읽기

#### **사용 가능한 도구**
- **`cursor_chat`**: Cursor 기본 모델 채팅
- **`ai_chat`**: AI 모델 채팅 (OpenAI, Anthropic, Google)
- **`detect_project`**: 프로젝트 타입 감지
- **`analyze_code`**: 코드 분석 (Swift, Kotlin, JavaScript 등)
- **`generate_code`**: 코드 생성
- **`review_code`**: 코드 리뷰

#### **사용 가능한 AI 모델**
- **cursor-default**: Cursor Editor 기본 모델
- **gpt-4**: OpenAI GPT-4
- **gpt-3.5-turbo**: OpenAI GPT-3.5 Turbo
- **claude-3-5-sonnet-20241022**: Anthropic Claude 3.5 Sonnet
- **claude-3-haiku-20240307**: Anthropic Claude 3 Haiku
- **gemini-pro**: Google Gemini Pro

### **4. 연결 테스트**

#### **서버 상태 확인**:
```bash
curl http://localhost:3001/health
```

#### **MCP 프로토콜 테스트**:
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{"method": "initialize", "params": {}, "id": 1}'
```

#### **도구 목록 조회**:
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "id": 1}'
```

### **5. Cursor Editor에서 사용하기**

1. **MCP 서버 연결 확인**: Cursor Editor 하단 상태바에서 MCP 서버 상태 확인
2. **채팅 사용**: Cursor Editor의 채팅 기능에서 AI 모델과 대화
3. **코드 분석**: 파일을 열고 MCP 도구를 통해 코드 분석 요청
4. **프로젝트 감지**: MCP 서버가 자동으로 프로젝트 타입을 감지하고 적절한 도구 제공

### **6. 문제 해결**

#### **연결 실패**:
- 서버가 포트 3001에서 실행 중인지 확인
- 방화벽 설정 확인
- Cursor Editor 재시작

#### **MCP 서버 인식 안됨**:
- 설정 파일 경로 확인
- JSON 형식 오류 확인
- Cursor Editor 로그 확인

#### **도구 사용 불가**:
- 서버 로그 확인 (`logs/server.log`)
- MCP 서버 재시작
- Cursor Editor 재연결

### **7. 아키텍처 특징**

- **단순화된 구조**: Cursor Editor 전용으로 최적화
- **MCP 프로토콜 표준**: JSON-RPC 1.0, 2.0 완전 지원
- **HTTP 전송**: stdio 대신 HTTP를 통한 MCP 통신
- **자동 초기화**: 필요시 MCP 서버 자동 초기화
- **에러 처리**: 표준 MCP 오류 코드 및 메시지

### **8. 개발자 정보**

- **서버 포트**: 3001
- **프로토콜**: MCP over HTTP
- **JSON-RPC 버전**: 1.0, 2.0
- **지원 클라이언트**: Cursor Editor
- **로그 파일**: `logs/server.log`

---

**참고**: 이 MCP 서버는 Cursor Editor와의 통신을 위해 특별히 설계되었습니다. 다른 클라이언트(Xcode, Android Studio 등)와의 호환성은 보장되지 않습니다.

