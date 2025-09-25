import express from 'express';
import cors from 'cors';
import logger from '../utils/logger.js';

/**
 * HTTP 프록시 서버
 * MCP 서버와 클라이언트들(Xcode, Android Studio, IntelliJ) 간의 중계 역할
 */
export class HttpProxyServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 3000;
    this.mcpServerUrl = 'http://localhost:3001';
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 미들웨어 설정
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // 요청 로깅
    this.app.use((req, res, next) => {
      logger.debug(`[HTTP Proxy] ${req.method} ${req.path}`, req.body);
      next();
    });
  }

  /**
   * 라우트 설정
   */
  setupRoutes() {
    // Xcode 호환성 엔드포인트
    this.app.get('/v1/models', this.handleModelsRequest.bind(this));
    this.app.post('/v1/chat/completions', this.handleChatRequest.bind(this));
    
    // Xcode 전용 엔드포인트 (추가 호환성)
    this.app.get('/models', this.handleModelsRequest.bind(this));
    this.app.get('/api/models', this.handleModelsRequest.bind(this));
    
    // Android Studio 호환성 엔드포인트
    this.app.get('/api/models', this.handleModelsRequest.bind(this));
    this.app.post('/api/chat', this.handleChatRequest.bind(this));
    
    // IntelliJ 호환성 엔드포인트
    this.app.get('/intellij/models', this.handleModelsRequest.bind(this));
    this.app.post('/intellij/chat', this.handleChatRequest.bind(this));
    
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        proxy: 'HTTP Proxy Server',
        mcpServer: this.mcpServerUrl
      });
    });
    
    // 서버 정보
    this.app.get('/', (req, res) => {
      res.json({
        name: 'MCP HTTP Proxy Server',
        version: '2.0.0',
        description: 'MCP 서버와 클라이언트들 간의 HTTP 프록시',
        supportedClients: ['Xcode', 'Android Studio', 'IntelliJ'],
        endpoints: {
          xcode: {
            models: 'GET /v1/models',
            chat: 'POST /v1/chat/completions'
          },
          androidStudio: {
            models: 'GET /api/models',
            chat: 'POST /api/chat'
          },
          intellij: {
            models: 'GET /intellij/models',
            chat: 'POST /intellij/chat'
          }
        },
        mcpServer: this.mcpServerUrl
      });
    });
  }

  /**
   * 모델 목록 요청 처리
   */
  async handleModelsRequest(req, res) {
    try {
      logger.info(`[HTTP Proxy] 모델 목록 요청: ${req.path}`);
      
      // MCP 서버로 initialize 요청 전달
      const mcpResponse = await this.forwardToMCPServer('initialize', {});
      
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
      
      // Xcode 호환성을 위한 추가 헤더 설정
      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const response = {
        object: 'list',
        data: models
      };
      
      logger.info(`[HTTP Proxy] 모델 목록 반환: ${models.length}개 모델`);
      res.json(response);
      
    } catch (error) {
      logger.error('[HTTP Proxy] 모델 목록 요청 오류:', error);
      res.status(500).json({
        error: {
          message: error.message,
          type: 'server_error'
        }
      });
    }
  }

  /**
   * 채팅 요청 처리
   */
  async handleChatRequest(req, res) {
    try {
      const { model, messages, stream = false } = req.body;
      
      logger.info(`[HTTP Proxy] 채팅 요청: ${req.path}`, {
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
      
      // MCP 서버로 채팅 요청 전달
      const toolName = (model === 'cursor-default' || !model) ? 'cursor_chat' : 'ai_chat';
      const mcpParams = {
        name: toolName,
        arguments: {
          message: userMessage,
          ...(model && model !== 'cursor-default' && { model })
        }
      };
      
      const mcpResponse = await this.forwardToMCPServer('tools/call', mcpParams);
      
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
      logger.error('[HTTP Proxy] 채팅 요청 오류:', error);
      res.status(500).json({
        error: {
          message: error.message,
          type: 'server_error'
        }
      });
    }
  }

  /**
   * MCP 서버로 요청 전달
   */
  async forwardToMCPServer(method, params = {}) {
    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: method,
          params: params,
          id: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`MCP 서버 응답 오류: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('[HTTP Proxy] MCP 서버 요청 실패:', error);
      throw error;
    }
  }

  /**
   * 서버 시작
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`HTTP 프록시 서버 시작 시도: 포트 ${this.port}`);
        this.server = this.app.listen(this.port, 'localhost', () => {
          logger.info(`HTTP 프록시 서버가 시작되었습니다: http://localhost:${this.port}`);
          resolve();
        });
        
        this.server.on('error', (error) => {
          logger.error('HTTP 프록시 서버 오류:', error);
          reject(error);
        });
      } catch (error) {
        logger.error('HTTP 프록시 서버 시작 실패:', error);
        reject(error);
      }
    });
  }

  /**
   * 서버 중지
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP 프록시 서버가 중지되었습니다');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
