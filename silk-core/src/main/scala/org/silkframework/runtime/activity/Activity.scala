package org.silkframework.runtime.activity

import java.util.concurrent.ForkJoinPool

import org.silkframework.runtime.execution.Execution
import org.silkframework.util.StringUtils._

import scala.reflect.ClassTag

/**
 * An activity is a unit of work that can be executed in the background.
 * Implementing classes need to override the run method.
 *
 * @tparam T The type of value that is generated by this activity.
 *           Set to [[Unit]] if no values are generated.
 */
trait Activity[T] extends HasValue {

  @volatile
  protected var cancelled: Boolean = false

  /**
   * The name of the activity.
   * By default, the name is generated from the name of the implementing class.
   * Can be overridden in implementing classes.
   */
  def name: String = getClass.getSimpleName.toSentenceCase

  /**
   * Executes this activity.
   *
   * @param context Holds the context in which the activity is executed.
   */
  def run(context: ActivityContext[T])
         (implicit userContext: UserContext): Unit

  /**
   *  Can be overridden in implementing classes to allow cancellation of the activity.
   */
  def cancelExecution()(implicit userContext: UserContext): Unit = { cancelled = true }

  def resetCancelFlag()(implicit userContext: UserContext): Unit = { cancelled = false }

  def wasCancelled(): Boolean = cancelled

  /**
    * Can be overridden in implementing classes to implement reset behaviour in addition to resetting the activity value to its initial value.
    */
  def reset()(implicit userContext: UserContext): Unit = { }

  /**
   * The initial value of this activity, if any.
   */
  def initialValue: Option[T] = None

  /**
   * Captures the bound value type.
   */
  type ValueType = T
}

/**
 * Executes activities.
 */
object Activity {

  /**
   * The fork join pool used to run activities.
   */
  val forkJoinPool: ForkJoinPool = Execution.createForkJoinPool("Activity")

  /**
    * The base path into which all activity output is logged
    */
  val loggingPath = "org.silkframework.runtime.activity"

  /**
   * Retrieves a control for an activity without executing it.
   * The [ActivityControl] instance can be used to start the execution of the activity.
   * After that it can be used to monitor the execution status as well as the current value and allows to request the cancellation of the execution.
   */
  def apply[T](activity: Activity[T], projectAndTaskId: Option[ProjectAndTaskIds] = None): ActivityControl[T] = {
    new ActivityExecution[T](activity, projectAndTaskId = projectAndTaskId)
  }

  /**
    * Whenever the returned activity is executed, generates and executes a new internal activity.
    */
  def regenerating[ActivityType <: Activity[ActivityData] : ClassTag, ActivityData](generateActivity: => ActivityType): Activity[ActivityData] = {
    new Activity[ActivityData] {
      @volatile var currentActivity: Option[ActivityType] = None
      override def name: String = implicitly[ClassTag[ActivityType]].runtimeClass.getSimpleName.toSentenceCase
      override def initialValue: Option[ActivityData] = generateActivity.initialValue
      override def run(context: ActivityContext[ActivityData])
                      (implicit userContext: UserContext): Unit = {
        currentActivity = Some(generateActivity)
        currentActivity.get.run(context)
        currentActivity = None
      }
      override def cancelExecution()(implicit userContext: UserContext): Unit = {
        currentActivity.foreach(_.cancelExecution())
        super.cancelExecution()
      }

      override def resetCancelFlag()(implicit userContext: UserContext): Unit = {
        currentActivity.foreach(_.resetCancelFlag())
        super.resetCancelFlag()
      }
      override def reset()(implicit userContext: UserContext): Unit = {
        currentActivity.foreach(_.reset())
        super.reset()
      }
    }
  }
}



