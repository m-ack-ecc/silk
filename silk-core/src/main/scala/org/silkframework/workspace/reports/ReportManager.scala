package org.silkframework.workspace.reports

import java.util.logging.Logger

import org.silkframework.config.DefaultConfig
import org.silkframework.execution.ExecutionReport
import org.silkframework.runtime.plugin.{AnyPlugin, PluginRegistry}
import org.silkframework.util.Identifier

trait ReportManager extends AnyPlugin {

  def retrieveReports(projectId: Identifier, taskId: Identifier): Seq[ExecutionReport]

  def addReport(projectId: Identifier, taskId: Identifier, report: ExecutionReport): Unit

}

case class EmptyReportManager() extends ReportManager {

  override def retrieveReports(projectId: Identifier, taskId: Identifier): Seq[ExecutionReport] = Seq.empty

  override def addReport(projectId: Identifier, taskId: Identifier, report: ExecutionReport): Unit = { }
}

object ReportManager {

  private val log = Logger.getLogger(getClass.getName)

  private lazy val instance: ReportManager = {
    val config = DefaultConfig.instance()
    if (config.hasPath("workspace.reportManager")) {
      val repository = PluginRegistry.createFromConfig[ReportManager]("workspace.reportManager")
      log.info("Using configured report manager " + config.getString("workspace.reportManager.plugin"))
      repository
    } else {
      log.info("No report manager configured at configuration path 'workspace.reportManager.*'. No reports will be persistet.")
      EmptyReportManager()
    }
  }

  def apply(): ReportManager = instance

}
