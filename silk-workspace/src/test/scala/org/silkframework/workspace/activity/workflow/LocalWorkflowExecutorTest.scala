package org.silkframework.workspace.activity.workflow

import org.scalatest.{FlatSpec, Matchers}
import org.silkframework.config.ConfigTest
import org.silkframework.rule.execution.TransformReport
import org.silkframework.util.ConfigTestTrait
import org.silkframework.workspace.SingleProjectWorkspaceProviderTestTrait
import org.silkframework.workspace.reports.ExecutionReportManager

/**
  * Tests if the workflow report is generated and errors are written to the error output.
  */
class LocalWorkflowExecutorTest extends FlatSpec with Matchers with SingleProjectWorkspaceProviderTestTrait with ConfigTestTrait {

  override def projectPathInClasspath: String = "org/silkframework/workspace/activity/workflow/executionReportTest.zip"

  override def workspaceProviderId: String = "inMemory"

  override def projectId: String = "executionReportTest"

  behavior of "LocalWorkflowExecutor"

  it should "generate a workflow execution report and write errors to the error output." in {
    // Execute workflow
    val workflow = project.task[Workflow]("workflow")
    workflow.activity[LocalWorkflowExecutorGeneratingProvenance].startBlocking()

    // Test if a report has been written
    val executionMgr = ExecutionReportManager()
    val availableReports = executionMgr.listReports(projectId = Some(projectId))
    availableReports should have size 1

    // Retrieve transform report
    val lastReport = executionMgr.retrieveReport(availableReports.last)
    val workflowReport = lastReport.resultValue.get.asInstanceOf[WorkflowExecutionReport]
    val transformReport = workflowReport.taskReports("transform").asInstanceOf[TransformReport]

    // Check if expected errors have been recorded
    transformReport.ruleResults("uri").errorCount shouldBe 1
    transformReport.ruleResults("name").errorCount shouldBe 0
    transformReport.ruleResults("age").errorCount shouldBe 1
    transformReport.ruleResults("city").errorCount shouldBe 0

    // Check if output has been written correctly
    project.resources.get("output.csv").loadLines shouldBe
      Seq(
        "name,age,city",
        "Max Mustermann,40,Berlin",
        "Max Weber,,Leipzig"
      )

    // Check if error output has been written correctly
    project.resources.get("errorOutput.csv").loadLines shouldBe
      Seq(
        "name,age,city,error",
        "Max Weber,,Leipzig,Value 'unknown' is not a valid Int"
      )
  }

  override def propertyMap: Map[String, Option[String]] = {
    Map(
      "workspace.reportManager.plugin" -> Some("inMemory")
    )
  }
}
