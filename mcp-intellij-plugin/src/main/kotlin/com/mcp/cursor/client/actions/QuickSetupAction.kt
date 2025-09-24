package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.ui.Messages
import com.mcp.cursor.client.settings.MCPSettings
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*
import java.io.File

/**
 * 빠른 설정 액션
 */
class QuickSetupAction : AnAction("빠른 설정", "MCP 서버를 빠르게 설정합니다", null), DumbAware {
    
    private val logger = thisLogger()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        scope.launch {
            try {
                val settings = MCPSettings.getInstance()
                val mcpservice = MCPService.getInstance(project)
                
                // 현재 프로젝트 경로에서 서버 찾기
                val currentProjectPath = project.basePath
                val possibleServerPaths = mutableListOf<String>()
                
                // 가능한 서버 경로들 찾기
                if (currentProjectPath != null) {
                    val projectDir = File(currentProjectPath)
                    
                    // 현재 프로젝트가 서버 프로젝트인지 확인
                    if (File(projectDir, "src/server.js").exists()) {
                        possibleServerPaths.add(projectDir.absolutePath)
                    }
                    
                    // 상위 디렉토리들 확인
                    var parentDir = projectDir.parentFile
                    repeat(3) { // 최대 3단계 상위까지 확인
                        if (parentDir != null) {
                            if (File(parentDir, "src/server.js").exists()) {
                                possibleServerPaths.add(parentDir.absolutePath)
                            }
                            parentDir = parentDir.parentFile
                        }
                    }
                }
                
                // 기본 경로들 추가
                val defaultPaths = listOf(
                    "/Users/${System.getProperty("user.name")}/Documents/cursor-server",
                    "/Users/${System.getProperty("user.name")}/cursor-server",
                    System.getProperty("user.home") + "/cursor-server"
                )
                
                possibleServerPaths.addAll(defaultPaths)
                
                // 유효한 서버 경로 찾기
                val validServerPath = possibleServerPaths.find { path ->
                    File(path, "src/server.js").exists()
                }
                
                if (validServerPath != null) {
                    // 자동 설정
                    settings.serverPath = validServerPath
                    settings.serverIp = "localhost"
                    settings.serverPort = 3000
                    settings.updateServerUrl()
                    
                    // 연결 테스트
                    val isConnected = mcpservice.testConnection()
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (isConnected) {
                            Messages.showInfoMessage(
                                project,
                                "✅ MCP 서버가 자동으로 설정되었습니다!\n\n" +
                                "📁 서버 경로: $validServerPath\n" +
                                "🌐 서버 URL: ${settings.serverUrl}\n\n" +
                                "이제 AI 채팅을 사용할 수 있습니다!",
                                "빠른 설정 완료"
                            )
                        } else {
                            Messages.showWarningDialog(
                                project,
                                "⚠️ 서버 경로는 설정되었지만 연결에 실패했습니다.\n\n" +
                                "📁 설정된 경로: $validServerPath\n\n" +
                                "서버가 실행 중인지 확인해주세요.",
                                "설정 완료 (연결 실패)"
                            )
                        }
                    }
                } else {
                    // 수동 설정 안내
                    val message = buildString {
                        appendLine("🔧 MCP 서버를 수동으로 설정해주세요.")
                        appendLine()
                        appendLine("📁 **서버 경로 설정 방법:**")
                        appendLine("1. File → Settings → MCP Cursor")
                        appendLine("2. '서버 경로' 필드에 다음 중 하나를 입력:")
                        appendLine()
                        possibleServerPaths.forEach { path ->
                            appendLine("   • $path")
                        }
                        appendLine()
                        appendLine("💡 **팁:** 서버가 설치된 디렉토리의 절대 경로를 입력하세요.")
                    }
                    
                    ApplicationManager.getApplication().invokeLater {
                        Messages.showInfoMessage(
                            project,
                            message,
                            "수동 설정 안내"
                        )
                    }
                }
                
            } catch (e: Exception) {
                logger.error("빠른 설정 오류", e)
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(
                        project,
                        "빠른 설정 중 오류가 발생했습니다: ${e.message}",
                        "오류"
                    )
                }
            }
        }
    }
    
    // dispose 메서드는 AnAction에서 지원하지 않음
}
