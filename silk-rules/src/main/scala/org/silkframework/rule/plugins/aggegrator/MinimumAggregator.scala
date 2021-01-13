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

package org.silkframework.rule.plugins.aggegrator

import org.silkframework.entity.Index
import org.silkframework.rule.similarity.{Aggregator, SimilarityScore, WeightedSimilarityScore}
import org.silkframework.runtime.plugin.PluginCategories
import org.silkframework.runtime.plugin.annotations.Plugin

@Plugin(
  id = "min",
  categories = Array("All", PluginCategories.recommended),
  label = "And",
  description = "All input scores must be within the threshold. Selects the minimum score."
)
case class MinimumAggregator() extends Aggregator {
  /**
   * Returns the minimum of the provided values.
   */
  override def evaluate(values: Seq[WeightedSimilarityScore]): SimilarityScore = {
    if (values.isEmpty) {
      SimilarityScore.none
    } else {
      var minScore = Double.MaxValue
      for(value <- values) {
        minScore = math.min(minScore, value.score.getOrElse(-1.0))
      }
      SimilarityScore(minScore)
    }
  }

  /**
   * Combines two indexes into one.
   */
  override def combineIndexes(index1: Index, index2: Index): Index = index1 conjunction index2
}
