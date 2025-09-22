# Cursor Server - OpenAI-Compatible API Server

[Apple On-Device OpenAI](https://github.com/gety-ai/apple-on-device-openai) 스타일의 OpenAI 호환 API 서버로 Xcode Code Intelligence, IntelliJ IDEA, VSCode와 Cursor CLI/Editor를 연결하여 AI 기반 코드 분석, 수정, 생성 기능을 제공합니다.

## 📁 프로젝트 구조

```
cursor-server/
├── .vscode/                    # VSCode 개발 환경 설정
│   ├── launch.json            # 디버깅 설정
│   ├── settings.json          # 에디터 설정
│   └── tasks.json             # 작업 설정
├── node_modules/              # Node.js 의존성 패키지
├── package.json               # 프로젝트 설정 및 의존성
├── package-lock.json          # 의존성 잠금 파일
├── server.js                  # 메인 서버 파일 (1,759줄)
├── server.js.backup.*         # 서버 백업 파일들
├── sse-test.html              # SSE 테스트용 HTML 파일
└── README.md                  # 프로젝트 문서
```

## ✨ 주요 기능

### 1. OpenAI API 호환성
- **표준 OpenAI API**: `/v1/chat/completions`, `/v1/models` 등 완전 호환
- **스트리밍 지원**: 실시간 응답 스트리밍 (Server-Sent Events)
- **모델 정보**: 상세한 모델 능력 및 상태 정보 제공

### 2. 개발 도구 통합
- **Xcode Code Intelligence**: 완전 지원
- **IntelliJ IDEA**: 프로젝트 경로 자동 감지
- **VSCode**: 워크스페이스 자동 감지
- **Cursor Editor**: 직접 연결 지원

### 3. Cursor CLI/Editor 통합
- **인증 관리**: Cursor CLI 로그인 상태 자동 확인
- **명령 실행**: 복잡한 프롬프트를 안전하게 처리
- **파일 수정**: 실제 파일 읽기, 분석, 수정 기능
- **실시간 연결**: Cursor Editor와 직접 통신

### 4. Apple On-Device OpenAI 스타일
- **헬스 체크**: 상세한 서버 및 모델 상태 정보
- **에러 처리**: 표준화된 에러 응답 형식
- **CORS 설정**: 개발 도구별 최적화된 CORS 정책
- **로깅 시스템**: 구조화된 요청/응답 로깅

### 5. 작업 추적 시스템
- **실시간 진행 상황**: 현재 진행 중인 작업 모니터링
- **작업 이력**: 완료된 작업들의 상세 기록
- **코드 변경 이력**: 파일 수정 사항과 diff 추적

### 6. 웹 대시보드
- **실시간 모니터링**: `http://localhost:3000/dashboard`
- **작업 상태 시각화**: 진행률, 단계별 상태 표시
- **코드 변경 내역**: 파일별 수정 사항과 차이점 표시

## 📊 작업 이력

### 최근 주요 작업들

#### ✅ Cursor CLI 명령 실행 개선 (2025-09-18)
- **문제**: 복잡한 JSON과 Swift 코드가 포함된 프롬프트 처리 실패
- **해결**: 임시 파일을 사용한 안전한 프롬프트 처리
- **개선사항**: 복잡한 프롬프트를 `/tmp/cursor_prompt_*.txt`로 저장하여 `cat` 명령으로 처리

#### ✅ PayloadTooLargeError 해결 (2025-09-18)
- **문제**: 큰 요청 시 100KB 제한으로 인한 오류
- **해결**: body-parser 제한을 50MB로 확장
- **개선사항**:
  ```javascript
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
  ```

## 🛠 서버 실행 방법

### 1. 사전 요구사항
```bash
# Node.js 설치 확인
node --version  # v16.0.0 이상 권장

# Cursor CLI 설치 및 인증
cursor --version
cursor login
```

### 2. 의존성 설치
```bash
cd /Users/aiden/HomeWork/cursor-server
npm install
```

### 3. 서버 실행

#### 방법 1: 직접 실행
```bash
node server.js
```

#### 방법 2: npm 스크립트 사용
```bash
npm start
```

#### 방법 3: 개발 모드 (자동 재시작)
```bash
npm run dev
```

#### 방법 4: 백그라운드 실행
```bash
node server.js &
```

### 4. 서버 상태 확인
```bash
# 헬스 체크 (Apple On-Device OpenAI 스타일)
curl http://localhost:3000/health

# 모델 상태 확인
curl http://localhost:3000/status

# 모델 목록 조회
curl http://localhost:3000/v1/models
```

### 5. VSCode에서 실행
1. VSCode에서 `cursor-server` 폴더 열기
2. `F5` 키를 눌러 디버깅 모드로 실행
3. 또는 `Ctrl+Shift+P` → "Tasks: Run Task" → "Start Server" 선택

## 🔗 Xcode 연결 방법

### 1. Xcode Code Intelligence 설정

#### Step 1: Xcode에서 Code Intelligence 활성화
1. Xcode → Preferences → Features → Code Intelligence
2. "Enable Code Intelligence" 체크

#### Step 2: Model Provider 추가
1. Code Intelligence 설정에서 "Add Model Provider" 클릭
2. 다음 정보 입력:
   - **Name**: `Cursor Server`
   - **Base URL**: `http://localhost:3000`
   - **API Key**: (비어둠)

#### Step 3: 모델 선택
1. "Models" 탭에서 "cursor-cli" 모델 선택
2. "Save" 클릭

### 2. 서버 설정 확인

#### 워킹 디렉토리 설정
```bash
# Xcode 프로젝트 경로로 설정
curl -X POST http://localhost:3000/xcode/set-workspace \
  -H "Content-Type: application/json" \
  -d '{"path": "/Users/aiden/YourProjectPath"}'
```

#### 현재 설정 확인
```bash
curl http://localhost:3000/workspace
```

### 3. 사용 방법

#### 일반적인 질문
- Xcode에서 코드를 선택하고 Code Intelligence 패널에서 질문
- 예: "이 코드를 개선해줘", "버그를 찾아줘"

#### 파일 수정 요청
- 구체적인 수정 사항을 요청
- 예: "TextField 포커스 문제를 해결해줘", "새로운 기능을 추가해줘"

#### 프로젝트 분석
- "현재 작업 상태를 보여줘", "프로젝트 구조를 분석해줘"

## 📡 API 엔드포인트

### OpenAI 호환 API
- `GET /health` - 서버 상태 확인 (Apple On-Device OpenAI 스타일)
- `GET /status` - 모델 상태 확인
- `GET /v1/models` - OpenAI 호환 모델 목록
- `POST /v1/chat/completions` - 채팅 완성 (스트리밍 지원)
- `POST /v1/completions` - 코드 완성 (SSE 스트리밍)

### 기본 엔드포인트
- `GET /workspace` - 현재 작업 디렉토리 조회
- `POST /set-workspace` - 작업 디렉토리 설정

### 작업 관리 API
- `GET /tasks/current` - 현재 진행 중인 작업
- `GET /tasks/history` - 작업 이력
- `GET /changes/history` - 코드 변경 이력
- `GET /dashboard` - 웹 대시보드

### 파일 관리 API
- `POST /analyze-file` - 파일 분석
- `POST /modify-file` - 파일 수정
- `POST /write-file` - 파일 쓰기
- `POST /diff-files` - 파일 비교
- `POST /merge-files` - 파일 병합

## 💡 사용 예제

### OpenAI Python 클라이언트 사용
```python
from openai import OpenAI

# 로컬 서버에 연결
client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="not-needed"  # API 키 불필요
)

# 채팅 완성
response = client.chat.completions.create(
    model="cursor-cli",
    messages=[
        {"role": "user", "content": "Swift에서 MVVM 패턴을 구현하는 방법을 알려주세요."}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
```

### 스트리밍 응답 사용
```python
# 스트리밍 응답
response = client.chat.completions.create(
    model="cursor-cli",
    messages=[
        {"role": "user", "content": "iOS 앱 개발 가이드를 작성해주세요."}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### cURL을 사용한 직접 호출
```bash
# 일반 채팅
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cursor-cli",
    "messages": [
      {"role": "user", "content": "안녕하세요!"}
    ],
    "temperature": 0.7
  }'

# 스트리밍 채팅
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cursor-cli",
    "messages": [
      {"role": "user", "content": "코드를 설명해주세요."}
    ],
    "stream": true
  }' --no-buffer
```

## 🔧 설정 및 커스터마이징

### 환경 변수
```bash
export PORT=3000                    # 서버 포트 (기본값: 3000)
export CURSOR_WORKSPACE="/path"     # 기본 워킹 디렉토리
```

### 서버 설정 수정
`server.js` 파일에서 다음 설정을 수정할 수 있습니다:
- 포트 번호
- 요청 크기 제한
- 타임아웃 설정
- Cursor CLI 명령 옵션

## 🐛 문제 해결

### 일반적인 문제들

#### 1. Cursor CLI 인증 오류
```bash
cursor login
# 브라우저에서 인증 완료 후 서버 재시작
```

#### 2. 포트 충돌
```bash
# 다른 포트 사용
PORT=3001 node server.js
```

#### 3. 파일 권한 오류
```bash
# 프로젝트 폴더 권한 확인
ls -la /Users/aiden/YourProjectPath
```

#### 4. 메모리 부족
```bash
# Node.js 메모리 제한 증가
node --max-old-space-size=4096 server.js
```

### 로그 확인
서버 콘솔에서 실시간 로그를 확인할 수 있습니다:
- Cursor CLI 명령 실행 상태
- 작업 진행 상황
- 오류 메시지

## 📈 성능 최적화

### 권장 설정
- **메모리**: 최소 4GB RAM
- **CPU**: 멀티코어 프로세서 권장
- **디스크**: SSD 권장 (임시 파일 처리용)

### 모니터링
- 웹 대시보드에서 실시간 성능 모니터링
- 작업 이력을 통한 성능 분석
- 메모리 사용량 및 응답 시간 추적

## 🤝 기여하기

1. 이슈 리포트: 버그나 개선 사항을 이슈로 등록
2. 기능 요청: 새로운 기능 제안
3. 코드 기여: Pull Request 제출

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

## 📞 지원

문제가 발생하거나 도움이 필요한 경우:
1. 웹 대시보드에서 작업 상태 확인
2. 서버 로그 확인
3. API 엔드포인트 테스트

---

**마지막 업데이트**: 2025-09-18  
**서버 버전**: 1.0.0  
**Node.js 버전**: v18.0.0 이상 권장
