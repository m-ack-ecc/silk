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

package org.silkframework.rule.similarity

import org.silkframework.entity.{Entity, Index}
import org.silkframework.rule.Operator
import org.silkframework.runtime.serialization.{ReadContext, WriteContext, XmlFormat, XmlSerialization}
import org.silkframework.util.{DPair, Identifier}

import scala.collection.mutable.ArrayBuffer
import scala.xml.Node

/**
 * An aggregation combines multiple similarity values into a single value.
 */
case class Aggregation(id: Identifier = Operator.generateId,
                       weight: Int = 1,
                       aggregator: Aggregator,
                       operators: Seq[SimilarityOperator]) extends SimilarityOperator {

  require(weight > 0, "weight > 0")
  //TODO learning currently may produce empty aggregations when cleaning
  //require(!operators.isEmpty, "!operators.isEmpty")

  def indexing: Boolean = operators.exists(_.indexing)

  private val operatorsSize: Int = operators.size

  /**
   * Computes the similarity between two entities.
   *
   * @param entities The entities to be compared.
   * @param limit The similarity threshold.
   * @return The similarity as a value between -1.0 and 1.0.
   *         None, if no similarity could be computed.
   */
  override def apply(entities: DPair[Entity], limit: Double): Option[Double] = {
    var totalWeights = 0.0
    for(operator <- operators) {
      totalWeights += operator.weight
    }

    val weightedValues = new ArrayBuffer[WeightedSimilarityScore](operatorsSize)
    for(op <- operators) {
      val opThreshold = aggregator.computeThreshold(limit, op.weight.toDouble / totalWeights)
      val score = op(entities, opThreshold)
      weightedValues += WeightedSimilarityScore(score, op.weight)
    }

    aggregator.evaluate(weightedValues).score
  }

  /**
   * Indexes an entity.
   *
   * @param entity The entity to be indexed
   * @param threshold The similarity threshold.
   * @return A set of (multidimensional) indexes. Entities within the threshold will always get the same index.
   */
  override def index(entity: Entity, sourceOrTarget: Boolean, threshold: Double): Index = {
    val totalWeights = operators.map(_.weight).sum

    val indexSets = {
      for (op <- operators if op.indexing) yield {
        val opThreshold = aggregator.computeThreshold(threshold, op.weight.toDouble / totalWeights)
        val index = op.index(entity, sourceOrTarget, opThreshold)
        index
      }
    }.filterNot(_.isEmpty)

    aggregator.aggregateIndexes(indexSets)
  }

  override def children = operators

  override def withChildren(newChildren: Seq[Operator]) = {
    copy(operators = newChildren.map(_.asInstanceOf[SimilarityOperator]))
  }
}

object Aggregation {

  /**
   * XML serialization format.
   */
  implicit object AggregationFormat extends XmlFormat[Aggregation] {

    import XmlSerialization._

    def read(node: Node)(implicit readContext: ReadContext): Aggregation = {
      val weightStr = (node \ "@weight").text
      implicit val prefixes = readContext.prefixes
      implicit val resourceManager = readContext.resources

      val aggregator = Aggregator((node \ "@type").text, Operator.readParams(node))

      Aggregation(
        id = Operator.readId(node),
        weight = if (weightStr.isEmpty) 1 else weightStr.toInt,
        operators = node.child.filter(n => n.label == "Aggregate" || n.label == "Compare").map(fromXml[SimilarityOperator]).toIndexedSeq,
        aggregator = aggregator
      )
    }

    def write(value: Aggregation)(implicit writeContext: WriteContext[Node]): Node = {
      value.aggregator match {
        case Aggregator(plugin, params) =>
          <Aggregate id={value.id} weight={value.weight.toString} type={plugin.id}>
            {value.operators.map(toXml[SimilarityOperator])}
          </Aggregate>
      }
    }
  }
}
