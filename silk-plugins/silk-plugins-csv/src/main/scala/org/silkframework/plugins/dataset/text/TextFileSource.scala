package org.silkframework.plugins.dataset.text

import org.silkframework.config.{PlainTask, Prefixes, Task}
import org.silkframework.dataset.{DataSource, Dataset, DatasetSpec, EmptyDataset}
import org.silkframework.entity.paths.TypedPath
import org.silkframework.entity.{Entity, EntitySchema}
import org.silkframework.execution.EntityHolder
import org.silkframework.execution.local.GenericEntityTable
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.validation.ValidationException
import org.silkframework.util.{Identifier, Uri}

class TextFileSource(ds: TextFileDataset) extends DataSource {

  override def retrieveTypes(limit: Option[Int])
                            (implicit userContext: UserContext, prefixes: Prefixes): Traversable[(String, Double)] = {
    Seq((ds.typeName, 1.0))
  }

  override def retrievePaths(typeUri: Uri, depth: Int, limit: Option[Int])
                            (implicit userContext: UserContext, prefixes: Prefixes): IndexedSeq[TypedPath] = {
    IndexedSeq(ds.path)
  }

  override def retrieve(entitySchema: EntitySchema, limit: Option[Int])
                       (implicit userContext: UserContext, prefixes: Prefixes): EntityHolder = {
    retrieveEntity(entitySchema)
  }

  override def retrieveByUri(entitySchema: EntitySchema, entities: Seq[Uri])
                            (implicit userContext: UserContext, prefixes: Prefixes): EntityHolder = {
    if(entities.contains(ds.uri)) {
      retrieveEntity(entitySchema)
    } else {
      throw new ValidationException("No entity with URIs " + entities)
    }
  }

  private def retrieveEntity(entitySchema: EntitySchema): EntityHolder = {
    if(entitySchema.typedPaths == IndexedSeq(ds.path)) {
      val text = ds.file.loadAsString(ds.codec)
      val entity = new Entity(
        uri = ds.uri,
        values = IndexedSeq(Seq(text)),
        entitySchema
      )
      GenericEntityTable(
        entities = Seq(entity),
        entitySchema = entitySchema,
        task = underlyingTask,
      )
    } else {
      throw new ValidationException("Unexpected paths " + entitySchema.typedPaths)
    }
  }

  override lazy val underlyingTask: Task[DatasetSpec[Dataset]] = PlainTask(Identifier.fromAllowed(ds.file.name), DatasetSpec(EmptyDataset))
}
