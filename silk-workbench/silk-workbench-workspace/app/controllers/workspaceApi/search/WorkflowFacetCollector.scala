package controllers.workspaceApi.search

import controllers.workspaceApi.search.SearchApiModel.Facets
import org.silkframework.runtime.activity.{Status, UserContext}
import org.silkframework.workspace.ProjectTask
import org.silkframework.workspace.activity.workflow.{LocalWorkflowExecutorGeneratingProvenance, Workflow}

/**
  * Facet collector for workflows.
  */
case class WorkflowFacetCollector() extends ItemTypeFacetCollector[Workflow] {
  override val facetCollectors: Seq[FacetCollector[Workflow]] = {
    Seq(
      WorkflowExecutionStatus()
    )
  }
}

/** Facet to filter a workflow by its status. */
case class WorkflowExecutionStatus() extends NoLabelKeywordFacetCollector[Workflow] {

  override def extractKeywordIds(projectTask: ProjectTask[Workflow])
                                (implicit user: UserContext): Set[String] = {
    val executionActivity = projectTask.activity[LocalWorkflowExecutorGeneratingProvenance]
    executionActivity.status.get.toSet map { status: Status =>
      status.concreteStatus
    }
  }

  override def appliesForFacet: SearchApiModel.Facet = Facets.workflowExecutionStatus
}
