#!/usr/bin/env node

/**
 * Xcode MCP HTTP Wrapper
 * MCP 프로토콜을 HTTP API로 래핑하여 Xcode 호환성 제공
 */

const express = require('express');
const axios = require('axios');

const app = express();
const MCP_SERVER_URL = 'http://localhost:3001';

app.use(express.json());

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// MCP 서버로 요청 전달
async function forwardToMCPServer(method, params = {}) {
  try {
    const response = await axios.post(MCP_SERVER_URL, {
      method: method,
      params: params,
      id: Date.now()
    });
    return response.data;
  } catch (error) {
    console.error('MCP 서버 요청 실패:', error.message);
    throw error;
  }
}

// 모델 목록 조회 (Xcode 호환)
app.get('/v1/models', async (req, res) => {
  try {
    console.log('GET /v1/models - Xcode 모델 목록 요청');
    
    const mcpResponse = await forwardToMCPServer('initialize', {});
    
    if (mcpResponse.error) {
      return res.status(500).json({
        error: {
          message: mcpResponse.error.message,
          type: 'server_error'
        }
      });
    }
    
    const models = mcpResponse.result.models.map(model => ({
      id: model.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: model.provider || 'cursor-server'
    }));
    
    console.log(`모델 목록 반환: ${models.length}개 모델`);
    
    res.json({
      object: 'list',
      data: models
    });
  } catch (error) {
    console.error('모델 목록 조회 오류:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// 채팅 요청 (Xcode 호환)
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, stream = false } = req.body;
    
    console.log('POST /v1/chat/completions - Xcode 채팅 요청:', {
      model,
      messages: messages?.length,
      stream
    });
    
    // 메시지에서 사용자 메시지 추출
    let userMessage = '';
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.content) {
        if (Array.isArray(lastMessage.content)) {
          const textContent = lastMessage.content.find(c => c.type === 'text');
          if (textContent) {
            userMessage = textContent.text;
          }
        } else if (typeof lastMessage.content === 'string') {
          userMessage = lastMessage.content;
        }
      }
    }
    
    if (!userMessage) {
      return res.status(400).json({
        error: {
          message: 'No user message found in request',
          type: 'invalid_request_error'
        }
      });
    }
    
    // MCP 프로토콜로 채팅 요청
    const toolName = (model === 'cursor-default' || !model) ? 'cursor_chat' : 'ai_chat';
    const mcpParams = {
      name: toolName,
      arguments: {
        message: userMessage,
        ...(model && model !== 'cursor-default' && { model })
      }
    };
    
    const mcpResponse = await forwardToMCPServer('tools/call', mcpParams);
    
    if (mcpResponse.error) {
      return res.status(500).json({
        error: {
          message: mcpResponse.error.message,
          type: 'server_error'
        }
      });
    }
    
    const result = mcpResponse.result;
    const content = result.content || result;
    
    if (stream) {
      // 스트리밍 응답
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const responseId = `chatcmpl-${Date.now()}`;
      const chunks = content.match(/.{1,50}/g) || [content];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;
        
        const streamData = {
          id: responseId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model || 'cursor-default',
          choices: [{
            index: 0,
            delta: {
              content: chunk
            },
            finish_reason: isLast ? 'stop' : null
          }]
        };
        
        res.write(`data: ${JSON.stringify(streamData)}\n\n`);
        
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 일반 JSON 응답
      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'cursor-default',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content
          },
          finish_reason: 'stop'
        }],
        usage: result.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
      
      res.json(response);
    }
  } catch (error) {
    console.error('채팅 요청 오류:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 서버 정보
app.get('/', (req, res) => {
  res.json({
    name: 'Xcode MCP HTTP Wrapper',
    version: '1.0.0',
    description: 'MCP 프로토콜을 HTTP API로 래핑하여 Xcode 호환성 제공',
    endpoints: {
      models: 'GET /v1/models',
      chat: 'POST /v1/chat/completions',
      health: 'GET /health'
    },
    mcpServer: MCP_SERVER_URL
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Xcode MCP HTTP Wrapper가 시작되었습니다: http://localhost:${PORT}`);
  console.log(`📡 MCP 서버: ${MCP_SERVER_URL}`);
  console.log(`🔗 Xcode 연결: http://localhost:${PORT}/v1/chat/completions`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Xcode MCP HTTP Wrapper를 중지하는 중...');
  process.exit(0);
});

