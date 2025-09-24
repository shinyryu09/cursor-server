# MCP Cursor Server

MCP (Model Context Protocol) 서버로 Xcode와 다양한 AI 모델을 연동하는 서버입니다.

## 🚀 주요 기능

- **MCP 프로토콜 지원**: 표준 MCP 프로토콜을 통한 AI 모델 연동
- **다중 AI 모델 지원**: OpenAI, Anthropic, Google API 지원
- **프로젝트 자동 감지**: Xcode, Android 프로젝트 자동 감지
- **실시간 채팅**: 스트리밍을 통한 실시간 AI 응답
- **도구 및 리소스**: 코드 분석, 리뷰, 테스트 생성 등 다양한 도구 제공
- **🔌 IntelliJ 플러그인**: IntelliJ IDEA/Android Studio용 네이티브 플러그인
  - AI 채팅 인터페이스
  - 코드 생성 및 분석 도구
  - 서버 설정 및 연결 관리
  - 키보드 단축키 지원
- **🆕 스마트 캐시 시스템**: 토큰 사용량 최적화를 위한 다층 캐시 시스템
  - 메모리 캐시 (LRU 정책)
  - 디스크 캐시 (영구 저장)
  - Redis 캐시 (분산 환경 지원)
  - 자동 캐시 정리 및 유지보수

## 📋 전제 조건

- Node.js 18.0.0 이상
- macOS (Xcode 프로젝트 지원)
- Xcode 14.0 이상 (iOS 개발용)
- AI 모델 API 키 (OpenAI, Anthropic, Google 중 하나 이상)
- IntelliJ IDEA 2024.2 이상 또는 Android Studio (플러그인 사용 시)

## 🛠️ 설치 및 설정

### Cursor Editor 연결 설정

#### 1. MCP 서버 설정 파일 생성

Cursor Editor에서 MCP 서버를 연결하려면 설정 파일을 생성해야 합니다:

```bash
# Cursor 설정 디렉토리 확인
ls -la ~/.cursor/

# mcp.json 파일이 없으면 생성
touch ~/.cursor/mcp.json
```

#### 2. MCP 서버 등록

`~/.cursor/mcp.json` 파일에 다음 내용을 추가합니다:

```json
{
  "mcpServers": {
    "MCP Cursor Server": {
      "command": "node",
      "args": ["/path/to/cursor-server/src/server.js", "start"],
      "cwd": "/path/to/cursor-server"
    }
  }
}
```

**실제 경로로 수정:**
- `/path/to/cursor-server`를 실제 프로젝트 경로로 변경
- 예: `/Users/username/Documents/cursor-server`

#### 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 API 키를 설정합니다:

```bash
# .env 파일 생성
cp env.example .env

# .env 파일 편집
nano .env
```

`.env` 파일에서 다음 값들을 실제 API 키로 변경:

```env
# OpenAI 설정
OPENAI_API_KEY=your_actual_openai_api_key_here

# Anthropic 설정  
ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here

# Google 설정
GOOGLE_API_KEY=your_actual_google_api_key_here
```

#### 4. Cursor Editor 재시작

설정을 적용하려면 Cursor Editor를 완전히 재시작합니다:

1. Cursor Editor 종료
2. Cursor Editor 재시작
3. 새 프로젝트 열기 또는 기존 프로젝트 새로고침

#### 5. 연결 확인

Cursor Editor에서 MCP 서버 연결을 확인하는 방법:

1. **Command Palette** 열기 (`Cmd+Shift+P`)
2. **"MCP"** 검색
3. **"MCP: Show Servers"** 선택
4. "MCP Cursor Server"가 목록에 표시되는지 확인

#### 6. 사용 방법

MCP 서버가 연결되면 다음과 같은 기능을 사용할 수 있습니다:

- **프로젝트 분석**: 현재 프로젝트의 구조와 파일 분석
- **코드 생성**: AI를 통한 코드 자동 생성
- **코드 리뷰**: AI를 통한 코드 품질 분석
- **테스트 생성**: 단위 테스트 자동 생성
- **문서화**: 코드 문서 자동 생성

### 빠른 시작 (권장)

#### 🖥️ GUI 설치 프로그램 (맥 사용자 권장)

**Electron 기반의 직관적인 GUI 설치 프로그램을 제공합니다.**

```bash
# 1. 저장소 클론
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server

# 2. GUI 설치 프로그램 실행
npm run gui:install  # GUI 설치 프로그램 의존성 설치
npm run gui:start    # GUI 설치 프로그램 실행
```

**GUI 설치 프로그램 특징:**
- 🎨 **직관적인 인터페이스**: 단계별 설치 과정을 시각적으로 안내
- 📁 **폴더 선택**: 마우스 클릭으로 설치 경로 선택
- 📊 **실시간 진행률**: 설치 진행 상황을 실시간으로 표시
- 📝 **상세한 로그**: 설치 과정의 모든 로그를 실시간으로 확인
- ✅ **자동 검증**: 시스템 요구사항 자동 확인
- 🚀 **원클릭 설치**: 복잡한 명령어 없이 간단한 클릭으로 설치

**GUI 설치 프로그램 빌드:**
```bash
# macOS용 DMG 파일 생성
npm run gui:build:mac

# Windows용 설치 파일 생성
npm run gui:build:win

# Linux용 AppImage 파일 생성
npm run gui:build:linux
```

**GUI 설치 프로그램 상세 정보:**
- 📁 **프로젝트 위치**: `gui-installer/` 디렉토리
- 🎨 **UI 프레임워크**: Electron + HTML/CSS/JavaScript
- 📦 **패키징**: electron-builder를 통한 크로스 플랫폼 빌드
- 🔧 **개발**: `cd gui-installer && npm start`로 개발 모드 실행

#### 💻 명령줄 설치

```bash
# 1. 저장소 클론
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server

# 2. 자동 설치 및 설정
npm run setup

# 3. 환경 변수 설정
cp env.example .env
# .env 파일을 편집하여 API 키 설정

# 4. 서버 시작
npm start
```

### 1. 시스템 요구사항 확인

#### Node.js 버전 확인
```bash
# Node.js 버전 확인 (18.0.0 이상 필요)
node --version

# npm 버전 확인
npm --version
```

**Node.js가 설치되지 않은 경우:**
```bash
# Homebrew를 사용한 설치 (macOS)
brew install node

# 또는 공식 웹사이트에서 다운로드
# https://nodejs.org/
```

#### 시스템 권한 확인
```bash
# npm 글로벌 설치 권한 확인
npm config get prefix

# 권한 문제가 있는 경우
sudo chown -R $(whoami) ~/.npm
```

### 2. 저장소 클론 및 의존성 설치

#### 저장소 클론
```bash
# 저장소 클론
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server

# 최신 버전으로 업데이트
git pull origin main
```

#### 자동 설치 (권장)
```bash
# 자동 설치 및 설정 스크립트 실행
npm run setup

# 또는 직접 실행
./scripts/setup.sh
```

#### 수동 설치 (문제가 있는 경우)

**방법 1: 기본 설치**
```bash
# 캐시 정리 후 설치
npm cache clean --force
npm install
```

**방법 2: 깨끗한 설치**
```bash
# npm 스크립트 사용
npm run install:clean

# 또는 수동으로
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**방법 3: 권한 문제가 있는 경우**
```bash
# npm 설정 변경
npm config set registry https://registry.npmjs.org/
npm config set strict-ssl false

# 의존성 설치
npm install
```

**방법 4: 네트워크 문제가 있는 경우**
```bash
# 다른 레지스트리 사용
npm install --registry https://registry.npmmirror.com/

# 또는 yarn 사용
npm install -g yarn
yarn install
```

#### 설치 확인
```bash
# 설치된 패키지 확인
npm list --depth=0

# 서버 실행 테스트
npm start -- --help
```

### 3. Xcode 설치 (iOS 개발용)

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

### 4. 환경 변수 설정

#### 환경 변수 파일 생성
```bash
# 환경 변수 파일 복사
cp env.example .env

# 파일 편집
nano .env
# 또는
code .env
```

#### 필수 환경 변수 설정
```env
# 최소 하나의 AI 모델 API 키 설정 (필수)
OPENAI_API_KEY=your_openai_api_key_here
# 또는
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# 또는
GOOGLE_API_KEY=your_google_api_key_here
# 또는
CURSOR_API_KEY=your_cursor_api_key_here

# 서버 설정
PORT=3000
HOST=localhost
NODE_ENV=development


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

### 5. 서버 실행 및 테스트

#### 서버 시작
```bash
# MCP 서버 시작
npm start

# 또는 HTTP 서버로 시작
npm start -- --http

# 개발 모드
npm run dev
```

#### 상태 확인
```bash
# 서버 상태 확인
npm run start status

# 설정 확인
npm run start config
```

### 7. 문제 해결

#### 일반적인 설치 문제

**1. Node.js 버전 문제**
```bash
# Node.js 18.0.0 이상 필요
node --version

# 버전이 낮은 경우 업그레이드
brew upgrade node
# 또는
nvm install 18
nvm use 18
```

**2. npm 권한 문제**
```bash
# npm 글로벌 권한 수정
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

**3. 네트워크 연결 문제**
```bash
# npm 레지스트리 확인
npm config get registry

# 레지스트리 변경
npm config set registry https://registry.npmjs.org/

# 프록시 설정 (필요한 경우)
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port
```

**4. 의존성 충돌 문제**
```bash
# package-lock.json 삭제 후 재설치
rm package-lock.json
rm -rf node_modules
npm install
```

**5. 메모리 부족 문제**
```bash
# Node.js 메모리 제한 증가
export NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

#### 일반적인 문제 해결
node src/server.js config

# .env 파일 재생성
cp env.example .env
# .env 파일 편집하여 올바른 값 설정
```


#### 디버깅 명령어

```bash
# 상세 로그로 서버 시작
LOG_LEVEL=debug npm start

# 서버 상태 확인
npm run start status

# 로그 확인
npm run start logs

# 설정 확인
npm run start config
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

## 🔌 IntelliJ 플러그인

### 플러그인 설치

#### 1. 플러그인 파일 다운로드
```bash
# 플러그인 빌드 (개발자용)
cd /path/to/mcp-cursor-server
npm run plugin:build

# 빌드된 플러그인 파일 위치
ls -la mcp-intellij-plugin/build/distributions/
# mcp-cursor-client-2.1.1.zip
```

#### 2. IntelliJ IDEA에서 플러그인 설치
1. **IntelliJ IDEA** 또는 **Android Studio** 실행
2. **File** → **Settings** (Windows/Linux) 또는 **IntelliJ IDEA** → **Preferences** (macOS)
3. **Plugins** → **⚙️** → **Install Plugin from Disk...**
4. `mcp-cursor-client-2.1.1.zip` 파일 선택
5. **OK** 클릭 후 IDE 재시작

#### 3. 플러그인 활성화 확인
- **Tools** 메뉴에 **MCP Cursor** 항목이 표시되는지 확인
- 우측 패널에 **MCP Cursor Chat** 툴 윈도우가 표시되는지 확인

### 플러그인 사용법

#### 1. 서버 설정
1. **Tools** → **MCP Cursor Settings** 클릭
2. 서버 설정 페이지에서 다음 정보 입력:
   - **서버 URL**: `http://localhost:3000` (기본값)
   - **자동 연결**: 체크
   - **알림 표시**: 체크
   - **최대 토큰**: `4000` (기본값)
   - **온도**: `0.7` (기본값)
3. **연결 테스트** 버튼으로 서버 연결 확인
4. **Apply** → **OK**로 설정 저장

#### 2. AI 채팅 사용
1. **Tools** → **Open AI Chat** 클릭
2. 우측 패널에 채팅 창이 열림
3. 모델 선택 드롭다운에서 사용할 AI 모델 선택
4. 하단 입력 필드에 질문 입력 후 **Enter** 또는 **전송** 버튼 클릭

#### 3. 코드 생성 및 분석
1. **Code** → **Generate Code with AI** (코드 생성)
2. **Code** → **Analyze Code with AI** (코드 분석)
3. 코드 블록 선택 후 메뉴 실행

#### 4. 키보드 단축키
- **Ctrl + Shift + G**: AI 코드 생성
- **Ctrl + Shift + C**: AI 채팅 열기

### 플러그인 기능

#### 🤖 AI 채팅
- 실시간 AI 응답
- 모델 선택 가능
- 채팅 히스토리 저장
- 스트리밍 응답 지원

#### ⚙️ 서버 설정
- 서버 URL 설정
- 자동 연결 옵션
- 알림 표시 설정
- 연결 상태 실시간 확인

#### 🔧 코드 도구
- **코드 생성**: AI를 통한 코드 자동 생성
- **코드 분석**: AI를 통한 코드 품질 분석
- **프로젝트 컨텍스트**: 현재 프로젝트 정보 자동 인식

### 플러그인 문제 해결

#### 플러그인이 설치되지 않음
1. **IDE 버전 확인**: IntelliJ IDEA 2024.2 이상 필요
2. **플러그인 파일 확인**: ZIP 파일이 손상되지 않았는지 확인
3. **IDE 재시작**: 설치 후 IDE 완전 재시작

#### 서버 연결 실패
1. **MCP 서버 실행 확인**:
   ```bash
   cd /path/to/mcp-cursor-server
   node src/server.js status
   ```
2. **서버 URL 확인**: 설정에서 올바른 URL 입력
3. **방화벽 확인**: 포트 3000이 차단되지 않았는지 확인

#### UI가 표시되지 않음
1. **플러그인 활성화 확인**: Settings → Plugins에서 활성화 상태 확인
2. **툴 윈도우 표시**: View → Tool Windows → MCP Cursor Chat
3. **IDE 재시작**: 플러그인 로드 문제 해결

#### 채팅이 작동하지 않음
1. **서버 연결 상태 확인**: 설정 페이지에서 연결 테스트
2. **AI 모델 확인**: 사용 가능한 모델이 있는지 확인
3. **API 키 설정**: 서버에서 AI 모델 API 키가 설정되었는지 확인

### 플러그인 개발

#### 빌드 환경 설정
```bash
# JDK 17 설치 (필수)
brew install openjdk@17

# 환경 변수 설정
export JAVA_HOME=/usr/local/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH

# 플러그인 빌드
npm run plugin:build
```

#### 버전 관리
```bash
# 버전 정보 확인
npm run plugin:version:info

# 버전 동기화
npm run plugin:version:sync

# 패치 버전 증가
npm run plugin:version:patch
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

### 일반적인 질문

**Q: 여러 AI 모델을 동시에 사용할 수 있나요?**
A: 네, 가능합니다. 환경 변수에 여러 API 키를 설정하면 자동으로 감지되어 사용됩니다.

### IntelliJ 플러그인 관련

**Q: 플러그인이 설치되지 않습니다.**
A: 다음을 확인해주세요:
1. IntelliJ IDEA 2024.2 이상 버전 사용
2. 플러그인 ZIP 파일이 손상되지 않았는지 확인
3. IDE 완전 재시작

**Q: 플러그인 UI가 표시되지 않습니다.**
A: 다음을 시도해보세요:
1. View → Tool Windows → MCP Cursor Chat
2. Settings → Plugins에서 플러그인 활성화 상태 확인
3. IDE 재시작

**Q: 서버 연결이 실패합니다.**
A: 다음을 확인해주세요:
1. MCP 서버가 실행 중인지 확인: `node src/server.js status`
2. 서버 URL이 올바른지 확인 (기본값: http://localhost:3000)
3. 방화벽에서 포트 3000이 차단되지 않았는지 확인

**Q: AI 채팅이 작동하지 않습니다.**
A: 다음을 확인해주세요:
1. 서버 설정에서 연결 테스트 성공 여부
2. AI 모델 API 키가 서버에 설정되었는지 확인
3. 사용 가능한 AI 모델이 있는지 확인

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
