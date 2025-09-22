import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from '../utils/logger.js';

// ES modules에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 채팅 히스토리 관리 서비스
 */
export class ChatHistoryService {
  constructor() {
    this.historyDir = path.join(__dirname, '../../data/chat-history');
    this.maxHistoryPerSession = 100; // 세션당 최대 히스토리 수
    this.maxSessions = 50; // 최대 세션 수
    this.initialize();
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
      logger.info('채팅 히스토리 서비스 초기화 완료');
    } catch (error) {
      logger.error('채팅 히스토리 서비스 초기화 실패:', error);
    }
  }

  /**
   * 세션 ID 생성
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 채팅 메시지 저장
   */
  async saveMessage(sessionId, message, response, metadata = {}) {
    try {
      const chatEntry = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: message
        },
        response: {
          role: 'assistant',
          content: response
        },
        metadata: {
          model: metadata.model || 'unknown',
          projectType: metadata.projectType || 'unknown',
          projectPath: metadata.projectPath || null,
          ...metadata
        }
      };

      const sessionFile = path.join(this.historyDir, `${sessionId}.json`);
      
      // 기존 세션 데이터 읽기
      let sessionData = { messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      
      try {
        const existingData = await fs.readFile(sessionFile, 'utf8');
        sessionData = JSON.parse(existingData);
      } catch (error) {
        // 파일이 없으면 새로 생성
        logger.info(`새 채팅 세션 생성: ${sessionId}`);
      }

      // 새 메시지 추가
      sessionData.messages.push(chatEntry);
      sessionData.updatedAt = new Date().toISOString();

      // 메시지 수 제한
      if (sessionData.messages.length > this.maxHistoryPerSession) {
        sessionData.messages = sessionData.messages.slice(-this.maxHistoryPerSession);
      }

      // 세션 데이터 저장
      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      
      logger.info(`채팅 메시지 저장됨: ${sessionId} (${sessionData.messages.length}개 메시지)`);
      return chatEntry.id;

    } catch (error) {
      logger.error('채팅 메시지 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 세션의 채팅 히스토리 조회
   */
  async getSessionHistory(sessionId, limit = 50) {
    try {
      const sessionFile = path.join(this.historyDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf8');
      const sessionData = JSON.parse(data);
      
      // 최근 메시지들만 반환
      const messages = sessionData.messages.slice(-limit);
      
      return {
        sessionId,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        messageCount: sessionData.messages.length,
        messages
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // 세션이 존재하지 않음
      }
      logger.error('채팅 히스토리 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 세션 목록 조회
   */
  async getAllSessions() {
    try {
      const files = await fs.readdir(this.historyDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      const sessions = [];
      
      for (const file of sessionFiles) {
        try {
          const sessionId = file.replace('.json', '');
          const data = await fs.readFile(path.join(this.historyDir, file), 'utf8');
          const sessionData = JSON.parse(data);
          
          sessions.push({
            sessionId,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            messageCount: sessionData.messages.length,
            lastMessage: sessionData.messages[sessionData.messages.length - 1]?.message?.content || 'No messages'
          });
        } catch (error) {
          logger.warn(`세션 파일 읽기 실패: ${file}`, error);
        }
      }
      
      // 최근 업데이트 순으로 정렬
      return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    } catch (error) {
      logger.error('세션 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId) {
    try {
      const sessionFile = path.join(this.historyDir, `${sessionId}.json`);
      await fs.unlink(sessionFile);
      logger.info(`채팅 세션 삭제됨: ${sessionId}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // 파일이 존재하지 않음
      }
      logger.error('채팅 세션 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 오래된 세션 정리
   */
  async cleanupOldSessions() {
    try {
      const sessions = await this.getAllSessions();
      
      if (sessions.length <= this.maxSessions) {
        return { deleted: 0, message: '정리할 세션이 없습니다.' };
      }
      
      // 오래된 세션들 삭제
      const sessionsToDelete = sessions.slice(this.maxSessions);
      let deletedCount = 0;
      
      for (const session of sessionsToDelete) {
        try {
          await this.deleteSession(session.sessionId);
          deletedCount++;
        } catch (error) {
          logger.warn(`세션 삭제 실패: ${session.sessionId}`, error);
        }
      }
      
      logger.info(`오래된 세션 정리 완료: ${deletedCount}개 세션 삭제`);
      return { deleted: deletedCount, message: `${deletedCount}개 세션이 삭제되었습니다.` };

    } catch (error) {
      logger.error('세션 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 채팅 히스토리 통계
   */
  async getStatistics() {
    try {
      const sessions = await this.getAllSessions();
      
      const stats = {
        totalSessions: sessions.length,
        totalMessages: sessions.reduce((sum, session) => sum + session.messageCount, 0),
        averageMessagesPerSession: sessions.length > 0 ? 
          Math.round(sessions.reduce((sum, session) => sum + session.messageCount, 0) / sessions.length) : 0,
        oldestSession: sessions.length > 0 ? sessions[sessions.length - 1].createdAt : null,
        newestSession: sessions.length > 0 ? sessions[0].createdAt : null,
        storageUsed: await this.getStorageUsage()
      };
      
      return stats;

    } catch (error) {
      logger.error('통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 저장소 사용량 계산
   */
  async getStorageUsage() {
    try {
      const files = await fs.readdir(this.historyDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.historyDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
      
      return {
        bytes: totalSize,
        kb: Math.round(totalSize / 1024 * 100) / 100,
        mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };

    } catch (error) {
      logger.error('저장소 사용량 계산 실패:', error);
      return { bytes: 0, kb: 0, mb: 0 };
    }
  }

  /**
   * 특정 키워드로 히스토리 검색
   */
  async searchHistory(keyword, limit = 20) {
    try {
      const sessions = await this.getAllSessions();
      const results = [];
      
      for (const session of sessions) {
        const history = await this.getSessionHistory(session.sessionId);
        if (!history) continue;
        
        const matchingMessages = history.messages.filter(msg => 
          msg.message.content.toLowerCase().includes(keyword.toLowerCase()) ||
          msg.response.content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (matchingMessages.length > 0) {
          results.push({
            sessionId: session.sessionId,
            updatedAt: session.updatedAt,
            matches: matchingMessages
          });
        }
        
        if (results.length >= limit) break;
      }
      
      return results;

    } catch (error) {
      logger.error('히스토리 검색 실패:', error);
      throw error;
    }
  }
}

export default ChatHistoryService;
