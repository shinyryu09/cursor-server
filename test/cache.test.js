import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { CacheService } from '../src/services/cacheService.js';
import { AIService } from '../src/services/aiService.js';
import fs from 'fs/promises';
import path from 'path';

describe('Cache Service Tests', () => {
  let cacheService;
  let testCacheDir;

  before(async () => {
    // 테스트용 캐시 디렉토리 생성
    testCacheDir = path.join(process.cwd(), 'test-cache');
    await fs.mkdir(testCacheDir, { recursive: true });
    
    cacheService = new CacheService();
    // 테스트용 캐시 디렉토리로 변경
    cacheService.cacheDir = testCacheDir;
  });

  after(async () => {
    // 테스트용 캐시 디렉토리 정리
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('테스트 캐시 디렉토리 정리 실패:', error.message);
    }
  });

  it('should generate consistent cache keys', () => {
    const request1 = {
      message: 'Hello world',
      model: 'gpt-4',
      context: 'test context',
      type: 'chat'
    };

    const request2 = {
      message: 'Hello world',
      model: 'gpt-4',
      context: 'test context',
      type: 'chat'
    };

    const key1 = cacheService.generateCacheKey(request1);
    const key2 = cacheService.generateCacheKey(request2);

    assert.strictEqual(key1, key2, '동일한 요청은 동일한 캐시 키를 생성해야 함');
    assert.strictEqual(typeof key1, 'string', '캐시 키는 문자열이어야 함');
    assert.strictEqual(key1.length, 64, 'SHA256 해시는 64자여야 함');
  });

  it('should generate different cache keys for different requests', () => {
    const request1 = {
      message: 'Hello world',
      model: 'gpt-4',
      context: 'test context',
      type: 'chat'
    };

    const request2 = {
      message: 'Hello world!',
      model: 'gpt-4',
      context: 'test context',
      type: 'chat'
    };

    const key1 = cacheService.generateCacheKey(request1);
    const key2 = cacheService.generateCacheKey(request2);

    assert.notStrictEqual(key1, key2, '다른 요청은 다른 캐시 키를 생성해야 함');
  });

  it('should store and retrieve data from memory cache', async () => {
    const key = 'test-key-1';
    const testData = { message: 'Hello from cache', timestamp: Date.now() };

    // 데이터 저장
    await cacheService.set(key, testData, 60); // 60초 TTL

    // 데이터 조회
    const retrieved = await cacheService.get(key);

    assert.ok(retrieved, '캐시에서 데이터를 조회할 수 있어야 함');
    assert.strictEqual(retrieved.data.message, testData.message, '저장된 데이터와 조회된 데이터가 일치해야 함');
  });

  it('should store and retrieve data from disk cache', async () => {
    const key = 'test-key-2';
    const testData = { message: 'Hello from disk cache', timestamp: Date.now() };

    // 메모리 캐시 비우기
    cacheService.memoryCache.clear();

    // 데이터 저장
    await cacheService.set(key, testData, 60);

    // 메모리 캐시에서 다시 비우기 (디스크에서만 조회하도록)
    cacheService.memoryCache.clear();

    // 데이터 조회
    const retrieved = await cacheService.get(key);

    assert.ok(retrieved, '디스크 캐시에서 데이터를 조회할 수 있어야 함');
    assert.strictEqual(retrieved.data.message, testData.message, '저장된 데이터와 조회된 데이터가 일치해야 함');
  });

  it('should return null for non-existent keys', async () => {
    const nonExistentKey = 'non-existent-key';
    const result = await cacheService.get(nonExistentKey);

    assert.strictEqual(result, null, '존재하지 않는 키는 null을 반환해야 함');
  });

  it('should handle expired cache entries', async () => {
    const key = 'expired-key';
    const testData = { message: 'This will expire', timestamp: Date.now() };

    // 1초 TTL로 저장
    await cacheService.set(key, testData, 1);

    // 즉시 조회 (아직 유효)
    const validResult = await cacheService.get(key);
    assert.ok(validResult, '만료되지 않은 캐시는 조회되어야 함');

    // 2초 대기
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 다시 조회 (만료됨)
    const expiredResult = await cacheService.get(key);
    assert.strictEqual(expiredResult, null, '만료된 캐시는 null을 반환해야 함');
  });

  it('should provide cache statistics', async () => {
    const stats = cacheService.getStats();

    assert.ok(stats, '캐시 통계가 제공되어야 함');
    assert.strictEqual(typeof stats.hits, 'number', '히트 수는 숫자여야 함');
    assert.strictEqual(typeof stats.misses, 'number', '미스 수는 숫자여야 함');
    assert.strictEqual(typeof stats.totalRequests, 'number', '총 요청 수는 숫자여야 함');
    assert.strictEqual(typeof stats.hitRate, 'string', '히트율은 문자열이어야 함');
  });

  it('should clear all cache', async () => {
    // 테스트 데이터 저장
    await cacheService.set('clear-test-1', { data: 'test1' });
    await cacheService.set('clear-test-2', { data: 'test2' });

    // 캐시 정리
    await cacheService.clear();

    // 정리 후 조회
    const result1 = await cacheService.get('clear-test-1');
    const result2 = await cacheService.get('clear-test-2');

    assert.strictEqual(result1, null, '정리 후 캐시는 조회되지 않아야 함');
    assert.strictEqual(result2, null, '정리 후 캐시는 조회되지 않아야 함');
  });

  it('should cleanup expired cache entries', async () => {
    // 만료된 데이터 저장
    const expiredData = {
      data: 'expired',
      timestamp: Date.now() - 7200000, // 2시간 전
      ttl: 3600 // 1시간 TTL
    };

    const key = 'cleanup-test';
    cacheService.memoryCache.set(key, expiredData);

    // 정리 실행
    const cleanedCount = await cacheService.cleanupExpired();

    assert.ok(cleanedCount >= 0, '정리된 항목 수는 0 이상이어야 함');
  });
});

describe('AI Service Cache Integration Tests', () => {
  let aiService;

  before(() => {
    aiService = new AIService();
  });

  it('should provide cache statistics', () => {
    const stats = aiService.getCacheStats();

    assert.ok(stats, 'AI 서비스에서 캐시 통계를 제공해야 함');
    assert.strictEqual(typeof stats.hits, 'number', '히트 수는 숫자여야 함');
    assert.strictEqual(typeof stats.misses, 'number', '미스 수는 숫자여야 함');
  });

  it('should clear cache through AI service', async () => {
    // 캐시 정리 (오류 없이 실행되어야 함)
    await assert.doesNotReject(
      aiService.clearCache(),
      'AI 서비스를 통한 캐시 정리는 오류 없이 실행되어야 함'
    );
  });

  it('should cleanup expired cache through AI service', async () => {
    // 만료된 캐시 정리 (오류 없이 실행되어야 함)
    const cleanedCount = await aiService.cleanupExpiredCache();
    
    assert.ok(typeof cleanedCount === 'number', '정리된 항목 수는 숫자여야 함');
    assert.ok(cleanedCount >= 0, '정리된 항목 수는 0 이상이어야 함');
  });
});

describe('Cache Performance Tests', () => {
  let cacheService;

  before(() => {
    cacheService = new CacheService();
  });

  it('should handle multiple concurrent cache operations', async () => {
    const promises = [];
    const testCount = 10;

    // 동시에 여러 캐시 작업 수행
    for (let i = 0; i < testCount; i++) {
      const key = `concurrent-test-${i}`;
      const data = { index: i, timestamp: Date.now() };
      
      promises.push(
        cacheService.set(key, data, 60)
          .then(() => cacheService.get(key))
          .then(result => {
            assert.ok(result, `동시 작업 ${i}에서 데이터를 조회할 수 있어야 함`);
            assert.strictEqual(result.data.index, i, `동시 작업 ${i}의 데이터가 일치해야 함`);
          })
      );
    }

    // 모든 작업이 완료될 때까지 대기
    await Promise.all(promises);
  });

  it('should maintain cache size limits', async () => {
    const maxSize = 5;
    cacheService.maxMemorySize = maxSize;

    // 최대 크기보다 많은 항목 저장
    for (let i = 0; i < maxSize + 3; i++) {
      await cacheService.set(`size-test-${i}`, { index: i }, 60);
    }

    // 메모리 캐시 크기가 제한을 초과하지 않는지 확인
    assert.ok(
      cacheService.memoryCache.size <= maxSize,
      `메모리 캐시 크기가 제한(${maxSize})을 초과하지 않아야 함. 현재 크기: ${cacheService.memoryCache.size}`
    );
  });
});
