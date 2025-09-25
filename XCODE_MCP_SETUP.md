# Xcode MCP 프로토콜 연결 가이드

## 🚀 Xcode에서 MCP Cursor Server 연결하기

### **1. MCP 프로토콜 전용 서버**

MCP Cursor Server는 이제 MCP 프로토콜 전용으로 작동합니다:
- **포트**: 3001
- **프로토콜**: MCP (JSON-RPC 1.0/2.0)
- **레거시 HTTP API**: 완전 제거됨

### **2. Xcode 설정 방법**

#### **방법 1: MCP 프로토콜 직접 연결 (권장)**

1. **서버 시작**:
   ```bash
   node src/server.js start
   ```

2. **MCP 프로토콜로 모델 목록 조회**:
   ```bash
   curl -X POST http://localhost:3001/ \
     -H "Content-Type: application/json" \
     -d '{"method": "initialize", "params": {}, "id": 1}'
   ```

3. **Xcode에서 MCP 프로토콜 사용**:
   - MCP 프로토콜을 지원하는 Xcode 플러그인 사용
   - 또는 MCP 클라이언트 라이브러리 사용

#### **방법 2: MCP 프로토콜을 HTTP로 래핑**

Xcode가 MCP 프로토콜을 직접 지원하지 않는 경우, 간단한 HTTP 래퍼를 만들 수 있습니다:

```javascript
// mcp-http-wrapper.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// MCP 서버로 요청 전달
app.post('/v1/models', async (req, res) => {
  try {
    const mcpResponse = await axios.post('http://localhost:3001/', {
      method: 'initialize',
      params: {},
      id: 1
    });
    
    const models = mcpResponse.data.result.models.map(model => ({
      id: model.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: model.provider
    }));
    
    res.json({
      object: 'list',
      data: models
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('MCP HTTP Wrapper running on port 3000');
});
```

### **3. 지원되는 MCP 메서드**

- **`initialize`**: 서버 초기화 및 모델 목록 조회
- **`tools/list`**: 사용 가능한 도구 목록
- **`tools/call`**: 도구 실행 (채팅, 코드 분석 등)
- **`resources/list`**: 사용 가능한 리소스 목록
- **`resources/read`**: 리소스 읽기

### **4. 사용 가능한 AI 모델**

- **cursor-default**: Cursor Editor 기본 모델
- **gpt-4**: OpenAI GPT-4
- **gpt-3.5-turbo**: OpenAI GPT-3.5 Turbo
- **claude-3-5-sonnet-20241022**: Anthropic Claude 3.5 Sonnet
- **claude-3-haiku-20240307**: Anthropic Claude 3 Haiku
- **gemini-pro**: Google Gemini Pro

### **5. MCP 프로토콜 예제**

#### **모델 목록 조회**:
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{"method": "initialize", "params": {}, "id": 1}'
```

#### **채팅 요청**:
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "cursor_chat",
      "arguments": {
        "message": "안녕하세요!"
      }
    },
    "id": 1
  }'
```

### **6. 문제 해결**

#### **"No model selected" 오류**:
- Xcode가 레거시 HTTP API를 사용하려고 함
- MCP 프로토콜로 연결하거나 HTTP 래퍼 사용

#### **연결 실패**:
- 서버가 포트 3001에서 실행 중인지 확인
- MCP 프로토콜 요청 형식 확인

### **7. 아키텍처 변경사항**

- **이전**: HTTP API + MCP 프로토콜 혼재
- **현재**: MCP 프로토콜 전용
- **장점**: 표준 준수, 단순한 아키텍처, 확장성

---

**참고**: 이제 MCP Cursor Server는 MCP 프로토콜 표준에 완전히 맞춰 작동합니다. Xcode에서 연결하려면 MCP 프로토콜을 지원하는 클라이언트를 사용하거나 HTTP 래퍼를 만들어야 합니다.

