import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { MCP_METHODS, MCP_ERROR_CODES, MCPError } from '../types/mcp.js';
import ProjectDetector from '../services/projectDetector.js';
import CursorService from '../services/cursorService.js';
import AIService from '../services/aiService.js';

/**
 * MCP 서버 핵심 클래스
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

    this.projectDetector = new ProjectDetector();
    this.cursorService = new CursorService();
    this.aiService = new AIService();

    this.setupHandlers();
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    await this.cursorService.initialize();
    logger.info('MCP 서버 서비스 초기화 완료');
  }

  /**
   * MCP 핸들러 설정
   */
  setupHandlers() {
    // 초기화 핸들러
    this.server.setRequestHandler({
      method: 'initialize',
      handler: async (request) => {
        logger.info('MCP 서버 초기화 요청');
        
        // 프로젝트 감지
        const project = await this.projectDetector.detectProject();
        
        return {
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
        };
      }
    });

    // 핑 핸들러
    this.server.setRequestHandler({
      method: 'ping',
      handler: async () => {
        return { pong: true };
      }
    });

    // 리소스 핸들러
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const project = this.projectDetector.getCurrentProject();
      const resources = [];

      if (project) {
        resources.push({
          uri: `project://${project.type}`,
          name: project.name,
          description: `${project.type} 프로젝트: ${project.name}`,
          mimeType: 'application/json'
        });

        // 프로젝트 파일들 추가
        if (project.type === 'xcode') {
          resources.push({
            uri: `file://${project.projectFile}`,
            name: `${project.name}.xcodeproj`,
            description: 'Xcode 프로젝트 파일',
            mimeType: 'application/x-xcode-project'
          });
        }
      }

      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri.startsWith('project://')) {
        const project = this.projectDetector.getCurrentProject();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(project, null, 2)
            }
          ]
        };
      }

      if (uri.startsWith('file://')) {
        const filePath = uri.replace('file://', '');
        try {
          const content = await this.readFile(filePath);
          const mimeType = this.getMimeType(filePath);
          
          return {
            contents: [
              {
                uri,
                mimeType,
                text: content
              }
            ]
          };
        } catch (error) {
          throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, `파일 읽기 실패: ${error.message}`);
        }
      }

      throw new MCPError(MCP_ERROR_CODES.INVALID_PARAMS, `지원하지 않는 리소스 URI: ${uri}`);
    });

    // 도구 핸들러
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
            name: 'cursor_chat',
            description: 'Cursor CLI를 사용한 채팅',
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
                  enum: ['syntax', 'performance', 'security', 'style'],
                  description: '분석 유형'
                }
              },
              required: ['filePath', 'analysisType']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'detect_project':
            const project = await this.projectDetector.detectProject(args.workingDir);
            return {
              content: [
                {
                  type: 'text',
                  text: project 
                    ? `프로젝트 감지됨: ${project.name} (${project.type}) - ${project.path}`
                    : '프로젝트를 찾을 수 없습니다.'
                }
              ]
            };

          case 'cursor_chat':
            const cursorResult = await this.cursorService.chat(args.message, args.files);
            return {
              content: [
                {
                  type: 'text',
                  text: cursorResult
                }
              ]
            };

          case 'ai_chat':
            const aiResult = await this.aiService.chat(args.message, args.model, args.context);
            return {
              content: [
                {
                  type: 'text',
                  text: aiResult
                }
              ]
            };

          case 'analyze_code':
            const analysisResult = await this.analyzeCode(args.filePath, args.analysisType);
            return {
              content: [
                {
                  type: 'text',
                  text: analysisResult
                }
              ]
            };

          default:
            throw new MCPError(MCP_ERROR_CODES.METHOD_NOT_FOUND, `알 수 없는 도구: ${name}`);
        }
      } catch (error) {
        logger.error(`도구 실행 오류 (${name}):`, error);
        throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);
      }
    });

    // 프롬프트 핸들러
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'code_review',
            description: '코드 리뷰 및 개선 제안',
            arguments: [
              {
                name: 'filePath',
                description: '리뷰할 파일 경로',
                required: true
              }
            ]
          },
          {
            name: 'bug_fix',
            description: '버그 수정 제안',
            arguments: [
              {
                name: 'errorMessage',
                description: '에러 메시지',
                required: true
              },
              {
                name: 'filePath',
                description: '에러가 발생한 파일 경로',
                required: true
              }
            ]
          },
          {
            name: 'feature_implementation',
            description: '기능 구현 제안',
            arguments: [
              {
                name: 'description',
                description: '구현할 기능 설명',
                required: true
              },
              {
                name: 'projectType',
                description: '프로젝트 타입 (xcode, android)',
                required: true
              }
            ]
          }
        ]
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'code_review':
          return {
            description: '코드 리뷰 및 개선 제안',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `다음 파일을 리뷰하고 개선 제안을 해주세요:\n\n파일: ${args.filePath}`
                }
              }
            ]
          };

        case 'bug_fix':
          return {
            description: '버그 수정 제안',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `다음 에러를 수정하는 방법을 제안해주세요:\n\n에러: ${args.errorMessage}\n파일: ${args.filePath}`
                }
              }
            ]
          };

        case 'feature_implementation':
          return {
            description: '기능 구현 제안',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `${args.projectType} 프로젝트에서 다음 기능을 구현하는 방법을 제안해주세요:\n\n기능: ${args.description}`
                }
              }
            ]
          };

        default:
          throw new MCPError(MCP_ERROR_CODES.METHOD_NOT_FOUND, `알 수 없는 프롬프트: ${name}`);
      }
    });
  }

  /**
   * 파일 읽기
   */
  async readFile(filePath) {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf8');
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
   * 코드 분석
   */
  async analyzeCode(filePath, analysisType) {
    try {
      const content = await this.readFile(filePath);
      const project = this.projectDetector.getCurrentProject();
      
      let prompt = `다음 ${project?.type || '코드'} 파일을 분석해주세요:\n\n`;
      prompt += `파일: ${filePath}\n`;
      prompt += `분석 유형: ${analysisType}\n\n`;
      prompt += `코드:\n\`\`\`\n${content}\n\`\`\``;

      // AI 서비스를 사용하여 분석
      const result = await this.aiService.chat(prompt, 'gpt-4');
      return result;
    } catch (error) {
      logger.error('코드 분석 오류:', error);
      return `코드 분석 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 서버 시작
   */
  async start() {
    try {
      // 서비스 초기화
      await this.initialize();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('MCP 서버가 시작되었습니다');
    } catch (error) {
      logger.error('MCP 서버 시작 실패:', error);
      throw error;
    }
  }

  /**
   * 서버 중지
   */
  async stop() {
    try {
      await this.server.close();
      logger.info('MCP 서버가 중지되었습니다');
    } catch (error) {
      logger.error('MCP 서버 중지 실패:', error);
      throw error;
    }
  }
}

export default MCPServer;
