import express from 'express';
import cors from 'cors';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import AIService from '../services/aiService.js';
import ProjectDetector from '../services/projectDetector.js';

/**
 * HTTP 서버 클래스 - 플러그인과의 통신을 위한 REST API 제공
 */
export class HttpServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.aiService = new AIService();
    this.projectDetector = new ProjectDetector();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 미들웨어 설정
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // 요청 로깅
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, { body: req.body });
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
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: config.version,
        name: config.mcp.name
      });
    });

    // 루트 경로
    this.app.get('/', (req, res) => {
      res.json({
        name: config.mcp.name,
        version: config.mcp.version,
        description: 'MCP Cursor Server HTTP API',
        endpoints: {
          health: '/health',
          models: '/api/models',
          chat: '/api/chat',
          analyze: '/api/analyze',
          generate: '/api/generate'
        }
      });
    });

    // AI 모델 목록 조회 (플러그인 호환성)
    this.app.get('/v1/models', async (req, res) => {
      try {
        const models = this.aiService.getAvailableModels();
        res.json({
          data: models.map(model => ({
            id: model.id,
            name: model.name,
            type: model.type,
            available: model.available,
            description: model.description || `${model.name} AI 모델`
          }))
        });
      } catch (error) {
        logger.error('모델 목록 조회 오류:', error);
        res.status(500).json({
          error: {
            message: error.message
          }
        });
      }
    });

    // AI 모델 목록 조회 (기존 API)
    this.app.get('/api/models', async (req, res) => {
      try {
        const models = this.aiService.getAvailableModels();
        res.json({
          success: true,
          models: models
        });
      } catch (error) {
        logger.error('모델 목록 조회 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // AI 채팅 (플러그인 호환성 - 스트리밍)
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const { model = 'cursor-default', messages, stream = false } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({
            error: {
              message: '메시지가 필요합니다'
            }
          });
        }

        // 마지막 사용자 메시지 추출
        const lastMessage = messages[messages.length - 1];
        const userMessage = lastMessage.content;

        if (stream) {
          // 스트리밍 응답
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const response = await this.aiService.chat(userMessage, model);
          const responseText = typeof response === 'string' ? response : response.content || JSON.stringify(response);
          
          // OpenAI 스타일 스트리밍 응답
          const streamResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: { content: responseText },
              finish_reason: 'stop'
            }]
          };

          res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          // 일반 응답
          const response = await this.aiService.chat(userMessage, model);
          const responseText = typeof response === 'string' ? response : response.content || JSON.stringify(response);
          
          res.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: responseText
              },
              finish_reason: 'stop'
            }]
          });
        }
      } catch (error) {
        logger.error('채팅 오류:', error);
        res.status(500).json({
          error: {
            message: error.message
          }
        });
      }
    });

    // AI 채팅 (기존 API)
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { message, model = 'cursor-default', context } = req.body;
        
        if (!message) {
          return res.status(400).json({
            success: false,
            error: '메시지가 필요합니다'
          });
        }

        const response = await this.aiService.chat(message, model, context);
        
        res.json({
          success: true,
          response: response,
          model: model
        });
      } catch (error) {
        logger.error('채팅 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 코드 분석
    this.app.post('/api/analyze', async (req, res) => {
      try {
        const { code, filePath, analysisType = 'general' } = req.body;
        
        if (!code) {
          return res.status(400).json({
            success: false,
            error: '코드가 필요합니다'
          });
        }

        const project = this.projectDetector.getCurrentProject();
        let prompt = `다음 ${project?.type || '코드'}를 분석해주세요:\n\n`;
        prompt += `분석 유형: ${analysisType}\n`;
        if (filePath) prompt += `파일 경로: ${filePath}\n`;
        prompt += `\n코드:\n\`\`\`\n${code}\n\`\`\``;

        const response = await this.aiService.chat(prompt, 'gpt-4');
        
        res.json({
          success: true,
          analysis: response,
          analysisType: analysisType
        });
      } catch (error) {
        logger.error('코드 분석 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 코드 생성
    this.app.post('/api/generate', async (req, res) => {
      try {
        const { prompt, model = 'gpt-4', context } = req.body;
        
        if (!prompt) {
          return res.status(400).json({
            success: false,
            error: '프롬프트가 필요합니다'
          });
        }

        const response = await this.aiService.chat(prompt, model, context);
        
        res.json({
          success: true,
          generatedCode: response,
          model: model
        });
      } catch (error) {
        logger.error('코드 생성 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 404 처리
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: '엔드포인트를 찾을 수 없습니다',
        path: req.originalUrl
      });
    });

    // 에러 처리
    this.app.use((error, req, res, next) => {
      logger.error('HTTP 서버 오류:', error);
      res.status(500).json({
        success: false,
        error: '내부 서버 오류'
      });
    });
  }

  /**
   * 서버 시작
   */
  async start() {
    try {
      // AI 서비스 초기화
      await this.aiService.initialize();
      
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(config.server.port, config.server.host, (error) => {
          if (error) {
            reject(error);
          } else {
            logger.info(`HTTP 서버가 시작되었습니다: http://${config.server.host}:${config.server.port}`);
            resolve();
          }
        });
      });
    } catch (error) {
      logger.error('HTTP 서버 시작 실패:', error);
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
        logger.info('HTTP 서버가 중지되었습니다');
      }
      
      // AI 서비스 정리
      this.aiService.stopCacheMaintenance();
    } catch (error) {
      logger.error('HTTP 서버 중지 실패:', error);
      throw error;
    }
  }
}
