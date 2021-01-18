package org.silkframework.execution

import java.time.format.{DateTimeFormatter, DateTimeFormatterBuilder}
import java.time.{Instant, OffsetDateTime, ZoneOffset}

import org.silkframework.config.{Task, TaskSpec}
import org.silkframework.runtime.activity.ActivityContext

/**
  * Base trait for simple execution report updates.
  */
trait ExecutionReportUpdater {

  final val DEFAULT_DELAY_BETWEEN_UPDATES = 1000
  /** The task that has been executed. */
  def task: Task[TaskSpec]
  /** The activity context of the task that is executed */
  def context: ActivityContext[ExecutionReport]
  /** What does the task emit, e.g. "entity", "query" etc. */
  def entityLabelSingle: String = "Entity"
  /** The plural of the entity label, e.g. "entities", "queries" */
  def entityLabelPlural: String = "Entities"
  /** The verb that applies to the entity, depending on what task is executed. */
  def entityProcessVerb: String = "processed"
  /** The minimum delay between report updates */
  def delayBetweenUpdates: Int = DEFAULT_DELAY_BETWEEN_UPDATES

  private val start = System.currentTimeMillis()
  private var startFirstEntity: Option[Long] = None
  private var lastUpdate = 0L
  private var entitiesEmitted = 0
  private var numberOfExecutions = 0

  def additionalFields(): Seq[(String, String)] = Seq.empty

  /** Increases the number of entities that were processed/generated. */
  def increaseEntityCounter(): Unit = {
    if(entitiesEmitted == 0) {
      startFirstEntity = Some(System.currentTimeMillis())
    }
    entitiesEmitted += 1
  }

  /**
    * Finishes execution of the operator and updates the report.
    * A operator may be run multiple times within one workflow execution.
    */
  def executionDone(): Unit = {
    numberOfExecutions += 1
    update(force = true, addEndTime = true)
  }

  protected def formatDateTime(timestamp: Long): String = {
    val instant = Instant.ofEpochMilli(timestamp)
    DateTimeFormatter.ISO_INSTANT.format(instant)
  }

  // Runtime in ms
  final protected def runtime: Long = System.currentTimeMillis() - start

  // Throughput per second
  final protected def throughput: Double = 1000 * entitiesEmitted.toDouble / runtime

  /**
    * Updates the execution report. Does not update the report if the last update was not longer ago than updateDelay.
    *
    * @param force      Force the execution report update. This should only be done rarely.
    * @param addEndTime Adds an end time to the execution report. This should be done with the last update.
    */
  def update(force: Boolean = false, addEndTime: Boolean = false): Unit = {
    if (force || System.currentTimeMillis() - lastUpdate > delayBetweenUpdates) {
      val runtime = System.currentTimeMillis() - start
      val stats = Seq(
        "Started" -> formatDateTime(start),
        "Runtime" -> s"${runtime.toDouble / 1000} seconds",
        s"$entityLabelPlural / second" -> (if (runtime <= 0) "-" else throughput.formatted("%.3f")),
        s"No. of ${entityLabelPlural.toLowerCase} $entityProcessVerb" -> entitiesEmitted.toString
      ) ++
          Seq("Finished" -> formatDateTime(System.currentTimeMillis())).filter(_ => addEndTime) ++
          startFirstEntity.toSeq.map(firstEntityStart =>
            s"First ${entityLabelSingle.toLowerCase} $entityProcessVerb at" -> formatDateTime(firstEntityStart)) ++
          startFirstEntity.toSeq.map(firstEntityStart =>
            s"Runtime since first ${entityLabelSingle.toLowerCase} $entityProcessVerb" -> s"${(firstEntityStart - start).toDouble / 1000} seconds") ++
          Seq("Number of executions" -> numberOfExecutions.toString).filter(_ => numberOfExecutions > 0) ++
          additionalFields()
      context.value.update(SimpleExecutionReport(task, stats, Seq.empty))
      lastUpdate = System.currentTimeMillis()
    }
  }
}