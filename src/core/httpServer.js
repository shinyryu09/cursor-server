import express from 'express';
import cors from 'cors';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import ProjectDetector from '../services/projectDetector.js';
import CursorEditorService from '../services/cursorEditorService.js';
import AIService from '../services/aiService.js';
import ChatHistoryService from '../services/chatHistoryService.js';

/**
 * HTTP MCP 서버
 */
export class HttpMCPServer {
  constructor() {
    this.app = express();
    this.projectDetector = new ProjectDetector();
    this.cursorEditorService = new CursorEditorService();
    this.aiService = new AIService();
    this.chatHistoryService = new ChatHistoryService();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 미들웨어 설정
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      const start = Date.now();
      const timestamp = new Date().toISOString();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      
      next();
    });
  }

  /**
   * 라우트 설정
   */
  setupRoutes() {
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.mcp.version,
        server: {
          name: config.mcp.name,
          description: config.mcp.description,
          startTime: new Date().toISOString()
        },
        workspace: process.cwd(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      });
    });

    // OpenAI 호환 API 엔드포인트 (Xcode Code Intelligence용)
    this.app.get('/v1/models', (req, res) => {
      res.json({
        object: 'list',
        data: [
          {
            id: 'cursor-editor',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'mcp-cursor-server',
            status: 'active',
            description: 'Cursor Editor HTTP API를 통한 코드 생성 및 분석'
          },
          {
            id: 'cursor-ai',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'mcp-cursor-server',
            status: 'active',
            description: 'AI 모델을 통한 코드 생성 및 분석'
          }
        ]
      });
    });

    // OpenAI 호환 모델 정보 엔드포인트
    this.app.get('/v1/models/:modelId', (req, res) => {
      const { modelId } = req.params;
      
      if (modelId === 'cursor-editor' || modelId === 'cursor-ai') {
        res.json({
          id: modelId,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'mcp-cursor-server',
          status: 'active',
          description: modelId === 'cursor-editor' 
            ? 'Cursor Editor HTTP API를 통한 코드 생성 및 분석'
            : 'AI 모델을 통한 코드 생성 및 분석'
        });
      } else {
        res.status(404).json({
          error: {
            message: 'Model not found',
            type: 'not_found'
          }
        });
      }
    });

    // OpenAI 호환 채팅 완료 엔드포인트
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const { model, messages, stream = false } = req.body;
        
        if (!model || !messages || !Array.isArray(messages)) {
          return res.status(400).json({
            error: {
              message: 'Invalid request: model and messages are required',
              type: 'invalid_request_error'
            }
          });
        }

        // 마지막 사용자 메시지 추출
        const lastMessage = messages[messages.length - 1];
        const userMessage = lastMessage?.content || '';
        
        // 매우 간단한 응답으로 타임아웃 방지
        let response = '';
        
        if (model === 'cursor-editor') {
          // 간단한 응답만 제공
          response = `안녕하세요! Cursor Editor가 도움을 드리겠습니다. 질문: ${userMessage}`;
        } else if (model === 'cursor-ai') {
          response = `안녕하세요! AI가 도움을 드리겠습니다. 질문: ${userMessage}`;
        } else {
          return res.status(400).json({
            error: {
              message: `Unknown model: ${model}`,
              type: 'invalid_request_error'
            }
          });
        }

        // 항상 스트리밍으로 응답 (Xcode가 스트리밍을 선호)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
        
        // 즉시 응답 시작
        const responseId = `chatcmpl-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        
        // 첫 번째 청크 즉시 전송
        res.write(`data: ${JSON.stringify({
          id: responseId,
          object: 'chat.completion.chunk',
          created: created,
          model: model,
          choices: [{
            index: 0,
            delta: { content: response },
            finish_reason: 'stop'
          }]
        })}\n\n`);
        
        // 완료 신호
        res.write('data: [DONE]\n\n');
        res.end();
        
      } catch (error) {
        logger.error('Chat completions 오류:', error);
        res.status(500).json({
          error: {
            message: 'Internal server error',
            type: 'server_error'
          }
        });
      }
    });

    // MCP 초기화
    this.app.post('/mcp/initialize', async (req, res) => {
      try {
        logger.info('MCP 서버 초기화 요청');
        
        // 프로젝트 감지
        const project = await this.projectDetector.detectProject();
        
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              resources: {
                subscribe: true,
                listChanged: true
              },
              tools: {
                listChanged: true
              },
              prompts: {
                listChanged: true
              }
            },
            serverInfo: {
              name: config.mcp.name,
              version: config.mcp.version,
              description: config.mcp.description
            },
            project: project
          }
        });
      } catch (error) {
        logger.error('MCP 초기화 오류:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // 리소스 목록
    this.app.post('/mcp/resources/list', async (req, res) => {
      try {
        const project = this.projectDetector.getCurrentProject();
        const resources = [];

        if (project) {
          resources.push({
            uri: `project://${project.type}`,
            name: project.name,
            description: `${project.type} 프로젝트: ${project.name}`,
            mimeType: 'application/json'
          });

          if (project.type === 'xcode' && project.projectFile) {
            resources.push({
              uri: `file://${project.projectFile}`,
              name: `${project.name}.xcodeproj`,
              description: 'Xcode 프로젝트 파일',
              mimeType: 'application/x-xcode-project'
            });
          }
        }

        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: { resources }
        });
      } catch (error) {
        logger.error('리소스 목록 오류:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // 리소스 읽기
    this.app.post('/mcp/resources/read', async (req, res) => {
      try {
        const { uri } = req.body.params;
        
        if (uri.startsWith('project://')) {
          const project = this.projectDetector.getCurrentProject();
          res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(project, null, 2)
                }
              ]
            }
          });
        } else if (uri.startsWith('file://')) {
          const filePath = uri.replace('file://', '');
          const fs = await import('fs/promises');
          const content = await fs.readFile(filePath, 'utf8');
          const mimeType = this.getMimeType(filePath);
          
          res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: {
              contents: [
                {
                  uri,
                  mimeType,
                  text: content
                }
              ]
            }
          });
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32602,
              message: 'Invalid params',
              data: `지원하지 않는 리소스 URI: ${uri}`
            }
          });
        }
      } catch (error) {
        logger.error('리소스 읽기 오류:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // 도구 목록
    this.app.post('/mcp/tools/list', async (req, res) => {
      try {
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: {
            tools: [
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
              },
              {
                name: 'cursor_editor_chat',
                description: 'Cursor Editor HTTP API를 사용한 채팅',
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      description: '채팅 메시지'
                    },
                    files: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '관련 파일 경로들 (선택사항)'
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
                      description: '채팅 메시지'
                    },
                    model: {
                      type: 'string',
                      description: '사용할 AI 모델',
                      enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-5-sonnet', 'gemini-pro']
                    },
                    context: {
                      type: 'string',
                      description: '추가 컨텍스트 (선택사항)'
                    }
                  },
                  required: ['message', 'model']
                }
              }
            ]
          }
        });
      } catch (error) {
        logger.error('도구 목록 오류:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // 도구 실행
    this.app.post('/mcp/tools/call', async (req, res) => {
      try {
        const { name, arguments: args } = req.body.params;

        let result;
        switch (name) {
          case 'detect_project':
            const project = await this.projectDetector.detectProject(args.workingDir);
            result = {
              content: [
                {
                  type: 'text',
                  text: project 
                    ? `프로젝트 감지됨: ${project.name} (${project.type}) - ${project.path}`
                    : '프로젝트를 찾을 수 없습니다.'
                }
              ]
            };
            break;

          case 'cursor_editor_chat':
            const cursorEditorResult = await this.cursorEditorService.chat(args.message, args.files);
            result = {
              content: [
                {
                  type: 'text',
                  text: cursorEditorResult
                }
              ]
            };
            break;

          case 'ai_chat':
            const aiResult = await this.aiService.chat(args.message, args.model, args.context);
            result = {
              content: [
                {
                  type: 'text',
                  text: aiResult
                }
              ]
            };
            break;

          default:
            throw new Error(`알 수 없는 도구: ${name}`);
        }

        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result
        });
      } catch (error) {
        logger.error(`도구 실행 오류 (${req.body.params.name}):`, error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // 채팅 히스토리 API 엔드포인트
    this.setupChatHistoryRoutes();

    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  /**
   * 채팅 히스토리 라우트 설정
   */
  setupChatHistoryRoutes() {
    // 새 세션 생성
    this.app.post('/api/chat/sessions', async (req, res) => {
      try {
        const sessionId = this.chatHistoryService.generateSessionId();
        res.json({
          sessionId,
          message: '새 채팅 세션이 생성되었습니다.',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('세션 생성 실패:', error);
        res.status(500).json({
          error: '세션 생성 실패',
          message: error.message
        });
      }
    });

    // 채팅 메시지 저장
    this.app.post('/api/chat/sessions/:sessionId/messages', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { message, response, metadata } = req.body;

        if (!message || !response) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'message와 response는 필수입니다.'
          });
        }

        const messageId = await this.chatHistoryService.saveMessage(
          sessionId,
          message,
          response,
          metadata
        );

        res.json({
          messageId,
          sessionId,
          message: '채팅 메시지가 저장되었습니다.',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('메시지 저장 실패:', error);
        res.status(500).json({
          error: '메시지 저장 실패',
          message: error.message
        });
      }
    });

    // 세션 히스토리 조회
    this.app.get('/api/chat/sessions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { limit = 50 } = req.query;

        const history = await this.chatHistoryService.getSessionHistory(
          sessionId,
          parseInt(limit)
        );

        if (!history) {
          return res.status(404).json({
            error: 'Not Found',
            message: '세션을 찾을 수 없습니다.'
          });
        }

        res.json(history);
      } catch (error) {
        logger.error('히스토리 조회 실패:', error);
        res.status(500).json({
          error: '히스토리 조회 실패',
          message: error.message
        });
      }
    });

    // 모든 세션 목록 조회
    this.app.get('/api/chat/sessions', async (req, res) => {
      try {
        const sessions = await this.chatHistoryService.getAllSessions();
        res.json({
          sessions,
          count: sessions.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('세션 목록 조회 실패:', error);
        res.status(500).json({
          error: '세션 목록 조회 실패',
          message: error.message
        });
      }
    });

    // 세션 삭제
    this.app.delete('/api/chat/sessions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const deleted = await this.chatHistoryService.deleteSession(sessionId);

        if (!deleted) {
          return res.status(404).json({
            error: 'Not Found',
            message: '세션을 찾을 수 없습니다.'
          });
        }

        res.json({
          message: '세션이 삭제되었습니다.',
          sessionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('세션 삭제 실패:', error);
        res.status(500).json({
          error: '세션 삭제 실패',
          message: error.message
        });
      }
    });

    // 히스토리 검색
    this.app.get('/api/chat/search', async (req, res) => {
      try {
        const { q: keyword, limit = 20 } = req.query;

        if (!keyword) {
          return res.status(400).json({
            error: 'Bad Request',
            message: '검색 키워드(q)는 필수입니다.'
          });
        }

        const results = await this.chatHistoryService.searchHistory(
          keyword,
          parseInt(limit)
        );

        res.json({
          keyword,
          results,
          count: results.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('히스토리 검색 실패:', error);
        res.status(500).json({
          error: '히스토리 검색 실패',
          message: error.message
        });
      }
    });

    // 히스토리 통계
    this.app.get('/api/chat/stats', async (req, res) => {
      try {
        const stats = await this.chatHistoryService.getStatistics();
        res.json({
          ...stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('통계 조회 실패:', error);
        res.status(500).json({
          error: '통계 조회 실패',
          message: error.message
        });
      }
    });

    // 오래된 세션 정리
    this.app.post('/api/chat/cleanup', async (req, res) => {
      try {
        const result = await this.chatHistoryService.cleanupOldSessions();
        res.json({
          ...result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('세션 정리 실패:', error);
        res.status(500).json({
          error: '세션 정리 실패',
          message: error.message
        });
      }
    });
  }

  /**
   * MIME 타입 결정
   */
  getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'swift': 'text/x-swift',
      'kt': 'text/x-kotlin',
      'java': 'text/x-java',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown'
    };
    return mimeTypes[ext] || 'text/plain';
  }

  /**
   * 서버 시작
   */
  async start() {
    try {
      // 서비스 초기화
      await this.cursorEditorService.initialize();
      await this.chatHistoryService.initialize();
      logger.info('HTTP MCP 서버 서비스 초기화 완료');
      
      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info(`🚀 HTTP MCP Server v${config.mcp.version} is running on ${config.server.host}:${config.server.port}`);
        logger.info(`📁 Default workspace: ${process.cwd()}`);
        logger.info(`🔗 Health check: http://${config.server.host}:${config.server.port}/health`);
        logger.info(`🤖 MCP endpoints: http://${config.server.host}:${config.server.port}/mcp/*`);
      });
    } catch (error) {
      logger.error('HTTP MCP 서버 시작 실패:', error);
      throw error;
    }
  }

  /**
   * 서버 중지
   */
  async stop() {
    try {
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        logger.info('HTTP MCP 서버가 중지되었습니다');
      }
    } catch (error) {
      logger.error('HTTP MCP 서버 중지 실패:', error);
      throw error;
    }
  }
}

export default HttpMCPServer;
