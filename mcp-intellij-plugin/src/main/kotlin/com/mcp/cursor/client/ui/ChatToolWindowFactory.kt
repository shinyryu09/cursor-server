package com.mcp.cursor.client.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.SwingConstants

/**
 * MCP Cursor 채팅 툴 윈도우 팩토리
 */
class ChatToolWindowFactory : ToolWindowFactory {
    
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        try {
            val chatPanel = ChatPanel(project)
            val content = ContentFactory.getInstance().createContent(chatPanel, "MCP Cursor Chat", false)
            toolWindow.contentManager.addContent(content)
        } catch (e: Exception) {
            // 오류 발생 시 기본 UI 표시
            val errorPanel = JLabel("플러그인 로드 중 오류가 발생했습니다. IDE를 재시작해주세요.").apply {
                horizontalAlignment = SwingConstants.CENTER
            }
            val content = ContentFactory.getInstance().createContent(errorPanel, "MCP Cursor Chat", false)
            toolWindow.contentManager.addContent(content)
        }
    }
    
    override fun shouldBeAvailable(project: Project): Boolean = true
}

