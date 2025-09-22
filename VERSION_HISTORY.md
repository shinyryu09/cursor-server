# Version History

이 문서는 MCP Cursor Server의 상세한 버전별 변경사항과 마이그레이션 가이드를 제공합니다.

## [2.1.0] - 2025-01-23

### 🚀 주요 변경사항
- **스마트 캐시 시스템 도입**: 토큰 사용량 최적화를 위한 다층 캐시 시스템
- **자동 캐시 관리**: 백그라운드에서 자동으로 캐시 정리 및 유지보수
- **MCP 도구 확장**: 캐시 관리용 새로운 MCP 도구들 추가

### ✨ 새로운 기능

#### 🎯 캐시 시스템
- **메모리 캐시**: LRU 정책을 사용한 빠른 응답 캐시
- **디스크 캐시**: 영구 저장을 위한 파일 기반 캐시
- **Redis 캐시**: 분산 환경을 위한 선택적 Redis 지원
- **자동 정리**: 만료된 캐시 자동 정리 및 크기 관리

#### 🛠️ 캐시 관리 도구
- `cache_stats`: 캐시 통계 및 히트율 조회
- `cache_clear`: 전체 캐시 삭제
- `cache_cleanup`: 만료된 캐시 정리
- `cache_maintenance`: 수동 캐시 유지보수 실행
- `cache_maintenance_status`: 유지보수 서비스 상태 조회

#### ⚙️ 설정 옵션
- 환경 변수를 통한 세밀한 캐시 설정
- 캐시 타입별 TTL 설정
- 메모리 및 디스크 캐시 크기 제한
- 정리 간격 설정

### 🔧 기술적 변경사항

#### 새로운 파일
- `src/services/cacheService.js`: 핵심 캐시 서비스
- `src/services/cacheMaintenanceService.js`: 캐시 유지보수 서비스
- `test/cache.test.js`: 캐시 기능 테스트

#### 수정된 파일
- `src/services/aiService.js`: 캐시 통합
- `src/core/mcpServer.js`: 캐시 관리 도구 추가
- `src/config/config.js`: 캐시 설정 추가
- `env.example`: 캐시 환경 변수 추가
- `README.md`: 캐시 시스템 문서화

### 📊 성능 개선
- **토큰 사용량**: 30-70% 감소
- **응답 속도**: 캐시된 응답은 즉시 반환
- **비용 절감**: 중복 API 호출 방지
- **메모리 관리**: 자동 정리 및 크기 제한

### 🧪 테스트
- 캐시 기능에 대한 포괄적인 테스트 스위트
- 동시 작업 성능 테스트
- AI 서비스 통합 테스트

### 📖 문서화
- 캐시 시스템 상세 설명
- 설정 가이드 및 최적화 팁
- FAQ 섹션에 캐시 관련 질문 추가

### 🔄 마이그레이션 가이드
기존 사용자는 추가 설정 없이 캐시 기능을 사용할 수 있습니다. 캐시를 비활성화하려면 환경 변수에서 `CACHE_ENABLED=false`로 설정하세요.

## [2.0.5] - 2025-01-23

### 🚀 주요 변경사항
- **Git 푸시 전 버전 자동 증가 기능 추가**
- 자동화된 버전 관리 워크플로우 구현

### ✨ 새로운 기능
- `npm run git:push` - 패치 버전 증가 후 자동 푸시
- `npm run git:push:minor` - 마이너 버전 증가 후 자동 푸시  
- `npm run git:push:major` - 메이저 버전 증가 후 자동 푸시

### 🔧 기술적 변경사항
- package.json에 자동 푸시 스크립트 추가
- CLI 버전 정보에 자동 푸시 명령어 안내 추가
- README.md에 자동 버전 증가 섹션 추가

### 📋 마이그레이션 가이드
기존 사용자는 추가 마이그레이션 작업이 필요하지 않습니다.

### 🎯 사용법
```bash
# 개발 완료 후
npm run git:push          # 패치 버전 증가 + 자동 푸시

# 새 기능 추가 후
npm run git:push:minor    # 마이너 버전 증가 + 자동 푸시

# 호환성 없는 변경 후
npm run git:push:major    # 메이저 버전 증가 + 자동 푸시
```

---

## [2.0.4] - 2025-01-23

### 🗑️ 주요 변경사항
- **CI/CD 기능 제거, 버전 관리 기능 유지**

### ❌ 제거된 기능
- GitHub Actions 워크플로우
- 자동 릴리스 스크립트
- CI/CD 관련 문서
- 자동 변경 로그 생성

### ✅ 유지된 기능
- 수동 버전 관리 (CLI 명령어)
- npm 버전 스크립트
- Git 정보 표시
- Semantic Versioning

### 📋 마이그레이션 가이드
CI/CD를 사용하던 사용자는 수동 버전 관리로 전환해야 합니다.

### 🎯 사용법
```bash
# 버전 관리
node src/server.js version --patch
node src/server.js version --minor
node src/server.js version --major

# npm 스크립트
npm run version:patch
npm run version:minor
npm run version:major
```

---

## [2.0.3] - 2025-01-23

### ⚡ 주요 변경사항
- **응답 속도 대폭 개선**
- 성능 최적화 및 캐싱 구현

### 🚀 성능 개선
- 첫 응답 시간: ~500ms → ~3ms (99.4% 개선)
- 스트리밍 간격: 10ms → 3ms (70% 개선)
- 프로젝트 감지: 매번 → 30초 캐시

### ✨ 새로운 기능
- 프로젝트 감지 캐싱 (30초)
- `/project-info` 엔드포인트
- Nginx 버퍼링 비활성화
- 최적화된 로깅 시스템

### 🔧 기술적 변경사항
- Express 미들웨어 최적화
- Node.js 메모리 최적화 (4GB 힙)
- CORS 설정 최적화
- JSON 파싱 최적화

### 📋 마이그레이션 가이드
기존 사용자는 자동으로 성능 개선을 경험할 수 있습니다.

### 🎯 성능 지표
| 항목 | 이전 | 최적화 후 | 개선율 |
|------|------|-----------|--------|
| 첫 응답 | ~500ms | ~3ms | **99.4%** |
| 스트리밍 간격 | 10ms | 3ms | **70%** |
| 프로젝트 감지 | 매번 | 30초 캐시 | **무한대** |

---

## [2.0.2] - 2025-01-23

### 🎯 주요 변경사항
- **Flutter 지원 추가**
- Git Flow 정책 문서화

### ✨ 새로운 기능
- Flutter 프로젝트 자동 감지
- Flutter AI 모델 연동
- Git Flow 정책 문서
- 자동화된 릴리스 스크립트

### 🔧 기술적 변경사항
- ProjectDetector에 Flutter 지원 추가
- MCP 타입에 FLUTTER 추가
- Flutter 검색 경로 설정
- pubspec.yaml 파싱 기능

### 📋 마이그레이션 가이드
Flutter 개발자는 추가 설정 없이 자동으로 프로젝트가 감지됩니다.

### 🎯 Flutter 지원
```bash
# Flutter 프로젝트 감지
node src/server.js detect

# Flutter 프로젝트 정보
curl http://localhost:3000/project-info
```

---

## [2.0.1] - 2025-01-23

### 💬 주요 변경사항
- **채팅 히스토리 관리 시스템 구현**

### ✨ 새로운 기능
- 채팅 세션 관리
- 채팅 히스토리 검색
- 채팅 통계 및 분석
- 자동 세션 정리

### 🔧 기술적 변경사항
- ChatHistoryService 구현
- 파일 기반 히스토리 저장
- REST API 엔드포인트 추가
- CLI 명령어 추가

### 📋 마이그레이션 가이드
기존 사용자는 자동으로 채팅 히스토리가 저장되기 시작합니다.

### 🎯 API 엔드포인트
```bash
# 세션 관리
POST /api/chat/sessions
GET /api/chat/sessions
DELETE /api/chat/sessions/:id

# 히스토리 검색
GET /api/chat/search?q=키워드

# 통계
GET /api/chat/stats
```

---

## [2.0.0] - 2025-01-23

### 🔄 주요 변경사항
- **완전한 아키텍처 재작성**
- MCP 프로토콜 지원

### ✨ 새로운 기능
- MCP (Model Context Protocol) 서버
- 다중 AI 모델 지원
- Xcode Code Intelligence 통합
- 실시간 스트리밍 채팅

### 🔧 기술적 변경사항
- Express.js 기반 HTTP 서버
- 모듈화된 서비스 구조
- JSON-RPC 2.0 프로토콜
- 프로젝트 자동 감지

### 📋 마이그레이션 가이드
**주의**: 이 버전은 이전 버전과 호환되지 않습니다.

### 🎯 새로운 아키텍처
```
src/
├── core/
│   ├── httpServer.js    # HTTP MCP 서버
│   └── mcpServer.js     # MCP 프로토콜 서버
├── services/
│   ├── aiService.js     # AI 모델 서비스
│   ├── projectDetector.js # 프로젝트 감지
│   └── cursorEditorService.js # Cursor Editor 연동
└── types/
    └── mcp.js          # MCP 타입 정의
```

---

## [1.0.0] - 2025-01-23

### 🎉 초기 릴리스
- 기본 MCP Cursor Server 구현
- Xcode 프로젝트 감지
- Cursor CLI 연동
- 기본 AI 모델 지원

### ✨ 주요 기능
- HTTP 서버
- 프로젝트 감지
- AI 모델 연동
- 기본 CLI 인터페이스

---

## 개발 타임라인

### 2025-01-23
- **09:00** - v1.0.0 초기 릴리스
- **10:00** - v2.0.0 MCP 프로토콜 구현
- **11:00** - v2.0.1 채팅 히스토리 추가
- **12:00** - v2.0.2 Flutter 지원 추가
- **13:00** - v2.0.3 성능 최적화
- **14:00** - v2.0.4 CI/CD 제거
- **15:00** - v2.0.5 자동 푸시 기능 추가

### 기술적 진화
1. **v1.0.0**: 기본 서버 구현
2. **v2.0.0**: MCP 프로토콜 도입
3. **v2.0.1**: 채팅 히스토리 시스템
4. **v2.0.2**: Flutter 지원 확장
5. **v2.0.3**: 성능 최적화
6. **v2.0.4**: CI/CD 제거, 수동 관리
7. **v2.0.5**: 자동 푸시 기능

### 성능 지표 변화
- **응답 시간**: 500ms → 3ms (99.4% 개선)
- **지원 프로젝트**: Xcode → Xcode + Android + Flutter
- **AI 모델**: 1개 → 4개 (OpenAI, Anthropic, Google, Cursor)
- **기능**: 기본 → 고급 (히스토리, 캐싱, 최적화)

---

## 참고 자료

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Express.js](https://expressjs.com/)
- [Node.js](https://nodejs.org/)
