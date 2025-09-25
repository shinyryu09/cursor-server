# 수정된 MCP 서버 아키텍처 (Cursor AI 전용)

## 1. 전체 개요

- **MCP 서버**는 표준 MCP 프로토콜(JSON-RPC over WebSocket/stdio)을 따르면서, 모든 요청을 로컬 Cursor AI 엔진에 위임
- **IDE 클라이언트**(Xcode, Android Studio, IntelliJ)는 MCP 서버에 연결만 하면 됨
- **외부 네트워크 의존도 없음** → 보안 강화, 속도 안정성 확보

## 2. 아키텍처 레이어

### ① Client Layer (IDE Plugins)
```
┌─────────────────────────────────────────────────────────────┐
│                    IDE Plugins                              │
├─────────────────────────────────────────────────────────────┤
│  Xcode Plugin          │  Android Studio Plugin            │
│  ├── MCP Client        │  ├── MCP Client                   │
│  ├── Swift Adapter     │  ├── Kotlin Adapter               │
│  └── Code Integration  │  └── Code Integration             │
├─────────────────────────────────────────────────────────────┤
│  IntelliJ Plugin       │  VS Code Plugin                   │
│  ├── MCP Client        │  ├── MCP Client                   │
│  ├── Java Adapter      │  ├── Multi-language Adapter       │
│  └── Code Integration  │  └── Code Integration             │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- 코드 조각, 리팩토링, 설명 요청 등을 MCP 서버에 JSON-RPC 요청
- IDE별 언어 특화 어댑터
- 실시간 코드 분석 및 제안

### ② Gateway Layer
```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway Layer                            │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Adapter     │  Stdio Adapter                    │
│  ├── Port: 3001        │  ├── Process Communication        │
│  ├── Real-time         │  ├── Batch Processing             │
│  └── Session Mgmt      │  └── File I/O                     │
├─────────────────────────────────────────────────────────────┤
│  Authentication Layer                                       │
│  ├── Token Validation                                      │
│  ├── Local Auth (macOS Keychain)                           │
│  └── Session Security                                      │
├─────────────────────────────────────────────────────────────┤
│  Request Router                                             │
│  ├── IDE Detection                                          │
│  ├── Protocol Versioning                                    │
│  └── Load Balancing                                         │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- WebSocket/Stdio 어댑터로 다양한 연결 방식 지원
- 인증 (토큰, 로컬 인증)
- 요청 라우팅 및 세션 관리

### ③ Core MCP Server
```
┌─────────────────────────────────────────────────────────────┐
│                    Core MCP Server                          │
├─────────────────────────────────────────────────────────────┤
│  Session Manager                                            │
│  ├── IDE별 사용자 세션 관리                                │
│  ├── 요청 컨텍스트 추적                                    │
│  │   ├── 파일 경로                                         │
│  │   ├── 커서 위치                                         │
│  │   ├── 코드 스니펫                                       │
│  │   └── 프로젝트 컨텍스트                                 │
│  └── 세션 상태 관리                                        │
├─────────────────────────────────────────────────────────────┤
│  Protocol Handler                                           │
│  ├── JSON-RPC 2.0 Parser                                   │
│  ├── Request Validation                                     │
│  ├── Cursor AI 호출                                        │
│  └── Response Transformation                                │
├─────────────────────────────────────────────────────────────┤
│  Feature Handlers                                           │
│  ├── refactor.code                                          │
│  │   ├── Swift Refactoring                                  │
│  │   ├── Kotlin Refactoring                                 │
│  │   └── JavaScript Refactoring                             │
│  ├── complete.code                                          │
│  │   ├── IntelliSense                                       │
│  │   ├── Auto-completion                                    │
│  │   └── Snippet Generation                                 │
│  ├── explain.code                                           │
│  │   ├── Code Documentation                                 │
│  │   ├── Comment Generation                                 │
│  │   └── Architecture Analysis                              │
│  └── test.generate                                          │
│      ├── Unit Test Generation                               │
│      ├── Integration Test                                   │
│      └── Mock Data Creation                                 │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- IDE별 사용자 세션 관리
- 요청 컨텍스트(파일 경로, 커서 위치, 코드 스니펫 등) 추적
- JSON-RPC 요청 → Cursor AI 호출 → 응답 변환
- 모든 기능을 Cursor AI에 위임

### ④ Cursor AI Engine (로컬)
```
┌─────────────────────────────────────────────────────────────┐
│                Cursor AI Engine (로컬)                      │
├─────────────────────────────────────────────────────────────┤
│  Local Communication Layer                                  │
│  ├── IPC (Inter-Process Communication)                      │
│  ├── HTTP/gRPC API (Local)                                 │
│  └── Shared Memory                                          │
├─────────────────────────────────────────────────────────────┤
│  AI Processing Core                                         │
│  ├── Code Completion                                        │
│  │   ├── Context-aware Suggestions                          │
│  │   ├── Language-specific Patterns                         │
│  │   └── Project-aware Completion                           │
│  ├── Code Refactoring                                       │
│  │   ├── Safe Refactoring                                   │
│  │   ├── Pattern Recognition                                │
│  │   └── Dependency Analysis                                │
│  ├── Code Analysis                                          │
│  │   ├── Syntax Analysis                                    │
│  │   ├── Semantic Analysis                                  │
│  │   └── Performance Analysis                               │
│  └── Documentation Generation                               │
│      ├── API Documentation                                  │
│      ├── Code Comments                                      │
│      └── Architecture Diagrams                              │
├─────────────────────────────────────────────────────────────┤
│  Project Context Manager                                    │
│  ├── File System Analysis                                   │
│  ├── Dependency Tracking                                    │
│  ├── Git Integration                                        │
│  └── Build System Integration                               │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- MCP 서버와 로컬 IPC 또는 HTTP/gRPC API로 통신
- 코드 완성, 리팩토링, 주석 생성
- 프로젝트 컨텍스트 기반 분석
- Cursor 플러그인 기능 활용 (Git 연동 등)

### ⑤ Storage (선택)
```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
├─────────────────────────────────────────────────────────────┤
│  Log Storage                                                │
│  ├── Request/Response Logs                                  │
│  ├── Error Logs                                             │
│  └── Performance Metrics                                    │
├─────────────────────────────────────────────────────────────┤
│  User Request History (Optional)                            │
│  ├── Code Completion History                                │
│  ├── Refactoring History                                    │
│  └── User Preferences                                       │
├─────────────────────────────────────────────────────────────┤
│  Caching Layer                                              │
│  ├── Frequent Request Cache                                 │
│  ├── Code Pattern Cache                                     │
│  └── Project Context Cache                                  │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- 로그 저장(DB or 로컬 파일)
- 사용자 요청 기록 (옵션)
- 캐싱 레이어 (자주 쓰는 요청 결과 빠르게 반환)

## 3. 통신 흐름

### 3.1 기본 통신 흐름
```
IDE Plugin → Gateway Layer → Core MCP Server → Cursor AI Engine
     ↑                                                           ↓
     └─────────────── Response ←─────────────────────────────────┘
```

### 3.2 상세 통신 과정
```
1. IDE Plugin이 코드 완성 요청
   ↓
2. Gateway Layer에서 WebSocket/Stdio로 수신
   ↓
3. Core MCP Server에서 JSON-RPC 파싱 및 세션 관리
   ↓
4. Cursor AI Engine에 로컬 통신으로 요청
   ↓
5. AI 처리 결과를 MCP 응답으로 변환
   ↓
6. Gateway Layer를 통해 IDE Plugin에 응답
```

## 4. MCP 프로토콜 지원

### 4.1 표준 MCP 메서드
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "clientInfo": {
      "name": "xcode-plugin",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

### 4.2 커스텀 도구 메서드
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "refactor.code",
    "arguments": {
      "language": "swift",
      "code": "func example() { ... }",
      "refactorType": "extract_method",
      "context": {
        "filePath": "/path/to/file.swift",
        "cursorPosition": { "line": 10, "column": 5 }
      }
    }
  },
  "id": 2
}
```

## 5. IDE별 플러그인 구조

### 5.1 Xcode Plugin
```swift
// Xcode Plugin Architecture
class MCPXcodePlugin {
    private let mcpClient: MCPClient
    private let swiftAdapter: SwiftCodeAdapter
    
    func requestCodeCompletion(at position: SourcePosition) async -> [CodeCompletion] {
        let request = MCPRequest(
            method: "tools/call",
            params: [
                "name": "complete.code",
                "arguments": [
                    "language": "swift",
                    "context": position.toContext()
                ]
            ]
        )
        
        let response = await mcpClient.send(request)
        return swiftAdapter.parseCompletions(response)
    }
}
```

### 5.2 Android Studio Plugin
```kotlin
// Android Studio Plugin Architecture
class MCPAndroidPlugin {
    private val mcpClient: MCPClient
    private val kotlinAdapter: KotlinCodeAdapter
    
    suspend fun requestRefactoring(
        code: String, 
        refactorType: RefactorType
    ): RefactoringResult {
        val request = MCPRequest(
            method = "tools/call",
            params = mapOf(
                "name" to "refactor.code",
                "arguments" to mapOf(
                    "language" to "kotlin",
                    "code" to code,
                    "refactorType" to refactorType.name
                )
            )
        )
        
        val response = mcpClient.send(request)
        return kotlinAdapter.parseRefactoring(response)
    }
}
```

## 6. 보안 및 성능

### 6.1 보안
- **로컬 통신만**: 외부 네트워크 의존도 없음
- **토큰 인증**: IDE별 고유 토큰
- **세션 격리**: IDE별 독립적인 세션 관리

### 6.2 성능
- **로컬 AI 엔진**: 네트워크 지연 없음
- **캐싱**: 자주 사용되는 패턴 캐싱
- **비동기 처리**: 논블로킹 요청 처리

## 7. 배포 및 설정

### 7.1 MCP 서버 설정
```json
{
  "mcpServers": {
    "cursor-ai-server": {
      "command": "node",
      "args": ["src/server.js", "mcp"],
      "cwd": "/path/to/cursor-server",
      "env": {
        "CURSOR_AI_PATH": "/Applications/Cursor.app"
      }
    }
  }
}
```

### 7.2 IDE별 연결 설정
```yaml
# Xcode Plugin Config
mcp:
  server: "ws://localhost:3001"
  token: "xcode-token-123"
  capabilities:
    - code_completion
    - refactoring
    - code_explanation

# Android Studio Plugin Config  
mcp:
  server: "ws://localhost:3001"
  token: "android-token-456"
  capabilities:
    - code_completion
    - refactoring
    - test_generation
```

## 8. 마이그레이션 계획

### 8.1 Phase 1: Core MCP Server 구현
- [ ] Gateway Layer 구현
- [ ] Core MCP Server 구현
- [ ] Cursor AI Engine 통신 구현

### 8.2 Phase 2: IDE 플러그인 개발
- [ ] Xcode Plugin 개발
- [ ] Android Studio Plugin 개발
- [ ] IntelliJ Plugin 개발

### 8.3 Phase 3: 통합 및 테스트
- [ ] 전체 시스템 통합 테스트
- [ ] 성능 최적화
- [ ] 문서화 완료

---

**핵심 원칙: 표준 MCP 프로토콜 + 로컬 Cursor AI 엔진 + IDE별 전용 플러그인**