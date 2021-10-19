package controllers.workspaceApi

import controllers.workspaceApi.uriPattern.{UriPatternRequest, UriPatternResponse, UriPatternResult}
import helper.IntegrationTestTrait
import org.scalatest.{FlatSpec, MustMatchers}
import org.silkframework.serialization.json.JsonHelpers
import org.silkframework.util.ConfigTestTrait
import org.silkframework.workspace.SingleProjectWorkspaceProviderTestTrait
import org.silkframework.workspace.activity.transform.GlobalUriPatternCache
import play.api.libs.json.Json
import play.api.routing.Router

class WorkspaceUriPatternApiTest extends FlatSpec with SingleProjectWorkspaceProviderTestTrait
  with IntegrationTestTrait
  with ConfigTestTrait
  with MustMatchers {
  behavior of "Workspace URI pattern API"

  override def projectPathInClasspath: String = "diProjects/9b50b3b6-eab1-4261-a743-eb3570e67f25_URItemplatetestproject.zip"

  override def workspaceProviderId: String = "inMemory"

  override def routes: Option[Class[_ <: Router]] = Some(classOf[testWorkspace.Routes])

  it should "return URI patterns for the provided classes" in {
    userWorkspace.activity[GlobalUriPatternCache].control.waitUntilFinished()
    uriPatterns(Seq("urn:root:type", "urn:object:type")) mustBe UriPatternResponse(Seq(
      UriPatternResult(
        "urn:root:type",
        Some("urn:root:{ID}--{…@id}"),
        "urn:root:{ID}--{Properties/Property/Key/@id}"
      ),
      UriPatternResult(
        "urn:object:type",
        Some("urn:events:{Birth}-{…unknown}"),
        "urn:events:{Birth}-{<https://example.com/path/unknown>}"
      )
    ))
    uriPatterns(Seq("urn:event:type")) mustBe UriPatternResponse(Seq(
      UriPatternResult(
        "urn:event:type",
        Some("urn:events:{Birth}-{…unknown}"),
        "urn:events:{Birth}-{<https://example.com/path/unknown>}"
      )
    ))
  }

  private def uriPatterns(typeUris: Seq[String]): UriPatternResponse = {
    val url = controllers.workspaceApi.routes.WorkspaceUriPatternApi.uriPatterns()
    val response = client.url(s"$baseUrl$url").post(Json.toJson(UriPatternRequest(typeUris)))
    JsonHelpers.fromJsonValidated[UriPatternResponse](checkResponse(response).json)
  }

  /** The properties that should be changed.
    * If the value is [[None]] then the property value is removed,
    * else it is set to the new value.
    */
  override def propertyMap: Map[String, Option[String]] = Map(
    "caches.global.uriPatternCache.enabled" -> Some("true")
  )
}
