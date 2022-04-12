package controllers.workspace

import controllers.core.UserContextActions
import controllers.core.util.ControllerUtilsTrait
import controllers.util.SerializationUtils
import controllers.workspace.doc.TaskApiDoc
import controllers.workspace.taskApi.TaskApiUtils
import controllers.workspace.workspaceRequests.{CopyTasksRequest, CopyTasksResponse}
import io.swagger.v3.oas.annotations.enums.ParameterIn
import io.swagger.v3.oas.annotations.media.{Content, ExampleObject, Schema}
import io.swagger.v3.oas.annotations.parameters.RequestBody
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import io.swagger.v3.oas.annotations.{Operation, Parameter}
import org.silkframework.config.{MetaData, Prefixes, Task, TaskSpec}
import org.silkframework.dataset.DatasetSpec.GenericDatasetSpec
import org.silkframework.dataset.ResourceBasedDataset
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.plugin.{ClassPluginDescription, ParameterAutoCompletion, PluginDescription, PluginObjectParameterTypeTrait}
import org.silkframework.runtime.resource.{FileResource, ResourceManager}
import org.silkframework.runtime.serialization.{ReadContext, WriteContext}
import org.silkframework.runtime.validation.BadUserInputException
import org.silkframework.serialization.json.JsonSerializers.{GenericTaskJsonFormat, MetaDataJsonFormat, TaskFormatOptions, TaskJsonFormat, TaskSpecJsonFormat, fromJson, toJson, _}
import org.silkframework.serialization.json.{JsonSerialization, JsonSerializers}
import org.silkframework.workbench.utils.ErrorResult
import org.silkframework.workbench.workspace.WorkbenchAccessMonitor
import org.silkframework.workspace.{Project, ProjectTask, WorkspaceFactory}
import play.api.libs.json._
import play.api.mvc._

import java.util.logging.Logger
import javax.inject.Inject
import scala.concurrent.ExecutionContext
import scala.util.Try
import scala.util.control.NonFatal

@Tag(name = "Project tasks")
class parametersWithLabelTaskApi @Inject() (accessMonitor: WorkbenchAccessMonitor) extends InjectedController with UserContextActions with ControllerUtilsTrait {

  implicit private lazy val executionContext: ExecutionContext = controllerComponents.executionContext
  private val log: Logger = Logger.getLogger(this.getClass.getCanonicalName)

  @Operation(
    summary = "Add task",
    description = " Add a new task to the project. If the 'id' parameter is omitted in the request, an ID will be generated from the label – which is then required.",
    responses = Array(
      new ApiResponse(
        responseCode = "201",
        description = "The added task.",
        content = Array(new Content(
          mediaType = "application/json",
          examples = Array(new ExampleObject(TaskApiDoc.taskExampleJson))
        ))
      ),
      new ApiResponse(
        responseCode = "400",
        description = "If the provided task specification is invalid."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      ),
      new ApiResponse(
        responseCode = "409",
        description = "If a task with the given identifier already exists."
      )
    ))
  @RequestBody(
    description = "The task description",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        examples = Array(new ExampleObject(TaskApiDoc.taskExampleJson))
      ))
  )
  def postTask(@Parameter(
                 name = "project",
                 description = "The project identifier",
                 required = true,
                 in = ParameterIn.PATH,
                 schema = new Schema(implementation = classOf[String])
               )
               projectName: String): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    implicit val readContext: ReadContext = ReadContext(project.resources, project.config.prefixes)
    SerializationUtils.deserializeCompileTime[Task[TaskSpec]]() { task =>
      project.addAnyTask(task.id, task.data, task.metaData)
      implicit val writeContext: WriteContext[JsValue] = WriteContext[JsValue](prefixes = project.config.prefixes, projectId = Some(project.name))
      Created(JsonSerializers.GenericTaskJsonFormat.write(task)).
          withHeaders(LOCATION -> routes.TaskApi.getTask(projectName, task.id).path())
    }
  }

  @Operation(
    summary = "Add or update task",
    description = "Add or update a task.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "If the task has been added or updated successfully."
      ),
      new ApiResponse(
        responseCode = "400",
        description = "If the provided task specification is invalid."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  @RequestBody(
    description = "The task description",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        examples = Array(new ExampleObject(TaskApiDoc.taskExampleJson))
      ))
  )
  def putTask(@Parameter(
                name = "project",
                description = "The project identifier",
                required = true,
                in = ParameterIn.PATH,
                schema = new Schema(implementation = classOf[String])
              )
              projectName: String,
              @Parameter(
                name = "task",
                description = "The task identifier",
                required = true,
                in = ParameterIn.PATH,
                schema = new Schema(implementation = classOf[String])
              )
              taskName: String): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    implicit val readContext = ReadContext(project.resources, project.config.prefixes)
    SerializationUtils.deserializeCompileTime[Task[TaskSpec]]() { task =>
      if(task.id.toString != taskName) {
        throw new BadUserInputException(s"Inconsistent task identifiers: Got $taskName in URL, but ${task.id} in payload.")
      }
      project.updateAnyTask(task.id, task.data, Some(task.metaData))
      Ok
    }
  }

  @Operation(
    summary = "Update task",
    description = "Update selected properties of a task. Only the sent JSON paths will be updated, i.e., the provided JSON is deep merged into the existing task JSON.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "If the task has been updated successfully."
      ),
      new ApiResponse(
        responseCode = "400",
        description = "If the provided task specification is invalid."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    ))
  @RequestBody(
    description = "The task description",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        examples = Array(new ExampleObject("{ \"metadata\": { \"description\": \"task description\" } }"))
      ))
  )
  def patchTask(@Parameter(
                  name = "project",
                  description = "The project identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                projectName: String,
                @Parameter(
                  name = "task",
                  description = "The task identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                taskName: String): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
    // Load current task
    val project = WorkspaceFactory().workspace.project(projectName)
    val currentTask = project.anyTask(taskName)

    // Update task JSON
    implicit val readContext = ReadContext(project.resources, project.config.prefixes)
    val currentJson = toJson[Task[TaskSpec]](currentTask).as[JsObject]
    val updatedJson = currentJson.deepMerge(request.body.as[JsObject])

    // Update task
    implicit val writeContext = WriteContext(prefixes = project.config.prefixes, projectId = None)
    val updatedTask = fromJson[Task[TaskSpec]](updatedJson)
    if(updatedTask.id.toString != taskName) {
      throw new BadUserInputException(s"Inconsistent task identifiers: Got $taskName in URL, but ${updatedTask.id} in payload.")
    }
    project.updateAnyTask(updatedTask.id, updatedTask.data, Some(updatedTask.metaData))

    Ok
  }

  @Operation(
    summary = "Retrieve task",
    description = "Retrieve a task from a project.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "The task.",
        content = Array(new Content(
          mediaType = "application/json",
          examples = Array(
            new ExampleObject(name = "Without labels", value = TaskApiDoc.taskExampleWithoutLabelsJson),
            new ExampleObject(name = "With labels", value = TaskApiDoc.taskMetadataExampleWithLabelsJson)
          )
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    )
  )
  def getTask(@Parameter(
                name = "project",
                description = "The project identifier",
                required = true,
                in = ParameterIn.PATH,
                schema = new Schema(implementation = classOf[String])
              )
              projectName: String,
              @Parameter(
                name = "task",
                description = "The task identifier",
                required = true,
                in = ParameterIn.PATH,
                schema = new Schema(implementation = classOf[String])
              )
              taskName: String,
              @Parameter(
                name = "withLabels",
                description = "If true, all parameter values will be reified in a new object that has an optional label property. A label is added for all auto-completable parameters that have the 'autoCompleteValueWithLabels' property set to true. This guarantees that a user always sees the label of such values. For object type parameters that have set the 'visibleInDialog' flag set to true, this reification is done on all levels. For object type parameters that should not be shown in UI dialogs this is still done for the first level of the task itself, but not deeper. These values should never be set or updated by a normal UI dialog anyway and should be ignored by a task dialog.",
                required = false,
                in = ParameterIn.QUERY,
                schema = new Schema(implementation = classOf[Boolean])
              )
              withLabels: Boolean): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    val task = project.anyTask(taskName)

    accessMonitor.saveProjectTaskAccess(project.config.id, task.id)
    if(withLabels) {
      getTaskWithParameterLabels(projectName, project, task)
    } else {
      SerializationUtils.serializeCompileTime[Task[TaskSpec]](task, Some(project))
    }
  }

  // Add parameter value labels for auto-completable parameters, e.g. task label of a task reference parameter.
  private def getTaskWithParameterLabels(projectName: String,
                                         project: Project,
                                         task: ProjectTask[_ <: TaskSpec])
                                        (implicit userContext: UserContext): Result = {
    implicit val writeContext: WriteContext[JsValue] = WriteContext[JsValue](prefixes = project.config.prefixes, projectId = Some(project.config.id))
    // JSON only
    val jsObj: JsObject = JsonSerialization.toJson[Task[TaskSpec]](task).as[JsObject]
    val data = (jsObj \ DATA).as[JsObject]
    val parameters = (data \ PARAMETERS).as[JsObject]
    val parameterValue = parameters.value
    val updatedParameters: JsObject = TaskApiUtils.parametersWithLabel(projectName, task, parameterValue)
    val updatedDataFields = data.fields ++ Seq(PARAMETERS -> updatedParameters)
    val updatedData = JsObject(updatedDataFields)
    val updatedJsObj = JsObject(jsObj.fields.filterNot(_._1 == DATA) ++ Seq(DATA -> updatedData))
    Ok(updatedJsObj)
  }

  @Operation(
    summary = "Delete task",
    description = "Remove a task from a project.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "If the task has been deleted or there is no task with that identifier."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    )
  )
  def deleteTask(@Parameter(
                  name = "project",
                  description = "The project identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                projectName: String,
                @Parameter(
                  name = "task",
                  description = "The task identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                taskName: String,
                @Parameter(
                  name = "removeDependentTasks",
                  description = "If true, all tasks that directly or indirectly reference this task are removed as well.",
                  required = true,
                  in = ParameterIn.QUERY,
                  schema = new Schema(implementation = classOf[Boolean])
                )
                removeDependentTasks: Boolean): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    project.removeAnyTask(taskName, removeDependentTasks)

    Ok
  }

  @Operation(
    summary = "Update task metadata",
    description = "Updates task metadata that includes user metadata, such as the task label as well as technical metadata, such as the referenced tasks.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "If the task metadata has been updated successfully."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    )
  )
  def putTaskMetadata(@Parameter(
                        name = "project",
                        description = "The project identifier",
                        required = true,
                        in = ParameterIn.PATH,
                        schema = new Schema(implementation = classOf[String])
                      )
                      projectName: String,
                      @Parameter(
                        name = "task",
                        description = "The task identifier",
                        required = true,
                        in = ParameterIn.PATH,
                        schema = new Schema(implementation = classOf[String])
                      )
                      taskName: String): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    val task = project.anyTask(taskName)
    implicit val readContext: ReadContext = ReadContext()

    SerializationUtils.deserializeCompileTime[MetaData](defaultMimeType = "application/json") { metaData =>
      task.updateMetaData(metaData)
      Ok(taskMetaDataJson(task))
    }
  }

  @Operation(
    summary = "Retrieve task metadata",
    description = "Retrieve task metadata that includes user metadata, such as the task label as well as technical metadata, such as the referenced tasks.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "The task metadata",
        content = Array(
          new Content(
            mediaType = "application/json",
            examples = Array(new ExampleObject(TaskApiDoc.taskMetadataExampleJson))
          )
        )
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    )
  )
  def getTaskMetadata(@Parameter(
                        name = "project",
                        description = "The project identifier",
                        required = true,
                        in = ParameterIn.PATH,
                        schema = new Schema(implementation = classOf[String])
                      )
                      projectName: String,
                      @Parameter(
                        name = "task",
                        description = "The task identifier",
                        required = true,
                        in = ParameterIn.PATH,
                        schema = new Schema(implementation = classOf[String])
                      )
                      taskName: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    val task = project.anyTask(taskName)
    val metaDataJson = taskMetaDataJson(task)
    accessMonitor.saveProjectTaskAccess(project.config.id, task.id)
    Ok(metaDataJson)
  }

  // Task meta data object as JSON
  private def taskMetaDataJson(task: ProjectTask[_ <: TaskSpec])(implicit userContext: UserContext): JsObject = {
    val formatOptions =
      TaskFormatOptions(
        includeMetaData = Some(false),
        includeTaskData = Some(false),
        includeTaskProperties = Some(false),
        includeRelations = Some(true),
        includeSchemata = Some(true)
      )
    val taskFormat = new TaskJsonFormat[TaskSpec](formatOptions, Some(userContext))
    implicit val writeContext: WriteContext[JsValue] = WriteContext[JsValue](projectId = Some(task.project.config.id))
    val taskJson = taskFormat.write(task)
    val metaDataJson = JsonSerializers.toJson(task.metaData)
    val mergedJson = metaDataJson.as[JsObject].deepMerge(taskJson.as[JsObject])
    mergedJson
  }

  @Operation(
    summary = "Clone Task",
    description = "Clone a task.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "If the has been cloned."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    )
  )
  def cloneTask(@Parameter(
                  name = "project",
                  description = "The project identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                projectName: String,
                @Parameter(
                  name = "task",
                  description = "The identifier of the task to be cloned",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                oldTask: String,
                @Parameter(
                  name = "newTask",
                  description = "The new task identifier",
                  required = true,
                  in = ParameterIn.QUERY,
                  schema = new Schema(implementation = classOf[String])
                )
                newTask: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    val fromTask = project.anyTask(oldTask)
    // Clone task spec, since task specs may contain state, e.g. RDF file dataset
    implicit val resourceManager: ResourceManager = project.resources
    implicit val prefixes: Prefixes = project.config.prefixes
    val clonedTaskSpec = Try(fromTask.data.withProperties(Map.empty)).getOrElse(fromTask.data)
    project.addAnyTask(newTask, clonedTaskSpec)
    Ok
  }

  @Operation(
    summary = "Copy Task to Another Project",
    description = "Copies a task to another project. All tasks that the copied task references (directly or indirectly) are copied as well. Referenced resources are copied only if the target project uses a different resource path than the source project. Using the dryRun attribute, a copy operation can be simulated, i.e., the response listing the tasks to be copied and overwritten can be checked first.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "If the has been copied.",
        content = Array(
          new Content(
            mediaType = "application/json",
            schema = new Schema(implementation = classOf[CopyTasksResponse]),
            examples = Array(new ExampleObject(TaskApiDoc.copyTaskResponseJsonExample))
          )
        )
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    )
  )
  @RequestBody(
    description = "The copy task request.",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        schema = new Schema(implementation = classOf[CopyTasksRequest]),
        examples = Array(new ExampleObject(TaskApiDoc.copyTaskRequestJsonExample))
      ))
  )
  def copyTask(@Parameter(
                 name = "project",
                 description = "The project identifier",
                 required = true,
                 in = ParameterIn.PATH,
                 schema = new Schema(implementation = classOf[String])
               )
               projectName: String,
               @Parameter(
                 name = "task",
                 description = "The task identifier",
                 required = true,
                 in = ParameterIn.PATH,
                 schema = new Schema(implementation = classOf[String])
               )
               taskName: String): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
    validateJson[CopyTasksRequest] { copyRequest =>
      val result = copyRequest.copyTask(projectName, taskName)
      Ok(Json.toJson(result))
    }
  }

  def cachesLoaded(projectName: String, taskName: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    val task = project.anyTask(taskName)
    val cachesLoaded = task.activities.filter(_.autoRun).forall(!_.status().isRunning)

    Ok(JsBoolean(cachesLoaded))
  }

  @Operation(
    summary = "Task output",
    description = "Downloads the contents of the first output dataset of the specified task. Note that this does not execute the task, but assumes that it has been executed already. The output dataset must be file based.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "The task output.",
      ),
      new ApiResponse(
        responseCode = "400",
        description = "If the output could not be downloaded. The reason is stated in the response body."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project or task does not exist."
      )
    )
  )
  def downloadOutput(@Parameter(
                       name = "project",
                       description = "The project identifier",
                       required = true,
                       in = ParameterIn.PATH,
                       schema = new Schema(implementation = classOf[String])
                     )
                     projectName: String,
                     @Parameter(
                       name = "task",
                       description = "The task identifier",
                       required = true,
                       in = ParameterIn.PATH,
                       schema = new Schema(implementation = classOf[String])
                     )
                     taskName: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = WorkspaceFactory().workspace.project(projectName)
    val task = project.anyTask(taskName)

    task.data.outputTasks.headOption match {
      case Some(outputId) =>
        project.taskOption[GenericDatasetSpec](outputId).map(_.data.plugin) match {
          case Some(ds: ResourceBasedDataset) =>
            ds.file match {
              case FileResource(file) =>
                Ok.sendFile(file)
              case _ =>
                ErrorResult(BAD_REQUEST, "Output resource is not a file", s"The specified output dataset '$outputId' is not based on a file resource.")
            }
          case Some(_) =>
            ErrorResult(BAD_REQUEST, "No resource based output dataset", s"The specified output dataset '$outputId' is not based on a resource.")
          case None =>
            ErrorResult(BAD_REQUEST, "Output dataset not found", s"The specified output dataset '$outputId' has not been found.")
        }
      case None =>
        ErrorResult(BAD_REQUEST, "No output dataset", "This task does not specify an output dataset.")
    }
  }

}


