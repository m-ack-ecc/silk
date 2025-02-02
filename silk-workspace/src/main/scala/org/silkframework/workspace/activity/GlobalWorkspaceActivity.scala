package org.silkframework.workspace.activity

import org.silkframework.config.TaskSpec
import org.silkframework.runtime.activity.{Activity, ActivityControl, HasValue}
import org.silkframework.workspace.{Project, ProjectTask}

import scala.reflect.ClassTag

/**
  * Activity that exists only once per workspace and is independent of projects or tasks.
  */
class GlobalWorkspaceActivity[ActivityType <: HasValue : ClassTag](factory: GlobalWorkspaceActivityFactory[ActivityType])
    extends WorkspaceActivity[ActivityType] {
  override def projectOpt: Option[Project] = None

  override def taskOption: Option[ProjectTask[_ <: TaskSpec]] = None

  override def factory: GlobalWorkspaceActivityFactory[_] = factory

  def autoRun: Boolean = factory.autoRun

  override protected def createInstance(config: Map[String, String]): ActivityControl[ActivityType#ValueType] = {
    Activity(factory(), projectAndTaskId = None)
  }
}
