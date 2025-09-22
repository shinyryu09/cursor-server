import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import ProjectDetector from '../src/services/projectDetector.js';
import CursorService from '../src/services/cursorService.js';
import AIService from '../src/services/aiService.js';

describe('MCP Cursor Server Tests', () => {
  let projectDetector;
  let cursorService;
  let aiService;

  before(() => {
    projectDetector = new ProjectDetector();
    cursorService = new CursorService();
    aiService = new AIService();
  });

  describe('ProjectDetector', () => {
    test('should detect project in current directory', async () => {
      const project = await projectDetector.detectProject();
      // 프로젝트가 감지되거나 null이어야 함
      assert(project === null || typeof project === 'object');
    });

    test('should have current project getter', () => {
      const currentProject = projectDetector.getCurrentProject();
      assert(currentProject === null || typeof currentProject === 'object');
    });

    test('should clear cache', () => {
      projectDetector.clearCache();
      // 캐시 클리어는 에러 없이 실행되어야 함
      assert(true);
    });
  });

  describe('CursorService', () => {
    test('should have status getter', async () => {
      const status = await cursorService.getStatus();
      assert(typeof status === 'object');
      assert(typeof status.available === 'boolean');
      assert(typeof status.workingDirectory === 'string');
      assert(typeof status.timeout === 'number');
    });

    test('should restart service', async () => {
      const result = await cursorService.restart();
      assert(typeof result === 'boolean');
    });
  });

  describe('AIService', () => {
    test('should have status getter', () => {
      const status = aiService.getStatus();
      assert(typeof status === 'object');
    });

    test('should get available models', () => {
      const models = aiService.getAvailableModels();
      assert(Array.isArray(models));
    });

    test('should determine model type', () => {
      const openaiType = aiService.getModelType('gpt-4');
      assert(typeof openaiType === 'string');
    });
  });
});
