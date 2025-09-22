import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { PROJECT_TYPES } from '../types/mcp.js';

const execAsync = promisify(exec);

/**
 * 프로젝트 감지 및 관리 서비스
 */
export class ProjectDetector {
  constructor() {
    this.currentProject = null;
    this.projectCache = new Map();
    this.cacheTimeout = 30000; // 30초 캐시
    this.lastDetectionTime = 0;
  }

  /**
   * 현재 작업 디렉토리에서 프로젝트 감지 (캐시 최적화)
   */
  async detectProject(workingDir = process.cwd()) {
    try {
      // 캐시 확인 (30초 이내면 캐시된 결과 반환)
      const now = Date.now();
      if (this.currentProject && (now - this.lastDetectionTime) < this.cacheTimeout) {
        logger.debug(`캐시된 프로젝트 반환: ${this.currentProject.name}`);
        return this.currentProject;
      }

      logger.info(`프로젝트 감지 시작: ${workingDir}`);

      // Xcode 프로젝트 감지
      const xcodeProject = await this.detectXcodeProject(workingDir);
      if (xcodeProject) {
        this.currentProject = xcodeProject;
        this.lastDetectionTime = now;
        logger.info(`Xcode 프로젝트 감지됨: ${xcodeProject.name} (${xcodeProject.path})`);
        return xcodeProject;
      }

      // Flutter 프로젝트 감지
      const flutterProject = await this.detectFlutterProject(workingDir);
      if (flutterProject) {
        this.currentProject = flutterProject;
        this.lastDetectionTime = now;
        logger.info(`Flutter 프로젝트 감지됨: ${flutterProject.name} (${flutterProject.path})`);
        return flutterProject;
      }

      // Android 프로젝트 감지
      const androidProject = await this.detectAndroidProject(workingDir);
      if (androidProject) {
        this.currentProject = androidProject;
        this.lastDetectionTime = now;
        logger.info(`Android 프로젝트 감지됨: ${androidProject.name} (${androidProject.path})`);
        return androidProject;
      }

      // 프로젝트를 찾지 못한 경우
      logger.warn(`프로젝트를 찾을 수 없음: ${workingDir}`);
      return null;

    } catch (error) {
      logger.error('프로젝트 감지 중 오류:', error);
      return null;
    }
  }

  /**
   * Xcode 프로젝트 감지
   */
  async detectXcodeProject(workingDir) {
    try {
      // 현재 디렉토리에서 .xcodeproj 또는 .xcworkspace 파일 찾기
      const files = await fs.readdir(workingDir);
      const xcodeFiles = files.filter(file => 
        file.endsWith('.xcodeproj') || file.endsWith('.xcworkspace')
      );

      if (xcodeFiles.length > 0) {
        const projectFile = xcodeFiles[0];
        const projectPath = path.join(workingDir, projectFile);
        
        // 프로젝트 정보 수집
        const projectInfo = await this.getXcodeProjectInfo(projectPath);
        
        return {
          type: PROJECT_TYPES.XCODE,
          name: path.basename(projectFile, path.extname(projectFile)),
          path: workingDir,
          projectFile: projectPath,
          ...projectInfo
        };
      }

      // 하위 디렉토리에서 검색
      for (const searchPath of config.projects.xcode.searchPaths) {
        try {
          const projects = await this.findXcodeProjects(searchPath);
          if (projects.length > 0) {
            // 가장 최근에 수정된 프로젝트 선택
            const latestProject = projects.sort((a, b) => 
              new Date(b.lastModified) - new Date(a.lastModified)
            )[0];
            
            return {
              type: PROJECT_TYPES.XCODE,
              name: latestProject.name,
              path: latestProject.path,
              projectFile: latestProject.projectFile,
              ...latestProject
            };
          }
        } catch (error) {
          logger.debug(`검색 경로에서 오류: ${searchPath}`, error.message);
        }
      }

      return null;
    } catch (error) {
      logger.error('Xcode 프로젝트 감지 중 오류:', error);
      return null;
    }
  }

  /**
   * Flutter 프로젝트 감지
   */
  async detectFlutterProject(workingDir) {
    try {
      // 현재 디렉토리에서 Flutter 프로젝트 파일 찾기
      const hasFlutterFiles = await this.hasFlutterFiles(workingDir);
      
      if (hasFlutterFiles) {
        const projectInfo = await this.getFlutterProjectInfo(workingDir);
        
        return {
          type: PROJECT_TYPES.FLUTTER,
          name: path.basename(workingDir),
          path: workingDir,
          ...projectInfo
        };
      }

      // 하위 디렉토리에서 검색
      for (const searchPath of config.projects.flutter.searchPaths) {
        try {
          const projects = await this.findFlutterProjects(searchPath);
          if (projects.length > 0) {
            const latestProject = projects.sort((a, b) => 
              new Date(b.lastModified) - new Date(a.lastModified)
            )[0];
            
            return {
              type: PROJECT_TYPES.FLUTTER,
              name: latestProject.name,
              path: latestProject.path,
              ...latestProject
            };
          }
        } catch (error) {
          logger.debug(`검색 경로에서 오류: ${searchPath}`, error.message);
        }
      }

      return null;
    } catch (error) {
      logger.error('Flutter 프로젝트 감지 중 오류:', error);
      return null;
    }
  }

  /**
   * Android 프로젝트 감지
   */
  async detectAndroidProject(workingDir) {
    try {
      // 현재 디렉토리에서 Android 프로젝트 파일 찾기
      const hasGradleFiles = await this.hasAndroidFiles(workingDir);
      
      if (hasGradleFiles) {
        const projectInfo = await this.getAndroidProjectInfo(workingDir);
        
        return {
          type: PROJECT_TYPES.ANDROID,
          name: path.basename(workingDir),
          path: workingDir,
          ...projectInfo
        };
      }

      // 하위 디렉토리에서 검색
      for (const searchPath of config.projects.android.searchPaths) {
        try {
          const projects = await this.findAndroidProjects(searchPath);
          if (projects.length > 0) {
            const latestProject = projects.sort((a, b) => 
              new Date(b.lastModified) - new Date(a.lastModified)
            )[0];
            
            return {
              type: PROJECT_TYPES.ANDROID,
              name: latestProject.name,
              path: latestProject.path,
              ...latestProject
            };
          }
        } catch (error) {
          logger.debug(`검색 경로에서 오류: ${searchPath}`, error.message);
        }
      }

      return null;
    } catch (error) {
      logger.error('Android 프로젝트 감지 중 오류:', error);
      return null;
    }
  }

  /**
   * Flutter 프로젝트 파일 존재 확인
   */
  async hasFlutterFiles(dir) {
    try {
      const files = await fs.readdir(dir);
      const hasPubspec = files.includes('pubspec.yaml');
      const hasLib = files.includes('lib');
      
      // pubspec.yaml과 lib 디렉토리가 모두 있어야 Flutter 프로젝트로 인식
      return hasPubspec && hasLib;
    } catch {
      return false;
    }
  }

  /**
   * Android 프로젝트 파일 존재 확인
   */
  async hasAndroidFiles(dir) {
    try {
      const files = await fs.readdir(dir);
      return files.some(file => 
        file === 'build.gradle' || 
        file === 'settings.gradle' || 
        file.endsWith('.gradle')
      );
    } catch {
      return false;
    }
  }

  /**
   * Xcode 프로젝트 정보 수집
   */
  async getXcodeProjectInfo(projectFile) {
    try {
      const projectDir = path.dirname(projectFile);
      
      // xcodebuild 명령어로 프로젝트 정보 수집
      const { stdout } = await execAsync(`cd "${projectDir}" && xcodebuild -showBuildSettings -project "${path.basename(projectFile)}" 2>/dev/null || echo ""`);
      
      const buildSettings = this.parseBuildSettings(stdout);
      
      return {
        buildSettings,
        srcRoot: buildSettings.SRCROOT || projectDir,
        projectDir: buildSettings.PROJECT_DIR || projectDir,
        targetName: buildSettings.TARGET_NAME || 'Unknown',
        bundleId: buildSettings.PRODUCT_BUNDLE_IDENTIFIER || 'Unknown'
      };
    } catch (error) {
      logger.debug('Xcode 프로젝트 정보 수집 실패:', error.message);
      return {
        buildSettings: {},
        srcRoot: path.dirname(projectFile),
        projectDir: path.dirname(projectFile),
        targetName: 'Unknown',
        bundleId: 'Unknown'
      };
    }
  }

  /**
   * Flutter 프로젝트 정보 수집
   */
  async getFlutterProjectInfo(projectDir) {
    try {
      // pubspec.yaml 파일 읽기
      const pubspecPath = path.join(projectDir, 'pubspec.yaml');
      let pubspecContent = '';
      
      try {
        pubspecContent = await fs.readFile(pubspecPath, 'utf8');
      } catch {
        logger.debug('pubspec.yaml 파일을 찾을 수 없음');
      }

      // 프로젝트 정보 파싱
      const projectInfo = this.parseFlutterProject(pubspecContent);
      
      return {
        ...projectInfo,
        pubspecPath: pubspecContent ? pubspecPath : null
      };
    } catch (error) {
      logger.debug('Flutter 프로젝트 정보 수집 실패:', error.message);
      return {
        name: 'Unknown',
        version: 'Unknown',
        description: 'Unknown',
        flutterVersion: 'Unknown',
        dependencies: []
      };
    }
  }

  /**
   * Android 프로젝트 정보 수집
   */
  async getAndroidProjectInfo(projectDir) {
    try {
      // build.gradle 파일 읽기
      const buildGradlePath = path.join(projectDir, 'build.gradle');
      let buildGradle = '';
      
      try {
        buildGradle = await fs.readFile(buildGradlePath, 'utf8');
      } catch {
        // build.gradle이 없는 경우 app/build.gradle 시도
        const appBuildGradlePath = path.join(projectDir, 'app', 'build.gradle');
        try {
          buildGradle = await fs.readFile(appBuildGradlePath, 'utf8');
        } catch {
          logger.debug('build.gradle 파일을 찾을 수 없음');
        }
      }

      // 프로젝트 정보 파싱
      const projectInfo = this.parseAndroidProject(buildGradle);
      
      return {
        ...projectInfo,
        buildGradlePath: buildGradle ? buildGradlePath : null
      };
    } catch (error) {
      logger.debug('Android 프로젝트 정보 수집 실패:', error.message);
      return {
        packageName: 'Unknown',
        versionName: 'Unknown',
        versionCode: 'Unknown',
        minSdkVersion: 'Unknown',
        targetSdkVersion: 'Unknown'
      };
    }
  }

  /**
   * Xcode 빌드 설정 파싱
   */
  parseBuildSettings(stdout) {
    const settings = {};
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)$/);
      if (match) {
        settings[match[1]] = match[2].trim();
      }
    }
    
    return settings;
  }

  /**
   * Flutter 프로젝트 정보 파싱
   */
  parseFlutterProject(pubspecContent) {
    const info = {
      name: 'Unknown',
      version: 'Unknown',
      description: 'Unknown',
      flutterVersion: 'Unknown',
      dependencies: []
    };

    if (!pubspecContent) return info;

    const lines = pubspecContent.split('\n');
    let inDependencies = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 프로젝트명 추출
      if (trimmedLine.startsWith('name:')) {
        const nameMatch = trimmedLine.match(/name:\s*(.+)/);
        if (nameMatch) {
          info.name = nameMatch[1].trim();
        }
      }
      
      // 버전 추출
      if (trimmedLine.startsWith('version:')) {
        const versionMatch = trimmedLine.match(/version:\s*(.+)/);
        if (versionMatch) {
          info.version = versionMatch[1].trim();
        }
      }
      
      // 설명 추출
      if (trimmedLine.startsWith('description:')) {
        const descMatch = trimmedLine.match(/description:\s*(.+)/);
        if (descMatch) {
          info.description = descMatch[1].trim();
        }
      }
      
      // Flutter 버전 추출
      if (trimmedLine.startsWith('flutter:')) {
        inDependencies = false;
      }
      
      if (trimmedLine.startsWith('environment:')) {
        inDependencies = false;
      }
      
      if (trimmedLine.startsWith('sdk:')) {
        const sdkMatch = trimmedLine.match(/sdk:\s*(.+)/);
        if (sdkMatch) {
          info.flutterVersion = sdkMatch[1].trim();
        }
      }
      
      // 의존성 추출
      if (trimmedLine === 'dependencies:') {
        inDependencies = true;
        continue;
      }
      
      if (inDependencies && trimmedLine && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t')) {
        inDependencies = false;
      }
      
      if (inDependencies && trimmedLine && (trimmedLine.startsWith(' ') || trimmedLine.startsWith('\t'))) {
        const depMatch = trimmedLine.match(/^\s*([^:]+):\s*(.+)/);
        if (depMatch) {
          info.dependencies.push({
            name: depMatch[1].trim(),
            version: depMatch[2].trim()
          });
        }
      }
    }

    return info;
  }

  /**
   * Android 프로젝트 정보 파싱
   */
  parseAndroidProject(buildGradle) {
    const info = {
      packageName: 'Unknown',
      versionName: 'Unknown',
      versionCode: 'Unknown',
      minSdkVersion: 'Unknown',
      targetSdkVersion: 'Unknown'
    };

    if (!buildGradle) return info;

    // 패키지명 추출
    const packageMatch = buildGradle.match(/namespace\s+['"]([^'"]+)['"]/);
    if (packageMatch) {
      info.packageName = packageMatch[1];
    }

    // 버전 정보 추출
    const versionNameMatch = buildGradle.match(/versionName\s+['"]([^'"]+)['"]/);
    if (versionNameMatch) {
      info.versionName = versionNameMatch[1];
    }

    const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
    if (versionCodeMatch) {
      info.versionCode = versionCodeMatch[1];
    }

    // SDK 버전 추출
    const minSdkMatch = buildGradle.match(/minSdkVersion\s+(\d+)/);
    if (minSdkMatch) {
      info.minSdkVersion = minSdkMatch[1];
    }

    const targetSdkMatch = buildGradle.match(/targetSdkVersion\s+(\d+)/);
    if (targetSdkMatch) {
      info.targetSdkVersion = targetSdkMatch[1];
    }

    return info;
  }

  /**
   * Xcode 프로젝트 검색
   */
  async findXcodeProjects(searchPath) {
    const projects = [];
    
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(searchPath, entry.name);
          const subProjects = await this.findXcodeProjects(subPath);
          projects.push(...subProjects);
        } else if (entry.name.endsWith('.xcodeproj') || entry.name.endsWith('.xcworkspace')) {
          const projectPath = path.join(searchPath, entry.name);
          const stats = await fs.stat(projectPath);
          
          projects.push({
            name: path.basename(entry.name, path.extname(entry.name)),
            path: searchPath,
            projectFile: projectPath,
            lastModified: stats.mtime
          });
        }
      }
    } catch (error) {
      // 권한 오류 등은 무시
    }
    
    return projects;
  }

  /**
   * Flutter 프로젝트 검색
   */
  async findFlutterProjects(searchPath) {
    const projects = [];
    
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(searchPath, entry.name);
          const hasFlutterFiles = await this.hasFlutterFiles(subPath);
          
          if (hasFlutterFiles) {
            const stats = await fs.stat(subPath);
            projects.push({
              name: entry.name,
              path: subPath,
              lastModified: stats.mtime
            });
          }
          
          // 하위 디렉토리도 검색
          const subProjects = await this.findFlutterProjects(subPath);
          projects.push(...subProjects);
        }
      }
    } catch (error) {
      // 권한 오류 등은 무시
    }
    
    return projects;
  }

  /**
   * Android 프로젝트 검색
   */
  async findAndroidProjects(searchPath) {
    const projects = [];
    
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(searchPath, entry.name);
          const hasAndroidFiles = await this.hasAndroidFiles(subPath);
          
          if (hasAndroidFiles) {
            const stats = await fs.stat(subPath);
            projects.push({
              name: entry.name,
              path: subPath,
              lastModified: stats.mtime
            });
          }
          
          // 하위 디렉토리도 검색
          const subProjects = await this.findAndroidProjects(subPath);
          projects.push(...subProjects);
        }
      }
    } catch (error) {
      // 권한 오류 등은 무시
    }
    
    return projects;
  }

  /**
   * 현재 프로젝트 정보 반환
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * 프로젝트 캐시 클리어
   */
  clearCache() {
    this.projectCache.clear();
  }
}

export default ProjectDetector;
