package org.silkframework.workspace.xml

import org.silkframework.config.Tag.TagXmlFormat
import org.silkframework.config._
import org.silkframework.dataset.rdf.SparqlEndpoint
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.resource.ResourceManager
import org.silkframework.runtime.serialization.{ReadContext, WriteContext, XmlSerialization}
import org.silkframework.util.Identifier
import org.silkframework.util.XMLUtils._
import org.silkframework.workspace.io.WorkspaceIO
import org.silkframework.workspace.{LoadedTask, ProjectConfig, WorkspaceProvider}

import java.util.logging.{Level, Logger}
import scala.reflect.ClassTag
import scala.util.control.NonFatal
import scala.xml.{Elem, Node, XML}

/**
  * Holds all projects in a xml-based file structure.
  */
class XmlWorkspaceProvider(val resources: ResourceManager) extends WorkspaceProvider {

  private val log = Logger.getLogger(classOf[XmlWorkspaceProvider].getName)

  @volatile
  private var plugins = Map[Class[_], XmlSerializer[_ <: TaskSpec]]()

  // Register all module types
  registerModule(new DatasetXmlSerializer())
  registerModule(new LinkingXmlSerializer())
  registerModule(new TransformXmlSerializer())
  registerModule(new WorkflowXmlSerializer())
  registerModule(new CustomTaskXmlSerializer())

  private def registerModule[T <: TaskSpec : ClassTag](plugin: XmlSerializer[T]) = {
    val clazz = implicitly[ClassTag[T]].runtimeClass
    plugins += (clazz -> plugin)
  }

  override def readProjects()
                           (implicit userContext: UserContext): Seq[ProjectConfig] = {
    resources.listChildren.flatMap(readProject(_))
  }

  override def readProject(projectName: String)
                          (implicit userContext: UserContext): Option[ProjectConfig] = {
    try {
      val configXML = resources.child(projectName).get("config.xml").read(XML.load)
      val prefixes = Prefixes.fromXML((configXML \ "Prefixes").head)
      val resourceURI = (configXML \ "@resourceUri").headOption.map(_.text.trim)
      Some(ProjectConfig(projectName, prefixes, resourceURI, metaData(configXML, projectName)))
    } catch {
      case NonFatal(ex) =>
        log.log(Level.WARNING, s"Could not load project $projectName", ex)
        None
    }
  }

  private def metaData(configXML: Elem,
                       projectName: String): MetaData = {
    implicit val readContext: ReadContext = ReadContext()
    (configXML \ "MetaData").headOption.
        map(n => XmlSerialization.fromXml[MetaData](n)).
        getOrElse(MetaData(Some(projectName))) // Set label to ID
  }

  override def putProject(config: ProjectConfig)
                         (implicit userContext: UserContext): Unit = {
    val uri = config.resourceUriOrElseDefaultUri
    val configXMl =
      <ProjectConfig resourceUri={uri}>
        { config.prefixes.toXML }
        { XmlSerialization.toXml(config.metaData) }
      </ProjectConfig>
    resources.child(config.id).get("config.xml").write(){ os => configXMl.write(os) }
  }

  override def deleteProject(name: Identifier)
                            (implicit userContext: UserContext): Unit = {
    resources.delete(name)
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
  def projectCache(name: Identifier): ResourceManager = {
    resources.child(name)
  }

  override def readTasks[T <: TaskSpec : ClassTag](project: Identifier,
                                                   projectResources: ResourceManager)
                                                  (implicit user: UserContext): Seq[LoadedTask[T]] = {
    plugin[T].loadTasks(resources.child(project).child(plugin[T].prefix), projectResources)
  }

  override def readAllTasks(project: Identifier, projectResources: ResourceManager)
                           (implicit user: UserContext): Seq[LoadedTask[_]] = {
    plugins.values.toSeq.flatMap(plugin => plugin.loadTasks(resources.child(project).child(plugin.prefix), projectResources).asInstanceOf[Seq[LoadedTask[_ <: TaskSpec]]])
  }

  override def putTask[T <: TaskSpec : ClassTag](project: Identifier, task: Task[T])
                                                (implicit userContext: UserContext): Unit = {
    plugin[T].writeTask(task, resources.child(project).child(plugin[T].prefix))
  }

  override def deleteTask[T <: TaskSpec : ClassTag](project: Identifier, task: Identifier)
                                                   (implicit userContext: UserContext): Unit = {
    plugin[T].removeTask(task, resources.child(project).child(plugin[T].prefix))
  }

  /**
    * Retrieve a list of all available tags.
    */
  override def readTags(project: Identifier)
                       (implicit userContext: UserContext): Iterable[Tag] = {
    implicit val readContext: ReadContext = ReadContext()
    val tagXmlFile = resources.child(project).get("tags.xml")
    if(tagXmlFile.nonEmpty) {
      val tagXml = tagXmlFile.read(XML.load)
      (tagXml \ "Tag").map(TagXmlFormat.read)
    } else {
      Iterable.empty
    }
  }

  /**
    * Add a new tag.
    * Adding a tag with an existing URI, will overwrite the corresponding tag.
    */
  override def putTag(project: Identifier, tag: Tag)
                     (implicit userContext: UserContext): Unit = {
    val tags = readTags(project).filterNot(_.uri == tag.uri) ++ Iterable(tag)
    updateTags(project, tags)
  }

  /**
    * Remove a tag.
    */
  override def deleteTag(project: Identifier, tagUri: String)
                        (implicit userContext: UserContext): Unit = {
    val tags = readTags(project).filterNot(_.uri == tagUri)
    updateTags(project, tags)
  }

  private def updateTags(project: Identifier, tags: Iterable[Tag]): Unit = {
    implicit val writeContext: WriteContext[Node] = WriteContext[Node]()
    val tagXml =
      <Tags>
        { tags.map(TagXmlFormat.write) }
      </Tags>
    val tagXmlFile = resources.child(project).get("tags.xml")
    tagXmlFile.write()(tagXml.write)
  }

  private def plugin[T <: TaskSpec : ClassTag]: XmlSerializer[T] = {
    val taskClass = implicitly[ClassTag[T]].runtimeClass
    plugins.find(_._1.isAssignableFrom(taskClass))
      .getOrElse(throw new RuntimeException("No plugin available for class " + taskClass))
      ._2.asInstanceOf[XmlSerializer[T]]
  }

  /**
    * Refreshes all projects, i.e. cleans all possible caches if there are any and reloads all projects freshly.
    */
  override def refresh()(implicit userContext: UserContext): Unit = {
    // No refresh needed, all tasks are read from the file system on every read. Nothing is cached
    // This is implemented to avoid warnings on project imports.
  }

  /**
    * Returns None, because the projects are not held as RDF.
    */
  override def sparqlEndpoint: Option[SparqlEndpoint] = None
}
