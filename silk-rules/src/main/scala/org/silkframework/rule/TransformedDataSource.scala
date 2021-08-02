package org.silkframework.rule

import org.silkframework.config.{Prefixes, Task}
import org.silkframework.dataset.{DataSource, Dataset, DatasetSpec}
import org.silkframework.entity.metadata.GenericExecutionFailure
import org.silkframework.entity.paths.TypedPath
import org.silkframework.entity.{Entity, EntitySchema}
import org.silkframework.execution.EntityHolder
import org.silkframework.execution.local.{EmptyEntityTable, GenericEntityTable}
import org.silkframework.failures.FailureClass
import org.silkframework.runtime.activity.UserContext
import org.silkframework.util.Uri

import scala.util.{Failure, Success, Try}

/**
  * A data source that transforms all entities using a provided transformation.
  *
  * @param source        The data source for retrieving the source entities.
  * @param transformRule The transformation
  */
class TransformedDataSource(source: DataSource, inputSchema: EntitySchema, transformRule: TransformRule) extends DataSource {
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
    GenericEntityTable(retrieveEntities(entitySchema, None, limit), entitySchema, underlyingTask)
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
      GenericEntityTable(retrieveEntities(entitySchema, Some(entities), None), entitySchema, underlyingTask)
    }
  }

  private def retrieveEntities(entitySchema: EntitySchema, entities: Option[Seq[Uri]], limit: Option[Int])
                              (implicit userContext: UserContext, prefixes: Prefixes): Traversable[Entity] = {
    val subjectRule = transformRule.rules.allRules.find(_.target.isEmpty)
    val pathRules =
      for (typedPath <- entitySchema.typedPaths) yield {
        transformRule.rules.allRules.filter(_.target.map(_.asPath()).contains(typedPath.asUntypedPath))
      }

    val sourceEntities = source.retrieve(inputSchema, limit).entities
    def transformedUri: Entity => String = (entity: Entity) => subjectRule.flatMap(_ (entity).headOption).getOrElse(entity.uri.toString)
    // True if the entity should be output, i.e. if entity URIs are defined the transformed entity URI should be included in that set
    val filterEntity: Entity => Boolean = entities match {
      case Some(uris) =>
        val uriSet = uris.map(_.uri.toString).toSet
        entity =>  {
          val uri = transformedUri(entity)
          uriSet.contains(uri)
        }
      case None =>
        _ => true
    }

    new Traversable[Entity] {
      override def foreach[U](f: Entity => U): Unit = {
        for (entity <- sourceEntities if filterEntity(entity)) yield {
          val uri = transformedUri(entity)
          transformedValues(pathRules, entity) match {
            case Left(transformedValues) =>
              f(Entity(uri, transformedValues, entitySchema))
            case Right(throwable) =>
              f(Entity(uri, entitySchema, FailureClass(GenericExecutionFailure(throwable), source.underlyingTask.id)))
          }
        }
      }
    }
  }

  private def transformedValues[U](pathRules: IndexedSeq[Seq[TransformRule]], entity: Entity): Either[IndexedSeq[Seq[String]], Throwable] = {
    val transformedValues = (for (rules <- pathRules) yield {
      Try {
        rules.flatMap(rule => rule(entity))
      }
    }).map {
      case Success(v) => v
      case Failure(f) =>
        return Right(f)
    }
    Left(transformedValues)
  }

  /**
    * The dataset task underlying the Datset this source belongs to
    *
    * @return
    */
  override def underlyingTask: Task[DatasetSpec[Dataset]] = source.underlyingTask
}
