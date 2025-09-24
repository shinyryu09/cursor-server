#!/usr/bin/env node

/**
 * 플러그인 버전 관리 스크립트
 * 플러그인의 독립적인 버전을 관리합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// 파일 경로
const serverPackageJson = path.join(projectRoot, 'package.json');
const pluginBuildGradle = path.join(projectRoot, 'mcp-intellij-plugin', 'build.gradle.kts');
const pluginXml = path.join(projectRoot, 'mcp-intellij-plugin', 'src', 'main', 'resources', 'META-INF', 'plugin.xml');

/**
 * 서버 버전 가져오기
 */
function getServerVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(serverPackageJson, 'utf8'));
        return packageJson.version;
    } catch (error) {
        console.error('❌ 서버 버전을 읽을 수 없습니다:', error.message);
        process.exit(1);
    }
}

/**
 * 플러그인 버전 가져오기
 */
function getPluginVersion() {
    try {
        const buildGradleContent = fs.readFileSync(pluginBuildGradle, 'utf8');
        const versionMatch = buildGradleContent.match(/version\s*=\s*["']([^"']+)["']/);
        return versionMatch ? versionMatch[1] : null;
    } catch (error) {
        console.error('❌ 플러그인 버전을 읽을 수 없습니다:', error.message);
        process.exit(1);
    }
}

/**
 * 플러그인 버전 업데이트
 */
function updatePluginVersion(newVersion) {
    try {
        // build.gradle.kts 업데이트
        let buildGradleContent = fs.readFileSync(pluginBuildGradle, 'utf8');
        buildGradleContent = buildGradleContent.replace(
            /version\s*=\s*["'][^"']+["']/,
            `version = "${newVersion}"`
        );
        fs.writeFileSync(pluginBuildGradle, buildGradleContent);
        
        // plugin.xml 업데이트
        let pluginXmlContent = fs.readFileSync(pluginXml, 'utf8');
        pluginXmlContent = pluginXmlContent.replace(
            /<version>[^<]+<\/version>/,
            `<version>${newVersion}</version>`
        );
        fs.writeFileSync(pluginXml, pluginXmlContent);
        
        console.log(`✅ 플러그인 버전이 ${newVersion}으로 업데이트되었습니다.`);
    } catch (error) {
        console.error('❌ 플러그인 버전 업데이트 실패:', error.message);
        process.exit(1);
    }
}

/**
 * 버전 정보 표시
 */
function showVersionInfo() {
    const serverVersion = getServerVersion();
    const pluginVersion = getPluginVersion();
    
    console.log('📊 버전 정보');
    console.log('==================================================');
    console.log(`서버 버전: ${serverVersion}`);
    console.log(`플러그인 버전: ${pluginVersion}`);
    console.log(`관리 방식: 독립적 버전 관리`);
    console.log('==================================================');
}

/**
 * 버전 동기화 (서버 버전으로 플러그인 버전 설정)
 */
function syncVersions() {
    const serverVersion = getServerVersion();
    const pluginVersion = getPluginVersion();
    
    if (serverVersion === pluginVersion) {
        console.log('✅ 플러그인 버전이 서버 버전과 동일합니다.');
        return;
    }
    
    console.log(`🔄 플러그인 버전을 ${pluginVersion}에서 ${serverVersion}으로 동기화합니다...`);
    updatePluginVersion(serverVersion);
}

/**
 * 플러그인 버전 증가 (패치)
 */
function incrementPatch() {
    const pluginVersion = getPluginVersion();
    const [major, minor, patch] = pluginVersion.split('.').map(Number);
    const newVersion = `${major}.${minor}.${patch + 1}`;
    
    console.log(`🔄 플러그인 버전을 ${pluginVersion}에서 ${newVersion}으로 증가합니다...`);
    
    // 플러그인 버전 업데이트
    updatePluginVersion(newVersion);
    
    console.log(`✅ 플러그인 버전이 ${newVersion}으로 업데이트되었습니다.`);
}

/**
 * 플러그인 버전 증가 (마이너)
 */
function incrementMinor() {
    const pluginVersion = getPluginVersion();
    const [major, minor, patch] = pluginVersion.split('.').map(Number);
    const newVersion = `${major}.${minor + 1}.0`;
    
    console.log(`🔄 플러그인 버전을 ${pluginVersion}에서 ${newVersion}으로 증가합니다...`);
    
    // 플러그인 버전 업데이트
    updatePluginVersion(newVersion);
    
    console.log(`✅ 플러그인 버전이 ${newVersion}으로 업데이트되었습니다.`);
}

/**
 * 플러그인 버전 증가 (메이저)
 */
function incrementMajor() {
    const pluginVersion = getPluginVersion();
    const [major, minor, patch] = pluginVersion.split('.').map(Number);
    const newVersion = `${major + 1}.0.0`;
    
    console.log(`🔄 플러그인 버전을 ${pluginVersion}에서 ${newVersion}으로 증가합니다...`);
    
    // 플러그인 버전 업데이트
    updatePluginVersion(newVersion);
    
    console.log(`✅ 플러그인 버전이 ${newVersion}으로 업데이트되었습니다.`);
}

/**
 * 메인 함수
 */
function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'info':
        case '--info':
            showVersionInfo();
            break;
            
        case 'sync':
        case '--sync':
            syncVersions();
            break;
            
        case 'patch':
        case '--patch':
            incrementPatch();
            break;
            
        case 'minor':
        case '--minor':
            incrementMinor();
            break;
            
        case 'major':
        case '--major':
            incrementMajor();
            break;
            
        default:
            console.log('🔧 플러그인 버전 관리 도구');
            console.log('==================================================');
            console.log('사용법: node scripts/plugin-version.js [명령어]');
            console.log('');
            console.log('명령어:');
            console.log('  info, --info     버전 정보 표시');
            console.log('  sync, --sync     서버 버전으로 플러그인 버전 동기화');
            console.log('  patch, --patch   플러그인 패치 버전 증가 (1.0.0 → 1.0.1)');
            console.log('  minor, --minor   플러그인 마이너 버전 증가 (1.0.0 → 1.1.0)');
            console.log('  major, --major   플러그인 메이저 버전 증가 (1.0.0 → 2.0.0)');
            console.log('');
            console.log('예시:');
            console.log('  node scripts/plugin-version.js info');
            console.log('  node scripts/plugin-version.js sync');
            console.log('  node scripts/plugin-version.js patch');
            break;
    }
}

main();
