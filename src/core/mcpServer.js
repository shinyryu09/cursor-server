import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  PingRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { AIService } from '../services/aiService.js';
import { ProjectDetector } from '../services/projectDetector.js';
import { CacheService } from '../services/cacheService.js';

/**
 * MCP 서버 핵심 클래스
 * Cursor Editor와 직접 연결되는 MCP 프로토콜 서버
 */
export class MCPServer {
  constructor() {
    this.server = new Server(
      {
        name: config.mcp.name,
        version: config.mcp.version
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {}
        }
      }
    );

    this.aiService = new AIService();
    this.projectDetector = new ProjectDetector();
    this.cacheService = new CacheService();

    this.setupHandlers();
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    await this.aiService.initialize();
    await this.cacheService.initialize();
    logger.info('MCP 서버 서비스 초기화 완료');
  }

  /**
   * MCP 핸들러 설정
   * JSON-RPC 1.0, 2.0 모두 지원
   */
  setupHandlers() {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      logger.info('MCP 서버 초기화 요청');
      
      const project = await this.projectDetector.detectProject();
      const availableModels = this.aiService.getAvailableModels();
      
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          resources: { subscribe: true, listChanged: true },
          tools: { listChanged: true },
          prompts: { listChanged: true }
        },
        serverInfo: {
          name: config.mcp.name,
          version: config.mcp.version,
          description: 'MCP server for Cursor Editor integration with AI models',
          jsonRpcVersions: ['1.0', '2.0']
        },
        project: project,
        models: availableModels
      };
    });

    // Tools list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
    });

    // Tool call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'cursor_chat':
            return await this.aiService.chatWithCursorDefault(args.message);
          
          case 'ai_chat':
            return await this.aiService.chat(args.message, args.model);
          
          case 'analyze_code':
            return await this.aiService.analyzeCode(args.filePath, args.analysisType || 'general');
          
          case 'detect_project':
            // 클라이언트의 워킹 디렉토리 자동 감지
            const workingDir = args.workingDir || this.detectClientWorkingDirectory();
            return await this.projectDetector.detectProject(workingDir);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Tool call error for ${name}:`, error);
        throw error;
      }
    });

    // Resources list handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
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
    });

    // Resource read handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri === 'models://available') {
        const models = this.aiService.getAvailableModels();
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
      
      throw new Error(`Unknown resource: ${uri}`);
    });

    // Prompts list handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'code_review',
            description: '코드 리뷰 프롬프트',
            arguments: [
              {
                name: 'code',
                description: '리뷰할 코드',
                required: true
              }
            ]
          }
        ]
      };
    });

    // Prompt get handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'code_review') {
        return {
          description: '코드 리뷰를 위한 프롬프트',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `다음 코드를 리뷰해주세요:\n\n\`\`\`\n${args.code}\n\`\`\``
              }
            }
          ]
        };
      }
      
      throw new Error(`Unknown prompt: ${name}`);
    });
  }

  /**
   * 클라이언트 워킹 디렉토리 자동 감지
   */
  detectClientWorkingDirectory() {
    // 환경 변수에서 클라이언트 워킹 디렉토리 확인
    const clientWorkingDir = process.env.CLIENT_WORKING_DIR || 
                           process.env.CWD || 
                           process.env.PWD || 
                           process.cwd();
    
    logger.info(`클라이언트 워킹 디렉토리 감지: ${clientWorkingDir}`);
    return clientWorkingDir;
  }

  /**
   * stdio 모드로 서버 시작 (Cursor Editor 연결용)
   */
  async startStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP 서버가 stdio 모드로 시작되었습니다');
  }

  /**
   * HTTP 모드로 서버 시작 (HTTP 중계용)
   */
  async startHttp() {
    // HTTP 모드는 mcpHttpServer에서 처리
    logger.info('MCP 서버가 HTTP 모드로 시작되었습니다');
  }
}