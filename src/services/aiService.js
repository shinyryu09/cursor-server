import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { AI_MODEL_TYPES } from '../types/mcp.js';

/**
 * AI 서비스 - 다양한 AI 모델 지원
 */
export class AIService {
  constructor() {
    this.clients = {};
    this.initializeClients();
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
   * AI 채팅
   */
  async chat(message, model, context = '') {
    try {
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
   * 코드 생성
   */
  async generateCode(prompt, language, model = 'gpt-4', context = {}) {
    const systemPrompt = `당신은 전문 ${language} 개발자입니다. 주어진 요구사항에 따라 고품질의 코드를 생성해주세요.`;
    
    const message = `다음 요구사항에 따라 ${language} 코드를 생성해주세요:\n\n${prompt}`;
    
    if (context.projectType) {
      message += `\n\n프로젝트 타입: ${context.projectType}`;
    }
    
    if (context.framework) {
      message += `\n프레임워크: ${context.framework}`;
    }

    return await this.chat(message, model, systemPrompt);
  }

  /**
   * 코드 리뷰
   */
  async reviewCode(code, language, model = 'gpt-4', reviewType = 'general') {
    const systemPrompt = `당신은 경험 많은 ${language} 개발자입니다. 코드를 ${reviewType} 관점에서 리뷰하고 개선 제안을 해주세요.`;
    
    const message = `다음 ${language} 코드를 리뷰해주세요:\n\n\`\`\`${language}\n${code}\n\`\`\``;

    return await this.chat(message, model, systemPrompt);
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
    
    return status;
  }
}

export default AIService;
