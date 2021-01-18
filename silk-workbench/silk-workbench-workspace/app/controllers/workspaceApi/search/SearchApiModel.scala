package controllers.workspaceApi.search

import controllers.util.TextSearchUtils
import org.silkframework.config.{CustomTask, TaskSpec}
import org.silkframework.dataset.{Dataset, DatasetSpec}
import org.silkframework.rule.{LinkSpec, TransformSpec}
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.plugin.PluginDescription
import org.silkframework.runtime.serialization.WriteContext
import org.silkframework.runtime.validation.BadUserInputException
import org.silkframework.serialization.json.JsonSerializers.{TaskFormatOptions, TaskJsonFormat, TaskSpecJsonFormat}
import org.silkframework.workbench.workspace.{WorkbenchAccessMonitor, WorkspaceItem, WorkspaceProject, WorkspaceTask}
import org.silkframework.workspace.activity.workflow.Workflow
import org.silkframework.workspace.{Project, ProjectTask, WorkspaceFactory}
import play.api.libs.json._

import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer

/**
  * Data structures used for handling search requests
  */
object SearchApiModel {
  // Property names
  final val LABEL = "label"
  final val ID = "id"
  final val TYPE = "type"
  final val VALUES = "values"
  final val DESCRIPTION = "description"
  final val PROJECT_ID = "projectId"
  final val PROJECT_LABEL = "projectLabel"
  final val PLUGIN_ID = "pluginId"
  // type values
  final val PROJECT_TYPE = "project"
  /* JSON serialization */
  lazy implicit val responseOptionsReader: Reads[TaskFormatOptions] = Json.reads[TaskFormatOptions]
  lazy implicit val searchRequestReader: Reads[SearchRequest] = Json.reads[SearchRequest]
  lazy implicit val sortOrderReads: Reads[SortOrder.Value] = Reads.enumNameReads(SortOrder)
  lazy implicit val sortByReads: Reads[SortBy.Value] = Reads.enumNameReads(SortBy)
  lazy implicit val facetTypesReads: Reads[FacetType.Value] = Reads.enumNameReads(FacetType)
  lazy implicit val facetSettingReads: Reads[FacetSetting] = new Reads[FacetSetting] {
    override def reads(json: JsValue): JsResult[FacetSetting] = {
      (json \ TYPE).toOption.map(_.as[String]) match {
        case Some(facetType) if FacetType.keyword.toString == facetType => Json.fromJson[KeywordFacetSetting](json)
        case Some(invalidType) => throw BadUserInputException("No valid facet type specified: '" + invalidType + "'. Valid values are: " +
            FacetType.facetTypeSet.mkString(", "))
        case None => throw BadUserInputException("No 'type' property found in given JSON: " + json.toString())
      }
    }
  }
  lazy implicit val facetedSearchRequestReader: Reads[FacetedSearchRequest] = Json.reads[FacetedSearchRequest]
  lazy implicit val keywordFacetValueReads: Format[KeywordFacetValue] = Json.format[KeywordFacetValue]
  lazy implicit val facetResultWrites: Writes[FacetResult] = new Writes[FacetResult] {
    override def writes(facetResult: FacetResult): JsValue = {
      assert(FacetType.facetTypeSet.contains(facetResult.`type`), s"Facet type '${facetResult.`type`}' is not a valid facet type.")
      val facetValues: Seq[JsValue] = FacetType.withName(facetResult.`type`) match {
        case FacetType.keyword => facetResult.values map {
          case value: KeywordFacetValue => keywordFacetValueReads.writes(value)
        }
      }
      JsObject(Seq(
        ID -> JsString(facetResult.id),
        LABEL -> JsString(facetResult.label),
        DESCRIPTION -> JsString(facetResult.description),
        TYPE -> JsString(facetResult.`type`),
        VALUES -> JsArray(facetValues)
      ))
    }
  }

  /** The properties that can be sorted by. */
  object SortBy extends Enumeration {
    val label = Value
  }

  /** Sort order, ascending or descending. */
  object SortOrder extends Enumeration {
    val ASC, DESC = Value
  }

  /** The facet types that will correspond to a specific facet widget, e.g. keyword, number/date range. */
  object FacetType extends Enumeration {
    val keyword = Value

    val facetTypeSet: Set[String] = Set(keyword.toString)
  }

  /** Single facet filter setting */
  sealed trait FacetSetting {
    def `type`: FacetType.Value
    def facetId: String
  }
  case class KeywordFacetSetting(`type`: FacetType.Value,
                                 facetId: String,
                                 keywordIds: Set[String]) extends FacetSetting {
    if(!Facets.facetIds.contains(facetId)) {
      throw BadUserInputException(s"Unknown facet ID '$facetId'! Supported facet ID: " + Facets.facetIds.mkString(", "))
    }
  }

  object KeywordFacetSetting {
    implicit val keywordFacetSettingReads: Reads[KeywordFacetSetting] = Json.reads[KeywordFacetSetting]
  }

  object FacetedSearchRequest {
    final val DEFAULT_OFFSET = 0
    final val DEFAULT_LIMIT = 10
  }

  /** Common methods shared between all search requests */
  trait SearchRequestTrait {
    def project: Option[String]

    /**
      * Retrieves all projects that are selected by the request.
      */
    protected def projects(implicit userContext: UserContext): Seq[Project] = {
      project match {
        case Some(projectName) =>
          Seq(WorkspaceFactory().workspace.project(projectName))
        case None =>
          WorkspaceFactory().workspace.projects
      }
    }

    /**
      * Checks if a task matches the search term.
      */
    protected def matchesSearchTerm(lowerCaseSearchTerms: Seq[String], task: ProjectTask[_ <: TaskSpec]): Boolean = {
      val idMatch = matchesSearchTerm(lowerCaseSearchTerms, task.id)
      val labelMatch = matchesSearchTerm(lowerCaseSearchTerms, task.metaData.label)
      val descriptionMatch = matchesSearchTerm(lowerCaseSearchTerms, task.metaData.description.getOrElse(""))
      val propertiesMatch = task.data.properties(task.project.config.prefixes).exists(p => matchesSearchTerm(lowerCaseSearchTerms, p._2))
      idMatch || labelMatch || descriptionMatch || propertiesMatch
    }

    /** Match search terms against project. */
    protected def matchesSearchTerm(lowerCaseSearchTerms: Seq[String], project: Project): Boolean = {
      val idMatch = matchesSearchTerm(lowerCaseSearchTerms, project.config.id)
      val labelMatch = matchesSearchTerm(lowerCaseSearchTerms, project.config.metaData.label)
      val descriptionMatch = project.config.metaData.description.exists(d => matchesSearchTerm(lowerCaseSearchTerms, d))
      idMatch || labelMatch || descriptionMatch
    }

    protected def extractSearchTerms(term: String): Array[String] = {
      TextSearchUtils.extractSearchTerms(term)
    }

    protected def matchesSearchTerm(lowerCaseSearchTerms: Seq[String], searchIn: String*): Boolean = {
      TextSearchUtils.matchesSearchTerm(lowerCaseSearchTerms, searchIn :_*)
    }
  }

  /**
    * Representation of a facet.
    * @param id          The facet ID.
    * @param label       The facet label.
    * @param description The facet description.
    * @param facetType   The facet type, e.g. keyword facet, numeric range facet etc.
    */
  case class Facet(id: String, label: String, description: String, facetType: FacetType.Value)

  object Facets {
    // Dataset facets
    final val datasetType: Facet = Facet("datasetType", "Dataset type", "The concrete type of a dataset, e.g. its data model and format etc.", FacetType.keyword)
    final val fileResource: Facet = Facet("datasetFileResource", "Dataset file", "The file resource of a file based dataset.", FacetType.keyword)
    // Transformation facets
    final val transformInputResource: Facet = Facet("transformInputResource", "Transformed File Resource",
      "In case the input is a file resource based dataset, these are the file names of these resources.", FacetType.keyword)
    // Workflow facets
    final val workflowExecutionStatus: Facet = Facet("workflowExecutionStatus", "Last Execution Status", "Allows to filter by the" +
        " status of the last execution of the workflow.", FacetType.keyword)
    // Task facets
    final val taskType: Facet = Facet("taskType", "Task type", "The concrete type of a task.", FacetType.keyword)
    // Generic facets
    final val createdBy: Facet = Facet("createdBy", "Created by", "The user who created the item.", FacetType.keyword)
    final val lastModifiedBy: Facet = Facet("lastModifiedBy", "Last modified by", "The user who last modified the item.", FacetType.keyword)

    val facetIds: Seq[String] = Seq(datasetType, fileResource, taskType, transformInputResource, workflowExecutionStatus, createdBy, lastModifiedBy).map(_.id)
    assert(facetIds.distinct.size == facetIds.size, "Facet IDs must be unique!")
  }

  /** The property of the search item to sort by and the label to display in the UI. */
  case class SortableProperty(id: String, label: String)
  lazy implicit val sortablePropertyWrites: Writes[SortableProperty] = Json.writes[SortableProperty]

  /** The result of a faceted search. */
  case class FacetedSearchResult(total: Int,
                                 results: Seq[JsObject],
                                 sortByProperties: Seq[SortableProperty],
                                 facets: Seq[FacetResult])

  lazy implicit val facetedSearchResult: Writes[FacetedSearchResult] = Json.writes[FacetedSearchResult]

  type ProjectOrTask = Either[(ProjectTask[_ <: TaskSpec], TypedTasks), Project]

  /** Tasks of a specific item type, e.g. dataset, transform, workflow... */
  case class TypedTasks(project: String,
                        projectLabel: String,
                        itemType: ItemType,
                        tasks: Seq[ProjectTask[_ <: TaskSpec]])

  /** A search request that supports types and facets. */
  case class FacetedSearchRequest(project: Option[String] = None,
                                  itemType: Option[ItemType] = None,
                                  textQuery: Option[String] = None,
                                  offset: Option[Int] = None,
                                  limit: Option[Int] = None,
                                  sortBy: Option[SortBy.Value] = None,
                                  sortOrder: Option[SortOrder.Value] = None,
                                  facets: Option[Seq[FacetSetting]] = None) extends SearchRequestTrait {
    /** The offset used for paging. */
    def workingOffset: Int =  offset.getOrElse(FacetedSearchRequest.DEFAULT_OFFSET)

    /** The limit used for paging. */
    def workingLimit: Int = limit.getOrElse(FacetedSearchRequest.DEFAULT_LIMIT)

    /** Execute search request and return result list. */
    def apply()(implicit userContext: UserContext,
                accessMonitor: WorkbenchAccessMonitor): JsValue = {
      val ps: Seq[Project] = projects
      var tasks: Seq[TypedTasks] = ps.flatMap(fetchTasks)
      var selectedProjects: Seq[Project] = if(project.isEmpty && (itemType.contains(ItemType.project) || itemType.isEmpty)) ps else Seq()

      for(term <- textQuery if term.trim.nonEmpty) {
        val lowerCaseTerm = extractSearchTerms(term)
        tasks = tasks.map(typedTasks => filterTasksByTextQuery(typedTasks, lowerCaseTerm))
        selectedProjects = if(itemType.contains(ItemType.project) || itemType.isEmpty) selectedProjects.filter(p => matchesSearchTerm(lowerCaseTerm, p)) else Seq()
      }

      // facets are collected after filtering, so only non empty facets are displayed with correct counts
      val overallFacetCollector = OverallFacetCollector()
      val facetSettings = facets.getOrElse(Seq.empty)
      tasks = tasks.map(t => filterTasksByFacetSettings(t, overallFacetCollector, facetSettings))
      selectedProjects = selectedProjects.filter(p => overallFacetCollector.filterAndCollectProjects(p, facetSettings))
      val tasksWithTypedTask: Seq[ProjectOrTask] = tasks.flatMap(typedTasks =>
        typedTasks.tasks.map(typedTask => Left((typedTask, typedTasks))))
      val selectProjectsEither: Seq[ProjectOrTask] = selectedProjects.map(Right.apply)
      val projectsAndTasks: Seq[ProjectOrTask] = selectProjectsEither ++ tasksWithTypedTask
      val sorted = sort(projectsAndTasks)
      val resultWindow =
        if(workingLimit != 0) {
          sorted.slice(workingOffset, workingOffset + workingLimit)
        } else {
          sorted.drop(workingOffset)
        }
      val resultWindowJson = resultWindow map {
        case left @ Left((task, typedTasks)) => (toJson(task, typedTasks), left)
        case right @ Right(project) => (toJson(project), right)
      }
      val withItemLinks = addItemLinks(resultWindowJson)

      val facetResults = overallFacetCollector.results

      Json.toJson(FacetedSearchResult(
        total = sorted.size,
        results = withItemLinks,
        sortByProperties = Seq(SortableProperty("label", "Label")),
        facets = facetResults.toSeq
      ))
    }

    // Sort results according to request
    private def sort(projectOrTasks: Seq[ProjectOrTask])
                    (implicit accessMonitor: WorkbenchAccessMonitor,
                     userContext: UserContext): Seq[ProjectOrTask] = {
      sortBy match {
        case None =>
          sortByMostRecentlyViewed(projectOrTasks)
        case Some(by) =>
          val sortAsc = !sortOrder.contains(SortOrder.DESC)
          val fetchValue: ProjectOrTask => String = sortValueFunction(by)
          val sortFunction: (String, String) => Boolean = createSearchFunction(sortAsc)
          projectOrTasks.sortWith((left, right) => sortFunction(fetchValue(left), fetchValue(right)))
      }
    }

    // Sorts the result list by most recently viewed items of the user
    private def sortByMostRecentlyViewed(jsonResult: Seq[ProjectOrTask])
                                        (implicit accessMonitor: WorkbenchAccessMonitor,
                                         userContext: UserContext): Seq[ProjectOrTask] = {
      val userAccessItems = accessMonitor.getAccessItems.reverse // last item is the most recent item, so reverse
      val userAccessItemSet = userAccessItems.toSet
      val (recentlyViewed, others) = jsonResult.partition(projectOrTask => userAccessItemSet.contains(toWorkspaceItem(projectOrTask)))
      val recentlyViewedSorted = {
        val resultMap = recentlyViewed.map(projectOrTask => toWorkspaceItem(projectOrTask) -> projectOrTask).toMap
        for (userAccessItem <- userAccessItems if resultMap.contains(userAccessItem)) yield {
          resultMap(userAccessItem)
        }
      }
      recentlyViewedSorted ++ others
    }

    private def toWorkspaceItem(projectOrTask: ProjectOrTask)
                                 (implicit accessMonitor: WorkbenchAccessMonitor): WorkspaceItem = {
      projectOrTask match {
        case Right(project) =>
          WorkspaceProject(project.name)
        case Left((projectTask, _)) =>
          WorkspaceTask(projectTask.project.name, projectTask.id)
      }
    }

    override protected def matchesSearchTerm(lowerCaseSearchTerms: Seq[String], task: ProjectTask[_ <: TaskSpec]): Boolean = {
      val taskLabel = task.metaData.label
      val name = if(taskLabel.trim != "") taskLabel else task.id.toString
      // also search in project if search is not restricted to a specific project
      val searchInProject = if(project.isEmpty) label(task.project) else ""
      matchesSearchTerm(lowerCaseSearchTerms, name, task.metaData.description.getOrElse(""), searchInProject)
    }

    // Adds links to related pages to the result item
    private def addItemLinks(results: Seq[(JsObject, ProjectOrTask)]): Seq[JsObject] = {

      results map { case (resultJson, projectOrTask) =>
        val project = jsonPropertyStringValue(resultJson, PROJECT_ID)
        val itemId = jsonPropertyStringValue(resultJson, ID)
        val links: Seq[ItemLink] = ItemType.itemTypeFormat.reads(resultJson.value(TYPE)).asOpt match {
          case Some(itemType) =>
            ItemType.itemTypeLinks(itemType, project, itemId, projectOrTask.left.toOption.map(_._1.data))
          case None =>
            Seq.empty
        }
        resultJson + ("itemLinks" -> JsArray(links.map(ItemLink.itemLinkFormat.writes)))
      }
    }

    private def jsonPropertyStringValue(result: JsObject, property: String): String = {
      result.value.get(property).map(_.as[String]).getOrElse("")
    }

    private def filterTasksByTextQuery(typedTasks: TypedTasks,
                                       lowerCaseTerms: Seq[String]): TypedTasks = {
      typedTasks.copy(tasks = typedTasks.tasks.filter { task => matchesSearchTerm(lowerCaseTerms, task) })
    }

    private def filterTasksByFacetSettings(typedTasks: TypedTasks,
                                           facetCollector: OverallFacetCollector,
                                           facetSettings: Seq[FacetSetting]): TypedTasks = {
      itemType match {
        case Some(typ) if typedTasks.itemType == typ =>
          typedTasks.copy(tasks = typedTasks.tasks.filter { task => facetCollector.filterAndCollectByItemType(typ, task, facetSettings) })
        case _ =>
          typedTasks.copy(tasks = typedTasks.tasks.filter { task => facetCollector.filterAndCollectAllItems(task, facetSettings)})
      }
    }

    /** Fetches the tasks. If the item type is defined, it will only fetch tasks of a specific type. */
    private def fetchTasks(project: Project)
                          (implicit userContext: UserContext): Seq[TypedTasks] = {
      itemType match {
        case Some(t) =>
          Seq(fetchTasksOfType(project, t))
        case None =>
          val result = new ArrayBuffer[TypedTasks]()
          for (it <- ItemType.ordered.filter(_ != ItemType.project)) {
            result.append(fetchTasksOfType(project, it))
          }
          result
      }
    }

    /** Fetch tasks of a specific type. */
    def fetchTasksOfType(project: Project,
                         itemType: ItemType)
                        (implicit userContext: UserContext): TypedTasks = {
      val tasks = itemType match {
        case ItemType.dataset => project.tasks[DatasetSpec[Dataset]]
        case ItemType.linking => project.tasks[LinkSpec]
        case ItemType.transform => project.tasks[TransformSpec]
        case ItemType.workflow => project.tasks[Workflow]
        case ItemType.task => project.tasks[CustomTask]
        case ItemType.project => Seq.empty
      }
      TypedTasks(project.name, project.config.metaData.label ,itemType, tasks)
    }

    private def toJson(project: Project): JsObject = {
      JsObject(
        Seq(
          TYPE -> JsString(PROJECT_TYPE),
          ID -> JsString(project.config.id),
          LABEL -> JsString(label(project))
        ) ++ project.config.metaData.description.toSeq.map { desc =>
          DESCRIPTION -> JsString(desc)
        }
      )
    }

    private def toJson(typedTasks: TypedTasks): Seq[JsObject] = {
      typedTasks.tasks.map(t => toJson(t, typedTasks))
    }

    private def toJson(task: ProjectTask[_ <: TaskSpec],
                       typedTask: TypedTasks): JsObject = {
      JsObject(Seq(
        PROJECT_ID -> JsString(typedTask.project),
        PROJECT_LABEL -> JsString(typedTask.projectLabel),
        TYPE -> JsString(typedTask.itemType.id),
        ID -> JsString(task.id),
        LABEL -> JsString(label(task)),
        DESCRIPTION -> JsString(""),
        PLUGIN_ID -> JsString(PluginDescription(task).id)
      ) ++ task.metaData.description.map(d => DESCRIPTION -> JsString(d)))
    }
  }

  private def label(project: Project): String = {
    if(project.config.metaData.label.trim.nonEmpty) {
      project.config.metaData.label.trim
    } else {
      project.name
    }
  }

  private def label(task: ProjectTask[_ <: TaskSpec]): String = {
    task.taskLabel(Int.MaxValue)
  }

  private def label(projectOrTask: ProjectOrTask): String = {
    projectOrTask match {
      case Left((task, _)) => label(task)
      case Right(project) => label(project)
    }
  }

  /** Function that extracts a value from the JSON object. */
  private def sortValueFunction(by: SortBy.Value): ProjectOrTask => String = {
    // memorize converted values in order to not recompute
    val valueMapping = mutable.HashMap[ProjectOrTask, String]()
    projectOrTask: ProjectOrTask => {
      valueMapping.getOrElseUpdate(
        projectOrTask,
        by match {
          case SortBy.label => label(projectOrTask).toLowerCase
        }
      )
    }
  }

  private def createSearchFunction(sortAsc: Boolean): (String, String) => Boolean = {
    if (sortAsc) {
      (left: String, right: String) => left < right
    } else {
      (left: String, right: String) => left > right
    }
  }

  /** A simple text based search request. The text query has to match as a whole. */
  case class SearchRequest(project: Option[String],
                           searchTerm: Option[String],
                           formatOptions: Option[TaskFormatOptions]) extends SearchRequestTrait {

    // JSON format to serialize tasks according to the options
    private def taskFormat(userContext: UserContext): TaskJsonFormat[TaskSpec] = {
      new TaskJsonFormat[TaskSpec](formatOptions.getOrElse(TaskFormatOptions()), Some(userContext))
    }

    /**
      * Executes the search request and generates the JSON response.
      */
    def apply()(implicit userContext: UserContext): JsValue = {
      var tasks = projects.flatMap(_.allTasks)

      for(term <- searchTerm) {
        val lowerCaseTerm = extractSearchTerms(term)
        tasks = tasks.filter(task => matchesSearchTerm(lowerCaseTerm, task))
      }

      JsArray(tasks.map(writeTask))
    }

    private def writeTask(task: ProjectTask[_ <: TaskSpec])
                         (implicit userContext: UserContext): JsValue = {
      taskFormat(userContext).write(task)(WriteContext[JsValue](prefixes = task.project.config.prefixes, projectId = Some(task.project.name)))
    }
  }
}
