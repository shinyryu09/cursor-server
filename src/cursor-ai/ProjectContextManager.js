const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * 프로젝트 컨텍스트 매니저 - 파일 시스템 분석, 의존성 추적, Git 연동, 빌드 시스템 연동
 */
class ProjectContextManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableFileSystemAnalysis: true,
            enableDependencyTracking: true,
            enableGitIntegration: true,
            enableBuildSystemIntegration: true,
            maxFileSize: 1024 * 1024, // 1MB
            ...config
        };

        this.projectCache = new Map();
        this.dependencyCache = new Map();
        this.gitCache = new Map();
        this.buildSystemCache = new Map();
        
        this.isRunning = false;
        this.stats = {
            analyzedProjects: 0,
            cachedFiles: 0,
            trackedDependencies: 0,
            gitRepositories: 0
        };
    }

    /**
     * 프로젝트 컨텍스트 매니저 시작
     */
    async start() {
        try {
            logger.info('프로젝트 컨텍스트 매니저 시작 중...');

            this.isRunning = true;
            logger.info('프로젝트 컨텍스트 매니저가 성공적으로 시작되었습니다');

        } catch (error) {
            logger.error('프로젝트 컨텍스트 매니저 시작 실패:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 분석
     */
    async analyzeProject(projectPath) {
        try {
            logger.debug(`프로젝트 분석 시작: ${projectPath}`);

            // 캐시 확인
            if (this.projectCache.has(projectPath)) {
                const cached = this.projectCache.get(projectPath);
                if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5분 캐시
                    return cached.data;
                }
            }

            const projectInfo = {
                path: projectPath,
                type: await this.detectProjectType(projectPath),
                files: await this.analyzeFileSystem(projectPath),
                dependencies: await this.analyzeDependencies(projectPath),
                git: await this.analyzeGitRepository(projectPath),
                buildSystem: await this.analyzeBuildSystem(projectPath),
                timestamp: new Date()
            };

            // 캐시 저장
            this.projectCache.set(projectPath, {
                data: projectInfo,
                timestamp: Date.now()
            });

            this.stats.analyzedProjects++;
            logger.debug(`프로젝트 분석 완료: ${projectPath} (${projectInfo.type})`);

            return projectInfo;

        } catch (error) {
            logger.error(`프로젝트 분석 오류: ${projectPath}`, error);
            throw error;
        }
    }

    /**
     * 프로젝트 타입 감지
     */
    async detectProjectType(projectPath) {
        try {
            const files = await fs.readdir(projectPath);
            
            // Xcode 프로젝트
            if (files.some(file => file.endsWith('.xcodeproj') || file.endsWith('.xcworkspace'))) {
                return 'xcode';
            }
            
            // Android 프로젝트
            if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
                return 'android';
            }
            
            // Node.js 프로젝트
            if (files.includes('package.json')) {
                return 'nodejs';
            }
            
            // Python 프로젝트
            if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
                return 'python';
            }
            
            // Java 프로젝트
            if (files.includes('pom.xml') || files.includes('build.xml')) {
                return 'java';
            }
            
            // C# 프로젝트
            if (files.some(file => file.endsWith('.csproj') || file.endsWith('.sln'))) {
                return 'csharp';
            }
            
            // Go 프로젝트
            if (files.includes('go.mod') || files.includes('go.sum')) {
                return 'go';
            }
            
            // Rust 프로젝트
            if (files.includes('Cargo.toml') || files.includes('Cargo.lock')) {
                return 'rust';
            }
            
            return 'unknown';
            
        } catch (error) {
            logger.error(`프로젝트 타입 감지 오류: ${projectPath}`, error);
            return 'unknown';
        }
    }

    /**
     * 파일 시스템 분석
     */
    async analyzeFileSystem(projectPath) {
        if (!this.config.enableFileSystemAnalysis) {
            return { files: [], directories: [] };
        }

        try {
            const files = [];
            const directories = [];
            
            await this.scanDirectory(projectPath, files, directories, projectPath);
            
            this.stats.cachedFiles += files.length;
            
            return {
                files: files.slice(0, 1000), // 최대 1000개 파일만 반환
                directories: directories.slice(0, 100), // 최대 100개 디렉토리만 반환
                totalFiles: files.length,
                totalDirectories: directories.length
            };
            
        } catch (error) {
            logger.error(`파일 시스템 분석 오류: ${projectPath}`, error);
            return { files: [], directories: [] };
        }
    }

    /**
     * 디렉토리 스캔
     */
    async scanDirectory(dirPath, files, directories, rootPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(rootPath, fullPath);
                
                // 숨김 파일/디렉토리 제외
                if (entry.name.startsWith('.')) {
                    continue;
                }
                
                // node_modules, .git 등 제외
                if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'build') {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    directories.push({
                        name: entry.name,
                        path: relativePath,
                        fullPath: fullPath
                    });
                    
                    // 재귀적으로 하위 디렉토리 스캔 (최대 3단계)
                    if (relativePath.split(path.sep).length < 3) {
                        await this.scanDirectory(fullPath, files, directories, rootPath);
                    }
                } else {
                    const stat = await fs.stat(fullPath);
                    
                    // 파일 크기 제한
                    if (stat.size > this.config.maxFileSize) {
                        continue;
                    }
                    
                    files.push({
                        name: entry.name,
                        path: relativePath,
                        fullPath: fullPath,
                        size: stat.size,
                        extension: path.extname(entry.name),
                        modified: stat.mtime
                    });
                }
            }
            
        } catch (error) {
            logger.error(`디렉토리 스캔 오류: ${dirPath}`, error);
        }
    }

    /**
     * 의존성 분석
     */
    async analyzeDependencies(projectPath) {
        if (!this.config.enableDependencyTracking) {
            return { dependencies: [], devDependencies: [] };
        }

        try {
            const projectType = await this.detectProjectType(projectPath);
            
            switch (projectType) {
                case 'nodejs':
                    return await this.analyzeNodeJSDependencies(projectPath);
                case 'python':
                    return await this.analyzePythonDependencies(projectPath);
                case 'java':
                    return await this.analyzeJavaDependencies(projectPath);
                case 'android':
                    return await this.analyzeAndroidDependencies(projectPath);
                case 'xcode':
                    return await this.analyzeXcodeDependencies(projectPath);
                default:
                    return { dependencies: [], devDependencies: [] };
            }
            
        } catch (error) {
            logger.error(`의존성 분석 오류: ${projectPath}`, error);
            return { dependencies: [], devDependencies: [] };
        }
    }

    /**
     * Node.js 의존성 분석
     */
    async analyzeNodeJSDependencies(projectPath) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            return {
                dependencies: Object.keys(packageJson.dependencies || {}),
                devDependencies: Object.keys(packageJson.devDependencies || {}),
                scripts: packageJson.scripts || {},
                engines: packageJson.engines || {}
            };
            
        } catch (error) {
            logger.error(`Node.js 의존성 분석 오류: ${projectPath}`, error);
            return { dependencies: [], devDependencies: [] };
        }
    }

    /**
     * Python 의존성 분석
     */
    async analyzePythonDependencies(projectPath) {
        try {
            const requirementsPath = path.join(projectPath, 'requirements.txt');
            const requirements = await fs.readFile(requirementsPath, 'utf8');
            
            return {
                dependencies: requirements.split('\n')
                    .filter(line => line.trim() && !line.startsWith('#'))
                    .map(line => line.split('==')[0].split('>=')[0].split('<=')[0]),
                devDependencies: []
            };
            
        } catch (error) {
            logger.error(`Python 의존성 분석 오류: ${projectPath}`, error);
            return { dependencies: [], devDependencies: [] };
        }
    }

    /**
     * Java 의존성 분석
     */
    async analyzeJavaDependencies(projectPath) {
        try {
            const pomPath = path.join(projectPath, 'pom.xml');
            const pomContent = await fs.readFile(pomPath, 'utf8');
            
            // 간단한 XML 파싱 (실제 구현에서는 XML 파서 사용)
            const dependencies = [];
            const dependencyMatches = pomContent.match(/<dependency>[\s\S]*?<\/dependency>/g);
            
            if (dependencyMatches) {
                for (const match of dependencyMatches) {
                    const groupIdMatch = match.match(/<groupId>(.*?)<\/groupId>/);
                    const artifactIdMatch = match.match(/<artifactId>(.*?)<\/artifactId>/);
                    
                    if (groupIdMatch && artifactIdMatch) {
                        dependencies.push(`${groupIdMatch[1]}:${artifactIdMatch[1]}`);
                    }
                }
            }
            
            return {
                dependencies,
                devDependencies: []
            };
            
        } catch (error) {
            logger.error(`Java 의존성 분석 오류: ${projectPath}`, error);
            return { dependencies: [], devDependencies: [] };
        }
    }

    /**
     * Android 의존성 분석
     */
    async analyzeAndroidDependencies(projectPath) {
        try {
            const buildGradlePath = path.join(projectPath, 'build.gradle');
            const buildGradle = await fs.readFile(buildGradlePath, 'utf8');
            
            // 간단한 Gradle 파싱
            const dependencies = [];
            const dependencyMatches = buildGradle.match(/implementation\s+['"](.*?)['"]/g);
            
            if (dependencyMatches) {
                for (const match of dependencyMatches) {
                    const dep = match.match(/['"](.*?)['"]/)[1];
                    dependencies.push(dep);
                }
            }
            
            return {
                dependencies,
                devDependencies: []
            };
            
        } catch (error) {
            logger.error(`Android 의존성 분석 오류: ${projectPath}`, error);
            return { dependencies: [], devDependencies: [] };
        }
    }

    /**
     * Xcode 의존성 분석
     */
    async analyzeXcodeDependencies(projectPath) {
        try {
            // Xcode 프로젝트의 경우 Podfile 또는 Package.swift 확인
            const podfilePath = path.join(projectPath, 'Podfile');
            const packageSwiftPath = path.join(projectPath, 'Package.swift');
            
            if (await this.fileExists(podfilePath)) {
                const podfile = await fs.readFile(podfilePath, 'utf8');
                const dependencies = [];
                const podMatches = podfile.match(/pod\s+['"](.*?)['"]/g);
                
                if (podMatches) {
                    for (const match of podMatches) {
                        const dep = match.match(/['"](.*?)['"]/)[1];
                        dependencies.push(dep);
                    }
                }
                
                return {
                    dependencies,
                    devDependencies: []
                };
            }
            
            if (await this.fileExists(packageSwiftPath)) {
                const packageSwift = await fs.readFile(packageSwiftPath, 'utf8');
                const dependencies = [];
                const packageMatches = packageSwift.match(/\.package\(url:\s*["'](.*?)["']/g);
                
                if (packageMatches) {
                    for (const match of packageMatches) {
                        const dep = match.match(/["'](.*?)["']/)[1];
                        dependencies.push(dep);
                    }
                }
                
                return {
                    dependencies,
                    devDependencies: []
                };
            }
            
            return { dependencies: [], devDependencies: [] };
            
        } catch (error) {
            logger.error(`Xcode 의존성 분석 오류: ${projectPath}`, error);
            return { dependencies: [], devDependencies: [] };
        }
    }

    /**
     * Git 저장소 분석
     */
    async analyzeGitRepository(projectPath) {
        if (!this.config.enableGitIntegration) {
            return null;
        }

        try {
            const gitPath = path.join(projectPath, '.git');
            
            if (!(await this.fileExists(gitPath))) {
                return null;
            }
            
            // Git 정보 수집
            const gitInfo = {
                isGitRepository: true,
                branch: await this.getGitBranch(projectPath),
                remote: await this.getGitRemote(projectPath),
                lastCommit: await this.getLastCommit(projectPath),
                status: await this.getGitStatus(projectPath)
            };
            
            this.stats.gitRepositories++;
            return gitInfo;
            
        } catch (error) {
            logger.error(`Git 저장소 분석 오류: ${projectPath}`, error);
            return null;
        }
    }

    /**
     * Git 브랜치 조회
     */
    async getGitBranch(projectPath) {
        try {
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec('git branch --show-current', { cwd: projectPath }, (error, stdout) => {
                    resolve(error ? 'unknown' : stdout.trim());
                });
            });
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Git 원격 저장소 조회
     */
    async getGitRemote(projectPath) {
        try {
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec('git remote get-url origin', { cwd: projectPath }, (error, stdout) => {
                    resolve(error ? null : stdout.trim());
                });
            });
        } catch (error) {
            return null;
        }
    }

    /**
     * 마지막 커밋 정보 조회
     */
    async getLastCommit(projectPath) {
        try {
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec('git log -1 --pretty=format:"%H|%s|%an|%ad"', { cwd: projectPath }, (error, stdout) => {
                    if (error) {
                        resolve(null);
                    } else {
                        const [hash, message, author, date] = stdout.split('|');
                        resolve({ hash, message, author, date });
                    }
                });
            });
        } catch (error) {
            return null;
        }
    }

    /**
     * Git 상태 조회
     */
    async getGitStatus(projectPath) {
        try {
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec('git status --porcelain', { cwd: projectPath }, (error, stdout) => {
                    if (error) {
                        resolve({ modified: [], added: [], deleted: [] });
                    } else {
                        const lines = stdout.split('\n').filter(line => line.trim());
                        const modified = [];
                        const added = [];
                        const deleted = [];
                        
                        for (const line of lines) {
                            const status = line.substring(0, 2);
                            const file = line.substring(3);
                            
                            if (status.includes('M')) modified.push(file);
                            if (status.includes('A')) added.push(file);
                            if (status.includes('D')) deleted.push(file);
                        }
                        
                        resolve({ modified, added, deleted });
                    }
                });
            });
        } catch (error) {
            return { modified: [], added: [], deleted: [] };
        }
    }

    /**
     * 빌드 시스템 분석
     */
    async analyzeBuildSystem(projectPath) {
        if (!this.config.enableBuildSystemIntegration) {
            return null;
        }

        try {
            const projectType = await this.detectProjectType(projectPath);
            
            switch (projectType) {
                case 'nodejs':
                    return await this.analyzeNodeJSBuildSystem(projectPath);
                case 'android':
                    return await this.analyzeAndroidBuildSystem(projectPath);
                case 'xcode':
                    return await this.analyzeXcodeBuildSystem(projectPath);
                default:
                    return null;
            }
            
        } catch (error) {
            logger.error(`빌드 시스템 분석 오류: ${projectPath}`, error);
            return null;
        }
    }

    /**
     * Node.js 빌드 시스템 분석
     */
    async analyzeNodeJSBuildSystem(projectPath) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            return {
                type: 'npm',
                scripts: packageJson.scripts || {},
                engines: packageJson.engines || {},
                buildCommand: packageJson.scripts?.build || 'npm run build',
                testCommand: packageJson.scripts?.test || 'npm test'
            };
            
        } catch (error) {
            logger.error(`Node.js 빌드 시스템 분석 오류: ${projectPath}`, error);
            return null;
        }
    }

    /**
     * Android 빌드 시스템 분석
     */
    async analyzeAndroidBuildSystem(projectPath) {
        try {
            const buildGradlePath = path.join(projectPath, 'build.gradle');
            const buildGradle = await fs.readFile(buildGradlePath, 'utf8');
            
            return {
                type: 'gradle',
                buildCommand: './gradlew build',
                testCommand: './gradlew test',
                cleanCommand: './gradlew clean'
            };
            
        } catch (error) {
            logger.error(`Android 빌드 시스템 분석 오류: ${projectPath}`, error);
            return null;
        }
    }

    /**
     * Xcode 빌드 시스템 분석
     */
    async analyzeXcodeBuildSystem(projectPath) {
        try {
            return {
                type: 'xcodebuild',
                buildCommand: 'xcodebuild -scheme YourScheme -configuration Debug',
                testCommand: 'xcodebuild test -scheme YourScheme -configuration Debug',
                cleanCommand: 'xcodebuild clean -scheme YourScheme'
            };
            
        } catch (error) {
            logger.error(`Xcode 빌드 시스템 분석 오류: ${projectPath}`, error);
            return null;
        }
    }

    /**
     * 파일 존재 확인
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 프로젝트 컨텍스트 매니저 통계 조회
     */
    getStats() {
        return {
            ...this.stats,
            cachedProjects: this.projectCache.size,
            cachedDependencies: this.dependencyCache.size,
            cachedGitRepositories: this.gitCache.size,
            cachedBuildSystems: this.buildSystemCache.size
        };
    }

    /**
     * 프로젝트 컨텍스트 매니저 중지
     */
    async stop() {
        try {
            logger.info('프로젝트 컨텍스트 매니저 중지 중...');

            this.isRunning = false;

            // 캐시 정리
            this.projectCache.clear();
            this.dependencyCache.clear();
            this.gitCache.clear();
            this.buildSystemCache.clear();

            logger.info('프로젝트 컨텍스트 매니저가 중지되었습니다');

        } catch (error) {
            logger.error('프로젝트 컨텍스트 매니저 중지 오류:', error);
            throw error;
        }
    }
}

module.exports = ProjectContextManager;
