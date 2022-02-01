package org.silkframework.workspace

import org.mockito.Mockito._
import org.scalatest.Matchers.convertToAnyShouldWrapper
import org.scalatest.{FlatSpec, MustMatchers}
import org.scalatestplus.mockito.MockitoSugar
import org.silkframework.config._
import org.silkframework.entity.EntitySchema
import org.silkframework.runtime.activity.{Activity, ActivityContext, TestUserContextTrait, UserContext}
import org.silkframework.runtime.plugin.PluginRegistry
import org.silkframework.runtime.resource.ResourceManager
import org.silkframework.runtime.validation.ServiceUnavailableException
import org.silkframework.util.{ConfigTestTrait, Identifier}
import org.silkframework.workspace.WorkspaceTest.{SleepActivity, SleepActivityFactory, TestActivity, TestActivityFactory, TestTask, TestWorkspaceProvider}
import org.silkframework.workspace.activity.TaskActivityFactory
import org.silkframework.workspace.resources.InMemoryResourceRepository

import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean
import scala.collection.immutable.ListMap
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.reflect.ClassTag

class WorkspaceTest extends FlatSpec with MustMatchers with ConfigTestTrait with MockitoSugar with TestUserContextTrait {
  behavior of "Workspace"

  it should "throw a 503 if it is loading and reaching its timeout" in {
    val slowSeq = new Seq[ProjectConfig] {
      override def length: Int = 0
      override def apply(idx: Int): ProjectConfig = ProjectConfig(metaData = MetaData(Some("project")))
      override def iterator: Iterator[ProjectConfig] = {
        Thread.sleep(5000)
        Iterator.empty
      }
    }
    val providerMock = mock[WorkspaceProvider]
    when(providerMock.readProjects()).thenReturn(slowSeq)
    val inMemoryResourceRepository = InMemoryResourceRepository()
    val workspace = new Workspace(providerMock, inMemoryResourceRepository)
    val started = new AtomicBoolean(false)
    Future {
      started.set(true)
      workspace.projects.headOption
    }
    while(!started.get()) {
      Thread.sleep(1)
    }
    Thread.sleep(1)
    intercept[ServiceUnavailableException] {
      workspace.projects.headOption
    }
  }

  it should "load caches after all projects have been loaded" in {
    val workspaceProvider = new TestWorkspaceProvider(loadTimePause = 1000)
    PluginRegistry.registerPlugin(classOf[TestActivityFactory])

    val project1 = Identifier("project1")
    val task1 = Identifier("task1")
    workspaceProvider.putProject(ProjectConfig(project1, metaData = MetaData(Some(project1))))
    workspaceProvider.putTask(project1, PlainTask(task1,  TestTask()))

    val project2 = Identifier("project2")
    val task2 = Identifier("task2")
    workspaceProvider.putProject(ProjectConfig(project2, metaData = MetaData(Some(project2))))
    workspaceProvider.putTask(project2, PlainTask(task2,  TestTask()))

    val workspace = new Workspace(workspaceProvider, InMemoryResourceRepository())

    // Make sure that all projects and tasks have been loaded
    workspace.projects.map(_.config.id) mustBe Seq(project1, project2)
    workspace.project(project1).allTasks.map(_.id) mustBe Seq(task1)
    workspace.project(project2).allTasks.map(_.id) mustBe Seq(task2)

    // Wait until the test activities have been started
    val testActivities = workspace.projects.flatMap(_.tasks[TestTask]).map(_.activity[TestActivity].control)
    while(testActivities.exists(_.startTime.isEmpty)) {
      Thread.sleep(50)
    }

    // Make sure that all projects and tasks have been loaded before starting any activity
    val projectLoadTimes = workspaceProvider.taskReadTimes.values
    val activityStartTimes = testActivities.map(_.startTime.getOrElse(fail("Autorun activity has not been started.")))

    projectLoadTimes.size mustBe 2
    activityStartTimes.size mustBe 2
    projectLoadTimes.max must be < activityStartTimes.min
  }

  it should "stop all activities if the workspace is reloaded" in {
    val workspaceProvider = new TestWorkspaceProvider(loadTimePause = 0)
    PluginRegistry.registerPlugin(classOf[SleepActivityFactory])

    val project = Identifier("project")
    val task = Identifier("task")
    workspaceProvider.putProject(ProjectConfig(project, metaData = MetaData(Some(project))))
    workspaceProvider.putTask(project, PlainTask(task,  TestTask()))

    val workspace = new Workspace(workspaceProvider, InMemoryResourceRepository())

    // Activity should have been started automatically
    val sleepActivity = workspace.project(project).anyTask(task).activity[SleepActivity]
    sleepActivity.status() shouldBe 'isRunning

    workspace.reload()

    // After reload the current activity should have been cancelled and a new one started.
    sleepActivity.status() should not be 'isRunning
    val newSleepActivity = workspace.project(project).anyTask(task).activity[SleepActivity]
    newSleepActivity.status() shouldBe 'isRunning
  }

  override def propertyMap: Map[String, Option[String]] = Map(
    "workspace.timeouts.waitForWorkspaceInitialization" -> Some("1")
  )
}

object WorkspaceTest {

  /**
    * Workspace provider that keeps track on when projects and tasks have been loaded.
    *
    * @param loadTimePause After loading tasks, sleep for this many milliseconds.
    */
  class TestWorkspaceProvider(loadTimePause: Int) extends InMemoryWorkspaceProvider {

    // The timestamp when projects have been loaded the last time
    var projectTime: Instant = Instant.EPOCH

    // The timestamps when the tasks for each project have been loaded
    var taskReadTimes: ListMap[String, Instant] = ListMap.empty

    override def readProjects()(implicit user: UserContext): Seq[ProjectConfig] = {
      projectTime = Instant.now
      super.readProjects()
    }

    override def readTasks[T <: TaskSpec : ClassTag](project: Identifier, projectResources: ResourceManager)
                                                    (implicit user: UserContext): Seq[LoadedTask[T]] = {
      val tasks = super.readTasks(project, projectResources)
      Thread.sleep(loadTimePause)
      taskReadTimes += ((project, Instant.now))
      tasks
    }

    override def readAllTasks(project: Identifier, projectResources: ResourceManager)
                             (implicit user: UserContext): Seq[LoadedTask[_]] = {
      val tasks = super.readAllTasks(project, projectResources)
      Thread.sleep(loadTimePause)
      taskReadTimes += ((project, Instant.now))
      tasks
    }
  }

  case class TestTask(testParam: String = "test value") extends CustomTask {
    override def inputSchemataOpt: Option[Seq[EntitySchema]] = None
    override def outputSchemaOpt: Option[EntitySchema] = None
  }

  case class TestActivityFactory() extends TaskActivityFactory[TestTask, TestActivity] {

    override def autoRun: Boolean = true

    def apply(task: ProjectTask[TestTask]): Activity[Unit] = {
      new TestActivity
    }
  }

  class TestActivity extends Activity[Unit] {
    override def run(context: ActivityContext[Unit])
                    (implicit userContext: UserContext): Unit = {
      // Does nothing
    }
  }

  case class SleepActivityFactory() extends TaskActivityFactory[TestTask, SleepActivity] {

    override def autoRun: Boolean = true

    def apply(task: ProjectTask[TestTask]): Activity[Unit] = {
      new SleepActivity
    }
  }

  // Activity that sleeps for a couple of seconds
  class SleepActivity extends Activity[Unit] {
    override def run(context: ActivityContext[Unit])
                    (implicit userContext: UserContext): Unit = {
      Thread.sleep(10000)
    }
  }

}
