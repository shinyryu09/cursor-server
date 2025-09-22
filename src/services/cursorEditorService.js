import axios from 'axios';
import path from 'path';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import ProjectDetector from './projectDetector.js';

/**
 * Cursor Editor HTTP API 서비스
 */
export class CursorEditorService {
  constructor() {
    this.isAvailable = false;
    this.baseUrl = 'http://localhost:3001'; // Cursor Editor 기본 포트
    this.projectDetector = new ProjectDetector();
    this.initialize();
  }

  /**
   * 비동기 초기화
   */
  async initialize() {
    await this.checkAvailability();
  }

  /**
   * Cursor Editor 사용 가능 여부 확인
   */
  async checkAvailability() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      this.isAvailable = response.status === 200;
      if (this.isAvailable) {
        logger.info('Cursor Editor 사용 가능');
      } else {
        logger.warn('Cursor Editor 응답이 예상과 다릅니다');
      }
    } catch (error) {
      this.isAvailable = false;
      logger.warn('Cursor Editor를 사용할 수 없습니다:', error.message);
    }
  }

  /**
   * Cursor Editor를 사용한 채팅
   */
  async chat(message, files = []) {
    if (!this.isAvailable) {
      // Cursor Editor가 사용 불가능한 경우 fallback 응답
      return this.generateFallbackResponse(message, files);
    }

    try {
      logger.info(`Cursor Editor 채팅 시작: ${message.substring(0, 100)}...`);

      // 프로젝트 컨텍스트 수집 - files에서 경로 추출
      let projectDir = process.cwd();
      if (files.length > 0) {
        // 첫 번째 파일의 디렉토리를 프로젝트 경로로 사용
        projectDir = path.dirname(files[0]);
      }
      const project = await this.projectDetector.detectProject(projectDir);
      
      // Cursor Editor API 호출
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, {
        model: 'cursor-editor',
        messages: [
          {
            role: 'system',
            content: this.createSystemMessage(project)
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: false
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('Cursor Editor 채팅 완료');
      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('Cursor Editor 실행 실패:', error);
      // 에러 발생 시 fallback 응답
      return this.generateFallbackResponse(message, files);
    }
  }

  /**
   * 시스템 메시지 생성
   */
  createSystemMessage(project) {
    let systemMessage = "You are a helpful AI assistant specializing in code development. ";
    
    if (project) {
      systemMessage += `The user is working on a ${project.type} project named "${project.name}" at path "${project.path}". `;
      
      if (project.type === 'xcode' && project.buildSettings) {
        systemMessage += `Xcode build settings: ${JSON.stringify(project.buildSettings)}. `;
      }
    }
    
    systemMessage += "Provide concise and accurate code suggestions and explanations based on the context.";
    return systemMessage;
  }

  /**
   * Fallback 응답 생성
   */
  async generateFallbackResponse(message, files = []) {
    // files에서 경로 추출하여 프로젝트 감지
    let projectDir = process.cwd();
    if (files.length > 0) {
      projectDir = path.dirname(files[0]);
    }
    const project = await this.projectDetector.detectProject(projectDir);
    
    // 간단하고 빠른 응답
    let response = `안녕하세요! Cursor Editor를 통해 도움을 드리겠습니다.\n\n`;
    response += `**질문:** ${message}\n\n`;
    
    if (project) {
      response += `**프로젝트:** ${project.name} (${project.type})\n\n`;
    }
    
    // 간단한 프로젝트별 응답
    if (project) {
      if (project.type === 'xcode') {
        response += `Swift/iOS 개발에 대한 질문이군요! 코드 생성, 디버깅, 최적화 등에 도움을 드릴 수 있습니다.`;
      } else if (project.type === 'android') {
        response += `Android 개발에 대한 질문이군요! Kotlin/Java 코드 생성, Android 프레임워크 등에 도움을 드릴 수 있습니다.`;
      } else {
        response += `프로그래밍 관련 질문에 도움을 드릴 수 있습니다.`;
      }
    } else {
      response += `프로그래밍 관련 질문에 도움을 드릴 수 있습니다.`;
    }

    return response;
  }

  /**
   * Cursor Editor 상태 확인
   */
  async getStatus() {
    await this.checkAvailability();
    
    return {
      available: this.isAvailable,
      baseUrl: this.baseUrl,
      timeout: 30000
    };
  }

  /**
   * Cursor Editor 재시작
   */
  async restart() {
    logger.info('Cursor Editor 연결을 재시도합니다...');
    await this.checkAvailability();
    return { 
      success: true, 
      message: this.isAvailable ? 'Cursor Editor 연결 성공' : 'Cursor Editor 연결 실패'
    };
  }
}

export default CursorEditorService;
