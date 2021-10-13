package org.silkframework.plugins.dataset.json
import org.silkframework.runtime.resource.Resource
import org.silkframework.util.Identifier

class JsonSourceStreamingTest extends JsonSourceTest {

  behavior of "JsonSourceStreaming"

  override protected def createSource(resource: Resource, basePath: String, uriPattern: String): JsonSource = {
    new JsonSourceStreaming(Identifier.fromAllowed(resource.name), resource, basePath, uriPattern)
  }
}
