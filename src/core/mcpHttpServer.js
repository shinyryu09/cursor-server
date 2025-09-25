import express from 'express';
import cors from 'cors';
import logger from '../utils/logger.js';
import { MCPServer } from './mcpServer.js';

/**
 * MCP HTTP 서버 (Cursor Editor 전용)
 * Cursor Editor와의 MCP 프로토콜 통신을 위한 단순화된 서버
 * stdio 대신 HTTP를 통한 MCP 프로토콜 지원
 */
export class MCPHttpServer {
  constructor(mcpServer = null) {
    this.app = express();
    this.server = null;
    this.mcpServer = mcpServer; // 외부에서 전달받은 MCP 서버 인스턴스 사용
    this.port = 3001;
    
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
      logger.debug(`${req.method} ${req.path}`, req.body);
      next();
    });
  }

  /**
   * 라우트 설정 (Cursor Editor 전용)
   */
  setupRoutes() {
    // MCP 프로토콜 엔드포인트 (Cursor Editor 연결용)
    this.app.post('/', this.handleMCPRequest.bind(this));
    this.app.post('/mcp', this.handleMCPRequest.bind(this));
    
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // 서버 정보 (Cursor Editor 연결 정보)
    this.app.get('/', (req, res) => {
      res.json({
        name: 'MCP Cursor Server',
        version: '2.0.0',
        description: 'Cursor Editor 전용 MCP 서버',
        client: 'Cursor Editor',
        jsonRpcVersions: ['1.0', '2.0'],
        endpoints: {
          mcp: ['POST /', 'POST /mcp']
        },
        supportedProtocols: {
          'JSON-RPC 1.0': {
            specification: 'https://www.jsonrpc.org/specification_v1',
            features: ['notifications', 'array params', 'error handling']
          },
          'JSON-RPC 2.0': {
            specification: 'https://www.jsonrpc.org/specification',
            features: ['notifications', 'named params', 'batch requests', 'error codes']
          }
        },
        connection: {
          type: 'HTTP MCP',
          url: `http://localhost:${this.port}`,
          protocol: 'MCP over HTTP'
        }
      });
    });

    // MCP HTTP 서버는 순수 MCP 프로토콜만 지원
    // HTTP 호환 엔드포인트는 HTTP 프록시 서버(포트 3000)에서만 제공
  }


  /**
   * MCP 프로토콜 요청 처리 (기본)
   * JSON-RPC 1.0, 2.0 모두 지원
   */
  async handleMCPRequest(req, res) {
    try {
      const { jsonrpc, id, method, params } = req.body;
      
      // JSON-RPC 버전 감지
      const isJsonRpc2 = jsonrpc === '2.0';
      const isJsonRpc1 = !jsonrpc && method && (id !== undefined || params !== undefined);
      
      if (!isJsonRpc2 && !isJsonRpc1) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: id || null
        });
      }
      
      if (!method) {
        return res.status(400).json({
          jsonrpc: isJsonRpc2 ? '2.0' : undefined,
          error: { code: -32600, message: 'Invalid Request' },
          id: id || null
        });
      }

      // JSON-RPC 1.0 notification 처리 (id가 null)
      if (isJsonRpc1 && id === null) {
        logger.info(`JSON-RPC 1.0 notification: ${method}`);
        // notification은 응답하지 않음
        return res.status(200).end();
      }

      // JSON-RPC 2.0 notification 처리 (id가 없음)
      if (isJsonRpc2 && id === undefined) {
        logger.info(`JSON-RPC 2.0 notification: ${method}`);
        // notification은 응답하지 않음
        return res.status(200).end();
      }

      // MCP 서버 초기화 (필요시)
      // MCP 서버 확인 (외부에서 전달받은 인스턴스 사용)
      if (!this.mcpServer) {
        return res.status(500).json({
          jsonrpc: isJsonRpc2 ? '2.0' : undefined,
          error: { code: -32603, message: 'MCP server not initialized' },
          id
        });
      }

      let result;
      
      // JSON-RPC 요청 객체 생성 (버전에 따라)
      const requestObj = isJsonRpc2 ? {
        jsonrpc: '2.0',
        id,
        method,
        params
      } : {
        id,
        method,
        params: Array.isArray(params) ? params : (params ? [params] : [])
      };
      
      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
          
        case 'tools/list':
          result = await this.handleToolsList();
          break;
          
        case 'tools/call':
          result = await this.handleToolCall(params);
          break;
          
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
          
        case 'resources/read':
          result = await this.handleResourceRead(params);
          break;
          
        default:
          return res.status(400).json({
            jsonrpc: isJsonRpc2 ? '2.0' : undefined,
            error: { code: -32601, message: 'Method not found' },
            id
          });
      }

      // JSON-RPC 응답 객체 생성 (버전에 따라)
      const responseObj = isJsonRpc2 ? {
        jsonrpc: '2.0',
        result: result,
        id
      } : {
        result: result,
        error: null,
        id
      };
      
      res.json(responseObj);
      
    } catch (error) {
      logger.error('MCP 요청 처리 오류:', error);
      
      // JSON-RPC 버전에 따른 오류 응답
      const isJsonRpc2 = req.body.jsonrpc === '2.0';
      const errorResponse = isJsonRpc2 ? {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: req.body.id || null
      } : {
        result: null,
        error: { code: -32603, message: 'Internal error' },
        id: req.body.id || null
      };
      
      res.status(500).json(errorResponse);
    }
  }

  /**
   * 클라이언트 워킹 디렉토리 감지
   */
  detectClientWorkingDirectory(params) {
    // MCP 프로토콜에서 클라이언트 정보 확인
    const clientInfo = params?.clientInfo || {};
    
    // 클라이언트에서 제공하는 워킹 디렉토리 확인
    const clientWorkingDir = clientInfo.workingDirectory || 
                           clientInfo.rootPath || 
                           clientInfo.projectPath ||
                           process.env.CLIENT_WORKING_DIR || 
                           process.env.CWD || 
                           process.env.PWD || 
                           process.cwd();
    
    logger.info(`[MCP HTTP] 클라이언트 워킹 디렉토리 감지: ${clientWorkingDir}`);
    return clientWorkingDir;
  }

  /**
   * MCP Initialize 핸들러
   */
  async handleInitialize(params) {
    // MCP 프로토콜 표준: params는 {protocolVersion, capabilities, clientInfo} 형태
    // 클라이언트 워킹 디렉토리 자동 감지
    const clientWorkingDir = this.detectClientWorkingDirectory(params);
    const project = await this.mcpServer.projectDetector.detectProject(clientWorkingDir);
    const availableModels = this.mcpServer.aiService.getAvailableModels();
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true },
        prompts: { listChanged: true }
      },
      serverInfo: {
        name: 'MCP Cursor Server',
        version: '2.0.0',
        description: 'MCP server for Cursor Editor integration with AI models',
        jsonRpcVersions: ['1.0', '2.0']
      },
      project: project,
      models: availableModels
    };
  }

  /**
   * MCP Tools List 핸들러
   */
  async handleToolsList() {
    return {
      tools: [
        {
          name: 'cursor_chat',
          description: 'Cursor Editor 기본 모델을 사용한 채팅',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: '사용자 메시지'
              }
            },
            required: ['message']
          }
        },
        {
          name: 'ai_chat',
          description: 'AI 모델을 사용한 채팅',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: '사용자 메시지'
              },
              model: {
                type: 'string',
                description: '사용할 AI 모델'
              }
            },
            required: ['message']
          }
        },
        {
          name: 'analyze_code',
          description: '코드 분석 및 개선 제안',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '분석할 파일 경로'
              },
              analysisType: {
                type: 'string',
                enum: ['syntax', 'performance', 'security', 'style', 'general'],
                description: '분석 유형'
              }
            },
            required: ['filePath']
          }
        },
        {
          name: 'detect_project',
          description: '현재 작업 디렉토리에서 프로젝트 감지',
          inputSchema: {
            type: 'object',
            properties: {
              workingDir: {
                type: 'string',
                description: '작업 디렉토리 경로 (선택사항)'
              }
            }
          }
        }
      ]
    };
  }

  /**
   * MCP Tool Call 핸들러
   */
  async handleToolCall(params) {
    // MCP 프로토콜 표준: params는 항상 {name, arguments} 형태
    let name, args;
    
    if (Array.isArray(params)) {
      // JSON-RPC 1.0에서 Array로 전달된 경우, 첫 번째 요소가 {name, arguments} 객체
      const paramObj = params[0];
      if (paramObj && typeof paramObj === 'object') {
        ({ name, arguments: args } = paramObj);
      } else {
        throw new Error('Invalid MCP tool call parameters: expected {name, arguments} object');
      }
    } else {
      // JSON-RPC 2.0: params = {name, arguments}
      ({ name, arguments: args } = params);
    }
    
    // MCP 프로토콜 표준: 필수 파라미터 검증
    if (!name || typeof name !== 'string') {
      throw new Error('MCP tool call requires valid tool name');
    }
    
    if (!args || typeof args !== 'object') {
      throw new Error('MCP tool call requires valid arguments object');
    }
    
    try {
      switch (name) {
        case 'cursor_chat':
          if (!args.message || typeof args.message !== 'string') {
            throw new Error('cursor_chat requires message parameter');
          }
          return await this.mcpServer.aiService.chatWithCursorDefault(args.message);
        
        case 'ai_chat':
          if (!args.message || typeof args.message !== 'string') {
            throw new Error('ai_chat requires message parameter');
          }
          return await this.mcpServer.aiService.chat(args.message, args.model);
        
        case 'analyze_code':
          if (!args.filePath || typeof args.filePath !== 'string') {
            throw new Error('analyze_code requires filePath parameter');
          }
          return await this.mcpServer.aiService.analyzeCode(args.filePath, args.analysisType || 'general');
        
        case 'detect_project':
          return await this.mcpServer.projectDetector.detectProject(args.workingDir);
        
        default:
          throw new Error(`Unknown MCP tool: ${name}`);
      }
    } catch (error) {
      logger.error(`MCP tool call error for ${name}:`, error);
      throw error;
    }
  }

  /**
   * MCP Resources List 핸들러
   */
  async handleResourcesList() {
    return {
      resources: [
        {
          uri: 'models://available',
          name: 'Available AI Models',
          description: '사용 가능한 AI 모델 목록',
          mimeType: 'application/json'
        }
      ]
    };
  }

  /**
   * MCP Resource Read 핸들러
   */
  async handleResourceRead(params) {
    // MCP 프로토콜 표준: params는 {uri} 형태
    let uri;
    
    if (Array.isArray(params)) {
      // JSON-RPC 1.0에서 Array로 전달된 경우, 첫 번째 요소가 {uri} 객체
      const paramObj = params[0];
      if (paramObj && typeof paramObj === 'object') {
        ({ uri } = paramObj);
      } else {
        throw new Error('Invalid MCP resource read parameters: expected {uri} object');
      }
    } else {
      // JSON-RPC 2.0: params = {uri}
      ({ uri } = params);
    }
    
    // MCP 프로토콜 표준: URI 검증
    if (!uri || typeof uri !== 'string') {
      throw new Error('MCP resource read requires valid URI');
    }
    
    if (uri === 'models://available') {
      // MCP 서버가 초기화되지 않은 경우 초기화
      if (!this.mcpServer) {
        this.mcpServer = new MCPServer();
        await this.mcpServer.initialize();
        logger.info('MCP 서버 초기화 완료 (Resource Read)');
      }
      
      const models = this.mcpServer.aiService.getAvailableModels();
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify(models, null, 2)
          }
        ]
      };
    }
    
    throw new Error(`Unknown MCP resource: ${uri}`);
  }



  /**
   * 서버 시작
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`MCP HTTP 서버 시작 시도: 포트 ${this.port}`);
        // MCP HTTP 서버 (포트 3001)
        this.server = this.app.listen(this.port, 'localhost', () => {
          logger.info(`MCP HTTP 서버가 시작되었습니다: http://localhost:${this.port} (Cursor Editor 전용)`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('MCP HTTP 서버 오류:', error);
          reject(error);
        });
      } catch (error) {
        logger.error('MCP HTTP 서버 시작 실패:', error);
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
          logger.info('MCP HTTP 서버가 중지되었습니다');
        });
      }
      
      logger.info('MCP HTTP 서버가 중지되었습니다');
      resolve();
    });
  }
}