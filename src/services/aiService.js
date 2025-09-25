import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import config from '../config/config.js';

/**
 * AI 서비스 - 다양한 AI 모델 지원
 * MCP 프로토콜을 통해 Cursor Editor와 통신
 */
export class AIService {
  constructor() {
    this.clients = {};
    this.initialized = false;
    this.requestCache = new Map(); // 요청 캐시 추가
    this.maxCacheSize = 100; // 최대 캐시 크기
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    this.initializeClients();
    this.initialized = true;
    logger.info('AI 서비스 초기화 완료');
  }

  /**
   * AI 클라이언트 초기화
   */
  initializeClients() {
    try {
      // OpenAI 클라이언트
      if (config.ai.openai.apiKey) {
        this.clients.openai = new OpenAI({
          apiKey: config.ai.openai.apiKey,
          baseURL: config.ai.openai.baseURL
        });
        logger.info('OpenAI 클라이언트 초기화 완료');
      }

      // Anthropic 클라이언트
      if (config.ai.anthropic.apiKey) {
        this.clients.anthropic = new Anthropic({
          apiKey: config.ai.anthropic.apiKey
        });
        logger.info('Anthropic 클라이언트 초기화 완료');
      }

      // Google 클라이언트
      if (config.ai.google.apiKey) {
        this.clients.google = new GoogleGenerativeAI(config.ai.google.apiKey);
        logger.info('Google 클라이언트 초기화 완료');
      }
    } catch (error) {
      logger.error('AI 클라이언트 초기화 오류:', error);
    }
  }

  /**
   * 사용 가능한 모델 목록 반환
   */
  getAvailableModels() {
    const models = [
      {
        id: 'cursor-default',
        name: 'Cursor Default',
        provider: 'cursor',
        description: 'Cursor Editor 기본 모델'
      }
    ];

    // OpenAI 모델
    if (this.clients.openai) {
      models.push(
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          description: 'OpenAI GPT-4 모델'
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          description: 'OpenAI GPT-3.5 Turbo 모델'
        }
      );
    }

    // Anthropic 모델
    if (this.clients.anthropic) {
      models.push(
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'anthropic',
          description: 'Anthropic Claude 3.5 Sonnet 모델'
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          provider: 'anthropic',
          description: 'Anthropic Claude 3 Haiku 모델'
        }
      );
    }

    // Google 모델
    if (this.clients.google) {
      models.push(
        {
          id: 'gemini-pro',
          name: 'Gemini Pro',
          provider: 'google',
          description: 'Google Gemini Pro 모델'
        }
      );
    }

    return models;
  }

  /**
   * Cursor Editor 기본 모델을 사용한 채팅 (최적화됨)
   */
  async chatWithCursorDefault(message) {
    try {
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message format');
      }

      // 메모리 사용량 확인
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      if (memoryUsageMB > 300) { // 300MB 이상 사용시 경고
        logger.warn(`높은 메모리 사용량 감지: ${memoryUsageMB}MB - 캐시 정리 수행`);
        this.cleanupCache();
        
        // 강제 가비지 컬렉션
        if (global.gc) {
          global.gc();
          logger.info('강제 가비지 컬렉션 수행');
        }
      }

      logger.info('Cursor Editor 기본 모델 사용');
      
      // Xcode 메시지에서 실제 질문 추출
      const cleanMessage = this.extractUserQuestion(message);
      logger.info(`Xcode 메시지에서 질문 추출: "${cleanMessage}"`);

      // 캐시 확인
      const cacheKey = this.generateCacheKey(cleanMessage, 'cursor-default');
      if (this.requestCache.has(cacheKey)) {
        logger.info('캐시된 응답 사용');
        return this.requestCache.get(cacheKey);
      }

      // Xcode 메시지에서 파일 경로 추출하여 프로젝트 디렉토리 감지
      const projectDir = await this.extractProjectDirectoryFromXcodeMessage(message);
      if (projectDir) {
        logger.info(`Xcode 프로젝트 디렉토리 감지: ${projectDir}`);
      }

      // 파일 분석 질문 처리 (우선순위)
      if (this.isFileAnalysisQuestion(cleanMessage)) {
        // projectDir이 null인 경우 기본값 사용
        const effectiveProjectDir = projectDir || process.cwd();
        logger.info(`파일 분석용 프로젝트 디렉토리: ${effectiveProjectDir}`);
        const response = await this.handleFileAnalysisQuestion(cleanMessage, effectiveProjectDir);
        
        // 응답을 캐시에 저장
        this.requestCache.set(cacheKey, response);
        return response;
      }

      // 프로젝트 분석 질문 처리
      if (this.isProjectAnalysisQuestion(cleanMessage)) {
        const response = await this.getProjectAnalysisResponse(projectDir);
        
        // 응답을 캐시에 저장
        this.requestCache.set(cacheKey, response);
        return response;
      }

      // 수학 계산 질문 처리
      if (this.isMathQuestion(cleanMessage)) {
        const response = this.handleMathQuestion(cleanMessage);
        
        // 응답을 캐시에 저장
        this.requestCache.set(cacheKey, response);
        return response;
      }

      // 일반적인 개발 도구 질문 처리
      if (this.isDevelopmentToolQuestion(cleanMessage)) {
        const response = this.getDevelopmentToolResponse();
        
        // 응답을 캐시에 저장
        this.requestCache.set(cacheKey, response);
        return response;
      }

      // 기본 응답
      const response = {
        content: `안녕하세요! 저는 Cursor Editor의 기본 AI 모델입니다. 

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

무엇을 도와드릴까요?`,
        model: 'cursor-default',
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };

      // 응답을 캐시에 저장
      this.requestCache.set(cacheKey, response);
      
      return response;

    } catch (error) {
      logger.error('Cursor 기본 모델 채팅 오류:', error);
      throw error;
    }
  }

  /**
   * AI 모델을 사용한 채팅
   */
  async chat(message, model = 'cursor-default') {
    try {
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message format');
      }

      // Cursor 기본 모델 사용
      if (model === 'cursor-default') {
        return await this.chatWithCursorDefault(message);
      }

      // 외부 AI 모델 사용
      const cleanMessage = this.extractUserQuestion(message);
      
      try {
        let result;
        
        if (model.startsWith('gpt-') && this.clients.openai) {
          result = await this.chatWithOpenAI(cleanMessage, model);
        } else if (model.startsWith('claude-') && this.clients.anthropic) {
          result = await this.chatWithAnthropic(cleanMessage, model);
        } else if (model.startsWith('gemini-') && this.clients.google) {
          result = await this.chatWithGoogle(cleanMessage, model);
        } else {
          throw new Error(`Unsupported model: ${model}`);
        }

        return result;
        
      } catch (error) {
        logger.error(`AI 모델 ${model} 채팅 실패:`, error);
        
        // API 키 오류인 경우 Cursor 기본 모델로 fallback
        if (error.message.includes('401') || error.message.includes('invalid') || error.message.includes('unauthorized')) {
          logger.info('API 키 오류로 인해 Cursor 기본 모델로 fallback');
          return await this.chatWithCursorDefault(message);
        }
        
        throw error;
      }

    } catch (error) {
      logger.error('AI 채팅 오류:', error);
      throw error;
    }
  }

  /**
   * OpenAI 모델과 채팅
   */
  async chatWithOpenAI(message, model) {
    const response = await this.clients.openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1000
    });

    return {
      content: response.choices[0].message.content,
      model: model,
      usage: response.usage
    };
  }

  /**
   * Anthropic 모델과 채팅
   */
  async chatWithAnthropic(message, model) {
    const response = await this.clients.anthropic.messages.create({
      model: model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: message }]
    });

    return {
      content: response.content[0].text,
      model: model,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }

  /**
   * Google 모델과 채팅
   */
  async chatWithGoogle(message, model) {
    const genAI = this.clients.google;
    const genModel = genAI.getGenerativeModel({ model: model });
    
    const result = await genModel.generateContent(message);
    const response = await result.response;
    const text = response.text();

    return {
      content: text,
      model: model,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  /**
   * 코드 분석
   */
  async analyzeCode(filePath, analysisType = 'general') {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // 파일 존재 확인
      try {
        await fs.access(filePath);
      } catch (error) {
        return `❌ 파일을 찾을 수 없습니다: ${filePath}`;
      }

      // 파일 읽기
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();
      
      // 파일 타입별 분석
      let analysisPrompt = '';
      
      if (fileExtension === '.swift') {
        analysisPrompt = this.getSwiftAnalysisPrompt(fileName, fileContent, analysisType);
      } else if (fileExtension === '.kt' || fileExtension === '.java') {
        analysisPrompt = this.getKotlinJavaAnalysisPrompt(fileName, fileContent, analysisType);
      } else if (fileExtension === '.js' || fileExtension === '.ts') {
        analysisPrompt = this.getJavaScriptAnalysisPrompt(fileName, fileContent, analysisType);
      } else {
        analysisPrompt = this.getGeneralAnalysisPrompt(fileName, fileContent, analysisType);
      }

      // AI 분석 수행
      const result = await this.chatWithCursorDefault(analysisPrompt);
      
      // 결과가 객체인 경우 content 추출, 문자열인 경우 그대로 사용
      const content = typeof result === 'object' && result.content ? result.content : result;
      
      return `📁 **파일 분석 결과: ${fileName}**\n\n${content}`;
      
    } catch (error) {
      logger.error('코드 분석 오류:', error);
      return `❌ 코드 분석 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 캐시 정리 (메모리 사용량 제어)
   */
  cleanupCache() {
    if (this.requestCache.size > this.maxCacheSize) {
      const entries = Array.from(this.requestCache.entries());
      const toDelete = entries.slice(0, Math.floor(this.maxCacheSize * 0.3)); // 30% 삭제
      
      for (const [key] of toDelete) {
        this.requestCache.delete(key);
      }
      
      logger.info(`캐시 정리 완료: ${this.requestCache.size}개 항목 유지`);
    }
    
    // extractProjectDirectoryFromXcodeMessage 캐시도 정리
    if (this._extractCache && Object.keys(this._extractCache).length > 50) {
      const keys = Object.keys(this._extractCache);
      const toDelete = keys.slice(0, Math.floor(keys.length * 0.5)); // 50% 삭제
      
      for (const key of toDelete) {
        delete this._extractCache[key];
      }
      
      logger.info(`extractProjectDirectoryFromXcodeMessage 캐시 정리 완료: ${Object.keys(this._extractCache).length}개 항목 유지`);
    }
  }

  /**
   * 캐시 키 생성
   */
  generateCacheKey(message, model) {
    return `${model}:${message.substring(0, 100)}`; // 메시지 처음 100자만 사용
  }

  /**
   * Xcode 메시지에서 실제 질문 추출
   */
  extractUserQuestion(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }

    // Xcode 스타일 메시지에서 질문 추출
    // 패턴 1: "The user has asked:\n\n질문내용"
    const xcodePattern1 = /The user has asked:\s*\n\s*\n\s*(.+?)(?:\n\n|$)/s;
    const match1 = message.match(xcodePattern1);
    if (match1) {
      return match1[1].trim();
    }

    // 패턴 2: "The user has asked:\n질문내용"
    const xcodePattern2 = /The user has asked:\s*\n\s*(.+?)(?:\n\n|$)/s;
    const match2 = message.match(xcodePattern2);
    if (match2) {
      return match2[1].trim();
    }

    // 패턴 3: "다음 Swift 파일을 분석해주세요:" 형태의 메시지에서 파일명 추출
    const analysisPattern = /다음 Swift 파일을 분석해주세요:\s*\n\s*\*\*파일명:\*\*\s*(.+?)(?:\n|$)/;
    const analysisMatch = message.match(analysisPattern);
    if (analysisMatch) {
      const fileName = analysisMatch[1].trim();
      return `${fileName} 분석해줘`;
    }

    // 패턴 4: "ScorecardView 분석해줘" 형태의 직접적인 질문
    const directPattern = /^(.+?)\s*분석해줘\s*$/;
    const directMatch = message.match(directPattern);
    if (directMatch) {
      return directMatch[0].trim();
    }

    // 패턴 5: 파일명만 있는 경우 (예: "ScorecardView.swift")
    const fileNamePattern = /^([A-Z][a-zA-Z]*View|[A-Z][a-zA-Z]*\.swift)$/;
    const fileNameMatch = message.match(fileNamePattern);
    if (fileNameMatch) {
      return `${fileNameMatch[1]} 분석해줘`;
    }

    return message.trim();
  }

  /**
   * Xcode 메시지에서 프로젝트 디렉토리 추출 (최적화됨)
   */
  async extractProjectDirectoryFromXcodeMessage(message) {
    // 메시지 길이 제한으로 메모리 사용량 제어
    if (!message || typeof message !== 'string' || message.length > 5000) {
      logger.info(`extractProjectDirectoryFromXcodeMessage: 메시지 길이 제한 초과 (${message ? message.length : 0}자) - null 반환`);
      return null;
    }
    
    // 중복 호출 방지를 위한 간단한 캐시
    const messageHash = message.substring(0, 100);
    if (this._extractCache && this._extractCache[messageHash]) {
      logger.info(`extractProjectDirectoryFromXcodeMessage: 캐시된 결과 사용`);
      return this._extractCache[messageHash];
    }
    
    if (!this._extractCache) {
      this._extractCache = {};
    }
    
    logger.info(`extractProjectDirectoryFromXcodeMessage 호출됨, 메시지 길이: ${message.length}`);

    // Xcode 메시지에서 파일 경로 추출 (여러 패턴 시도)
    const filePathPatterns = [
      /The user is currently inside this file:\s*(.+?)(?:\n|$)/,
      /currently inside this file:\s*(.+?)(?:\n|$)/,
      /inside this file:\s*(.+?)(?:\n|$)/,
      /this file:\s*(.+?)(?:\n|$)/
    ];
    
    let filePath = null;
    for (const pattern of filePathPatterns) {
      const match = message.match(pattern);
      if (match) {
        filePath = match[1].trim();
        logger.info(`Xcode 파일 경로 감지 (패턴 ${filePathPatterns.indexOf(pattern) + 1}): ${filePath}`);
        break;
      }
    }
    
    if (!filePath) {
      logger.info('extractProjectDirectoryFromXcodeMessage: 파일 경로를 찾지 못함');
      
      // 대안: 메시지에서 파일명 패턴 찾기
      const fileNamePatterns = [
        /([A-Z][a-zA-Z]*View\.swift)/,
        /([A-Z][a-zA-Z]*\.swift)/,
        /([A-Z][a-zA-Z]*View)/,
        /([A-Z][a-zA-Z]*)/g
      ];
      
      for (const pattern of fileNamePatterns) {
        const match = message.match(pattern);
        if (match) {
          filePath = match[1];
          logger.info(`extractProjectDirectoryFromXcodeMessage: 대안 패턴으로 파일명 추출: ${filePath}`);
          break;
        }
      }
    }
    
    if (filePath) {
      // 상대 경로인 경우 절대 경로로 변환 시도
      if (!filePath.startsWith('/') && !filePath.includes(':')) {
        logger.info(`상대 경로 감지, 절대 경로 변환 시도: ${filePath}`);
        const path = await import('path');
        
        // Xcode 프로젝트의 일반적인 위치들을 우선순위에 따라 시도
        // 서버 디렉토리는 마지막에 시도 (Xcode 프로젝트가 아닐 가능성이 높음)
        const possiblePaths = [
          process.env.HOME + '/Documents', // Documents 폴더 (가장 일반적)
          process.env.HOME + '/Desktop', // Desktop 폴더
          process.env.HOME + '/Projects', // Projects 폴더
          process.env.HOME + '/Development', // Development 폴더
          process.env.HOME + '/Code', // Code 폴더
          process.env.HOME + '/Workspace', // Workspace 폴더
          process.env.HOME + '/XcodeProjects', // XcodeProjects 폴더
          process.cwd() // 현재 서버 디렉토리 (마지막 시도)
        ];
        
        // 최적화: Documents 폴더에서만 제한적으로 검색 (메모리 사용량 제어)
        logger.info(`Documents 폴더에서 Xcode 프로젝트 검색 시작: ${filePath}`);
        const documentsPath = process.env.HOME + '/Documents';
        const xcodeProjectInDocuments = await this.findXcodeProjectInDocumentsOptimized(documentsPath, filePath);
        if (xcodeProjectInDocuments) {
          logger.info(`Documents에서 Xcode 프로젝트 발견: ${xcodeProjectInDocuments}`);
          this._extractCache[messageHash] = xcodeProjectInDocuments;
          return xcodeProjectInDocuments;
        }
        
        // 파일명으로 간단한 검색만 수행 (메모리 절약)
        const fileNameForSearch = path.basename(filePath);
        const xcodeProjectByFileName = await this.findProjectDirectoryByFileNameOptimized(fileNameForSearch);
        if (xcodeProjectByFileName) {
          logger.info(`파일명으로 Xcode 프로젝트 디렉토리 감지: ${xcodeProjectByFileName}`);
          this._extractCache[messageHash] = xcodeProjectByFileName;
          return xcodeProjectByFileName;
        }
      } else {
        // 절대 경로인 경우 직접 처리
        const projectDir = await this.findProjectDirectoryFromFilePath(filePath);
        if (projectDir) {
          logger.info(`Xcode 프로젝트 디렉토리 감지: ${projectDir}`);
          this._extractCache[messageHash] = projectDir;
          return projectDir;
        }
      }
    }

    logger.info('extractProjectDirectoryFromXcodeMessage: 프로젝트 디렉토리를 찾지 못함, null 반환');
    
    // 결과를 캐시에 저장
    this._extractCache[messageHash] = null;
    
    return null;
  }

  /**
   * Documents 폴더에서 Xcode 프로젝트 찾기 (최적화된 버전)
   */
  async findXcodeProjectInDocumentsOptimized(documentsPath, filePath) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // 최대 10개 디렉토리만 검색 (메모리 사용량 제어)
      const items = fs.readdirSync(documentsPath).slice(0, 10);
      
      for (const item of items) {
        const itemPath = path.join(documentsPath, item);
        
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            // Xcode 프로젝트 마커 확인
            const xcodeMarkers = ['*.xcodeproj', '*.xcworkspace', 'Package.swift'];
            const hasXcodeMarker = await this.hasProjectMarker(itemPath, xcodeMarkers);
            
            if (hasXcodeMarker) {
              logger.info(`프로젝트 마커 발견: ${item}.xcodeproj at ${itemPath}`);
              return itemPath;
            }
          }
        } catch (error) {
          // 권한 오류 등 무시
          continue;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Documents 폴더 검색 오류:', error);
      return null;
    }
  }

  /**
   * Documents 폴더에서 Xcode 프로젝트 찾기 (기존 버전 - 호환성 유지)
   */
  async findXcodeProjectInDocuments(documentsPath, filePath) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Documents 폴더의 하위 디렉토리들을 확인
      const items = fs.readdirSync(documentsPath);
      
      for (const item of items) {
        const itemPath = path.join(documentsPath, item);
        
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            // 새로운 마커 기반 알고리즘 사용
            const fullPath = path.join(itemPath, filePath);
            logger.info(`Documents Xcode 프로젝트에서 경로 시도: ${fullPath}`);
            
            // Xcode 프로젝트 마커로 직접 검색
            const xcodeMarkers = ['*.xcodeproj', '*.xcworkspace', 'Package.swift'];
            const result = await this.detectProjectRoot(fullPath, xcodeMarkers);
            
            if (result) {
              logger.info(`Documents에서 Xcode 프로젝트 발견: ${result}`);
              return result;
            }
          }
        } catch (error) {
          // 접근 불가한 디렉토리는 무시
          logger.debug(`Documents 디렉토리 접근 실패: ${itemPath}`, error.message);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Documents에서 Xcode 프로젝트 찾기 오류:', error);
      return null;
    }
  }

  /**
   * 파일명으로 프로젝트 디렉토리 찾기 (최적화된 버전)
   */
  async findProjectDirectoryByFileNameOptimized(fileName) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Documents 폴더에서만 제한적으로 검색
      const documentsPath = process.env.HOME + '/Documents';
      const items = fs.readdirSync(documentsPath).slice(0, 5); // 최대 5개만 검색
      
      for (const item of items) {
        const itemPath = path.join(documentsPath, item);
        
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            // Xcode 프로젝트 마커 확인
            const hasXcodeMarker = await this.hasProjectMarker(itemPath, ['*.xcodeproj', '*.xcworkspace']);
            
            if (hasXcodeMarker) {
              // 파일이 해당 프로젝트에 있는지 확인
              const filePath = path.join(itemPath, fileName);
              if (fs.existsSync(filePath)) {
                logger.info(`파일 검색 결과: ${filePath}`);
                return itemPath;
              }
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('파일명 검색 오류:', error);
      return null;
    }
  }

  /**
   * 파일명으로 프로젝트 디렉토리 찾기 (기존 버전 - 호환성 유지)
   */
  async findProjectDirectoryByFileName(fileName, preferredMarkers = null) {
    try {
      const path = await import('path');
      const fs = await import('fs');
      
      // 일반적인 Xcode 프로젝트 위치들에서 파일명으로 검색
      const searchPaths = [
        process.env.HOME + '/Documents', // Documents 폴더 (가장 일반적)
        process.env.HOME + '/Desktop', // Desktop 폴더
        process.env.HOME + '/Projects', // Projects 폴더
        process.env.HOME + '/Development', // Development 폴더
        process.env.HOME + '/Code', // Code 폴더
        process.env.HOME + '/Workspace', // Workspace 폴더
        process.env.HOME + '/XcodeProjects' // XcodeProjects 폴더
      ];
      
      for (const searchPath of searchPaths) {
        try {
          const found = await this.searchFileInDirectory(searchPath, fileName, 3);
          if (found) {
            logger.info(`파일 발견: ${found}`);
            
            // 선호하는 마커가 있으면 해당 마커로 검색
            if (preferredMarkers) {
              const result = await this.detectProjectRoot(found, preferredMarkers);
              if (result) {
                return result;
              }
            }
            
            // 기본 검색
            return await this.findProjectDirectoryFromFilePath(found);
          }
        } catch (error) {
          logger.debug(`검색 경로 오류 ${searchPath}: ${error.message}`);
        }
      }
      
      return null;
    } catch (error) {
      logger.error('파일명으로 프로젝트 디렉토리 찾기 오류:', error);
      return null;
    }
  }

  /**
   * 디렉토리에서 파일명으로 재귀 검색
   */
  async searchFileInDirectory(dir, fileName, maxDepth) {
    if (maxDepth <= 0) return null;
    
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isFile() && item === fileName) {
            return fullPath;
          } else if (stat.isDirectory() && !item.startsWith('.')) {
            const found = await this.searchFileInDirectory(fullPath, fileName, maxDepth - 1);
            if (found) return found;
          }
        } catch (error) {
          // 접근 불가한 파일/디렉토리는 무시
          continue;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 마커 기반 프로젝트 디렉토리 찾기 (개선된 알고리즘)
   * @param {string} startPath - 시작 경로
   * @param {string[]} markers - 프로젝트 마커 파일/디렉토리 목록 (우선순위 순)
   * @param {number} maxDepth - 최대 검색 깊이 (기본값: 10)
   * @param {boolean} followSymlinks - 심볼릭 링크 따라가기 (기본값: false)
   * @returns {Promise<{path: string, marker: string} | null>}
   */
  /**
   * 간단한 프로젝트 루트 감지 (제공된 알고리즘 기반, 와일드카드 지원)
   * @param {string} filePath - 파일 경로
   * @param {string[]} markers - 검색할 마커들 (기본값: Xcode 프로젝트 마커)
   * @returns {Promise<string | null>}
   */
  async detectProjectRoot(filePath, markers = [".xcodeproj", ".xcworkspace", "Package.swift", ".git"]) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      let current = path.dirname(path.resolve(filePath));
      
      while (true) {
        try {
          // 현재 디렉토리의 모든 항목 읽기
          const items = fs.readdirSync(current);
          
          for (const marker of markers) {
            // 와일드카드 패턴 지원
            if (marker.includes('*')) {
              const pattern = marker.replace(/\*/g, '.*');
              const regex = new RegExp(`^${pattern}$`);
              const found = items.find(item => regex.test(item));
              if (found) {
                logger.info(`프로젝트 마커 발견: ${found} at ${current}`);
                return current;
              }
            } else {
              // 정확한 이름 매칭
              if (items.includes(marker)) {
                logger.info(`프로젝트 마커 발견: ${marker} at ${current}`);
                return current;
              }
            }
          }
        } catch (error) {
          // 디렉토리 접근 오류 처리
          if (error.code === 'ENOENT') {
            logger.debug(`디렉토리 존재하지 않음: ${current}`);
          } else if (error.code === 'EACCES' || error.code === 'EPERM') {
            logger.debug(`디렉토리 접근 권한 없음: ${current}`);
          } else {
            logger.debug(`디렉토리 읽기 오류: ${current} - ${error.message}`);
          }
        }
        
        const parent = path.dirname(current);
        if (parent === current) break; // root reached
        current = parent;
      }
      
      logger.info(`프로젝트 마커를 찾지 못함: ${filePath}`);
      return null;
      
    } catch (error) {
      logger.error('프로젝트 루트 감지 오류:', error);
      return null;
    }
  }

  /**
   * 파일 경로에서 프로젝트 디렉토리 찾기 (레거시 호환성)
   */
  async findProjectDirectoryFromFilePath(filePath) {
    // Xcode 프로젝트 마커 우선순위 (와일드카드 패턴 사용)
    const xcodeMarkers = ['*.xcodeproj', '*.xcworkspace', 'Package.swift', '.git'];
    const result = await this.detectProjectRoot(filePath, xcodeMarkers);
    if (result) {
      return result;
    }
    
    // Xcode 프로젝트를 찾지 못한 경우 다른 프로젝트 타입 시도
    const otherMarkers = ['package.json', 'build.gradle', 'build.gradle.kts', 'pom.xml', 'Cargo.toml'];
    const otherResult = await this.detectProjectRoot(filePath, otherMarkers);
    return otherResult;
  }

  /**
   * 파일 분석 질문인지 확인
   */
  isFileAnalysisQuestion(message) {
    const fileKeywords = ['분석', 'analyze', '코드', 'code', '파일', 'file'];
    const hasFileKeyword = fileKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    // 파일명이 포함된 경우 (예: ScorecardView, ContentView 등)
    const hasFileName = /[A-Z][a-zA-Z]*View|[A-Z][a-zA-Z]*\.swift|[A-Z][a-zA-Z]*\.js|[A-Z][a-zA-Z]*\.ts/.test(message);
    
    return hasFileKeyword || hasFileName;
  }

  /**
   * 파일 분석 질문 처리
   */
  async handleFileAnalysisQuestion(message, projectDir) {
    try {
      // 파일명 추출
      const fileName = this.extractFileNameFromMessage(message);
      logger.info(`추출된 파일명: ${fileName}`);
      if (!fileName) {
        return "파일명을 찾을 수 없습니다. 구체적인 파일명을 알려주세요.";
      }

      // 프로젝트 디렉토리에서 파일 찾기
      logger.info(`프로젝트 디렉토리에서 파일 검색: ${fileName} in ${projectDir}`);
      const filePath = await this.findFileInProject(fileName, projectDir);
      logger.info(`파일 검색 결과: ${filePath}`);
      if (!filePath) {
        return `파일을 찾을 수 없습니다: ${fileName} (프로젝트: ${projectDir})`;
      }

      // 파일 분석 실행
      const analysisResult = await this.analyzeCode(filePath);
      return analysisResult;
      
    } catch (error) {
      logger.error('파일 분석 질문 처리 오류:', error);
      return "파일 분석 중 오류가 발생했습니다.";
    }
  }

  /**
   * 메시지에서 파일명 추출
   */
  extractFileNameFromMessage(message) {
    // Swift 파일명 패턴 매칭
    const swiftFilePattern = /([A-Z][a-zA-Z]*View|[A-Z][a-zA-Z]*\.swift)/;
    const match = message.match(swiftFilePattern);
    
    if (match) {
      let fileName = match[1];
      // .swift 확장자가 없으면 추가
      if (!fileName.endsWith('.swift')) {
        fileName += '.swift';
      }
      return fileName;
    }
    
    return null;
  }

  /**
   * 프로젝트에서 파일 찾기
   */
  async findFileInProject(fileName, projectDir) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // 재귀적으로 파일 검색
      const findFile = (dir, targetFileName) => {
        try {
          const items = fs.readdirSync(dir);
          
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isFile() && item === targetFileName) {
              return fullPath;
            } else if (stat.isDirectory() && !item.startsWith('.')) {
              const found = findFile(fullPath, targetFileName);
              if (found) return found;
            }
          }
        } catch (error) {
          // 접근 불가한 디렉토리는 무시
        }
        return null;
      };
      
      return findFile(projectDir, fileName);
      
    } catch (error) {
      logger.error('파일 검색 오류:', error);
      return null;
    }
  }

  /**
   * 프로젝트 분석 질문인지 확인
   */
  isProjectAnalysisQuestion(message) {
    const projectKeywords = ['프로젝트', 'project', '구조', 'structure', '현재 프로젝트', '내 프로젝트'];
    const hasProjectKeyword = projectKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // 파일 분석 질문이 아닌 경우에만 프로젝트 분석으로 간주
    return hasProjectKeyword && !this.isFileAnalysisQuestion(message);
  }

  /**
   * 수학 질문인지 확인
   */
  isMathQuestion(message) {
    const mathPattern = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*$/;
    return mathPattern.test(message.trim());
  }

  /**
   * 개발 도구 질문인지 확인
   */
  isDevelopmentToolQuestion(message) {
    const toolKeywords = ['디렉토리', '파일', '경로', '명령어', 'git', 'npm', 'node', 'java'];
    return toolKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 프로젝트 분석 응답
   */
  async getProjectAnalysisResponse(projectDir = null) {
    // 감지된 프로젝트 디렉토리가 있으면 해당 프로젝트 분석
    if (projectDir) {
      return await this.analyzeDetectedProject(projectDir);
    }
    
    // 기본적으로 MCP Cursor Server 프로젝트 정보 제공
    return {
      content: `📁 **프로젝트 파일 구조**

MCP Cursor Server 프로젝트의 주요 파일과 디렉토리입니다:

cursor-server/
├── package.json          # 프로젝트 설정 및 의존성
├── README.md             # 프로젝트 문서
├── ARCHITECTURE.md       # 아키텍처 가이드
├── config.js             # 서버 설정
├── src/                  # 소스 코드
│   ├── server.js         # 메인 서버 파일
│   ├── core/             # 핵심 서비스
│   │   ├── mcpServer.js  # MCP 서버
│   │   └── mcpHttpServer.js # HTTP 중계 서버
│   ├── services/         # 비즈니스 로직
│   │   ├── aiService.js  # AI 모델 서비스
│   │   ├── projectDetector.js # 프로젝트 감지
│   │   └── cacheService.js # 캐시 서비스
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
- mcpServer.js: MCP 프로토콜 서버 (Cursor Editor 연결)
- mcpHttpServer.js: HTTP 중계 서버 (레거시 클라이언트 지원)
- aiService.js: AI 모델 통합 서비스
- package.json: Node.js 프로젝트 설정

더 자세한 파일 정보가 필요하시면 특정 파일명을 말씀해주세요!`,
      model: 'cursor-default',
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  /**
   * 감지된 프로젝트 분석
   */
  async analyzeDetectedProject(projectDir) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      logger.info(`프로젝트 분석 시작: ${projectDir}`);
      
      // 프로젝트 타입 감지
      const projectType = await this.detectProjectType(projectDir);
      const projectName = path.basename(projectDir);
      
      // 프로젝트 파일 구조 분석
      const projectStructure = await this.analyzeProjectStructure(projectDir);
      
      return {
        content: `📁 **${projectName} 프로젝트 분석**

🔍 **프로젝트 정보:**
- **경로**: ${projectDir}
- **타입**: ${projectType}
- **이름**: ${projectName}

${projectStructure}

💡 **추가 정보:**
- 이 프로젝트는 Xcode에서 감지되었습니다
- Swift 파일이 포함된 iOS/macOS 프로젝트로 보입니다
- 더 자세한 분석이 필요하시면 특정 파일이나 기능에 대해 질문해주세요!`,
        model: 'cursor-default',
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      logger.error('프로젝트 분석 오류:', error);
      return {
        content: `❌ 프로젝트 분석 중 오류가 발생했습니다: ${error.message}

📁 **기본 프로젝트 정보:**
- **경로**: ${projectDir}
- **상태**: 분석 실패

💡 **해결 방법:**
- 프로젝트 경로를 확인해주세요
- 파일 권한을 확인해주세요
- 다시 시도해주세요`,
        model: 'cursor-default',
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }
  }

  /**
   * 프로젝트 타입 감지
   */
  async detectProjectType(projectDir) {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const items = fs.readdirSync(projectDir);
      
      // Xcode 프로젝트 파일들 확인 (우선순위 높음)
      const xcodeProject = items.find(item => item.endsWith('.xcodeproj'));
      const xcodeWorkspace = items.find(item => item.endsWith('.xcworkspace'));
      const swiftPackage = items.find(item => item === 'Package.swift');
      
      if (xcodeProject || xcodeWorkspace) {
        return 'iOS/macOS (Xcode)';
      }
      
      if (swiftPackage) {
        return 'Swift Package';
      }
      
      // Swift 파일이 있는지 확인
      const hasSwiftFiles = items.some(item => {
        if (item.endsWith('.swift')) return true;
        // 하위 디렉토리에서 Swift 파일 검색 (1단계만)
        try {
          const fullPath = path.join(projectDir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const subItems = fs.readdirSync(fullPath);
            return subItems.some(subItem => subItem.endsWith('.swift'));
          }
        } catch (error) {
          // 접근 불가한 디렉토리는 무시
        }
        return false;
      });
      
      if (hasSwiftFiles) {
        return 'iOS/macOS (Swift)';
      }
      
      // 다른 프로젝트 타입들 확인
      const projectFiles = {
        'package.json': 'Node.js',
        'build.gradle': 'Android (Gradle)',
        'build.gradle.kts': 'Android (Kotlin DSL)',
        'pom.xml': 'Java (Maven)',
        'Cargo.toml': 'Rust',
        'requirements.txt': 'Python'
      };
      
      for (const [file, type] of Object.entries(projectFiles)) {
        if (items.includes(file)) {
          return type;
        }
      }
      
      return 'Unknown';
    } catch (error) {
      logger.error('프로젝트 타입 감지 오류:', error);
      return 'Unknown';
    }
  }

  /**
   * 프로젝트 구조 분석
   */
  async analyzeProjectStructure(projectDir) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const structure = await this.buildProjectTree(projectDir, '', 0, 3);
      
      return `📂 **프로젝트 구조:**
\`\`\`
${structure}
\`\`\``;
    } catch (error) {
      logger.error('프로젝트 구조 분석 오류:', error);
      return `📂 **프로젝트 구조:**
❌ 구조 분석 실패: ${error.message}`;
    }
  }

  /**
   * 프로젝트 트리 구조 생성
   */
  async buildProjectTree(dir, prefix, depth, maxDepth) {
    if (depth >= maxDepth) return '';
    
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const items = fs.readdirSync(dir)
        .filter(item => !item.startsWith('.'))
        .slice(0, 10); // 최대 10개 항목만 표시
      
      let tree = '';
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const fullPath = path.join(dir, item);
        const isLast = index === items.length - 1;
        const currentPrefix = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        
        tree += `${prefix}${currentPrefix}${item}`;
        
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory() && depth < maxDepth - 1) {
            tree += '/\n';
            tree += await this.buildProjectTree(fullPath, nextPrefix, depth + 1, maxDepth);
          } else {
            tree += '\n';
          }
        } catch (error) {
          tree += ' (접근 불가)\n';
        }
      }
      
      return tree;
    } catch (error) {
      return `${prefix}└── (읽기 실패: ${error.message})\n`;
    }
  }

  /**
   * 수학 질문 처리
   */
  handleMathQuestion(message) {
    try {
      const result = this.safeMathEval(message.trim());
      return {
        content: `🧮 **수학 계산 결과:**

**계산식:** ${message.trim()}
**결과:** ${result}

💡 **추가 정보:**
- 결과 타입: ${typeof result}
- 소수점 자릿수: ${result.toString().split('.')[1]?.length || 0}자리

다른 계산도 해보시겠어요?`,
        model: 'cursor-default',
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      return {
        content: `❌ 수학 계산 오류: ${error.message}`,
        model: 'cursor-default',
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }
  }

  /**
   * 개발 도구 응답
   */
  getDevelopmentToolResponse() {
    return {
      content: `🔧 **개발 도구 및 시스템 질문**

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

구체적으로 어떤 명령어나 도구에 대해 알고 싶으신가요?`,
      model: 'cursor-default',
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  /**
   * 안전한 수학 계산
   */
  safeMathEval(expression) {
    // 허용된 문자만 포함하는지 확인
    if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(expression)) {
      throw new Error('Invalid characters in expression');
    }
    
    // eval 사용 (간단한 수학 계산만)
    return eval(expression);
  }

  /**
   * Swift 파일 분석 프롬프트 생성
   */
  getSwiftAnalysisPrompt(fileName, content, analysisType) {
    const basePrompt = `다음 Swift 파일을 분석해주세요:\n\n**파일명:** ${fileName}\n\n**코드 내용:**\n\`\`\`swift\n${content}\n\`\`\`\n\n`;
    
    switch (analysisType) {
      case 'syntax':
        return basePrompt + `**분석 요청:** 문법적 오류, Swift 코딩 컨벤션 준수 여부, 타입 안전성 등을 분석해주세요.`;
      case 'performance':
        return basePrompt + `**분석 요청:** 성능 최적화 포인트, 메모리 사용량, 실행 속도 등을 분석해주세요.`;
      case 'security':
        return basePrompt + `**분석 요청:** 보안 취약점, 데이터 보호, 접근 제어 등을 분석해주세요.`;
      case 'style':
        return basePrompt + `**분석 요청:** 코드 스타일, 가독성, 네이밍 컨벤션 등을 분석해주세요.`;
      default:
        return basePrompt + `**분석 요청:** 전체적인 코드 품질, 구조, 개선 사항을 종합적으로 분석해주세요.`;
    }
  }

  /**
   * Kotlin/Java 파일 분석 프롬프트 생성
   */
  getKotlinJavaAnalysisPrompt(fileName, content, analysisType) {
    const basePrompt = `다음 Kotlin/Java 파일을 분석해주세요:\n\n**파일명:** ${fileName}\n\n**코드 내용:**\n\`\`\`kotlin\n${content}\n\`\`\`\n\n`;
    
    switch (analysisType) {
      case 'syntax':
        return basePrompt + `**분석 요청:** 문법적 오류, Kotlin/Java 코딩 컨벤션 준수 여부, 타입 안전성 등을 분석해주세요.`;
      case 'performance':
        return basePrompt + `**분석 요청:** 성능 최적화 포인트, 메모리 사용량, 실행 속도 등을 분석해주세요.`;
      case 'security':
        return basePrompt + `**분석 요청:** 보안 취약점, 데이터 보호, 접근 제어 등을 분석해주세요.`;
      case 'style':
        return basePrompt + `**분석 요청:** 코드 스타일, 가독성, 네이밍 컨벤션 등을 분석해주세요.`;
      default:
        return basePrompt + `**분석 요청:** 전체적인 코드 품질, 구조, 개선 사항을 종합적으로 분석해주세요.`;
    }
  }

  /**
   * JavaScript/TypeScript 파일 분석 프롬프트 생성
   */
  getJavaScriptAnalysisPrompt(fileName, content, analysisType) {
    const basePrompt = `다음 JavaScript/TypeScript 파일을 분석해주세요:\n\n**파일명:** ${fileName}\n\n**코드 내용:**\n\`\`\`javascript\n${content}\n\`\`\`\n\n`;
    
    switch (analysisType) {
      case 'syntax':
        return basePrompt + `**분석 요청:** 문법적 오류, ES6+ 기능 사용, 타입 안전성 등을 분석해주세요.`;
      case 'performance':
        return basePrompt + `**분석 요청:** 성능 최적화 포인트, 메모리 누수, 비동기 처리 등을 분석해주세요.`;
      case 'security':
        return basePrompt + `**분석 요청:** 보안 취약점, XSS, CSRF, 데이터 보호 등을 분석해주세요.`;
      case 'style':
        return basePrompt + `**분석 요청:** 코드 스타일, 가독성, 네이밍 컨벤션 등을 분석해주세요.`;
      default:
        return basePrompt + `**분석 요청:** 전체적인 코드 품질, 구조, 개선 사항을 종합적으로 분석해주세요.`;
    }
  }

  /**
   * 일반 파일 분석 프롬프트 생성
   */
  getGeneralAnalysisPrompt(fileName, content, analysisType) {
    const basePrompt = `다음 파일을 분석해주세요:\n\n**파일명:** ${fileName}\n\n**코드 내용:**\n\`\`\`\n${content}\n\`\`\`\n\n`;
    
    switch (analysisType) {
      case 'syntax':
        return basePrompt + `**분석 요청:** 문법적 오류, 코딩 컨벤션 준수 여부 등을 분석해주세요.`;
      case 'performance':
        return basePrompt + `**분석 요청:** 성능 최적화 포인트, 효율성 등을 분석해주세요.`;
      case 'security':
        return basePrompt + `**분석 요청:** 보안 취약점, 데이터 보호 등을 분석해주세요.`;
      case 'style':
        return basePrompt + `**분석 요청:** 코드 스타일, 가독성, 네이밍 컨벤션 등을 분석해주세요.`;
      default:
        return basePrompt + `**분석 요청:** 전체적인 코드 품질, 구조, 개선 사항을 종합적으로 분석해주세요.`;
    }
  }
}
