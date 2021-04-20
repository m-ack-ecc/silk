/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.silkframework.dataset

import org.silkframework.config.Task
import org.silkframework.dataset.DatasetSpec.{DataSourceWrapper, GenericDatasetSpec}
import org.silkframework.entity._
import org.silkframework.entity.paths.TypedPath
import org.silkframework.execution.EntityHolder
import org.silkframework.runtime.activity.UserContext
import org.silkframework.util.{Identifier, SampleUtil, Uri}

import scala.util.Random

/**
 * The base trait of a concrete source of entities.
 */
trait DataSource {

  /**
    * The dataset task underlying the Datset this source belongs to
    * @return
    */
  def underlyingTask: Task[DatasetSpec[Dataset]]

  /**
   * Retrieves known types in this source.
   * Implementations are only required to work on a best effort basis i.e. it does not necessarily return any or all types.
   * The default implementation returns an empty traversable.
   *
   * @param limit Restricts the number of types to be retrieved. If not given, all found types are returned.
   *
   */
  def retrieveTypes(limit: Option[Int] = None)
                   (implicit userContext: UserContext): Traversable[(String, Double)]

  /**
   * Retrieves the most frequent paths in this source.
   * Implementations are only required to work on a best effort basis i.e. it does not necessarily return all paths in the source.
   * The default implementation returns an empty traversable.
   *
   * @param typeUri The entity type for which paths shall be retrieved
   * @param depth Only retrieve paths up to a certain length. If not given, only paths of length 1 are returned. Since
    *              this value can be set to Int.MaxValue, the source has to make sure that it returns a result that
    *              can still be handled, e.g. it is Ok for XML and JSON to return all paths, for GRAPH data models this
    *              would be infeasible.
   * @param limit Restricts the number of paths to be retrieved. If not given, all found paths are returned.
   *
   * @return A Sequence of the found paths sorted by their frequency (most frequent first).
   */
  def retrievePaths(typeUri: Uri, depth: Int = 1, limit: Option[Int] = None)
                   (implicit userContext: UserContext): IndexedSeq[TypedPath]

  /**
   * Retrieves entities from this source which satisfy a specific entity schema.
   *
   * @param entitySchema The entity schema
   * @param limit Limits the maximum number of retrieved entities
   *
   * @return A Traversable over the entities. The evaluation of the Traversable may be non-strict.
   */
  def retrieve(entitySchema: EntitySchema, limit: Option[Int] = None)
              (implicit userContext: UserContext): EntityHolder

  /**
   * Retrieves a list of entities from this source.
   *
   * @param entitySchema The entity schema
   * @param entities The URIs of the entities to be retrieved.
   *
   * @return A Traversable over the entities. The evaluation of the Traversable may be non-strict.
   */
  def retrieveByUri(entitySchema: EntitySchema, entities: Seq[Uri])
                   (implicit userContext: UserContext): EntityHolder

  /**
   * Samples a fixed size set of entities from the whole dataset.
   * The default implementation iterates once over all entities.
   * @param entityDesc  - EntitySchema user to retrieve the sample entities
   * @param size        - desired size of the sample
   * @return
   */
  def sampleEntities(entityDesc: EntitySchema,
                     size: Int,
                     filterOpt: Option[Entity => Boolean] = None)
                    (implicit userContext: UserContext, random: Random): Seq[Entity] = {
    val entities = retrieve(entityDesc).entities
    SampleUtil.sample(entities, size, filterOpt)
  }

  /**
    * Will generate a unique IRI identifying a given Entity throughout the whole framework (pattern: urn:instance:taskId#identifier )
    * @param identifier - a unique identifier of the given entity (e.g. a unique property of the Entity itself or an index)
    * @return - the unique IRI
    */
  protected def genericEntityIRI(identifier: Identifier): String = DataSource.generateEntityUri(underlyingTask.id, identifier)

  def characteristics: DataSourceCharacteristics
}

object DataSource{

  //the URN_NID prefix (see rfc 8141) for for generic dataset and entity naming
  val URN_NID_PREFIX: String = "urn:instance:"

  /**
    * Will generate a unique IRI identifying an Entity throughout the whole framework (pattern: urn:instance:groupId#entityId )
    * @param groupId  - the identifier of the dataset, node or sub-group
    * @param entityId - identifier of the entity or instance
    * @return
    */
  def generateEntityUri(groupId: Identifier, entityId: Identifier): String = URN_NID_PREFIX + groupId + "#" + entityId

  def pluginSource(datasetTask: GenericDatasetSpec)
                  (implicit userContext: UserContext): DataSource = {
    datasetTask.source match {
      case wrapper: DataSourceWrapper => wrapper.source
      case source: DataSource => source
    }
  }
}

/** Characteristics of a data source.
  *
  * @param supportedPathExpressions The characteristics of the supported path expressions.
  */
case class DataSourceCharacteristics(supportedPathExpressions: SupportedPathExpressions = SupportedPathExpressions())

/** The kind of path expressions supported by a data source.
  *
  * @param multiHopPaths  If enabled it is possible to define multi-hop paths (e.g. in RDF, JSON, XML). Else only single-hop
  *                       path are supported.
  * @param backwardPaths  If the data source supports backward paths, i.e. reversing the direction of a property (e.g. in
  *                       RDF, JSON (parent), XML (parent)).
  * @param languageFilter If the data source supports language filters, i.e. is able to filter by different language versions
  *                       of property values (only supported in RDF).
  * @param propertyFilter If the data source supports (single-hop forward) property filters.
  * @param specialPaths   The data source specific paths that are supported by a data source, e.g. row ID in CSV.
  */
case class SupportedPathExpressions(multiHopPaths: Boolean = false,
                                    backwardPaths: Boolean = false,
                                    languageFilter: Boolean = false,
                                    propertyFilter: Boolean = false,
                                    specialPaths: Seq[SpecialPathInfo] = Seq.empty)

/**
  * Information about data source specific special paths that have a special semantic.
  *
  * @param value       The path value.
  * @param description Description of the semantics of the special path.
  */
case class SpecialPathInfo(value: String, description: Option[String])