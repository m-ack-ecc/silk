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

package org.silkframework.learning.cleaning

import org.silkframework.learning.generation.LinkageRuleGenerator
import org.silkframework.learning.individual._
import org.silkframework.rule.LinkageRule
import org.silkframework.runtime.activity.{Activity, ActivityContext, UserContext}
import org.silkframework.util.RandomUtils

class CleanPopulationTask(population: Population, fitnessFunction: (LinkageRule => Double), generator: LinkageRuleGenerator, randomSeed: Long) extends Activity[Population] {

  /** Maximum difference between two fitness values to be considered equal. */
  private val fitnessEpsilon = 0.0001

  override def run(context: ActivityContext[Population])
                  (implicit userContext: UserContext): Unit = {
    val individuals = population.individuals.par.map(cleanIndividual).seq

    val distinctIndividuals = removeDuplicates(individuals)

    // Generate a new random individual for each duplicate that has been removed
    val randomIndividuals = for(random <- RandomUtils.randomSeq(population.individuals.size - distinctIndividuals.size, randomSeed).par) yield {
        val linkageRule = generator(random)
        Individual(linkageRule, fitnessFunction(linkageRule.build))
    }

    context.value.update(Population(distinctIndividuals ++ randomIndividuals))
  }

  private def removeDuplicates(individuals: Seq[Individual]) = {
    val sortedIndividuals = individuals.sortBy(-_.fitness)

    var currentIndividual = sortedIndividuals.head
    var distinctIndividuals = currentIndividual :: Nil

    for (individual <- sortedIndividuals.tail) {
      if (!compareLinkageRules(currentIndividual.node, individual.node)) {
        currentIndividual = individual
        distinctIndividuals ::= individual
      }
    }

    distinctIndividuals
  }

  private def compareLinkageRules(node1: LinkageRuleNode, node2: LinkageRuleNode) = (node1.aggregation, node2.aggregation) match {
    case (None, None) => true
    case (Some(op1), Some(op2)) => compareOperators(op1, op2)
    case _ => false
  }

  private def compareOperators(operator1: Node, operator2: OperatorNode): Boolean = (operator1, operator2) match {
    case (AggregationNode(agg1, _, ops1), AggregationNode(agg2, _, ops2)) => {
      agg1 == agg2 &&
          ops1.forall(op1 => ops2.exists(op2 => compareOperators(op1, op2)))
    }
    case (ComparisonNode(inputs1, limit1, weight1, required1, metric1), ComparisonNode(inputs2, limit2, weight2, required2, metric2)) => {
      metric1 == metric2 &&
          compareInputs(inputs1.source, inputs2.source) &&
          compareInputs(inputs1.target, inputs2.target)
    }
    case _ => false
  }

  private def compareInputs(input1: InputNode, input2: InputNode): Boolean = (input1, input2) match {
    case (PathInputNode(_, path1), PathInputNode(_, path2)) => path1 == path2
    case (TransformNode(_, inputs1, transformer1), TransformNode(_, inputs2, transformer2)) => {
      transformer1 == transformer2 &&
          (inputs1 zip inputs2).forall {
            case (i1, i2) => compareInputs(i1, i2)
          }
    }
    case _ => false
  }

  private def cleanIndividual(individual: Individual): Individual = {
    val root = NodeTraverser(individual.node)
    implicit val fitness = individual.fitness

    val cleanLinkageRule = clean(root).asInstanceOf[LinkageRuleNode]

    Individual(cleanLinkageRule, individual.fitness)
  }

  /**
   * Recursively traverses through the tree and calls cleanNode() for each node.
   */
  private def clean(location: NodeTraverser)(implicit fitness: Double): Node = {
    val updatedLocation = cleanNode(location)

    val updatedChildren = updatedLocation.iterateChildren.map(clean).toList

    updatedLocation.node.updateChildren(updatedChildren)
  }

  /**
   * Cleans a single node.
   */
  private def cleanNode(location: NodeTraverser)(implicit fitness: Double): NodeTraverser = {
    val updatedLocation = cleanTransformation(location)
    cleanAggregation(updatedLocation)
  }

  /**
   * Removes redundant transformations.
   */
  private def cleanTransformation(location: NodeTraverser)(implicit fitness: Double): NodeTraverser = location.node match {
    case TransformNode(_, input :: Nil, _) => {
      val updatedLocation = location.update(input)

      if (evaluate(updatedLocation) >= fitness - fitnessEpsilon) {
        cleanTransformation(updatedLocation)
      } else {
        location
      }
    }
    case _ => location
  }

  /**
   * Removes all redundant operators of an aggregation node.
   */
  private def cleanAggregation(location: NodeTraverser)(implicit fitness: Double): NodeTraverser = location.node match {
    case AggregationNode(_, _, (operator: AggregationNode) :: Nil) =>  cleanAggregation(location.moveDown.get)
    case AggregationNode(_, _, operator :: Nil) => location.moveDown.get
    case AggregationNode(_, _, operators) => removeRedundantOperators(location, Nil, operators)
    case _ => location
  }

  private def removeRedundantOperators(node: NodeTraverser, checkedOperators: List[Node], remainingOperators: List[Node])(implicit fitness: Double): NodeTraverser = {
    remainingOperators match {
      case head :: tail => {
        val updatedNode = node.update(node.node.updateChildren(checkedOperators ::: tail))

        if (evaluate(updatedNode) < fitness - fitnessEpsilon)
          removeRedundantOperators(node, head :: checkedOperators, tail)
        else
          removeRedundantOperators(updatedNode, checkedOperators, tail)
      }
      case Nil => node
    }
  }

  private def evaluate(node: NodeTraverser) = {
    val linkageRule = node.root.node.asInstanceOf[LinkageRuleNode]
    fitnessFunction(linkageRule.build)
  }
}