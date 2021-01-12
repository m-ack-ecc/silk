package org.silkframework.workspace

import org.silkframework.plugins.dataset.DatasetTypeAutoCompletionProvider
import org.silkframework.plugins.filter.RemoveStopwords
import org.silkframework.plugins.transformer.value.ReadParameter
import org.silkframework.runtime.plugin.PluginModule
import org.silkframework.workspace.activity.dataset.Types.TypesFormat
import org.silkframework.workspace.activity.dataset.TypesCacheFactory
import org.silkframework.workspace.activity.linking._
import org.silkframework.workspace.activity.transform.CachedEntitySchemata.CachedEntitySchemaXmlFormat
import org.silkframework.workspace.activity.transform._
import org.silkframework.workspace.activity.vocabulary.GlobalVocabularyCacheFactory
import org.silkframework.workspace.activity.workflow.Workflow.WorkflowXmlFormat
import org.silkframework.workspace.activity.workflow.{LocalWorkflowExecutorFactory, NopPersistWorkflowProvenance, Workflow}
import org.silkframework.workspace.xml.{FileWorkspaceProvider, XmlZipProjectMarshaling, XmlZipWithResourcesProjectMarshaling, XmlZipWithoutResourcesProjectMarshaling}

import scala.language.existentials

class WorkspacePlugins extends PluginModule {

  override def pluginClasses: Seq[Class[_]] =
    workspaceProviders :::
        datasetActivities :::
        transformActivities :::
        linkingActivities :::
        workflowActivities :::
        projectMarshaller :::
        provenancePlugins :::
        rulePlugins :::
        workspaceTaskPlugins :::
        autoCompletionProviderPlugins :::
        workspaceActivityPlugins :::
        formats

  def workspaceTaskPlugins: List[Class[_]] =
    classOf[Workflow] :: Nil

  def workspaceProviders: List[Class[_]] =
    classOf[FileWorkspaceProvider] ::
    classOf[InMemoryWorkspaceProvider] :: Nil

  def datasetActivities: List[Class[_]] =
    classOf[TypesCacheFactory] :: Nil

  def transformActivities: List[Class[_]] =
    classOf[ExecuteTransformFactory] ::
    classOf[TransformPathsCacheFactory] ::
    classOf[VocabularyCacheFactory] :: Nil

  def linkingActivities: List[Class[_]] =
    classOf[EvaluateLinkingFactory] ::
    classOf[ExecuteLinkingFactory] ::
    classOf[LinkingPathsCacheFactory] ::
    classOf[ReferenceEntitiesCacheFactory] :: Nil

  def workflowActivities: List[Class[_]] =
    classOf[LocalWorkflowExecutorFactory] :: Nil

  def formats: List[Class[_]] = {
    TypesFormat.getClass ::
    VocabularyCacheValue.ValueFormat.getClass ::
    CachedEntitySchemaXmlFormat.getClass ::
    WorkflowXmlFormat.getClass ::
    Nil
  }

  def rulePlugins: List[Class[_]] = {
    classOf[ReadParameter] ::
    classOf[RemoveStopwords] ::
    Nil
  }

  def projectMarshaller: List[Class[_]] = {
    classOf[XmlZipWithResourcesProjectMarshaling] ::
    classOf[XmlZipWithoutResourcesProjectMarshaling] :: Nil
  }

  def provenancePlugins: List[Class[_]] = classOf[NopPersistWorkflowProvenance] :: Nil

  def autoCompletionProviderPlugins: List[Class[_]] = classOf[DatasetTypeAutoCompletionProvider] :: Nil

  def workspaceActivityPlugins: List[Class[_]] = classOf[GlobalVocabularyCacheFactory] :: Nil
}
