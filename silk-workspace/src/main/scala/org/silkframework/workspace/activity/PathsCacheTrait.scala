package org.silkframework.workspace.activity

import org.silkframework.config.{Prefixes, TaskSpec}
import org.silkframework.dataset.{DataSource, Dataset, DatasetSpec, SparqlRestrictionDataSource}
import org.silkframework.entity.Restriction.CustomOperator
import org.silkframework.entity.paths.TypedPath
import org.silkframework.entity.rdf.{SparqlEntitySchema, SparqlRestriction}
import org.silkframework.rule.DatasetSelection
import org.silkframework.runtime.activity.{ActivityContext, UserContext}
import org.silkframework.util.Identifier
import org.silkframework.workspace.Project

/**
  * Defines methods useful to all paths caches.
  */
trait PathsCacheTrait {

  protected def maxDepth: Int = 1

  protected def maxPaths: Option[Int] = None

  protected def retrievePathsOfInput(inputTaskId: Identifier,
                                     dataSelection: Option[DatasetSelection],
                                     project: Project,
                                     context: ActivityContext[_])
                                    (implicit userContext: UserContext, prefixes: Prefixes): IndexedSeq[TypedPath] = {
    project.anyTask(inputTaskId).data match {
      case dataset: DatasetSpec[Dataset] =>
        context.status.update("Retrieving frequent paths", 0.0)
        dataSelection match {
          case Some(selection) =>
            retrievePaths(dataset.source, selection)
          case None => IndexedSeq()
        }
      case task: TaskSpec =>
        task.outputSchemaOpt match {
          case Some(schema) =>
            schema.typedPaths
          case None =>
            IndexedSeq()
        }
    }
  }

  private def retrievePaths(dataSource: DataSource, datasetSelection: DatasetSelection)
                           (implicit userContext: UserContext, prefixes: Prefixes): IndexedSeq[TypedPath] = {
    dataSource match {
      case DatasetSpec.DataSourceWrapper(ds: SparqlRestrictionDataSource, _) =>
        val typeRestriction = SparqlRestriction.forType(datasetSelection.typeUri)
        val sparqlRestriction = datasetSelection.restriction.operator match {
          case Some(CustomOperator(sparqlExpression)) =>
            SparqlRestriction.fromSparql(SparqlEntitySchema.variable, sparqlExpression).merge(typeRestriction)
          case _ =>
            typeRestriction
        }
        ds.retrievePathsSparqlRestriction(sparqlRestriction, maxPaths)
      case source: DataSource =>
        // Retrieve most frequent paths
        source.retrievePaths(datasetSelection.typeUri, maxDepth, maxPaths)
    }
  }
}
