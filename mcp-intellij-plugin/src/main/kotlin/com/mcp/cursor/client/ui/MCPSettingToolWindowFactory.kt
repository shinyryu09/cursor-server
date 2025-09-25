package com.mcp.cursor.client.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * MCP 설정 툴 윈도우 팩토리
 */
class MCPSettingToolWindowFactory : ToolWindowFactory {
    
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        try {
            val settingPanel = MCPSettingPanel(project)
            val content = ContentFactory.getInstance().createContent(settingPanel, "", false)
            toolWindow.contentManager.addContent(content)
        } catch (e: Exception) {
            // 오류 발생 시 빈 패널 표시
            val errorPanel = javax.swing.JPanel().apply {
                add(javax.swing.JLabel("설정 패널을 로드할 수 없습니다: ${e.message}"))
            }
            val content = ContentFactory.getInstance().createContent(errorPanel, "", false)
            toolWindow.contentManager.addContent(content)
        }
    }
}
