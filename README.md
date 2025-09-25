# MCP Cursor Server v2.0.0

**새로운 아키텍처로 완전히 재설계된 MCP (Model Context Protocol) 서버**

표준 MCP 프로토콜을 준수하면서 로컬 Cursor AI 엔진과 통합된 고성능 서버입니다.

## 🏗️ 새로운 아키텍처

### 핵심 설계 원칙
- **표준 MCP 프로토콜 준수**: JSON-RPC over WebSocket/Stdio
- **로컬 Cursor AI 엔진 통합**: 외부 네트워크 의존도 없음
- **IDE별 전용 플러그인 지원**: Xcode, Android Studio, IntelliJ, VS Code
- **강화된 보안**: 토큰 기반 인증, 세션 격리
- **최적화된 성능**: 캐싱, 로드 밸런싱, 비동기 처리

### 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────────┐
│                    IDE Plugins                              │
│  Xcode Plugin  │  Android Studio  │  IntelliJ  │  VS Code  │
├─────────────────────────────────────────────────────────────┤
│                    Gateway Layer                            │
│  WebSocket/Stdio Adapter  │  Authentication  │  Router    │
├─────────────────────────────────────────────────────────────┤
│                    Core MCP Server                          │
│  Session Manager  │  Protocol Handler  │  Feature Handlers │
├─────────────────────────────────────────────────────────────┤
│                Cursor AI Engine (로컬)                      │
│  Local Communication  │  AI Processing  │  Project Context │
└─────────────────────────────────────────────────────────────┘
```

### 주요 컴포넌트

#### 1. Gateway Layer
- **WebSocketAdapter**: IDE 플러그인과의 실시간 통신
- **StdioAdapter**: 프로세스 간 통신을 위한 표준 입출력
- **AuthenticationLayer**: 토큰 검증 및 로컬 인증
- **RequestRouter**: IDE 감지, 프로토콜 버전 관리, 로드 밸런싱

#### 2. Core MCP Server
- **SessionManager**: IDE별 사용자 세션 관리
- **ProtocolHandler**: JSON-RPC 요청 파싱, 검증, Cursor AI 호출
- **FeatureHandlers**: refactor.code, complete.code, explain.code 등

#### 3. Cursor AI Engine
- **LocalCommunicationLayer**: IPC, HTTP/gRPC API, Shared Memory
- **AIProcessingCore**: 코드 완성, 리팩토링, 분석, 문서 생성
- **ProjectContextManager**: 파일 시스템 분석, 의존성 추적, Git 연동

## 🚀 주요 기능

### MCP 프로토콜 지원
- **표준 메서드**: initialize, tools/list, tools/call, resources/list, prompts/list
- **커스텀 도구**: refactor.code, complete.code, explain.code, test.generate
- **JSON-RPC 2.0**: 완전한 표준 준수
- **WebSocket/Stdio**: 다양한 연결 방식 지원

### IDE별 전용 플러그인
- **Xcode Plugin**: Swift, Objective-C 지원
- **Android Studio Plugin**: Kotlin, Java 지원
- **IntelliJ Plugin**: Java, Kotlin, Scala 지원
- **VS Code Plugin**: JavaScript, TypeScript, Python 지원

### 로컬 Cursor AI 엔진
- **외부 네트워크 의존도 없음**: 완전한 로컬 처리
- **프로젝트 컨텍스트 기반**: 파일 시스템, 의존성, Git 정보 활용
- **실시간 코드 분석**: 구문, 의미, 성능 분석
- **스마트 캐싱**: 자주 사용되는 패턴 캐싱

### 보안 및 성능
- **토큰 기반 인증**: IDE별 고유 토큰
- **세션 격리**: IDE별 독립적인 세션 관리
- **캐싱 레이어**: 메모리, 디스크, Redis 캐시
- **로드 밸런싱**: 라운드 로빈 방식

## 📋 전제 조건

- Node.js 18.0.0 이상
- macOS (Xcode 프로젝트 지원)
- Xcode 14.0 이상 (iOS 개발용)
- Cursor AI 엔진 (로컬 설치)
- IDE별 플러그인 지원 버전

## 🛠️ 설치 및 설정

### 1. 저장소 클론 및 의존성 설치

```bash
# 저장소 클론
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server

# 의존성 설치
npm install

# 환경 변수 설정
cp env.example .env
```

### 2. 환경 변수 설정

`.env` 파일에서 다음 값들을 설정:

```env
# Cursor AI 엔진 설정
CURSOR_AI_PATH=/Applications/Cursor.app
CURSOR_AI_ENABLED=true

# 서버 설정
PORT=3001
HOST=localhost
NODE_ENV=development

# 보안 설정
AUTH_ENABLED=true
TOKEN_EXPIRY=86400000

# 성능 설정
CACHE_ENABLED=true
CACHE_MAX_MEMORY_SIZE=100
CACHE_MAX_DISK_SIZE=1000
```

### 3. 서버 시작

```bash
# MCP 서버 시작
npm start

# 개발 모드
npm run dev

# 상태 확인
npm run start status
```

## 🔌 IDE별 플러그인 설치 및 사용

### Xcode Plugin

#### 설치
1. **Xcode** 실행
2. **Xcode** → **Settings** → **Plugins**
3. **Add Plugin** → **From File**
4. `xcode-plugin.xcplugin` 파일 선택

#### 설정
1. **Xcode** → **Settings** → **MCP Cursor**
2. 서버 설정:
   ```
   Server URL: ws://localhost:3001
   Token: xcode-token-123
   ```
3. **Test Connection** 클릭

#### 사용법
- **코드 완성**: `Cmd + Space`
- **리팩토링**: 코드 선택 후 `Cmd + Shift + R`
- **코드 설명**: 코드 선택 후 `Cmd + Shift + E`
- **테스트 생성**: `Cmd + Shift + T`

### Android Studio Plugin

#### 설치
1. **Android Studio** 실행
2. **File** → **Settings** → **Plugins**
3. **Install Plugin from Disk**
4. `android-studio-plugin.zip` 파일 선택

#### 설정
1. **File** → **Settings** → **MCP Cursor**
2. 서버 설정:
   ```
   Server URL: ws://localhost:3001
   Token: android-token-456
   ```
3. **Test Connection** 클릭

#### 사용법
- **코드 완성**: `Ctrl + Space`
- **리팩토링**: 코드 선택 후 `Ctrl + Shift + R`
- **코드 설명**: 코드 선택 후 `Ctrl + Shift + E`
- **테스트 생성**: `Ctrl + Shift + T`

### IntelliJ Plugin

#### 설치
1. **IntelliJ IDEA** 실행
2. **File** → **Settings** → **Plugins**
3. **Install Plugin from Disk**
4. `intellij-plugin.zip` 파일 선택

#### 설정
1. **File** → **Settings** → **MCP Cursor**
2. 서버 설정:
   ```
   Server URL: ws://localhost:3001
   Token: intellij-token-789
   ```
3. **Test Connection** 클릭

#### 사용법
- **코드 완성**: `Ctrl + Space`
- **리팩토링**: 코드 선택 후 `Ctrl + Shift + R`
- **코드 설명**: 코드 선택 후 `Ctrl + Shift + E`
- **테스트 생성**: `Ctrl + Shift + T`

### VS Code Plugin

#### 설치
1. **VS Code** 실행
2. **Extensions** → **Install from VSIX**
3. `vscode-plugin.vsix` 파일 선택

#### 설정
1. **File** → **Preferences** → **Settings**
2. **MCP Cursor** 검색
3. 서버 설정:
   ```json
   {
     "mcpCursor.serverUrl": "ws://localhost:3001",
     "mcpCursor.token": "vscode-token-012"
   }
   ```

#### 사용법
- **코드 완성**: `Ctrl + Space`
- **리팩토링**: 코드 선택 후 `Ctrl + Shift + R`
- **코드 설명**: 코드 선택 후 `Ctrl + Shift + E`
- **테스트 생성**: `Ctrl + Shift + T`

## 📡 MCP 프로토콜 사용법

### 기본 연결

```javascript
// WebSocket 연결
const ws = new WebSocket('ws://localhost:3001');

// 초기화 요청
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
    clientInfo: {
      name: 'my-client',
      version: '1.0.0'
    }
  },
  id: 1
}));
```

### 도구 사용

```javascript
// 코드 리팩토링
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'refactor.code',
    arguments: {
      language: 'swift',
      code: 'func example() { ... }',
      refactorType: 'extract_method',
      context: {
        filePath: '/path/to/file.swift',
        cursorPosition: { line: 10, column: 5 }
      }
    }
  },
  id: 2
}));

// 코드 완성
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'complete.code',
    arguments: {
      language: 'swift',
      code: 'func example() {',
      context: {
        filePath: '/path/to/file.swift',
        cursorPosition: { line: 1, column: 20 }
      }
    }
  },
  id: 3
}));
```

## 🔧 CLI 명령어

### 서버 관리
```bash
# 서버 시작
npm start

# 서버 상태 확인
npm run start status

# 서버 설정 확인
npm run start config

# 서버 로그 확인
npm run start logs
```

### 세션 관리
```bash
# 활성 세션 조회
npm run start sessions

# 세션 통계 조회
npm run start sessions --stats

# 세션 정리
npm run start sessions --cleanup
```

### 캐시 관리
```bash
# 캐시 통계 조회
npm run start cache --stats

# 캐시 정리
npm run start cache --clear

# 캐시 유지보수
npm run start cache --maintenance
```

## 📊 모니터링 및 통계

### 서버 통계
```bash
# 전체 통계 조회
curl http://localhost:3001/api/stats

# 세션 통계 조회
curl http://localhost:3001/api/sessions/stats

# 캐시 통계 조회
curl http://localhost:3001/api/cache/stats
```

### 로그 모니터링
```bash
# 실시간 로그 확인
npm run start logs --follow

# 특정 레벨 로그 확인
LOG_LEVEL=debug npm start

# 로그 파일 확인
tail -f logs/combined.log
```

## 🚀 고급 설정

### Docker 사용
```bash
# Docker 이미지 빌드
docker build -t mcp-cursor-server .

# 컨테이너 실행
docker run -p 3001:3001 \
  -e CURSOR_AI_PATH=/Applications/Cursor.app \
  mcp-cursor-server
```

### PM2를 사용한 프로세스 관리
```bash
# PM2 설치
npm install -g pm2

# 서버 실행
pm2 start src/server.js --name mcp-cursor-server

# 자동 시작 설정
pm2 startup
pm2 save
```

### Nginx 리버스 프록시
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🐛 트러블슈팅

### 일반적인 문제들

1. **서버 시작 실패**
   ```bash
   # Node.js 버전 확인
   node --version
   
   # 포트 사용 중 확인
   lsof -i :3001
   
   # 로그 확인
   npm run start logs
   ```

2. **Cursor AI 엔진 연결 실패**
   ```bash
   # Cursor AI 경로 확인
   ls -la /Applications/Cursor.app
   
   # 환경 변수 확인
   npm run start config
   ```

3. **플러그인 연결 실패**
   - 서버 URL 확인: `ws://localhost:3001`
   - 토큰 설정 확인
   - 방화벽 설정 확인

### 디버깅

```bash
# 상세 로그로 서버 시작
LOG_LEVEL=debug npm start

# 서버 상태 확인
npm run start status

# 설정 확인
npm run start config

# 실시간 로그 확인
npm run start logs --follow
```

## 📝 개발

### 프로젝트 구조
```
src/
├── gateway/          # Gateway Layer
│   ├── WebSocketAdapter.js
│   ├── StdioAdapter.js
│   ├── AuthenticationLayer.js
│   ├── RequestRouter.js
│   └── GatewayLayer.js
├── core/             # Core MCP Server
│   ├── SessionManager.js
│   ├── ProtocolHandler.js
│   ├── FeatureHandlers.js
│   └── CoreMCPServer.js
├── cursor-ai/        # Cursor AI Engine
│   ├── LocalCommunicationLayer.js
│   ├── AIProcessingCore.js
│   ├── ProjectContextManager.js
│   └── CursorAIEngine.js
├── services/         # 비즈니스 로직
├── utils/            # 유틸리티
├── types/            # 타입 정의
├── config/           # 설정
└── server.js         # 메인 서버
```

### 개발 모드 실행
```bash
npm run dev
```

### 테스트 실행
```bash
npm test
```

### 코드 포맷팅
```bash
npm run format
```

### 린팅
```bash
npm run lint
```

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ❓ FAQ

### 일반적인 질문

**Q: 새로운 아키텍처의 주요 장점은 무엇인가요?**
A: 
- 표준 MCP 프로토콜 완전 준수
- 로컬 Cursor AI 엔진으로 외부 네트워크 의존도 없음
- IDE별 전용 플러그인으로 최적화된 사용자 경험
- 강화된 보안 및 성능

**Q: 기존 버전에서 마이그레이션하는 방법은?**
A: 
1. 새 버전 설치
2. 환경 변수 업데이트
3. IDE 플러그인 재설치
4. 설정 마이그레이션

**Q: 여러 IDE를 동시에 사용할 수 있나요?**
A: 네, 가능합니다. 각 IDE별로 독립적인 세션과 토큰을 사용합니다.

### 플러그인 관련

**Q: 플러그인이 설치되지 않습니다.**
A: 다음을 확인해주세요:
1. IDE 버전이 지원되는지 확인
2. 플러그인 파일이 손상되지 않았는지 확인
3. IDE 완전 재시작

**Q: 서버 연결이 실패합니다.**
A: 다음을 확인해주세요:
1. MCP 서버가 실행 중인지 확인
2. 서버 URL이 올바른지 확인 (ws://localhost:3001)
3. 토큰 설정 확인

## 📞 지원

문제가 발생하거나 질문이 있으시면 [Issues](https://github.com/shinyryu09/cursor-server/issues)에 등록해주세요.

---

**MCP Cursor Server v2.0.0** - 표준 MCP 프로토콜과 로컬 Cursor AI 엔진의 완벽한 통합