# MCP Cursor Server

MCP (Model Context Protocol) 서버로 Xcode와 Cursor Editor 및 다양한 AI 모델을 연동하는 서버입니다.

## 🚀 주요 기능

- **MCP 프로토콜 지원**: 표준 MCP 프로토콜을 통한 AI 모델 연동
- **다중 AI 모델 지원**: OpenAI, Anthropic, Google, Cursor API 지원
- **프로젝트 자동 감지**: Xcode, Android 프로젝트 자동 감지
- **Cursor Editor 연동**: Cursor Editor HTTP API를 통한 고급 코드 생성 및 분석
- **실시간 채팅**: 스트리밍을 통한 실시간 AI 응답
- **도구 및 리소스**: 코드 분석, 리뷰, 테스트 생성 등 다양한 도구 제공
- **🆕 스마트 캐시 시스템**: 토큰 사용량 최적화를 위한 다층 캐시 시스템
  - 메모리 캐시 (LRU 정책)
  - 디스크 캐시 (영구 저장)
  - Redis 캐시 (분산 환경 지원)
  - 자동 캐시 정리 및 유지보수

## 📋 전제 조건

- Node.js 18.0.0 이상
- macOS (Xcode 프로젝트 지원)
- Xcode 14.0 이상 (iOS 개발용)
- Cursor Editor (선택사항)
- AI 모델 API 키 (OpenAI, Anthropic, Google, Cursor 중 하나 이상)

## 🛠️ 설치 및 설정

### 1. Xcode 설치

#### App Store에서 설치
1. **App Store** 열기
2. "Xcode" 검색
3. **설치** 클릭 (약 15GB 다운로드)
4. 설치 완료 후 **Xcode** 실행
5. **Xcode** → **Settings** → **Accounts**에서 Apple ID 로그인

#### 명령어 도구 설치
```bash
# Xcode Command Line Tools 설치
xcode-select --install

# 설치 확인
xcode-select -p
```

#### Xcode 버전 확인
```bash
# Xcode 버전 확인
xcodebuild -version

# 설치된 시뮬레이터 확인
xcrun simctl list devices
```

### 2. 저장소 클론
```bash
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server
```

### 3. 의존성 설치
```bash
npm install
```

### 4. 환경 변수 설정
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

# Cursor Editor 연동 (선택사항)
CURSOR_EDITOR_BASE_URL=http://localhost:5000
CURSOR_EDITOR_API_KEY=your_cursor_editor_api_key_here

# 캐시 설정 (토큰 사용량 최적화)
CACHE_ENABLED=true
CACHE_MAX_MEMORY_SIZE=100
CACHE_MAX_DISK_SIZE=1000
CACHE_DEFAULT_TTL=3600
CACHE_CLEANUP_INTERVAL=300

# AI 응답 캐시 설정
CACHE_AI_RESPONSE=true
CACHE_AI_RESPONSE_TTL=3600
CACHE_INCLUDE_CONTEXT=true

# 코드 생성 캐시 설정
CACHE_CODE_GENERATION=true
CACHE_CODE_GENERATION_TTL=7200

# 코드 리뷰 캐시 설정
CACHE_CODE_REVIEW=true
CACHE_CODE_REVIEW_TTL=1800

# Redis 캐시 설정 (선택사항)
CACHE_REDIS_ENABLED=false
CACHE_REDIS_HOST=localhost
CACHE_REDIS_PORT=6379
CACHE_REDIS_PASSWORD=
CACHE_REDIS_DB=0
CACHE_REDIS_TTL=3600
```

### 5. Cursor Editor API 키 설정

#### 1. Cursor Editor에서 API 키 생성
1. **Cursor Editor** 실행
2. **Settings** → **API Keys** 선택
3. **Generate New Key** 클릭
4. 생성된 API 키를 복사

#### 2. 환경 변수 설정
```bash
# .env 파일에 추가
CURSOR_EDITOR_BASE_URL=http://localhost:5000
CURSOR_EDITOR_API_KEY=your_generated_api_key_here
```

#### 3. Cursor Editor API 서버 시작
```bash
# Cursor Editor에서 API 서버 활성화
# Settings → Developer → Enable API Server
# 또는 명령어로 시작
cursor --api-server --port 5000
```

#### 4. 연결 테스트
```bash
# 서버 상태 확인
curl http://localhost:5000/health

# API 키 테스트
curl -H "Authorization: Bearer your_api_key" \
     http://localhost:5000/api/status
```

### 6. 서버 실행
```bash
# MCP 서버 시작 (stdio)
npm start

# 또는 HTTP 서버로 시작
npm start -- --http

# 개발 모드
npm run dev
```

## 🚀 스마트 캐시 시스템

### 캐시 시스템 개요

MCP Cursor Server는 토큰 사용량을 최적화하기 위한 다층 캐시 시스템을 제공합니다:

- **메모리 캐시**: 빠른 응답을 위한 LRU (Least Recently Used) 정책
- **디스크 캐시**: 영구 저장을 위한 파일 기반 캐시
- **Redis 캐시**: 분산 환경을 위한 선택적 Redis 지원
- **자동 정리**: 만료된 캐시 자동 정리 및 유지보수

### 캐시 전략

1. **AI 응답 캐시**: 동일한 질문에 대한 응답을 캐시하여 토큰 절약
2. **코드 생성 캐시**: 유사한 요구사항의 코드 생성 결과 캐시
3. **코드 리뷰 캐시**: 동일한 코드에 대한 리뷰 결과 캐시

### 캐시 관리 도구

MCP 도구를 통해 캐시를 관리할 수 있습니다:

- `cache_stats`: 캐시 통계 조회
- `cache_clear`: 캐시 전체 삭제
- `cache_cleanup`: 만료된 캐시 정리
- `cache_maintenance`: 수동 캐시 유지보수 실행
- `cache_maintenance_status`: 캐시 유지보수 서비스 상태 조회

### 캐시 설정 최적화

```env
# 기본 캐시 설정
CACHE_ENABLED=true
CACHE_MAX_MEMORY_SIZE=100      # 메모리 캐시 최대 항목 수
CACHE_MAX_DISK_SIZE=1000       # 디스크 캐시 최대 항목 수
CACHE_DEFAULT_TTL=3600         # 기본 TTL (초)

# AI 응답 캐시 (1시간)
CACHE_AI_RESPONSE_TTL=3600

# 코드 생성 캐시 (2시간)
CACHE_CODE_GENERATION_TTL=7200

# 코드 리뷰 캐시 (30분)
CACHE_CODE_REVIEW_TTL=1800
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


#### 채팅 히스토리 관리
```bash
# 채팅 통계 확인
node src/server.js chat --stats

# 채팅 세션 목록 표시
node src/server.js chat --list

# 채팅 히스토리 검색
node src/server.js chat --search "키워드"

# 오래된 세션 정리
node src/server.js chat --cleanup

# 특정 세션 삭제
node src/server.js chat --delete session_id
```

#### 버전 관리
```bash
# 버전 정보 확인
node src/server.js version --info

# 현재 버전만 표시
node src/server.js version --show

# 패치 버전 증가 (2.0.0 → 2.0.1)
node src/server.js version --patch

# 마이너 버전 증가 (2.0.0 → 2.1.0)
node src/server.js version --minor

# 메이저 버전 증가 (2.0.0 → 3.0.0)
node src/server.js version --major
```

### MCP 클라이언트 연동

#### Xcode Code Intelligence 설정

##### 1. Xcode에서 Code Intelligence 활성화
1. **Xcode** 실행
2. **Xcode** → **Settings** (또는 **Preferences**)
3. **Code Intelligence** 탭 선택
4. **Enable Code Intelligence** 체크박스 활성화

##### 2. MCP 서버 연결
1. **Add Model Provider** 버튼 클릭
2. **Custom Server** 선택
3. 다음 정보 입력:
   ```
   Server URL: http://localhost:3000
   API Key: your_api_key_here (선택사항)
   Model: cursor-editor 또는 cursor-ai
   Description: MCP Cursor Server
   ```

##### 3. 연결 테스트
1. **Test Connection** 버튼 클릭
2. 연결 성공 시 "Connected successfully" 메시지 확인
3. **Save** 버튼으로 설정 저장

##### 4. 사용 방법
1. Xcode에서 Swift 파일 열기
2. 코드 작성 중 **Cmd + Space** 또는 **Tab** 키로 AI 제안 받기
3. 코드 블록 선택 후 **Cmd + Shift + A**로 AI 채팅 시작

### Cursor Editor 연동

#### Cursor Editor 설정
1. **Cursor Editor** 실행
2. **Settings** → **Developer** → **API Server** 활성화
3. **Port**: `5000` (기본값)
4. **API Key** 생성 및 복사

#### MCP 서버와 연동
```bash
# 환경 변수 설정
CURSOR_EDITOR_BASE_URL=http://localhost:5000
CURSOR_EDITOR_API_KEY=your_api_key_here

# 서버 시작
node src/server.js start
```

#### Cursor Editor API 사용
```bash
# Cursor Editor 상태 확인
curl http://localhost:5000/health

# 채팅 요청
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Swift 코드를 최적화해주세요",
    "context": "iOS 앱 개발"
  }'
```

#### 연동 확인
```bash
# MCP 서버 상태에서 Cursor Editor 확인
node src/server.js status

# 출력 예시:
# ✅ Cursor Editor: 사용 가능
#    Base URL: http://localhost:5000
#    타임아웃: 30000ms
```


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
    "projectType": "xcode"
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

## 📦 버전 관리

### 버전 체계
이 프로젝트는 [Semantic Versioning](https://semver.org/)을 따릅니다:
- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환성을 유지하는 기능 추가
- **PATCH**: 하위 호환성을 유지하는 버그 수정

### 버전 관리 명령어
```bash
# 버전 정보 확인
node src/server.js version --info

# 패치 버전 증가 (2.0.0 → 2.0.1)
node src/server.js version --patch

# 마이너 버전 증가 (2.0.0 → 2.1.0)
node src/server.js version --minor

# 메이저 버전 증가 (2.0.0 → 3.0.0)
node src/server.js version --major

# npm 스크립트 사용
npm run version:patch
npm run version:minor
npm run version:major
```

### 버전별 수정 사항
- **[CHANGELOG.md](./CHANGELOG.md)**: 간단한 변경 로그
- **[VERSION_HISTORY.md](./VERSION_HISTORY.md)**: 상세한 버전별 변경사항 및 마이그레이션 가이드
- **[GIT_FLOW.md](./GIT_FLOW.md)**: Git Flow 브랜치 전략 및 워크플로우

## 🚀 CI/CD 및 자동화

### GitHub Actions 워크플로우

이 프로젝트는 GitHub Actions를 사용하여 자동화된 CI/CD 파이프라인을 제공합니다.

#### 주요 워크플로우
- **CI/CD Pipeline** (`.github/workflows/ci-cd.yml`): 코드 품질 검사, 테스트, 보안 감사
- **PR Validation** (`.github/workflows/pr-validation.yml`): Pull Request 검증 및 자동 리뷰
- **Release** (`.github/workflows/release.yml`): 자동 릴리스 생성 및 배포

#### 자동화된 작업
- ✅ 코드 린팅 및 포맷팅 검사
- ✅ 단위 테스트 실행
- ✅ 보안 감사 (npm audit)
- ✅ 버전 일관성 검사
- ✅ 브레이킹 체인지 감지
- ✅ 커밋 메시지 검증
- ✅ 문서화 검사
- ✅ 성능 검사

### 릴리스 자동화

#### 자동 릴리스 스크립트
```bash
# 패치 릴리스 (버그 수정)
npm run release

# 마이너 릴리스 (새 기능)
npm run release:minor

# 메이저 릴리스 (호환성 없는 변경)
npm run release:major

# 태그와 함께 릴리스
npm run release:tag
npm run release:tag:minor
npm run release:tag:major
```

#### 릴리스 스크립트 기능
- 🔄 자동 버전 증가
- 📝 변경 로그 자동 생성
- 🏷️ Git 태그 자동 생성
- 📦 릴리스 아티팩트 생성
- 🚀 GitHub 릴리스 자동 생성
- 📊 릴리스 통계 생성

### 변경 로그 자동 생성

```bash
# 변경 로그 생성
npm run changelog:generate

# 버전 정보 표시
npm run version:info

# 버전 히스토리 생성
npm run version:history
```

#### 자동 생성되는 문서
- **CHANGELOG.md**: Keep a Changelog 형식의 변경 로그
- **VERSION_HISTORY.md**: 상세한 버전별 변경사항 및 마이그레이션 가이드
- **릴리스 노트**: GitHub 릴리스에 자동 포함

### Git Flow 정책

이 프로젝트는 Git Flow 브랜치 전략을 사용합니다:

#### 브랜치 구조
- **main**: 프로덕션 배포 가능한 안정적인 코드
- **develop**: 다음 릴리스를 위한 개발 통합 브랜치
- **feature/***: 새로운 기능 개발
- **release/***: 릴리스 준비
- **hotfix/***: 긴급 버그 수정

#### 커밋 메시지 규칙
[Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다:

```bash
# 기능 추가
git commit -m "feat(api): add chat history management endpoints"

# 버그 수정
git commit -m "fix(server): resolve memory leak in streaming responses"

# 문서 업데이트
git commit -m "docs: update installation guide for macOS"

# 리팩토링
git commit -m "refactor(services): improve error handling in AI service"

# 성능 개선
git commit -m "perf(server): optimize response streaming performance"

# CI/CD 변경
git commit -m "ci: add automated release workflow"
```

### 브랜치 보호 규칙

#### main 브랜치
- 직접 푸시 금지
- PR을 통한 병합만 허용
- 최소 1명의 리뷰 승인 필요
- CI/CD 통과 필수
- base 브랜치와 동기화 필수

#### develop 브랜치
- 직접 푸시 금지
- PR을 통한 병합만 허용
- 코드 리뷰 권장
- CI/CD 통과 필수

### 자동화된 품질 관리

#### 코드 품질
- **ESLint**: JavaScript 코드 린팅
- **Prettier**: 코드 포맷팅
- **Husky**: Git 훅을 통한 자동 검사
- **lint-staged**: 스테이징된 파일만 검사

#### 테스트 자동화
- **단위 테스트**: Jest를 사용한 자동 테스트
- **통합 테스트**: API 엔드포인트 테스트
- **성능 테스트**: 응답 시간 및 메모리 사용량 검사

#### 보안 검사
- **npm audit**: 의존성 취약점 검사
- **Dependabot**: 의존성 자동 업데이트
- **CodeQL**: 코드 보안 분석

### 배포 자동화

#### 환경별 배포
- **개발 환경**: develop 브랜치 푸시 시 자동 배포
- **스테이징 환경**: release 브랜치 생성 시 자동 배포
- **프로덕션 환경**: main 브랜치 푸시 시 자동 배포

#### 배포 파이프라인
1. **빌드**: 소스 코드 컴파일 및 패키징
2. **테스트**: 자동화된 테스트 실행
3. **배포**: 환경별 자동 배포
4. **검증**: 배포 후 헬스 체크
5. **알림**: 배포 상태 알림

### 모니터링 및 알림

#### CI/CD 상태 모니터링
- GitHub Actions 대시보드
- 빌드 상태 배지
- 실시간 알림

#### 릴리스 알림
- GitHub 릴리스 알림
- Slack/Teams 통합
- 이메일 알림

### 문제 해결

#### 일반적인 CI/CD 문제
1. **빌드 실패**: 로그 확인 및 의존성 검사
2. **테스트 실패**: 테스트 코드 및 환경 확인
3. **배포 실패**: 환경 설정 및 권한 확인
4. **릴리스 실패**: 태그 충돌 및 권한 확인

#### 디버깅 명령어
```bash
# CI/CD 로그 확인
gh run list
gh run view [run-id]

# 릴리스 상태 확인
gh release list
gh release view [tag]

# 워크플로우 상태 확인
gh workflow list
gh workflow run [workflow-name]
```

#### 자동 버전 증가 및 Git 푸시
```bash
# 패치 버전 증가 후 자동 푸시
npm run git:push

# 마이너 버전 증가 후 자동 푸시
npm run git:push:minor

# 메이저 버전 증가 후 자동 푸시
npm run git:push:major
```

## 💬 채팅 히스토리

### 기능 개요
채팅 히스토리 시스템은 모든 AI 채팅을 자동으로 저장하고 관리합니다.

### 주요 기능
- **자동 저장**: 모든 채팅 메시지 자동 저장
- **세션 관리**: 세션별 채팅 히스토리 관리
- **검색 기능**: 키워드 기반 히스토리 검색
- **통계 정보**: 채팅 사용량 및 저장소 통계
- **자동 정리**: 오래된 세션 자동 정리

### API 엔드포인트

#### 세션 관리
```bash
# 새 세션 생성
POST /api/chat/sessions

# 세션 목록 조회
GET /api/chat/sessions

# 특정 세션 조회
GET /api/chat/sessions/:sessionId

# 세션 삭제
DELETE /api/chat/sessions/:sessionId
```

#### 메시지 관리
```bash
# 메시지 저장
POST /api/chat/sessions/:sessionId/messages
{
  "message": "사용자 메시지",
  "response": "AI 응답",
  "metadata": {
    "model": "gpt-4",
    "projectType": "xcode"
  }
}
```

#### 검색 및 통계
```bash
# 히스토리 검색
GET /api/chat/search?q=키워드&limit=20

# 통계 조회
GET /api/chat/stats

# 오래된 세션 정리
POST /api/chat/cleanup
```

### 설정 옵션
```javascript
// src/services/chatHistoryService.js
{
  maxHistoryPerSession: 100,  // 세션당 최대 메시지 수
  maxSessions: 50,           // 최대 세션 수
  historyDir: './data/chat-history'  // 저장 디렉토리
}
```

### 데이터 구조
```json
{
  "sessionId": "session_1234567890_abc123",
  "createdAt": "2025-01-23T10:00:00.000Z",
  "updatedAt": "2025-01-23T10:30:00.000Z",
  "messageCount": 5,
  "messages": [
    {
      "id": "msg_1234567890_def456",
      "timestamp": "2025-01-23T10:00:00.000Z",
      "message": {
        "role": "user",
        "content": "Swift 코드를 최적화해주세요"
      },
      "response": {
        "role": "assistant",
        "content": "Swift 코드 최적화 방법을 알려드리겠습니다..."
      },
      "metadata": {
        "model": "gpt-4",
        "projectType": "xcode",
        "projectPath": "/Users/developer/MyApp"
      }
    }
  ]
}
```


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

4. **Cursor Editor 연결 오류**
   - Cursor Editor 실행 확인: `cursor --version`
   - API 서버 활성화 확인: Settings → Developer → API Server
   - 포트 충돌 확인: `lsof -i :5000`
   - API 키 유효성 확인
   - 방화벽 설정 확인

5. **Cursor CLI 오류** (레거시)
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

## ❓ FAQ

### Cursor Editor 연동 관련

**Q: Cursor Editor가 연결되지 않습니다.**
A: 다음을 확인해주세요:
1. Cursor Editor가 실행 중인지 확인
2. API 서버가 활성화되어 있는지 확인 (Settings → Developer → API Server)
3. 포트 5000이 사용 가능한지 확인: `lsof -i :5000`
4. API 키가 올바르게 설정되었는지 확인

**Q: Cursor Editor API 키는 어디서 생성하나요?**
A: Cursor Editor에서 Settings → API Keys → Generate New Key를 통해 생성할 수 있습니다.

**Q: 여러 AI 모델을 동시에 사용할 수 있나요?**
A: 네, 가능합니다. 환경 변수에 여러 API 키를 설정하면 자동으로 감지되어 사용됩니다.

**Q: 채팅 히스토리는 어디에 저장되나요?**
A: `./data/chat-history/` 디렉토리에 JSON 파일로 저장됩니다.

**Q: 서버를 재시작해도 채팅 히스토리가 유지되나요?**
A: 네, 파일 시스템에 저장되므로 서버 재시작과 관계없이 유지됩니다.

### 캐시 시스템 관련

**Q: 캐시는 어떻게 작동하나요?**
A: 캐시는 3단계로 작동합니다:
1. 메모리 캐시에서 먼저 조회 (가장 빠름)
2. 디스크 캐시에서 조회 (영구 저장)
3. Redis 캐시에서 조회 (분산 환경)

**Q: 캐시를 비활성화할 수 있나요?**
A: 네, 환경 변수에서 `CACHE_ENABLED=false`로 설정하면 캐시를 비활성화할 수 있습니다.

**Q: 캐시 크기는 어떻게 조정하나요?**
A: 환경 변수를 통해 조정할 수 있습니다:
- `CACHE_MAX_MEMORY_SIZE`: 메모리 캐시 최대 항목 수
- `CACHE_MAX_DISK_SIZE`: 디스크 캐시 최대 항목 수

**Q: 캐시가 토큰을 얼마나 절약하나요?**
A: 캐시 히트율에 따라 다르지만, 일반적으로 30-70%의 토큰 절약 효과를 볼 수 있습니다.

**Q: 캐시는 어디에 저장되나요?**
A: 
- 메모리 캐시: RAM에 저장
- 디스크 캐시: `./cache/` 디렉토리에 JSON 파일로 저장
- Redis 캐시: Redis 서버에 저장 (설정된 경우)

## 📞 지원

문제가 발생하거나 질문이 있으시면 [Issues](https://github.com/shinyryu09/cursor-server/issues)에 등록해주세요.
