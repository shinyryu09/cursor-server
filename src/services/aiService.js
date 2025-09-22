import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { AI_MODEL_TYPES } from '../types/mcp.js';
import { CacheService } from './cacheService.js';
import { CacheMaintenanceService } from './cacheMaintenanceService.js';

/**
 * AI 서비스 - 다양한 AI 모델 지원
 */
export class AIService {
  constructor() {
    this.clients = {};
    this.cacheService = new CacheService();
    this.cacheMaintenanceService = new CacheMaintenanceService(this.cacheService);
    this.initializeClients();
    this.startCacheMaintenance();
  }

  /**
   * AI 클라이언트 초기화
   */
  initializeClients() {
    try {
      // OpenAI 클라이언트
      if (config.ai.openai.apiKey) {
        this.clients[AI_MODEL_TYPES.OPENAI] = new OpenAI({
          apiKey: config.ai.openai.apiKey,
          baseURL: config.ai.openai.baseURL
        });
        logger.info('OpenAI 클라이언트 초기화 완료');
      }

      // Anthropic 클라이언트
      if (config.ai.anthropic.apiKey) {
        this.clients[AI_MODEL_TYPES.ANTHROPIC] = new Anthropic({
          apiKey: config.ai.anthropic.apiKey
        });
        logger.info('Anthropic 클라이언트 초기화 완료');
      }

      // Google 클라이언트
      if (config.ai.google.apiKey) {
        this.clients[AI_MODEL_TYPES.GOOGLE] = new GoogleGenerativeAI(config.ai.google.apiKey);
        logger.info('Google 클라이언트 초기화 완료');
      }

      // Cursor 클라이언트 (커스텀)
      if (config.ai.cursor.apiKey) {
        this.clients[AI_MODEL_TYPES.CURSOR] = {
          apiKey: config.ai.cursor.apiKey,
          baseURL: config.ai.cursor.baseURL
        };
        logger.info('Cursor 클라이언트 초기화 완료');
      }

    } catch (error) {
      logger.error('AI 클라이언트 초기화 오류:', error);
    }
  }

  /**
   * AI 채팅 (캐시 지원)
   */
  async chat(message, model, context = '') {
    try {
      // 캐시가 활성화된 경우 캐시에서 먼저 조회
      if (config.cache?.enabled && config.cache?.strategy?.aiResponse?.enabled) {
        const cacheKey = this.cacheService.generateCacheKey({
          message,
          model,
          context,
          type: 'chat'
        });

        const cachedResponse = await this.cacheService.get(cacheKey);
        if (cachedResponse) {
          logger.info(`캐시에서 AI 응답 반환: ${model}`);
          return cachedResponse.data;
        }
      }

      const modelType = this.getModelType(model);
      
      if (!this.clients[modelType]) {
        throw new Error(`${modelType} 클라이언트가 초기화되지 않았습니다.`);
      }

      logger.info(`AI 채팅 시작: ${model} (${modelType})`);

      let response;
      switch (modelType) {
        case AI_MODEL_TYPES.OPENAI:
          response = await this.chatWithOpenAI(message, model, context);
          break;
        case AI_MODEL_TYPES.ANTHROPIC:
          response = await this.chatWithAnthropic(message, model, context);
          break;
        case AI_MODEL_TYPES.GOOGLE:
          response = await this.chatWithGoogle(message, model, context);
          break;
        case AI_MODEL_TYPES.CURSOR:
          response = await this.chatWithCursor(message, model, context);
          break;
        default:
          throw new Error(`지원하지 않는 모델 타입: ${modelType}`);
      }

      // 캐시에 응답 저장
      if (config.cache?.enabled && config.cache?.strategy?.aiResponse?.enabled) {
        const cacheKey = this.cacheService.generateCacheKey({
          message,
          model,
          context,
          type: 'chat'
        });

        await this.cacheService.set(
          cacheKey, 
          response, 
          config.cache.strategy.aiResponse.ttl
        );
      }

      logger.info('AI 채팅 완료');
      return response;

    } catch (error) {
      logger.error('AI 채팅 오류:', error);
      throw new Error(`AI 채팅 실패: ${error.message}`);
    }
  }

  /**
   * OpenAI 채팅
   */
  async chatWithOpenAI(message, model, context) {
    const client = this.clients[AI_MODEL_TYPES.OPENAI];
    
    const messages = [
      {
        role: 'system',
        content: context || '당신은 도움이 되는 AI 어시스턴트입니다.'
      },
      {
        role: 'user',
        content: message
      }
    ];

    const completion = await client.chat.completions.create({
      model: model,
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7
    });

    return completion.choices[0].message.content;
  }

  /**
   * Anthropic 채팅
   */
  async chatWithAnthropic(message, model, context) {
    const client = this.clients[AI_MODEL_TYPES.ANTHROPIC];
    
    const systemPrompt = context || '당신은 도움이 되는 AI 어시스턴트입니다.';

    const completion = await client.messages.create({
      model: model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    return completion.content[0].text;
  }

  /**
   * Google 채팅
   */
  async chatWithGoogle(message, model, context) {
    const client = this.clients[AI_MODEL_TYPES.GOOGLE];
    const genAI = client.getGenerativeModel({ model: model });

    const prompt = context ? `${context}\n\n${message}` : message;

    const result = await genAI.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  }

  /**
   * Cursor 채팅
   */
  async chatWithCursor(message, model, context) {
    const client = this.clients[AI_MODEL_TYPES.CURSOR];
    
    const messages = [
      {
        role: 'system',
        content: context || '당신은 도움이 되는 AI 어시스턴트입니다.'
      },
      {
        role: 'user',
        content: message
      }
    ];

    const response = await axios.post(`${client.baseURL}/chat/completions`, {
      model: model,
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return response.data.choices[0].message.content;
  }

  /**
   * 모델 타입 결정
   */
  getModelType(model) {
    if (config.ai.openai.models.includes(model)) {
      return AI_MODEL_TYPES.OPENAI;
    }
    if (config.ai.anthropic.models.includes(model)) {
      return AI_MODEL_TYPES.ANTHROPIC;
    }
    if (config.ai.google.models.includes(model)) {
      return AI_MODEL_TYPES.GOOGLE;
    }
    if (config.ai.cursor.models.includes(model)) {
      return AI_MODEL_TYPES.CURSOR;
    }
    
    // 기본값으로 OpenAI 사용
    return AI_MODEL_TYPES.OPENAI;
  }

  /**
   * 사용 가능한 모델 목록 반환
   */
  getAvailableModels() {
    const models = [];
    
    if (this.clients[AI_MODEL_TYPES.OPENAI]) {
      models.push(...config.ai.openai.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.OPENAI,
        name: `OpenAI ${model}`,
        available: true
      })));
    }

    if (this.clients[AI_MODEL_TYPES.ANTHROPIC]) {
      models.push(...config.ai.anthropic.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.ANTHROPIC,
        name: `Anthropic ${model}`,
        available: true
      })));
    }

    if (this.clients[AI_MODEL_TYPES.GOOGLE]) {
      models.push(...config.ai.google.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.GOOGLE,
        name: `Google ${model}`,
        available: true
      })));
    }

    if (this.clients[AI_MODEL_TYPES.CURSOR]) {
      models.push(...config.ai.cursor.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.CURSOR,
        name: `Cursor ${model}`,
        available: true
      })));
    }

    return models;
  }

  /**
   * 코드 생성 (캐시 지원)
   */
  async generateCode(prompt, language, model = 'gpt-4', context = {}) {
    // 캐시가 활성화된 경우 캐시에서 먼저 조회
    if (config.cache?.enabled && config.cache?.strategy?.codeGeneration?.enabled) {
      const cacheKey = this.cacheService.generateCacheKey({
        message: prompt,
        model,
        context: JSON.stringify({ language, ...context }),
        type: 'codeGeneration'
      });

      const cachedResponse = await this.cacheService.get(cacheKey);
      if (cachedResponse) {
        logger.info(`캐시에서 코드 생성 결과 반환: ${language}`);
        return cachedResponse.data;
      }
    }

    const systemPrompt = `당신은 전문 ${language} 개발자입니다. 주어진 요구사항에 따라 고품질의 코드를 생성해주세요.`;
    
    let message = `다음 요구사항에 따라 ${language} 코드를 생성해주세요:\n\n${prompt}`;
    
    if (context.projectType) {
      message += `\n\n프로젝트 타입: ${context.projectType}`;
    }
    
    if (context.framework) {
      message += `\n프레임워크: ${context.framework}`;
    }

    const response = await this.chat(message, model, systemPrompt);

    // 캐시에 응답 저장
    if (config.cache?.enabled && config.cache?.strategy?.codeGeneration?.enabled) {
      const cacheKey = this.cacheService.generateCacheKey({
        message: prompt,
        model,
        context: JSON.stringify({ language, ...context }),
        type: 'codeGeneration'
      });

      await this.cacheService.set(
        cacheKey, 
        response, 
        config.cache.strategy.codeGeneration.ttl
      );
    }

    return response;
  }

  /**
   * 코드 리뷰 (캐시 지원)
   */
  async reviewCode(code, language, model = 'gpt-4', reviewType = 'general') {
    // 캐시가 활성화된 경우 캐시에서 먼저 조회
    if (config.cache?.enabled && config.cache?.strategy?.codeReview?.enabled) {
      const codeHash = require('crypto').createHash('sha256').update(code).digest('hex');
      const cacheKey = this.cacheService.generateCacheKey({
        message: codeHash,
        model,
        context: JSON.stringify({ language, reviewType }),
        type: 'codeReview'
      });

      const cachedResponse = await this.cacheService.get(cacheKey);
      if (cachedResponse) {
        logger.info(`캐시에서 코드 리뷰 결과 반환: ${language}`);
        return cachedResponse.data;
      }
    }

    const systemPrompt = `당신은 경험 많은 ${language} 개발자입니다. 코드를 ${reviewType} 관점에서 리뷰하고 개선 제안을 해주세요.`;
    
    const message = `다음 ${language} 코드를 리뷰해주세요:\n\n\`\`\`${language}\n${code}\n\`\`\``;

    const response = await this.chat(message, model, systemPrompt);

    // 캐시에 응답 저장
    if (config.cache?.enabled && config.cache?.strategy?.codeReview?.enabled) {
      const codeHash = require('crypto').createHash('sha256').update(code).digest('hex');
      const cacheKey = this.cacheService.generateCacheKey({
        message: codeHash,
        model,
        context: JSON.stringify({ language, reviewType }),
        type: 'codeReview'
      });

      await this.cacheService.set(
        cacheKey, 
        response, 
        config.cache.strategy.codeReview.ttl
      );
    }

    return response;
  }

  /**
   * 버그 수정
   */
  async fixBug(errorMessage, code, language, model = 'gpt-4', context = {}) {
    const systemPrompt = `당신은 ${language} 디버깅 전문가입니다. 에러를 분석하고 수정 방법을 제안해주세요.`;
    
    let message = `다음 ${language} 코드에서 발생한 에러를 수정해주세요:\n\n`;
    message += `에러: ${errorMessage}\n\n`;
    message += `코드:\n\`\`\`${language}\n${code}\n\`\`\``;
    
    if (context.stackTrace) {
      message += `\n\n스택 트레이스:\n\`\`\`\n${context.stackTrace}\n\`\`\``;
    }

    return await this.chat(message, model, systemPrompt);
  }

  /**
   * 테스트 생성
   */
  async generateTests(code, language, testFramework, model = 'gpt-4') {
    const systemPrompt = `당신은 ${testFramework} 전문가입니다. 주어진 코드에 대한 포괄적인 테스트를 작성해주세요.`;
    
    const message = `${testFramework}를 사용하여 다음 ${language} 코드에 대한 테스트를 작성해주세요:\n\n\`\`\`${language}\n${code}\n\`\`\``;

    return await this.chat(message, model, systemPrompt);
  }

  /**
   * 문서화 생성
   */
  async generateDocumentation(code, language, docType = 'api', model = 'gpt-4') {
    const systemPrompt = `당신은 기술 문서 작성 전문가입니다. ${docType} 문서를 명확하고 이해하기 쉽게 작성해주세요.`;
    
    const message = `다음 ${language} 코드에 대한 ${docType} 문서를 작성해주세요:\n\n\`\`\`${language}\n${code}\n\`\`\``;

    return await this.chat(message, model, systemPrompt);
  }

  /**
   * 서비스 상태 확인
   */
  getStatus() {
    const status = {};
    
    for (const [type, client] of Object.entries(this.clients)) {
      status[type] = {
        available: !!client,
        models: this.getAvailableModels().filter(m => m.type === type)
      };
    }
    
    // 캐시 상태 추가
    status.cache = this.cacheService.getStatus();
    
    return status;
  }

  /**
   * 캐시 통계 조회
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * 캐시 정리
   */
  async clearCache() {
    return await this.cacheService.clear();
  }

  /**
   * 만료된 캐시 정리
   */
  async cleanupExpiredCache() {
    return await this.cacheService.cleanupExpired();
  }

  /**
   * 특정 캐시 삭제
   */
  async deleteCache(key) {
    return await this.cacheService.delete(key);
  }

  /**
   * 캐시 유지보수 서비스 시작
   */
  startCacheMaintenance() {
    if (config.cache?.enabled) {
      this.cacheMaintenanceService.start();
    }
  }

  /**
   * 캐시 유지보수 서비스 중지
   */
  stopCacheMaintenance() {
    this.cacheMaintenanceService.stop();
  }

  /**
   * 수동 캐시 유지보수 실행
   */
  async runCacheMaintenance() {
    return await this.cacheMaintenanceService.runMaintenance();
  }

  /**
   * 캐시 유지보수 상태 조회
   */
  getCacheMaintenanceStatus() {
    return this.cacheMaintenanceService.getStatus();
  }
}

export default AIService;
