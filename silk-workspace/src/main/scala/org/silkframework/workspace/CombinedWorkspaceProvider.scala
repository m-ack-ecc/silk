package org.silkframework.workspace

import org.silkframework.config.{Tag, Task, TaskSpec}
import org.silkframework.dataset.rdf.SparqlEndpoint
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.resource.ResourceManager
import org.silkframework.util.Identifier
import org.silkframework.workspace.io.WorkspaceIO

import java.util.logging.{Level, Logger}
import scala.reflect.ClassTag
import scala.util.control.NonFatal

/**
  * A workspace that is held in one backend, but all updates are also pushed to a secondary backend.
  *
  * @param primaryWorkspace The backend that holds the workspace.
  * @param secondaryWorkspace The secondary backend to which updates are pushed as well.
  * @param failOnSecondaryError If true, whenever an update to the secondary workspace fails, the entire update fails.
  *                             If false, whenever an update to the secondary workspace fails, the entire update succeeds and a warning is logged.
  */
class CombinedWorkspaceProvider(val primaryWorkspace: WorkspaceProvider,
                                val secondaryWorkspace: WorkspaceProvider,
                                failOnSecondaryError: Boolean = false) extends WorkspaceProvider {

  private val log = Logger.getLogger(getClass.getName)

  override def sparqlEndpoint: Option[SparqlEndpoint] = primaryWorkspace.sparqlEndpoint.orElse(secondaryWorkspace.sparqlEndpoint)

  /**
    * Refreshes all projects, i.e. cleans all possible caches if there are any and reloads all projects freshly.
    */
  override def refresh()(implicit userContext: UserContext): Unit = {
    primaryWorkspace.refresh()

    // Delete all projects from the secondary workspace provider and recommit them
    // We do this to avoid that both workspace providers get out of sync
    for(project <- secondaryWorkspace.readProjects()) {
      secondaryWorkspace.deleteProject(project.id)
    }
    WorkspaceIO.copyProjects(primaryWorkspace, secondaryWorkspace, None, None)
  }

  /**
    * Reads all projects from the workspace.
    */
  override def readProjects()(implicit user: UserContext): Seq[ProjectConfig] = {
    primaryWorkspace.readProjects()
  }

  /**
    * Reads a single project from the backend.
    *
    * @return The project config or None if the project does not exist or an error occurred.
    */
  override def readProject(projectId: String)(implicit userContext: UserContext): Option[ProjectConfig] = {
    primaryWorkspace.readProject(projectId)
  }

  /**
    * Adds/Updates a project.
    */
  override def putProject(projectConfig: ProjectConfig)(implicit user: UserContext): Unit = {
    executeOnBackends(_.putProject(projectConfig), s"Adding project ${projectConfig.id}")
  }

  /**
    * Deletes a project.
    */
  override def deleteProject(name: Identifier)(implicit user: UserContext): Unit = {
    executeOnBackends(_.deleteProject(name), s"Deleting project $name")
  }

  /**
    * Imports a complete project.
    */
  def importProject(project: ProjectConfig,
                    provider: WorkspaceProvider,
                    inputResources: Option[ResourceManager],
                    outputResources: Option[ResourceManager])(implicit user: UserContext): Unit = {
    WorkspaceIO.copyProject(provider, this, inputResources, outputResources, project)
  }

  /**
    * Retrieves the project cache folder.
    */
  override def projectCache(name: Identifier): ResourceManager = {
    primaryWorkspace.projectCache(name)
  }

  /**
    * Version of readTasks that returns a Seq[Try[Task[T]]]
    **/
  override def readTasks[T <: TaskSpec : ClassTag](project: Identifier,
                                                   projectResources: ResourceManager)
                                                  (implicit user: UserContext): Seq[LoadedTask[T]] = {
    primaryWorkspace.readTasks[T](project, projectResources)
  }

  override def readAllTasks(project: Identifier, projectResources: ResourceManager)
                           (implicit user: UserContext): Seq[LoadedTask[_]] = {
    primaryWorkspace.readAllTasks(project, projectResources)
  }

  /**
    * Adds/Updates a task in a project.
    */
  override def putTask[T <: TaskSpec : ClassTag](project: Identifier, task: Task[T])(implicit user: UserContext): Unit = {
    executeOnBackends(_.putTask(project, task), s"Adding/Updating task $task in project $project")
  }

  /**
    * Deletes a task from a project.
    */
  override def deleteTask[T <: TaskSpec : ClassTag](project: Identifier, task: Identifier)(implicit user: UserContext): Unit = {
    executeOnBackends(_.deleteTask(project, task), s"Deleting task $task from project $project")
  }

  /**
    * Retrieve a list of all available tags.
    */
  def readTags(project: Identifier)
              (implicit userContext: UserContext): Iterable[Tag] = {
    primaryWorkspace.readTags(project)
  }

  /**
    * Add a new tag.
    * Adding a tag with an existing URI, will overwrite the corresponding tag.
    */
  def putTag(project: Identifier, tag: Tag)
            (implicit userContext: UserContext): Unit = {
    executeOnBackends(_.putTag(project, tag), s"Adding/Updating tag ${tag.uri} in project $project")
  }

  /**
    * Remove a tag.
    */
  def deleteTag(project: Identifier, tagUri: String)
               (implicit userContext: UserContext): Unit = {
    executeOnBackends(_.deleteTag(project, tagUri), s"Deleting tag $tagUri in project $project")
  }

  /**
    * Executes an operation on both backends, e.g., updating a task.
    */
  private def executeOnBackends(operation: WorkspaceProvider => Unit, description: String): Unit = {
    operation(primaryWorkspace)
    try {
      operation(secondaryWorkspace)
    } catch {
      case NonFatal(ex) =>
        val message = s"$description was successful on $primaryWorkspace, but failed on $secondaryWorkspace"
        if(failOnSecondaryError) {
          throw new RuntimeException(message, ex)
        } else {
          log.log(Level.WARNING, message, ex)
        }
    }
  }
}