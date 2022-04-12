package org.silkframework.plugins.dataset.text

import org.scalatest.{FlatSpec, Matchers}
import org.silkframework.config.Prefixes
import org.silkframework.dataset.TypedProperty
import org.silkframework.entity.{EntitySchema, ValueType}
import org.silkframework.runtime.activity.UserContext
import org.silkframework.runtime.resource.InMemoryResourceManager

class TextFileDatasetTest extends FlatSpec with Matchers {

  behavior of "TextFileDataset"

  private val resources = InMemoryResourceManager()

  private val resource = resources.get("resource")

  private val dataset = TextFileDataset(resource)

  private implicit def userContext: UserContext = UserContext.Empty

  private implicit val prefixes: Prefixes = Prefixes.empty

  private val testValue = "value"

  it should "write plain text files" in {
    val sink = dataset.entitySink
    sink.openTable(dataset.typeName, Seq(TypedProperty(dataset.property, ValueType.STRING, isBackwardProperty = false)), singleEntity = false)
    sink.writeEntity("dummySubject", IndexedSeq(Seq(testValue)))
    sink.closeTable()
    sink.close()

    resource.loadAsString().trim shouldBe testValue
  }

  it should "read plain text files" in {
    val source = dataset.source
    source.retrieveTypes().map(_._1) shouldBe Seq(dataset.typeName)
    source.retrievePaths(dataset.typeName) shouldBe Seq(dataset.path)

    val entities = source.retrieve(EntitySchema(dataset.typeName, IndexedSeq(dataset.path))).entities
    entities.size shouldBe 1
    entities.head.values shouldBe Seq(Seq(testValue))
  }

}
