package org.silkframework.rule

import java.util.NoSuchElementException
import org.silkframework.config.Task.TaskFormat
import org.silkframework.config.{MetaData, Prefixes, Task, TaskSpec}
import org.silkframework.entity._
import org.silkframework.entity.paths._
import org.silkframework.rule.RootMappingRule.RootMappingRuleFormat
import org.silkframework.rule.TransformSpec.{RuleSchemata, TargetVocabularyAutoCompletionProvider, TargetVocabularyCategory, TargetVocabularyParameter}
import org.silkframework.rule.input.TransformInput
import org.silkframework.rule.vocab.TargetVocabularyParameterEnum
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.plugin.StringParameterType.{EnumerationType, StringTraversableParameterType}
import org.silkframework.runtime.plugin.annotations.{Param, Plugin}
import org.silkframework.runtime.plugin._
import org.silkframework.runtime.resource.{Resource, ResourceManager}
import org.silkframework.runtime.serialization.XmlSerialization._
import org.silkframework.runtime.serialization.{ReadContext, WriteContext, XmlFormat}
import org.silkframework.runtime.validation.NotFoundException
import org.silkframework.util.{Identifier, IdentifierGenerator}
import org.silkframework.workspace.WorkspaceReadTrait
import org.silkframework.workspace.project.task.DatasetTaskReferenceAutoCompletionProvider

import scala.collection.mutable
import scala.language.implicitConversions
import scala.util.Try
import scala.xml.{Node, Null}

/**
  * This class contains all the required parameters to execute a transform task.
  *
  * @param selection          Selects the entities that are covered by this transformation.
  * @param mappingRule        The root mapping rule
  * @param output             The optional identifier of the output to which all transformed entities are to be written
  * @param errorOutput        The optional identifier of the output to received erroneous entities.
  * @param targetVocabularies The URIs of the target vocabularies to which this transformation maps.
  * @since 2.6.1
  * @see org.silkframework.execution.ExecuteTransform
  */
@Plugin(
  id = "transform",
  label = "Transform",
  categories = Array("Transform"),
  description =
      """A transform task defines a mapping from a source structure to a target structure."""
)
case class TransformSpec(@Param(label = "Input task", value = "The source from which data will be transformed when executed as a single task outside of a workflow.")
                         selection: DatasetSelection,
                         @Param(label = "", value = "", visibleInDialog = false)
                         mappingRule: RootMappingRule = RootMappingRule.empty,
                         @Param(label = "Output dataset", value = "An optional dataset where the transformation results should be written to when executed" +
                             " as single task outside of a workflow.", autoCompletionProvider = classOf[DatasetTaskReferenceAutoCompletionProvider],
                           autoCompleteValueWithLabels = true, allowOnlyAutoCompletedValues = true)
                         output: IdentifierOptionParameter = IdentifierOptionParameter(None),
                         @Param(label = "Error output", value = "An optional dataset to write invalid input entities to.",
                           autoCompletionProvider = classOf[DatasetTaskReferenceAutoCompletionProvider],
                           autoCompleteValueWithLabels = true, allowOnlyAutoCompletedValues = true)
                         errorOutput: IdentifierOptionParameter = IdentifierOptionParameter(None),
                         @Param(label = "Target vocabularies", value = "Use installed vocabularies for auto-suggestion and selection of target classes and target properties " +
                             "of this transformation.")
                         targetVocabularies: TargetVocabularyParameter = TargetVocabularyCategory(TargetVocabularyParameterEnum.allInstalled),
                         @Param("If true, a validation error (such as a data type mismatch) will abort the execution. " +
                                "If false, the execution will continue, adding a validation error to the execution report.")
                         abortIfErrorsOccur: Boolean = false
                        ) extends TaskSpec {

  /** Retrieves the root rules of this transform spec. */
  def rules: MappingRules = mappingRule.rules

  /**
    * Retrieves a rule by its identifier.
    * Searches in the entire rule tree.
    *
    * @throws NoSuchElementException If no rule with the given identifier could be found.
    */
  def ruleById(ruleId: Identifier): TransformRule = {
    nestedRuleAndSourcePath(ruleId)
      .getOrElse(throw new NoSuchElementException(s"No rule with identifier '$ruleId' has been found."))
      ._1
  }

  override def inputSchemataOpt: Option[Seq[EntitySchema]] = Some(Seq(inputSchema))

  override def outputSchemaOpt: Some[EntitySchema] = Some(outputSchema)

  /**
    * The tasks that this task reads from.
    */
  override def inputTasks: Set[Identifier] = Set(selection.inputId)

  /**
    * The tasks that this task writes to.
    */
  override def outputTasks: Set[Identifier] = output.value.toSet

  /**
    * The tasks that are directly referenced by this task.
    * This includes input tasks and output tasks.
    */
  override def referencedTasks: Set[Identifier] = inputTasks ++ outputTasks

  override lazy val referencedResources: Seq[Resource] = {
    val resources = new mutable.HashSet[Resource]()
    extractResourcesFromRule(mappingRule, resources)
    resources.toSeq
  }

  private def extractResourcesFromRule(rule: TransformRule,
                                       resources: mutable.HashSet[Resource]): Unit = {
    extractResourcesFromOperator(rule.operator, resources)
    rule.rules.foreach(rule => extractResourcesFromRule(rule, resources))
  }

  private def extractResourcesFromOperator(operator: Operator,
                                           resources: mutable.HashSet[Resource]): Unit = {
    operator match {
      case TransformInput(_, transformer, inputs) =>
        inputs.foreach(input => extractResourcesFromOperator(input, resources))
        transformer.referencedResources.foreach(resources.add)
      case _ =>
    }
  }

  /**
    * Input and output schemata of all object rules in the tree.
    */
  lazy val ruleSchemata: Seq[RuleSchemata] = {
    collectSchemata(mappingRule, UntypedPath.empty)
  }

  /**
    * Input schemata of all object rules in the tree.
    */
  lazy val inputSchema: MultiEntitySchema = {
    new MultiEntitySchema(ruleSchemata.head.inputSchema, ruleSchemata.tail.map(_.inputSchema).toIndexedSeq)
  }


  /**
    * Output schemata of all object rules in the tree.``
    */
  lazy val outputSchema: MultiEntitySchema = {
    new MultiEntitySchema(ruleSchemata.head.outputSchema, ruleSchemata.tail.map(_.outputSchema).toIndexedSeq)
  }

  /** Retrieves a list of properties as key-value pairs for this task to be displayed to the user. */
  override def properties(implicit prefixes: Prefixes): Seq[(String, String)] = {
    Seq(
      ("Source", selection.inputId.toString),
      ("Type", selection.typeUri.toString),
      ("Restriction", selection.restriction.toString),
      ("Output", output.value.map(_.toString).getOrElse(""))
    )
  }

  /**
    * Collects the input and output schemata of all rules recursively.
    */
  private def collectSchemata(rule: TransformRule, subPath: UntypedPath): Seq[RuleSchemata] = {
    var schemata = Seq[RuleSchemata]()

    // Add rule schemata for this rule
    schemata :+= RuleSchemata.create(rule, selection, subPath)

    // Add rule schemata of all child object rules
    for(objectMapping @ ObjectMapping(_, relativePath, _, _, _, _) <- rule.rules.allRules) {
      schemata ++= collectSchemata(objectMapping.fillEmptyUriRule, subPath ++ relativePath)
    }

    schemata
  }

  /**
    * Return the transform rule and the combined source path to that rule.
    *
    * @param ruleName The ID of the rule.
    */
  def nestedRuleAndSourcePath(ruleName: String): Option[(TransformRule, List[PathOperator])] = {
    fetchRuleAndSourcePath(mappingRule, ruleName, List.empty)
  }

  // Recursively search for the rule in the transform spec rule tree and accumulate the source path.
  private def fetchRuleAndSourcePath(transformRule: TransformRule,
                                     ruleName: String,
                                     sourcePath: List[PathOperator]): Option[(TransformRule, List[PathOperator])] = {
    val sourcePathOperators = sourcePathOfRule(transformRule)
    if (transformRule.id.toString == ruleName) {
      Some(transformRule, sourcePath ::: sourcePathOperators) // Found the rule, return the result
    } else {
      transformRule.rules.flatMap(rule => fetchRuleAndSourcePath(rule, ruleName, sourcePath ::: sourcePathOperators)).headOption
    }
  }

  private def sourcePathOfRule(transformRule: TransformRule) = {
    transformRule match {
      case objMapping: ObjectMapping =>
        objMapping.sourcePath.operators
      case _ =>
        Nil
    }
  }

  /** Return an entity schema for one specific rule of the transform specification */
  def oneRuleEntitySchemaById(ruleId: Identifier): Try[RuleSchemata] = {
    Try {
      ruleSchemata.flatMap(_.hasMapping(ruleId)).headOption match {
        case Some(rule) =>
          rule
        case None =>
          val ruleIds = validRuleNames(mappingRule).sorted.mkString(", ")
          throw new NotFoundException(s"No rule with ID '$ruleId' found! Value rule IDs: $ruleIds")
      }
    }
  }

  def validRuleNames(mappingRule: TransformRule): List[String] = {
    val childRuleNames = mappingRule.rules.map(validRuleNames).foldLeft(List.empty[String])((l, ruleNames) => ruleNames ::: l)
    mappingRule.id :: childRuleNames
  }

  /** A list of relative source paths fetched recursively from the whole rule tree starting with the given rule by the rule id.
    * Only source paths are considered that are used in value property mappings, i.e. that have a target property set and
    * create a property value. Also, source paths from complex rules are only considered if they are the only source paths
    * in that rule. */
  def valueSourcePaths(ruleName: Identifier,
                       maxPathDepth: Int = Int.MaxValue): Seq[UntypedPath] = {
    nestedRuleAndSourcePath(ruleName) match {
      case Some((rule, _)) =>
        rule.children flatMap (child => valueSourcePathsRecursive(child, List.empty, maxPathDepth))
      case None =>
        throw new RuntimeException("No rule with name " + ruleName + " exists!")
    }
  }

  /** The list of object mapping rule source paths for the specified rule, i.e. the relative source paths
    * from direct child object mapping rules. */
  def objectSourcePaths(ruleName: Identifier): Seq[UntypedPath] = {
    nestedRuleAndSourcePath(ruleName) match {
      case Some((rule, _)) =>
        rule.children
          .filter (_.isInstanceOf[ObjectMapping])
          .map (_.asInstanceOf[ObjectMapping].sourcePath).distinct
      case None =>
        throw new RuntimeException("No rule with name " + ruleName + " exists!")
    }
  }

  private def valueSourcePathsRecursive(rule: Operator,
                                        basePath: List[PathOperator],
                                        maxPathDepth: Int): Seq[UntypedPath] = {
    rule match {
      case transformRule: TransformRule =>
        transformRule match {
          case dm: DirectMapping =>
            listPath(basePath ++ dm.sourcePath.operators)
          case cm: ComplexMapping =>
            cm.sourcePaths match {
              case oneInput :: Nil =>
                listPath(basePath ++ oneInput.operators) // Only consider complex mapping with one single source path
              case _ =>
                List.empty
            }
          case om: ObjectMapping =>
            val newBasePath = basePath ++ om.sourcePath.operators
            om.children flatMap (c => valueSourcePathsRecursive(c, newBasePath, maxPathDepth))
          case rm: RootMappingRule =>
            rm.children flatMap (c => valueSourcePathsRecursive(c, List.empty, maxPathDepth)) // At the moment this branch is never taken
          case _: UriMapping | _: TypeMapping =>
            List.empty // Don't consider non-value mappings
        }
      case _ =>
        List() // No transform rule, no path used
    }
  }

  private def listPath(pathOperators: List[PathOperator]) =  List(UntypedPath(pathOperators))

  override def mainActivities: Seq[String] = Seq("ExecuteTransform")
}

case class TransformTask(id: Identifier, data: TransformSpec, metaData: MetaData = MetaData.empty) extends Task[TransformSpec] {

  override def taskType: Class[_] = classOf[TransformSpec]
}

/**
  * Static functions for the TransformSpecification class.
  */
object TransformSpec {

  implicit def toTransformTask(task: Task[TransformSpec]): TransformTask = TransformTask(task.id, task.data, task.metaData)

  def empty: TransformSpec = TransformSpec(DatasetSelection.empty, RootMappingRule.empty)

  /**
    * Holds a transform rule along with its input and output schema.
    */
  case class RuleSchemata(transformRule: TransformRule, inputSchema: EntitySchema, outputSchema: EntitySchema) {

    def hasMapping(ruleId: Identifier): Option[RuleSchemata] = {
      if(ruleId == transformRule.id) {
        Some(this)
      } else {
        for(childRule <- transformRule.rules.allRules.find(c => c.isInstanceOf[ValueTransformRule] && c.id == ruleId)) yield {
          val inputPaths = childRule.sourcePaths.map(p => TypedPath(p.operators, ValueType.STRING, isAttribute = false)).toIndexedSeq
          val outputPaths = childRule.target.map(t => UntypedPath(t.propertyUri).asStringTypedPath).toIndexedSeq
          RuleSchemata(
            transformRule = childRule,
            inputSchema = inputSchema.copy(typedPaths = inputPaths),
            outputSchema = outputSchema.copy(typedPaths = outputPaths)
          )
        }
      }
    }
  }

  object RuleSchemata {
    def create(rule: TransformRule, selection: DatasetSelection, subPath: UntypedPath): RuleSchemata = {
      val inputSchema = EntitySchema(
        typeUri = selection.typeUri,
        typedPaths = extractTypedPaths(rule),
        filter = selection.restriction,
        subPath = subPath
      )

      val outputSchema = EntitySchema(
        typeUri = rule.rules.typeRules.headOption.map(_.typeUri).getOrElse(selection.typeUri),
        typedPaths = rule.rules.allRules.flatMap(_.target).map { mt =>
                       val path = if (mt.isBackwardProperty) BackwardOperator(mt.propertyUri) else ForwardOperator(mt.propertyUri)
                       TypedPath(UntypedPath(List(path)), mt.valueType, mt.isAttribute)
                     }.distinct.toIndexedSeq,
        singleEntity = rule.target.exists(_.isAttribute)
      )

      RuleSchemata(rule, inputSchema, outputSchema)
    }
  }

  private def extractTypedPaths(rule: TransformRule): IndexedSeq[TypedPath] = {
    val rules = rule.rules.allRules
    val (objectRulesWithDefaultPattern, valueRules) = rules.partition ( _.representsDefaultUriRule )
    val valuePaths = valueRules.flatMap(_.sourcePaths).map(p => TypedPath(p.operators, ValueType.STRING, isAttribute = false)).distinct.toIndexedSeq
    val objectPaths = objectRulesWithDefaultPattern.flatMap(_.sourcePaths).map(p => TypedPath(p.operators, ValueType.URI, isAttribute = false)).distinct.toIndexedSeq

    /** Value paths must come before object paths to not, because later algorithms rely on this order, e.g. PathInput only considers the Path not the value type.
      * If an object type path would come before the value path, the path input would take the wrong values. The other way round
      * is taken care of.
      */
    valuePaths ++ objectPaths
  }

  implicit object TransformSpecFormat extends XmlFormat[TransformSpec] {

    override def tagNames: Set[String] = Set("TransformSpec")

    /**
      * Deserialize a value from XML.
      */
    override def read(node: Node)(implicit readContext: ReadContext): TransformSpec = {
      // Get the required parameters from the XML configuration.
      val datasetSelection = DatasetSelection.fromXML((node \ "SourceDataset").head)
      val sink = (node \ "Outputs" \ "Output" \ "@id").headOption.map(_.text).map(Identifier(_))
      val errorSink = (node \ "ErrorOutputs" \ "ErrorOutput" \ "@id").headOption.map(_.text).map(Identifier(_))
      val targetVocabularyParameter = (node \ "TargetVocabularyCategory").headOption match {
        case Some(targetVocabularyCategoryNode) =>
          TargetVocabularyParameterType.fromString(targetVocabularyCategoryNode.text.trim)
        case None =>
          // Backwards compatibility
          TargetVocabularyListParameter((node \ "TargetVocabularies" \ "Vocabulary").map(n => (n \ "@uri").text).filter(_.nonEmpty))
      }

      val rootMappingRule = {
        // Stay compatible with the old format.
        val oldRules = (node \ "TransformRule" ++ node \ "ObjectMapping").map(fromXml[TransformRule])
        if (oldRules.nonEmpty) {
          RootMappingRule(MappingRules.fromSeq(oldRules))
        } else {
          (node \ "RootMappingRule").headOption match {
            case Some(node) =>
              RootMappingRuleFormat.read(node)
            case None =>
              RootMappingRule.empty
          }
        }
      }

      val abortIfErrorsOccur = (node \ "@abortIfErrorsOccur").headOption.exists(_.text.toBoolean)

      // Create and return a TransformSpecification instance.
      TransformSpec(datasetSelection, rootMappingRule, sink, errorSink, targetVocabularyParameter, abortIfErrorsOccur)
    }

    /**
      * Serialize a value to XML.
      */
    override def write(value: TransformSpec)(implicit writeContext: WriteContext[Node]): Node = {
      <TransformSpec abortIfErrorsOccur={value.abortIfErrorsOccur.toString}>
        {value.selection.toXML(true)}{toXml(value.mappingRule)}<Outputs>
        {value.output.value.toSeq.map(o => <Output id={o}></Output>)}
      </Outputs>{if (value.errorOutput.isEmpty) {
        Null
      } else {
        <ErrorOutputs>
          {value.errorOutput.map(o => <ErrorOutput id={o}></ErrorOutput>).toSeq}
        </ErrorOutputs>
      }}
        {
          value.targetVocabularies match {
            case v: TargetVocabularyCategory =>
              <TargetVocabularyCategory>{TargetVocabularyParameterType.stringValue(v)}</TargetVocabularyCategory>
            case TargetVocabularyListParameter(vocabularyUris) =>
              <TargetVocabularies>
                { for (targetVocabulary <- vocabularyUris) yield {
                    <Vocabulary uri={targetVocabulary}/>
                }}
              </TargetVocabularies>
          }
        }
      </TransformSpec>
    }
  }

  implicit object TransformTaskXmlFormat extends XmlFormat[TransformTask] {
    override def read(value: Node)(implicit readContext: ReadContext): TransformTask = {
      new TaskFormat[TransformSpec].read(value)
    }

    override def write(value: TransformTask)(implicit writeContext: WriteContext[Node]): Node = {
      new TaskFormat[TransformSpec].write(value)
    }
  }

  /** Creates an ID generator pre-populated with IDs from the transform spec */
  def identifierGenerator(transformSpec: TransformSpec): IdentifierGenerator = {
    val identifierGenerator = new IdentifierGenerator()
    for(id <- RuleTraverser(transformSpec.mappingRule).iterateAllChildren.map(_.operator.id)) {
      identifierGenerator.add(id)
    }
    identifierGenerator
  }

  /** Target vocabulary parameter that is backwards compatible and allows configuration by enum ID and the old configuration by listing target vocabulary URIs. */
  sealed trait TargetVocabularyParameter extends PluginStringParameter {
    def explicitVocabularies: Seq[String]
  }

  private val enumParameterType = EnumerationType(classOf[TargetVocabularyParameterEnum])

  /** The old version of a list of vocabularies for backwards compatibility. */
  case class TargetVocabularyListParameter(value: Traversable[String]) extends TargetVocabularyParameter {
    override def explicitVocabularies: Seq[String] = value.toSeq

    override def toString: String = TargetVocabularyParameterType.stringValue(this)
  }
  /** The new approach of specifying a category of vocabularies. */
  case class TargetVocabularyCategory(value: TargetVocabularyParameterEnum) extends TargetVocabularyParameter {
    override def explicitVocabularies: Seq[String] = Seq.empty

    override def toString: String = TargetVocabularyParameterType.stringValue(this)
  }

  /** Converts the target vocabulary parameter. */
  case class TargetVocabularyParameterType() extends PluginStringParameterType[TargetVocabularyParameter] {
    override def name: String = "targetVocabularies"

    override def jsonSchemaType: String = "string"

    override def toString(value: TargetVocabularyParameter)(implicit prefixes: Prefixes): String = {
      value match {
        case v: TargetVocabularyListParameter => TargetVocabularyParameterType.stringValue(v)
        case v: TargetVocabularyCategory => TargetVocabularyParameterType.stringValue(v)
      }
    }

    override def fromString(str: String)(implicit prefixes: Prefixes, resourceLoader: ResourceManager): TargetVocabularyParameter = {
      enumParameterType.fromStringOpt(str) match {
        case Some(enumValue) =>
          TargetVocabularyCategory(enumValue.asInstanceOf[TargetVocabularyParameterEnum])
        case None =>
          TargetVocabularyListParameter(StringTraversableParameterType.fromString(str).value)
      }
    }
  }

  object TargetVocabularyParameterType {
    private implicit val prefixes: Prefixes = Prefixes.empty
    private val instance = TargetVocabularyParameterType()
    def stringValue(v: TargetVocabularyListParameter): String = v.value.mkString(", ")

    def stringValue(v: TargetVocabularyCategory): String = enumParameterType.toString(v.value)

    def fromString(str: String): TargetVocabularyParameter = instance.fromString(str)

    def toString(targetVocabularyParameter: TargetVocabularyParameter): String = instance.toString(targetVocabularyParameter)
  }

  case class TargetVocabularyAutoCompletionProvider() extends PluginParameterAutoCompletionProvider {
    private val potentialResults: Seq[AutoCompletionResult] = TargetVocabularyParameterEnum.values().map { value =>
      AutoCompletionResult(value.id(), Some(value.displayName()))
    }
    override def autoComplete(searchQuery: String,
                              projectId: String,
                              dependOnParameterValues: Seq[String],
                              workspace: WorkspaceReadTrait)
                             (implicit userContext: UserContext): Traversable[AutoCompletionResult] = {
      filterResults(searchQuery, potentialResults)
    }

    override def valueToLabel(projectId: String,
                              value: String,
                              dependOnParameterValues: Seq[String],
                              workspace: WorkspaceReadTrait)
                             (implicit userContext: UserContext): Option[String] = {
      potentialResults.find(_.value == value).flatMap(_.label)
    }
  }
}