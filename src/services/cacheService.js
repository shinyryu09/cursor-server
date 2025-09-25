import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * 캐시 서비스
 * AI 응답을 디스크에 캐시하여 성능 향상
 */
export class CacheService {
  constructor() {
    this.cacheDir = path.join(process.cwd(), 'cache');
    this.maxCacheSize = 1000; // 최대 캐시 항목 수
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24시간 (밀리초)
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    try {
      // 캐시 디렉토리 생성
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // 기존 캐시 파일 로드
      await this.loadCacheFiles();
      
      logger.info('캐시 서비스 초기화 완료');
    } catch (error) {
      logger.error('캐시 서비스 초기화 오류:', error);
    }
  }

  /**
   * 캐시 파일들 로드
   */
  async loadCacheFiles() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      logger.info(`${cacheFiles.length}개의 디스크 캐시 파일 로드됨`);
    } catch (error) {
      logger.error('캐시 파일 로드 오류:', error);
    }
  }

  /**
   * 캐시 키 생성
   */
  generateCacheKey(message, context = '') {
    try {
      // 메시지와 컨텍스트를 문자열로 변환
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      const contextStr = typeof context === 'string' ? context : JSON.stringify(context);
      
      // 해시 생성
      const hash = crypto.createHash('sha256');
      hash.update(messageStr + contextStr);
      return hash.digest('hex');
    } catch (error) {
      logger.error('캐시 키 생성 오류:', error);
      return null;
    }
  }

  /**
   * 캐시에서 값 가져오기
   */
  async get(key) {
    try {
      if (!key) return null;
      
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      
      try {
        const data = await fs.readFile(cacheFile, 'utf-8');
        const cacheItem = JSON.parse(data);
        
        // 만료 시간 확인
        if (Date.now() - cacheItem.timestamp > this.cacheExpiry) {
          await this.delete(key);
          return null;
        }
        
        return cacheItem.value;
      } catch (error) {
        // 파일이 없거나 읽기 실패
        return null;
      }
    } catch (error) {
      logger.error('캐시 가져오기 오류:', error);
      return null;
    }
  }

  /**
   * 캐시에 값 저장
   */
  async set(key, value) {
    try {
      if (!key) return false;
      
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      const cacheItem = {
        key: key,
        value: value,
        timestamp: Date.now()
      };
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheItem, null, 2));
      return true;
    } catch (error) {
      logger.error('캐시 저장 오류:', error);
      return false;
    }
  }

  /**
   * 캐시에서 값 삭제
   */
  async delete(key) {
    try {
      if (!key) return false;
      
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      
      try {
        await fs.unlink(cacheFile);
        return true;
      } catch (error) {
        // 파일이 없는 경우
        return false;
      }
    } catch (error) {
      logger.error('캐시 삭제 오류:', error);
      return false;
    }
  }

  /**
   * 캐시 정리 (만료된 항목들 삭제)
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      let deletedCount = 0;
      
      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const cacheItem = JSON.parse(data);
          
          // 만료된 항목 삭제
          if (Date.now() - cacheItem.timestamp > this.cacheExpiry) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          // 파일 읽기 실패 시 삭제
          try {
            await fs.unlink(path.join(this.cacheDir, file));
            deletedCount++;
          } catch (unlinkError) {
            // 무시
          }
        }
      }
      
      logger.info(`만료된 캐시 ${deletedCount}개 정리 완료`);
      return deletedCount;
    } catch (error) {
      logger.error('캐시 정리 오류:', error);
      return 0;
    }
  }

  /**
   * 캐시 크기 제한 관리
   */
  async manageCacheSize() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      if (cacheFiles.length <= this.maxCacheSize) {
        return;
      }
      
      // 파일들을 수정 시간순으로 정렬
      const fileStats = await Promise.all(
        cacheFiles.map(async (file) => {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );
      
      fileStats.sort((a, b) => a.mtime - b.mtime);
      
      // 오래된 파일들 삭제
      const filesToDelete = fileStats.slice(0, cacheFiles.length - this.maxCacheSize);
      
      for (const { file } of filesToDelete) {
        try {
          await fs.unlink(path.join(this.cacheDir, file));
        } catch (error) {
          // 무시
        }
      }
      
      logger.info(`캐시 크기 제한으로 ${filesToDelete.length}개 파일 삭제`);
    } catch (error) {
      logger.error('캐시 크기 관리 오류:', error);
    }
  }

  /**
   * 캐시 통계
   */
  async getStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      let validCount = 0;
      let expiredCount = 0;
      
      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          const data = await fs.readFile(filePath, 'utf-8');
          const cacheItem = JSON.parse(data);
          
          if (Date.now() - cacheItem.timestamp > this.cacheExpiry) {
            expiredCount++;
          } else {
            validCount++;
          }
        } catch (error) {
          // 무시
        }
      }
      
      return {
        totalFiles: cacheFiles.length,
        validFiles: validCount,
        expiredFiles: expiredCount,
        totalSize: totalSize,
        maxCacheSize: this.maxCacheSize,
        cacheExpiry: this.cacheExpiry
      };
    } catch (error) {
      logger.error('캐시 통계 오류:', error);
      return null;
    }
  }
}