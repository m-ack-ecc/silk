package controllers.projectApi

import config.WorkbenchConfig
import controllers.core.UserContextActions
import controllers.core.util.ControllerUtilsTrait
import controllers.projectApi.ProjectApi.{CreateTagsRequest, ProjectTagsResponse}
import controllers.projectApi.doc.ProjectApiDoc
import controllers.workspace.JsonSerializer
import controllers.workspaceApi.project.ProjectApiRestPayloads.{ItemMetaData, ProjectCreationData}
import controllers.workspaceApi.project.ProjectLoadingErrors
import controllers.workspaceApi.projectTask.{ItemCloneRequest, ItemCloneResponse}
import controllers.workspaceApi.search.ItemType
import io.swagger.v3.oas.annotations.enums.ParameterIn
import io.swagger.v3.oas.annotations.headers.Header
import io.swagger.v3.oas.annotations.media.{ArraySchema, Content, ExampleObject, Schema}
import io.swagger.v3.oas.annotations.parameters.RequestBody
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.{Tag => OpenApiTag}
import io.swagger.v3.oas.annotations.{Operation, Parameter}
import org.silkframework.config.{MetaData, Prefixes, Tag}
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.resource.ResourceManager
import org.silkframework.runtime.validation.BadUserInputException
import org.silkframework.serialization.json.MetaDataSerializers.{FullTag, MetaDataExpanded, MetaDataPlain, tagFormat}
import org.silkframework.util.{Identifier, IdentifierUtils}
import org.silkframework.workbench.workspace.WorkbenchAccessMonitor
import org.silkframework.workspace.exceptions.IdentifierAlreadyExistsException
import org.silkframework.workspace.io.WorkspaceIO
import org.silkframework.workspace.{Project, ProjectConfig}
import play.api.libs.json.{Format, JsValue, Json}
import play.api.mvc.{Action, AnyContent, InjectedController}

import java.net.URI
import javax.inject.Inject
import scala.util.Try

/**
  * REST API for project artifacts.
  */
@OpenApiTag(name = "Projects", description = "Access to all projects in the workspace.")
class ProjectApi @Inject()(accessMonitor: WorkbenchAccessMonitor) extends InjectedController with UserContextActions with ControllerUtilsTrait {
  /** validate the project id field by ensuring it's unique and corresponds to the right format **/
  @Operation(
    summary = "validates custom project id",
    description = "Receives a custom ID and checks for uniqueness and validity.",
    responses = Array(
      new ApiResponse(
        responseCode = "204",
        description = "The custom ID is both valid and unique.",
      ),
      new ApiResponse(
        responseCode = "400",
        description = "The custom ID is not valid.",
      ),
      new ApiResponse (
        responseCode = "409",
        description = "The custom ID isn't unique, i.e, there is an existing project with the same ID.",
      )
    )
  )
  def validateIdentifier(
                         @Parameter(
                           name = "identifier",
                           description = "the custom project id set by the user",
                           required = true,
                           in = ParameterIn.QUERY,
                           schema = new Schema(implementation = classOf[String])
                         )
                         projectIdentifier: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val projectId = Try(Identifier(projectIdentifier)).fold(
      ex =>
        throw new BadUserInputException("Invalid identifier", Some(ex)),
      id => id)
    if(projectExists(projectId)) {
      throw IdentifierAlreadyExistsException(s"Project id '$projectIdentifier' is not unique as there is already a project with this name.")
    }
    NoContent
  }


  /** Create a project given the meta data. Automatically generates an ID. */
  @Operation(
    summary = "Create project",
    description = "Create a new project by specifying a label and an optional description.",
    responses = Array(
      new ApiResponse(
        responseCode = "201",
        description = "The project has been added. The URI of the new project is returned, which includes the automatically generated project ID.",
        headers = Array(
          new Header(
            name = "Location",
            description = "The URI of the new project",
            schema = new Schema(example = "/api/workspace/projects/projectx42")
          ))
      )
    ))
  @RequestBody(
    description = "Project metadata",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        schema = new Schema(implementation = classOf[ProjectCreationData]),
        examples = Array(new ExampleObject("{ \"id\": \"Project id\" \"metaData\": { \"label\": \"Project label\", \"description\": \"Project description\" } }"))
      ))
  )
  def createNewProject(): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
      validateJson[ProjectCreationData] { projectCreationData =>
        val id = projectCreationData.id
        val metaData = projectCreationData.metaData.asMetaData
        val generatedId = metaData.label match {
          case Some(label) if label.trim.nonEmpty =>
            IdentifierUtils.generateProjectId(label)
          case _ =>
            throw BadUserInputException("The label must not be empty!")
        }
        val projectId = id match {
           case Some(v) => Identifier(v)
           case None => generatedId
        }
        val project = workspace.createProject(ProjectConfig(projectId, metaData = cleanUpMetaData(metaData).asNewMetaData))
        Created(JsonSerializer.projectJson(project)).
            withHeaders(LOCATION -> s"${WorkbenchConfig.applicationContext}/api/workspace/projects/$projectId")
      }
  }

  /** Clone a project (resources and tasks) based on new meta data. */
  @Operation(
    summary = "Clone project",
    description = "Clones an existing project.",
    responses = Array(
      new ApiResponse(
        responseCode = "201",
        description = "The body contains the meta data of the to be created project. The label is required and must not be empty. The description is optional.",
        content = Array(new Content(
          mediaType = "application/json",
          schema = new Schema(implementation = classOf[ItemCloneResponse])
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  @RequestBody(
    description = "The generated ID and the link to the project details page.",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        schema = new Schema(implementation = classOf[ItemCloneRequest]),
        examples = Array(new ExampleObject("{ \"metaData\": { \"label\": \"New project\", \"description\": \"Optional description\" } }"))
      ))
  )
  def cloneProject(@Parameter(
                     name = "projectId",
                     description = "The identifier of the project that is to be cloned",
                     required = true,
                     in = ParameterIn.PATH,
                     schema = new Schema(implementation = classOf[String])
                   )
                   fromProjectId: String): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
    validateJson[ItemCloneRequest] { request =>
      val label = request.metaData.label.trim
      if(label == "") {
        throw BadUserInputException("The label must not be empty!")
      }
      val generatedId = IdentifierUtils.generateProjectId(label)
      val project = getProject(fromProjectId)
      val requestMetaData = request.metaData.asMetaData
      val clonedProjectConfig = project.config.copy(id = generatedId, metaData = requestMetaData.copy(tags = requestMetaData.tags ++ project.metaData.tags))
      val clonedProject = workspace.createProject(clonedProjectConfig.copy(projectResourceUriOpt = Some(clonedProjectConfig.generateDefaultUri)))
      WorkspaceIO.copyResources(project.resources, clonedProject.resources)
      // Clone task spec, since task specs may contain state, e.g. RDF file dataset
      implicit val resourceManager: ResourceManager = clonedProject.resources
      implicit val prefixes: Prefixes = clonedProject.config.prefixes
      // Clone tags
      for (tag <- project.tagManager.allTags()) {
        clonedProject.tagManager.putTag(tag)
      }
      // Clone tasks
      for (task <- project.allTasks) {
        val clonedTaskSpec = Try(task.data.withProperties(Map.empty)).getOrElse(task.data)
        clonedProject.addAnyTask(task.id, clonedTaskSpec, task.metaData.asNewMetaData)
      }
      val projectLink = ItemType.itemDetailsPage(ItemType.project, generatedId, generatedId).path
      Created(Json.toJson(ItemCloneResponse(generatedId, projectLink)))
    }
  }

  private def cleanUpMetaData(metaData: MetaData) = {
    MetaData(metaData.label.map(_.trim).filter(_.nonEmpty), metaData.description.filter(_.trim.nonEmpty))
  }

  /** Update the project meta data. */
  @Operation(
    summary = "Update project metadata",
    description = "Update the meta data of the project, i.e. the label and description.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          schema = new Schema(implementation = classOf[MetaDataPlain]),
          examples = Array(new ExampleObject("{ \"label\": \"New label\", \"description\": \"New description\", \"modified\":\"2020-04-29T13:51:00.349Z\" }"))
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  @RequestBody(
    description = "Updated meta data of the project, i.e. the label and description.",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        schema = new Schema(implementation = classOf[ItemMetaData]),
        examples = Array(new ExampleObject("{ \"label\": \"New label\", \"description\": \"New description\" }"))
      ))
  )
  def updateProjectMetaData(@Parameter(
                               name = "projectId",
                               description = "The project identifier",
                               required = true,
                               in = ParameterIn.PATH,
                               schema = new Schema(implementation = classOf[String])
                             )
                             projectId: String): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
    val project = workspace.project(projectId)
    validateJson[ItemMetaData] { newMetaData =>
      val cleanedNewMetaData = newMetaData.asMetaData
      val oldProjectMetaData = project.config.metaData
      val mergedMetaData = oldProjectMetaData.copy(label = cleanedNewMetaData.label, description = cleanedNewMetaData.description, tags = cleanedNewMetaData.tags)
      val updatedMetaData = project.updateMetaData(mergedMetaData.asUpdatedMetaData)
      Ok(Json.toJson(MetaDataPlain.fromMetaData(updatedMetaData)))
    }
  }

  /** Fetches the meta data of a project. */
  @Operation(
    summary = "Retrieve project metadata",
    description = "Metadata of the project, such as the label and description.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          schema = new Schema(implementation = classOf[MetaDataPlain]),
          examples = Array(new ExampleObject("{ \"label\": \"New label\", \"description\": \"New description\", \"modified\":\"2020-04-29T13:51:00.349Z\" }"))
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def getProjectMetaData(@Parameter(
                            name = "projectId",
                            description = "The project identifier",
                            required = true,
                            in = ParameterIn.PATH,
                            schema = new Schema(implementation = classOf[String])
                          )
                          projectId: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    Ok(Json.toJson(MetaDataPlain.fromMetaData(getProject(projectId).config.metaData)))
  }

  @Operation(
    summary = "Retrieve expanded project metadata",
    description = "Metadata of the project, such as the label and description.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          schema = new Schema(implementation = classOf[MetaDataExpanded])
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def getProjectMetaDataExpanded(@Parameter(
                                   name = "projectId",
                                   description = "The project identifier",
                                   required = true,
                                   in = ParameterIn.PATH,
                                   schema = new Schema(implementation = classOf[String])
                                 )
                                 projectId: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = getProject(projectId)
    Ok(Json.toJson(MetaDataExpanded.fromMetaData(project.config.metaData, project.tagManager)))
  }

  /** Returns all project prefixes */
  @Operation(
    summary = "Project prefixes",
    description = "Project namespace prefix definitions that map from a prefix name to a URI prefix.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          examples = Array(new ExampleObject("{ \"rdf\": \"http://www.w3.org/1999/02/22-rdf-syntax-ns#\", \"foaf\": \"http://xmlns.com/foaf/0.1/\", \"customPrefix\": \"http://customPrefix.cc/\" }"))
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def fetchProjectPrefixes(@Parameter(
                             name = "projectId",
                             description = "The project identifier",
                             required = true,
                             in = ParameterIn.PATH,
                             schema = new Schema(implementation = classOf[String])
                           )
                           projectId: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = getProject(projectId)
    accessMonitor.saveProjectAccess(project.config.id) // Only accessed on the project details page
    Ok(Json.toJson(project.config.prefixes.prefixMap))
  }

  /** Add or update project prefix. */
  @Operation(
    summary = "Add project prefix",
    description = "Create or update the prefix URI for a specific prefix name.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          examples = Array(new ExampleObject("{ \"rdf\": \"http://www.w3.org/1999/02/22-rdf-syntax-ns#\", \"foaf\": \"http://xmlns.com/foaf/0.1/\", \"customPrefix\": \"http://customPrefix.cc/\" }"))
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  @RequestBody(
    description = "The prefix URI.",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        schema = new Schema(implementation = classOf[String]),
        examples = Array(new ExampleObject("\"http://custom.prefix/\""))
      ))
  )
  def addProjectPrefix(@Parameter(
                         name = "projectId",
                         description = "The project identifier",
                         required = true,
                         in = ParameterIn.PATH,
                         schema = new Schema(implementation = classOf[String])
                       )
                       projectId: String,
                       @Parameter(
                         name = "prefixName",
                         description = "The prefix name",
                         required = true,
                         in = ParameterIn.PATH,
                         schema = new Schema(implementation = classOf[String])
                       )
                       prefixName: String): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
    val project = getProject(projectId)
    validateJson[String] { prefixUri =>
      if(Try(new URI(prefixUri)).map(_.isAbsolute).getOrElse(false)) {
        val newPrefixes = Prefixes(project.config.prefixes.prefixMap ++ Map(prefixName -> prefixUri))
        project.config = project.config.copy(prefixes = newPrefixes)
        Ok(Json.toJson(newPrefixes.prefixMap))
      } else {
        throw BadUserInputException("Invalid URI prefix: " + prefixUri)
      }
    }
  }

  /** Delete a project prefix */
  @Operation(
    summary = "Remove project prefix",
    description = "Deletes a prefix definition.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "The prefix has been removed.",
        content = Array(new Content(
          mediaType = "application/json",
          examples = Array(new ExampleObject("{ \"rdf\": \"http://www.w3.org/1999/02/22-rdf-syntax-ns#\", \"foaf\": \"http://xmlns.com/foaf/0.1/\" }"))
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def deleteProjectPrefix(@Parameter(
                            name = "projectId",
                            description = "The project identifier",
                            required = true,
                            in = ParameterIn.PATH,
                            schema = new Schema(implementation = classOf[String])
                          )
                          projectId: String,
                          @Parameter(
                            name = "prefixName",
                            description = "The prefix name",
                            required = true,
                            in = ParameterIn.PATH,
                            schema = new Schema(implementation = classOf[String])
                          )
                          prefixName: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = getProject(projectId)
    val newPrefixes = Prefixes(project.config.prefixes.prefixMap - prefixName)
    project.config = project.config.copy(prefixes = newPrefixes)
    Ok(Json.toJson(newPrefixes.prefixMap))
  }

  @Operation(
    summary = "Get tags",
    description = "Retrieves all tags from a project.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          schema = new Schema(implementation = classOf[ProjectTagsResponse])
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def fetchTags(@Parameter(
                  name = "projectId",
                  description = "The project identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                projectId: String,
                @Parameter(
                  name = "filter",
                  description = "Optional filter term. Only tags that contain the given term will be returned.",
                  required = false,
                  in = ParameterIn.QUERY,
                  schema = new Schema(implementation = classOf[String])
                )
                filter: Option[String] = None
               ): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = getProject(projectId)
    val tags = project.tagManager.allTags()
    val filteredTags = filter match {
      case Some(search) =>
        // Find matching tags
        val lowerCaseSearch = search.toLowerCase
        val matchingTags = tags.filter(_.label.toLowerCase.contains(lowerCaseSearch))
        // Sort tags
        val ordering: Ordering[Tag] = (x: Tag, y: Tag) => {
          val xPrefixMatch = x.label.toLowerCase.startsWith(lowerCaseSearch)
          val yPrefixMatch = y.label.toLowerCase.startsWith(lowerCaseSearch)
          if (xPrefixMatch && !yPrefixMatch) {
            -1
          } else if (!xPrefixMatch && yPrefixMatch) {
            1
          } else {
            x.label.compareToIgnoreCase(y.label)
          }
        }
        val rankedTags = matchingTags.toSeq.sorted(ordering)
        rankedTags
      case None =>
        tags.toSeq.sortBy(_.label.toLowerCase)
    }
    Ok(Json.toJson(ProjectTagsResponse.fromTags(filteredTags)))
  }

  @Operation(
    summary = "Create/Update tags",
    description = "Create or update tags.",
    responses = Array(
      new ApiResponse(
        responseCode = "204",
        description = "Success",
        content = Array(new Content(
          mediaType = "application/json",
          schema = new Schema(implementation = classOf[FullTag])
        ))
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  @RequestBody(
    description = "The tags.",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json",
        schema = new Schema(implementation = classOf[CreateTagsRequest])
      ))
  )
  def createTags(@Parameter(
                   name = "projectId",
                   description = "The project identifier",
                   required = true,
                   in = ParameterIn.PATH,
                   schema = new Schema(implementation = classOf[String])
                )
                projectId: String): Action[JsValue] = RequestUserContextAction(parse.json) { implicit request => implicit userContext =>
    validateJson[CreateTagsRequest] { request =>
      val response = request.execute(getProject(projectId))
      Ok(Json.toJson(response))
    }
  }

  @Operation(
    summary = "Remove tag",
    description = "Deletes a tag.",
    responses = Array(
      new ApiResponse(
        responseCode = "204",
        description = "The tag has been removed."
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def deleteTag(@Parameter(
                  name = "projectId",
                  description = "The project identifier",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                projectId: String,
                @Parameter(
                  name = "tag",
                  description = "The tag URI",
                  required = true,
                  in = ParameterIn.PATH,
                  schema = new Schema(implementation = classOf[String])
                )
                tag: String): Action[AnyContent] = UserContextAction { implicit userContext =>
    val project = getProject(projectId)
    project.tagManager.deleteTag(tag)
    NoContent
  }

  /** Get an error report for tasks that failed loading. */
  @Operation(
    summary = "Project task loading error report",
    description = "Get a detailed loading error report for a specific project task that could not be loaded in the project.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(
          new Content(
            mediaType = "application/json",
            examples = Array(new ExampleObject(ProjectApiDoc.taskLoadingErrorReportJsonExample))
          ),
          new Content(
            mediaType = "text/markdown",
            examples = Array(new ExampleObject(ProjectApiDoc.taskLoadingErrorReportMarkdownExample))
          )
        )
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def projectTaskLoadingErrorReport(@Parameter(
                                      name = "projectId",
                                      description = "The project identifier",
                                      required = true,
                                      in = ParameterIn.PATH,
                                      schema = new Schema(implementation = classOf[String])
                                    )
                                    projectId: String,
                                    @Parameter(
                                      name = "taskId",
                                      description = "The task identifier",
                                      required = true,
                                      in = ParameterIn.PATH,
                                      schema = new Schema(implementation = classOf[String])
                                    )
                                    taskId: String): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val project = getProject(projectId)
    project.loadingErrors.find(_.taskId == taskId) match {
      case Some(loadingError) =>
        val failedTask = ProjectLoadingErrors.fromTaskLoadingError(loadingError)
        val taskLabel = failedTask.taskLabel.filter(_.trim != "").getOrElse(failedTask.taskId)
        render {
          case AcceptsMarkdown() =>
            val markdownHeader = s"""# Project task loading error report
                                    |
                                    |Task '$taskLabel' in project '${project.config.metaData.label}' has failed loading.
                                    |
                                    |""".stripMargin
            Ok(markdownHeader + failedTask.asMarkdown(None)).as(MARKDOWN_MIME)
          case Accepts.Json() => // default is JSON
            Ok(Json.toJson(failedTask))
        }
      case None =>
        NotFound
    }
  }

  /** Get an error report for tasks that failed loading. */
  @Operation(
    summary = "Project tasks loading error report",
    description = "Get a detailed loading error report for all tasks that could not be loaded in a project.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = "Success",
        content = Array(
          new Content(
            mediaType = "application/json",
            examples = Array(new ExampleObject(ProjectApiDoc.taskLoadingErrorReportJsonExample))
          ),
          new Content(
            mediaType = "text/markdown",
            examples = Array(new ExampleObject(ProjectApiDoc.taskLoadingErrorReportMarkdownExample))
          )
        )
      ),
      new ApiResponse(
        responseCode = "404",
        description = "If the project does not exist."
      )
    ))
  def projectTasksLoadingErrorReport(@Parameter(
                                      name = "projectId",
                                      description = "The project identifier",
                                      required = true,
                                      in = ParameterIn.PATH,
                                      schema = new Schema(implementation = classOf[String])
                                    )
                                    projectId: String): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val project = getProject(projectId)
    val failedTasks = project.loadingErrors.map(ProjectLoadingErrors.fromTaskLoadingError)
    render {
      case AcceptsMarkdown() =>
        val sb = new StringBuilder()
        val markdownHeader = s"""# Project Tasks Loading Error Report
                               |
                               |In project '${project.config.metaData.label}' ${failedTasks.size} task/s could not be loaded.
                               |""".stripMargin
        sb.append(markdownHeader)
        for((failedTask, idx) <- failedTasks.zipWithIndex) {
          sb.append("\n").append(failedTask.asMarkdown(Some(idx + 1)))
        }
        Ok(sb.toString()).withHeaders("Content-type" -> MARKDOWN_MIME)
      case Accepts.Json() => // default is JSON
        Ok(Json.toJson(failedTasks))
    }
  }



}

object ProjectApi {

  @Schema(description = "Lists all user-defined tags.")
  case class ProjectTagsResponse(@ArraySchema(schema = new Schema(implementation = classOf[FullTag]))
                                 tags: Seq[FullTag])

  object ProjectTagsResponse {

    def fromTags(tags: Seq[Tag]): ProjectTagsResponse = {
      ProjectTagsResponse(tags.map(FullTag.fromTag))
    }

  }

  case class CreateTag(@Schema(description = "The URI of the new tag. Leave empty to generate a new URI automatically.", required = false, nullable = true)
                       uri: Option[String],
                       @Schema(description = "Default label of the tag.", required = true, example = "My Tag")
                       label: String)

  @Schema(description = "Request to add a new tag.")
  case class CreateTagsRequest(@ArraySchema(
                                 schema = new Schema(
                                   description = "The list of tags to be added.",
                                   implementation = classOf[CreateTag]
                                 )
                               )
                               tags: Iterable[CreateTag]) {

    def execute(project: Project)
               (implicit userContext: UserContext): Iterable[FullTag] = {
      for (tag <- tags) yield {
        val normalizedLabel = tag.label.trim.replaceAll("\\s+", " ")
        val uri = tag.uri match {
          case Some(userUri) =>
            userUri
          case None =>
            project.tagManager.generateTagUri(normalizedLabel)
        }
        val newTag = Tag(uri, normalizedLabel)
        project.tagManager.putTag(newTag)
        FullTag.fromTag(newTag)
      }
    }
  }

  implicit val projectTagsResponseFormat: Format[ProjectTagsResponse] = Json.format[ProjectTagsResponse]
  implicit val createTagFormat: Format[CreateTag] = Json.format[CreateTag]
  implicit val createTagsRequestFormat: Format[CreateTagsRequest] = Json.format[CreateTagsRequest]
}