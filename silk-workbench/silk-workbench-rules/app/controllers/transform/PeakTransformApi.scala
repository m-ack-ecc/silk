package controllers.transform

import controllers.core.UserContextActions
import controllers.transform.PeakTransformApi._
import controllers.transform.doc.PeakApiDoc
import controllers.util.ProjectUtils._
import controllers.util.SerializationUtils._
import io.swagger.v3.oas.annotations.enums.ParameterIn
import io.swagger.v3.oas.annotations.media.{Content, ExampleObject, Schema}
import io.swagger.v3.oas.annotations.parameters.RequestBody
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import io.swagger.v3.oas.annotations.{Operation, Parameter}
import org.silkframework.config.{PlainTask, Prefixes, TaskSpec}
import org.silkframework.dataset.DatasetSpec.GenericDatasetSpec
import org.silkframework.dataset._
import org.silkframework.dataset.rdf.{RdfDataset, SparqlEndpointEntityTable}
import org.silkframework.entity._
import org.silkframework.entity.paths.{Path, UntypedPath}
import org.silkframework.plugins.dataset.rdf.executors.LocalSparqlSelectExecutor
import org.silkframework.plugins.dataset.rdf.tasks.SparqlSelectCustomTask
import org.silkframework.rule.TransformSpec.RuleSchemata
import org.silkframework.rule.{TransformRule, TransformSpec}
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.serialization.ReadContext
import org.silkframework.runtime.validation.ValidationException
import org.silkframework.util.Identifier
import org.silkframework.workspace.{Project, ProjectTask}
import play.api.libs.json.{Format, Json, Writes}
import play.api.mvc._

import javax.inject.Inject
import scala.collection.mutable.ArrayBuffer
import scala.util.control.NonFatal

@Tag(name = "Transform")
class PeakTransformApi @Inject() () extends InjectedController with UserContextActions {

    /**
    * Get sample source and transformed values for a named rule.
    */
  @Operation(
    summary = "Mapping Rule Transformation Examples",
    description = "Get transformation examples for the selected transformation rule. The input task of the transformation task has to be a Dataset task. Also the Dataset task must support this feature.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = PeakApiDoc.peakResultDoc,
        content = Array(
          new Content(
            mediaType = "application/json",
            examples = Array(new ExampleObject(PeakApiDoc.peakExample))
          )
        )
      )
  ))
  def peak( @Parameter(
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
              name = "rule",
              description = "The rule identifier",
              required = true,
              in = ParameterIn.PATH,
              schema = new Schema(implementation = classOf[String])
            )
            ruleName: String,
            @Parameter(
              name = "limit",
              description = "The maximum number of transformed example entities.",
              required = false,
              in = ParameterIn.QUERY,
              schema = new Schema(implementation = classOf[Int], defaultValue = TRANSFORMATION_PREVIEW_LIMIT_STR)
            )
            limit: Int = TRANSFORMATION_PREVIEW_LIMIT,
            @Parameter(
              name = "maxTryEntities",
              description = "The maximum number of example entities to try to transform before giving up.",
              required = false,
              in = ParameterIn.QUERY,
              schema = new Schema(implementation = classOf[Int], defaultValue = MAX_TRY_ENTITIES_DEFAULT_STR)
            )
            maxTryEntities: Int = MAX_TRY_ENTITIES_DEFAULT): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
      val (project, task) = projectAndTask(projectName, taskName)
      val transformSpec = task.data
      val ruleSchemata = transformSpec.oneRuleEntitySchemaById(ruleName).get
      val inputTaskId = transformSpec.selection.inputId

      peakRule(project, inputTaskId, ruleSchemata, limit, maxTryEntities)
  }

  /**
    * Get sample source and transformed values for a provided rule definition.
    */
  @Operation(
    summary = "Mapping Rule from Request Transformation Examples",
    description = "Get transformation examples for the transformation rule that is attached in the body of this request. The input task of the transformation task has to be a Dataset task. Also the Dataset task must support this feature.",
    responses = Array(
      new ApiResponse(
        responseCode = "200",
        description = PeakApiDoc.peakResultDoc,
        content = Array(
          new Content(
            mediaType = "application/json",
            examples = Array(new ExampleObject(PeakApiDoc.peakExample))
          )
        )
      )
  ))
  @RequestBody(
    description = "The rule to be used for retrieving example values.",
    required = true,
    content = Array(
      new Content(
        mediaType = "application/json"
      ),
      new Content(
        mediaType = "application/xml"
      )
    )
  )
  def peakChildRule(@Parameter(name = "project", description = "The project identifier",
                      required = true,
                      in = ParameterIn.PATH,
                      schema = new Schema(implementation = classOf[String])
                    )
                    projectName: String,
                    @Parameter(name = "task", description = "The task identifier",
                      required = true,
                      in = ParameterIn.PATH,
                      schema = new Schema(implementation = classOf[String])
                    )
                    taskName: String,
                    @Parameter(name = "rule", description = "The rule identifier",
                      required = true,
                      in = ParameterIn.PATH,
                      schema = new Schema(implementation = classOf[String])
                    )
                    ruleName: String,
                    @Parameter(name = "limit", description = "The maximum number of transformed example entities.",
                      required = false,
                      in = ParameterIn.QUERY,
                      schema = new Schema(implementation = classOf[Int], defaultValue = TRANSFORMATION_PREVIEW_LIMIT_STR)
                    )
                    limit: Int = TRANSFORMATION_PREVIEW_LIMIT,
                    @Parameter(name = "maxTryEntities", description = "The maximum number of example entities to try to transform before giving up.",
                      required = false,
                      in = ParameterIn.QUERY,
                      schema = new Schema(implementation = classOf[Int], defaultValue = MAX_TRY_ENTITIES_DEFAULT_STR)
                    )
                    maxTryEntities: Int = MAX_TRY_ENTITIES_DEFAULT,
                    @Parameter(name = "objectPath", description = "An additional object path this auto-completion should be the context of.", required = false,
                      in = ParameterIn.QUERY, schema = new Schema(implementation = classOf[String]))
                    objectPath: Option[String]): Action[AnyContent] = RequestUserContextAction { implicit request => implicit userContext =>
    val (project, task) = projectAndTask(projectName, taskName)
    val transformSpec = task.data
    val parentRule = transformSpec.oneRuleEntitySchemaById(ruleName).get
    val inputTaskId = transformSpec.selection.inputId
    implicit val prefixes: Prefixes = project.config.prefixes
    implicit val readContext: ReadContext = ReadContext(prefixes = prefixes, resources = project.resources)

    deserializeCompileTime[TransformRule]() { rule =>
      val updatedParentRule = parentRule.transformRule.withChildren(Seq(rule)).asInstanceOf[TransformRule]
      val initialRuleSchemata = RuleSchemata.create(updatedParentRule, transformSpec.selection, parentRule.inputSchema.subPath).copy(transformRule = rule)
      val ruleSchemata = if(objectPath.isDefined && objectPath.get.nonEmpty) {
        val inputSchema = initialRuleSchemata.inputSchema.copy(subPath = UntypedPath(initialRuleSchemata.inputSchema.subPath.operators ++ UntypedPath.parse(objectPath.get).operators))
        RuleSchemata(initialRuleSchemata.transformRule, inputSchema, initialRuleSchemata.outputSchema)
      } else {
        initialRuleSchemata
      }
      peakRule(project, inputTaskId, ruleSchemata, limit, maxTryEntities)
    }
  }

  private def peakRule(project: Project, inputTaskId: Identifier, ruleSchemata: RuleSchemata, limit: Int, maxTryEntities: Int)
                      (implicit userContext: UserContext): Result = {
    implicit val prefixes: Prefixes = project.config.prefixes

    project.anyTask(inputTaskId).data match {
      case dataset: GenericDatasetSpec =>
        DataSource.pluginSource(dataset) match {
          case peakDataSource: PeakDataSource =>
            try {
              val exampleEntities = peakDataSource.peak(ruleSchemata.inputSchema, maxTryEntities)
              generateMappingPreviewResponse(ruleSchemata.transformRule, exampleEntities, limit)
            } catch {
              case pe: PeakException =>
                Ok(Json.toJson(PeakResults(None, None, PeakStatus(NOT_SUPPORTED_STATUS_MSG, "Input dataset task " + inputTaskId.toString +
                  " of type " + dataset.plugin.pluginSpec.label +
                  " raised following issue:" + pe.msg))))
            }
          case _ =>
            Ok(Json.toJson(PeakResults(None, None, PeakStatus(NOT_SUPPORTED_STATUS_MSG, "Input dataset task " + inputTaskId.toString +
              " of type " + dataset.plugin.pluginSpec.label +
              " does not support transformation preview!"))))
        }
      case sparqlSelectTask: SparqlSelectCustomTask =>
        peakIntoSparqlSelectTask(project, inputTaskId, ruleSchemata, limit, maxTryEntities, sparqlSelectTask)
      case _: TransformSpec =>
        Ok(Json.toJson(PeakResults(None, None, PeakStatus(NOT_SUPPORTED_STATUS_MSG, "Input task " + inputTaskId.toString +
          " is not a Dataset. Currently mapping preview is only supported for dataset inputs."))))
      case t: TaskSpec =>
        Ok(Json.toJson(PeakResults(None, None, PeakStatus(NOT_SUPPORTED_STATUS_MSG, s"Input task $inputTaskId of type ${t.getClass.getSimpleName} " +
          s"is not supported. Currently only dataset and transform tasks support producing example values."))))
    }
  }

  private def peakIntoSparqlSelectTask(project: Project,
                                       inputTaskId: Identifier,
                                       ruleSchemata: RuleSchemata,
                                       limit: Int,
                                       maxTryEntities: Int,
                                       sparqlSelectTask: SparqlSelectCustomTask)
                                      (implicit prefixes: Prefixes,
                                       userContext: UserContext): Result = {
    val sparqlDataset = sparqlSelectTask.optionalInputDataset.sparqlEnabledDataset
    if (sparqlDataset.toString == "") {
      Ok(Json.toJson(PeakResults(None, None, PeakStatus(NOT_SUPPORTED_STATUS_MSG, s"Input task $inputTaskId of type ${sparqlSelectTask.pluginSpec.label} " +
        s"has no input dataset configured. Please configure the 'Optional SPARQL dataset' parameter."))))
    } else {
      val datasetTask = project.task[GenericDatasetSpec](sparqlDataset)
      datasetTask.data.plugin match {
        case rdfDataset: RdfDataset with Dataset =>
          val entityTable = new SparqlEndpointEntityTable(rdfDataset.sparqlEndpoint, PlainTask(sparqlDataset, DatasetSpec(rdfDataset)))
          val executor = LocalSparqlSelectExecutor()
          val entities = executor.executeOnSparqlEndpointEntityTable(sparqlSelectTask, entityTable, maxTryEntities, executionReportUpdater = None)
          val entityDatasource = EntityDatasource(datasetTask, entities, sparqlSelectTask.outputSchema)
          try {
            val exampleEntities = entityDatasource.peak(ruleSchemata.inputSchema, maxTryEntities)
            generateMappingPreviewResponse(ruleSchemata.transformRule, exampleEntities, limit)
          } catch {
            case pe: PeakException =>
              Ok(Json.toJson(PeakResults(None, None, PeakStatus(NOT_SUPPORTED_STATUS_MSG, "Input task " + inputTaskId.toString +
                " of type " + sparqlSelectTask.pluginSpec.label +
                " raised following issue:" + pe.msg))))
          }
        case _ =>
          throw new ValidationException(s"Configured dataset $sparqlDataset for task $inputTaskId offers no SPARQL endpoint!")
      }
    }
  }

  // Generate the HTTP response for the mapping transformation preview
  private def generateMappingPreviewResponse(rule: TransformRule,
                                             exampleEntities: Traversable[Entity],
                                             limit: Int)
                                            (implicit prefixes: Prefixes) = {
    val (tryCounter, errorCounter, errorMessage, sourceAndTargetResults) = collectTransformationExamples(rule, exampleEntities, limit)
    if (sourceAndTargetResults.nonEmpty) {
      Ok(Json.toJson(PeakResults(Some(rule.sourcePaths.map(serializePath)), Some(sourceAndTargetResults),
        status = PeakStatus("success", ""))))
    } else if (errorCounter > 0) {
      Ok(Json.toJson(PeakResults(Some(rule.sourcePaths.map(serializePath)), Some(sourceAndTargetResults),
        status = PeakStatus("empty with exceptions",
          s"Transformation result was always empty or exceptions occurred. $tryCounter processed and $errorCounter exceptions occurred. " +
            "First exception: " + errorMessage))))
    } else {
      Ok(Json.toJson(PeakResults(Some(rule.sourcePaths.map(serializePath)), Some(sourceAndTargetResults),
        status = PeakStatus("empty", s"Transformation result was always empty. Processed first $tryCounter entities."))))
    }
  }

  private def serializePath(path: Path)
                           (implicit prefixes: Prefixes): Seq[String] = {
    path.operators.map { op =>
      op.serialize
    }
  }

  private def projectAndTask(projectName: String, taskName: String)
                            (implicit userContext: UserContext): (Project, ProjectTask[TransformSpec]) = {
    getProjectAndTask[TransformSpec](projectName, taskName)
  }

}

object PeakTransformApi {

  // Max number of exceptions before aborting the mapping preview call
  final val MAX_TRANSFORMATION_PREVIEW_EXCEPTIONS: Int = 50
  // The number of transformation preview results that should be returned by the REST API
  final val TRANSFORMATION_PREVIEW_LIMIT: Int = 3
  final val TRANSFORMATION_PREVIEW_LIMIT_STR = "3"
  // Maximum number of empty transformation results to skip during the mapping preview calculation
  final val MAX_TRANSFORMATION_PREVIEW_SKIP_EMPTY_RESULTS: Int = 500
  // Max number of entities to examine for the mapping preview
  final val MAX_TRY_ENTITIES_DEFAULT: Int = MAX_TRANSFORMATION_PREVIEW_EXCEPTIONS + TRANSFORMATION_PREVIEW_LIMIT + MAX_TRANSFORMATION_PREVIEW_SKIP_EMPTY_RESULTS
  final val MAX_TRY_ENTITIES_DEFAULT_STR = "553"

  final val NOT_SUPPORTED_STATUS_MSG = "not supported"

  /**
    *
    * @param rule            The transformation rule to execute on the example entities.
    * @param exampleEntities Entities to try executing the tranform rule on
    * @param limit           Limit of examples to return
    * @return
    */
  def collectTransformationExamples(rule: TransformRule, exampleEntities: Traversable[Entity], limit: Int): (Int, Int, String, Seq[PeakResult]) = {
    // Number of examples collected
    var exampleCounter = 0
    // Number of exceptions occurred
    var errorCounter = 0
    // Number of example entities tried
    var tryCounter = 0
    // Record the first error message
    var errorMessage: String = ""
    val resultBuffer = ArrayBuffer[PeakResult]()
    val entityIterator = exampleEntities.toIterator
    while (entityIterator.hasNext && exampleCounter < limit) {
      tryCounter += 1
      val entity = entityIterator.next()
      try {
        val transformResult = rule(entity)
        if (transformResult.nonEmpty) {
          resultBuffer.append(PeakResult(entity.values, transformResult))
          exampleCounter += 1
        }
      } catch {
        case NonFatal(ex) =>
          errorCounter += 1
          if (errorMessage.isEmpty) {
            errorMessage = ex.getClass.getSimpleName + ": " + Option(ex.getMessage).getOrElse("")
          }
      }
    }
    (tryCounter, errorCounter, errorMessage, resultBuffer)
  }
}

// Peak API
case class PeakResults(sourcePaths: Option[Seq[Seq[String]]], results: Option[Seq[PeakResult]], status: PeakStatus)

case class PeakStatus(id: String, msg: String)

case class PeakResult(sourceValues: Seq[Seq[String]], transformedValues: Seq[String])

object PeakResults {
  implicit val peakStatusWrites: Format[PeakStatus] = Json.format[PeakStatus]
  implicit val peakResultWrites: Format[PeakResult] = Json.format[PeakResult]
  implicit val peakResultsWrites: Format[PeakResults] = Json.format[PeakResults]
}
