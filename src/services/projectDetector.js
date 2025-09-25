import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * 프로젝트 감지 서비스
 * 현재 작업 디렉토리에서 프로젝트 타입을 자동으로 감지
 */
export class ProjectDetector {
  constructor() {
    this.projectTypes = {
      'node': ['package.json'],
      'android': ['build.gradle', 'build.gradle.kts', 'AndroidManifest.xml'],
      'ios': ['Info.plist', '*.xcodeproj', '*.xcworkspace'],
      'python': ['requirements.txt', 'setup.py', 'pyproject.toml'],
      'java': ['pom.xml', 'build.xml'],
      'kotlin': ['build.gradle.kts'],
      'swift': ['Package.swift', '*.xcodeproj'],
      'react': ['package.json', 'src/index.js', 'src/index.tsx'],
      'vue': ['package.json', 'vue.config.js'],
      'angular': ['package.json', 'angular.json']
    };
  }

  /**
   * 프로젝트 감지
   */
  async detectProject(workingDir = process.cwd()) {
    try {
      logger.info(`프로젝트 감지 시작: ${workingDir}`);
      
      const detectedProjects = [];
      
      // 각 프로젝트 타입별로 감지
      for (const [type, indicators] of Object.entries(this.projectTypes)) {
        const projectPath = await this.detectProjectType(workingDir, type, indicators);
        if (projectPath) {
          detectedProjects.push({
            type: type,
            path: projectPath,
            indicators: indicators
          });
          logger.info(`${type} 프로젝트 감지됨: ${projectPath}`);
        }
      }

      return {
        workingDirectory: workingDir,
        detectedProjects: detectedProjects,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('프로젝트 감지 오류:', error);
      return {
        workingDirectory: workingDir,
        detectedProjects: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 특정 프로젝트 타입 감지
   */
  async detectProjectType(workingDir, type, indicators) {
    try {
      const entries = await fs.readdir(workingDir, { withFileTypes: true });
      
      for (const indicator of indicators) {
        // 와일드카드 패턴 처리
        if (indicator.includes('*')) {
          const pattern = indicator.replace('*', '');
          const matchingFiles = entries.filter(entry => 
            entry.name.includes(pattern)
          );
          if (matchingFiles.length > 0) {
            return workingDir;
          }
        } else {
          // 정확한 파일명 매칭
          const found = entries.find(entry => entry.name === indicator);
          if (found) {
            return workingDir;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 프로젝트 정보 상세 분석
   */
  async analyzeProject(projectPath) {
    try {
      const projectInfo = {
        path: projectPath,
        type: 'unknown',
        name: path.basename(projectPath),
        files: [],
        dependencies: [],
        scripts: []
      };

      // package.json 분석
      try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        projectInfo.type = 'node';
        projectInfo.name = packageJson.name || projectInfo.name;
        projectInfo.dependencies = Object.keys(packageJson.dependencies || {});
        projectInfo.scripts = Object.keys(packageJson.scripts || {});
        
      } catch (error) {
        // package.json이 없는 경우
      }

      // build.gradle 분석
      try {
        const buildGradlePath = path.join(projectPath, 'build.gradle');
        const buildGradleContent = await fs.readFile(buildGradlePath, 'utf-8');
        
        if (buildGradleContent.includes('android')) {
          projectInfo.type = 'android';
        } else if (buildGradleContent.includes('kotlin')) {
          projectInfo.type = 'kotlin';
        }
        
      } catch (error) {
        // build.gradle이 없는 경우
      }

      // 파일 목록 수집
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      projectInfo.files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file'
      }));

      return projectInfo;
      
    } catch (error) {
      logger.error('프로젝트 분석 오류:', error);
      return {
        path: projectPath,
        type: 'unknown',
        error: error.message
      };
    }
  }
}