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

package org.silkframework.entity

import java.io.{DataInput, DataOutput}

import org.silkframework.config.Prefixes
import org.silkframework.entity.metadata.{EntityMetadata, EntityMetadataXml, GenericExecutionFailure}
import org.silkframework.entity.paths.{TypedPath, UntypedPath}
import org.silkframework.failures.FailureClass
import org.silkframework.util.Uri

import scala.language.existentials
import scala.xml.Node

/**
  * An Entity can represent an instance of any given concept
  * @param uri         - an URI as identifier
  * @param values        - A list of values of the properties defined in the provided EntitySchema
  * @param schema      - The EntitySchema defining the nature of this entity
  * @param metadata    - metadata object containing all available metadata information about this object
  *                    an Entity is marked as 'failed' if [[org.silkframework.entity.metadata.EntityMetadata.failure]] is set. It becomes sealed.
  */
case class Entity(
    uri: Uri,
    values: IndexedSeq[Seq[String]],
    schema: EntitySchema,
    metadata: EntityMetadata[_] = EntityMetadataXml()
  ) extends Serializable {

  def copy(
    uri: Uri = this.uri,
    values: IndexedSeq[Seq[String]] = this.values,
    schema: EntitySchema = this.schema,
    metadata: EntityMetadata[_] = this.metadata,
    failureOpt: Option[FailureClass] = None,
    projectValuesIfNewSchema: Boolean = false
  ): Entity = this.failure match{
    case Some(_) => this                                // if origin entity has already failed, we forward it so the failure is not overwritten
    case None =>
      val actualVals = if(schema != this.schema && projectValuesIfNewSchema) shiftProperties(schema) else values  //here we remap value indices for possible shifts of typed paths
      val actualMetadata = failureOpt match{
        case Some(f) if metadata.failure.metadata.isEmpty => metadata.addFailure(f)
        case _ => metadata
      }
      new Entity(uri, actualVals, schema, actualMetadata)
  }

  /**
    * Will remap the index positions of values in case the typed paths of the EntitySchema were changed
    * @param es - the new schema
    * @return - the new value array
    */
  private def shiftProperties(es: EntitySchema): IndexedSeq[Seq[String]] ={
    es.typedPaths.map(tp => this.schema.typedPaths.find(p => p.equalsUntyped(tp)) match{
      case Some(fp) => this.evaluate(fp)
      case None => Seq()
    })
  }

  /**
    * Convenience function for applying a new schema without validating (e.g. when renaaming properties)
    * @param es - the schema
    * @return
    */
  def applyNewSchema(es: EntitySchema): Entity = copy(schema = es, projectValuesIfNewSchema = false)

  val failure: Option[GenericExecutionFailure] = {
    if(metadata.failure.metadata.isEmpty) {                                                    // if no failure has occurred yet
      if(uri.uri.trim.isEmpty){
        Some(GenericExecutionFailure(new IllegalArgumentException("Entity with an empty URI is not allowed.")))
      }
      else if (! this.validate) { // if entity is not valid
        Some(GenericExecutionFailure(new IllegalArgumentException("Provided schema does not fit entity values or sub-entities.")))
      }
      else{
        None
      }}
    else {
      metadata.failure.metadata.map(_.rootCause)   //propagate former failure
    }
  }

  /**
    * Signals if the given [[Entity]] is marked as having failed to evaluate
    */
  def hasFailed: Boolean = failure.isDefined

  /**
    * Will retrieve the values of a given path (if available)
    * @param path - the property or path
    */
  @deprecated("Use evaluate(path: TypedPath) instead, since uniqueness of paths are only guaranteed with provided ValueType.", "18.03")
  def evaluate(path: UntypedPath): Seq[String] = {
    valueOfPath(path)
  }

  /**
    * Will retrieve the values of a given path (if available)
    * @param path - the property or path
    */
  def evaluate(path: TypedPath): Seq[String] = valueOfTypedPath(path)

  /**
    * returns the all values for the column index of the row representing this entity
    * @param pathIndex - the index in the value array
    */
  def evaluate(pathIndex: Int): Seq[String] = {
    this.values(pathIndex)
  }

  /**
    * returns all values of a given property in the entity
    * @param path - the property or path
    */
  def valueOfTypedPath(path: TypedPath): Seq[String] ={
    if(path.operators.isEmpty) {
      Seq(uri)
    } else {
      schema.getSchemaOfProperty(path) match {
        case Some(es) =>
          evaluate(es.indexOfTypedPath(TypedPath.removePathPrefix(path, es.subPath)))
        case None => Seq()
      }
    }
  }

  /**
    * returns all values of a given property in the entity
    * NOTE: there might be a chance that a given path exists twice with different value types, use [[valueOfTypedPath()]] instead
    * @param path - the property or path
    */
  def valueOfPath(path: UntypedPath): Seq[String] ={
    if(path.operators.isEmpty) {
      Seq(uri)
    } else {
      schema.getSchemaOfPropertyIgnoreType(path) match {
        case Some(es) =>
          evaluate(es.indexOfPath(UntypedPath.removePathPrefix(path, es.subPath)))
        case None => Seq()
      }
    }
  }

  /**
    * returns the first value (of possibly many) for the property of the given name in this entity
    * NOTE: there might be a chance that a given path exists twice with different value types, use TypedPath based version instead
    * @param property - the property name to query
    * @return
    */
  def singleValue(property: String)(implicit prefixes: Prefixes = Prefixes.default): Option[String] = valueOfPath(UntypedPath.saveApply(property)).headOption

  /**
    * returns the first value (of possibly many) for the property of the given name in this entity
    * @param path - the path to query
    * @return
    */
  def singleValue(path: TypedPath): Option[String] = valueOfTypedPath(path).headOption

  /**
    * Validates the complete value row against the given types of the schema
    * @return - the result of the validation matrix (where all values are valid)
    */
  private def validate: Boolean = {
    val tps = schema match {
      case mes: MultiEntitySchema => mes.pivotSchema
      case _ => schema
    }
    val valsSize = values.size >= tps.typedPaths.size
    val valsConform = tps.typedPaths.zipWithIndex.forall(tp =>{
      if(tp._2 < values.size)
        values(tp._2).forall(v => tp._1.valueType.validate(v))
      else
        throw new ArrayIndexOutOfBoundsException(tp._2)
    })
    valsSize && valsConform
  }

  def toXML: Node = {
    <Entity uri={uri.toString}>
      <Values>      {
        for (valueSet <- values) yield {
          <Val> {
            for (value <- valueSet) yield {
              <e>{value}</e>
            }
            }
          </Val>
        }
        }
      </Values>
    </Entity>
  }

  def serialize(stream: DataOutput) {
    stream.writeUTF(uri)
    for (valueSet <- values) {
      stream.writeInt(valueSet.size)
      for (value <- valueSet) {
        stream.writeUTF(value)
      }
    }
  }

  override def toString: String = failure match{
    case Some(f) => uri + " failed with: " + f.getMessage
    case None => uri + "{\n  " + values + "\n}"
  }


  override def equals(other: Any): Boolean = other match {
    case o: Entity => this.uri.toString == o.uri.toString && this.values == o.values && this.schema == o.schema
    case _ => false
  }

  override def hashCode(): Int = {
    var hashCode = uri.toString.hashCode
    hashCode = hashCode * 31 + values.foldLeft(1)(31 * _ + _.hashCode())
    hashCode = hashCode * 31 + schema.hashCode()
    hashCode
  }
}

object Entity {

  def empty(uri: Uri): Entity = new Entity(uri, IndexedSeq.empty, EntitySchema.empty)

  def apply(uri: String, values: IndexedSeq[Seq[String]], schema: EntitySchema): Entity = {
    new Entity(uri, values, schema)
  }

  def apply(uri: Uri, values: IndexedSeq[Seq[String]], schema: EntitySchema): Entity = {
    new Entity(uri, values, schema)
  }

  def apply(uri: String, values: IndexedSeq[Seq[String]], schema: EntitySchema, failureOpt: Option[FailureClass]): Entity = {
    new Entity(uri, values, schema, failureOpt match{
      case Some(t) => EntityMetadataXml(t)
      case None => EntityMetadataXml()
    })
  }

  /**
    * Instantiates a new Entity and fails it with the given Throwable
    * NOTE: values are all set to empty.
    * @param uri - uri of the entity
    * @param schema - the EntitySchema pertaining to the Entity
    * @param failure - the Throwable which failed this Enity as [[FailureClass]]
    * @return - the failed Entity
    */
  def apply(uri: Uri, schema: EntitySchema, failure: FailureClass): Entity = {
    val emptyValues = schema.typedPaths.map(_ => Seq.empty)
    Entity(uri, emptyValues, schema, Some(failure))
  }

  /**
    * Instantiates a new Entity and fails it with the given Throwable
    * @param uri - uri of the entity
    * @param values - the values applied for the failed Entity
    * @param schema - the EntitySchema pertaining to the Entity
    * @param failure - the Throwable which failed this Enity as [[FailureClass]]
    * @return - the failed Entity
    */
  def apply(uri: Uri, values: IndexedSeq[Seq[String]], schema: EntitySchema, failure: FailureClass): Entity = Entity(uri, values, schema, Some(failure))


  def fromXML(node: Node, desc: EntitySchema): Entity = {
    if(node == null)
      return null
    new Entity(
      uri = (node \ "@uri").text.trim,
      values = {
        for (valNode <- node \ "Values" \ "Val") yield {
          for (e <- valNode \ "e") yield e.text
        }
      }.toIndexedSeq,
      schema = desc
    )
  }

  def deserialize(stream: DataInput, desc: EntitySchema): Entity = {
    //Read URI
    val uri = stream.readUTF()

    //Read Values
    def readValue = Seq.fill(stream.readInt)(stream.readUTF)

    desc match{
      case mes: MultiEntitySchema =>
        val values = IndexedSeq.fill(mes.pivotSchema.typedPaths.size)(readValue)
        Entity(uri, values, mes)
      case es: EntitySchema =>
        val values = IndexedSeq.fill(desc.typedPaths.size)(readValue)
        Entity(uri, values, es)
    }
  }
}
