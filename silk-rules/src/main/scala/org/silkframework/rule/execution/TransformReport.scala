package org.silkframework.rule.execution

import org.silkframework.config.{Task, TaskSpec}
import org.silkframework.execution.ExecutionReport
import org.silkframework.rule.TransformSpec
import org.silkframework.rule.execution.TransformReport._
import org.silkframework.util.Identifier

/**
  * Holds the state of the transform execution.
  *
  * @param entityCounter The number of entities that have been transformed, including erroneous entities.
  * @param entityErrorCounter The number of entities that have been erroneous.
  * @param ruleResults The transformation statistics for each mapping rule by name.
  */
case class TransformReport(task: Task[TransformSpec],
                           entityCounter: Long = 0L,
                           entityErrorCounter: Long = 0L,
                           ruleResults: Map[Identifier, RuleResult] = Map.empty,
                           globalErrors: Seq[String] = Seq.empty
                          ) extends ExecutionReport {

  lazy val summary: Seq[(String, String)] = {
    Seq(
      "Number of entities" -> entityCounter.toString,
      "Number of errors" -> entityErrorCounter.toString
    )
  }

  def warnings: Seq[String] = {
    var allErrors = globalErrors
    if(entityErrorCounter != 0) {
      allErrors :+= s"Validation issues occurred on $entityErrorCounter entities."
    }
    allErrors
  }

}

object TransformReport {

  /**
    * The transformation statistics for a single mapping rule.
    *
    * @param errorCount The number of (validation) errors for this rule.
    * @param sampleErrors Samples of erroneous values. This is just an excerpt. If all erroneous values are needed,
    *                     the transform executor needs to be configured with an error output.
    */
  case class RuleResult(errorCount: Long = 0L, sampleErrors: IndexedSeq[RuleError] = IndexedSeq.empty) {

    /**
      * Increases the error counter, but does not add a new sample error.
      */
    def withError() = {
      copy(
        errorCount = errorCount + 1
      )
    }

    /**
      * Increases the error counter and adds a new sample error.
      */
    def withError(error: RuleError) = {
      copy(
        errorCount = errorCount + 1,
        sampleErrors :+ error
      )
    }

  }

  /**
    * A single transformation error.
    *
    * @param entity The URI of the entity for which the error occurred.
    * @param value The erroneous value
    * @param message The error description
    */
  case class RuleError(entity: String, value: Seq[Seq[String]], message: String)

  object RuleError {
    def apply(entity: String, value: Seq[Seq[String]], exception: Throwable): RuleError = new RuleError(entity, value, exception.getMessage)
  }

}
