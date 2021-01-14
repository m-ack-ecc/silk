package org.silkframework.rule.plugins.aggegrator

import org.silkframework.entity.Index
import org.silkframework.rule.similarity.{SimilarityScore, SingleValueAggregator, WeightedSimilarityScore}
import org.silkframework.runtime.plugin.PluginCategories
import org.silkframework.runtime.plugin.annotations.{AggregatorExample, AggregatorExamples, Param, Plugin}

@Plugin(
  id = "handleMissingValues",
  categories = Array("All", PluginCategories.recommended),
  label = "Handle missing values",
  description = "Generates a default similarity score, if no similarity score is provided (e.g., due to missing values)."
)
@AggregatorExamples(Array(
  new AggregatorExample(
    inputs = Array(0.1),
    output = 0.1
  ),
  new AggregatorExample(
    parameters = Array("defaultValue", "1.0"),
    inputs = Array(Double.NaN),
    output = 1.0
  )
))
case class HandleMissingValuesAggregator(
  @Param("The default value to be generated, if no similarity score is provided. '1' represents boolean true and '-1' represents boolean false.")
  defaultValue: Double = -1.0) extends SingleValueAggregator {

  private val defaultSimilarity = defaultValue

  override def evaluateValue(value: WeightedSimilarityScore): SimilarityScore = {
    if (value.score.isEmpty) {
      SimilarityScore(defaultSimilarity)
    } else {
      value.unweighted
    }
  }

  override def combineIndexes(index1: Index, index2: Index): Index = Index.default

  override def preProcessIndexes(indexes: Seq[Index]): Seq[Index] = Seq(Index.default)
}