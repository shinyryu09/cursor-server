package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ui.components.JBTextArea
import com.intellij.util.ui.JBUI
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*
import javax.swing.*

/**
 * AI 코드 분석 액션
 */
class AnalyzeCodeAction : AnAction() {
    
    private val logger = thisLogger()
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val document = editor.document
        
        val mcpservice = MCPService.getInstance(project)
        
        // 선택된 텍스트 또는 전체 파일
        val selectedText = editor.selectionModel.selectedText
        val codeToAnalyze = selectedText ?: document.text
        
        if (codeToAnalyze.isBlank()) {
            Messages.showWarningDialog(project, "분석할 코드를 선택하거나 파일을 열어주세요.", "경고")
            return
        }
        
        // 분석 유형 선택 다이얼로그
        val analysisTypes = arrayOf(
            "코드 품질",
            "성능 최적화",
            "보안 검토",
            "리팩토링 제안",
            "버그 검사",
            "일반 분석"
        )
        
        val selectedType = Messages.showEditableChooseDialog(
            "분석 유형을 선택하세요:",
            "코드 분석",
            Messages.getQuestionIcon(),
            analysisTypes,
            analysisTypes[0],
            null
        )
        
        if (selectedType == null) return
        
        // 모델 선택 다이얼로그
        val models = mcpservice.getAvailableModels().filter { it.available }
        if (models.isEmpty()) {
            Messages.showErrorDialog(project, "사용 가능한 AI 모델이 없습니다.", "오류")
            return
        }
        
        val modelNames = models.map { it.name }.toTypedArray()
        val selectedModel = Messages.showEditableChooseDialog(
            "사용할 AI 모델을 선택하세요:",
            "모델 선택",
            Messages.getQuestionIcon(),
            modelNames,
            modelNames[0],
            null
        )
        
        if (selectedModel == null) return
        
        val modelId = models.find { it.name == selectedModel }?.id ?: return
        
        // 코드 분석 실행
        analyzeCode(project, codeToAnalyze, selectedType, modelId)
    }
    
    private fun analyzeCode(
        project: com.intellij.openapi.project.Project,
        code: String,
        analysisType: String,
        model: String
    ) {
        val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
        val mcpservice = MCPService.getInstance(project)
        
        scope.launch {
            try {
                // 로딩 다이얼로그 표시
                ProgressManager.getInstance().run(
                    object : Task.Backgroundable(project, "코드 분석 중", true) {
                        override fun run(indicator: com.intellij.openapi.progress.ProgressIndicator) {
                            // 백그라운드 작업
                        }
                    }
                )
                
                // AI 코드 분석 요청
                val prompt = "다음 코드를 ${analysisType} 관점에서 분석해주세요:\n\n$code"
                val analysis = withContext(Dispatchers.IO) {
                    mcpservice.sendChatMessage(prompt, model)
                }
                
                // 진행률 다이얼로그는 자동으로 닫힘
                
                // 분석 결과 표시
                ApplicationManager.getApplication().invokeLater {
                    showAnalysisResult(project, analysis, analysisType)
                }
                
            } catch (e: Exception) {
                logger.error("코드 분석 오류", e)
                Messages.showErrorDialog(
                    project,
                    "코드 분석 중 오류가 발생했습니다: ${e.message}",
                    "오류"
                )
            }
        }
    }
    
    private fun showAnalysisResult(
        project: com.intellij.openapi.project.Project,
        analysis: String,
        analysisType: String
    ) {
        val dialog = JDialog(project.getComponent(com.intellij.openapi.wm.WindowManager::class.java)?.getFrame(project))
        dialog.title = "코드 분석 결과 - $analysisType"
        dialog.isModal = true
        dialog.defaultCloseOperation = JDialog.DISPOSE_ON_CLOSE
        dialog.setSize(800, 600)
        dialog.setLocationRelativeTo(null)
        
        val mainPanel = JPanel(java.awt.BorderLayout())
        
        // 상단 패널
        val topPanel = JPanel().apply {
            add(JLabel("분석 유형: $analysisType"))
        }
        
        // 중간 패널 (분석 결과)
        val analysisArea = JBTextArea().apply {
            text = analysis
            isEditable = false
            lineWrap = true
            wrapStyleWord = true
            font = font.deriveFont(14f)
        }
        
        val scrollPane = JScrollPane(analysisArea).apply {
            verticalScrollBarPolicy = JScrollPane.VERTICAL_SCROLLBAR_ALWAYS
        }
        
        // 하단 패널
        val bottomPanel = JPanel().apply {
            add(JButton("닫기").apply {
                addActionListener { dialog.dispose() }
            })
            add(JButton("복사").apply {
                addActionListener {
                    val clipboard = java.awt.Toolkit.getDefaultToolkit().systemClipboard
                    val stringSelection = java.awt.datatransfer.StringSelection(analysis)
                    clipboard.setContents(stringSelection, null)
                    Messages.showInfoMessage(project, "분석 결과가 클립보드에 복사되었습니다.", "복사 완료")
                }
            })
        }
        
        mainPanel.add(topPanel, java.awt.BorderLayout.NORTH)
        mainPanel.add(scrollPane, java.awt.BorderLayout.CENTER)
        mainPanel.add(bottomPanel, java.awt.BorderLayout.SOUTH)
        
        dialog.add(mainPanel)
        dialog.isVisible = true
    }
    
    override fun update(e: AnActionEvent) {
        val project = e.project
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = project != null && editor != null
    }
}

