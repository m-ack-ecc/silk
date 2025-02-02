package controllers.core.util

import org.silkframework.runtime.validation.ValidationException
import play.api.libs.json.{JsPath, JsValue, Json, JsonValidationError, Reads}

import java.io.InputStream
import scala.util.control.NonFatal

/**
  * Some utility methods to work with (Play) Json.
  */
object JsonUtils {

  def validateJson[T](jsonStr: String)
                        (implicit rds: Reads[T]): T = {
    validateJsonFromValue(handleParseError(Json.parse(jsonStr)))
  }

  def validateJson[T](jsonIS: InputStream)
                        (implicit rds: Reads[T]): T = {
    validateJsonFromValue(handleParseError(Json.parse(jsonIS)))
  }

  private def handleParseError(jsValue: => JsValue): JsValue = {
    try {
      jsValue
    } catch {
      case NonFatal(ex) =>
        throw new ValidationException("Could not parse Json", ex)
    }
  }

  def validateJsonFromValue[T](jsValue: JsValue)
                              (implicit rds: Reads[T]): T = {
    val result = Json.fromJson[T](jsValue)
    result.fold(
      errors => {
        throw new ValidationException("Invalid JSON structure. Error details: " + errorsToString(errors))
      },
      obj => {
        obj
      }
    )
  }

  def errorsToString(errors: Seq[(JsPath, Seq[JsonValidationError])]): String = {
    val errorStrings = errors map { case (path, validationErrors) =>
        "JSON Path \"" + path.toJsonString + "\" with error(s): " + validationErrors.map('"' + _.message + '"').mkString(", ")
    }
    errorStrings.mkString(", ")
  }
}
