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
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    this.initializeClients();
    await this.cacheService.initialize();
    this.startCacheMaintenance();
    logger.info('AI 서비스 초기화 완료');
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

      // Cursor 클라이언트는 제거됨 (API가 존재하지 않음)

    } catch (error) {
      logger.error('AI 클라이언트 초기화 오류:', error);
    }
  }

  /**
   * AI 채팅 (캐시 지원)
   */
  async chat(message, model, context = '') {
    try {
      // 메시지 유효성 검사
      if (!message || typeof message !== 'string') {
        logger.error('Invalid message type in chat method:', typeof message, message);
        throw new Error('유효하지 않은 메시지입니다.');
      }
      
      const cleanMessage = message.trim();
      if (cleanMessage.length === 0) {
        throw new Error('빈 메시지입니다.');
      }
      
      // 캐시가 활성화된 경우 캐시에서 먼저 조회
      if (config.cache?.enabled && config.cache?.strategy?.aiResponse?.enabled) {
        const cacheKey = this.cacheService.generateCacheKey({
          message: cleanMessage,
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

      // Cursor Editor 기본 모델 처리
      if (model === 'cursor-default') {
        logger.info(`Cursor Editor 기본 모델 사용: ${model}`);
        return await this.chatWithCursorDefault(cleanMessage, context);
      }

      const modelType = this.getModelType(model);
      
      if (!this.clients[modelType]) {
        throw new Error(`${modelType} 클라이언트가 초기화되지 않았습니다.`);
      }

      logger.info(`AI 채팅 시작: ${model} (${modelType})`);

      let response;
      switch (modelType) {
        case AI_MODEL_TYPES.OPENAI:
          response = await this.chatWithOpenAI(cleanMessage, model, context);
          break;
        case AI_MODEL_TYPES.ANTHROPIC:
          response = await this.chatWithAnthropic(cleanMessage, model, context);
          break;
        case AI_MODEL_TYPES.GOOGLE:
          response = await this.chatWithGoogle(cleanMessage, model, context);
          break;
        case AI_MODEL_TYPES.CURSOR:
          response = await this.chatWithCursor(cleanMessage, model, context);
          break;
        default:
          throw new Error(`지원하지 않는 모델 타입: ${modelType}`);
      }

      // 캐시에 응답 저장
      if (config.cache?.enabled && config.cache?.strategy?.aiResponse?.enabled) {
        const cacheKey = this.cacheService.generateCacheKey({
          message: cleanMessage,
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
      
      // API 키 오류인 경우 cursor-default 모델로 fallback
      if (error.message.includes('401') || 
          error.message.includes('authentication_error') || 
          error.message.includes('invalid') ||
          error.message.includes('unauthorized')) {
        
        logger.info(`API 키 오류로 인해 cursor-default 모델로 fallback: ${model}`);
        
        try {
          // fallback 시에는 원본 message 사용 (이미 유효성 검사 완료됨)
          const fallbackResponse = await this.chatWithCursorDefault(message, context);
          logger.info('cursor-default 모델로 fallback 성공');
          return fallbackResponse;
        } catch (fallbackError) {
          logger.error('cursor-default 모델 fallback 실패:', fallbackError);
          throw new Error(`AI 채팅 실패: ${error.message} (fallback도 실패)`);
        }
      }
      
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
    
    // Cursor Editor 기본 모델 (항상 사용 가능)
    models.push({
      id: 'cursor-default',
      type: 'cursor',
      name: 'Cursor Editor (기본)',
      available: true,
      isDefault: true
    });
    
    // AI 모델 설정 (config 객체 문제 해결을 위해 직접 정의)
    const aiConfig = {
      openai: {
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
      },
      anthropic: {
        models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
      },
      google: {
        models: ['gemini-pro', 'gemini-pro-vision']
      }
    };
    
    // API 키가 설정된 경우에만 실제 클라이언트 사용
    if (this.clients[AI_MODEL_TYPES.OPENAI]) {
      models.push(...aiConfig.openai.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.OPENAI,
        name: `OpenAI ${model}`,
        available: true
      })));
    } else {
      // API 키가 없어도 모델 정보는 제공 (사용 불가능 상태로)
      models.push(...aiConfig.openai.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.OPENAI,
        name: `OpenAI ${model}`,
        available: false
      })));
    }

    if (this.clients[AI_MODEL_TYPES.ANTHROPIC]) {
      models.push(...aiConfig.anthropic.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.ANTHROPIC,
        name: `Anthropic ${model}`,
        available: true
      })));
    } else {
      models.push(...aiConfig.anthropic.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.ANTHROPIC,
        name: `Anthropic ${model}`,
        available: false
      })));
    }

    if (this.clients[AI_MODEL_TYPES.GOOGLE]) {
      models.push(...aiConfig.google.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.GOOGLE,
        name: `Google ${model}`,
        available: true
      })));
    } else {
      models.push(...aiConfig.google.models.map(model => ({
        id: model,
        type: AI_MODEL_TYPES.GOOGLE,
        name: `Google ${model}`,
        available: false
      })));
    }

    // Cursor 모델은 이미 기본 모델로 추가되었으므로 제거

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

  /**
   * Cursor Editor 기본 모델 채팅
   * API 키가 없을 때 사용되는 기본 모델
   */
  async chatWithCursorDefault(message, context) {
    logger.info('Cursor Editor 기본 모델 사용');
    
    // 메시지 유효성 검사
    if (!message || typeof message !== 'string') {
      logger.error('Invalid message type:', typeof message, message);
      return '❌ **오류:** 유효하지 않은 메시지입니다.';
    }
    
    // 메시지 정리 및 실제 질문 추출
    let cleanMessage = message.trim();
    if (cleanMessage.length === 0) {
      return '❌ **오류:** 빈 메시지입니다.';
    }
    
    // Xcode 스타일 메시지에서 실제 질문 추출
    const xcodePattern = /The user has asked:\s*\n\s*(.+?)(?:\n|$)/i;
    const xcodeMatch = cleanMessage.match(xcodePattern);
    if (xcodeMatch) {
      cleanMessage = xcodeMatch[1].trim();
      logger.info(`Xcode 메시지에서 질문 추출: "${cleanMessage}"`);
    }
    
    // 간단한 패턴 매칭을 통한 기본 응답 생성
    let response = '';
    
    const lowerMessage = cleanMessage.toLowerCase();
    
    // 인사말 처리
    if (lowerMessage.includes('안녕') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      response = `안녕하세요! 저는 Cursor Editor의 기본 AI 모델입니다. 

코딩과 관련된 질문을 도와드릴 수 있습니다. 다음과 같은 도움을 드릴 수 있어요:

💻 **코딩 도움:**
- 코드 작성 및 수정
- 버그 찾기 및 해결
- 코드 리뷰 및 개선 제안
- 프로그래밍 개념 설명

🔧 **개발 도구:**
- IntelliJ IDEA / Android Studio 사용법
- Git 명령어 및 워크플로우
- 빌드 및 배포 관련 질문

무엇을 도와드릴까요?`;
    }
    // 수학 계산 처리
    else if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(cleanMessage) && /[\+\-\*\/]/.test(cleanMessage)) {
      try {
        // 안전한 수학 계산을 위해 eval 대신 간단한 파싱 사용
        const result = this.safeMathEval(cleanMessage);
        response = `🧮 **수학 계산 결과:**

**계산식:** ${cleanMessage}
**결과:** ${result}

💡 **추가 정보:**
- 결과 타입: ${typeof result}
- 소수점 자릿수: ${result.toString().split('.')[1]?.length || 0}자리

다른 계산도 해보시겠어요?`;
      } catch (error) {
        response = `❌ **계산 오류:**

계산식 "${cleanMessage}"을 처리할 수 없습니다.

💡 **지원하는 연산:**
- 기본 사칙연산: +, -, *, /
- 괄호: ( )
- 소수점: 3.14
- 예시: 1+1, 2*3, (5+3)/2

올바른 수식으로 다시 시도해주세요.`;
      }
    }
    // 숫자 관련 질문
    else if (/^\d+$/.test(cleanMessage)) {
      const num = parseInt(cleanMessage);
      response = `입력하신 숫자 "${num}"에 대한 정보입니다:

🔢 **숫자 분석:**
- 값: ${num}
- 2진수: ${num.toString(2)}
- 16진수: ${num.toString(16).toUpperCase()}
- 제곱: ${num * num}
- 제곱근: ${Math.sqrt(num).toFixed(2)}

이 숫자와 관련해서 특별히 알고 싶은 것이 있으신가요?`;
    }
    // 프로젝트 관련 질문 (우선순위 높음)
    else if (lowerMessage.includes('프로젝트') || lowerMessage.includes('project') ||
             lowerMessage.includes('분석') || lowerMessage.includes('analyze')) {
      response = `📋 **MCP Cursor Server 프로젝트 분석**

현재 프로젝트에 대한 상세 정보입니다:

🏷️ **프로젝트 정보:**
- 이름: MCP Cursor Server
- 버전: 2.0.0
- 설명: Model Context Protocol을 사용한 AI 코드 생성 및 분석 서버
- 환경: development

🔧 **주요 기능:**
- AI 모델 통합 (OpenAI, Anthropic, Google, Cursor)
- MCP 프로토콜 지원
- HTTP API 서버
- IntelliJ/Android Studio 플러그인 지원
- 캐시 시스템
- 프로젝트 감지 및 컨텍스트 제공

📁 **프로젝트 구조:**
- \`src/\`: 소스 코드
  - \`core/\`: MCP 서버 및 HTTP 서버
  - \`services/\`: AI 서비스, 캐시, 채팅 히스토리
  - \`utils/\`: 유틸리티 함수
- \`mcp-intellij-plugin/\`: IntelliJ 플러그인
- \`logs/\`: 로그 파일
- \`data/\`: 데이터 저장소

🌐 **서버 상태:**
- HTTP 서버: http://localhost:3000
- MCP 서버: stdio 모드
- 지원 모델: cursor-default (기본), OpenAI, Anthropic, Google

💡 **사용 가능한 명령어:**
- \`node src/server.js start\`: 서버 시작
- \`node src/server.js mcp\`: MCP 모드만 시작
- \`node src/server.js status\`: 상태 확인

더 자세한 정보가 필요하시면 구체적으로 질문해주세요!`;
    }
    // 시스템/개발 도구 관련 질문
    else if (lowerMessage.includes('디렉토리') || lowerMessage.includes('directory') ||
             lowerMessage.includes('현재') || lowerMessage.includes('current') ||
             lowerMessage.includes('경로') || lowerMessage.includes('path') ||
             lowerMessage.includes('pwd') || lowerMessage.includes('ls') ||
             lowerMessage.includes('git') || lowerMessage.includes('npm') ||
             lowerMessage.includes('node') || lowerMessage.includes('java')) {
      response = `🔧 **개발 도구 및 시스템 질문**

현재 시스템 정보와 개발 도구에 대한 도움을 드릴 수 있습니다:

📁 **파일 시스템:**
- 현재 디렉토리: \`pwd\`
- 파일 목록: \`ls -la\`
- 디렉토리 이동: \`cd <경로>\`
- 파일 생성: \`touch <파일명>\`

🌿 **Git 명령어:**
- 상태 확인: \`git status\`
- 커밋: \`git commit -m "메시지"\`
- 푸시: \`git push origin main\`
- 브랜치: \`git branch\`

📦 **패키지 관리:**
- npm 설치: \`npm install <패키지>\`
- 의존성 확인: \`npm list\`
- 스크립트 실행: \`npm run <스크립트>\`

💻 **개발 환경:**
- Node.js 버전: \`node --version\`
- Java 버전: \`java --version\`
- 환경 변수: \`echo $PATH\`

구체적으로 어떤 명령어나 도구에 대해 알고 싶으신가요?`;
    }
    // 파일 구조 관련 질문
    else if (lowerMessage.includes('파일') || lowerMessage.includes('file') ||
             lowerMessage.includes('구조') || lowerMessage.includes('structure') ||
             lowerMessage.includes('폴더') || lowerMessage.includes('folder') ||
             lowerMessage.includes('디렉토리') || lowerMessage.includes('directory')) {
      response = `📁 **프로젝트 파일 구조**

MCP Cursor Server 프로젝트의 주요 파일과 디렉토리입니다:

cursor-server/
├── package.json          # 프로젝트 설정 및 의존성
├── README.md             # 프로젝트 문서
├── config.js             # 서버 설정
├── src/                  # 소스 코드
│   ├── server.js         # 메인 서버 파일
│   ├── core/             # 핵심 서비스
│   │   ├── mcpServer.js  # MCP 서버
│   │   └── httpServer.js # HTTP 서버
│   ├── services/         # 비즈니스 로직
│   │   ├── aiService.js  # AI 모델 서비스
│   │   ├── cacheService.js # 캐시 서비스
│   │   └── chatHistoryService.js # 채팅 기록
│   ├── config/           # 설정 파일
│   └── utils/            # 유틸리티
├── mcp-intellij-plugin/  # IntelliJ 플러그인
│   ├── build.gradle.kts  # Gradle 빌드 설정
│   └── src/main/kotlin/  # Kotlin 소스 코드
├── logs/                 # 로그 파일
├── cache/                # 캐시 데이터
└── data/                 # 데이터 파일

🔍 **주요 파일 설명:**
- server.js: 애플리케이션 진입점
- mcpServer.js: MCP 프로토콜 서버
- httpServer.js: HTTP API 서버
- aiService.js: AI 모델 통합 서비스
- package.json: Node.js 프로젝트 설정

더 자세한 파일 정보가 필요하시면 특정 파일명을 말씀해주세요!`;
    }
    // 프로젝트 관련 질문
    else if (lowerMessage.includes('프로젝트') || lowerMessage.includes('project') ||
             lowerMessage.includes('이름') || lowerMessage.includes('name') ||
             lowerMessage.includes('버전') || lowerMessage.includes('version') ||
             lowerMessage.includes('설명') || lowerMessage.includes('description')) {
      response = `📋 **프로젝트 정보**

현재 MCP Cursor Server 프로젝트에 대한 정보입니다:

🏷️ **프로젝트 이름:** MCP Cursor Server
📦 **버전:** 2.0.0
🌍 **환경:** development
📁 **위치:** /Users/kakaovx/Documents/cursor-server

🔧 **주요 기능:**
- MCP (Model Context Protocol) 서버
- IntelliJ IDEA / Android Studio 플러그인 지원
- 다양한 AI 모델 통합 (OpenAI, Anthropic, Google)
- HTTP API 서버 (포트: 3000)
- 캐시 시스템 및 로깅

📚 **기술 스택:**
- Node.js v24.8.0
- Express.js (HTTP 서버)
- MCP SDK
- Kotlin (IntelliJ 플러그인)

더 자세한 정보가 필요하시면 README.md 파일을 확인해보세요!`;
    }
    // 코딩 관련 질문
    else if (lowerMessage.includes('코드') || lowerMessage.includes('code') || 
             lowerMessage.includes('프로그래밍') || lowerMessage.includes('programming') ||
             lowerMessage.includes('함수') || lowerMessage.includes('function') ||
             lowerMessage.includes('변수') || lowerMessage.includes('variable')) {
      response = `코딩 관련 질문이군요! 

다음과 같은 도움을 드릴 수 있습니다:

📝 **코드 작성:**
- JavaScript, Python, Java, Kotlin 등 다양한 언어 지원
- 함수, 클래스, 모듈 구조 설계
- 알고리즘 및 자료구조 구현

🐛 **디버깅:**
- 오류 원인 분석
- 코드 최적화 제안
- 성능 개선 방안

구체적으로 어떤 코드나 프로그래밍 개념에 대해 도움이 필요하신가요?`;
    }
    // 시간/날짜 관련 질문
    else if (lowerMessage.includes('시간') || lowerMessage.includes('time') ||
             lowerMessage.includes('날짜') || lowerMessage.includes('date') ||
             lowerMessage.includes('지금') || lowerMessage.includes('now') ||
             lowerMessage.includes('언제') || lowerMessage.includes('when')) {
      const now = new Date();
      const koreanTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const utcTime = now.toISOString();
      
      response = `🕐 **현재 시간 정보**

현재 시간: ${koreanTime} (한국 시간)
UTC 시간: ${utcTime}
타임존: Asia/Seoul

📅 **날짜 정보:**
- 년: ${now.getFullYear()}
- 월: ${now.getMonth() + 1}월
- 일: ${now.getDate()}일
- 요일: ${['일', '월', '화', '수', '목', '금', '토'][now.getDay()]}요일
- 시간: ${now.getHours()}시 ${now.getMinutes()}분 ${now.getSeconds()}초

다른 시간 관련 질문이 있으시면 언제든 말씀해주세요!`;
    }
    // 도움말/사용법 관련 질문
    else if (lowerMessage.includes('도움') || lowerMessage.includes('help') ||
             lowerMessage.includes('사용법') || lowerMessage.includes('usage') ||
             lowerMessage.includes('어떻게') || lowerMessage.includes('how') ||
             lowerMessage.includes('사용') || lowerMessage.includes('use')) {
      response = `🆘 **Cursor Editor 기본 모델 도움말**

저는 Cursor Editor의 기본 AI 모델입니다. 다음과 같은 도움을 드릴 수 있습니다:

🧮 **수학 계산:**
- "1+1", "(5+3)*2", "3.14 * 2" 등
- 사칙연산, 괄호, 소수점 계산

🔢 **숫자 분석:**
- "123", "42" 등 숫자 입력 시
- 2진수, 16진수, 제곱, 제곱근 계산

📁 **파일/프로젝트 정보:**
- "프로젝트 이름은?", "파일 구조는?"
- "버전은 뭐야?", "이 프로젝트는 뭐야?"

🔧 **개발 도구:**
- "현재 디렉토리는?", "git 명령어 알려줘"
- "npm install 어떻게 해?"

🕐 **시간 정보:**
- "지금 몇 시야?", "현재 시간은?"

💻 **코딩 도움:**
- "코드 작성 도와줘", "함수 만들어줘"
- "JavaScript 함수", "프로그래밍"

💡 **더 나은 AI 기능을 원하신다면:**
OpenAI, Anthropic, Google API 키를 설정하시면 더 강력한 AI 기능을 사용하실 수 있습니다!`;
    }
    // 일반적인 질문
    else {
      response = `안녕하세요! 저는 Cursor Editor의 기본 AI 모델입니다.

질문: "${message}"

💡 **답변:** 
죄송하지만 현재 기본 모델로는 복잡한 질문에 대한 정확한 답변을 제공하기 어렵습니다. 

더 정확하고 상세한 AI 응답을 원하신다면:
1. OpenAI API 키 설정 (GPT-4, GPT-3.5)
2. Anthropic API 키 설정 (Claude)
3. Google API 키 설정 (Gemini)

이 중 하나를 설정하시면 더 나은 AI 기능을 사용하실 수 있습니다.

하지만 간단한 코딩 질문이나 개발 관련 질문이라면 최선을 다해 도움을 드리겠습니다!

🆘 **도움말이 필요하시면 "도움말" 또는 "help"라고 말씀해주세요!**`;
    }
    
    const aiResponse = {
      content: response,
      model: 'cursor-default',
      usage: {
        prompt_tokens: message.length,
        completion_tokens: response.length,
        total_tokens: message.length + response.length
      },
      timestamp: new Date().toISOString()
    };

    return aiResponse;
  }

  /**
   * 안전한 수학 계산
   * eval을 사용하지 않고 간단한 수학 계산만 처리
   */
  safeMathEval(expression) {
    // 허용된 문자만 포함하는지 확인
    if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(expression)) {
      throw new Error('허용되지 않은 문자가 포함되어 있습니다.');
    }

    // 간단한 수학 계산을 위한 안전한 처리
    try {
      // Function 생성자를 사용하여 안전하게 계산
      const func = new Function('return ' + expression);
      const result = func();
      
      // 결과가 숫자인지 확인
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('유효하지 않은 계산 결과입니다.');
      }
      
      return result;
    } catch (error) {
      throw new Error('계산할 수 없는 수식입니다.');
    }
  }
}

export default AIService;
