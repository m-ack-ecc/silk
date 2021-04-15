package org.silkframework.rule.execution

import org.silkframework.config.{Prefixes, Task}
import org.silkframework.dataset.{DataSource, EntitySink}
import org.silkframework.execution.local.ErrorOutputWriter
import org.silkframework.rule.TransformSpec.RuleSchemata
import org.silkframework.rule._
import org.silkframework.rule.execution.local.TransformedEntities
import org.silkframework.runtime.activity.{Activity, ActivityContext, UserContext}

import scala.util.control.Breaks._

/**
  * Executes a set of transformation rules.
  */
class ExecuteTransform(task: Task[TransformSpec],
                       input: UserContext => DataSource,
                       output: UserContext => EntitySink,
                       errorOutput: UserContext => Option[EntitySink] = _ => None,
                       limit: Option[Int] = None)(implicit prefixes: Prefixes) extends Activity[TransformReport] {

  private def transform = task.data

  require(transform.rules.count(_.target.isEmpty) <= 1, "Only one rule with empty target property (subject rule) allowed.")

  override val initialValue = Some(TransformReport(task))

  def run(context: ActivityContext[TransformReport])
         (implicit userContext: UserContext): Unit = {
    cancelled = false
    // Get fresh data source and entity sink
    val dataSource = input(userContext)
    val entitySink = output(userContext)
    val errorEntitySink = errorOutput(userContext)

    // Clear outputs before writing
    entitySink.clear()
    errorEntitySink.foreach(_.clear())

    try {
      for ((ruleSchemata, index) <- transform.ruleSchemata.zipWithIndex) {
        transformEntities(dataSource, ruleSchemata, entitySink, errorEntitySink, context)
        context.status.updateProgress((index + 1.0) / transform.ruleSchemata.size)
      }
    } finally {
      entitySink.close()
      errorEntitySink.foreach(_.close())
    }
  }

  private def transformEntities(dataSource: DataSource,
                                rule: RuleSchemata,
                                entitySink: EntitySink,
                                errorEntitySink: Option[EntitySink],
                                context: ActivityContext[TransformReport])
                               (implicit userContext: UserContext, prefixes: Prefixes): Unit = {
    entitySink.openTable(rule.outputSchema.typeUri, rule.outputSchema.typedPaths.map(_.property.get))
    errorEntitySink.foreach(_.openTable(rule.outputSchema.typeUri, rule.outputSchema.typedPaths.map(_.property.get) :+ ErrorOutputWriter.errorProperty))

    val entityTable = dataSource.retrieve(rule.inputSchema)
    val transformedEntities = new TransformedEntities(task, entityTable.entities, rule.transformRule.rules, rule.outputSchema,
      isRequestedSchema = false, abortIfErrorsOccur = task.data.abortIfErrorsOccur, context = context)
    var count = 0
    breakable {
      for (entity <- transformedEntities) {
        entitySink.writeEntity(entity.uri, entity.values)
        if(entity.hasFailed) {
          errorEntitySink.foreach(_.writeEntity(entity.uri, entity.values :+ Seq(entity.failure.get.message.getOrElse("Unknown error"))))
        }
        count += 1
        if (cancelled || limit.exists(_ <= count)) {
          break
        }
      }
    }
    entitySink.closeTable()
    errorEntitySink.foreach(_.closeTable())

    context.value() = context.value().copy(globalErrors = context.value().globalErrors ++ entityTable.globalErrors)
  }
}