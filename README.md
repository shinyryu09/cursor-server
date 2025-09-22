# MCP Cursor Server

MCP (Model Context Protocol) 서버로 Xcode, Android Studio와 Cursor CLI 및 다양한 AI 모델을 연동하는 서버입니다.

## 🚀 주요 기능

- **MCP 프로토콜 지원**: 표준 MCP 프로토콜을 통한 AI 모델 연동
- **다중 AI 모델 지원**: OpenAI, Anthropic, Google, Cursor API 지원
- **프로젝트 자동 감지**: Xcode, Android Studio 프로젝트 자동 감지
- **Cursor CLI 연동**: Cursor CLI를 통한 고급 코드 생성 및 분석
- **실시간 채팅**: 스트리밍을 통한 실시간 AI 응답
- **도구 및 리소스**: 코드 분석, 리뷰, 테스트 생성 등 다양한 도구 제공

## 📋 전제 조건

- Node.js 18.0.0 이상
- macOS (Xcode 프로젝트 지원)
- Cursor CLI (선택사항)
- AI 모델 API 키 (OpenAI, Anthropic, Google, Cursor 중 하나 이상)

## 🛠️ 설치 및 설정

### 1. 저장소 클론
```bash
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
# 환경 변수 파일 복사
cp env.example .env

# .env 파일 편집
nano .env
```

필요한 API 키를 설정하세요:
```env
# 최소 하나의 AI 모델 API 키 설정
OPENAI_API_KEY=your_openai_api_key_here
# 또는
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# 또는
GOOGLE_API_KEY=your_google_api_key_here
# 또는
CURSOR_API_KEY=your_cursor_api_key_here
```

### 4. 서버 실행
```bash
# MCP 서버 시작 (stdio)
npm start

# 또는 HTTP 서버로 시작
npm start -- --http

# 개발 모드
npm run dev
```

## 🔧 사용법

### CLI 명령어

#### 서버 시작
```bash
# MCP 서버 시작 (기본)
npm start

# 특정 포트로 시작
npm start -- --port 3001

# HTTP 서버로 시작
npm start -- --http
```

#### 프로젝트 감지
```bash
# 현재 디렉토리에서 프로젝트 감지
npm run start detect

# 특정 디렉토리에서 프로젝트 감지
npm run start detect -- --dir /path/to/project
```

#### 상태 확인
```bash
# 서버 및 서비스 상태 확인
npm run start status
```

#### 설정 확인
```bash
# 현재 설정 표시
npm run start config
```

#### 로그 확인
```bash
# 최근 로그 표시
npm run start logs

# 실시간 로그 표시
npm run start logs -- --follow
```

### MCP 클라이언트 연동

#### Xcode Code Intelligence 설정
1. **시스템 환경설정** → **Intelligence** → **Add a Model Provider**
2. 다음 정보 입력:
   ```
   URL: http://localhost:3000
   API Key Header: Authorization
   API Key: Bearer your_api_key_here
   Description: MCP Cursor Server
   ```

#### Android Studio 설정
1. **File** → **Settings** → **Plugins** → **Marketplace**
2. "AI Assistant" 또는 "Code Intelligence" 플러그인 설치
3. 서버 URL 설정: `http://localhost:3000`

## 📡 API 엔드포인트

### MCP 프로토콜 엔드포인트

#### 리소스
- `resources/list` - 사용 가능한 리소스 목록
- `resources/read` - 리소스 내용 읽기
- `resources/subscribe` - 리소스 변경 구독
- `resources/unsubscribe` - 리소스 변경 구독 해제

#### 도구
- `tools/list` - 사용 가능한 도구 목록
- `tools/call` - 도구 실행

#### 프롬프트
- `prompts/list` - 사용 가능한 프롬프트 목록
- `prompts/get` - 프롬프트 가져오기

### 사용 가능한 도구

#### `detect_project`
현재 작업 디렉토리에서 프로젝트 감지
```json
{
  "name": "detect_project",
  "arguments": {
    "workingDir": "/path/to/project" // 선택사항
  }
}
```

#### `cursor_chat`
Cursor CLI를 사용한 채팅
```json
{
  "name": "cursor_chat",
  "arguments": {
    "message": "코드를 최적화해주세요",
    "files": ["/path/to/file.swift"] // 선택사항
  }
}
```

#### `ai_chat`
AI 모델을 사용한 채팅
```json
{
  "name": "ai_chat",
  "arguments": {
    "message": "Swift에서 MVVM 패턴을 구현하는 방법을 알려주세요",
    "model": "gpt-4",
    "context": "iOS 앱 개발" // 선택사항
  }
}
```

#### `analyze_code`
코드 분석 및 개선 제안
```json
{
  "name": "analyze_code",
  "arguments": {
    "filePath": "/path/to/file.swift",
    "analysisType": "performance" // syntax, performance, security, style
  }
}
```

### 사용 가능한 프롬프트

#### `code_review`
코드 리뷰 및 개선 제안
```json
{
  "name": "code_review",
  "arguments": {
    "filePath": "/path/to/file.swift"
  }
}
```

#### `bug_fix`
버그 수정 제안
```json
{
  "name": "bug_fix",
  "arguments": {
    "errorMessage": "Cannot find 'DS' in scope",
    "filePath": "/path/to/file.swift"
  }
}
```

#### `feature_implementation`
기능 구현 제안
```json
{
  "name": "feature_implementation",
  "arguments": {
    "description": "사용자 인증 기능 구현",
    "projectType": "xcode" // xcode, android
  }
}
```

## 🤖 지원하는 AI 모델

### OpenAI
- GPT-4
- GPT-4 Turbo
- GPT-3.5 Turbo

### Anthropic
- Claude 3.5 Sonnet
- Claude 3 Opus
- Claude 3 Haiku

### Google
- Gemini Pro
- Gemini Pro Vision

### Cursor
- Cursor Small
- GPT-4 (Cursor API)
- Claude 3.5 Sonnet (Cursor API)

## 🔍 프로젝트 감지

### Xcode 프로젝트
- `.xcodeproj` 파일 감지
- `.xcworkspace` 파일 감지
- `xcodebuild` 명령어로 프로젝트 정보 수집
- SRCROOT, PROJECT_DIR 등 빌드 설정 파싱

### Android 프로젝트
- `build.gradle` 파일 감지
- `settings.gradle` 파일 감지
- 프로젝트 정보 파싱 (패키지명, 버전, SDK 버전 등)

## 🚀 고급 설정

### Docker 사용
```bash
# Docker 이미지 빌드
docker build -t mcp-cursor-server .

# 컨테이너 실행
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your_key \
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
        proxy_pass http://localhost:3000;
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
   - Node.js 버전 확인: `node --version` (18.0.0 이상 필요)
   - 포트 사용 중 확인: `lsof -i :3000`
   - 로그 확인: `npm run start logs`

2. **AI 모델 응답 없음**
   - API 키 설정 확인: `npm run start config`
   - API 키 유효성 확인
   - 네트워크 연결 확인

3. **프로젝트 감지 실패**
   - 프로젝트 파일 존재 확인
   - 검색 경로 설정 확인
   - 권한 문제 확인

4. **Cursor CLI 오류**
   - Cursor 설치 확인: `cursor-agent --version`
   - PATH 설정 확인
   - 작업 디렉토리 권한 확인

### 디버깅

```bash
# 상세 로그로 서버 시작
LOG_LEVEL=debug npm start

# 상태 확인
npm run start status

# 설정 확인
npm run start config

# 로그 확인
npm run start logs -- --follow
```

## 📝 개발

### 프로젝트 구조
```
src/
├── core/           # MCP 서버 핵심
├── services/       # 비즈니스 로직
├── utils/          # 유틸리티
├── types/          # 타입 정의
├── config/         # 설정
└── server.js       # 메인 서버
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

## 📞 지원

문제가 발생하거나 질문이 있으시면 [Issues](https://github.com/shinyryu09/cursor-server/issues)에 등록해주세요.

## 🔄 업데이트 로그

### v2.0.0
- MCP 프로토콜 지원 추가
- 다중 AI 모델 지원 (OpenAI, Anthropic, Google, Cursor)
- 프로젝트 자동 감지 기능 개선
- Cursor CLI 연동 강화
- 새로운 도구 및 프롬프트 추가
- 완전히 새로운 아키텍처로 재작성