# MCP Cursor Server 프로젝트 구조

## 🏗️ 전체 아키텍처

```
cursor-server/
├── 📁 핵심 서버 (MCP 프로토콜 기반)
├── 📁 HTTP 프록시 (클라이언트 호환성)
├── 📁 IntelliJ 플러그인 (Kotlin)
├── 📁 설정 및 문서
└── 📁 데이터 및 로그
```

## 📂 루트 디렉토리

### **설정 파일**
- `package.json` - Node.js 프로젝트 설정 및 의존성
- `config.js` - 서버 기본 설정
- `cursor-mcp-config.json` - Cursor Editor 연결 설정

### **문서 파일**
- `README.md` - 프로젝트 메인 문서
- `ARCHITECTURE.md` - 아키텍처 가이드
- `CHANGELOG.md` - 변경 이력
- `GIT_FLOW.md` - Git 워크플로우
- `VERSION_HISTORY.md` - 버전 히스토리

### **연결 가이드**
- `XCODE_CONNECTION_GUIDE.md` - Xcode 연결 가이드
- `CURSOR_EDITOR_SETUP.md` - Cursor Editor 설정
- `GUI_INSTALLER_GUIDE.md` - GUI 설치 가이드
- `PLUGIN_VERSION_MANAGEMENT.md` - 플러그인 버전 관리

## 📁 src/ - 소스 코드

### **핵심 서버 (Core)**
```
src/
├── server.js                    # 메인 서버 진입점
├── core/
│   ├── mcpServer.js            # MCP 프로토콜 서버 (Cursor Editor 연결)
│   ├── mcpHttpServer.js        # MCP HTTP 서버 (포트 3001)
│   └── httpProxyServer.js      # HTTP 프록시 서버 (포트 3000)
├── services/
│   ├── aiService.js            # AI 모델 통합 서비스
│   ├── cacheService.js         # 캐시 관리 서비스
│   ├── projectDetector.js      # 프로젝트 타입 감지
│   ├── chatHistoryService.js   # 채팅 히스토리 관리
│   └── cacheMaintenanceService.js # 캐시 유지보수
├── config/
│   └── config.js               # 서버 설정 관리
├── types/
│   └── mcp.js                  # MCP 프로토콜 타입 정의
└── utils/
    └── logger.js               # 로깅 유틸리티
```

### **서버 역할 분담**

#### **1. server.js (메인 진입점)**
- 서버 초기화 및 생명주기 관리
- MCP 서버, MCP HTTP 서버, HTTP 프록시 서버 통합 관리
- 시스템 요구사항 확인

#### **2. mcpServer.js (MCP 프로토콜 서버)**
- Cursor AI와의 직접 통신
- MCP 프로토콜 핸들러 (initialize, tools, resources)
- JSON-RPC 1.0/2.0 지원

#### **3. mcpHttpServer.js (MCP HTTP 서버)**
- 포트 3001에서 실행
- Cursor Editor 전용
- MCP 프로토콜을 HTTP로 노출

#### **4. httpProxyServer.js (HTTP 프록시 서버)**
- 포트 3000에서 실행
- 클라이언트별 호환성 제공
- Xcode, Android Studio, IntelliJ 지원

## 📁 mcp-intellij-plugin/ - IntelliJ 플러그인

### **플러그인 구조**
```
mcp-intellij-plugin/
├── build.gradle.kts            # Gradle 빌드 설정
├── settings.gradle.kts         # Gradle 설정
├── src/main/
│   ├── kotlin/com/mcp/cursor/client/
│   │   ├── actions/            # 액션 클래스들
│   │   │   ├── AnalyzeCodeAction.kt
│   │   │   ├── GenerateCodeAction.kt
│   │   │   ├── OpenChatAction.kt
│   │   │   ├── QuickSetupAction.kt
│   │   │   ├── ServerStatusAction.kt
│   │   │   └── SettingsAction.kt
│   │   ├── service/            # 서비스 클래스들
│   │   │   └── MCPService.kt
│   │   ├── settings/           # 설정 관리
│   │   │   ├── MCPSettings.kt
│   │   │   └── MCPSettingsConfigurable.kt
│   │   └── ui/                 # UI 컴포넌트
│   │       ├── ChatPanel.kt
│   │       ├── ChatToolWindowFactory.kt
│   │       ├── MCPSettingPanel.kt
│   │       └── MCPSettingToolWindowFactory.kt
│   └── resources/META-INF/
│       └── plugin.xml          # 플러그인 메타데이터
└── build/                      # 빌드 결과물
```

### **플러그인 기능**

#### **액션 (Actions)**
- `AnalyzeCodeAction` - 코드 분석
- `GenerateCodeAction` - 코드 생성
- `OpenChatAction` - 채팅 열기
- `QuickSetupAction` - 빠른 설정
- `ServerStatusAction` - 서버 상태 확인
- `SettingsAction` - 설정 열기

#### **UI 컴포넌트**
- `ChatPanel` - 채팅 인터페이스
- `MCPSettingPanel` - 설정 패널
- `ChatToolWindowFactory` - 채팅 도구창
- `MCPSettingToolWindowFactory` - 설정 도구창

## 📁 데이터 및 로그

### **데이터 디렉토리**
```
data/
└── chat-history/               # 채팅 히스토리 저장
    └── session_*.json         # 세션별 채팅 기록

cache/                          # 캐시 데이터
logs/                          # 로그 파일
├── combined.log               # 통합 로그
├── error.log                  # 오류 로그
├── server.log                 # 서버 로그
└── server-error.log           # 서버 오류 로그
```

## 🔧 빌드 및 실행

### **서버 실행**
```bash
# 개발 모드
node src/server.js start

# 프로덕션 모드
NODE_ENV=production node src/server.js start
```

### **IntelliJ 플러그인 빌드**
```bash
cd mcp-intellij-plugin
./gradlew build
```

## 🌐 네트워크 포트

- **포트 3001**: MCP HTTP 서버 (Cursor Editor)
- **포트 3000**: HTTP 프록시 서버 (클라이언트들)

## 📊 통신 흐름

```
1. Cursor Editor → MCP HTTP Server (3001) → MCP Server (Core)
2. Xcode → HTTP Proxy Server (3000) → MCP Server (Core)
3. Android Studio → HTTP Proxy Server (3000) → MCP Server (Core)
4. IntelliJ → HTTP Proxy Server (3000) → MCP Server (Core)
```

## 🔍 주요 특징

- **MCP 프로토콜 기반**: JSON-RPC 1.0/2.0 완전 지원
- **다중 클라이언트 지원**: Cursor Editor, Xcode, Android Studio, IntelliJ
- **AI 모델 통합**: OpenAI, Anthropic, Google, Cursor 기본 모델
- **캐시 시스템**: 응답 캐싱으로 성능 최적화
- **프로젝트 감지**: 자동 프로젝트 타입 감지
- **로깅 시스템**: 상세한 로그 기록 및 관리

---

**참고**: 이 구조는 중앙 허브 아키텍처를 기반으로 하며, MCP 프로토콜이 핵심이고 HTTP는 프록시 역할만 담당합니다.

