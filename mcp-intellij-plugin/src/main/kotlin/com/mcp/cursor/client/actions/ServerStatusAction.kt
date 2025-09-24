package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.ui.Messages
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*

/**
 * 서버 상태 확인 액션
 */
class ServerStatusAction : AnAction("서버 상태 확인", "MCP 서버의 현재 상태를 확인합니다", null), DumbAware {
    
    private val logger = thisLogger()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        scope.launch {
            try {
                val mcpservice = MCPService.getInstance(project)
                
                // 서버 연결 상태 확인
                val isConnected = mcpservice.isConnected()
                val serverUrl = mcpservice.getServerUrl()
                val serverPath = mcpservice.getServerPath()
                val models = mcpservice.getAvailableModels()
                
                val statusMessage = buildString {
                    appendLine("🔍 **MCP 서버 상태 정보**")
                    appendLine()
                    appendLine("📡 **연결 상태:** ${if (isConnected) "✅ 연결됨" else "❌ 연결 안됨"}")
                    appendLine("🌐 **서버 URL:** $serverUrl")
                    appendLine("📁 **서버 경로:** $serverPath")
                    appendLine()
                    appendLine("🤖 **사용 가능한 AI 모델:** ${models.size}개")
                    models.forEach { model ->
                        val status = if (model.available) "✅" else "❌"
                        appendLine("  $status ${model.name} (${model.type})")
                    }
                    appendLine()
                    appendLine("💡 **팁:** 연결 문제가 있다면 설정에서 서버 경로를 확인해주세요.")
                }
                
                ApplicationManager.getApplication().invokeLater {
                    Messages.showInfoMessage(
                        project,
                        statusMessage,
                        "MCP 서버 상태"
                    )
                }
                
            } catch (e: Exception) {
                logger.error("서버 상태 확인 오류", e)
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(
                        project,
                        "서버 상태 확인 중 오류가 발생했습니다: ${e.message}",
                        "오류"
                    )
                }
            }
        }
    }
    
    // dispose 메서드는 AnAction에서 지원하지 않음
}
