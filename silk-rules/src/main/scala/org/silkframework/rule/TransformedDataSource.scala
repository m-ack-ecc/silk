package org.silkframework.rule

import org.silkframework.config.{Prefixes, Task}
import org.silkframework.dataset.{DataSource, Dataset, DatasetSpec}
import org.silkframework.entity.EntitySchema
import org.silkframework.entity.paths.TypedPath
import org.silkframework.execution.EntityHolder
import org.silkframework.execution.local.{EmptyEntityTable, GenericEntityTable}
import org.silkframework.rule.execution.TransformReport
import org.silkframework.rule.execution.local.TransformedEntities
import org.silkframework.runtime.activity.{ActivityMonitor, UserContext}
import org.silkframework.util.Uri

/**
  * A data source that transforms all entities using a provided transformation.
  *
  * @param source        The data source for retrieving the source entities.
  * @param transformRule The transformation
  */
class TransformedDataSource(source: DataSource, inputSchema: EntitySchema, transformRule: TransformRule, task: Task[TransformSpec]) extends DataSource {
  /**
    * Retrieves known generated types in this source.
    *
    * @param limit Restricts the number of types to be retrieved. No effect on this data source.
    */
  override def retrieveTypes(limit: Option[Int] = None)
                            (implicit userContext: UserContext, prefixes: Prefixes): Traversable[(String, Double)] = {
    for(TypeMapping(_, typeUri, _) <- transformRule.rules.typeRules) yield {
      (typeUri.toString, 1.0)
    }
  }

  /**
    * Retrieves all paths generated by this source.
    *
    * @param t The entity type for which paths shall be retrieved. No effect on this data source.
    * @param depth Only retrieve paths up to a certain length. No effect on this data source as all paths are of length one.
    * @param limit Restricts the number of paths to be retrieved. No effect on this data source.
    */
  override def retrievePaths(t: Uri, depth: Int = 1, limit: Option[Int] = None)
                            (implicit userContext: UserContext, prefixes: Prefixes): IndexedSeq[TypedPath] = {
    transformRule.rules.allRules.flatMap(_.target).map(_.asTypedPath()).distinct.toIndexedSeq
  }

  /**
    * Retrieves entities from this source which satisfy a specific entity schema.
    *
    * @param entitySchema The entity schema
    * @param limit        Limits the maximum number of retrieved entities
    * @return A Traversable over the entities. The evaluation of the Traversable may be non-strict.
    */
  override def retrieve(entitySchema: EntitySchema, limit: Option[Int])
                       (implicit userContext: UserContext, prefixes: Prefixes): EntityHolder = {
    val sourceEntities = source.retrieve(inputSchema, limit).entities
    val taskContext = new ActivityMonitor[TransformReport](task.id, None)
    val transformedEntities = new TransformedEntities(task, sourceEntities, transformRule.label(), transformRule.rules,
      entitySchema, isRequestedSchema = true, abortIfErrorsOccur = false, taskContext)
    GenericEntityTable(transformedEntities, entitySchema, underlyingTask)
  }

  /**
    * Retrieves a list of entities from this source.
    *
    * @param entitySchema The entity schema
    * @param entities     The URIs of the entities to be retrieved.
    * @return A Traversable over the entities. The evaluation of the Traversable may be non-strict.
    */
  override def retrieveByUri(entitySchema: EntitySchema, entities: Seq[Uri])
                            (implicit userContext: UserContext, prefixes: Prefixes): EntityHolder = {
    if(entities.isEmpty) {
      EmptyEntityTable(underlyingTask)
    } else {
      val entitySet = entities.toSet
      retrieve(entitySchema).filter(e => entitySet.contains(e.uri))
    }
  }

  /**
    * The dataset task underlying the Datset this source belongs to
    *
    * @return
    */
  override lazy val underlyingTask: Task[DatasetSpec[Dataset]] = source.underlyingTask
}
